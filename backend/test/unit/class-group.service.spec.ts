import { ConflictException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { ClassGroupService } from "../../src/plan/class-group.service.js";

describe("ClassGroupService create", () => {
  it("preserves a custom code through persistence and curriculum assignment", async () => {
    const group = { id: "group-1", code: "LOP-CNTT-1" };
    const classGroups = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(group),
    };
    const majors = { findByPk: jest.fn().mockResolvedValue({ code: "CNTT", program: "masters", active: true }) };
    const curriculums = { assignToClassGroup: jest.fn().mockResolvedValue(undefined) };
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const service = new ClassGroupService(
      classGroups as never, {} as never, {} as never,
      majors as never, curriculums as never, { query: jest.fn().mockResolvedValue([]) } as never,
    );
    await service.create({
      code: "LOP-CNTT-1", name: "LOP-CNTT-1", majorId: "major-1",
      curriculumId: "curriculum-1", academicYear: "2026", intakeRound: 2, groupNumber: null,
    }, transaction as never);
    expect(classGroups.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LOP-CNTT-1", name: "LOP-CNTT-1", intakeRound: 2, groupNumber: null }),
      { transaction },
    );
    expect(curriculums.assignToClassGroup).toHaveBeenCalledWith(group, transaction, "curriculum-1");
  });
});

describe("ClassGroupService remove", () => {
  const buildService = (memberCount = 0, offeringCount = 0) => {
    const group = { id: "group-1", code: "25CNT01", destroy: jest.fn() };
    const classGroups = { findByPk: jest.fn().mockResolvedValue(group) };
    const classGroupMembers = { count: jest.fn().mockResolvedValue(memberCount) };
    const offeringGroups = { count: jest.fn().mockResolvedValue(offeringCount) };
    const service = new ClassGroupService(
      classGroups as never,
      classGroupMembers as never,
      offeringGroups as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, group };
  };

  it("reports how many course offerings still use the group", async () => {
    const { service, group } = buildService(0, 6);

    await expect(service.remove("group-1")).rejects.toEqual(expect.objectContaining({
      message: 'Không thể xóa nhóm "25CNT01" vì đang được sử dụng trong 6 lớp học phần.',
    }));
    expect(group.destroy).not.toHaveBeenCalled();
  });

  it("keeps the existing member-specific conflict", async () => {
    const { service, group } = buildService(2, 0);

    await expect(service.remove("group-1")).rejects.toBeInstanceOf(ConflictException);
    expect(group.destroy).not.toHaveBeenCalled();
  });
});

describe("ClassGroupService protects the academic scope", () => {
  const build = (used: boolean) => {
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    const group = { id: "g1", code: "CNTT 2026.1.1", name: "CNTT 2026.1.1", majorId: "m1", program: "masters",
      academicYear: "2026", curriculumId: "c1", groupNumber: 1, maxStudents: 40,
      update: jest.fn().mockResolvedValue(undefined) };
    const groups = { findByPk: jest.fn().mockResolvedValue(group), findOne: jest.fn().mockResolvedValue(null) };
    const curriculums = { assignToClassGroup: jest.fn().mockResolvedValue({ id: "c1" }) };
    const db = { query: jest.fn().mockResolvedValue([{ used }]) };
    const service = new ClassGroupService(groups as never, { count: jest.fn().mockResolvedValue(1) } as never,
      {} as never, { findByPk: jest.fn().mockImplementation(async () => ({ code: "CNTT", program: "masters" })) } as never,
      curriculums as never, db as never);
    return { service, group, groups, curriculums, db, transaction };
  };

  it.each([
    { majorId: "m2" }, { academicYear: "2027" }, { curriculumId: "c2" },
    { code: "CNTT 2027.1.1" },
  ])("blocks scope changes before writing a used class: %j", async patch => {
    const { service, group, curriculums, transaction } = build(true);
    await expect(service.update("g1", patch, transaction as never)).rejects.toMatchObject({ response: { code: "CLASS_SCOPE_IN_USE" } });
    expect(group.update).not.toHaveBeenCalled();
    expect(curriculums.assignToClassGroup).not.toHaveBeenCalled();
  });

  it("permits a new curriculum on an unused class", async () => {
    const { service, group, curriculums, transaction } = build(false);
    await service.update("g1", { curriculumId: "c2" }, transaction as never);
    expect(group.update).toHaveBeenCalled();
    expect(curriculums.assignToClassGroup).toHaveBeenCalledWith(group, transaction, "c2");
  });

  it("permits metadata and identical scope values on a used class", async () => {
    const { service, group, transaction } = build(true);
    await service.update("g1", { majorId: "m1", academicYear: "2026", curriculumId: "c1", note: "Updated", maxStudents: 50 }, transaction as never);
    expect(group.update).toHaveBeenCalledWith(expect.objectContaining({ note: "Updated", maxStudents: 50 }), { transaction });
  });
});
