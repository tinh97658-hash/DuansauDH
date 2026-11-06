import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { usedCurriculumSubjectIds } from "../../src/plan/training-structure-integrity.js";

const describeDb = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;

// Every fixture is a temporary table inside a rolled-back transaction.
describeDb("Lock used curriculum subject types without freezing unrelated courses", () => {
  let db: Sequelize;
  let transaction: Transaction;
  const ids = Object.fromEntries(["curriculum", "otherCurriculum", "group", "otherGroup", "subject", "unused", "alias", "shared", "entry", "unusedEntry", "otherEntry", "offering", "record", "student"].map(key => [key, randomUUID()]));
  const write = (sql: string) => db.query(sql, { replacements: ids, transaction });
  const locked = (curriculumId = ids.curriculum) => usedCurriculumSubjectIds(db, curriculumId, transaction);
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
    await write(`CREATE TEMP TABLE class_groups (id uuid,curriculum_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_group_members (class_group_id uuid,admission_record_id uuid,student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE class_membership_history (class_group_id uuid,admission_record_id uuid,student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE admission_records (id uuid,student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id uuid,name text,credits int,program text,canonical_subject_id uuid,allow_cross_major boolean,shared_major_ids uuid[]) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (id uuid,curriculum_id uuid,subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offerings (id uuid,subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (class_group_id uuid,course_offering_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (class_group_id uuid,course_offering_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_withdrawals (class_group_id uuid,course_offering_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (subject_id uuid,admission_record_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (target_subject_id uuid,admission_record_id uuid,status text,source_subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_transcript_issues (class_group_id uuid,snapshot jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE major_transfers (from_curriculum_id uuid,to_curriculum_id uuid,status text,admission_record_id uuid) ON COMMIT DROP;
      INSERT INTO class_groups VALUES (:group,:curriculum),(:otherGroup,:otherCurriculum);
      INSERT INTO admission_records VALUES (:record,:student);
      INSERT INTO class_group_members VALUES (:group,:record,NULL);
      INSERT INTO subjects VALUES (:subject,'Shared course',3,'masters',NULL,false,'{}'),
        (:unused,'Unused course',2,'masters',NULL,false,'{}'),
        (:alias,'Alias',3,'masters',:subject,false,'{}'),
        (:shared,'Shared course',3,'masters',NULL,true,'{}');
      INSERT INTO curriculum_subjects VALUES (:entry,:curriculum,:subject),(:unusedEntry,:curriculum,:unused),(:otherEntry,:otherCurriculum,:subject);`);
  });

  it("does not lock subjects merely because a class and learners are assigned", async () => {
    expect(await locked()).toEqual(new Set());
  });

  it.each(["subject", "alias", "shared"])("locks only the opened course, matching the %s identity", async source => {
    await db.query(`INSERT INTO course_offerings VALUES (:offering,:source);
      INSERT INTO course_offering_class_groups VALUES (:group,:offering)`, { transaction, replacements: { ...ids, source: ids[source] } });
    expect(await locked()).toEqual(new Set([ids.entry]));
    expect(await locked(ids.otherCurriculum)).toEqual(new Set());
  });

  it.each(["course_exam_gradebooks", "course_offering_withdrawals"])("preserves history in %s even without the offering link", async table => {
    await write(`INSERT INTO course_offerings VALUES (:offering,:alias);
      INSERT INTO pg_temp.${table} VALUES (:group,:offering)`);
    expect(await locked()).toEqual(new Set([ids.entry]));
  });

  it.each(["current", "student", "historical"])("locks learner results through %s membership", async mode => {
    if (mode === "student") await write("UPDATE pg_temp.class_group_members SET admission_record_id=NULL,student_id=:student");
    if (mode === "historical") await write(`DELETE FROM pg_temp.class_group_members;
      INSERT INTO class_membership_history VALUES (:group,:record,NULL)`);
    await write("INSERT INTO learner_subject_results VALUES (:alias,:record)");
    expect(await locked()).toEqual(new Set([ids.entry]));
  });

  it("locks approved recognition but not an unapproved proposal", async () => {
    await write("INSERT INTO subject_recognitions VALUES (:alias,:record,'pending')");
    expect(await locked()).toEqual(new Set());
    await write("UPDATE pg_temp.subject_recognitions SET status='approved'");
    expect(await locked()).toEqual(new Set([ids.entry]));
  });

  it("preserves all types when a transcript snapshot references the curriculum", async () => {
    await write("INSERT INTO learner_transcript_issues VALUES (:otherGroup,jsonb_build_object('curriculum',jsonb_build_object('id',CAST(:curriculum AS text))))");
    expect(await locked()).toEqual(new Set([ids.entry, ids.unusedEntry]));
  });

  it("does not lock every course just because an approved transfer exists", async () => {
    await write(`UPDATE pg_temp.class_groups SET curriculum_id=NULL;
      INSERT INTO major_transfers VALUES (:curriculum,NULL,'approved',:record)`);
    expect(await locked()).toEqual(new Set());
  });

  it("locks only the transferred learner's relevant results after membership is removed", async () => {
    await write(`DELETE FROM pg_temp.class_group_members;
      INSERT INTO major_transfers VALUES (:curriculum,NULL,'approved',:record);
      INSERT INTO learner_subject_results VALUES (:alias,:record)`);
    expect(await locked()).toEqual(new Set([ids.entry]));
  });

  it("protects both sides of a recognized course, without freezing the rest of the curriculum", async () => {
    await write(`DELETE FROM pg_temp.class_group_members;
      INSERT INTO major_transfers VALUES (:curriculum,:otherCurriculum,'approved',:record);
      INSERT INTO subject_recognitions VALUES (:shared,:record,'approved',:subject)`);
    expect(await locked()).toEqual(new Set([ids.entry]));
  });
});
