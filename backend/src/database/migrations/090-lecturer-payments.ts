import type { QueryInterface } from 'sequelize';
import { PERMISSIONS } from '../../auth/permissions.js';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`CREATE TABLE lecturer_payments (
      course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
      lecturer_id uuid NOT NULL REFERENCES lecturers(id) ON DELETE RESTRICT,
      paid boolean NOT NULL DEFAULT false,
      updated_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(course_offering_id,lecturer_id)
    );`, { transaction });
    const permission = PERMISSIONS.find(p => p.code==='reports.payments.manage')!;
    await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
      VALUES(gen_random_uuid(),:code,:name,:group,:description,:sort,now(),now()) ON CONFLICT(code) DO NOTHING;
      INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p
      WHERE r.code='admin' AND p.code=:code ON CONFLICT(role_id,permission_id) DO NOTHING;
      GRANT SELECT,INSERT,UPDATE ON lecturer_payments TO pgsms_group_scoped;
      ALTER TABLE lecturer_payments ENABLE ROW LEVEL SECURITY;
      CREATE POLICY payment_read ON lecturer_payments FOR SELECT TO pgsms_group_scoped
        USING (app_institution_permission('reports.view') AND app_scheduling_offering_allowed(course_offering_id));
      CREATE POLICY payment_insert ON lecturer_payments FOR INSERT TO pgsms_group_scoped
        WITH CHECK (app_institution_permission('reports.payments.manage',true) AND app_scheduling_offering_allowed(course_offering_id));
      CREATE POLICY payment_update ON lecturer_payments FOR UPDATE TO pgsms_group_scoped
        USING (app_institution_permission('reports.payments.manage',true) AND app_scheduling_offering_allowed(course_offering_id))
        WITH CHECK (app_institution_permission('reports.payments.manage',true) AND app_scheduling_offering_allowed(course_offering_id));`,
    { transaction, replacements: { ...permission, sort: PERMISSIONS.indexOf(permission) } });
  });
}

export async function down() {
  throw new Error('KhÃ´ng tá»± Ä‘á»™ng xÃ³a dá»¯ liá»‡u thanh toÃ¡n. HÃ£y sao lÆ°u trÆ°á»›c khi gá»¡ báº£ng.');
}
