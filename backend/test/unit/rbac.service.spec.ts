import { RbacService } from "../../src/auth/rbac.service.js";

const role = (code: string, permissionCodes: string[], active = true) => ({
  code,
  active,
  permissions: permissionCodes.map((permissionCode) => ({ code: permissionCode })),
});

describe("RbacService", () => {
  const build = () => {
    const roles = { findOne: jest.fn() };
    const staffRoles = { findAll: jest.fn().mockResolvedValue([]) };
    const service = new RbacService(roles as any, staffRoles as any);
    return { service, roles, staffRoles };
  };

  it('preserves permission/scope/role pairs when multiple roles are combined', async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([
      { role: { ...role('viewer', []), id: 'viewer', schedulingScopeVersion: 1,
        permissions: [{ id: 'view', code: 'scheduling.view' }], permissionScopes: [{ permissionId: 'view', scope: 'institution' }] } },
      { role: { ...role('writer', []), id: 'writer', schedulingScopeVersion: 1,
        permissions: [{ id: 'write', code: 'scheduling.write' }], permissionScopes: [{ permissionId: 'write', scope: 'related_offerings' }] } },
      { role: { ...role('unscoped', []), id: 'unscoped', schedulingScopeVersion: 1,
        permissions: [{ id: 'organize', code: 'scheduling.organize' }], permissionScopes: [] } },
    ]);
    const access = await service.effectiveAccess({ id: 'a' });
    expect(access.schedulingGrants).toEqual([
      { roleId: 'viewer', permission: 'scheduling.view', scope: 'institution' },
      { roleId: 'writer', permission: 'scheduling.write', scope: 'institution' },
      { roleId: 'unscoped', permission: 'scheduling.organize', scope: 'institution' },
    ]);
    expect(access.permissions.has('gradebook.approve')).toBe(false);
  });

  it('refreshes write decisions even while a cached read still exists', async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValueOnce([{ role: role('writer', ['scheduling.write']) }]).mockResolvedValueOnce([]);
    expect((await service.effectiveAccess({ id: 'a' })).permissions.has('scheduling.write')).toBe(true);
    expect((await service.effectiveAccess({ id: 'a' }, true)).permissions.has('scheduling.write')).toBe(false);
  });

  it("hợp quyền của mọi vai trò được gán", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([
      { role: role("supervisor", ["catalog.view", "gradebook.view"]) },
      { role: role("examiner", ["gradebook.view", "gradebook.approve"]) },
    ]);

    const access = await service.effectiveAccess({ id: "s1", role: "supervisor" });

    expect([...access.permissions].sort()).toEqual(["catalog.view", "gradebook.approve", "gradebook.view"]);
    expect(access.roleCodes).toEqual(["supervisor", "examiner"]);
  });

  it("admin chỉ nhận quyền đã gán trong ma trận", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([{ role: role("admin", ["catalog.view"]) }]);
    const access = await service.effectiveAccess({ id: "s1", role: "admin" });
    expect([...access.permissions]).toEqual(["catalog.view"]);
    expect(access.permissions.has("role.manage")).toBe(false);
  });

  it("không cấp quyền từ vai trò bị tắt, kể cả admin", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([
      { role: role("admin", ["role.manage"], false) },
      { role: role("custom", ["catalog.view"]) },
    ]);
    const access = await service.effectiveAccess({ id: "s1", role: "admin" });
    expect([...access.permissions]).toEqual(["catalog.view"]);
    expect(access.roleCodes).toEqual(["custom"]);
  });

  it("fallback cũng không cấp quyền từ vai trò bị tắt", async () => {
    const { service, roles } = build();
    roles.findOne.mockResolvedValue(role("admin", ["role.manage"], false));
    expect([...(await service.effectiveAccess({ id: "s1", role: "admin" })).permissions]).toEqual([]);
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
  it("không tái dùng cache quyền khi session version đã đổi", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValueOnce([{ role: role("admin", ["role.manage"]) }]).mockResolvedValueOnce([{ role: role("custom", ["catalog.view"]) }]);
    await service.effectiveAccess({ id: "s1", sessionVersion: 0 });
    const access = await service.effectiveAccess({ id: "s1", sessionVersion: 1 });
    expect([...access.permissions]).toEqual(["catalog.view"]);
    expect(staffRoles.findAll).toHaveBeenCalledTimes(2);
  });


  it("defaults scope locks to off, combines explicit locks and ignores disabled roles", async () => {
    const { service, staffRoles } = build();
    staffRoles.findAll.mockResolvedValue([{ role: role("custom", ["masters.view"]) }]);
    expect((await service.effectiveAccess({ id: "a" })).groupScope).toEqual({ restrictView: false, restrictEdit: false, readOnly: false });
    staffRoles.findAll.mockResolvedValue([
      { role: { ...role("custom", ["masters.manage"]), restrictGroupEdit: true } },
      { role: { ...role("reader", ["masters.view"]), groupReadOnly: true } },
      { role: { ...role("disabled", [], false), restrictGroupView: true } },
    ]);
    expect((await service.effectiveAccess({ id: "b" })).groupScope).toEqual({ restrictView: false, restrictEdit: true, readOnly: true });
  });
});
