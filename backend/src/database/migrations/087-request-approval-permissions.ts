import type { QueryInterface } from 'sequelize';
import { PERMISSIONS } from '../../auth/permissions.js';

const codes = ['studyleave.request', 'studyleave.approve', 'majortransfer.request', 'majortransfer.approve'];
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    for (const permission of PERMISSIONS.filter(value => codes.includes(value.code))) {
      await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
        VALUES(gen_random_uuid(),:code,:name,:group,:description,:sort,now(),now())
        ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,"group"=EXCLUDED."group",description=EXCLUDED.description,updated_at=now()`,
      { transaction, replacements: { ...permission, sort: PERMISSIONS.indexOf(permission) } });
    }
    // Preserve existing request access; never give a non-admin approval access.
    await qi.sequelize.query(`
      INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p
      WHERE p.code IN (:codes) AND (r.code='admin' OR (
        p.code IN ('studyleave.request','majortransfer.request') AND EXISTS (
          SELECT 1 FROM role_permissions old JOIN permissions legacy ON legacy.id=old.permission_id
          WHERE old.role_id=r.id AND legacy.code=CASE p.code WHEN 'studyleave.request' THEN 'studyleave.manage' ELSE 'admission.manage' END)))
      ON CONFLICT(role_id,permission_id) DO NOTHING;
      DELETE FROM role_permission_scopes WHERE permission_id IN (SELECT id FROM permissions WHERE code='studyleave.manage');
      DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code='studyleave.manage');
      DELETE FROM permissions WHERE code='studyleave.manage';
      INSERT INTO role_permission_scopes(role_id,permission_id,scope)
      SELECT rp.role_id,rp.permission_id,'institution' FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
      WHERE p.code IN ('studyleave.request','studyleave.approve') ON CONFLICT(role_id,permission_id) DO NOTHING;
      DO $$ DECLARE definition text; BEGIN
        definition := pg_get_functiondef('app_academic_write()'::regprocedure);
        definition := replace(definition,
          'WHEN ''studyleave'' THEN public.app_institution_permission(''studyleave.manage'',true)',
          'WHEN ''studyleave'' THEN current_setting(''app.academic_permission'',true) IN (''studyleave.request'',''studyleave.approve'') AND public.app_institution_permission(current_setting(''app.academic_permission'',true),true)');
        EXECUTE definition;
      END $$;
    `, { transaction, replacements: { codes } });
  });
}

export async function down() {
  throw new Error('Không khôi phục quyền tạo và duyệt dùng chung. Hãy cấu hình lại quyền có kiểm soát.');
}
