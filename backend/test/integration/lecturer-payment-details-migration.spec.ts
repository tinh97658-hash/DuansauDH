import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { up } from '../../src/database/migrations/098-lecturer-payment-details.js';

const describeDb = process.env.RUN_LECTURER_PAYMENT_DB_TESTS === 'true' ? describe : describe.skip;
describeDb('098 payment details on existing data in disposable PostgreSQL', () => {
  let db: Sequelize;
  const schema = `payment_details_${Date.now()}`;
  beforeAll(async () => {
    if (!/\/pgsms_lecturer_payment_test_\d+$/.test(process.env.DATABASE_URL || '')) throw Error('Disposable database required.');
    db = new Sequelize(process.env.DATABASE_URL!, { logging: false, dialectOptions: { options: `-c search_path=${schema},public` } });
    await db.query(`CREATE SCHEMA ${schema};
      CREATE TABLE ${schema}.lecturer_payments(course_offering_id uuid,lecturer_id uuid,paid boolean NOT NULL,
        updated_by_staff_id uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
        PRIMARY KEY(course_offering_id,lecturer_id));
      INSERT INTO ${schema}.lecturer_payments(course_offering_id,lecturer_id,paid)
        VALUES('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',true);`);
    await up({ context: db.getQueryInterface() });
  });
  afterAll(async () => { await db?.close(); });
  it('preserves the composite primary key and paid legacy rows without fabricating a date', async () => {
    expect(await db.query('SELECT paid,payment_date,note FROM lecturer_payments', { type: QueryTypes.SELECT }))
      .toEqual([{ paid: true, payment_date: null, note: '' }]);
    const [pk]: any = await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='lecturer_payments'::regclass AND contype='p'`, { type: QueryTypes.SELECT });
    expect(pk.definition).toBe('PRIMARY KEY (course_offering_id, lecturer_id)');
  });
  it('records old/new dates and notes in the existing audit trail and retains history after unpaying', async () => {
    await db.query(`SELECT set_config('app.actor_staff_id',(SELECT id::text FROM public.staff LIMIT 1),false);
      UPDATE lecturer_payments SET payment_date='2026-11-04',note='Đã đối chiếu';
      UPDATE lecturer_payments SET paid=false,payment_date=NULL;`);
    const logs: any[] = await db.query(`SELECT old_data,new_data,actor_staff_id FROM public.db_change_logs
      WHERE table_name='lecturer_payments' AND row_pk::jsonb->>'course_offering_id'='20000000-0000-4000-8000-000000000001' ORDER BY id`, { type: QueryTypes.SELECT });
    expect(logs).toHaveLength(2);
    expect(logs[0].new_data).toMatchObject({ payment_date: '2026-11-04', note: 'Đã đối chiếu' });
    expect(logs[1].old_data.payment_date).toBe('2026-11-04');
    expect(logs[1].new_data).toMatchObject({ paid: false, payment_date: null, note: 'Đã đối chiếu' });
    expect(logs[0].actor_staff_id).toBeTruthy();
  });
  it('enforces note length and forbids effective dates on unpaid rows', async () => {
    await expect(db.query(`UPDATE lecturer_payments SET note=:note`, { replacements: { note: 'x'.repeat(2001) } })).rejects.toThrow();
    await expect(db.query(`UPDATE lecturer_payments SET payment_date='2026-11-04'`)).rejects.toThrow();
  });
});
