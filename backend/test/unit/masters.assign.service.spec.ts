import { jest } from "@jest/globals";
import { MastersService } from "../../src/masters/masters.service.js";

/**
 * Unit tests for MastersService student-assignment operations:
 * - assignMembers (transaction, kiểm tra điều kiện học viên, sĩ số)
 * - autoAssign (chia đều, cùng phạm vi ngành/năm/kỳ, ≥2 nhóm)
 */
const buildService = () => {
  const classGroups = { findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
  const classGroupMembers = { count: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn() };
  const admissionRecords = { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
  const students = { findAll: jest.fn() };
  const majors = { findByPk: jest.fn() };
  const sequelize = {
    transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb({ LOCK: { UPDATE: "UPDATE" } })),
  };
  const classGroupsService = {};
  const service = new MastersService(
    classGroups as never,
    classGroupMembers as never,
    admissionRecords as never,
    students as never,
    majors as never,
    sequelize as never,
    classGroupsService as never,
  );
  return { service, classGroups, classGroupMembers, admissionRecords, majors };
};

const openGroup = {
  id: "g1",
  program: "masters",
  status: "open",
  academicYear: "2026",
  term: "HK1",
  majorId: null,
  maxStudents: 40,
  name: "Nhóm 1",
};

describe("MastersService.assignMembers", () => {
  it("assigns eligible students to an open group inside a transaction", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    classGroups.findOne.mockResolvedValue(openGroup);
    admissionRecords.findAll.mockResolvedValue([{ id: "a1", studentId: "s1" }]);
    classGroups.findAll.mockResolvedValue([{ id: "g1" }]);
    classGroupMembers.destroy.mockResolvedValue(0);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.assignMembers("g1", { admissionRecordIds: ["a1"] });

    expect(classGroupMembers.destroy).toHaveBeenCalled();
    expect(classGroupMembers.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ classGroupId: "g1", admissionRecordId: "a1", studentId: "s1" })]),
      expect.anything(),
    );
    expect(result.count).toBe(1);
  });

  it("rejects when an admission record is not eligible (wrong major/level/year/status)", async () => {
    const { service, classGroups, admissionRecords, classGroupMembers } = buildService();
    classGroups.findOne.mockResolvedValue(openGroup);
    // None of the requested records match the eligibility criteria.
    admissionRecords.findAll.mockResolvedValue([]);

    await expect(service.assignMembers("g1", { admissionRecordIds: ["a1"] }))
      .rejects.toThrow("Danh sách có học viên không đủ điều kiện");
    expect(classGroupMembers.bulkCreate).not.toHaveBeenCalled();
  });

  it("rejects when adding the students would exceed maxStudents", async () => {
    const { service, classGroups, admissionRecords, classGroupMembers } = buildService();
    classGroups.findOne.mockResolvedValue(openGroup);
    admissionRecords.findAll.mockResolvedValue([
      { id: "a1", studentId: null },
      { id: "a2", studentId: null },
      { id: "a3", studentId: null },
    ]);
    classGroups.findAll.mockResolvedValue([{ id: "g1" }]);
    classGroupMembers.destroy.mockResolvedValue(0);
    // 38 current + 3 new = 41 > maxStudents 40
    classGroupMembers.count.mockResolvedValue(38);

    await expect(service.assignMembers("g1", { admissionRecordIds: ["a1", "a2", "a3"] }))
      .rejects.toThrow("chỉ còn");
    expect(classGroupMembers.bulkCreate).not.toHaveBeenCalled();
  });
});

describe("MastersService.autoAssign", () => {
  it("distributes students evenly across groups with the same scope", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    const g1 = { ...openGroup, code: "N01" };
    const g2 = { ...openGroup, id: "g2", code: "N02" };
    classGroups.findAll.mockResolvedValue([g1, g2]);
    admissionRecords.findAll.mockResolvedValue([
      { id: "a1", studentId: null, firstName: "Nam", fullName: "Nguyễn Văn Nam" },
      { id: "a2", studentId: null, firstName: "An", fullName: "Trần Văn An" },
      { id: "a3", studentId: null, firstName: "Bình", fullName: "Lê Thị Bình" },
      { id: "a4", studentId: null, firstName: "Cường", fullName: "Phạm Văn Cường" },
    ]);
    classGroupMembers.destroy.mockResolvedValue(0);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.autoAssign({
      classGroupIds: ["g1", "g2"],
      admissionRecordIds: ["a1", "a2", "a3", "a4"],
      method: "round_robin",
    });

    expect(classGroupMembers.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ classGroupId: "g1" }),
        expect.objectContaining({ classGroupId: "g2" }),
      ]),
      expect.anything(),
    );
    expect(result.distributed).toHaveLength(2);
    expect(result.distributed.reduce((sum: number, d: { count: number }) => sum + d.count, 0)).toBe(4);
  });

  it("requires at least 2 target groups", async () => {
    const { service } = buildService();

    await expect(service.autoAssign({ classGroupIds: ["g1"], admissionRecordIds: ["a1"] }))
      .rejects.toThrow("Vui lòng chọn ít nhất 2 nhóm học phần.");
  });

  it("rejects groups that are not in the same major/year/term scope", async () => {
    const { service, classGroups } = buildService();
    const g1 = { ...openGroup, code: "N01" };
    const g2 = { ...openGroup, id: "g2", code: "N02", academicYear: "2025" };
    classGroups.findAll.mockResolvedValue([g1, g2]);

    await expect(service.autoAssign({
      classGroupIds: ["g1", "g2"],
      admissionRecordIds: ["a1", "a2"],
    })).rejects.toThrow("Các nhóm chia đều phải cùng chuyên ngành");
  });
});
