import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { Op } from "sequelize";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const buildService = () => {
  const results = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() };
  const recognitions = { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
  const bridgeSubjects = { findByPk: jest.fn() };
  const records = { findByPk: jest.fn() };
  const curriculums = { findByPk: jest.fn(), findOne: jest.fn() };
  const curriculumSubjects = { findAll: jest.fn().mockResolvedValue([]) };
  const subjects = { findByPk: jest.fn() };
  const offerings = { findAll: jest.fn().mockResolvedValue([]) };
  const offeringStudents = { findAll: jest.fn().mockResolvedValue([]) };
  const memberships = { findAll: jest.fn().mockResolvedValue([]) };
  const sequelize = {
    transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)),
    query: jest.fn().mockImplementation(async (sql: string) => sql.includes("SELECT learning.id")
      ? [{ id: "lr-1", result: "passed", score: 8.5 }] : []),
  };
  const service = new SubjectRecognitionService(
    results as never, recognitions as never, bridgeSubjects as never, records as never,
    curriculums as never, curriculumSubjects as never, subjects as never,
    offerings as never, offeringStudents as never, memberships as never,
    sequelize as never,
  );
  return {
    service, results, recognitions, bridgeSubjects, records, curriculums,
    curriculumSubjects, subjects, offerings, offeringStudents, memberships, sequelize,
  };
};

const buildRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "record-1", majorId: "major-1", trainingLevel: "Thạc sĩ", academicYear: "2026",
  studentId: "student-1", update: jest.fn().mockResolvedValue(undefined), ...overrides,
});

const buildCurriculum = () => ({ id: "curriculum-1", majorId: "major-1", program: "masters", applicableFromYear: "2026", totalCredits: 60 });

describe("Studied curriculum subjects", () => {
  it.each(["Thạc sĩ", "Tiến sĩ"])("counts passed, exempt and approved credits once for every %s record", async (trainingLevel) => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord({ trainingLevel }));
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    const subjects = [
      { id: "passed", credits: 3 }, { id: "exempt", credits: 3 }, { id: "recognized", credits: 4 },
      { id: "failed", credits: 5 }, { id: "pending", credits: 2 },
      { id: "alias", canonicalSubjectId: "passed", credits: 3 },
    ];
    mocks.sequelize.query.mockImplementation(async (sql: string) => sql.includes("WITH outcomes AS")
      ? ["passed", "exempt", "failed", "pending", "passed"].map((result, index) => ({
        subject: { id: ["passed", "exempt", "failed", "pending", "alias"][index] }, result }))
      : [{ id: "lr-1", result: "passed", score: 8 }, { id: "lr-2", result: "exempt", score: null }, { id: "lr-3", result: "failed", score: 0 }]);
    mocks.recognitions.findAll.mockResolvedValue([
      { learningResultId: "lr-1", targetSubjectId: "passed", status: "approved" },
      { learningResultId: "lr-2", targetSubjectId: "recognized", status: "approved" },
      { learningResultId: "lr-3", targetSubjectId: "failed", status: "approved" },
    ]);
    mocks.curriculumSubjects.findAll.mockImplementation(async ({ where }: any) => {
      const ids = where.subjectId[Op.in];
      return subjects.filter(subject => ids.includes(subject.id)).map(subject => ({ subjectId: subject.id, subject, credits: 99 }));
    });
    expect(await mocks.service.recognizedCredits("record-1")).toBe(10);
    expect(mocks.curriculums.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ program: trainingLevel === "Tiến sĩ" ? "doctoral" : "masters" }) }));
  });

  it("counts regular pass and exemption without any recognition decisions, using the assigned curriculum", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.memberships.findAll.mockResolvedValue([{ classGroup: { curriculumId: "assigned-curriculum" } }]);
    mocks.curriculums.findByPk.mockResolvedValue({ ...buildCurriculum(), id: "assigned-curriculum" });
    mocks.sequelize.query.mockResolvedValue([
      { subject: { id: "english" }, result: "passed" }, { subject: { id: "philosophy" }, result: "exempt" },
    ]);
    mocks.curriculumSubjects.findAll.mockResolvedValue([
      { subjectId: "english", subject: { id: "english", credits: 3 } },
      { subjectId: "philosophy", subject: { id: "philosophy", credits: 3 } },
    ]);
    expect(await mocks.service.recognizedCredits("record-1")).toBe(6);
    expect(mocks.curriculums.findOne).not.toHaveBeenCalled();
    expect(mocks.curriculumSubjects.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ curriculumId: "assigned-curriculum" }) }));
  });

  it.each([
    [{ workflowPhase: 'components', eligibilityFrozen: false, testScore: 3.9, assignmentScore: 5 }, null],
    [{ workflowPhase: 'final', eligibilityFrozen: true, eligible: false, testScore: 3.9, assignmentScore: 5 }, 'failed'],
    [{ workflowPhase: 'final', eligibilityFrozen: true, eligible: false, testScore: 3.9, assignmentScore: 5, finalized: true }, 'failed'],
    [{ testScore: 6, assignmentScore: 3, examScore: null, examExempt: false }, "failed"],
    [{ testScore: 8, assignmentScore: 8, examScore: 9, examExempt: false }, "passed"],
    [{ testScore: null, assignmentScore: null, examScore: null, examExempt: true }, "exempt"],
    [{ testScore: 6, assignmentScore: 6, examScore: null, examExempt: false }, null],
    [{ testScore: 6, assignmentScore: null, examScore: null, examExempt: false }, null],
  ])("resolves stored components before filtering studied subjects: %j", async (grade, expected) => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.sequelize.query.mockResolvedValue([{ id: "grade-1", subject: { id: "subject-1" },
      result: "pending", status: "completed", sourceType: "regular", grade: { ...grade, courseScore: null, result: "pending" } }]);
    const rows = await mocks.service.listStudiedSubjects("record-1");
    if (expected) {
      expect(rows).toEqual([{ id: "grade-1", subject: { id: "subject-1" }, result: expected, status: "completed", sourceType: "regular" }]);
    } else expect(rows).toEqual([]);
  });

  it("returns no studied subjects without a curriculum and never generates learning results", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(null);
    expect(await mocks.service.listStudiedSubjects("record-1")).toEqual([]);
    expect(mocks.sequelize.query).not.toHaveBeenCalled();
    expect(mocks.results.bulkCreate).not.toHaveBeenCalled();
  });

  it("reads stored outcomes within the current curriculum without requiring class membership", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    const outcomes = [{ id: "grade-1", subject: { id: "subject-1", name: "Triết học" }, result: "failed", status: "completed", sourceType: "regular" }];
    mocks.sequelize.query.mockResolvedValue(outcomes);
    expect(await mocks.service.listStudiedSubjects("record-1")).toEqual(outcomes);
    expect(mocks.sequelize.query).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ replacements: expect.objectContaining({
      recordId: "record-1", curriculumId: "curriculum-1", participantIds: ["admission:record-1", "student:student-1"],
    }) }));
    expect(mocks.memberships.findAll).toHaveBeenCalled();
    expect(mocks.results.bulkCreate).not.toHaveBeenCalled();
  });
});

describe("SubjectRecognitionService personal learning results", () => {
  it("saves an independent pre-masters result and submits it for review instead of approving it", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.subjects.findByPk.mockResolvedValue({ id: "subject-1", active: true });
    const row = { id: "lr-1", admissionRecordId: "record-1", sourceType: "pre_masters", status: "completed", result: "passed", score: 8.5 };
    mocks.results.create.mockResolvedValue(row);
    mocks.results.findByPk.mockResolvedValue(row);
    const propose = jest.spyOn(mocks.service, "proposeForRecord").mockResolvedValue({} as never);
    const saved = await mocks.service.createLearningResult("record-1", { subjectId: "subject-1", sourceType: "pre_masters", status: "completed", result: "passed", score: 8.5, completedAt: "2026-10-14" });
    expect(mocks.results.create).toHaveBeenCalledWith(expect.objectContaining({ result: "passed", score: 8.5 }), expect.anything());
    expect(propose).toHaveBeenCalledWith("record-1", { requireReview: true }, transaction);
    expect(saved).toMatchObject({ result: "passed", score: 8.5 });
  });

  it("creates a visible pending review even for a registered pre-masters subject and prevents premature approval", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    const subject = { id: "target-1", name: "Tiếng anh", credits: 3 };
    const learning = { id: "lr-1", subjectId: subject.id, subject, sourceType: "pre_masters", status: "registered", result: "pending" };
    mocks.curriculumSubjects.findAll.mockResolvedValue([{ subject }]);
    mocks.results.findAll.mockResolvedValue([learning]);
    mocks.recognitions.create.mockImplementation(async (payload: any) => ({ id: "rec-1", ...payload }));
    const summary = await mocks.service.proposeForRecord("record-1", { requireReview: true });
    expect(summary.pendingReview).toBe(1);
    expect(summary.autoApproved).toBe(0);
    expect(mocks.recognitions.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", learningResultId: "lr-1" }), expect.anything());
    mocks.results.findByPk.mockResolvedValue(learning);
    mocks.recognitions.findByPk.mockResolvedValue({ id: "rec-1", learningResultId: "lr-1", admissionRecordId: "record-1" });
    await expect(mocks.service.decide("rec-1", { decision: "approved" })).rejects.toThrow("Chỉ công nhận học phần đã hoàn thành và đạt");
  });

  it("requires a numeric pre-masters score before final approval", async () => {
    const mocks = buildService();
    const update = jest.fn<any>();
    mocks.recognitions.findByPk.mockResolvedValue({ id: "rec-1", status: "pending", learningResultId: "lr-1", admissionRecordId: "record-1", update });
    mocks.results.findByPk.mockResolvedValue({ id: "lr-1", sourceType: "pre_masters", status: "completed", result: "passed", score: null });
    await expect(mocks.service.decide("rec-1", { decision: "approved" })).rejects.toThrow("phải có điểm từ 0 đến 10");
    expect(update).not.toHaveBeenCalled();
  });

  it("prevents reopening an approved decision by editing its learning result", async () => {
    const mocks = buildService();
    const row = { id: "lr-1", admissionRecordId: "record-1", subjectId: "subject-1", sourceType: "pre_masters", status: "completed", result: "passed", completedAt: "2026-10-14", update: jest.fn<any>() };
    row.update.mockImplementation(async (payload: any) => Object.assign(row, payload));
    mocks.results.findByPk.mockResolvedValue(row);
    mocks.subjects.findByPk.mockResolvedValue({ id: "subject-1", active: true });
    const decision = { status: "approved", update: jest.fn<any>() };
    mocks.recognitions.findAll.mockResolvedValue([decision]);
    await expect(mocks.service.updateLearningResult("lr-1", { result: "failed" })).rejects.toThrow("không thể sửa");
    expect(decision.update).not.toHaveBeenCalled();
    expect(row.update).not.toHaveBeenCalled();
  });
  it("reads the exam failure even when a personal result says passed", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.results.findAll.mockResolvedValue([{ id: "lr-1", status: "completed", result: "passed", score: 10 }]);
    mocks.sequelize.query.mockResolvedValue([{ id: "lr-1", result: "failed", score: 8.5 }]);
    expect(await mocks.service.listLearningResults("record-1"))
      .toEqual([expect.objectContaining({ result: "failed", score: 8.5 })]);
  });

  it("does not count old approved credits after the exam outcome becomes failed", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.recognitions.findAll.mockResolvedValue([{ learningResultId: "lr-1", targetSubjectId: "target-1", status: "approved" }]);
    mocks.sequelize.query.mockResolvedValue([{ id: "lr-1", result: "failed", score: 8.5 }]);
    expect(await mocks.service.recognizedCredits("record-1")).toBe(0);
  });

  it("rejects approval when the exam failed despite a manually recorded pass", async () => {
    const mocks = buildService();
    mocks.recognitions.findByPk.mockResolvedValue({ id: "rec-1", learningResultId: "lr-1", admissionRecordId: "record-1" });
    mocks.results.findByPk.mockResolvedValue({ id: "lr-1", status: "completed", result: "passed" });
    mocks.sequelize.query.mockResolvedValue([{ id: "lr-1", result: "failed", score: 8.5 }]);
    await expect(mocks.service.decide("rec-1", { decision: "approved" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("carries over a registered subject without recognizing credits", async () => {
    const mocks = buildService();
    mocks.sequelize.query.mockResolvedValue([]);
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "registered", result: "pending", subjectId: "subject-1", subject: { id: "subject-1", name: "Triết học", credits: 3, canonicalSubjectId: null } },
    ]);

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.autoApproved).toBe(0);
    expect(summary.carriedOver).toBe(1);
    expect(mocks.recognitions.create).not.toHaveBeenCalled();
  });

  it("auto-approves a completed subject sharing the same canonical root", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.curriculumSubjects.findAll.mockResolvedValue([
      { subject: { id: "target-1", name: "Triết học", credits: 3, canonicalSubjectId: "root-1" } },
    ]);
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "completed", result: "passed", score: 8.5, subjectId: "subject-old", sourceType: "pre_masters", courseOfferingId: null,
        subject: { id: "subject-old", name: "Triết học Mác - Lênin", credits: 3, canonicalSubjectId: "root-1" } },
    ]);
    mocks.recognitions.create.mockImplementation(async (payload: any) => ({ id: "rec-1", ...payload }));

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.autoApproved).toBe(1);
    expect(mocks.recognitions.create).toHaveBeenCalledWith(expect.objectContaining({
      admissionRecordId: "record-1", targetSubjectId: "target-1", sourceSubjectId: "subject-old",
      status: "approved", basis: "canonical_subject", sourceType: "pre_masters",
    }), { transaction });
  });

  it("auto-approves bridge knowledge only when equivalence is declared", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.curriculumSubjects.findAll.mockResolvedValue([
      { subject: { id: "target-1", name: "Tiếng Anh", credits: 3, canonicalSubjectId: null } },
    ]);
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "completed", result: "passed", subjectId: null, sourceType: "pre_masters", courseOfferingId: null,
        subject: null, bridgeKnowledgeSubject: { id: "bk-1", code: "BSKT01", name: "Tiếng Anh bổ sung", credits: 3, equivalentSubjectId: "target-1" } },
    ]);
    mocks.subjects.findByPk.mockResolvedValue({ id: "target-1", canonicalSubjectId: null });
    mocks.recognitions.create.mockImplementation(async (payload: any) => ({ id: "rec-1", ...payload }));

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.autoApproved).toBe(1);
    expect(mocks.recognitions.create).toHaveBeenCalledWith(expect.objectContaining({
      targetSubjectId: "target-1", status: "approved", basis: "declared_equivalence",
    }), { transaction });
  });

  it("skips bridge knowledge that has no declared equivalence", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "completed", result: "passed", subjectId: null, courseOfferingId: null,
        subject: null, bridgeKnowledgeSubject: { id: "bk-1", code: "BSKT01", name: "Kỹ năng mềm", credits: 2, equivalentSubjectId: null } },
    ]);

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.skipped).toBe(1);
    expect(mocks.recognitions.create).not.toHaveBeenCalled();
  });

  it("creates a pending proposal when only the name and credits match", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.curriculumSubjects.findAll.mockResolvedValue([
      { subject: { id: "target-1", name: "Phương pháp nghiên cứu", credits: 3, canonicalSubjectId: null } },
    ]);
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "completed", result: "passed", subjectId: "subject-old", sourceType: "early_enrollment", courseOfferingId: null,
        subject: { id: "subject-old", name: "phương   pháp NGHIÊN CỨU", credits: 3, canonicalSubjectId: null } },
    ]);
    mocks.recognitions.create.mockImplementation(async (payload: any) => ({ id: "rec-1", ...payload }));

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.pendingReview).toBe(1);
    expect(summary.autoApproved).toBe(0);
    expect(mocks.recognitions.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "pending", basis: "same_name",
    }), { transaction });
  });

  it("never recognizes a failed result", async () => {
    const mocks = buildService();
    mocks.sequelize.query.mockImplementation(async (sql: string) => sql.includes("SELECT learning.id")
      ? [{ id: "lr-1", result: "failed", score: 8.5 }] : []);
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.curriculums.findOne.mockResolvedValue(buildCurriculum());
    mocks.curriculumSubjects.findAll.mockResolvedValue([
      { subject: { id: "target-1", name: "Triết học", credits: 3, canonicalSubjectId: null } },
    ]);
    mocks.results.findAll.mockResolvedValue([
      { id: "lr-1", status: "completed", result: "failed", subjectId: "subject-old", sourceType: "pre_masters", courseOfferingId: null,
        subject: { id: "subject-old", name: "Triết học", credits: 3, canonicalSubjectId: null } },
    ]);

    const summary = await mocks.service.proposeForRecord("record-1", {});

    expect(summary.skipped).toBe(1);
    expect(mocks.recognitions.create).not.toHaveBeenCalled();
  });
});

describe("SubjectRecognitionService validation", () => {
  it("rejects a learning result without a catalog reference", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());

    await expect(mocks.service.createLearningResult("record-1", { sourceType: "pre_masters" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a learning result that references both catalogs", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());

    await expect(mocks.service.createLearningResult("record-1", {
      sourceType: "pre_masters", subjectId: "subject-1", bridgeKnowledgeSubjectId: "bk-1",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a completed result without a completion date", async () => {
    const mocks = buildService();
    mocks.records.findByPk.mockResolvedValue(buildRecord());
    mocks.subjects.findByPk.mockResolvedValue({ id: "subject-1", active: true });

    await expect(mocks.service.createLearningResult("record-1", {
      sourceType: "pre_masters", subjectId: "subject-1", status: "completed",
    })).rejects.toThrow("Kết quả đã hoàn thành phải có ngày hoàn thành.");
  });

  it("refuses to approve a recognition whose result is not completed", async () => {
    const mocks = buildService();
    mocks.sequelize.query.mockResolvedValue([]);
    mocks.recognitions.findByPk.mockResolvedValue({
      id: "rec-1", learningResultId: "lr-1", targetSubjectId: "target-1", admissionRecordId: "record-1",
      status: "pending", update: jest.fn(),
    });
    mocks.results.findByPk.mockResolvedValue({ id: "lr-1", status: "studying", result: "pending" });

    await expect(mocks.service.decide("rec-1", { decision: "approved" }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

describe("SubjectRecognitionService decided-recognition editing", () => {
  it.each(["approved", "rejected"])("prevents overwriting a finalized %s recognition", async status => {
    const mocks = buildService();
    const update = jest.fn().mockResolvedValue(undefined);
    mocks.recognitions.findByPk.mockResolvedValue({
      id: "rec-1", learningResultId: "lr-1", targetSubjectId: "target-1", admissionRecordId: "record-1",
      status, note: "Ghi chú cũ", update,
    });
    mocks.results.findByPk.mockResolvedValue({ id: "lr-1", status: "completed", result: "passed" });

    await expect(mocks.service.decide("rec-1", { decision: status === "approved" ? "rejected" : "approved", note: "Nhập nhầm" })).rejects.toThrow("Quyết định đã được chốt");
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["approved", "rejected"])("prevents deleting a finalized %s recognition", async status => {
    const mocks = buildService();
    const destroy = jest.fn().mockResolvedValue(undefined);
    mocks.recognitions.findByPk.mockResolvedValue({ id: "rec-1", status, destroy });

    await expect(mocks.service.removeRecognition("rec-1")).rejects.toThrow("Quyết định đã được chốt");
    expect(destroy).not.toHaveBeenCalled();
  });

  it("rejects deleting an unknown recognition", async () => {
    const mocks = buildService();
    mocks.recognitions.findByPk.mockResolvedValue(null);

    await expect(mocks.service.removeRecognition("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
