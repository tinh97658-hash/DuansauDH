import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import { mkdir, open, readdir, stat, unlink } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";

export const UPLOAD_QUOTA_BYTES = 160 * 1024 * 1024;
type Kind = "photo" | "submission";
const directory = (kind: Kind) => resolve(process.cwd(), kind === "photo" ? "public/img/users" : "public/submissions/submitted");
const prefix = (id: string, kind: Kind) => `${kind === "photo" ? "user" : "userDocs"}-${id}-`;

export function validateUpload(file: Express.Multer.File, kind: Kind) {
  const data = file.buffer;
  const ext = extname(file.originalname).toLowerCase();
  if (!data?.length) throw new BadRequestException("Tệp không có nội dung.");
  if (data.length > (kind === "photo" ? 5 : 20) * 1024 * 1024) throw new PayloadTooLargeException();
  const starts = (hex: string) => data.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  const jpeg = starts("ffd8ff");
  const png = starts("89504e470d0a1a0a");
  const webp = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  const zip = starts("504b0304") || starts("504b0506");
  const ole = starts("d0cf11e0a1b11e1");
  const valid = [".jpg", ".jpeg"].includes(ext) ? jpeg : ext === ".png" ? png : ext === ".webp" ? webp
    : kind === "photo" ? false : ext === ".pdf" ? data.toString("ascii", 0, 5) === "%PDF-"
    : [".docx", ".xlsx", ".pptx", ".zip"].includes(ext) ? zip
    : [".doc", ".xls", ".ppt"].includes(ext) ? ole
    : ext === ".rar" ? starts("526172211a07") : ext === ".7z" ? starts("377abcaf271c") : false;
  if (!valid) throw new BadRequestException("Định dạng hoặc nội dung tệp không hợp lệ.");
  return ext;
}

@Injectable()
export class UploadStorageService {
  private readonly logger = new Logger(UploadStorageService.name);
  constructor(@InjectConnection() private readonly db: Sequelize) {}

  async replace<T>(id: string, kind: Kind, file: Express.Multer.File,
    persist: (transaction: Transaction, filename: string) => Promise<{ oldFile?: string | null; value: T }>): Promise<T> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException("Tài khoản không hợp lệ.");
    const ext = validateUpload(file, kind);
    const filename = `${prefix(id, kind)}${randomUUID()}${ext}`;
    const folder = directory(kind);
    await mkdir(folder, { recursive: true });
    let written = false;
    let oldFile: string | null | undefined;
    try {
      const result = await this.db.transaction(async transaction => {
        // Serializes quota and reference updates across all server processes.
        await this.db.query("SELECT pg_advisory_xact_lock(hashtext(:account))", { replacements: { account: `uploads:${id}` }, transaction });
        const change = await persist(transaction, filename);
        oldFile = change.oldFile;
        let used = 0;
        for (const type of ["photo", "submission"] as const) {
          await mkdir(directory(type), { recursive: true });
          for (const name of await readdir(directory(type))) {
            if (!name.startsWith(prefix(id, type)) || (type === kind && name === oldFile)) continue;
            try { used += (await stat(resolve(directory(type), name))).size; }
            catch (error: any) { if (error.code !== "ENOENT") throw error; }
          }
        }
        if (used + file.buffer.length > UPLOAD_QUOTA_BYTES) throw new PayloadTooLargeException("Tổng dung lượng tệp vượt hạn mức 160 MB.");
        const handle = await open(resolve(folder, filename), "wx", 0o600);
        written = true;
        try { await handle.writeFile(file.buffer); }
        finally { await handle.close(); }
        return change.value;
      });
      if (oldFile && basename(oldFile) === oldFile && oldFile.startsWith(prefix(id, kind))) {
        await this.remove(resolve(folder, oldFile));
      }
      return result;
    } catch (error) {
      if (written) await this.remove(resolve(folder, filename));
      throw error;
    }
  }

  private async remove(file: string) {
    try { await unlink(file); }
    catch (error: any) { if (error.code !== "ENOENT") this.logger.warn("Không thể dọn tệp upload; cần kiểm tra quyền ghi và dung lượng."); }
  }
}
