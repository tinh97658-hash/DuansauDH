import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { up, down } from '../../src/database/migrations/081-unique-learner-codes.js';

const describeDb = process.env.RUN_POSTGRES_LEARNER_CODE_TESTS === 'true' ? describe : describe.skip;
describeDb('Permanent learner codes on PostgreSQL', () => {
  const schema = 'learner_code_test_' + randomUUID().replace(/-/g, '');
  let admin: Sequelize;
  let db: Sequelize;
  const query = (sql: string, replacements: any = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT }) as Promise<any[]>;
  const insert = (code: string | null, status = 'Đang học') => query(`INSERT INTO admission_records(code, full_name, academic_year, study_status)
    VALUES (:code, 'Test learner', '2026', :status) RETURNING id,code`, { code, status });

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL for isolated PostgreSQL tests.');
    admin = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false, dialectOptions: { options: `-c search_path=${schema}` } });
    await query(`CREATE TABLE admission_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50), full_name text,
      academic_year text, study_status text);
      CREATE TABLE db_change_logs(table_name text, old_data jsonb, new_data jsonb, changed_at timestamptz DEFAULT now());`);
    await insert('HV26001');
    await insert(null);
    await query(`INSERT INTO db_change_logs(table_name,old_data) VALUES ('admission_records', CAST(:snapshot AS jsonb))`, {
      snapshot: JSON.stringify({ id: randomUUID(), code: 'HISTORICAL-DELETED' }),
    });
    await up({ context: db.getQueryInterface() });
  });
  afterAll(async () => {
    if (db) await db.close();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.close(); }
  });

  it.each(['Đã trúng tuyển', 'Đang học', 'Thôi học', 'Đang bảo lưu', 'Bảo lưu quá hạn'])(
    'blocks existing codes in every profile status: %s', async status => {
      await expect(insert(' hv26001 ', status)).rejects.toMatchObject({ original: { code: '23505', constraint: 'admission_records_code_reserved' } });
    });

  it('blocks changing a profile to another profile code but allows keeping its own code', async () => {
    const [record] = await insert('EDIT-OWNER');
    await expect(query(`UPDATE admission_records SET code='HV26001' WHERE id=:id`, record)).rejects.toMatchObject({ original: { code: '23505' } });
    await query(`UPDATE admission_records SET code=' edit-owner ' WHERE id=:id`, record);
    const [updated] = await query('SELECT code FROM admission_records WHERE id=:id', record);
    expect(updated.code).toBe('EDIT-OWNER');
    await expect(query('UPDATE admission_records SET code=NULL WHERE id=:id', record)).rejects.toMatchObject({ original: { code: '23514' } });
  });

  it('does not free codes after renaming or deleting profiles, including audited historical codes', async () => {
    const [record] = await insert('PERMANENT-OLD');
    await query(`UPDATE admission_records SET code='PERMANENT-NEW' WHERE id=:id`, record);
    await expect(insert('PERMANENT-OLD')).rejects.toMatchObject({ original: { code: '23505' } });
    await query('DELETE FROM admission_records WHERE id=:id', record);
    await expect(insert('PERMANENT-NEW')).rejects.toMatchObject({ original: { code: '23505' } });
    await expect(insert('HISTORICAL-DELETED')).rejects.toMatchObject({ original: { code: '23505' } });
  });

  it('allows only one of two simultaneous inserts with the same code', async () => {
    const results = await Promise.allSettled([insert('RACE-CODE'), insert('race-code')]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('automatically fills missing codes and never truncates the sequence after 999', async () => {
    expect((await query('SELECT COUNT(*)::int AS count FROM admission_records WHERE code IS NULL'))[0].count).toBe(0);
    await query(`SELECT setval('learner_code_sequence',999,false)`);
    const [first] = await insert('');
    const [second] = await insert(null);
    expect(first.code).toBe('HV26999');
    expect(second.code).toBe('HV261000');
    await expect(insert(second.code)).rejects.toMatchObject({ original: { code: '23505' } });
  });

  it('rolls reservations back with failed transactions', async () => {
    const tx = await db.transaction();
    await db.query(`INSERT INTO admission_records(code,full_name) VALUES ('ROLLED-BACK','Test')`, { transaction: tx });
    await tx.rollback();
    await expect(insert('ROLLED-BACK')).resolves.toHaveLength(1);
  });

  it('reserves codes when a restricted application role writes a profile', async () => {
    const roles = await query("SELECT 1 FROM pg_roles WHERE rolname='pgsms_group_scoped'");
    if (!roles.length) return;
    await query(`GRANT USAGE ON SCHEMA ${schema} TO pgsms_group_scoped;
      GRANT SELECT,INSERT ON admission_records TO pgsms_group_scoped;`);
    const tx = await db.transaction();
    try {
      await db.query('SET LOCAL ROLE pgsms_group_scoped', { transaction: tx });
      const [rows] = await db.query(`INSERT INTO admission_records(full_name,academic_year) VALUES ('Scoped test','2026') RETURNING code`, { transaction: tx });
      expect((rows as any[])[0].code).toMatch(/^HV26[0-9]+$/);
    } finally { await tx.rollback(); }
  });

  it('supports removing the migration in an isolated schema', async () => {
    await down({ context: db.getQueryInterface() });
    await expect(insert('HV26001')).resolves.toHaveLength(1);
  });
});
