import { mkdtemp, mkdir, readdir, readFile, rm, writeFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { UploadStorageService, UPLOAD_QUOTA_BYTES, validateUpload } from "../../src/students/upload-storage.service.js";

describe("Upload storage quota and lifecycle", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let folder: string;
  const file = (name = "report.pdf", data = Buffer.from("%PDF-test")) => ({ originalname: name, buffer: data, size: data.length } as Express.Multer.File);
  const db: any = { query: jest.fn(), transaction: jest.fn(async work => work({})) };
  let storage: UploadStorageService;
  const submitted = () => join(folder, "public/submissions/submitted");
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "pgsms-security-upload-"));
    jest.spyOn(process, "cwd").mockReturnValue(folder);
    db.transaction.mockImplementation(async (work: any) => work({}));
    storage = new UploadStorageService(db);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (!resolve(folder).startsWith(resolve(tmpdir()) + sep) || !basename(folder).startsWith("pgsms-security-upload-")) throw new Error("Unsafe cleanup target");
    await rm(folder, { recursive: true, force: true });
  });
  it("rejects forged images and oversized files before touching storage", () => {
    expect(() => validateUpload(file("image.png"), "photo")).toThrow();
    expect(() => validateUpload(file("huge.pdf", Buffer.alloc(21 * 1024 * 1024)), "submission")).toThrow();
    expect(() => validateUpload(file("x.html", Buffer.from("<html>")), "submission")).toThrow();
  });
  it("keeps the new reference and removes the replaced file after commit", async () => {
    await mkdir(submitted(), { recursive: true });
    const old = `userDocs-${id}-legacy.pdf`;
    await writeFile(join(submitted(), old), "old");
    let saved = "";
    await storage.replace(id, "submission", file(), async (_tx, name) => { saved = name; return { oldFile: old, value: "ok" }; });
    expect(await readdir(submitted())).toEqual([saved]);
    expect(await readFile(join(submitted(), saved))).toEqual(file().buffer);
  });
  it("does not write a file if the database operation fails", async () => {
    await expect(storage.replace(id, "submission", file(), async () => { throw new Error("DB rejected"); })).rejects.toThrow("DB rejected");
    expect(await readdir(submitted())).toEqual([]);
  });
  it("removes a newly written file when the transaction rolls back", async () => {
    db.transaction.mockImplementation(async (work: any) => { await work({}); throw new Error("commit failed"); });
    await expect(storage.replace(id, "submission", file(), async () => ({ value: "ok" }))).rejects.toThrow("commit failed");
    expect(await readdir(submitted())).toEqual([]);
  });
  it("enforces aggregate quota including existing orphan files", async () => {
    await mkdir(submitted(), { recursive: true });
    const old = join(submitted(), `userDocs-${id}-orphan.pdf`);
    await writeFile(old, ""); await truncate(old, UPLOAD_QUOTA_BYTES);
    await expect(storage.replace(id, "submission", file(), async () => ({ value: "ok" }))).rejects.toThrow("160 MB");
    expect(await readdir(submitted())).toHaveLength(1);
  });
  it("does not delete a path supplied outside the upload directory", async () => {
    const outside = join(folder, "keep.pdf"); await writeFile(outside, "keep");
    await storage.replace(id, "submission", file(), async () => ({ oldFile: "../../../keep.pdf", value: "ok" }));
    expect(await readFile(outside, "utf8")).toBe("keep");
  });
});
