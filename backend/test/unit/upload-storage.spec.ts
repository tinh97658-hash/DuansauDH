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
  let indexed: boolean;
  let entries: Array<{ kind: string; filename: string; bytes: number }>;
  const submitted = () => join(folder, "public/submissions/submitted");
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "pgsms-security-upload-"));
    jest.spyOn(process, "cwd").mockReturnValue(folder);
    db.transaction.mockImplementation(async (work: any) => work({}));
    indexed = false;
    entries = [];
    db.query.mockImplementation(async (sql: string, options: any = {}) => {
      const values = options.replacements || {};
      if (sql.startsWith('SELECT account_id')) return indexed ? [{ account_id: id }] : [];
      if (sql.startsWith('INSERT INTO upload_storage_accounts')) indexed = true;
      if (sql.includes('jsonb_to_recordset')) entries.push(...JSON.parse(values.files));
      else if (sql.startsWith('INSERT INTO upload_storage_files')) entries.push({ kind: values.kind, filename: values.filename, bytes: values.bytes });
      if (sql.startsWith('SELECT COALESCE(SUM')) return [{ bytes: String(entries.filter(entry =>
        entry.kind !== values.kind || entry.filename !== values.oldFile).reduce((sum, entry) => sum + entry.bytes, 0)) }];
      if (sql.startsWith('DELETE FROM upload_storage_files')) entries = entries.filter(entry => entry.kind !== values.kind || entry.filename !== values.filename);
      return [];
    });
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
  it('indexes legacy files once and uses indexed sizes for subsequent quota checks', async () => {
    await storage.replace(id, 'submission', file(), async () => ({ value: 'ok' }));
    expect(indexed).toBe(true);
    db.query.mockClear();
    await storage.replace(id, 'submission', file(), async () => ({ value: 'ok' }));
    expect(db.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT INTO upload_storage_accounts'))).toBe(false);
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('jsonb_to_recordset'))).toBe(false);
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, entry) => sum + entry.bytes, 0)).toBe(file().buffer.length * 2);
  });
  it('continues to account for an old file when filesystem cleanup fails', async () => {
    await mkdir(submitted(), { recursive: true });
    const old = `userDocs-${id}-legacy.pdf`;
    await writeFile(join(submitted(), old), 'old');
    jest.spyOn(jest.requireActual('node:fs/promises'), 'unlink').mockRejectedValue(Object.assign(new Error('busy'), { code: 'EBUSY' }));
    await storage.replace(id, 'submission', file(), async () => ({ oldFile: old, value: 'ok' }));
    expect(entries).toHaveLength(2);
    expect(await readdir(submitted())).toHaveLength(2);
    expect(entries.some(entry => entry.filename === old)).toBe(true);
  });
});
