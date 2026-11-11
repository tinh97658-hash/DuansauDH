import { Sequelize, QueryTypes } from 'sequelize';
import { mkdtemp, mkdir, writeFile, truncate, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { UploadStorageService, UPLOAD_QUOTA_BYTES } from '../../src/students/upload-storage.service.js';

const describeDb = process.env.RUN_DASHBOARD_DB_TESTS === 'true' ? describe : describe.skip;
describeDb('Upload accounting on disposable PostgreSQL', () => {
  let db: Sequelize, folder: string, account: string;
  const file = () => ({ originalname: 'test.pdf', buffer: Buffer.from('%PDF-test') } as Express.Multer.File);
  beforeAll(async () => {
    if (!/\/pgsms_dashboard_test_\d+$/.test(process.env.DATABASE_URL || '')) throw Error('Disposable database required');
    db = new Sequelize(process.env.DATABASE_URL!, { logging: false });
  });
  beforeEach(async () => {
    account = randomUUID();
    folder = await mkdtemp(join(tmpdir(), 'pgsms-upload-db-'));
    jest.spyOn(process, 'cwd').mockReturnValue(folder);
    await db.query(`INSERT INTO students(id,name_with_initials,full_name,postal_address,email,tel_no,password,account_type,approval_state,created_at,updated_at)
      VALUES(:id,'Test','Test','Test',:email,'0','synthetic','registered','approved',now(),now())`,
    { replacements: { id: account, email: `${account}@example.invalid` } });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db.query('DELETE FROM students WHERE id=:id', { replacements: { id: account } });
    if (!resolve(folder).startsWith(resolve(tmpdir()) + sep) || !basename(folder).startsWith('pgsms-upload-db-')) throw Error('Unsafe cleanup target');
    await rm(folder, { recursive: true, force: true });
  });
  afterAll(async () => { await db?.close(); });

  it('counts legacy orphans, replaces references and does not rescan unrelated files after initialization', async () => {
    const path = join(folder, 'public/submissions/submitted');
    await mkdir(path, { recursive: true });
    const legacy = `userDocs-${account}-old.pdf`;
    await writeFile(join(path, legacy), '%PDF-old');
    const service = new UploadStorageService(db as any);
    let saved = '';
    await service.replace(account, 'submission', file(), async (_tx, name) => { saved = name; return { oldFile: legacy, value: 'ok' }; });
    expect(await readdir(path)).toEqual([saved]);
    const entries = await db.query<any>('SELECT filename,size_bytes FROM upload_storage_files WHERE account_id=:id',
      { replacements: { id: account }, type: QueryTypes.SELECT });
    expect(entries).toEqual([{ filename: saved, size_bytes: String(file().buffer.length) }]);
    await writeFile(join(path, 'unrelated-file.pdf'), '%PDF-other');
    await service.replace(account, 'submission', file(), async () => ({ value: 'ok' }));
    const rows = await db.query<any>('SELECT COUNT(*)::int AS count FROM upload_storage_files WHERE account_id=:id',
      { replacements: { id: account }, type: QueryTypes.SELECT });
    expect(rows[0].count).toBe(2);
  });
  it('rejects a legacy account at quota and rolls back the initialization atomically', async () => {
    const path = join(folder, 'public/submissions/submitted');
    await mkdir(path, { recursive: true });
    const legacy = join(path, `userDocs-${account}-orphan.pdf`);
    await writeFile(legacy, ''); await truncate(legacy, UPLOAD_QUOTA_BYTES);
    const service = new UploadStorageService(db as any);
    await expect(service.replace(account, 'submission', file(), async () => ({ value: 'ok' }))).rejects.toThrow('160 MB');
    const rows = await db.query('SELECT * FROM upload_storage_accounts WHERE account_id=:id',
      { replacements: { id: account }, type: QueryTypes.SELECT });
    expect(rows).toEqual([]);
    expect(await readdir(path)).toHaveLength(1);
  });
  it('rolls back the file and index when persistence fails after a write', async () => {
    const service = new UploadStorageService(db as any);
    await expect(service.replace(account, 'submission', file(), async tx => {
      // A deferred constraint fails at COMMIT, after the filesystem write.
      await db.query(`CREATE TEMP TABLE deferred_upload_test(id int PRIMARY KEY,
        parent int REFERENCES deferred_upload_test(id) DEFERRABLE INITIALLY DEFERRED) ON COMMIT DROP;
        INSERT INTO deferred_upload_test VALUES(1,2)`, { transaction: tx });
      return { value: 'ok' };
    })).rejects.toThrow();
    expect(await readdir(join(folder, 'public/submissions/submitted'))).toEqual([]);
    expect(await db.query('SELECT * FROM upload_storage_accounts WHERE account_id=:id',
      { replacements: { id: account }, type: QueryTypes.SELECT })).toEqual([]);
  });
  it('serializes concurrent uploads so only one can consume the remaining quota', async () => {
    const path = join(folder, 'public/submissions/submitted');
    await mkdir(path, { recursive: true });
    const legacy = join(path, `userDocs-${account}-orphan.pdf`);
    await writeFile(legacy, ''); await truncate(legacy, UPLOAD_QUOTA_BYTES - file().buffer.length);
    const service = new UploadStorageService(db as any);
    const results = await Promise.allSettled([1, 2].map(() => service.replace(account, 'submission', file(), async () => ({ value: 'ok' }))));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await readdir(path)).toHaveLength(2);
    const rows = await db.query<any>('SELECT SUM(size_bytes)::text AS bytes FROM upload_storage_files WHERE account_id=:id',
      { replacements: { id: account }, type: QueryTypes.SELECT });
    expect(Number(rows[0].bytes)).toBe(UPLOAD_QUOTA_BYTES);
  });
});
