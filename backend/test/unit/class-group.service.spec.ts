import { ConflictException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { ClassGroupService } from "../../src/plan/class-group.service.js";

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
