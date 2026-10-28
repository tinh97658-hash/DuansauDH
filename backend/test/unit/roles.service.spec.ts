import { BadRequestException, ConflictException } from "@nestjs/common";
import { RolesService } from "../../src/roles/roles.service.js";

const roleRecord = (overrides: any = {}) => {
  const record: any = {
    id: "r1",
    code: "custom",
    name: "Vai trò tùy tạo",
    description: null,
    isSystem: false,
    isSuperadmin: false,
    active: true,
    sortOrder: 100,
    permissions: [],
    update: jest.fn(async function (this: any, changes: any) { Object.assign(this, changes); return this; }),
    destroy: jest.fn(),
    ...overrides,
  };
  record.get = () => ({ ...record, permissions: record.permissions });
  return record;
};

const build = () => {
  const roles = { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn() };
  const permissions = { findAll: jest.fn().mockResolvedValue([]), count: jest.fn() };
  const rolePermissions = { findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn(), destroy: jest.fn() };
  const staffRoles = { findAll: jest.fn(), count: jest.fn() };
  const sequelize = { transaction: jest.fn((callback: any) => callback({})) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const rbac = { invalidate: jest.fn() };
  const administrationSafety = { lock: jest.fn(), assertRetained: jest.fn() };

  const service = new RolesService(
    roles as any, permissions as any, rolePermissions as any, staffRoles as any,
    sequelize as any, audit as any, rbac as any, administrationSafety as any,
  );
  return { service, roles, permissions, rolePermissions, staffRoles, audit, rbac, administrationSafety };
};

describe("RolesService", () => {
  it('ignores obsolete client scope choices and derives scope from granted actions', async () => {
    const { service, permissions } = build();
    permissions.findAll.mockResolvedValue([{ id: 'schedule', code: 'scheduling.write' }]);
    await expect((service as any).prepareScopes(['schedule'], { 'scheduling.write': 'related_offerings' }, {}))
      .resolves.toEqual([{ permissionId: 'schedule', scope: 'institution' }]);
  });
  it("không cho trùng mã vai trò", async () => {
    const { service, roles } = build();
    roles.findOne.mockResolvedValue(roleRecord({ code: "custom" }));
    await expect(service.create("actor", { code: "custom", name: "Trùng" } as any, {})).rejects.toThrow(ConflictException);
  });

  it("từ chối quyền không tồn tại", async () => {
    const { service } = build();
    await expect(service.create("actor", { code: "new", name: "Mới", permissionIds: ["missing"] } as any, {})).rejects.toThrow(BadRequestException);
  });

  it("không cho xóa vai trò hệ thống", async () => {
    const { service, roles } = build();
    roles.findByPk.mockResolvedValue(roleRecord({ isSystem: true }));
    await expect(service.remove("actor", "r1", {})).rejects.toThrow(ConflictException);
  });

  it("không cho xóa vai trò đang được gán", async () => {
    const { service, roles, staffRoles } = build();
    roles.findByPk.mockResolvedValue(roleRecord({ isSystem: false }));
    staffRoles.count.mockResolvedValue(2);
    await expect(service.remove("actor", "r1", {})).rejects.toThrow(ConflictException);
  });

  it("xóa vai trò không còn được gán", async () => {
    const { service, roles, staffRoles, rolePermissions, rbac } = build();
    const record = roleRecord();
    roles.findByPk.mockResolvedValue(record);
    staffRoles.count.mockResolvedValue(0);

    const result = await service.remove("actor", "r1", {});

    expect(rolePermissions.destroy).toHaveBeenCalled();
    expect(record.destroy).toHaveBeenCalled();
    expect(rbac.invalidate).toHaveBeenCalled();
    expect(result.message).toContain("xóa");
  });

  it("cập nhật quyền thay thế toàn bộ và xóa cache RBAC", async () => {
    const { service, roles, permissions, rolePermissions, rbac } = build();
    roles.findByPk.mockResolvedValue(roleRecord({ permissions: [] }));
    permissions.count.mockResolvedValue(2);

    await service.setPermissions("actor", "r1", { permissionIds: ["p1", "p2"] } as any, {});

    expect(rolePermissions.destroy).toHaveBeenCalledWith({ where: { roleId: "r1" }, transaction: {} });
    expect(rolePermissions.bulkCreate).toHaveBeenCalledWith(
      [{ roleId: "r1", permissionId: "p1" }, { roleId: "r1", permissionId: "p2" }],
      { transaction: {} },
    );
    expect(rbac.invalidate).toHaveBeenCalled();
  });
  it("không cho gỡ quyền quản trị cuối qua ma trận admin", async () => {
    const { service, roles, administrationSafety } = build();
    roles.findByPk.mockResolvedValue(roleRecord({ code: "admin", isSystem: true }));
    administrationSafety.assertRetained.mockRejectedValue(new ConflictException());
    await expect(service.setPermissions("actor", "r1", { permissionIds: [] } as any, {})).rejects.toThrow(ConflictException);
    expect(administrationSafety.lock).toHaveBeenCalledWith({});
  });
  it("cho phép tắt admin khi vẫn còn nhân sự có đủ quyền quản trị", async () => {
    const { service, roles, administrationSafety } = build();
    const record = roleRecord({ code: "admin", isSystem: true });
    roles.findByPk.mockResolvedValue(record);
    await service.update("actor", "r1", { active: false } as any, {});
    expect(record.update).toHaveBeenCalledWith({ active: false }, { transaction: {} });
    expect(administrationSafety.assertRetained).toHaveBeenCalledWith({});
  });

});
