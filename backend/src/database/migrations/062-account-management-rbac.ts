/**
 * 062 — QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (RBAC)
 *
 * 1. Bảng `roles`, `permissions`, `role_permissions`, `staff_roles` cho mô hình RBAC
 *    đa vai trò: quyền hiệu lực = hợp quyền của mọi vai trò được gán.
 * 2. Bảng `auth_audit_logs` ghi nhật ký thao tác tài khoản / phân quyền.
 * 3. Bổ sung trường vòng đời tài khoản cho `staff`: status, session_version,
 *    must_change_password, last_login_at, password_changed_at.
 * 4. Chuyển `staff.role` từ ENUM sang VARCHAR(50) để chấp nhận vai trò tùy tạo
 *    (giữ nguyên giá trị cũ; đây là vai trò chính dùng cho tương thích `user.role`).
 * 5. Seed 3 vai trò hệ thống, catalog quyền và bộ quyền mặc định theo hành vi cũ.
 * 6. Backfill `staff_roles` từ `staff.role` hiện có.
 */
import { randomUUID } from "node:crypto";
import { DataTypes } from "sequelize";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "../../auth/permissions.js";

const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };
const timestamps = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // ===== 1. roles =====
    await qi.createTable("roles", {
      id: uuid,
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_superadmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(),
    }, { transaction });

    // ===== 2. permissions =====
    await qi.createTable("permissions", {
      id: uuid,
      code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      group: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps(),
    }, { transaction });

    // ===== 3. role_permissions =====
    await qi.createTable("role_permissions", {
      role_id: {
        type: DataTypes.UUID, primaryKey: true,
        references: { model: "roles", key: "id" }, onDelete: "CASCADE",
      },
      permission_id: {
        type: DataTypes.UUID, primaryKey: true,
        references: { model: "permissions", key: "id" }, onDelete: "CASCADE",
      },
      ...timestamps(),
    }, { transaction });
    await qi.addIndex("role_permissions", ["permission_id"], { name: "role_permissions_permission_idx", transaction });

    // ===== 4. staff_roles =====
    await qi.createTable("staff_roles", {
      staff_id: {
        type: DataTypes.UUID, primaryKey: true,
        references: { model: "staff", key: "id" }, onDelete: "CASCADE",
      },
      role_id: {
        type: DataTypes.UUID, primaryKey: true,
        references: { model: "roles", key: "id" }, onDelete: "RESTRICT",
      },
      ...timestamps(),
    }, { transaction });
    await qi.addIndex("staff_roles", ["role_id"], { name: "staff_roles_role_idx", transaction });

    // ===== 5. auth_audit_logs =====
    await qi.createTable("auth_audit_logs", {
      id: uuid,
      actor_staff_id: {
        type: DataTypes.UUID, allowNull: true,
        references: { model: "staff", key: "id" }, onDelete: "SET NULL",
      },
      target_staff_id: {
        type: DataTypes.UUID, allowNull: true,
        references: { model: "staff", key: "id" }, onDelete: "SET NULL",
      },
      action: { type: DataTypes.STRING(60), allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps(),
    }, { transaction });
    await qi.addIndex("auth_audit_logs", ["created_at"], { name: "auth_audit_logs_created_idx", transaction });
    await qi.addIndex("auth_audit_logs", ["target_staff_id"], { name: "auth_audit_logs_target_idx", transaction });
    await qi.addIndex("auth_audit_logs", ["action"], { name: "auth_audit_logs_action_idx", transaction });

    // ===== 6. Trường vòng đời tài khoản cho staff =====
    await qi.addColumn("staff", "status", {
      type: DataTypes.ENUM("active", "disabled"), allowNull: false, defaultValue: "active",
    }, { transaction });
    await qi.addColumn("staff", "session_version", {
      type: DataTypes.INTEGER, allowNull: false, defaultValue: 0,
    }, { transaction });
    await qi.addColumn("staff", "must_change_password", {
      type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    }, { transaction });
    await qi.addColumn("staff", "last_login_at", { type: DataTypes.DATE, allowNull: true }, { transaction });
    await qi.addColumn("staff", "password_changed_at", { type: DataTypes.DATE, allowNull: true }, { transaction });

    // ===== 7. staff.role: ENUM -> VARCHAR(50) =====
    await qi.sequelize.query('ALTER TABLE staff ALTER COLUMN role TYPE VARCHAR(50) USING role::text', { transaction });
    await qi.sequelize.query('DROP TYPE IF EXISTS "enum_staff_role"', { transaction });

    // ===== 8. Seed vai trò hệ thống =====
    const now = new Date();
    const roleRows = SYSTEM_ROLES.map((role, index) => ({
      id: randomUUID(),
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      is_system: true,
      is_superadmin: Boolean(role.isSuperadmin),
      sort_order: index,
      active: true,
      created_at: now,
      updated_at: now,
    }));
    await qi.bulkInsert("roles", roleRows, { transaction });

    // ===== 9. Seed catalog quyền =====
    const permissionRows = PERMISSIONS.map((permission, index) => ({
      id: randomUUID(),
      code: permission.code,
      name: permission.name,
      group: permission.group,
      description: permission.description ?? null,
      sort_order: index,
      created_at: now,
      updated_at: now,
    }));
    await qi.bulkInsert("permissions", permissionRows, { transaction });

    // ===== 10. Seed bộ quyền mặc định cho vai trò hệ thống =====
    const roleIdByCode = new Map(roleRows.map((role) => [role.code, role.id]));
    const permissionIdByCode = new Map(permissionRows.map((permission) => [permission.code, permission.id]));
    const rolePermissionRows: Array<Record<string, unknown>> = [];
    for (const [roleCode, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleIdByCode.get(roleCode);
      if (!roleId) continue;
      for (const code of permissionCodes) {
        const permissionId = permissionIdByCode.get(code);
        if (permissionId) {
          rolePermissionRows.push({ role_id: roleId, permission_id: permissionId, created_at: now, updated_at: now });
        }
      }
    }
    await qi.bulkInsert("role_permissions", rolePermissionRows, { transaction });

    // ===== 11. Backfill staff_roles từ staff.role =====
    await qi.sequelize.query(`
      INSERT INTO staff_roles (staff_id, role_id, created_at, updated_at)
      SELECT s.id, r.id, NOW(), NOW()
      FROM staff s
      JOIN roles r ON r.code = s.role
      ON CONFLICT (staff_id, role_id) DO NOTHING
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // staff.role: VARCHAR(50) -> ENUM (giá trị lạ rơi về 'examiner' để an toàn)
    await qi.sequelize.query(`
      CREATE TYPE "enum_staff_role" AS ENUM ('admin', 'supervisor', 'examiner');
      ALTER TABLE staff ALTER COLUMN role TYPE "enum_staff_role"
        USING (CASE WHEN role IN ('admin', 'supervisor', 'examiner') THEN role ELSE 'examiner' END)::"enum_staff_role";
    `, { transaction });

    await qi.removeColumn("staff", "password_changed_at", { transaction });
    await qi.removeColumn("staff", "last_login_at", { transaction });
    await qi.removeColumn("staff", "must_change_password", { transaction });
    await qi.removeColumn("staff", "session_version", { transaction });
    await qi.removeColumn("staff", "status", { transaction });

    await qi.dropTable("auth_audit_logs", { transaction });
    await qi.dropTable("staff_roles", { transaction });
    await qi.dropTable("role_permissions", { transaction });
    await qi.dropTable("permissions", { transaction });
    await qi.dropTable("roles", { transaction });

    await qi.sequelize.query('DROP TYPE IF EXISTS "enum_staff_status"', { transaction });
  });
}
