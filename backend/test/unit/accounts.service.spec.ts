import { BadRequestException, ConflictException } from "@nestjs/common";
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
  const staffRoles = { findAll: jest.fn(), count: jest.fn(), bulkCreate: jest.fn(), destroy: jest.fn() };
  const sequelize = { transaction: jest.fn((callback: any) => callback({})) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const rbac = { invalidate: jest.fn() };

  const service = new AccountsService(staff, roles as any, staffRoles as any, sequelize as any, audit as any, rbac as any);
  return { service, staff, roles, staffRoles, audit, rbac };
};

describe("AccountsService", () => {
  it("tạo tài khoản sinh mật khẩu, bắt đổi mật khẩu và gán vai trò", async () => {
    const { service, staff, roles, staffRoles, audit, rbac } = build();
    staff.findOne.mockResolvedValue(null);
    roles.findAll.mockResolvedValue([{ id: "r-admin", code: "admin" }]);
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
    const { service, staff, roles, staffRoles } = build();
    staff.findByPk.mockResolvedValue(staffRecord());
    roles.findAll.mockResolvedValue([{ id: "r-supervisor", code: "supervisor" }]);
    staffRoles.count.mockResolvedValue(1); // đang là superadmin
    roles.count.mockResolvedValue(0); // vai trò mới không phải superadmin
    staff.findAll.mockResolvedValue([{ id: "s1" }]); // chỉ còn 1 superadmin

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

    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ status: "disabled", sessionVersion: 2 }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "account.disable" }));
  });
});
