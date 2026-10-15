import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { jest } from "@jest/globals";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";
import { excludeRecognizedExamParticipant } from "../../src/masters/recognized-exam-participant.js";
import { learnerStudyStatusSql } from "../../src/plan/learner-study-status.js";

const describePostgres = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;

// All fixtures live in connection-local temporary tables inside a rolled-back
// transaction. No migrations or application records are created or changed.
describePostgres("Class reports PostgreSQL queries", () => {
  let db: Sequelize;
  let transaction: Transaction;
  let service: ClassScoreSummaryService;
  beforeAll(async () => {
    const vars = Object.fromEntries(readFileSync(resolve(__dirname, "../../../.env"), "utf8")
      .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }));
    db = new Sequelize({ dialect: "postgres", host: "127.0.0.1", port: Number(vars.DB_PORT),
      username: vars.POSTGRES_USER, password: vars.POSTGRES_PASSWORD, database: vars.POSTGRES_DB, logging: false });
    transaction = await db.transaction();
    const query = (sql: string) => db.query(sql, { transaction });
    await query(`
      CREATE TEMP TABLE class_group_members (id int, class_group_id text, admission_record_id text, student_id text) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_withdrawals (id text, admission_record_id text, course_offering_id text, participant_id text,
        class_group_id text, created_at timestamp, snapshot jsonb) ON COMMIT DROP;
      CREATE TYPE pg_temp.test_group_program AS ENUM ('masters', 'doctoral');
      CREATE TEMP TABLE class_groups (id text, code text, name text, program pg_temp.test_group_program, academic_year text, curriculum_id text) ON COMMIT DROP;
      CREATE TEMP TABLE students (id text, reg_no text, full_name text) ON COMMIT DROP;
      CREATE TEMP TABLE majors (id text, name text) ON COMMIT DROP;
      CREATE TEMP TABLE admission_records (id text, student_id text, code text, full_name text, last_name text, first_name text,
        dob text, gender text, academic_year text, created_at timestamp, pob text, admission_date text, training_level text,
        training_mode_name text, training_mode_group text, language text, major_id text, major_name text, diploma_number text,
        study_status text DEFAULT 'Đã trúng tuyển', is_exempt_foreign_language boolean DEFAULT false) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id text, code text, name text, sort_order int, canonical_subject_id text,
        code_text text, credits int DEFAULT 5, is_required boolean DEFAULT true, subject_type text,
        program text DEFAULT 'masters', allow_cross_major boolean DEFAULT false, shared_major_ids text[] DEFAULT '{}') ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_blocks (id text, name text, sort_order int, curriculum_id text, code text) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (curriculum_id text, subject_id text, block_id text, credits int, is_required boolean, sort_order int) ON COMMIT DROP;
      CREATE TEMP TABLE course_offerings (id text, subject_id text) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (course_offering_id text, class_group_id text) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (id text, class_group_id text, course_offering_id text, updated_at timestamp, grades jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE shared_grading_rules (version int, policy jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (id text, admission_record_id text, subject_id text, score numeric, result text, status text, updated_at timestamp, source_type text DEFAULT 'pre_masters') ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (id text, admission_record_id text, target_subject_id text, learning_result_id text, status text, updated_at timestamp) ON COMMIT DROP;
      INSERT INTO class_groups VALUES ('g1','CLASS1','Class 1','masters','2026','c1');
      INSERT INTO majors VALUES ('m1','Current major');
      INSERT INTO admission_records (id,code,full_name,last_name,first_name,academic_year,created_at,major_id,pob,dob,
        admission_date,training_level,training_mode_name,training_mode_group,language,diploma_number)
        SELECT 'ar'||n, 'HV'||lpad(n::text,3,'0'), 'Learner '||lpad(n::text,3,'0'), 'Learner', lpad(n::text,3,'0'),
          '2026', '2026-01-01'::timestamp,'m1','Birthplace','1990-01-02','2026-09-01','Masters','Research','Full time','Vietnamese','UNDERGRAD-123'
        FROM generate_series(1,39) n;
      INSERT INTO students VALUES ('s1','REG1','Student only');
      INSERT INTO class_group_members SELECT n,'g1','ar'||n,NULL FROM generate_series(1,39) n;
      INSERT INTO class_group_members VALUES (40,'g1',NULL,'s1'),(41,'g1','ar1',NULL),(42,'other','ar2',NULL);
      INSERT INTO subjects (id,code,name,sort_order,canonical_subject_id) VALUES ('hp1','HP01','Zero',1,NULL),('hp2','HP02','Exempt',2,NULL),
        ('hp3','HP03','Ungraded',3,NULL),('hp4','HP04','Latest result',4,NULL),('alias','OTHER','Alias',5,'hp4'),
        ('external','EXT','External',6,NULL),('hp5','HP05','Recognition',7,NULL);
      INSERT INTO curriculum_blocks (id,name,sort_order) VALUES ('b1','Block',0);
      INSERT INTO curriculum_subjects SELECT 'c1',id,'b1',5,true,sort_order FROM subjects WHERE id LIKE 'hp%';
      INSERT INTO course_offerings VALUES ('o1','hp1'),('o2','hp2'),('o3','hp3'),('o4','alias');
      INSERT INTO course_offering_class_groups SELECT id,'g1' FROM course_offerings;
      INSERT INTO course_exam_gradebooks VALUES
        ('book1','g1','o1','2026-01-01','[{"participantId":"admission:ar1","courseScore":0,"result":"failed"}]'),
        ('book2','g1','o2','2026-01-01','[{"participantId":"admission:ar1","examExempt":true,"result":"pending"}]'),
        ('book3','g1','o3','2026-01-01','[{"participantId":"admission:ar1","examScore":9,"result":"pending"}]'),
        ('book4','g1','o4','2026-01-01','[{"participantId":"admission:ar1","courseScore":9,"result":"passed"}]');
      INSERT INTO learner_subject_results (id,admission_record_id,subject_id,score,result,status,updated_at) VALUES ('r1','ar1','hp4',6,'passed','completed','2026-02-01'),
        ('r2','ar1','external',7,'passed','completed','2026-02-01');
      INSERT INTO subject_recognitions VALUES ('rec1','ar1','hp5','r2','approved','2026-03-01');
    `);
    const groups = { findByPk: jest.fn<any>().mockResolvedValue({ id: "g1", academicYear: "2026", code: "CLASS1", curriculumId: "c1", curriculum: { id: "c1" } }) };
    service = new ClassScoreSummaryService(groups as never,
      { query: (sql: string, options: object) => db.query(sql, { ...options, transaction }) } as never);
  });
  afterAll(async () => {
    try { await transaction?.rollback(); } finally { await db?.close(); }
  });

  it("returns all 40 unique participants with a small payload and keeps student-only memberships", async () => {
    const result = await service.roster("g1");
    expect(result.students).toHaveLength(40);
    expect(new Set(result.students.map(row => row.participantId)).size).toBe(40);
    expect(result.students.filter(row => row.admissionRecordId === "ar1")).toHaveLength(1);
    expect(result.students.find(row => row.studentId === "s1")).toMatchObject({ admissionRecordId: null, canPreview: false });
    expect(Object.keys(result).sort()).toEqual(["classGroup", "students"]);
    for (const row of result.students) expect(Object.keys(row).sort()).toEqual([
      "admissionRecordId", "canPreview", "code", "firstName", "fullName", "lastName", "participantId", "studentId",
    ]);
  });

  it("paginates and searches the same roster without exporting the matrix", async () => {
    const result = await service.get({ classGroupId: "g1", page: 2, pageSize: 15 });
    expect(result).toMatchObject({ total: 40, page: 2, pageSize: 15 });
    expect(result.rows).toHaveLength(15);
    expect(result.rows[0].code).toBe("HV016");
    const filtered = await service.get({ classGroupId: "g1", search: "hv039", page: 1, pageSize: 15 });
    expect(filtered).toMatchObject({ total: 1, rows: [{ code: "HV039" }] });
  });

  it("maps real metadata and keeps undergraduate diploma and ambiguous duration out of the preview fields", async () => {
    const result = await service.learnerScorecard("ar1", "g1");
    expect(result.student).toMatchObject({ fullName: "Learner 001", dob: "1990-01-02", pob: "Birthplace",
      academicYear: "2026", admissionDate: "2026-09-01", trainingLevel: "Masters", trainingModeName: "Research",
      trainingModeGroup: "Full time", language: "Vietnamese", major: { id: "m1", name: "Current major" },
      durationYears: null, masterDiplomaNumber: null });
    expect(result.student).not.toHaveProperty("diplomaNumber");
  });

  it("retains authoritative saved exam results, including zero, pending totals and canonical aliases", async () => {
    const report = await service.get({ classGroupId: "g1", search: "HV001" });
    const scorecard = await service.learnerScorecard("ar1", "g1");
    expect(report.rows[0].scores).toEqual({ hp1: { score: 0, result: "failed" }, hp2: { score: null, result: "exempt" },
      hp3: { score: null, result: "pending" }, hp4: { score: 9, result: "passed" }, hp5: { score: 7, result: "passed" } });
    expect(scorecard.subjects).toHaveLength(5);
    for (const subject of scorecard.subjects) {
      expect(subject.code).toBe(`HP0${subject.id.slice(-1)}`);
      expect(subject.credits).toBe(5);
      expect(subject.grade?.score ?? null).toBe(report.rows[0].scores[subject.id]?.score ?? null);
    }
    expect(scorecard.subjects.find(row => row.id === "hp3")?.grade).toMatchObject({ score: null, details: { examScore: 9 } });
    expect(scorecard.subjects.find(row => row.id === "hp5")?.grade).toEqual({ score: 7, result: "passed",
      details: { source: "recognition", recognitionId: "rec1", courseScore: 7, grade4: 3, letterGrade: "B", result: "passed" } });
  });
  it("shows zero and F for old ineligible rows in both class summaries and learner scorecards", async () => {
    await db.query(`UPDATE course_exam_gradebooks SET grades = grades ||
      '[{"participantId":"admission:ar2","testScore":6,"assignmentScore":3,"examScore":null,"courseScore":null,"result":"pending"}]'::jsonb
      WHERE id = 'book1'`, { transaction });
    try {
      const report = await service.get({ classGroupId: "g1", search: "HV002" });
      expect(report.rows[0].scores.hp1).toMatchObject({ score: 0, result: "failed" });
      const card = await service.learnerScorecard("ar2", "g1");
      expect(card.subjects.find(row => row.id === "hp1")?.grade).toMatchObject({ score: 0, result: "failed",
        details: { examScore: 0, courseScore: 0, grade4: 0, letterGrade: "F", attemptScores: [0] } });
    } finally {
      await db.query(`UPDATE course_exam_gradebooks SET grades =
        (SELECT jsonb_agg(entry) FROM jsonb_array_elements(grades) entry WHERE entry->>'participantId' <> 'admission:ar2')
        WHERE id = 'book1'`, { transaction });
    }
  });

  it("maps linked shared offerings to the local curriculum, recalculates components, and does not match unrelated names", async () => {
    await db.query(`INSERT INTO pg_temp.subjects (id,code,name,credits,allow_cross_major) VALUES
      ('shared-source','SHARED','Ungraded',5,true), ('unlinked-source','OTHER','Zero',5,true);
      INSERT INTO pg_temp.course_offerings VALUES ('shared-offering','shared-source'),('unlinked-offering','unlinked-source');
      INSERT INTO pg_temp.course_offering_class_groups VALUES ('shared-offering','g1');
      INSERT INTO pg_temp.course_exam_gradebooks VALUES
      ('shared-book','g1','shared-offering','2026-10-01','[{"participantId":"admission:ar2","testScore":8,"assignmentScore":8,"examScore":9,"courseScore":null,"result":"pending"}]'),
      ('unlinked-book','other','unlinked-offering','2026-10-01','[{"participantId":"admission:ar2","courseScore":10,"result":"passed"}]')`, { transaction });
    const report = await service.get({ classGroupId: "g1", search: "HV002" });
    const card = await service.learnerScorecard("ar2", "g1");
    expect(report.rows[0].scores.hp3).toMatchObject({ score: 8.5, result: "passed" });
    expect(report.rows[0].scores.hp1).toBeUndefined();
    expect(card.subjects.find(row => row.id === 'hp3')?.grade).toMatchObject({ score: 8.5, result: "passed",
      details: { testScore: 8, assignmentScore: 8, examScore: 9, courseScore: 8.5, grade4: 4, letterGrade: "A" } });
    await db.query(`DELETE FROM pg_temp.course_exam_gradebooks WHERE id IN ('shared-book','unlinked-book')`, { transaction });
  });
  it("fails whole-class transcripts for a missing profile, then matches every single scorecard using bulk SQL", async () => {
    const mixed = await service.transcripts("g1");
    expect(mixed.scorecards).toHaveLength(40);
    expect(mixed.scorecards.find(item => item.student.participantId === "student:s1")).toMatchObject({ unavailableReason: expect.stringContaining("chưa có hồ sơ") });
    expect(mixed.scorecards.filter(item => !('unavailableReason' in item))).toHaveLength(39);
    // Explicit pg_temp qualification; production membership rows are never touched.
    await db.query("DELETE FROM pg_temp.class_group_members WHERE id = 40", { transaction });
    try {
      const batch = await service.transcripts("g1");
      expect(batch.scorecards).toHaveLength(39);
      const single = await service.learnerScorecard("ar1", "g1");
      const item = batch.scorecards.find(scorecard => scorecard.student.admissionRecordId === "ar1");
      expect(item?.student).toEqual(single.student);
      expect(item?.subjects).toEqual(single.subjects);
      expect(item?.subjects.find(subject => subject.id === "hp1").grade.score).toBe(0);
      expect(batch.scorecards.every(scorecard => scorecard.subjects.length === single.subjects.length)).toBe(true);
    } finally {
      await db.query("INSERT INTO pg_temp.class_group_members VALUES (40,'g1',NULL,'s1')", { transaction });
    }
  });

  it("excludes approved recognized learners from exams only for the matching course", async () => {
    const read = (subjectId: string) => db.query(`SELECT ar.id FROM pg_temp.admission_records ar
      WHERE ar.id IN ('ar1', 'ar2') AND ${excludeRecognizedExamParticipant("'admission:' || ar.id::text")}
      ORDER BY ar.id`, { transaction, replacements: { subjectId }, type: 'SELECT' as any });
    expect(await read('hp5')).toEqual([{ id: 'ar2' }]);
    expect(await read('hp1')).toEqual([{ id: 'ar1' }, { id: 'ar2' }]);
    await db.query(`INSERT INTO pg_temp.subjects (id,name,canonical_subject_id) VALUES ('recognized-alias','Other code','hp5')`, { transaction });
    expect(await read('recognized-alias')).toEqual([{ id: 'ar2' }]);
  });

  it("uses the shared conversion bands for recognition and ignores rejected decisions", async () => {
    await db.query(`INSERT INTO pg_temp.shared_grading_rules VALUES (1,
      '{"bands":[{"minimum":7,"letter":"CUSTOM","grade4":3.5},{"minimum":0,"letter":"F","grade4":0}]}')`, { transaction });
    try {
      const card = await service.learnerScorecard('ar1', 'g1');
      expect(card.subjects.find(row => row.id === 'hp5')?.grade?.details).toMatchObject({ grade4: 3.5, letterGrade: 'CUSTOM' });
      await db.query("UPDATE pg_temp.subject_recognitions SET status = 'rejected' WHERE id = 'rec1'", { transaction });
      const rejected = await service.learnerScorecard('ar1', 'g1');
      expect(rejected.subjects.find(row => row.id === 'hp5')?.grade).toBeNull();
    } finally {
      await db.query("UPDATE pg_temp.subject_recognitions SET status = 'approved' WHERE id = 'rec1'", { transaction });
      await db.query("DELETE FROM pg_temp.shared_grading_rules", { transaction });
    }
  });

  it("prefers an approved recognition to stale exam marks and leaves exam components blank", async () => {
    await db.query(`INSERT INTO pg_temp.course_offerings VALUES ('recognized-offering','hp5');
      INSERT INTO pg_temp.course_exam_gradebooks VALUES ('stale-book','g1','recognized-offering','2027-01-01',
        '[{"participantId":"admission:ar1","testScore":1,"assignmentScore":2,"examScore":3,"courseScore":2,"result":"failed"}]')`, { transaction });
    try {
      const card = await service.learnerScorecard('ar1', 'g1');
      const grade = card.subjects.find(row => row.id === 'hp5')?.grade;
      expect(grade).toMatchObject({ score: 7, result: 'passed', details: { source: 'recognition', grade4: 3, letterGrade: 'B' } });
      expect(grade?.details).not.toHaveProperty('examScore');
      expect(grade?.details).not.toHaveProperty('testScore');
    } finally {
      await db.query("DELETE FROM pg_temp.course_exam_gradebooks WHERE id = 'stale-book'; DELETE FROM pg_temp.course_offerings WHERE id = 'recognized-offering'", { transaction });
    }
  });
  it("derives enrollment status from class membership, correcting stale assigned and unassigned records", async () => {
    await db.query(`INSERT INTO pg_temp.admission_records (id,training_level,study_status) VALUES
      ('unassigned','Thạc sĩ','Đang học'), ('graduated','Thạc sĩ','Đã tốt nghiệp');
      UPDATE pg_temp.admission_records SET training_level='Thạc sĩ' WHERE id='ar1'`, { transaction });
    const [rows] = await db.query(`SELECT ar.id, ${learnerStudyStatusSql('ar')} AS status
      FROM pg_temp.admission_records ar WHERE ar.id IN ('ar1','unassigned','graduated') ORDER BY ar.id`, { transaction });
    expect(rows).toEqual([{ id: 'ar1', status: 'Đang học' }, { id: 'graduated', status: 'Đã tốt nghiệp' },
      { id: 'unassigned', status: 'Đã trúng tuyển' }]);
  });
});
