import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { jest } from "@jest/globals";
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
    query: jest.fn().mockResolvedValue([]),
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

describe("SubjectRecognitionService personal learning results", () => {
  it("carries over a registered subject without recognizing credits", async () => {
    const mocks = buildService();
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
  it("re-uses the same decision endpoint to overwrite an already approved recognition", async () => {
    const mocks = buildService();
    const update = jest.fn().mockResolvedValue(undefined);
    mocks.recognitions.findByPk.mockResolvedValue({
      id: "rec-1", learningResultId: "lr-1", targetSubjectId: "target-1", admissionRecordId: "record-1",
      status: "approved", note: "Ghi chú cũ", update,
    });
    mocks.results.findByPk.mockResolvedValue({ id: "lr-1", status: "completed", result: "passed" });

    await mocks.service.decide("rec-1", { decision: "rejected", note: "Nhập nhầm" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", note: "Nhập nhầm" }),
      expect.anything(),
    );
  });

  it("deletes a recognition so proposeForRecord can raise it again", async () => {
    const mocks = buildService();
    const destroy = jest.fn().mockResolvedValue(undefined);
    mocks.recognitions.findByPk.mockResolvedValue({ id: "rec-1", status: "approved", destroy });

    await expect(mocks.service.removeRecognition("rec-1")).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects deleting an unknown recognition", async () => {
    const mocks = buildService();
    mocks.recognitions.findByPk.mockResolvedValue(null);

    await expect(mocks.service.removeRecognition("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
