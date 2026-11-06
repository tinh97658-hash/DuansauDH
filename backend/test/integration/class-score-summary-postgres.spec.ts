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
// Learner identities use UUID columns and values, matching participantUuidSql in production.
describePostgres("Class reports PostgreSQL queries", () => {
  let db: Sequelize;
  let transaction: Transaction;
  let service: ClassScoreSummaryService;
  beforeAll(async () => {
    const vars = process.env.TEST_DATABASE_URL ? {} : Object.fromEntries(readFileSync(resolve(__dirname, "../../../.env"), "utf8")
      .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
      }));
    db = process.env.TEST_DATABASE_URL
      ? new Sequelize(process.env.TEST_DATABASE_URL, { logging: false })
      : new Sequelize({ dialect: "postgres", host: "127.0.0.1", port: Number(vars.DB_PORT),
        username: vars.POSTGRES_USER, password: vars.POSTGRES_PASSWORD, database: vars.POSTGRES_DB, logging: false });
    transaction = await db.transaction();
    const query = (sql: string) => db.query(sql, { transaction });
    await query(`
      CREATE TEMP TABLE class_group_members (id int, class_group_id text, admission_record_id uuid, student_id uuid) ON COMMIT DROP;
      CREATE TEMP VIEW academic_class_members AS SELECT * FROM class_group_members;
      CREATE TEMP TABLE course_offering_withdrawals (id text, admission_record_id uuid, course_offering_id text, participant_id text,
        class_group_id text, created_at timestamp, snapshot jsonb) ON COMMIT DROP;
      CREATE TYPE pg_temp.test_group_program AS ENUM ('masters', 'doctoral');
      CREATE TEMP TABLE class_groups (id text, code text, name text, program pg_temp.test_group_program, academic_year text, curriculum_id text) ON COMMIT DROP;
      CREATE TEMP TABLE students (id uuid, reg_no text, full_name text) ON COMMIT DROP;
      CREATE TEMP TABLE majors (id text, name text) ON COMMIT DROP;
      CREATE TEMP TABLE admission_records (id uuid, student_id uuid, code text, full_name text, last_name text, first_name text,
        dob text, gender text, academic_year text, created_at timestamp, pob text, admission_date text, training_level text,
        training_mode_name text, training_mode_group text, language text, major_id text, major_name text, diploma_number text,
        study_status text DEFAULT 'Đã trúng tuyển', extra_data jsonb DEFAULT '{}'::jsonb, is_exempt_foreign_language boolean DEFAULT false) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id text, code text, name text, sort_order int, canonical_subject_id text,
        code_text text, credits int DEFAULT 5, is_required boolean DEFAULT true, subject_type text,
        program text DEFAULT 'masters', allow_cross_major boolean DEFAULT false, shared_major_ids text[] DEFAULT '{}') ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_blocks (id text, name text, sort_order int, curriculum_id text, code text) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (curriculum_id text, subject_id text, block_id text, elective_group_id text, credits int, is_required boolean, sort_order int, id text DEFAULT md5(random()::text)) ON COMMIT DROP;
      CREATE TEMP TABLE class_group_electives (class_group_id text, curriculum_subject_id text) ON COMMIT DROP;
      CREATE TEMP TABLE course_offerings (id text, subject_id text, created_at timestamp NOT NULL DEFAULT '2026-01-01') ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (course_offering_id text, class_group_id text) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (id text, class_group_id text, course_offering_id text, updated_at timestamp, grades jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE shared_grading_rules (version int, policy jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (id text, admission_record_id uuid, subject_id text, score numeric, result text, status text, updated_at timestamp, source_type text DEFAULT 'pre_masters') ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (id text, admission_record_id uuid, target_subject_id text, learning_result_id text, status text, updated_at timestamp) ON COMMIT DROP;
      INSERT INTO class_groups VALUES ('g1','CLASS1','Class 1','masters','2026','c1');
      INSERT INTO majors VALUES ('m1','Current major');
      INSERT INTO admission_records (id,code,full_name,last_name,first_name,academic_year,created_at,major_id,pob,dob,
        admission_date,training_level,training_mode_name,training_mode_group,language,diploma_number)
        SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'HV'||lpad(n::text,3,'0'), 'Learner '||lpad(n::text,3,'0'), 'Learner', lpad(n::text,3,'0'),
          '2026', '2026-01-01'::timestamp,'m1','Birthplace','1990-01-02','2026-09-01','Masters','Research','Full time','Vietnamese','UNDERGRAD-123'
        FROM generate_series(1,39) n;
      INSERT INTO students VALUES ('11111111-1111-4111-8111-111111111111','REG1','Student only');
      INSERT INTO class_group_members SELECT n,'g1',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,NULL FROM generate_series(1,39) n;
      INSERT INTO class_group_members VALUES (40,'g1',NULL,'11111111-1111-4111-8111-111111111111'),(41,'g1','00000000-0000-4000-8000-000000000001',NULL),(42,'other','00000000-0000-4000-8000-000000000002',NULL);
      INSERT INTO subjects (id,code,name,sort_order,canonical_subject_id) VALUES ('hp1','HP01','Zero',1,NULL),('hp2','HP02','Exempt',2,NULL),
        ('hp3','HP03','Ungraded',3,NULL),('hp4','HP04','Latest result',4,NULL),('alias','OTHER','Alias',5,'hp4'),
        ('external','EXT','External',6,NULL),('hp5','HP05','Recognition',7,NULL);
      INSERT INTO curriculum_blocks (id,name,sort_order) VALUES ('b1','Block',0);
      INSERT INTO curriculum_subjects (curriculum_id,subject_id,block_id,credits,is_required,sort_order) SELECT 'c1',id,'b1',5,true,sort_order FROM subjects WHERE id LIKE 'hp%';
      INSERT INTO course_offerings VALUES ('o1','hp1'),('o2','hp2'),('o3','hp3'),('o4','alias');
      INSERT INTO course_offering_class_groups SELECT id,'g1' FROM course_offerings;
      INSERT INTO course_exam_gradebooks VALUES
        ('book1','g1','o1','2026-01-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000001","courseScore":0,"result":"failed"}]'),
        ('book2','g1','o2','2026-01-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000001","examExempt":true,"result":"pending"}]'),
        ('book3','g1','o3','2026-01-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000001","examScore":9,"result":"pending"}]'),
        ('book4','g1','o4','2026-01-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000001","courseScore":9,"result":"passed"}]');
      INSERT INTO learner_subject_results (id,admission_record_id,subject_id,score,result,status,updated_at) VALUES ('r1','00000000-0000-4000-8000-000000000001','hp4',6,'passed','completed','2026-02-01'),
        ('r2','00000000-0000-4000-8000-000000000001','external',7,'passed','completed','2026-02-01');
      INSERT INTO subject_recognitions VALUES ('rec1','00000000-0000-4000-8000-000000000001','hp5','r2','approved','2026-03-01');
    `);
    const groups = { findByPk: jest.fn<any>().mockResolvedValue({ id: "g1", academicYear: "2026", code: "CLASS1", curriculumId: "c1", curriculum: { id: "c1" } }) };
    service = new ClassScoreSummaryService(groups as never,
      { query: (sql: string, options: object) => db.query(sql, { ...options, transaction }) } as never);
  });
  afterAll(async () => {
    try { await transaction?.rollback(); } finally { await db?.close(); }
  });

  beforeEach(async () => { await db.query("SAVEPOINT report_case", { transaction }); });
  afterEach(async () => { await db.query("ROLLBACK TO SAVEPOINT report_case", { transaction }); });

  it("returns all 40 unique participants with a small payload and keeps student-only memberships", async () => {
    const result = await service.roster("g1");
    expect(result.students).toHaveLength(40);
    expect(new Set(result.students.map(row => row.participantId)).size).toBe(40);
    expect(result.students.filter(row => row.admissionRecordId === "00000000-0000-4000-8000-000000000001")).toHaveLength(1);
    expect(result.students.find(row => row.studentId === "11111111-1111-4111-8111-111111111111")).toMatchObject({ admissionRecordId: null, canPreview: false });
    expect(Object.keys(result).sort()).toEqual(["classGroup", "students"]);
    for (const row of result.students) expect(Object.keys(row).sort()).toEqual([
      "admissionRecordId", "canPreview", "code", "firstName", "fullName", "lastName", "participantId", "studentId",
    ]);
  });

  it("reports every subject from the assigned curriculum without elective selection gates", async () => {
    await db.query("SAVEPOINT elective_choices", { transaction });
    await db.query(`INSERT INTO pg_temp.subjects (id,code,name,credits) VALUES
      ('choice-a','CA','Chosen elective',3), ('choice-b','CB','Unchosen elective',3), ('choice-old','CO','Historical elective',3);
      INSERT INTO pg_temp.curriculum_subjects (id,curriculum_id,subject_id,block_id,credits,is_required,sort_order) VALUES
      ('entry-ca','c1','choice-a','b1',3,false,90), ('entry-cb','c1','choice-b','b1',3,false,91), ('entry-co','c1','choice-old','b1',3,false,92);
      INSERT INTO pg_temp.class_group_electives VALUES ('g1','entry-ca');
      INSERT INTO pg_temp.course_offerings (id,subject_id) VALUES ('history-elective','choice-old');
      INSERT INTO pg_temp.course_offering_class_groups VALUES ('history-elective','g1')`, { transaction });
    try {
      // This test exercises subject selection SQL independently of grade fixtures.
      const result = await service.get({ classGroupId: "g1", search: "__no_matching_learner__" });
      expect(result.subjects.map(subject => subject.id)).toEqual(expect.arrayContaining(["choice-a", "choice-old"]));
      expect(result.subjects.map(subject => subject.id)).toContain("choice-b");
      expect(result.subjects.find(subject => subject.id === "choice-a")?.isRequired).toBe(false);
    } catch (error: any) {
      throw new Error(error.original?.message || error.message);
    } finally {
      await db.query("ROLLBACK TO SAVEPOINT elective_choices", { transaction });
    }
  });

  it("uses curriculum labels and ignores retired class overrides for all assigned classes", async () => {
    await db.query("SAVEPOINT class_subject_rules", { transaction });
    const lookup = (service as any).groups.findByPk;
    const originalGroup = await lookup();
    try {
      await db.query(`INSERT INTO pg_temp.subjects (id,code,name,credits) VALUES
        ('rule-a','RA','Class-dependent elective',3),('rule-b','RB','Class-dependent required',3);
        INSERT INTO pg_temp.curriculum_subjects (id,curriculum_id,subject_id,block_id,credits,is_required,sort_order) VALUES
        ('entry-ra','c1','rule-a','b1',3,false,95),('entry-rb','c1','rule-b','b1',3,true,96)`, { transaction });
      lookup.mockResolvedValue({ ...originalGroup, subjectRequirements: [
        { curriculumSubjectId: "entry-ra", isRequired: true },
        { curriculumSubjectId: "entry-rb", isRequired: false, electiveGroupId: null },
      ] });
      const first = await service.get({ classGroupId: "g1", search: "__no_matching_learner__" });
      expect(first.subjects.find(subject => subject.id === "rule-a")).toMatchObject({ isRequired: false });
      expect(first.subjects.find(subject => subject.id === "rule-b")).toMatchObject({ isRequired: true });
      lookup.mockResolvedValue({ ...originalGroup, id: "g2", subjectRequirements: [] });
      const second = await service.get({ classGroupId: "g2", search: "__no_matching_learner__" });
      expect(second.subjects.find(subject => subject.id === "rule-a")).toMatchObject({ isRequired: false });
      expect(second.subjects.find(subject => subject.id === "rule-b")).toMatchObject({ isRequired: true });
    } catch (error: any) {
      throw new Error(error.original?.message || error.message);
    } finally {
      lookup.mockResolvedValue(originalGroup);
      await db.query("ROLLBACK TO SAVEPOINT class_subject_rules", { transaction });
    }
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
    const result = await service.learnerScorecard("00000000-0000-4000-8000-000000000001", "g1");
    expect(result.student).toMatchObject({ fullName: "Learner 001", dob: "1990-01-02", pob: "Birthplace",
      academicYear: "2026", admissionDate: "2026-09-01", trainingLevel: "Masters", trainingModeName: "Research",
      trainingModeGroup: "Full time", language: "Vietnamese", major: { id: "m1", name: "Current major" },
      durationYears: null, masterDiplomaNumber: null });
    expect(result.student).not.toHaveProperty("diplomaNumber");
  });

  it("retains authoritative saved exam results, including zero, pending totals and canonical aliases", async () => {
    const report = await service.get({ classGroupId: "g1", search: "HV001" });
    const scorecard = await service.learnerScorecard("00000000-0000-4000-8000-000000000001", "g1");
    expect(report.rows[0].scores).toEqual({ hp1: { score: 0, result: "failed" }, hp2: { score: null, result: "exempt", examExempt: true },
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
      '[{"participantId":"admission:00000000-0000-4000-8000-000000000002","testScore":6,"assignmentScore":3,"examScore":null,"courseScore":null,"result":"pending"}]'::jsonb
      WHERE id = 'book1'`, { transaction });
    try {
      const report = await service.get({ classGroupId: "g1", search: "HV002" });
      expect(report.rows[0].scores.hp1).toMatchObject({ score: 0, result: "failed" });
      const card = await service.learnerScorecard("00000000-0000-4000-8000-000000000002", "g1");
      expect(card.subjects.find(row => row.id === "hp1")?.grade).toMatchObject({ score: 0, result: "failed",
        details: { examScore: 0, courseScore: 0, grade4: 0, letterGrade: "F", attemptScores: [0] } });
    } finally {
      await db.query(`UPDATE course_exam_gradebooks SET grades =
        (SELECT jsonb_agg(entry) FROM jsonb_array_elements(grades) entry WHERE entry->>'participantId' <> 'admission:00000000-0000-4000-8000-000000000002')
        WHERE id = 'book1'`, { transaction });
    }
  });

  it("maps linked shared offerings to the local curriculum, recalculates components, and does not match unrelated names", async () => {
    await db.query(`INSERT INTO pg_temp.subjects (id,code,name,credits,allow_cross_major) VALUES
      ('shared-source','SHARED','Ungraded',5,true), ('unlinked-source','OTHER','Zero',5,true);
      INSERT INTO pg_temp.course_offerings VALUES ('shared-offering','shared-source'),('unlinked-offering','unlinked-source');
      INSERT INTO pg_temp.course_offering_class_groups VALUES ('shared-offering','g1');
      INSERT INTO pg_temp.course_exam_gradebooks VALUES
      ('shared-book','g1','shared-offering','2026-10-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000002","testScore":8,"assignmentScore":8,"examScore":9,"courseScore":null,"result":"pending"}]'),
      ('unlinked-book','other','unlinked-offering','2026-10-01','[{"participantId":"admission:00000000-0000-4000-8000-000000000002","courseScore":10,"result":"passed"}]')`, { transaction });
    const report = await service.get({ classGroupId: "g1", search: "HV002" });
    const card = await service.learnerScorecard("00000000-0000-4000-8000-000000000002", "g1");
    expect(report.rows[0].scores.hp3).toMatchObject({ score: 8.5, result: "passed" });
    expect(report.rows[0].scores.hp1).toBeUndefined();
    expect(card.subjects.find(row => row.id === 'hp3')?.grade).toMatchObject({ score: 8.5, result: "passed",
      details: { testScore: 8, assignmentScore: 8, examScore: 9, courseScore: 8.5, grade4: 4, letterGrade: "A" } });
    await db.query(`DELETE FROM pg_temp.course_exam_gradebooks WHERE id IN ('shared-book','unlinked-book')`, { transaction });
  });
  it("fails whole-class transcripts for a missing profile, then matches every single scorecard using bulk SQL", async () => {
    const mixed = await service.transcripts("g1");
    expect(mixed.scorecards).toHaveLength(40);
    expect(mixed.scorecards.find(item => item.student.participantId === "student:11111111-1111-4111-8111-111111111111")).toMatchObject({ unavailableReason: expect.stringContaining("chưa có hồ sơ") });
    expect(mixed.scorecards.filter(item => !('unavailableReason' in item))).toHaveLength(39);
    // Explicit pg_temp qualification; production membership rows are never touched.
    await db.query("DELETE FROM pg_temp.class_group_members WHERE id = 40", { transaction });
    try {
      const batch = await service.transcripts("g1");
      expect(batch.scorecards).toHaveLength(39);
      const single = await service.learnerScorecard("00000000-0000-4000-8000-000000000001", "g1");
      const item = batch.scorecards.find(scorecard => scorecard.student.admissionRecordId === "00000000-0000-4000-8000-000000000001");
      expect(item?.student).toEqual(single.student);
      expect(item?.subjects).toEqual(single.subjects);
      expect(item?.subjects.find(subject => subject.id === "hp1").grade.score).toBe(0);
      expect(batch.scorecards.every(scorecard => scorecard.subjects.length === single.subjects.length)).toBe(true);
    } finally {
      await db.query("INSERT INTO pg_temp.class_group_members VALUES (40,'g1',NULL,'11111111-1111-4111-8111-111111111111')", { transaction });
    }
  });

  it("excludes approved recognized learners from exams only for the matching course", async () => {
    const read = (subjectId: string) => db.query(`SELECT ar.id FROM pg_temp.admission_records ar
      WHERE ar.id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') AND ${excludeRecognizedExamParticipant("'admission:' || ar.id::text")}
      ORDER BY ar.id`, { transaction, replacements: { subjectId }, type: 'SELECT' as any });
    expect(await read('hp5')).toEqual([{ id: '00000000-0000-4000-8000-000000000002' }]);
    expect(await read('hp1')).toEqual([{ id: '00000000-0000-4000-8000-000000000001' }, { id: '00000000-0000-4000-8000-000000000002' }]);
    await db.query(`INSERT INTO pg_temp.subjects (id,name,canonical_subject_id) VALUES ('recognized-alias','Other code','hp5')`, { transaction });
    expect(await read('recognized-alias')).toEqual([{ id: '00000000-0000-4000-8000-000000000002' }]);
  });

  it("uses the shared conversion bands for recognition and ignores rejected decisions", async () => {
    await db.query(`INSERT INTO pg_temp.shared_grading_rules VALUES (1,
      '{"bands":[{"minimum":7,"letter":"CUSTOM","grade4":3.5},{"minimum":0,"letter":"F","grade4":0}]}')`, { transaction });
    try {
      const card = await service.learnerScorecard('00000000-0000-4000-8000-000000000001', 'g1');
      expect(card.subjects.find(row => row.id === 'hp5')?.grade?.details).toMatchObject({ grade4: 3.5, letterGrade: 'CUSTOM' });
      await db.query("UPDATE pg_temp.subject_recognitions SET status = 'rejected' WHERE id = 'rec1'", { transaction });
      const rejected = await service.learnerScorecard('00000000-0000-4000-8000-000000000001', 'g1');
      expect(rejected.subjects.find(row => row.id === 'hp5')?.grade).toBeNull();
    } finally {
      await db.query("UPDATE pg_temp.subject_recognitions SET status = 'approved' WHERE id = 'rec1'", { transaction });
      await db.query("DELETE FROM pg_temp.shared_grading_rules", { transaction });
    }
  });

  it("prefers an approved recognition to stale exam marks and leaves exam components blank", async () => {
    await db.query(`INSERT INTO pg_temp.course_offerings VALUES ('recognized-offering','hp5');
      INSERT INTO pg_temp.course_exam_gradebooks VALUES ('stale-book','g1','recognized-offering','2027-01-01',
        '[{"participantId":"admission:00000000-0000-4000-8000-000000000001","testScore":1,"assignmentScore":2,"examScore":3,"courseScore":2,"result":"failed"}]')`, { transaction });
    try {
      const card = await service.learnerScorecard('00000000-0000-4000-8000-000000000001', 'g1');
      const grade = card.subjects.find(row => row.id === 'hp5')?.grade;
      expect(grade).toMatchObject({ score: 7, result: 'passed', details: { source: 'recognition', grade4: 3, letterGrade: 'B' } });
      expect(grade?.details).not.toHaveProperty('examScore');
      expect(grade?.details).not.toHaveProperty('testScore');
    } finally {
      await db.query("DELETE FROM pg_temp.course_exam_gradebooks WHERE id = 'stale-book'; DELETE FROM pg_temp.course_offerings WHERE id = 'recognized-offering'", { transaction });
    }
  });
  it("uses tuition payment for masters enrollment status and preserves graduation", async () => {
    await db.query(`INSERT INTO pg_temp.admission_records (id,training_level,study_status) VALUES
      ('00000000-0000-4000-8000-000000000041','Thạc sĩ','Đang học'), ('00000000-0000-4000-8000-000000000040','Thạc sĩ','Đã tốt nghiệp');
      UPDATE pg_temp.admission_records SET training_level='Thạc sĩ', extra_data='{"tuitionPayment":{"paid":true}}' WHERE id='00000000-0000-4000-8000-000000000001'`, { transaction });
    const [rows] = await db.query(`SELECT ar.id, ${learnerStudyStatusSql('ar')} AS status
      FROM pg_temp.admission_records ar WHERE ar.id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000040') ORDER BY ar.id`, { transaction });
    expect(rows).toEqual([{ id: '00000000-0000-4000-8000-000000000001', status: 'Đang học' }, { id: '00000000-0000-4000-8000-000000000040', status: 'Đã tốt nghiệp' },
      { id: '00000000-0000-4000-8000-000000000041', status: 'Đã trúng tuyển' }]);
  });
});
