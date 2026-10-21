import { randomUUID } from "node:crypto";
import { Sequelize } from "sequelize-typescript";
import { QueryTypes, type Transaction } from "sequelize";
import { assertClassScopeEditable, assertCurriculumEditable, assertSubjectStructureEditable, lockTrainingStructure } from "../../src/plan/training-structure-integrity.js";

const describeDb = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;

// Explicit disposable database only. Every fixture is a temporary table in a
// rolled-back transaction; no migrations or application records are required.
describeDb("Training structure PostgreSQL protections", () => {
  let db: Sequelize;
  let tx: Transaction;
  const ids = { group: randomUUID(), curriculum: randomUUID(), subject: randomUUID(), alias: randomUUID() };
  const write = (sql: string) => db.query(sql, { transaction: tx, replacements: ids });

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database.");
    db = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
  });
  afterAll(async () => { await db?.close(); });
  afterEach(async () => { await tx?.rollback(); });
  beforeEach(async () => {
    tx = await db.transaction();
    await write(`
      CREATE TEMP TABLE class_groups (id uuid, curriculum_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_group_members (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_membership_history (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_withdrawals (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE major_transfers (from_class_group_id uuid, from_curriculum_id uuid, to_curriculum_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id uuid, canonical_subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (curriculum_id uuid, subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offerings (subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (subject_id uuid, bridge_knowledge_subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE bridge_knowledge_subjects (id uuid, equivalent_subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (source_subject_id uuid, target_subject_id uuid) ON COMMIT DROP;
      INSERT INTO class_groups VALUES (:group, NULL);
      INSERT INTO subjects VALUES (:subject, NULL), (:alias, :subject);
    `);
  });

  it("permits an unused class, curriculum and catalog subject", async () => {
    await expect(assertClassScopeEditable(db, ids.group, tx)).resolves.toBeUndefined();
    await expect(assertCurriculumEditable(db, ids.curriculum, tx)).resolves.toBeUndefined();
    await expect(assertSubjectStructureEditable(db, ids.subject, tx)).resolves.toBeUndefined();
  });

  it.each([
    "class_group_members", "course_offering_class_groups", "course_exam_gradebooks", "course_offering_withdrawals",
  ])("protects class scope with records in %s even without other records", async table => {
    // table is a literal from the fixed test matrix, never request input.
    await write(`INSERT INTO pg_temp.${table} VALUES (:group)`);
    await expect(assertClassScopeEditable(db, ids.group, tx)).rejects.toMatchObject({ response: { code: "CLASS_SCOPE_IN_USE" } });
  });

  it("preserves class and curriculum scope after a transfer has removed membership", async () => {
    await write("INSERT INTO pg_temp.major_transfers VALUES (:group, :curriculum, NULL)");
    await expect(assertClassScopeEditable(db, ids.group, tx)).rejects.toMatchObject({ response: { code: "CLASS_SCOPE_IN_USE" } });
    await expect(assertCurriculumEditable(db, ids.curriculum, tx)).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
  });

  it("freezes a curriculum as soon as an empty class selects it", async () => {
    await write("UPDATE pg_temp.class_groups SET curriculum_id = :curriculum WHERE id = :group");
    await expect(assertCurriculumEditable(db, ids.curriculum, tx)).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
  });

  it("freezes both a used alias and its canonical subject", async () => {
    await write(`UPDATE pg_temp.class_groups SET curriculum_id = :curriculum WHERE id = :group;
      INSERT INTO pg_temp.curriculum_subjects VALUES (:curriculum, :alias)`);
    for (const id of [ids.subject, ids.alias]) {
      await expect(assertSubjectStructureEditable(db, id, tx)).rejects.toMatchObject({ response: { code: "SUBJECT_STRUCTURE_IN_USE" } });
    }
  });

  it.each([
    "INSERT INTO pg_temp.course_offerings VALUES (:subject)",
    "INSERT INTO pg_temp.learner_subject_results VALUES (:subject, NULL)",
    "INSERT INTO pg_temp.subject_recognitions VALUES (:subject, NULL)",
    "INSERT INTO pg_temp.subject_recognitions VALUES (NULL, :subject)",
    "INSERT INTO pg_temp.bridge_knowledge_subjects VALUES (:alias, :subject); INSERT INTO pg_temp.learner_subject_results VALUES (NULL, :alias)",
    "INSERT INTO pg_temp.major_transfers VALUES (NULL, NULL, :curriculum); INSERT INTO pg_temp.curriculum_subjects VALUES (:curriculum, :subject)",
  ])("protects a subject with historical usage: %s", async fixture => {
    await write(fixture);
    await expect(assertSubjectStructureEditable(db, ids.subject, tx)).rejects.toMatchObject({ response: { code: "SUBJECT_STRUCTURE_IN_USE" } });
  });

  it("serializes competing structure edits and assignments across connections", async () => {
    await lockTrainingStructure(db, tx);
    const other = await db.transaction();
    try {
      const [row] = await db.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(714062) AS acquired", { transaction: other, type: QueryTypes.SELECT });
      expect(row.acquired).toBe(false);
    } finally { await other.rollback(); }
  });
});
