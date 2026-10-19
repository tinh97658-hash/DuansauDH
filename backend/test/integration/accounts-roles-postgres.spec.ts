import { randomUUID } from "node:crypto";
import { jest } from "@jest/globals";
import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/sequelize";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { AccountsService } from "../../src/accounts/accounts.service.js";
import { AppModule } from "../../src/app.module.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { StaffRole } from "../../src/database/models/staff-role.model.js";
import { RolesService } from "../../src/roles/roles.service.js";

const describeDb = process.env.RUN_POSTGRES_ACCOUNT_TESTS === "true" ? describe : describe.skip;

// Quản lý tài khoản & phân quyền trên PostgreSQL thật (đã chạy migration 062/063).
// Mọi bản ghi nằm trong một transaction bị rollback, nên không cần dọn dữ liệu và
// không đụng tới dữ liệu nghiệp vụ.
describeDb("Staff account and role administration PostgreSQL integration", () => {
  let app: INestApplicationContext;
  let db: Sequelize;
  let tx: Transaction;
  let accounts: AccountsService;
  let roles: RolesService;
  let rbac: RbacService;
  let actor: Staff;
  let triggerAudit = false;
  const prefix = `tk${randomUUID().replace(/-/g, "").slice(0, 9)}`;
  const context = { ip: "127.0.0.1", userAgent: "jest-integration" };

  const select = async (sql: string, replacements: Record<string, unknown> = {}) =>
    (await db.query(sql, { type: QueryTypes.SELECT, replacements })) as unknown as Array<Record<string, any>>;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = app.get<Sequelize>(getConnectionToken());
    accounts = app.get(AccountsService);
    roles = app.get(RolesService);
    rbac = app.get(RbacService);

    const [present] = (await db.query("SELECT to_regclass('public.db_change_logs') AS present", {
      type: QueryTypes.SELECT,
    })) as unknown as Array<{ present: string | null }>;
    triggerAudit = Boolean(present?.present);

    tx = await db.transaction();
    const query = db.query.bind(db);
    jest.spyOn(db, "query").mockImplementation(((sql: any, options: any) =>
      query(sql, { ...options, transaction: tx, logging: false }).catch((error: any) => {
        throw new Error(error.original?.message || error.message);
      })) as any);
    jest.spyOn(db, "transaction").mockImplementation((async (callback: any) => callback(tx)) as any);

    actor = await Staff.create({ name: `${prefix} Actor`, email: `${prefix}.actor@example.invalid`.toLowerCase(), role: "admin" });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    try {
      await tx?.rollback();
    } finally {
      await app?.close();
    }
  });

  const createCustomRole = async (suffix: string, permissionIds: string[] = []) => {
    const created = await roles.create(
      actor.id,
      { code: `${prefix}-${suffix}`, name: `Vai trò ${suffix}`, permissionIds } as any,
      context,
    );
    return created.data.id as string;
  };

  it("tạo tài khoản với mật khẩu sinh tự động, gán vai trò và ghi nhật ký thao tác", async () => {
    const permission = await select("SELECT id FROM permissions WHERE code = 'account.view'");
    const roleId = await createCustomRole("creator", permission.map((row) => row.id));

    const created = await accounts.create(
      actor.id,
      { name: "Nguyễn Văn Tạo", email: `${prefix}.created@example.invalid`.toLowerCase(), roleIds: [roleId], primaryRoleId: roleId } as any,
      context,
    );

    expect(created.generatedPassword).toBeTruthy();
    expect(created.data).toMatchObject({
      email: `${prefix}.created@example.invalid`,
      role: `${prefix}-creator`,
      status: "active",
      mustChangePassword: true,
    });
    expect(created.data.roles.map((role: any) => role.code)).toEqual([`${prefix}-creator`]);

    const memberships = await select("SELECT role_id FROM staff_roles WHERE staff_id = :id", { id: created.data.id });
    expect(memberships.map((row) => row.role_id)).toEqual([roleId]);

    const audit = await select(
      "SELECT action, actor_staff_id, target_staff_id FROM auth_audit_logs WHERE action = 'account.create' AND target_staff_id = :id",
      { id: created.data.id },
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_staff_id: actor.id, target_staff_id: created.data.id });

    if (triggerAudit) {
      const changed = await select(
        "SELECT DISTINCT table_name FROM db_change_logs WHERE operation = 'INSERT' AND table_name IN ('staff', 'staff_roles')",
      );
      expect(changed.map((row) => row.table_name).sort()).toEqual(["staff", "staff_roles"]);
    }
  });

  it("từ chối email trùng và không ghi thêm nhật ký tạo", async () => {
    const roleId = await createCustomRole("dup");
    const email = `${prefix}.dup@example.invalid`.toLowerCase();
    await accounts.create(actor.id, { name: "Trùng Một", email, roleIds: [roleId] } as any, context);
    const before = await select("SELECT count(*)::int AS total FROM auth_audit_logs WHERE action = 'account.create'");

    await expect(
      accounts.create(actor.id, { name: "Trùng Hai", email, roleIds: [roleId] } as any, context),
    ).rejects.toThrow("đã được sử dụng");

    const after = await select("SELECT count(*)::int AS total FROM auth_audit_logs WHERE action = 'account.create'");
    expect(after[0].total).toBe(before[0].total);
  });

  it("khóa tài khoản làm tăng session version, chặn tự khóa và buộc đăng xuất mọi phiên", async () => {
    const target = await Staff.create({ name: `${prefix} Target`, email: `${prefix}.target@example.invalid`.toLowerCase(), role: "examiner" });
    const initialVersion = target.sessionVersion;

    await expect(accounts.updateStatus(actor.id, actor.id, { status: "disabled" } as any, context)).rejects.toThrow("tự khóa");

    await accounts.updateStatus(actor.id, target.id, { status: "disabled" } as any, context);
    await target.reload();
    expect(target.status).toBe("disabled");
    expect(target.sessionVersion).toBe(initialVersion + 1);

    await accounts.revokeSessions(actor.id, target.id, context);
    await target.reload();
    expect(target.sessionVersion).toBe(initialVersion + 2);

    const actions = await select("SELECT action FROM auth_audit_logs WHERE target_staff_id = :id ORDER BY action", { id: target.id });
    expect(actions.map((row) => row.action)).toEqual(["account.disable", "account.sessions.revoke"]);
  });

  it("đặt lại mật khẩu, buộc đổi ở lần đăng nhập kế tiếp và ghi nhật ký", async () => {
    const target = await Staff.create({
      name: `${prefix} Reset`,
      email: `${prefix}.reset@example.invalid`.toLowerCase(),
      role: "examiner",
      mustChangePassword: false,
    });
    const initialVersion = target.sessionVersion;

    const result = await accounts.resetPassword(actor.id, target.id, {} as any, context);
    await target.reload();
    expect(result.generatedPassword).toBeTruthy();
    expect(target.mustChangePassword).toBe(true);
    expect(target.sessionVersion).toBe(initialVersion + 1);

    const audit = await select("SELECT metadata FROM auth_audit_logs WHERE action = 'account.password.reset' AND target_staff_id = :id", {
      id: target.id,
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ passwordGenerated: true });
  });

  it("tạo, đổi quyền và xóa vai trò tùy tạo, bảo vệ vai trò hệ thống và phản ánh vào quyền hiệu lực", async () => {
    const [viewAccount, viewRole] = await select(
      "SELECT id, code FROM permissions WHERE code IN ('account.view', 'role.view') ORDER BY code",
    );
    const roleId = await createCustomRole("lifecycle", [viewAccount.id]);

    const created = await roles.detail(roleId);
    expect(created.permissions.map((permission: any) => permission.code)).toEqual([viewAccount.code]);

    const member = await Staff.create({ name: `${prefix} Member`, email: `${prefix}.member@example.invalid`.toLowerCase(), role: "examiner" });
    await StaffRole.create({ staffId: member.id, roleId });
    const access = await rbac.effectiveAccess(member);
    expect(access.permissions.has(viewAccount.code)).toBe(true);
    expect(access.roleCodes).toEqual([`${prefix}-lifecycle`]);

    await roles.setPermissions(actor.id, roleId, { permissionIds: [viewRole.id] } as any, context);
    const updated = await roles.detail(roleId);
    expect(updated.permissions.map((permission: any) => permission.code)).toEqual([viewRole.code]);
    expect((await select("SELECT action FROM auth_audit_logs WHERE action = 'role.permissions.update'")).length).toBeGreaterThanOrEqual(1);
    if (triggerAudit) {
      const operations = await select("SELECT operation FROM db_change_logs WHERE table_name = 'role_permissions' ORDER BY id");
      expect(operations.map((row) => row.operation)).toEqual(expect.arrayContaining(["DELETE", "INSERT"]));
    }

    await roles.setPermissions(actor.id, roleId, { permissionIds: [] } as any, context);
    await StaffRole.destroy({ where: { staffId: member.id, roleId } });
    await roles.remove(actor.id, roleId, context);
    expect(await select("SELECT id FROM roles WHERE id = :id", { id: roleId })).toHaveLength(0);
    expect((await select("SELECT action FROM auth_audit_logs WHERE action = 'role.delete'")).length).toBeGreaterThanOrEqual(1);

    const systemRole = await select("SELECT id FROM roles WHERE is_system = true LIMIT 1");
    await expect(roles.remove(actor.id, systemRole[0].id, context)).rejects.toThrow("hệ thống");
  });
});
