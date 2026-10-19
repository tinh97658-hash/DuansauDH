import { randomUUID } from "node:crypto";
import { DataTypes } from "sequelize";

/** Replace implicit superadmin access with explicit permission assignments. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`INSERT INTO permissions (id, code, name, "group", sort_order, created_at, updated_at)
      VALUES (:id, 'scheduling.organize', 'Tổ chức lớp học phần', 'Lớp học phần & xếp lịch', 17, now(), now())
      ON CONFLICT (code) DO NOTHING`, { replacements: { id: randomUUID() }, transaction });
    // Preserve access for roles that previously bypassed all checks, including customized installations.
    await qi.sequelize.query(`INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
      SELECT r.id, p.id, now(), now() FROM roles r CROSS JOIN permissions p WHERE r.is_superadmin = true
      ON CONFLICT DO NOTHING`, { transaction });
    await qi.removeColumn("roles", "is_superadmin", { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("roles", "is_superadmin", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, { transaction });
    await qi.sequelize.query("UPDATE roles SET is_superadmin = true WHERE code = 'admin'", { transaction });
    // Keep explicit permissions to avoid losing configured access during rollback.
  });
}
