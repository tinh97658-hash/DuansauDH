import { randomUUID } from "node:crypto";
import { jest } from "@jest/globals";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
import type { Transaction } from "sequelize";
import { AppModule } from "../../src/app.module.js";
import { SchedulingService } from "../../src/scheduling/scheduling.service.js";
import { ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";
import { Discipline } from "../../src/database/models/common/discipline.model.js";
import { Major } from "../../src/database/models/common/major.model.js";
import { Subject } from "../../src/database/models/plan/subject.model.js";
import { Curriculum } from "../../src/database/models/plan/curriculum.model.js";
import { CurriculumBlock } from "../../src/database/models/plan/curriculum-block.model.js";
import { CurriculumSubject } from "../../src/database/models/plan/curriculum-subject.model.js";
import { AdmissionRecord } from "../../src/database/models/plan/admission-record.model.js";
import { ClassGroup } from "../../src/database/models/training/class-group.model.js";
import { ClassGroupMember } from "../../src/database/models/training/class-group-member.model.js";
import { CourseOffering } from "../../src/database/models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "../../src/database/models/training/course-offering-class-group.model.js";
import { CourseExamGradebook } from "../../src/database/models/training/course-exam-gradebook.model.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { SubjectRecognition } from "../../src/database/models/training/subject-recognition.model.js";

const describeDb = process.env.RUN_POSTGRES_SCHEDULING_TESTS === "true" ? describe : describe.skip;
// Every read and write uses one rolled-back transaction, including service-created transactions.
describeDb("Retake groups across scheduling and exam rosters", () => {
  let app: INestApplicationContext;
  let db: Sequelize;
  let tx: Transaction;
  let scheduling: SchedulingService;
  let exams: ExamGradebookService;
  let source: CourseOffering;
  let subject: Subject;
  let major: Major;
  let original: ClassGroup;
  let next: ClassGroup;
  let learners: AdmissionRecord[];
  let staff: Staff;
  const prefix = `RT${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = app.get<Sequelize>(getConnectionToken());
    scheduling = app.get(SchedulingService);
    exams = app.get(ExamGradebookService);
    tx = await db.transaction();
    const query = db.query.bind(db);
    jest.spyOn(db, "query").mockImplementation(((sql: any, options: any) => query(sql, { ...options, transaction: tx, logging: false })
      .catch((error: any) => { throw new Error(error.original?.message || error.message); })) as any);
    jest.spyOn(db, "transaction").mockImplementation((async (callback: any) => callback(tx)) as any);
    staff = await Staff.create({ name: prefix, email: `${prefix}@example.invalid`.toLowerCase(), role: "admin" });
    const discipline = await Discipline.create({ code: prefix, name: prefix, active: true });
    major = await Major.create({ code: prefix, name: prefix, disciplineId: discipline.id, program: "masters", active: true });
    subject = await Subject.create({ code: prefix, codeText: prefix, codeNumber: 1, name: `${prefix} English`, majorId: major.id, program: "masters", credits: 2, active: true });
    const curriculum = await Curriculum.create({ code: prefix, name: prefix, majorId: major.id, program: "masters", applicableFromYear: "2026" });
    const block = await CurriculumBlock.create({ curriculumId: curriculum.id, code: "KC", name: "General" });
    await CurriculumSubject.create({ curriculumId: curriculum.id, blockId: block.id, subjectId: subject.id });
    original = await ClassGroup.create({ code: `${prefix}A`, name: `${prefix} Original`, majorId: major.id, program: "masters", academicYear: "2026", curriculumId: curriculum.id });
    next = await ClassGroup.create({ code: `${prefix}B`, name: `${prefix} Next`, majorId: major.id, program: "masters", academicYear: "2026", curriculumId: curriculum.id });
    learners = [];
    for (const name of ["Passed", "Failed", "Pending", "New"]) learners.push(await AdmissionRecord.create({
      code: `${prefix}${name}`, email: `${prefix}${name}@example.invalid`, fullName: name, majorId: major.id,
      trainingLevel: "Thạc sĩ", academicYear: "2026", status: "approved", studyStatus: "Đang học",
    }));
    await ClassGroupMember.bulkCreate(learners.map((learner, index) => ({ admissionRecordId: learner.id, classGroupId: index === 3 ? next.id : original.id })));
    source = await CourseOffering.create({ subjectId: subject.id, status: "completed", completedAt: new Date(), completedByStaffId: staff.id });
    await CourseOfferingClassGroup.create({ courseOfferingId: source.id, classGroupId: original.id });
    await CourseExamGradebook.create({ classGroupId: original.id, courseOfferingId: source.id, revision: 1,
      grades: learners.slice(0, 3).map((learner, index) => ({ participantId: `admission:${learner.id}`,
        result: ["passed", "failed", "pending"][index], courseScore: [8, 3.5, null][index] })) });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    try { await tx?.rollback(); } finally { await app?.close(); }
  });

  it("offers only failures from a closed class, merges the group, and preserves old grades and administrative membership", async () => {
    const candidates = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    const candidate = candidates.subjects.find(row => row.subject.id === subject.id)!;
    expect(candidate.retakeClassGroups).toMatchObject([{ id: original.id, isRetake: true, memberCount: 1 }]);
    const dto = { subjectId: subject.id, classGroupIds: [original.id, next.id], retakeClassGroupIds: [original.id], majorId: major.id, academicYear: "2026" };
    const preview = await scheduling.previewCourseOfferingRoster(dto);
    const expectedIds = [`admission:${learners[1].id}`, `admission:${learners[3].id}`].sort();
    expect(preview.participants.map(row => row.id).sort()).toEqual(expectedIds);
    const offering = await scheduling.createCourseOffering(dto);
    expect(offering.participantCount).toBe(2);
    expect(offering.groupLinks.find(link => link.classGroupId === original.id)?.participantIds).toEqual([`admission:${learners[1].id}`]);
    expect((await scheduling.getCourseOfferingRoster(offering.id)).participants.map(row => row.id).sort()).toEqual(expectedIds);
    const exam = await exams.get({ classGroupId: original.id, courseOfferingId: offering.id, rosterScope: "offering" });
    expect(exam.rows.map((row: any) => row.participantId).sort()).toEqual(expectedIds);
    for (const rosterScope of [undefined, "offering"]) {
      await expect(exams.save({ classGroupId: original.id, courseOfferingId: offering.id, rosterScope, revision: 0,
        rows: [{ participantId: `admission:${learners[0].id}` }] } as any)).rejects.toThrow("hoàn thành giảng dạy");
    }
    await expect(scheduling.createCourseOffering(dto)).rejects.toThrow("đang hoạt động");
    const afterAssignment = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    expect(afterAssignment.subjects.find(row => row.subject.id === subject.id)?.retakeClassGroups || []).toHaveLength(0);
    const oldBook = await CourseExamGradebook.findOne({ where: { courseOfferingId: source.id } });
    expect(oldBook!.grades[1]).toMatchObject({ courseScore: 3.5, result: "failed" });
    expect((await ClassGroupMember.findOne({ where: { admissionRecordId: learners[1].id } }))!.classGroupId).toBe(original.id);
    // Completing teaching without a new grade must not resurrect the old failure.
    await offering.update({ status: "completed", completedAt: new Date(), completedByStaffId: staff.id });
    const waitingForGrades = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    expect(waitingForGrades.subjects.find(row => row.subject.id === subject.id)?.retakeClassGroups || []).toHaveLength(0);
    // Passing the next completed attempt removes the learner from future retake groups.
    await CourseExamGradebook.create({ courseOfferingId: offering.id, classGroupId: original.id, revision: 1,
      updatedAt: new Date(Date.now() + 1000), grades: [{ participantId: expectedIds.find(id => id.endsWith(learners[1].id)), courseScore: 8, result: "passed" }] });
    const passed = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    expect(passed.subjects.find(row => row.subject.id === subject.id)?.retakeClassGroups || []).toHaveLength(0);
  });

  it("revalidates the failed group when results change between preview and creation", async () => {
    const dto = { subjectId: subject.id, classGroupIds: [original.id], retakeClassGroupIds: [original.id], academicYear: "2026" };
    expect((await scheduling.previewCourseOfferingRoster(dto)).participantCount).toBe(1);
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: source.id } });
    await book!.update({ grades: book!.grades.map(grade => ({ ...grade, result: "passed", courseScore: 8 })) });
    await expect(scheduling.createCourseOffering(dto)).rejects.toThrow("không còn học viên");
    expect(await CourseOffering.count({ where: { subjectId: subject.id } })).toBe(1);
  });

  it("reflects each saved exam edit immediately in class reports, individual scorecards and studied subjects", async () => {
    const reports = app.get(ClassScoreSummaryService);
    const learning = app.get(SubjectRecognitionService);
    const participantId = `admission:${learners[2].id}`;
    const scope = { classGroupId: original.id, courseOfferingId: source.id, rosterScope: "offering" as const };
    for (const scores of [
      { testScore: 10, assignmentScore: 10, examScore: 10, examExempt: false },
      { testScore: 0, assignmentScore: 0, examScore: null, examExempt: false },
      { testScore: null, assignmentScore: null, examScore: null, examExempt: true },
      { testScore: 10, assignmentScore: 10, examScore: null, examExempt: false },
    ]) {
      const before = await exams.get(scope);
      const saved = await exams.save({ ...scope, revision: before.revision, rows: [
        { participantId, ...scores, letterGrade: "", attemptScores: [], result: "pending" },
      ] });
      const grade = saved.rows.find((row: any) => row.participantId === participantId)!;
      const report = await reports.get({ classGroupId: original.id }, true);
      const summary = report.rows.find(row => row.participantId === participantId)!.scores[subject.id];
      const card = await reports.learnerScorecard(learners[2].id, original.id);
      const personal = card.subjects.find(row => row.id === subject.id)!.grade!;
      expect(summary).toMatchObject({ score: grade.courseScore, result: grade.result });
      expect(personal).toMatchObject({ score: grade.courseScore, result: grade.result,
        details: { testScore: grade.testScore, assignmentScore: grade.assignmentScore,
          courseScore: grade.courseScore, grade4: grade.grade4, letterGrade: grade.letterGrade } });
      await learning.syncRegularResults(learners[2].id, tx);
      const learningResults = await learning.listLearningResults(learners[2].id);
      expect(learningResults).toMatchObject([{ result: grade.result, score: grade.courseScore }]);
      const studied = await learning.listStudiedSubjects(learners[2].id);
      if (grade.result === "pending") expect(studied).toEqual([]);
      else expect(studied).toMatchObject([{ result: grade.result, subject: { id: subject.id } }]);
      expect(await learning.recognizedCredits(learners[2].id)).toBe(["passed", "exempt"].includes(grade.result) ? subject.credits : 0);
    }
  });

  it("maps profile language exemptions to all grade views, credits and retakes while preserving original marks", async () => {
    await subject.update({ name: "Tiếng Anh" });
    for (const learner of learners.slice(1)) await learner.update({ isExemptForeignLanguage: true });
    const reports = app.get(ClassScoreSummaryService);
    const learning = app.get(SubjectRecognitionService);
    const participantId = `admission:${learners[1].id}`;
    const scope = { classGroupId: original.id, courseOfferingId: source.id };
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: source.id } });
    const originalGrades = structuredClone(book!.grades);
    for (const rosterScope of ["group", "offering"] as const) {
      const gradebook = await exams.get({ ...scope, rosterScope });
      expect(gradebook.rows.find((row: any) => row.participantId === participantId)).toMatchObject({
        examExempt: true, profileForeignLanguageExempt: true, result: "passed",
        courseScore: null, examScore: null, grade4: null, letterGrade: "", attemptScores: [],
      });
      const examList = await exams.get({ ...scope, rosterScope, mode: "exam", includeIds: participantId });
      expect(examList.rows.some((row: any) => row.participantId === participantId)).toBe(false);
      await expect(exams.save({ ...scope, rosterScope, revision: gradebook.revision,
        rows: [{ participantId, testScore: 0, assignmentScore: 0, examScore: 0, examExempt: false }],
      } as any)).rejects.toThrow("miễn thi ngoại ngữ theo hồ sơ");
    }
    for (const learner of learners.slice(1)) {
      const report = await reports.learnerScorecard(learner.id);
      expect(report.subjects.find(row => row.id === subject.id)?.grade).toMatchObject({
        score: null, result: "passed", profileForeignLanguageExempt: true,
        details: { examExempt: true, result: "passed", examScore: null, grade4: null },
      });
      expect(await learning.listStudiedSubjects(learner.id)).toMatchObject([{ result: "passed", profileForeignLanguageExempt: true, subject: { id: subject.id } }]);
      expect(await learning.recognizedCredits(learner.id)).toBe(subject.credits);
    }
    await learning.syncRegularResults(learners[1].id, tx);
    expect(await learning.listLearningResults(learners[1].id)).toMatchObject([{ result: "passed", score: null }]);
    const transcripts = await reports.transcripts(original.id);
    expect(transcripts.scorecards.find(row => row.student.participantId === participantId)?.subjects
      ?.find(row => row.id === subject.id)?.grade).toMatchObject({ result: "passed", details: { examExempt: true } });
    const candidates = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    expect(candidates.subjects.find(row => row.subject.id === subject.id)?.retakeClassGroups || []).toHaveLength(0);
    await book!.reload();
    expect(book!.grades).toEqual(originalGrades);
    // The profile flag must not exempt unrelated courses.
    await subject.update({ name: "Other course" });
    expect((await exams.get(scope)).rows.find((row: any) => row.participantId === participantId))
      .toMatchObject({ examExempt: false, result: "pending" });
    expect(await learning.recognizedCredits(learners[1].id)).toBe(0);
    await subject.update({ name: "Tiếng Anh" });
    await learners[1].update({ isExemptForeignLanguage: false });
    const restored = await reports.learnerScorecard(learners[1].id);
    expect(restored.subjects.find(row => row.id === subject.id)?.grade).toMatchObject({ score: 3.5, result: "failed" });
    expect(await learning.recognizedCredits(learners[1].id)).toBe(0);
  });

  it("rejects grade writes until teaching is confirmed complete without changing existing grades", async () => {
    await source.update({ status: "active", completedAt: null, completedByStaffId: null });
    const scope = { classGroupId: original.id, courseOfferingId: source.id };
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: source.id } });
    const originalGrades = structuredClone(book!.grades);
    for (const rosterScope of ["group", "offering"] as const) {
      const before = await exams.get({ ...scope, rosterScope });
      await expect(exams.save({ ...scope, rosterScope, revision: before.revision, rows: [
        { participantId: `admission:${learners[2].id}`, testScore: 10, assignmentScore: 10, examScore: 10,
          examExempt: false, letterGrade: "", attemptScores: [], result: "pending" },
      ] })).rejects.toMatchObject({ response: { code: "TEACHING_NOT_COMPLETED" } });
    }
    await book!.reload();
    expect(book!.grades).toEqual(originalGrades);
    expect(book!.revision).toBe(1);
  });

  it("groups several failed learners together and excludes approved recognitions", async () => {
    const book = await CourseExamGradebook.findOne({ where: { courseOfferingId: source.id } });
    await book!.update({ grades: book!.grades.map((grade, index) => index === 0 ? { ...grade, result: "failed", courseScore: 0 } : grade) });
    const dto = { subjectId: subject.id, classGroupIds: [original.id], retakeClassGroupIds: [original.id], academicYear: "2026" };
    expect((await scheduling.previewCourseOfferingRoster(dto)).participantCount).toBe(2);
    await SubjectRecognition.create({ admissionRecordId: learners[1].id, sourceSubjectId: subject.id, targetSubjectId: subject.id,
      status: "approved", sourceType: "pre_masters", basis: "canonical_subject", decidedAt: new Date() });
    const preview = await scheduling.previewCourseOfferingRoster(dto);
    expect(preview.participants.map(row => row.id)).toEqual([`admission:${learners[0].id}`]);
    const candidates = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    expect(candidates.subjects.find(row => row.subject.id === subject.id)?.retakeClassGroups).toMatchObject([{ id: original.id, memberCount: 1 }]);
  });

  it("combines one failed learner and one late newcomer without enrolling learners waiting for grades", async () => {
    const late = await AdmissionRecord.create({ code: `${prefix}Late`, fullName: "Late newcomer", email: `${prefix}late@example.invalid`,
      majorId: major.id, trainingLevel: "Thạc sĩ", academicYear: "2026", status: "approved", studyStatus: "Đang học" });
    await ClassGroupMember.create({ admissionRecordId: late.id, classGroupId: original.id, enrolledAt: new Date(Date.now() + 1000) });
    const candidates = await scheduling.listCourseOfferingCandidates({ program: "masters", majorId: major.id, academicYear: "2026" });
    const row = candidates.subjects.find(item => item.subject.id === subject.id)!.retakeClassGroups.find(item => item.id === original.id);
    expect(row).toMatchObject({ memberCount: 2, retakeCount: 1, unstudiedCount: 1 });
    const dto = { subjectId: subject.id, classGroupIds: [original.id], retakeClassGroupIds: [original.id], academicYear: "2026" };
    const preview = await scheduling.previewCourseOfferingRoster(dto);
    const expected = [`admission:${late.id}`, `admission:${learners[1].id}`].sort();
    expect(preview.participants.map(item => item.id).sort()).toEqual(expected);
    const offering = await scheduling.createCourseOffering(dto);
    expect(offering.participantCount).toBe(2);
    expect(offering.groupLinks[0].participantIds!.sort()).toEqual(expected);
    const exam = await exams.get({ classGroupId: original.id, courseOfferingId: offering.id });
    expect(exam.rows.map((item: any) => item.participantId).sort()).toEqual(expected);
  });
});
