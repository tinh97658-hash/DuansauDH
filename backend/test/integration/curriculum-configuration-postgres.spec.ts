import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { assertCurriculumEditable, assertCurriculumSubjectsEditable, curriculumSubjectsInUse } from "../../src/plan/training-structure-integrity.js";

const describeDb = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;

// Fixtures only use connection-local temporary tables and are rolled back.
describeDb("Curriculum configuration before and after teaching begins", () => {
  let db: Sequelize;
  let transaction: Transaction;
  const ids = { curriculum: randomUUID(), group: randomUUID(), otherGroup: randomUUID(), record: randomUUID(), student: randomUUID(), subject: randomUUID() };
  const write = (sql: string) => db.query(sql, { replacements: ids, transaction });

  beforeAll(async () => {
    const vars = process.env.TEST_DATABASE_URL ? {} : Object.fromEntries(readFileSync(resolve(__dirname, "../../../.env"), "utf8")
      .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }));
    db = process.env.TEST_DATABASE_URL ? new Sequelize(process.env.TEST_DATABASE_URL, { logging: false })
      : new Sequelize({ dialect: "postgres", host: "127.0.0.1", port: Number(vars.DB_PORT), username: vars.POSTGRES_USER, password: vars.POSTGRES_PASSWORD, database: vars.POSTGRES_DB, logging: false });
  });
  afterAll(async () => { await db?.close(); });
  afterEach(async () => { await transaction?.rollback(); });
  beforeEach(async () => {
    transaction = await db.transaction();
    await write(`
      CREATE TEMP TABLE class_groups (id uuid, curriculum_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_group_members (class_group_id uuid, admission_record_id uuid, student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_membership_history (class_group_id uuid, admission_record_id uuid, student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE admission_records (id uuid, student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_withdrawals (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_transcript_issues (class_group_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (curriculum_id uuid, subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (subject_id uuid, admission_record_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (target_subject_id uuid, admission_record_id uuid, status text) ON COMMIT DROP;
      CREATE TEMP TABLE major_transfers (from_curriculum_id uuid, to_curriculum_id uuid) ON COMMIT DROP;
      INSERT INTO class_groups VALUES (:group, :curriculum), (:otherGroup, NULL);
      INSERT INTO admission_records VALUES (:record, :student);
      INSERT INTO curriculum_subjects VALUES (:curriculum, :subject);
    `);
  });

  it("permits configuration after assignment and enrollment while preserving the curriculum identity", async () => {
    await write(`INSERT INTO class_group_members VALUES (:group, :record, :student);
      INSERT INTO class_membership_history VALUES (:group, :record, :student)`);
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(false);
    await expect(assertCurriculumSubjectsEditable(db, ids.curriculum, transaction)).resolves.toBeUndefined();
    await expect(assertCurriculumEditable(db, ids.curriculum, transaction)).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
  });

  it.each(["course_offering_class_groups", "course_exam_gradebooks", "course_offering_withdrawals", "learner_transcript_issues"])("locks configuration with teaching/history in %s", async table => {
    await write(`INSERT INTO pg_temp.${table} VALUES (:group)`);
    await expect(assertCurriculumSubjectsEditable(db, ids.curriculum, transaction)).rejects.toMatchObject({ response: { code: "CURRICULUM_IN_USE" } });
  });

  it.each([
    "INSERT INTO class_group_members VALUES (:group, :record, NULL)",
    "INSERT INTO class_group_members VALUES (:group, NULL, :student)",
    "INSERT INTO class_membership_history VALUES (:group, :record, NULL)",
  ])("protects learner results through current or historical membership: %s", async fixture => {
    await write(`${fixture}; INSERT INTO learner_subject_results VALUES (:subject, :record)`);
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(true);
  });

  it("locks approved recognition but permits a proposal without academic effect", async () => {
    await write(`INSERT INTO class_group_members VALUES (:group, :record, NULL);
      INSERT INTO subject_recognitions VALUES (:subject, :record, 'pending')`);
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(false);
    await write("UPDATE pg_temp.subject_recognitions SET status='approved'");
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(true);
  });

  it("ignores training in another class and results for subjects outside this curriculum", async () => {
    await write(`INSERT INTO course_offering_class_groups VALUES (:otherGroup);
      INSERT INTO class_group_members VALUES (:group, :record, NULL);
      INSERT INTO learner_subject_results VALUES (:student, :record)`);
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(false);
  });

  it("preserves a curriculum referenced by transfer history even without a currently linked class", async () => {
    await write(`UPDATE pg_temp.class_groups SET curriculum_id=NULL;
      INSERT INTO major_transfers VALUES (NULL, :curriculum)`);
    await expect(curriculumSubjectsInUse(db, ids.curriculum, transaction)).resolves.toBe(true);
  });
});
