import { RbacService } from "../../src/auth/rbac.service.js";

const role = (code: string, permissionCodes: string[], isSuperadmin = false) => ({
  code,
  isSuperadmin,
  permissions: permissionCodes.map((permissionCode) => ({ code: permissionCode })),
});

describe("RbacService", () => {
  const build = () => {
    const roles = { findOne: jest.fn() };
    const staffRoles = { findAll: jest.fn().mockResolvedValue([]) };
    const service = new RbacService(roles as any, staffRoles as any);
    return { service, roles, staffRoles };
  };

  it("hợp quyền của mọi vai trò được gán", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([
      { role: role("supervisor", ["catalog.view", "gradebook.view"]) },
      { role: role("examiner", ["gradebook.view", "gradebook.approve"]) },
    ]);

    const access = await service.effectiveAccess({ id: "s1", role: "supervisor" });

    expect(access.superadmin).toBe(false);
    expect([...access.permissions].sort()).toEqual(["catalog.view", "gradebook.approve", "gradebook.view"]);
    expect(access.roleCodes).toEqual(["supervisor", "examiner"]);
  });

  it("đánh dấu superadmin khi có vai trò quản trị", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([{ role: role("admin", [], true) }]);

    const access = await service.effectiveAccess({ id: "s1", role: "admin" });

    expect(access.superadmin).toBe(true);
  });

  it("dùng vai trò chính làm fallback khi chưa có bản ghi staff_roles", async () => {
    const { service, roles, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([]);
    roles.findOne.mockResolvedValue(role("examiner", ["gradebook.view"]));

    const access = await service.effectiveAccess({ id: "s1", role: "examiner" });

    expect(roles.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { code: "examiner" } }));
    expect([...access.permissions]).toEqual(["gradebook.view"]);
  });

  it("cache kết quả trong thời gian ngắn và xóa được cache", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([{ role: role("supervisor", ["catalog.view"]) }]);

    await service.effectiveAccess({ id: "s1", role: "supervisor" });
    await service.effectiveAccess({ id: "s1", role: "supervisor" });
    expect(staffRoles.findAll).toHaveBeenCalledTimes(1);

    service.invalidate("s1");
    await service.effectiveAccess({ id: "s1", role: "supervisor" });
    expect(staffRoles.findAll).toHaveBeenCalledTimes(2);
  });
});
