import { jest } from "@jest/globals";
import { MajorTransferService } from "../../src/plan/major-transfer.service.js";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

const buildService = () => {
  const transfers = { findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
  const records = { findByPk: jest.fn() };
  const majors = { findByPk: jest.fn() };
  const curriculums = { findByPk: jest.fn() };
  const memberships = { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() };
  const offeringGroups = { findAll: jest.fn().mockResolvedValue([]) };
  const offeringStudents = { findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn() };
  const recognitions = { proposeForRecord: jest.fn().mockResolvedValue({ autoApproved: 0 }), decide: jest.fn().mockResolvedValue({ id: "rec-1", status: "approved" }) };
  const sequelize = { transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };
  const admissionEvaluation = { guardRecordUpdate: jest.fn(), archiveForApprovedMajorTransfer: jest.fn() };
  const service = new MajorTransferService(
    transfers as never, records as never, majors as never,
    curriculums as never, memberships as never,
    offeringGroups as never, offeringStudents as never, recognitions as never, sequelize as never, admissionEvaluation as never,
  );
  return { service, transfers, records, majors, curriculums, memberships, offeringGroups, offeringStudents, recognitions, admissionEvaluation };
};

describe("MajorTransferService", () => {
  it("keeps the learner unchanged while the transfer is waiting for council review", async () => {
    const mocks = buildService();
    const record = {
      id: "record-1", code: "HV26001", studentId: "student-1", majorId: "major-old", majorName: "Ngành cũ",
      trainingLevel: "Thạc sĩ", status: "approved", studyStatus: "Đang học",
      update: jest.fn().mockResolvedValue(undefined),
    };
    const transfer = { id: "transfer-1" };
    mocks.records.findByPk.mockResolvedValue(record);
    mocks.transfers.findOne.mockResolvedValue(null);
    mocks.majors.findByPk.mockResolvedValue({ id: "major-new", name: "Ngành mới", program: "masters", active: true });
    const membership = {
      classGroupId: "class-old",
      $get: jest.fn().mockResolvedValue({ id: "class-old", curriculumId: "curriculum-old" }),
    };
    mocks.memberships.findOne.mockResolvedValue(membership);
    mocks.transfers.create.mockResolvedValue(transfer);
    mocks.transfers.findByPk.mockResolvedValue(transfer);

    await mocks.service.request(record.id, { toMajorId: "major-new", reason: "Phù hợp định hướng" });

    expect(mocks.transfers.create).toHaveBeenCalledWith(expect.objectContaining({
      admissionRecordId: record.id, fromMajorId: "major-old", toMajorId: "major-new",
      fromClassGroupId: "class-old", fromCurriculumId: "curriculum-old",
      previousAdmissionStatus: "approved", previousStudyStatus: "Đang học",
    }), { transaction });
    expect(record.update).not.toHaveBeenCalled();
    expect(membership.$get).toHaveBeenCalledWith("classGroup", { transaction });
    expect(mocks.memberships.findOne).toHaveBeenCalledWith(expect.not.objectContaining({ include: expect.anything() }));
    expect(mocks.memberships.destroy).not.toHaveBeenCalled();
    expect(mocks.offeringStudents.bulkCreate).not.toHaveBeenCalled();
  });

  it("changes the major and detaches the old class only after approval", async () => {
    const mocks = buildService();
    const transfer = {
      id: "transfer-1", admissionRecordId: "record-1", fromMajorId: "major-old", toMajorId: "major-new",
      fromClassGroupId: "class-old", status: "pending", update: jest.fn().mockResolvedValue(undefined),
    };
    const record = {
      id: "record-1", code: "HV26001", studentId: "student-1", majorId: "major-old", majorName: "Ngành cũ",
      trainingLevel: "Thạc sĩ", academicYear: "2026", update: jest.fn().mockResolvedValue(undefined),
    };
    mocks.transfers.findByPk.mockResolvedValueOnce(transfer).mockResolvedValueOnce(transfer);
    mocks.records.findByPk.mockResolvedValue(record);
    mocks.curriculums.findByPk.mockResolvedValue({ id: "curriculum-new", majorId: "major-new", program: "masters", applicableFromYear: "2026" });
    mocks.majors.findByPk.mockResolvedValue({ id: "major-new", name: "Ngành mới", active: true, program: "masters" });

    await mocks.service.decide(transfer.id, { decision: "approved", toCurriculumId: "curriculum-new" });

    expect(record.update).toHaveBeenCalledWith({
      majorId: "major-new", majorName: "Ngành mới", status: "pending", studyStatus: "Nộp hồ sơ đầu vào",
    }, { transaction });
    expect(record.update.mock.calls[0][0]).not.toHaveProperty("code");
    expect(record.update.mock.calls[0][0]).not.toHaveProperty("studentId");
    expect(mocks.memberships.destroy).toHaveBeenCalled();
  });

  it("rejects a transfer and restores the previous major, status and class", async () => {
    const mocks = buildService();
    const transfer = {
      id: "transfer-1", admissionRecordId: "record-1", fromMajorId: "major-old", fromClassGroupId: "class-old",
      previousAdmissionStatus: "approved", previousStudyStatus: "Đang học", status: "pending",
      update: jest.fn().mockResolvedValue(undefined),
    };
    const record = { id: "record-1", studentId: "student-1", majorName: "Ngành mới", update: jest.fn().mockResolvedValue(undefined) };
    mocks.transfers.findByPk.mockResolvedValueOnce(transfer).mockResolvedValueOnce(transfer);
    mocks.records.findByPk.mockResolvedValue(record);
    mocks.majors.findByPk.mockResolvedValue({ id: "major-old", name: "Ngành cũ" });
    mocks.memberships.findOne.mockResolvedValue(null);

    await mocks.service.decide(transfer.id, { decision: "rejected" });

    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({
      majorId: "major-old", majorName: "Ngành cũ", status: "approved", studyStatus: "Đang học",
    }), { transaction });
    expect(mocks.memberships.create).toHaveBeenCalledWith(expect.objectContaining({
      classGroupId: "class-old", admissionRecordId: "record-1", studentId: "student-1",
    }), { transaction });
  });
});
