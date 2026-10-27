import { randomUUID } from 'node:crypto';
import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE class_groups ADD COLUMN responsible_staff_id uuid REFERENCES staff(id) ON DELETE RESTRICT;
      CREATE INDEX class_groups_responsible_staff_idx ON class_groups(responsible_staff_id);
      ALTER TABLE roles ADD COLUMN restrict_group_view boolean NOT NULL DEFAULT false,
        ADD COLUMN restrict_group_edit boolean NOT NULL DEFAULT false,
        ADD COLUMN group_read_only boolean NOT NULL DEFAULT false;
    `, { transaction });
    await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
      VALUES (:id,'groups.assign','Phân công chuyên viên phụ trách nhóm','Nhóm học viên',
      'Gán hoặc đổi chuyên viên phụ trách. Không tự cấp quyền sửa nhóm hay dữ liệu học viên.',40,now(),now())
      ON CONFLICT(code) DO NOTHING`, { replacements: { id: randomUUID() }, transaction });
    await qi.sequelize.query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p
      WHERE r.code='admin' AND p.code='groups.assign' ON CONFLICT DO NOTHING`, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`ALTER TABLE class_groups DROP COLUMN responsible_staff_id;
      ALTER TABLE roles DROP COLUMN restrict_group_view, DROP COLUMN restrict_group_edit, DROP COLUMN group_read_only;
      DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code='groups.assign');
      DELETE FROM permissions WHERE code='groups.assign';`, { transaction });
  });
}
