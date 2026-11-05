import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { LecturerPaymentService } from '../../src/reports/lecturer-payment.service.js';

const describeDb = process.env.RUN_LECTURER_PAYMENT_DB_TESTS === 'true' ? describe : describe.skip;
describeDb('Payment batch atomicity, conflicts and RLS on disposable PostgreSQL', () => {
  let db: Sequelize, service: LecturerPaymentService;
  const schema = `payment_batch_${Date.now()}`;
  const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actor = id(99);
  const config = { get: () => 'batch-test-only-secret-never-production' };
  beforeAll(async () => {
    if (!/\/pgsms_lecturer_payment_test_\d+$/.test(process.env.DATABASE_URL || '')) throw Error('Disposable test database required.');
    db = new Sequelize(process.env.DATABASE_URL!, { logging: false, dialectOptions: { options: `-c search_path=${schema},public` }, pool: { max: 4 } });
    await db.query(`CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.subjects(id uuid PRIMARY KEY,name text);
      CREATE TABLE ${schema}.units(id uuid PRIMARY KEY,name text);
      CREATE TABLE ${schema}.lecturers(id uuid PRIMARY KEY,name text,unit_id uuid,academic_rank text,academic_degree text);
      CREATE TABLE ${schema}.course_offerings(id uuid PRIMARY KEY,subject_id uuid,name text,status text,completed_at timestamptz);
      CREATE TABLE ${schema}.teaching_sessions(id uuid PRIMARY KEY,course_offering_id uuid,lecturer_id uuid,status text,confirmed_at timestamptz,created_at timestamptz,session_date date,end_time time);
      CREATE TABLE ${schema}.lecturer_payments(course_offering_id uuid,lecturer_id uuid,paid boolean NOT NULL,updated_by_staff_id uuid,created_at timestamptz,updated_at timestamptz NOT NULL,PRIMARY KEY(course_offering_id,lecturer_id));
      GRANT USAGE ON SCHEMA ${schema} TO pgsms_group_scoped;
      GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO pgsms_group_scoped;
      GRANT INSERT,UPDATE ON ${schema}.lecturer_payments TO pgsms_group_scoped;
      ALTER TABLE ${schema}.lecturer_payments ENABLE ROW LEVEL SECURITY;
      CREATE POLICY read_payments ON ${schema}.lecturer_payments FOR SELECT TO pgsms_group_scoped USING(true);
      CREATE POLICY insert_payments ON ${schema}.lecturer_payments FOR INSERT TO pgsms_group_scoped
        WITH CHECK(current_setting('payment.test.actor',true)='admin' OR lecturer_id<>'${id(2)}');
      CREATE POLICY update_payments ON ${schema}.lecturer_payments FOR UPDATE TO pgsms_group_scoped USING(true)
        WITH CHECK(current_setting('payment.test.actor',true)='admin' OR lecturer_id<>'${id(2)}');`);
    service = new LecturerPaymentService(db, config as any);
  });
  beforeEach(async () => {
    await db.query(`TRUNCATE ${schema}.lecturer_payments,${schema}.teaching_sessions,${schema}.course_offerings,${schema}.lecturers,${schema}.subjects,${schema}.units;
      INSERT INTO subjects VALUES('${id(10)}','Subject');
      INSERT INTO units VALUES('${id(20)}','Unit A'),('${id(21)}','Unit B');
      INSERT INTO lecturers(id,name,unit_id) VALUES('${id(1)}','Teacher A','${id(20)}'),('${id(2)}','Teacher B','${id(20)}'),('${id(3)}','Outside filter','${id(21)}');
      INSERT INTO course_offerings VALUES('${id(30)}','${id(10)}','Completed class','completed','2026-11-02T18:00Z'),('${id(31)}','${id(10)}','Active class','active',NULL);
      INSERT INTO teaching_sessions VALUES
        ('${id(40)}','${id(30)}','${id(1)}','held','2026-11-02T10:00Z','2026-10-01','2026-11-02','12:00'),
        ('${id(41)}','${id(30)}','${id(2)}','held','2026-11-02T10:00Z','2026-10-01','2026-11-02','12:00'),
        ('${id(42)}','${id(30)}','${id(3)}','held','2026-11-02T10:00Z','2026-10-01','2026-11-02','12:00');`);
  });
  it('returns academic rank and degree for payment rows and lecturer options',async()=>{
    await db.query(`UPDATE lecturers SET academic_rank='PGS',academic_degree='TS' WHERE id='${id(1)}'`);
    const listed=await service.list();
    expect(listed.rows.find((row:any)=>row.lecturerId===id(1))).toMatchObject({academicRank:'PGS',academicDegree:'TS'});
    const options=await service.options();
    expect(options.lecturers.find((row:any)=>row.id===id(1))).toMatchObject({academicRank:'PGS',academicDegree:'TS'});
  });
  afterAll(async () => { await db?.close(); }); // The runner drops this entire disposable database.

  it('freezes all filtered targets and leaves paid/out-of-filter pairs untouched', async () => {
    await service.update(id(30), id(1), true, actor);
    const before = (await service.list()).rows.find(row => row.lecturerId === id(1))!;
    const preview = await service.previewBatch({ unitId: id(20), paymentStatus: 'all', search: 'Completed', from: '2026-11-03', to: '2026-11-03' }, true, actor);
    expect(preview).toMatchObject({ count: 1, total: 2, unchanged: 1 });
    const result = await service.applyBatch(preview.token, actor);
    expect(result.updated).toBe(1);
    const rows = (await service.list()).rows;
    expect(rows.find(row => row.lecturerId === id(1))!.paymentVersion).toBe(before.paymentVersion);
    expect(rows.find(row => row.lecturerId === id(2))!.paid).toBe(true);
    expect(rows.find(row => row.lecturerId === id(3))!.paid).toBe(false);
    const clear = await service.previewBatch({ unitId: id(20), paymentStatus: 'paid' }, false, actor);
    expect((await service.applyBatch(clear.token, actor)).updated).toBe(2);
    expect((await service.list()).rows.every(row => !row.paid)).toBe(true);
  });

  it('does not silently add newly eligible pairs after confirmation preview', async () => {
    const preview = await service.previewBatch({ unitId: id(20) }, true, actor);
    await db.query(`UPDATE lecturers SET unit_id='${id(20)}' WHERE id='${id(3)}'`);
    expect((await service.applyBatch(preview.token, actor)).updated).toBe(2);
    expect((await service.list()).rows.find(row => row.lecturerId === id(3))!.paid).toBe(false);
  });

  it('rejects stale state, including ABA changes, and leaves other targets unchanged', async () => {
    await service.update(id(30), id(1), false, actor);
    const preview = await service.previewBatch({ unitId: id(20) }, true, actor);
    await service.update(id(30), id(1), true, actor);
    await service.update(id(30), id(1), false, actor);
    await expect(service.applyBatch(preview.token, actor)).rejects.toMatchObject({ status: 409 });
    expect((await service.list()).rows.every(row => !row.paid)).toBe(true);
  });

  it('serializes concurrent application of one preview: one commits and one reports conflict', async () => {
    const preview = await service.previewBatch({ unitId: id(20) }, true, actor);
    const outcomes = await Promise.allSettled([service.applyBatch(preview.token, actor), service.applyBatch(preview.token, actor)]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await service.list({ paymentStatus: 'paid' })).rows).toHaveLength(2);
  });

  it('rejects changed eligibility, other actors, expired and tampered snapshots', async () => {
    const preview = await service.previewBatch({ unitId: id(20) }, true, actor);
    await expect(service.applyBatch(preview.token, id(98))).rejects.toMatchObject({ status: 409 });
    await expect(service.applyBatch(preview.token + 'x', actor)).rejects.toMatchObject({ status: 400 });
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    await expect(service.applyBatch(preview.token, actor)).rejects.toMatchObject({ status: 409 }); clock.mockRestore();
    await db.query(`UPDATE course_offerings SET status='active' WHERE id='${id(30)}'`);
    await expect(service.applyBatch(preview.token, actor)).rejects.toMatchObject({ status: 409 });
    expect((await db.query('SELECT * FROM lecturer_payments', { type: QueryTypes.SELECT }))).toHaveLength(0);
  });

  it('honors PostgreSQL RLS and rolls back earlier writes when a later target is denied', async () => {
    const scoped = new LecturerPaymentService({
      query: (sql: string, options: any = {}) => options.transaction ? db.query(sql, options) : db.transaction(async transaction => {
        await db.query("SET LOCAL ROLE pgsms_group_scoped; SELECT set_config('payment.test.actor','limited',true)", { transaction });
        return db.query(sql, { ...options, transaction });
      }),
      transaction: (work: any) => db.transaction(async transaction => {
        await db.query("SET LOCAL ROLE pgsms_group_scoped; SELECT set_config('payment.test.actor','limited',true)", { transaction });
        return work(transaction);
      }),
    } as any, config as any);
    const preview = await scoped.previewBatch({ unitId: id(20) }, true, actor);
    expect(preview.count).toBe(2);
    await expect(scoped.applyBatch(preview.token, actor)).rejects.toThrow();
    expect((await db.query('SELECT * FROM lecturer_payments', { type: QueryTypes.SELECT }))).toHaveLength(0);
  });
});
