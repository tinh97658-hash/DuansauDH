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
  const classGroupsService = { create: jest.fn() };
  const service = new MastersService(
    classGroups as never,
    classGroupMembers as never,
    admissionRecords as never,
    students as never,
    majors as never,
    sequelize as never,
    classGroupsService as never,
  );
  return { service, classGroups, classGroupMembers, admissionRecords, majors, classGroupsService, sequelize };
};

const openGroup = {
  id: "g1",
  program: "masters",
  status: "open",
  academicYear: "2026",
  majorId: null,
  maxStudents: 40,
  name: "Nhóm 1",
};

describe("MastersService.assignMembers", () => {
  it("assigns eligible students to an open group inside a transaction", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    classGroups.findOne.mockResolvedValue(openGroup);
    admissionRecords.findAll.mockResolvedValue([{ id: "a1", studentId: "s1" }]);
    classGroupMembers.findAll.mockResolvedValue([]);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.assignMembers("g1", { admissionRecordIds: ["a1"] });

    expect(classGroupMembers.destroy).not.toHaveBeenCalled();
    expect(classGroupMembers.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ classGroupId: "g1", admissionRecordId: "a1", studentId: "s1" })]),
      expect.anything(),
    );
    expect(result.count).toBe(1);
  });

  it("rejects a student who already belongs to another class", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    classGroups.findOne.mockResolvedValue(openGroup);
    admissionRecords.findAll.mockResolvedValue([{ id: "a1", studentId: "s1" }]);
    classGroupMembers.findAll.mockResolvedValue([{
      classGroupId: "g2",
      classGroup: { id: "g2", code: "N02", name: "Nhóm 2" },
    }]);

    await expect(service.assignMembers("g1", { admissionRecordIds: ["a1"] }))
      .rejects.toThrow('đã được phân vào lớp "Nhóm 2"');
    expect(classGroupMembers.bulkCreate).not.toHaveBeenCalled();
    expect(classGroupMembers.destroy).not.toHaveBeenCalled();
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
    classGroupMembers.findAll.mockResolvedValue([]);
    // 38 current + 3 new = 41 > maxStudents 40
    classGroupMembers.count.mockResolvedValue(38);

    await expect(service.assignMembers("g1", { admissionRecordIds: ["a1", "a2", "a3"] }))
      .rejects.toThrow("chỉ còn");
    expect(classGroupMembers.bulkCreate).not.toHaveBeenCalled();
  });
});

describe("MastersService.autoAssign", () => {
  it("sorts by name and distributes contiguous balanced blocks", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    const g1 = { ...openGroup, code: "N01" };
    const g2 = { ...openGroup, id: "g2", code: "N02" };
    const g3 = { ...openGroup, id: "g3", code: "N03" };
    classGroups.findAll.mockResolvedValue([g1, g2, g3]);
    admissionRecords.findAll.mockResolvedValue([
      { id: "a5", studentId: null, firstName: "E", fullName: "Học viên E" },
      { id: "a1", studentId: null, firstName: "A", fullName: "Học viên A" },
      { id: "a4", studentId: null, firstName: "D", fullName: "Học viên D" },
      { id: "a2", studentId: null, firstName: "B", fullName: "Học viên B" },
      { id: "a3", studentId: null, firstName: "C", fullName: "Học viên C" },
    ]);
    classGroupMembers.findAll.mockResolvedValue([]);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.autoAssign({
      classGroupIds: ["g1", "g2", "g3"],
      admissionRecordIds: ["a1", "a2", "a3", "a4", "a5"],
      method: "alphabetical",
    });

    const memberships = classGroupMembers.bulkCreate.mock.calls[0][0];
    expect(memberships.map((item: { classGroupId: string; admissionRecordId: string }) => [item.classGroupId, item.admissionRecordId])).toEqual([
      ["g1", "a1"], ["g1", "a2"],
      ["g2", "a3"], ["g2", "a4"],
      ["g3", "a5"],
    ]);
    expect(result.distributed.map((item: { count: number }) => item.count)).toEqual([2, 2, 1]);
  });

  it("fills groups to capacity in order for fill-first", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    const groups = [
      { ...openGroup, code: "N01" },
      { ...openGroup, id: "g2", code: "N02" },
      { ...openGroup, id: "g3", code: "N03" },
    ];
    classGroups.findAll.mockResolvedValue(groups);
    admissionRecords.findAll.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({
      id: `a${index + 1}`,
      studentId: null,
      firstName: String(index + 1).padStart(2, "0"),
      fullName: `Học viên ${index + 1}`,
    })));
    classGroupMembers.findAll.mockResolvedValue([]);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.autoAssign({
      classGroupIds: groups.map((group) => group.id),
      admissionRecordIds: Array.from({ length: 50 }, (_, index) => `a${index + 1}`),
      method: "fill_first",
    });

    expect(result.distributed.map((item: { count: number }) => item.count)).toEqual([40, 10, 0]);
  });

  it("uses exact custom block counts", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    const groups = [
      { ...openGroup, code: "N01" },
      { ...openGroup, id: "g2", code: "N02" },
      { ...openGroup, id: "g3", code: "N03" },
    ];
    classGroups.findAll.mockResolvedValue(groups);
    admissionRecords.findAll.mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({
      id: `a${index + 1}`,
      studentId: null,
      firstName: String(index + 1),
      fullName: `Học viên ${index + 1}`,
    })));
    classGroupMembers.findAll.mockResolvedValue([]);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockResolvedValue([{}]);

    const result = await service.autoAssign({
      classGroupIds: groups.map((group) => group.id),
      admissionRecordIds: Array.from({ length: 6 }, (_, index) => `a${index + 1}`),
      method: "custom",
      targetCounts: [3, 2, 1],
    });

    expect(result.distributed.map((item: { count: number }) => item.count)).toEqual([3, 2, 1]);
  });

  it("does not redistribute students who already have a class", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords } = buildService();
    const g1 = { ...openGroup, code: "N01" };
    const g2 = { ...openGroup, id: "g2", code: "N02" };
    classGroups.findAll.mockResolvedValue([g1, g2]);
    admissionRecords.findAll.mockResolvedValue([
      { id: "a1", studentId: null, firstName: "An", fullName: "Nguyễn Văn An" },
    ]);
    classGroupMembers.findAll.mockResolvedValue([{
      classGroupId: "g1",
      classGroup: { id: "g1", code: "N01", name: "Nhóm 1" },
    }]);

    await expect(service.autoAssign({
      classGroupIds: ["g1", "g2"],
      admissionRecordIds: ["a1"],
    })).rejects.toThrow('đã được phân vào lớp "Nhóm 1"');
    expect(classGroupMembers.bulkCreate).not.toHaveBeenCalled();
    expect(classGroupMembers.destroy).not.toHaveBeenCalled();
  });

  it("requires at least 2 target groups", async () => {
    const { service } = buildService();

    await expect(service.autoAssign({ classGroupIds: ["g1"], admissionRecordIds: ["a1"] }))
      .rejects.toThrow("Vui lòng chọn ít nhất 2 nhóm học phần.");
  });

  it("rejects groups that are not in the same major/year scope", async () => {
    const { service, classGroups } = buildService();
    const g1 = { ...openGroup, code: "N01" };
    const g2 = { ...openGroup, id: "g2", code: "N02", academicYear: "2025" };
    classGroups.findAll.mockResolvedValue([g1, g2]);

    await expect(service.autoAssign({
      classGroupIds: ["g1", "g2"],
      admissionRecordIds: ["a1", "a2"],
    })).rejects.toThrow("Các nhóm phải cùng chuyên ngành");
  });
});

describe("MastersService.batchCreateClassGroups with auto assignment", () => {
  it("creates and assigns in the same transaction and propagates assignment failure", async () => {
    const { service, classGroups, classGroupMembers, admissionRecords, majors, classGroupsService } = buildService();
    const g1 = { ...openGroup, id: "g1", code: "26CNTT01", name: "CNTT2026.01" };
    const g2 = { ...openGroup, id: "g2", code: "26CNTT02", name: "CNTT2026.02" };
    majors.findByPk.mockResolvedValue({ id: "major-1", active: true, program: "masters" });
    classGroups.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([g1, g2]);
    classGroupsService.create.mockResolvedValueOnce(g1).mockResolvedValueOnce(g2);
    admissionRecords.findAll.mockResolvedValue([
      { id: "a1", studentId: null, firstName: "An", fullName: "Học viên An" },
      { id: "a2", studentId: null, firstName: "Bình", fullName: "Học viên Bình" },
    ]);
    classGroupMembers.findAll.mockResolvedValue([]);
    classGroupMembers.count.mockResolvedValue(0);
    classGroupMembers.bulkCreate.mockRejectedValue(new Error("assignment failed"));

    await expect(service.batchCreateClassGroups({
      codePrefix: "26CNTT",
      namePrefix: "CNTT2026.",
      nameTemplate: "CNTT2026.{n}",
      count: 2,
      startIndex: 1,
      majorId: "major-1",
      academicYear: "2026",
      maxStudents: 40,
      status: "open",
      autoAssign: true,
      assignmentMethod: "balanced",
      admissionRecordIds: ["a1", "a2"],
    })).rejects.toThrow("assignment failed");

    const transaction = classGroupsService.create.mock.calls[0][1];
    expect(classGroupsService.create).toHaveBeenNthCalledWith(2, expect.anything(), transaction);
    expect(classGroupMembers.bulkCreate).toHaveBeenCalledWith(expect.anything(), { transaction });
  });
});
