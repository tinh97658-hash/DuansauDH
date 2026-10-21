import { BadRequestException, ConflictException } from "@nestjs/common";
import { Op } from "sequelize";
import { AccountsService } from "../../src/accounts/accounts.service.js";

const staffRecord = (overrides: any = {}) => {
  const record: any = {
    id: "s1",
    name: "Nguyễn Văn A",
    email: "a@example.com",
    role: "admin",
    status: "active",
    mustChangePassword: false,
    lastLoginAt: null,
    passwordChangedAt: null,
    canManageScheduling: false,
    createdAt: new Date(),
    roles: [],
    increment: jest.fn(),
    reload: jest.fn(async function (this: any) { return this; }),
    update: jest.fn(async function (this: any, changes: any) { Object.assign(this, changes); return this; }),
    ...overrides,
  };
  record.get = () => ({ ...record, roles: record.roles });
  return record;
};

const build = () => {
  const staff: any = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  };
  staff.scope = jest.fn(() => ({ findByPk: staff.findByPk, findAll: staff.findAll }));
  const roles = { findAll: jest.fn(), count: jest.fn() };
  const staffRoles = { findAll: jest.fn().mockResolvedValue([]), count: jest.fn(), bulkCreate: jest.fn(), destroy: jest.fn() };
  const sequelize = { transaction: jest.fn((callback: any) => callback({})) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const changeLog = { list: jest.fn(), tables: jest.fn() };
  const rbac = { invalidate: jest.fn() };
  const administrationSafety = { lock: jest.fn(), assertRetained: jest.fn() };

  const service = new AccountsService(staff, roles as any, staffRoles as any, sequelize as any, audit as any, changeLog as any, rbac as any, administrationSafety as any);
  return { service, staff, roles, staffRoles, audit, changeLog, rbac, administrationSafety };
};

describe("AccountsService", () => {
  it("tạo tài khoản sinh mật khẩu, bắt đổi mật khẩu và gán vai trò", async () => {
    const { service, staff, roles, staffRoles, audit, rbac } = build();
    staff.findOne.mockResolvedValue(null);
    roles.findAll.mockResolvedValue([{ id: "r-admin", code: "admin", active: true }]);
    const created = staffRecord({ id: "s-new", role: "admin" });
    staff.create.mockResolvedValue(created);
    staff.findByPk.mockResolvedValue(created);
    staffRoles.bulkCreate.mockResolvedValue([]);

    const result = await service.create("actor", { name: "Nhân sự mới", email: "NEW@Example.com", roleIds: ["r-admin"] } as any, {});

    const createArgs = staff.create.mock.calls[0][0];
    expect(createArgs.email).toBe("new@example.com");
    expect(createArgs.role).toBe("admin");
    expect(createArgs.mustChangePassword).toBe(true);
    expect(createArgs.password).not.toBeUndefined();
    expect(result.generatedPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(staffRoles.bulkCreate).toHaveBeenCalledWith([{ staffId: "s-new", roleId: "r-admin" }], { transaction: {} });
    expect(rbac.invalidate).toHaveBeenCalledWith("s-new");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.create", targetStaffId: "s-new" }));
  });

  it("không cho trùng email", async () => {
    const { service, staff } = build();
    staff.findOne.mockResolvedValue(staffRecord());
    await expect(service.create("actor", { name: "X", email: "a@example.com", roleIds: ["r-admin"] } as any, {})).rejects.toThrow(ConflictException);
  });

  it("từ chối vai trò không tồn tại", async () => {
    const { service, staff, roles } = build();
    staff.findOne.mockResolvedValue(null);
    roles.findAll.mockResolvedValue([]);
    await expect(service.create("actor", { name: "X", email: "x@example.com", roleIds: ["missing"] } as any, {})).rejects.toThrow(BadRequestException);
  });

  it("chặn gỡ vai trò quản trị cuối cùng", async () => {
    const { service, staff, roles, staffRoles, administrationSafety } = build();
    staff.findByPk.mockResolvedValue(staffRecord());
    roles.findAll.mockResolvedValue([{ id: "r-supervisor", code: "supervisor", active: true }]);
    administrationSafety.assertRetained.mockRejectedValue(new ConflictException());

    await expect(service.update("actor", "s1", { roleIds: ["r-supervisor"] } as any, {})).rejects.toThrow(ConflictException);
  });

  it("không cho tự khóa tài khoản đang đăng nhập", async () => {
    const { service, staff } = build();
    staff.findByPk.mockResolvedValue(staffRecord({ id: "me" }));
    await expect(service.updateStatus("me", "me", { status: "disabled" } as any, {})).rejects.toThrow(ConflictException);
  });

  it("đặt lại mật khẩu đặt cờ bắt đổi và tăng session_version", async () => {
    const { service, staff, audit } = build();
    const record = staffRecord({ sessionVersion: 4 });
    staff.findByPk.mockResolvedValue(record);

    const result = await service.resetPassword("actor", "s1", {} as any, {});

    expect(result.generatedPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true, sessionVersion: 5 }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.password.reset" }));
  });

  it("khóa tài khoản đẩy session_version để buộc đăng xuất", async () => {
    const { service, staff, audit } = build();
    const record = staffRecord({ id: "s2", sessionVersion: 1 });
    staff.findByPk.mockResolvedValue(record);
    staff.findAll.mockResolvedValue([]);

    await service.updateStatus("actor", "s2", { status: "disabled" } as any, {});

    expect(record.update).toHaveBeenCalledWith({ status: "disabled" }, { transaction: {} });
    expect(record.increment).toHaveBeenCalledWith("sessionVersion", { transaction: {} });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.disable" }));
  });
  it("đổi vai trò tăng version và kiểm tra quyền quản trị trong cùng transaction", async () => {
    const { service, staff, roles, administrationSafety } = build();
    const record = staffRecord();
    staff.findByPk.mockResolvedValue(record);
    roles.findAll.mockResolvedValue([{ id: "r-custom", code: "custom", active: true }]);
    await service.update("actor", "s1", { roleIds: ["r-custom"] } as any, {});
    expect(administrationSafety.lock).toHaveBeenCalledWith({});
    expect(record.increment).toHaveBeenCalledWith("sessionVersion", { transaction: {} });
    expect(administrationSafety.assertRetained).toHaveBeenCalledWith({});
  });

  it("sửa tên và gửi lại cùng vai trò không thu hồi phiên", async () => {
    const { service, staff, roles, staffRoles } = build();
    const record = staffRecord({ role: "custom" });
    staff.findByPk.mockResolvedValue(record);
    roles.findAll.mockResolvedValue([{ id: "r-custom", code: "custom", active: true }]);
    staffRoles.findAll.mockResolvedValue([{ roleId: "r-custom" }]);
    await service.update("actor", "s1", { name: "Tên mới", roleIds: ["r-custom"] } as any, {});
    expect(record.increment).not.toHaveBeenCalled();
    expect(staffRoles.destroy).not.toHaveBeenCalled();
  });

});

describe("Inactive account role assignment contract", () => {
  const active = { id: "active", code: "active", active: true };
  const dormant = { id: "dormant", code: "dormant", active: false };
  const setup = (existing = [active.id], primary = active.code) => {
    const fixtures = build();
    const record = staffRecord({ role: primary, roles: [active, dormant], sessionVersion: 0 });
    fixtures.staff.findOne.mockResolvedValue(null);
    fixtures.staff.findByPk.mockResolvedValue(record);
    fixtures.staff.create.mockResolvedValue(record);
    fixtures.staffRoles.findAll.mockResolvedValue(existing.map(roleId => ({ roleId })));
    fixtures.roles.findAll.mockImplementation(async (options: any) => {
      const ids = options.where.id[Op.in];
      return [active, dormant].filter(role => (ids as string[]).includes(role.id));
    });
    return { ...fixtures, record };
  };
  it.each([
    { roles: ["dormant"], primary: "dormant" },
    { roles: ["active", "dormant"], primary: "active" },
    { roles: ["active", "dormant"], primary: "dormant" },
    { roles: ["active"], primary: "dormant" },
  ])("rejects create with inactive/unassigned selection: %p", async ({ roles, primary }) => {
    const f = setup();
    await expect(f.service.create("actor", { name: "QA", email: "qa@example.invalid", roleIds: roles, primaryRoleId: primary, password: "test-password" }, {})).rejects.toThrow(BadRequestException);
    expect(f.staff.create).not.toHaveBeenCalled();expect(f.staffRoles.bulkCreate).not.toHaveBeenCalled();
  });
  it("accepts an active primary and exposes assignment active state", async () => {
    const f = setup();
    const result = await f.service.create("actor", { name: "QA", email: "qa@example.invalid", roleIds: [active.id], primaryRoleId: active.id, password: "test-password" }, {});
    expect(result.data.roles).toEqual([expect.objectContaining({ id: active.id, active: true }), expect.objectContaining({ id: dormant.id, active: false })]);
    expect(f.roles.findAll).toHaveBeenCalledWith(expect.objectContaining({ transaction: {}, order: [["id", "ASC"]] }));
  });
  it("rejects newly added dormant roles before any account mutation", async () => {
    const f = setup();
    await expect(f.service.update("actor", "s1", { name: "QA", roleIds: [active.id, dormant.id] }, {})).rejects.toThrow(BadRequestException);
    expect(f.record.update).not.toHaveBeenCalled();expect(f.staffRoles.destroy).not.toHaveBeenCalled();
  });
  it.each([false, true])("preserves an old inactive assignment on unrelated edit, role payload=%s", async resubmit => {
    const f = setup([active.id, dormant.id]);
    await f.service.update("actor", "s1", { name: "Renamed", ...(resubmit ? { roleIds: [dormant.id, active.id], primaryRoleId: active.id } : {}) }, {});
    expect(f.record.name).toBe("Renamed");expect(f.staffRoles.destroy).not.toHaveBeenCalled();expect(f.record.increment).not.toHaveBeenCalled();
  });
  it("rejects selecting an already assigned dormant role as a new primary", async () => {
    const f = setup([active.id, dormant.id]);
    await expect(f.service.update("actor", "s1", { primaryRoleId: dormant.id }, {})).rejects.toThrow(BadRequestException);
    expect(f.record.update).not.toHaveBeenCalled();
  });
  it("supports primary-only updates against existing assignments", async () => {
    const f = setup([active.id, dormant.id], dormant.code);
    await f.service.update("actor", "s1", { primaryRoleId: active.id }, {});
    expect(f.record.role).toBe(active.code);
    expect(f.staffRoles.bulkCreate).not.toHaveBeenCalled();expect(f.staffRoles.destroy).not.toHaveBeenCalled();
  });
  it("preserves an exact legacy form resubmission with inactive primary", async () => {
    const f = setup([active.id, dormant.id], dormant.code);
    await f.service.update("actor", "s1", { name: "Renamed", roleIds: [active.id, dormant.id], primaryRoleId: dormant.id }, {});
    expect(f.record.role).toBe(dormant.code);expect(f.staffRoles.destroy).not.toHaveBeenCalled();
  });
  it("selects an active primary when assignments are edited, retaining requested history", async () => {
    const f = setup([dormant.id], dormant.code);
    await f.service.update("actor", "s1", { roleIds: [dormant.id, active.id] }, {});
    expect(f.record.role).toBe(active.code);
    expect(f.staffRoles.bulkCreate).toHaveBeenCalledWith([{ staffId: "s1", roleId: active.id }], { transaction: {} });
    expect(f.staffRoles.destroy).not.toHaveBeenCalled();
  });
  it("does not retain an explicitly inactive primary while changing assignments", async () => {
    const f = setup([dormant.id], dormant.code);
    await expect(f.service.update("actor", "s1", { roleIds: [dormant.id, active.id], primaryRoleId: dormant.id }, {})).rejects.toThrow(BadRequestException);
  });
  it("rechecks the persisted primary after serialization before preserving history", async () => {
    const f = setup([active.id, dormant.id], dormant.code);
    f.record.reload.mockImplementation(async () => { f.record.role = active.code; return f.record; });
    await expect(f.service.update("actor", "s1", { roleIds: [active.id, dormant.id], primaryRoleId: dormant.id }, {})).rejects.toThrow(BadRequestException);
    expect(f.record.reload).toHaveBeenCalledWith({ transaction: {}, lock: "UPDATE" });
    expect(f.record.update).not.toHaveBeenCalled();
  });
  it("allows explicit removal of dormant history", async () => {
    const f = setup([active.id, dormant.id]);
    await f.service.update("actor", "s1", { roleIds: [active.id] }, {});
    expect(f.staffRoles.bulkCreate).not.toHaveBeenCalled();
    expect(f.staffRoles.destroy).toHaveBeenCalledWith({ where: { staffId: "s1", roleId: { [Op.in]: [dormant.id] } }, transaction: {} });
  });
});
