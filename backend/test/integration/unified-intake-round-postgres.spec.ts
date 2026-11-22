import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { up, down } from '../../src/database/migrations/103-unified-intake-round.js';
import { up as up105 } from '../../src/database/migrations/105-shared-intake-round-subrounds.js';

const describeDb = process.env.RUN_UNIFIED_INTAKE_POSTGRES_TESTS === 'true' ? describe : describe.skip;
describeDb('Unified intake round migration on an isolated PostgreSQL database', () => {
  let db: Sequelize;
  beforeAll(async () => {
    if (!/\/pgsms_ci_test_\d+$/.test(process.env.DATABASE_URL || '')) throw new Error('Requires an isolated CI database');
    db = new Sequelize(process.env.DATABASE_URL!, { logging: false });
  });
  afterAll(async () => { await db?.close(); });
  it('backfills explicit round names and evaluations without guessing ambiguous names', async () => {
    const qi = db.getQueryInterface();
    const numbered = randomUUID(), unknown = randomUUID(), record = randomUUID();
    await down({ context: qi });
    await db.query(`INSERT INTO admission_rounds(id,name,academic_year,regulation_no,rules,created_at,updated_at)
      VALUES(:numbered,'Đợt 2 - Tuyển sinh','2099','Test','{}',now(),now()),
      (:unknown,'Tuyển sinh bổ sung','2099','Test','{}',now(),now());
      INSERT INTO admission_records(id,full_name,training_level,academic_year,created_at,updated_at)
      VALUES(:record,'Round migration test','Thạc sĩ','2099',now(),now());
      INSERT INTO admission_evaluations(id,admission_record_id,round_id,inputs,record_snapshot,created_at,updated_at)
      VALUES(:evaluation,:record,:numbered,'{}','{}',now(),now());`,
    { replacements: { numbered, unknown, record, evaluation: randomUUID() } });
    await up({ context: qi });
    const rounds: any[] = await db.query('SELECT id,intake_round FROM admission_rounds WHERE academic_year=\'2099\'', { type: QueryTypes.SELECT });
    expect(rounds.find(row => row.id === numbered).intake_round).toBe(2);
    expect(rounds.find(row => row.id === unknown).intake_round).toBeNull();
    const [candidate]: any[] = await db.query('SELECT intake_round FROM admission_records WHERE id=:record', { replacements: { record }, type: QueryTypes.SELECT });
    expect(candidate.intake_round).toBe(2);
    await expect(db.query('UPDATE admission_rounds SET intake_round=3 WHERE id=:numbered', { replacements: { numbered } })).rejects.toThrow();
    await expect(db.query('UPDATE admission_rounds SET intake_round=2 WHERE id=:unknown', { replacements: { unknown } })).rejects.toThrow();
    await expect(db.query('UPDATE admission_records SET intake_round=0 WHERE id=:record', { replacements: { record } })).rejects.toThrow();
    const legacy = randomUUID();
    await db.query(`INSERT INTO admission_records(id,full_name,training_level,academic_year,created_at,updated_at)
      VALUES(:legacy,'Legacy round test','Thạc sĩ','2099',now(),now());
      INSERT INTO admission_evaluations(id,admission_record_id,round_id,inputs,record_snapshot,created_at,updated_at)
      VALUES(:evaluation,:legacy,:unknown,'{}','{}',now(),now());
      UPDATE admission_rounds SET intake_round=3 WHERE id=:unknown;`,
    { replacements: { legacy, unknown, evaluation: randomUUID() } });
    const [mapped]: any[] = await db.query('SELECT intake_round FROM admission_records WHERE id=:legacy', { replacements: { legacy }, type: QueryTypes.SELECT });
    expect(mapped.intake_round).toBe(3);
  });

  it('allows multiple admission rounds in the same year and intake_round while keeping names unique and protecting active scopes', async () => {
    const qi = db.getQueryInterface();
    await up105({ context: qi });
    const roundA = randomUUID(), roundB = randomUUID(), dupName = randomUUID(), recId = randomUUID();
    await db.query(`INSERT INTO admission_rounds(id,name,academic_year,intake_round,regulation_no,rules,created_at,updated_at)
      VALUES(:roundA,'Đợt 1 - Chính thức','2098',1,'Test','{}',now(),now()),
      (:roundB,'Đợt 1 - Bổ sung','2098',1,'Test','{}',now(),now());
      INSERT INTO admission_records(id,full_name,training_level,academic_year,intake_round,created_at,updated_at)
      VALUES(:recId,'Shared round student','Thạc sĩ','2098',1,now(),now());`,
    { replacements: { roundA, roundB, recId } });

    await expect(db.query(`INSERT INTO admission_rounds(id,name,academic_year,intake_round,regulation_no,rules,created_at,updated_at)
      VALUES(:dupName,'  đợt 1 - bổ sung ','2098',1,'Test','{}',now(),now())`, { replacements: { dupName } })).rejects.toThrow();

    // Unused supplementary round can still fix its intake_round while roundA covers (2098, 1).
    await db.query('UPDATE admission_rounds SET intake_round=2 WHERE id=:roundB', { replacements: { roundB } });
    // Now roundA is the only round backing (2098, 1) which already has admission_records, so changing roundA must fail.
    await expect(db.query('UPDATE admission_rounds SET intake_round=2 WHERE id=:roundA', { replacements: { roundA } })).rejects.toThrow();
  });
});
