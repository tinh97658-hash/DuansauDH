import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { AppModule } from '../../src/app.module.js';
import { StudyLeaveService } from '../../src/plan/study-leave.service.js';
import { SchedulingService } from '../../src/scheduling/scheduling.service.js';
import { ExamGradebookService } from '../../src/masters/exam-gradebook.service.js';
import { ClassScoreSummaryService } from '../../src/reports/class-score-summary.service.js';
import { PlanService } from '../../src/plan/plan.service.js';
import { businessDate } from '../../src/plan/study-leave-policy.js';
import { Discipline } from '../../src/database/models/common/discipline.model.js';
import { Major } from '../../src/database/models/common/major.model.js';
import { Subject } from '../../src/database/models/plan/subject.model.js';
import { Curriculum } from '../../src/database/models/plan/curriculum.model.js';
import { CurriculumBlock } from '../../src/database/models/plan/curriculum-block.model.js';
import { CurriculumSubject } from '../../src/database/models/plan/curriculum-subject.model.js';
import { AdmissionRecord } from '../../src/database/models/plan/admission-record.model.js';
import { ClassGroup } from '../../src/database/models/training/class-group.model.js';
import { ClassGroupMember } from '../../src/database/models/training/class-group-member.model.js';
import { CourseOffering } from '../../src/database/models/training/course-offering.model.js';
import { CourseOfferingClassGroup } from '../../src/database/models/training/course-offering-class-group.model.js';
import { CourseExamGradebook } from '../../src/database/models/training/course-exam-gradebook.model.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { SubjectRecognitionService } from '../../src/plan/subject-recognition.service.js';
import { LearnerSubjectResult } from '../../src/database/models/training/learner-subject-result.model.js';
import { TeachingSession } from '../../src/database/models/training/teaching-session.model.js';
import { Lecturer } from '../../src/database/models/common/lecturer.model.js';
import { Room } from '../../src/database/models/common/room.model.js';
import { up as backfillFailures, down as undoBackfillFailures } from '../../src/database/migrations/059-study-leave-scheduled-attempts.js';
import { up as backfillEnrolledFailures, down as undoEnrolledFailures } from '../../src/database/migrations/061-study-leave-enrolled-attempts.js';

const describeDb = process.env.RUN_POSTGRES_SCHEDULING_TESTS === 'true' ? describe : describe.skip;
const dateAfter = (days: number) => businessDate(new Date(Date.now() + days * 86400000));

describeDb('Study leave lifecycle with real PostgreSQL and merged classes', () => {
  let app: INestApplicationContext; let db: Sequelize; let tx: Transaction;
  let leaves: StudyLeaveService; let scheduling: SchedulingService; let exams: ExamGradebookService;
  let learner: AdmissionRecord; let other: AdmissionRecord; let group: ClassGroup; let major: Major;
  let subjects: Subject[]; let offerings: CourseOffering[]; let actor: Staff;
  const prefix = `BL${randomUUID().replace(/-/g, '').slice(0, 9)}`;
  const participant = () => `admission:${learner.id}`;
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = app.get<Sequelize>(getConnectionToken()); leaves = app.get(StudyLeaveService);
    scheduling = app.get(SchedulingService); exams = app.get(ExamGradebookService);
    tx = await db.transaction();
    const query = db.query.bind(db);
    jest.spyOn(db, 'query').mockImplementation(((sql: any, options: any) => query(sql, { ...options, transaction: tx, logging: false })
      .catch((error: any) => { throw new Error(error.original?.message || error.message); })) as any);
    jest.spyOn(db, 'transaction').mockImplementation((async (callback: any) => callback(tx)) as any);
    actor = await Staff.create({ name: prefix, email: `${prefix}@example.invalid`.toLowerCase(), role: 'admin' });
    const discipline = await Discipline.create({ code: prefix, name: prefix, active: true });
    major = await Major.create({ code: prefix, name: prefix, disciplineId: discipline.id, program: 'masters', active: true });
    const curriculum = await Curriculum.create({ code: prefix, name: prefix, majorId: major.id, program: 'masters', applicableFromYear: '2026' });
    const block = await CurriculumBlock.create({ curriculumId: curriculum.id, code: 'KC', name: 'General' });
    group = await ClassGroup.create({ code: prefix, name: prefix, majorId: major.id, program: 'masters', academicYear: '2026', curriculumId: curriculum.id });
    learner = await AdmissionRecord.create({ code: `${prefix}A`, fullName: `${prefix} A`, email: `${prefix}a@example.invalid`, majorId: major.id,
      trainingLevel: 'Thạc sĩ', academicYear: '2026', status: 'approved', studyStatus: 'Đang học' });
    other = await AdmissionRecord.create({ code: `${prefix}B`, fullName: `${prefix} B`, email: `${prefix}b@example.invalid`, majorId: major.id,
      trainingLevel: 'Thạc sĩ', academicYear: '2026', status: 'approved', studyStatus: 'Đang học' });
    await ClassGroupMember.bulkCreate([learner, other].map(person => ({ admissionRecordId: person.id, classGroupId: group.id })));
    subjects = []; offerings = [];
    for (let index = 0; index < 4; index++) {
      const subject = await Subject.create({ code: `${prefix}${index}`, codeText: `${prefix}${index}`, codeNumber: index + 1,
        name: `${prefix} Môn ${index + 1}`, majorId: major.id, program: 'masters', credits: 2, active: true });
      subjects.push(subject);
      await CurriculumSubject.create({ curriculumId: curriculum.id, blockId: block.id, subjectId: subject.id });
      if (index === 3) continue;
      const offering = await CourseOffering.create({ name: `${prefix} Lớp ${index + 1}`, subjectId: subject.id,
        ...(index === 0 ? { status: 'completed', completedAt: new Date(Date.now() - 86400000), completedByStaffId: actor.id } : { status: 'active' }) });
      offerings.push(offering);
      await CourseOfferingClassGroup.create({ courseOfferingId: offering.id, classGroupId: group.id });
      if (index < 2) await CourseExamGradebook.create({ classGroupId: group.id, courseOfferingId: offering.id, grades: [
        { participantId: participant(), testScore: 7, assignmentScore: 8, examScore: index === 0 ? 8 : null,
          courseScore: index === 0 ? 8 : null, result: index === 0 ? 'passed' : 'pending' },
      ] });
    }
  });
  afterEach(async () => { jest.restoreAllMocks(); try { await tx?.rollback(); } finally { await app?.close(); } });
  const request = async (startDate = businessDate(), endDate = dateAfter(60)) => {
    const data = await leaves.request(learner.id, { reason: 'Lý do bảo lưu', startDate, endDate }, actor);
    return data.leaves[0];
  };
  const approve = async () => { const leave = await request(); await leaves.action(leave.id, { action: 'approve' }, actor); return leave; };

  it('keeps pending learners in class, withdraws only unfinished offerings on approval, preserves grades and administrative membership', async () => {
    const leave = await request();
    expect((await scheduling.getCourseOfferingRoster(offerings[1].id)).participantCount).toBe(2);
    const data = await leaves.action(leave.id, { action: 'approve' }, actor);
    expect(data.leaves[0]).toMatchObject({ effectiveStatus: 'active', withdrawals: expect.any(Array) });
    expect(data.leaves[0].withdrawals).toHaveLength(2);
    expect(data.leaves[0].withdrawals.find(row => row.snapshot.subjectId === subjects[1].id)?.snapshot.grades[0]).toMatchObject({ testScore: 7, assignmentScore: 8 });
    await learner.reload(); expect(learner.studyStatus).toBe('Đang bảo lưu');
    expect((await ClassGroupMember.findOne({ where: { admissionRecordId: learner.id } }))!.classGroupId).toBe(group.id);
    expect((await scheduling.getCourseOfferingRoster(offerings[1].id)).participants.map(row => row.id)).toEqual([`admission:${other.id}`]);
    expect((await scheduling.getCourseOfferingRoster(offerings[0].id)).participantCount).toBe(2);
    const exam = await exams.get({ classGroupId: group.id, courseOfferingId: offerings[1].id, rosterScope: 'offering' });
    expect(exam.rows).toHaveLength(2);
    expect(exam.rows.find((row: any) => row.participantId === participant())).toMatchObject({
      studyLeaveFailure: true, result: 'failed', eligible: false, testScore: 7, assignmentScore: 8, courseScore: null, grade4: null });
    expect((await exams.get({ classGroupId: group.id, courseOfferingId: offerings[2].id })).rows.map((row: any) => row.participantId))
      .toEqual(expect.arrayContaining([participant(), `admission:${other.id}`]));
    expect((await exams.get({ classGroupId: group.id, courseOfferingId: offerings[1].id, mode: 'exam', includeIds: participant() })).rows)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ participantId: participant() })]));
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: offerings[1].id } });
    expect(book!.grades[0]).toMatchObject({ testScore: 7, assignmentScore: 8 });
    const report = await app.get(ClassScoreSummaryService).learnerScorecard(learner.id, group.id);
    expect(report.subjects.find(row => row.id === subjects[0].id)?.grade).toMatchObject({ score: 7.8, result: 'passed' });
    expect(report.subjects.find(row => row.id === subjects[1].id)?.grade).toMatchObject({ score: null, result: 'failed', studyLeaveFailure: true });
    expect(report.subjects.find(row => row.id === subjects[2].id)?.grade).toMatchObject({ score: null, result: 'failed', studyLeaveFailure: true });
    const learning = app.get(SubjectRecognitionService);
    expect(await learning.listStudiedSubjects(learner.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: expect.objectContaining({ id: subjects[1].id }), result: 'failed', studyLeaveFailure: true }),
    ]));
    await LearnerSubjectResult.create({ admissionRecordId: learner.id, subjectId: subjects[1].id,
      courseOfferingId: offerings[1].id, sourceType: 'regular', status: 'studying', result: 'pending' });
    expect(await learning.listLearningResults(learner.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectId: subjects[1].id, status: 'completed', result: 'failed', studyLeaveFailure: true, score: null }),
    ]));
    const learners = await app.get(PlanService).listAdmissionRecords(undefined, 'Thạc sĩ', undefined, undefined, undefined, prefix, '1', '20', undefined, true, 'learners');
    expect(learners.data.some((row: any) => row.id === learner.id)).toBe(true);
  });

  it('returns to a waiting group while the former class is active and starts a separate empty gradebook', async () => {
    const leave = await approve();
    let candidates = await scheduling.listCourseOfferingCandidates({ program: 'masters', majorId: major.id, academicYear: '2026' });
    expect(candidates.subjects.find(row => row.subject.id === subjects[1].id)?.retakeClassGroups || []).toHaveLength(0);
    // A different subject opened during leave must not silently enroll the learner after resumption.
    const duringLeave = await scheduling.createCourseOffering({ subjectId: subjects[3].id, classGroupIds: [group.id], academicYear: '2026' });
    await leaves.action(leave.id, { action: 'resume', note: 'Quyết định tiếp nhận học lại' }, actor);
    expect((await scheduling.getCourseOfferingRoster(duringLeave.id)).participants.map(row => row.id)).toEqual([`admission:${other.id}`]);
    expect((await scheduling.getCourseOfferingRoster(offerings[1].id)).participants.map(row => row.id)).toEqual([`admission:${other.id}`]);
    candidates = await scheduling.listCourseOfferingCandidates({ program: 'masters', majorId: major.id, academicYear: '2026' });
    expect(candidates.subjects.find(row => row.subject.id === subjects[1].id)?.retakeClassGroups).toMatchObject([{ id: group.id, returningCount: 1, memberCount: 1 }]);
    expect(candidates.subjects.find(row => row.subject.id === subjects[3].id)?.retakeClassGroups).toMatchObject([{ id: group.id, returningCount: 1, memberCount: 1 }]);
    const newClass = await scheduling.createCourseOffering({ subjectId: subjects[1].id, classGroupIds: [group.id], retakeClassGroupIds: [group.id], academicYear: '2026' });
    expect((await scheduling.getCourseOfferingRoster(newClass.id)).participants.map(row => row.id)).toEqual([participant()]);
    const exam = await exams.get({ classGroupId: group.id, courseOfferingId: newClass.id, rosterScope: 'offering' });
    expect(exam.rows).toMatchObject([{ participantId: participant(), testScore: null, assignmentScore: null, examScore: null }]);
    expect(exam.rows[0].studyLeaveFailure).not.toBe(true);
    const previous = await exams.get({ classGroupId: group.id, courseOfferingId: offerings[1].id, search: learner.code! });
    expect(previous.rows).toMatchObject([{ participantId: participant(), studyLeaveFailure: true, result: 'failed' }]);
    await CourseExamGradebook.create({ classGroupId: group.id, courseOfferingId: newClass.id, grades: [
      { participantId: participant(), testScore: 8, assignmentScore: 8, examScore: 8, result: 'passed' },
    ] });
    const newReport = await app.get(ClassScoreSummaryService).learnerScorecard(learner.id, group.id);
    expect(newReport.subjects.find(row => row.id === subjects[1].id)?.grade).toMatchObject({ score: 8, result: 'passed' });
    expect(newReport.subjects.find(row => row.id === subjects[1].id)?.grade?.studyLeaveFailure).not.toBe(true);
    candidates = await scheduling.listCourseOfferingCandidates({ program: 'masters', majorId: major.id, academicYear: '2026' });
    expect(candidates.subjects.find(row => row.subject.id === subjects[1].id)?.retakeClassGroups || []).toHaveLength(0);
  });

  it.each([
    { result: 'passed', testScore: 7, examScore: 8 },
    { result: 'failed', testScore: 7, examScore: 2 },
    { result: 'failed', testScore: 0, examScore: null },
  ])('retains a $result learner in a class completed earlier on the approval day, with their original scores', async outcome => {
    await offerings[0].update({ completedAt: new Date() });
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: offerings[0].id } });
    const grade = { ...book!.grades[0], testScore: outcome.testScore, examScore: outcome.examScore, result: outcome.result };
    await book!.update({ grades: [grade] });
    // Historical single-stage marks are preserved by migration, not converted into new component drafts.
    await db.query(`INSERT INTO course_exam_workflows(course_offering_id,mode) VALUES(:id,'legacy_preserved') ON CONFLICT(course_offering_id) DO UPDATE SET mode='legacy_preserved'`,{replacements:{id:offerings[0].id}});
    const baseQuery = { classGroupId: group.id, courseOfferingId: offerings[0].id, search: learner.code! };
    const before = await exams.get({ ...baseQuery, rosterScope: 'offering' });
    expect(before.rows[0].result).toBe(outcome.result);
    const originalGrade = { testScore: before.rows[0].testScore, assignmentScore: before.rows[0].assignmentScore,
      examScore: before.rows[0].examScore, courseScore: before.rows[0].courseScore, result: before.rows[0].result };
    const leave = await approve();
    const history = (await leaves.detail(learner.id)).leaves.find(row => row.id === leave.id)!;
    expect(history.withdrawals.some(row => row.snapshot.courseOfferingId === offerings[0].id)).toBe(false);
    for (const rosterScope of [undefined, 'offering']) {
      const data = await exams.get({ ...baseQuery, rosterScope });
      expect(data.total).toBe(1);
      expect(data.rows).toMatchObject([{ participantId: participant(), studyStatus: 'Đang bảo lưu', ...originalGrade }]);
      const exam = await exams.get({ ...baseQuery, rosterScope, mode: 'exam' });
      expect(exam.total).toBe(before.rows[0].eligible ? 1 : 0);
    }
    await book!.reload(); expect(book!.grades).toEqual([grade]);
    expect((await scheduling.getCourseOfferingRoster(offerings[0].id)).participants.some(row => row.id === participant())).toBe(true);
    expect((await scheduling.getCourseOfferingRoster(offerings[1].id)).participants.some(row => row.id === participant())).toBe(false);
  });

  it('keeps an interrupted failure read-only when the former merged class is completed later', async () => {
    await approve();
    await offerings[1].update({ status: 'completed', completedAt: new Date(), completedByStaffId: actor.id });
    for (const rosterScope of [undefined, 'offering']) {
      const query = { classGroupId: group.id, courseOfferingId: offerings[1].id, rosterScope };
      const data = await exams.get(query);
      expect(data.rows.find((row: any) => row.participantId === participant())).toMatchObject({ result: 'failed', studyLeaveFailure: true });
      await expect(exams.save({ ...query, revision: data.revision, rows: [{ participantId: participant(), testScore: 8 }] } as any,actor))
        .rejects.toThrow('Trạng thái đặc biệt');
    }
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: offerings[1].id } });
    expect(book!.grades[0]).toMatchObject({ participantId: participant(), testScore: 7 });
  });

  it.each([
    { status: 'planned', days: -1 }, { status: 'held', days: -1 }, { status: 'not_held', days: -1 },
    { status: 'planned', days: 7 }, { status: 'not_held', days: 7 },
  ] as const)('fails a course scheduled while pending ($status, day $days), regardless of occurrence or marks', async ({ status, days }) => {
    const leave = await request();
    const lecturer = await Lecturer.create({ code: prefix, name: prefix });
    const room = await Room.create({ code: prefix, name: prefix });
    await TeachingSession.create({ courseOfferingId: offerings[2].id, sessionDate: dateAfter(days),
      startTime: '07:00', endTime: '09:00', period: 'MORNING', status, lecturerId: lecturer.id, roomId: room.id,
      ...(status !== 'planned' ? { confirmedAt: new Date(), confirmedByStaffId: actor.id } : {}) });
    expect((await scheduling.getCourseOfferingRoster(offerings[2].id)).participants.some(row => row.id === participant())).toBe(true);
    expect((await exams.get({ classGroupId: group.id, courseOfferingId: offerings[2].id, search: learner.code! })).rows[0].result).toBe('pending');
    await leaves.action(leave.id, { action: 'approve' }, actor);
    const query = { classGroupId: group.id, courseOfferingId: offerings[2].id, search: learner.code! };
    const exam = await exams.get(query);
    expect(exam.rows).toMatchObject([{ participantId: participant(), result: 'failed', studyLeaveFailure: true,
      testScore: null, assignmentScore: null, examScore: null, courseScore: null }]);
    // Existing withdrawals made before this rule are repaired without touching marks.
    await db.query(`UPDATE course_offering_withdrawals SET snapshot = snapshot || '{"phase":"not_started"}'::jsonb
      WHERE admission_record_id = :id AND course_offering_id = :offering`, { replacements: { id: learner.id, offering: offerings[2].id } });
    await backfillFailures({ context: { sequelize: db } });
    expect((await exams.get(query)).rows).toMatchObject([{ studyLeaveFailure: true, result: 'failed', courseScore: null }]);
    const report = await app.get(ClassScoreSummaryService).learnerScorecard(learner.id, group.id);
    expect(report.subjects.find(row => row.id === subjects[2].id)?.grade).toMatchObject({ result: 'failed', studyLeaveFailure: true });
    await undoBackfillFailures({ context: { sequelize: db } });
    expect((await exams.get(query)).rows).toHaveLength(0);
  });

  it('fails unscheduled enrolled courses immediately even for a future leave start date without repeating withdrawal', async () => {
    const leave = await request(dateAfter(5), dateAfter(60));
    await leaves.action(leave.id, { action: 'approve' }, actor);
    const approved = (await leaves.detail(learner.id)).leaves[0];
    expect(approved.effectiveStatus).toBe('scheduled');
    expect(approved.withdrawals).toHaveLength(2);
    expect(approved.withdrawals.find(row => row.snapshot.courseOfferingId === offerings[2].id)?.snapshot)
      .toMatchObject({ phase: 'studying', result: 'failed', studyLeaveFailure: true });
    expect((await scheduling.getCourseOfferingRoster(offerings[2].id)).participants.map(row => row.id)).toEqual([`admission:${other.id}`]);
    expect((await exams.get({ classGroupId: group.id, courseOfferingId: offerings[2].id, search: learner.code! })).rows)
      .toMatchObject([{ participantId: participant(), result: 'failed', studyLeaveFailure: true, courseScore: null }]);
    const newClass = await scheduling.createCourseOffering({ subjectId: subjects[3].id, classGroupIds: [group.id], academicYear: '2026' });
    expect((await scheduling.getCourseOfferingRoster(newClass.id)).participants.map(row => row.id)).toEqual([`admission:${other.id}`]);
    await leaves.synchronize(); await leaves.synchronize();
    expect((await leaves.detail(learner.id)).leaves[0].history.filter((event: any) => event.action === 'roster_withdrawn')).toHaveLength(1);
    await learner.reload(); expect(learner.studyStatus).toBe('Đang học');
    await db.query('UPDATE study_leaves SET start_date = :start WHERE id = :id', { replacements: { id: leave.id, start: dateAfter(-1) } });
    await offerings[1].update({ status: 'completed', completedAt: new Date(), completedByStaffId: actor.id });
    await leaves.synchronize(); await leaves.synchronize();
    const updated = (await leaves.detail(learner.id)).leaves[0];
    expect(updated.effectiveStatus).toBe('active');
    expect(updated.withdrawals.filter(row => row.snapshot.courseOfferingId === offerings[1].id)).toHaveLength(1);
    expect(updated.history.filter((event: any) => event.action === 'activated')).toHaveLength(1);
  });

  it('keeps the failure recorded on approval when its former class is scheduled later', async () => {
    const leave = await approve();
    const lecturer = await Lecturer.create({ code: prefix, name: prefix });
    const room = await Room.create({ code: prefix, name: prefix });
    await TeachingSession.create({ courseOfferingId: offerings[2].id, sessionDate: dateAfter(7), startTime: '07:00',
      endTime: '09:00', period: 'MORNING', status: 'planned', lecturerId: lecturer.id, roomId: room.id,
      createdAt: new Date(Date.now() + 60000) });
    await backfillFailures({ context: { sequelize: db } });
    await leaves.synchronize();
    const detail = (await leaves.detail(learner.id)).leaves.find(row => row.id === leave.id)!;
    expect(detail.withdrawals.find(row => row.snapshot.courseOfferingId === offerings[2].id)?.snapshot.phase).toBe('studying');
    const report = await app.get(ClassScoreSummaryService).learnerScorecard(learner.id, group.id);
    expect(report.subjects.find(row => row.id === subjects[2].id)?.grade).toMatchObject({ result: 'failed', studyLeaveFailure: true });
  });

  it('backfills unscheduled enrolled withdrawals while excluding classes opened during leave and supports rollback', async () => {
    await approve();
    const duringLeave = await scheduling.createCourseOffering({ subjectId: subjects[3].id, classGroupIds: [group.id], academicYear: '2026' });
    await db.query(`UPDATE course_offering_withdrawals
      SET snapshot = (snapshot - 'result' - 'studyLeaveFailure') || '{"phase":"not_started"}'::jsonb
      WHERE admission_record_id = :id AND course_offering_id = :offering`,
    { replacements: { id: learner.id, offering: offerings[2].id } });
    const query = { classGroupId: group.id, courseOfferingId: offerings[2].id, search: learner.code! };
    expect((await exams.get(query)).rows).toHaveLength(0);
    await backfillEnrolledFailures({ context: { sequelize: db } });
    await backfillEnrolledFailures({ context: { sequelize: db } });
    expect((await exams.get(query)).rows).toMatchObject([{ participantId: participant(), result: 'failed',
      studyLeaveFailure: true, testScore: null, assignmentScore: null, examScore: null, courseScore: null }]);
    expect((await exams.get({ ...query, courseOfferingId: duringLeave.id })).rows).toHaveLength(0);
    await undoEnrolledFailures({ context: { sequelize: db } });
    expect((await exams.get(query)).rows).toHaveLength(0);
  });

  it('marks overdue without returning or withdrawing, leaves extensions pending until approved, and supports rejection', async () => {
    const leave = await approve();
    await db.query('UPDATE study_leaves SET start_date = :start, end_date = :end WHERE id = :id', {
      replacements: { id: leave.id, start: dateAfter(-60), end: dateAfter(-1) },
    });
    await leaves.synchronize(); await learner.reload(); expect(learner.studyStatus).toBe('Bảo lưu quá hạn');
    const overdue = await leaves.list({ status: 'overdue', search: prefix });
    expect(overdue.rows).toMatchObject([{ admissionRecordId: learner.id, overdueDays: 1 }]);
    await leaves.action(leave.id, { action: 'request_extension', endDate: dateAfter(20), note: 'Xin thêm thời gian' }, actor);
    expect((await leaves.list({ status: 'extension_pending', search: prefix })).total).toBe(1);
    await learner.reload(); expect(learner.studyStatus).toBe('Bảo lưu quá hạn');
    await leaves.action(leave.id, { action: 'reject_extension', note: 'Chưa đủ điều kiện' }, actor);
    expect((await leaves.detail(learner.id)).leaves[0].endDate).toBe(dateAfter(-1));
    await leaves.action(leave.id, { action: 'request_extension', endDate: dateAfter(20), note: 'Bổ sung hồ sơ' }, actor);
    await leaves.action(leave.id, { action: 'approve_extension', note: 'Quyết định gia hạn' }, actor);
    await learner.reload(); expect(learner.studyStatus).toBe('Đang bảo lưu');
    expect((await leaves.list({ status: 'expiring', search: prefix })).total).toBe(1);
    const detail = (await leaves.detail(learner.id)).leaves[0];
    expect(detail.extensions.map((item: any) => item.status)).toEqual(['rejected', 'approved']);
    expect(detail.endDate).toBe(dateAfter(20));
    expect(detail.withdrawals).toHaveLength(2);
  });

  it('requires an explicit decision for stopping, rejects repeat decisions, and keeps history', async () => {
    const leave = await approve();
    await leaves.action(leave.id, { action: 'request_extension', endDate: dateAfter(90), note: 'Xin gia hạn' }, actor);
    await expect(leaves.action(leave.id, { action: 'withdraw' }, actor)).rejects.toThrow('lý do');
    await leaves.action(leave.id, { action: 'withdraw', note: 'Quyết định thôi học số 01' }, actor);
    await learner.reload(); expect(learner.studyStatus).toBe('Thôi học');
    expect((await leaves.detail(learner.id)).leaves[0]).toMatchObject({ status: 'withdrawn', extensions: [{ status: 'cancelled' }], withdrawals: expect.any(Array) });
    await expect(leaves.action(leave.id, { action: 'resume', note: 'Lặp thao tác' }, actor)).rejects.toThrow('đã kết thúc');
    expect(await ClassGroupMember.count({ where: { admissionRecordId: learner.id } })).toBe(1);
  });

  it('rejects invalid dates and duplicates; a rejected request never changes enrollment', async () => {
    await expect(leaves.request(learner.id, { reason: 'Lý do', startDate: businessDate(), endDate: '2027-02-30' }, actor)).rejects.toThrow('không hợp lệ');
    const leave = await request();
    await expect(request()).rejects.toThrow('chưa kết thúc');
    await leaves.action(leave.id, { action: 'reject', note: 'Không phê duyệt' }, actor);
    await learner.reload(); expect(learner.studyStatus).toBe('Đang học');
    expect((await leaves.detail(learner.id)).leaves[0].withdrawals).toHaveLength(0);
    expect((await scheduling.getCourseOfferingRoster(offerings[1].id)).participantCount).toBe(2);
  });
});
