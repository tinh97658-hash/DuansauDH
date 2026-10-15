import { randomUUID } from "node:crypto";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";
import { learningExamResults } from "../../src/plan/learning-exam-results.js";
import { failedRetakeMembers, readRetakeResults } from "../../src/scheduling/retake-groups.js";

const describeDb = process.env.RUN_POSTGRES_REPORT_TESTS === "true" ? describe : describe.skip;

// Only explicit disposable database credentials are accepted. All fixture tables
// are connection-local and every test rolls its transaction back.
describeDb("Learning attempt ordering across reports, credits and retakes", () => {
  let db: Sequelize;
  let tx: Transaction;
  let reports: ClassScoreSummaryService;
  let learning: SubjectRecognitionService;
  let query: (sql: string, options?: any) => Promise<any>;
  const ids = Object.fromEntries(["record", "other", "group", "curriculum", "subject", "block", "old", "retry", "oldBook", "retryBook", "result"]
    .map(key => [key, randomUUID()]));
  const participantId = `admission:${ids.record}`;
  const results = { findAll: jest.fn(), bulkCreate: jest.fn() };

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database.");
    db = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
  });
  afterAll(async () => { await db?.close(); });
  afterEach(async () => { await tx?.rollback(); });

  beforeEach(async () => {
    tx = await db.transaction();
    query = (sql, options = {}) => db.query(sql, { ...options, transaction: tx });
    const fixture = (sql: string) => query(sql, { replacements: ids });
    await fixture(`
      CREATE TEMP TABLE class_group_members (id uuid, class_group_id uuid, admission_record_id uuid, student_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE admission_records (id uuid, student_id uuid, code text, full_name text, last_name text DEFAULT '', first_name text DEFAULT '',
        dob text DEFAULT '', gender text DEFAULT '', academic_year text DEFAULT '2026', created_at timestamptz DEFAULT NOW(),
        is_exempt_foreign_language boolean DEFAULT false, training_level text DEFAULT 'Thạc sĩ', status text DEFAULT 'approved',
        study_status text DEFAULT 'Đang học') ON COMMIT DROP;
      CREATE TEMP TABLE students (id uuid, reg_no text, full_name text) ON COMMIT DROP;
      CREATE TEMP TABLE subjects (id uuid, code text, code_text text, code_number int, name text, credits int DEFAULT 3, sort_order int DEFAULT 0,
        canonical_subject_id uuid, is_required boolean DEFAULT true, subject_type text DEFAULT 'KC', program text DEFAULT 'masters',
        allow_cross_major boolean DEFAULT false, shared_major_ids uuid[] DEFAULT '{}') ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_blocks (id uuid, name text, sort_order int, curriculum_id uuid, code text) ON COMMIT DROP;
      CREATE TEMP TABLE curriculum_subjects (curriculum_id uuid, subject_id uuid, block_id uuid, sort_order int DEFAULT 0) ON COMMIT DROP;
      CREATE TEMP TABLE course_offerings (id uuid, subject_id uuid, created_at timestamptz, status text DEFAULT 'completed') ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_class_groups (course_offering_id uuid, class_group_id uuid, participant_ids text[]) ON COMMIT DROP;
      CREATE TEMP TABLE course_exam_gradebooks (id uuid, class_group_id uuid, course_offering_id uuid, updated_at timestamptz, grades jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE course_offering_withdrawals (id uuid, admission_record_id uuid, course_offering_id uuid, participant_id text,
        class_group_id uuid, created_at timestamptz, snapshot jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE study_leaves (admission_record_id uuid, status text) ON COMMIT DROP;
      CREATE TEMP TABLE shared_grading_rules (version int, policy jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE bridge_knowledge_subjects (id uuid, equivalent_subject_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE learner_subject_results (id uuid, admission_record_id uuid, subject_id uuid, bridge_knowledge_subject_id uuid,
        course_offering_id uuid, score numeric, result text, status text, source_type text) ON COMMIT DROP;
      CREATE TEMP TABLE subject_recognitions (id uuid, admission_record_id uuid, target_subject_id uuid, learning_result_id uuid,
        status text, updated_at timestamptz) ON COMMIT DROP;
      INSERT INTO admission_records (id, code, full_name) VALUES (:record, 'HV01', 'Learner'), (:other, 'HV02', 'Other learner');
      INSERT INTO class_group_members VALUES (:record, :group, :record, NULL);
      INSERT INTO subjects (id, code, code_text, code_number, name) VALUES (:subject, 'HP01', 'HP', 1, 'Core course');
      INSERT INTO curriculum_blocks VALUES (:block, 'Core', 0, :curriculum, 'KC');
      INSERT INTO curriculum_subjects (curriculum_id, subject_id, block_id) VALUES (:curriculum, :subject, :block);
      INSERT INTO course_offerings (id, subject_id, created_at) VALUES (:old, :subject, '2026-09-01'), (:retry, :subject, '2026-10-01');
      INSERT INTO course_offering_class_groups VALUES (:old, :group, NULL), (:retry, :group, NULL);
      INSERT INTO course_exam_gradebooks VALUES
        (:oldBook, :group, :old, '2026-10-20', jsonb_build_array(jsonb_build_object('participantId', 'admission:' || CAST(:record AS text), 'courseScore', 3, 'result', 'failed'))),
        (:retryBook, :group, :retry, '2026-10-15', jsonb_build_array(jsonb_build_object('participantId', 'admission:' || CAST(:record AS text), 'courseScore', 8, 'result', 'passed')));
      INSERT INTO learner_subject_results (id, admission_record_id, subject_id, course_offering_id, source_type, status)
        VALUES (:result, :record, :subject, :old, 'regular', 'completed');
    `);
    const record = { id: ids.record, studentId: null, majorId: randomUUID(), trainingLevel: "Thạc sĩ", academicYear: "2026" };
    const curriculum = { id: ids.curriculum };
    const group = { id: ids.group, academicYear: "2026", curriculumId: ids.curriculum, curriculum };
    const scopedDb = { query } as unknown as Sequelize;
    reports = new ClassScoreSummaryService({ findByPk: jest.fn().mockResolvedValue(group) } as never, scopedDb);
    results.findAll.mockResolvedValue([]);
    learning = new SubjectRecognitionService(results as never, { findAll: jest.fn().mockResolvedValue([]) } as never, {} as never,
      { findByPk: jest.fn().mockResolvedValue(record) } as never,
      { findByPk: jest.fn().mockResolvedValue(curriculum) } as never,
      { findAll: jest.fn().mockResolvedValue([{ subjectId: ids.subject, subject: { id: ids.subject, credits: 3 } }]) } as never,
      {} as never, {} as never, {} as never,
      { findAll: jest.fn().mockResolvedValue([{ classGroup: { curriculumId: ids.curriculum } }]) } as never, scopedDb);
  });

  async function expectOutcome(result: string, score: number | null) {
    const report = await reports.get({ classGroupId: ids.group });
    expect(report.rows[0].scores[ids.subject]).toMatchObject({ result, score });
    const exams = await learningExamResults({ query } as unknown as Sequelize, ids.record, tx);
    expect(exams).toMatchObject([{ id: ids.result, result, score }]);
    const studied = await learning.listStudiedSubjects(ids.record);
    expect(studied).toEqual(result === "pending" ? [] : [expect.objectContaining({ result, subject: expect.objectContaining({ id: ids.subject }) })]);
    const retakes = await readRetakeResults({ query } as unknown as Sequelize, [ids.group], [ids.subject], tx);
    expect(retakes.filter(row => row.participantId === participantId))
      .toMatchObject([{ participantId, result, sourceCourseOfferingId: ids.retry }]);
    expect(failedRetakeMembers(retakes, ids.group, new Set([ids.subject]))).toHaveLength(result === "failed" ? 1 : 0);
    expect(await learning.recognizedCredits(ids.record)).toBe(["passed", "exempt"].includes(result) ? 3 : 0);
    await learning.syncRegularResults(ids.record, tx);
    if (result === "pending") expect(results.bulkCreate).not.toHaveBeenCalled();
    else expect(results.bulkCreate).toHaveBeenCalledWith([expect.objectContaining({ courseOfferingId: ids.retry, result, score })], expect.anything());
  }

  it("keeps a passed retake after an older failure was edited later", async () => {
    await expectOutcome("passed", 8);
  });

  it("does not change this learner's attempt when another row of the old book is edited", async () => {
    await query(`UPDATE pg_temp.course_exam_gradebooks SET updated_at = '2026-11-01',
      grades = grades || jsonb_build_array(jsonb_build_object('participantId', :other, 'courseScore', 9, 'result', 'passed'))
      WHERE id = :id`, { replacements: { id: ids.oldBook, other: `admission:${ids.other}` } });
    await expectOutcome("passed", 8);
  });

  it.each([
    ["failed", 2], ["pending", null], ["exempt", null],
  ])("keeps a later %s attempt authoritative over earlier passing marks", async (result, score) => {
    await query(`UPDATE pg_temp.course_exam_gradebooks SET grades = jsonb_build_array(
      jsonb_build_object('participantId', :person, 'courseScore', 9, 'result', 'passed')) WHERE id = :old;
      UPDATE pg_temp.course_exam_gradebooks SET grades = jsonb_build_array(
      jsonb_build_object('participantId', :person, 'courseScore', CAST(:score AS numeric), 'result', :result)) WHERE id = :retry`,
      { replacements: { person: participantId, old: ids.oldBook, retry: ids.retryBook, score, result } });
    await expectOutcome(result as string, score as number | null);
  });
});
