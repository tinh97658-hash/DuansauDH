// Preview (rolled back): node src/database/seeds/seed-local-cntt-2025-and-2026.cjs
// Apply: append --apply. Creates only this batch; refuses existing class/code collisions.
require('reflect-metadata');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Op, QueryTypes } = require('sequelize');
const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/sequelize');
const { AppModule } = require('../../../dist/app.module');
const { SchedulingService } = require('../../../dist/scheduling/scheduling.service');
const { ExamGradebookService } = require('../../../dist/masters/exam-gradebook.service');
const { GradingPolicyService } = require('../../../dist/masters/grading-policy.service');
const { calculateExamGrade } = require('../../../dist/masters/exam-grade-calculation');
const { ClassScoreSummaryService } = require('../../../dist/reports/class-score-summary.service');
const { SubjectRecognitionService } = require('../../../dist/plan/subject-recognition.service');

process.loadEnvFile(path.resolve(__dirname, '../../../../.env'));
const MARKER = 'LOCAL-CNTT-2025-2026-COHORTS-V1';
const COUNT = 20;
const apply = process.argv.includes('--apply');
const names = [
  ['Nguyễn Minh', 'An', 'Nam'], ['Trần Ngọc', 'Anh', 'Nữ'], ['Lê Quốc', 'Bảo', 'Nam'],
  ['Phạm Thanh', 'Bình', 'Nam'], ['Hoàng Thu', 'Chi', 'Nữ'], ['Vũ Đức', 'Cường', 'Nam'],
  ['Đặng Hải', 'Dũng', 'Nam'], ['Bùi Khánh', 'Duy', 'Nam'], ['Đỗ Quang', 'Đạt', 'Nam'],
  ['Ngô Minh', 'Đức', 'Nam'], ['Dương Thu', 'Giang', 'Nữ'], ['Đinh Ngọc', 'Hà', 'Nữ'],
  ['Phan Hoàng', 'Hải', 'Nam'], ['Đoàn Thu', 'Hạnh', 'Nữ'], ['Hồ Minh', 'Hiếu', 'Nam'],
  ['Lý Thanh', 'Hoa', 'Nữ'], ['Vũ Quốc', 'Huy', 'Nam'], ['Trần Khánh', 'Linh', 'Nữ'],
  ['Nguyễn Hoàng', 'Nam', 'Nam'], ['Phạm Ngọc', 'Trang', 'Nữ'],
];
const protectedTables = ['admission_records', 'class_groups', 'class_group_members', 'subjects',
  'curriculums', 'curriculum_blocks', 'curriculum_elective_groups', 'curriculum_subjects',
  'course_offerings', 'course_offering_class_groups', 'teaching_sessions', 'course_exam_gradebooks',
  'learner_subject_results', 'subject_recognitions'];

async function snapshot(db) {
  const result = new Map();
  for (const table of protectedTables) result.set(table, await db.query(
    `SELECT id::text, md5(to_jsonb(row)::text) AS digest FROM "${table}" row`, { type: QueryTypes.SELECT }));
  return result;
}

async function run() {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Chỉ hỗ trợ --apply.');
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
    throw new Error('Chỉ tạo dữ liệu mẫu trên PostgreSQL local, ngoài production.');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(getConnectionToken());
  db.options.logging = false;
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  let tx;
  let finished = false;
  try {
    tx = await db.transaction();
    // This CLI owns its connection. Keep ORM calls and nested service transactions atomic,
    // including the preview, without changing application transaction behavior.
    db.query = function (sql, options) { return originalQuery.call(this, sql, { ...options, transaction: tx }); };
    db.transaction = async function (options, callback) {
      const action = typeof options === 'function' ? options : callback;
      if (!action) throw new Error('Unsupported nested transaction');
      return action(tx);
    };
    await db.query('SELECT pg_advisory_xact_lock(21025)');
    const before = await snapshot(db);
    const models = db.models;
    const major = await models.Major.findOne({ where: { code: 'CNTT', program: 'masters', active: true } });
    assert(major, 'Không tìm thấy chuyên ngành CNTT.');
    const sourceGroup = await models.ClassGroup.findOne({ where: { majorId: major.id, academicYear: '2026', code: 'CNTT 2026.1.1' } });
    assert(sourceGroup?.curriculumId, 'Lớp CNTT 2026.1.1 chưa có CTĐT.');
    const sourceCurriculum = await models.Curriculum.findByPk(sourceGroup.curriculumId);
    const existingGroups = await models.ClassGroup.count({ where: { code: { [Op.in]: ['CNTT 2025.1.1', 'CNTT 2026.1.2'] } } });
    assert.equal(existingGroups, 0, 'Lớp đích đã tồn tại; dừng để không ghi đè hoặc tạo trùng.');
    assert.equal(await models.Curriculum.count({ where: { code: 'CT-CNTT-2025-LOCAL' } }), 0, 'CTĐT mẫu đã tồn tại.');
    assert.equal(await models.AdmissionRecord.count({ where: { note: { [Op.like]: `%${MARKER}%` } } }), 0, 'Batch đã tồn tại.');
    const catalog = await models.Subject.findAll({ where: { majorId: major.id, program: 'masters', active: true } });
    const subjectById = new Map(catalog.map(subject => [subject.id, subject]));
    const byCode = code => {
      const matches = catalog.filter(subject => subject.code === code);
      assert.equal(matches.length, 1, `Mã học phần ${code} không duy nhất.`);
      return matches[0];
    };
    const sourceEntries = await models.CurriculumSubject.findAll({ where: { curriculumId: sourceCurriculum.id }, order: [['sortOrder', 'ASC']] });
    const replacements = new Map([[byCode('ITDL').id, byCode('ITCN')], [byCode('ITOS').id, byCode('ITFL')]]);
    assert(sourceEntries.some(entry => entry.subjectId === byCode('ITDL').id) && sourceEntries.some(entry => entry.subjectId === byCode('ITOS').id));
    const selected = sourceEntries.map(entry => replacements.get(entry.subjectId) || subjectById.get(entry.subjectId));
    assert(selected.every(Boolean) && new Set(selected.map(subject => subject.id)).size === selected.length, 'Học phần CTĐT không hợp lệ hoặc bị trùng.');
    const curriculum = await models.Curriculum.create({
      code: 'CT-CNTT-2025-LOCAL', name: 'Chương trình đào tạo Công nghệ thông tin - Khóa 2025',
      majorId: major.id, program: 'masters', applicableFromYear: '2025', active: true,
      totalCredits: selected.reduce((sum, subject) => sum + Number(subject.credits), 0),
      note: `[TEST_BATCH:${MARKER}] Thay Học sâu bằng Mạng máy tính; thay Các hệ thống mã nguồn mở và di động bằng Logic mờ và ứng dụng.`,
    });
    const blocks = await models.CurriculumBlock.findAll({ where: { curriculumId: sourceCurriculum.id } });
    const blockByCode = new Map();
    for (const block of blocks) {
      const created = await models.CurriculumBlock.create({ curriculumId: curriculum.id, code: block.code,
        name: block.name, minCredits: block.minCredits, sortOrder: block.sortOrder });
      blockByCode.set(block.code, created.id);
    }
    for (let index = 0; index < selected.length; index++) {
      const subject = selected[index];
      assert(blockByCode.has(subject.subjectType), `Thiếu khối ${subject.subjectType}`);
      await models.CurriculumSubject.create({ curriculumId: curriculum.id, blockId: blockByCode.get(subject.subjectType),
        subjectId: subject.id, credits: subject.credits, isRequired: subject.isRequired, sortOrder: index + 1 });
    }
    const groups = [];
    const recordsByYear = new Map();
    for (const year of ['2025', '2026']) {
      const code = year === '2025' ? 'CNTT 2025.1.1' : 'CNTT 2026.1.2';
      const group = await models.ClassGroup.create({ code, name: code, majorId: major.id, program: 'masters',
        academicYear: year, intakeRound: 1, groupNumber: year === '2025' ? 1 : 2, maxStudents: 40,
        status: 'open', groupType: 'ADMINISTRATIVE', allowedWeekdays: [1, 2, 3, 4, 5, 6, 0],
        curriculumId: year === '2025' ? curriculum.id : sourceCurriculum.id, note: `[TEST_BATCH:${MARKER}]` });
      groups.push(group);
      const records = [];
      for (let index = 0; index < COUNT; index++) {
        const seq = String(index + 1).padStart(3, '0');
        const [lastName, firstName, gender] = names[year === '2025' ? index : (index + 7) % COUNT];
        const learnerCode = `LOCAL-CNTT${year.slice(-2)}-${year === '2025' ? 'A' : 'B'}-${seq}`;
        const identifiers = { code: learnerCode, email: `${learnerCode.toLowerCase()}@example.invalid`,
          idCard: `TEST-${year}-${year === '2025' ? 'A' : 'B'}-${seq}`, registryBookNumber: `HS-${learnerCode}` };
        assert.equal(await models.AdmissionRecord.count({ where: { [Op.or]: Object.entries(identifiers).map(([key, value]) => ({ [key]: value })) } }), 0, 'Trùng thông tin định danh mẫu.');
        const learner = await models.AdmissionRecord.create({ ...identifiers, lastName, firstName, fullName: `${lastName} ${firstName}`, gender,
          dob: `${1993 + index % 7}-${String(1 + index % 12).padStart(2, '0')}-${String(5 + index % 20).padStart(2, '0')}`,
          pob: 'Hải Phòng', nationality: 'Việt Nam', ethnicity: 'Kinh', religion: 'Không',
          majorId: major.id, majorName: major.name, trainingLevel: 'Thạc sĩ', academicYear: year,
          trainingModeGroup: 'Chính quy', trainingModeName: 'Đào tạo thông thường', language: 'Tiếng Việt',
          status: 'approved', studyStatus: 'Đã trúng tuyển', isExemptForeignLanguage: false,
          admissionDate: `${year}-09-01`, receiptType: 'Trực tiếp', profileCategory: 'Đầy đủ',
          documents: { docApplication: true, docCurriculumVitae: true, docDegree: true, docHealthCert: true, docPhoto: true, docTranscript: true },
          note: `[TEST_BATCH:${MARKER}] Hồ sơ mẫu đã trúng tuyển, lớp ${code}.`, extraData: { testBatch: MARKER, localOnly: true } });
        await models.ClassGroupMember.create({ classGroupId: group.id, admissionRecordId: learner.id,
          enrolledAt: new Date(`${year}-09-01T08:00:00+07:00`), note: `[TEST_BATCH:${MARKER}]` });
        records.push(learner);
      }
      recordsByYear.set(year, records);
    }
    const group = groups[0];
    const staff = await models.Staff.findOne({ where: { role: 'admin' }, order: [['createdAt', 'ASC']] });
    const lecturer = await models.Lecturer.findOne({ where: { majorId: major.id, active: true }, order: [['code', 'ASC']] });
    const room = await models.Room.findOne({ where: { isActive: true, capacity: { [Op.gte]: COUNT } }, order: [['code', 'ASC']] });
    assert(staff && lecturer && room, 'Thiếu quản trị viên, giảng viên hoặc phòng học.');
    const scheduling = app.get(SchedulingService);
    const exams = app.get(ExamGradebookService);
    const policies = app.get(GradingPolicyService);
    const reports = app.get(ClassScoreSummaryService);
    const learning = app.get(SubjectRecognitionService);
    const offerings = [];
    const outcomes = [];
    const calendar = new Date('2025-10-06T00:00:00Z');
    for (const [courseIndex, code] of ['HPTH', 'HPTA', 'ITKH', 'ITMA'].entries()) {
      const subject = byCode(code);
      const offering = await scheduling.createCourseOffering({ subjectId: subject.id, classGroupIds: [group.id],
        majorId: major.id, academicYear: '2025', name: `${subject.name} - ${group.code}`, note: `[TEST_BATCH:${MARKER}]` });
      offerings.push(offering);
      // Import historical sessions; the interactive scheduling API intentionally rejects past dates.
      for (let sessionIndex = 0; sessionIndex < Number(subject.credits) * 2; sessionIndex++) {
        let date;
        for (let tries = 0; tries < 365; tries++) {
          date = calendar.toISOString().slice(0, 10);
          calendar.setUTCDate(calendar.getUTCDate() + 1);
          if ([0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue;
          const occupied = await db.query(`SELECT 1 FROM teaching_sessions session
            WHERE session.session_date = :date AND session.status <> 'not_held'
              AND session.start_time < '11:30' AND session.end_time > '08:00'
              AND (session.room_id = :roomId OR session.lecturer_id = :lecturerId OR EXISTS (
                SELECT 1 FROM course_offering_class_groups link WHERE link.course_offering_id = session.course_offering_id AND link.class_group_id = :groupId)) LIMIT 1`,
          { type: QueryTypes.SELECT, replacements: { date, roomId: room.id, lecturerId: lecturer.id, groupId: group.id } });
          if (!occupied.length) break;
          date = null;
        }
        assert(date && date < new Date().toISOString().slice(0, 10), 'Không có ca học lịch sử phù hợp.');
        const session = await models.TeachingSession.create({ courseOfferingId: offering.id, sessionDate: date,
          startTime: '08:00', endTime: '11:30', period: 'MORNING', lecturerId: lecturer.id, roomId: room.id,
          note: `[TEST_BATCH:${MARKER}] Buổi học lịch sử mẫu`, status: 'planned' });
        await scheduling.confirmTeachingSession(session.id, 'held', staff.id);
      }
      await scheduling.completeCourseOffering(offering.id, staff.id);
      const policy = await policies.latest(subject.id, '2025');
      const rows = recordsByYear.get('2025').map((learner, index) => {
        const failed = (index + courseIndex) % 5 === 0;
        let marks = { testScore: 8 + index % 3 * 0.5, assignmentScore: 8 + index % 4 * 0.5, examScore: 7 + index % 4 * 0.5, examExempt: false };
        if (failed) marks = { testScore: 7, assignmentScore: 7, examScore: 0, examExempt: false };
        let calculated = calculateExamGrade(marks, policy, policy);
        if (!failed && calculated.result !== 'passed') {
          marks = { testScore: 10, assignmentScore: 10, examScore: 10, examExempt: false };
          calculated = calculateExamGrade(marks, policy, policy);
        }
        assert.equal(calculated.result, failed ? 'failed' : 'passed', 'Cấu hình điểm không tạo được kết quả dự kiến.');
        return { participantId: `admission:${learner.id}`, ...marks, ...calculated, eligible: true,
          policyVersion: policy.version, policyRulesVersion: policy.rulesVersion ?? 0,
          attemptScores: [marks.examScore], notes: `[TEST_BATCH:${MARKER}] Điểm mẫu` };
      });
      const saved = await exams.save({ classGroupId: group.id, courseOfferingId: offering.id, rosterScope: 'offering', revision: 0, rows });
      assert.equal(saved.totalRows, COUNT);
      const stored = await models.CourseExamGradebook.findOne({ where: { courseOfferingId: offering.id } });
      assert.equal(stored.grades.length, COUNT);
      const passed = stored.grades.filter(row => row.result === 'passed').length;
      const failed = stored.grades.filter(row => row.result === 'failed').length;
      assert.equal(passed, 16); assert.equal(failed, 4);
      outcomes.push({ code, subject: subject.name, sessions: Number(subject.credits) * 2, passed, failed });
    }
    const report = await reports.get({ classGroupId: group.id }, true, { includeDetails: true });
    assert.equal(report.rows.length, COUNT);
    for (const learner of recordsByYear.get('2025')) {
      await learning.syncRegularResults(learner.id, tx);
      const scorecard = await reports.learnerScorecard(learner.id, group.id);
      const studied = await learning.listStudiedSubjects(learner.id);
      const scores = report.rows.find(row => row.participantId === `admission:${learner.id}`).scores;
      assert.equal(studied.length, 4);
      let credits = 0;
      for (const offering of offerings) {
        const grade = scores[offering.subjectId];
        assert(grade && ['passed', 'failed'].includes(grade.result));
        assert.equal(scorecard.subjects.find(subject => subject.id === offering.subjectId).grade.result, grade.result);
        if (grade.result === 'passed') credits += Number(subjectById.get(offering.subjectId).credits);
      }
      assert.equal(await learning.recognizedCredits(learner.id), credits);
    }
    assert.equal(await models.ClassGroupMember.count({ where: { classGroupId: groups[1].id } }), COUNT);
    assert.equal(await models.CourseOfferingClassGroup.count({ where: { classGroupId: groups[1].id } }), 0);
    assert.equal(await models.CourseExamGradebook.count({ where: { classGroupId: groups[1].id } }), 0);
    assert.equal(await models.LearnerSubjectResult.count({ where: { admissionRecordId: recordsByYear.get('2026').map(row => row.id) } }), 0);
    const after = await snapshot(db);
    for (const [table, originals] of before) {
      const current = new Map(after.get(table).map(row => [row.id, row.digest]));
      for (const row of originals) assert.equal(current.get(row.id), row.digest, `Dữ liệu cũ bị thay đổi: ${table}/${row.id}`);
    }
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (apply) await tx.commit(); else await tx.rollback();
    finished = true;
    console.log(JSON.stringify({ mode: apply ? 'APPLIED' : 'PREVIEW_ROLLED_BACK', marker: MARKER,
      groups: groups.map(value => ({ id: value.id, code: value.code, year: value.academicYear, learners: COUNT })),
      curriculum2025: { code: curriculum.code, subjects: selected.length, credits: curriculum.totalCredits,
        changes: ['ITDL → ITCN', 'ITOS → ITFL'] }, courses: outcomes, preservedExistingRows: true }, null, 2));
  } finally {
    db.query = originalQuery;
    db.transaction = originalTransaction;
    if (tx && !finished && !tx.finished) await tx.rollback();
    await app.close();
  }
}
run().catch(error => { console.error(error.original?.message || error.message); process.exitCode = 1; });
