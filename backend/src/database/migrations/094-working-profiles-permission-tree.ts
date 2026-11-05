import type { QueryInterface } from 'sequelize';
import { PERMISSIONS } from '../../auth/permissions.js';
import { permissionReadDependencies,permissionTreeMeta } from '../../auth/permission-tree.js';

export const PROFILE_PERMISSION_GUARD_SQL=`CREATE OR REPLACE FUNCTION app_role_permission_allowed(role_id uuid,wanted text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id
    WHERE rp.role_id=$1 AND p.code=$2 AND (
      COALESCE(current_setting('app.profile_enforced',true),'false')<>'true' OR NOT EXISTS (
        SELECT 1 FROM public.permission_requirements requirements WHERE requirements.permission_id=p.id
        AND NOT EXISTS(SELECT 1 FROM public.role_permissions granted WHERE granted.role_id=$1
          AND granted.permission_id=requirements.required_permission_id)))) $$;`;

export async function up({context:qi}:{context:QueryInterface}){
  await qi.sequelize.transaction(async transaction=>{
    for(const permission of PERMISSIONS.filter(value=>value.code.startsWith('module.'))){
      await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
        VALUES(gen_random_uuid(),:code,:name,:group,:description,:sort,now(),now()) ON CONFLICT(code)
        DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,updated_at=now()`,
        {transaction,replacements:{...permission,sort:PERMISSIONS.indexOf(permission)}});
    }
    await qi.sequelize.query(`CREATE TABLE permission_requirements(
      permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      required_permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY(permission_id,required_permission_id),CHECK(permission_id<>required_permission_id));
      GRANT SELECT ON permission_requirements TO pgsms_group_scoped;`,{transaction});
    for(const permission of PERMISSIONS.filter(value=>!value.code.startsWith('module.'))){
      const root=`module.${permissionTreeMeta(permission.code).moduleId}`;
      await qi.sequelize.query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
        SELECT old.role_id,parent.id,now(),now() FROM role_permissions old JOIN permissions child ON child.id=old.permission_id
        CROSS JOIN permissions parent WHERE child.code=:code AND parent.code=:root ON CONFLICT DO NOTHING;
        INSERT INTO permission_requirements(permission_id,required_permission_id)
        SELECT child.id,parent.id FROM permissions child CROSS JOIN permissions parent
        WHERE child.code=:code AND parent.code IN (:required) ON CONFLICT DO NOTHING`,
        {transaction,replacements:{code:permission.code,root,required:[root,...(permissionReadDependencies[permission.code]||[])]}});
    }
    await qi.sequelize.query(`
      INSERT INTO permission_requirements(permission_id,required_permission_id)
        SELECT direct.permission_id,parent.required_permission_id FROM permission_requirements direct
        JOIN permission_requirements parent ON parent.permission_id=direct.required_permission_id
        WHERE direct.permission_id<>parent.required_permission_id ON CONFLICT DO NOTHING;
      CREATE FUNCTION app_profile_role_allowed(role_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT
        COALESCE(current_setting('app.profile_enforced',true),'false')<>'true'
        OR role_id::text=NULLIF(current_setting('app.active_profile_id',true),'') $$;
      ${PROFILE_PERMISSION_GUARD_SQL}
      CREATE OR REPLACE FUNCTION app_institution_permission(wanted text,writing boolean DEFAULT false) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.roles r ON r.active AND public.app_profile_role_allowed(r.id) AND (
          EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
          OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND r.code=s.role))
        WHERE s.status='active' AND s.id::text=current_setting('app.group_staff_id',true)
          AND public.app_role_permission_allowed(r.id,wanted)
          AND (NOT writing OR (NOT r.group_read_only AND COALESCE(current_setting('app.group_read_only',true),'true')<>'true')))
      $$;
      CREATE OR REPLACE FUNCTION app_gradebook_admin() RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.roles r ON r.active AND r.code='admin' AND public.app_profile_role_allowed(r.id)
        WHERE s.status='active' AND s.id::text=current_setting('app.group_staff_id',true) AND (
          EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
          OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND s.role=r.code))) $$;
      ALTER TABLE db_change_logs ADD COLUMN actor_profile_id uuid REFERENCES roles(id) ON DELETE SET NULL,
        ADD COLUMN actor_profile jsonb;
      ALTER TABLE auth_audit_logs ADD COLUMN actor_profile_id uuid REFERENCES roles(id) ON DELETE SET NULL,
        ADD COLUMN actor_profile jsonb;
      CREATE FUNCTION app_audit_profile() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
      DECLARE profile_id text=current_setting('app.actor_profile_id',true);profile_row record;
      BEGIN
        IF COALESCE(profile_id,'')<>'' THEN
          SELECT r.id,r.name INTO profile_row FROM public.roles r WHERE r.id::text=profile_id;
          IF FOUND THEN NEW.actor_profile_id=profile_row.id;
            NEW.actor_profile=jsonb_build_object('id',profile_row.id,'name',profile_row.name); END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER audit_working_profile BEFORE INSERT ON db_change_logs FOR EACH ROW EXECUTE FUNCTION app_audit_profile();
      CREATE TRIGGER audit_working_profile BEFORE INSERT ON auth_audit_logs FOR EACH ROW EXECUTE FUNCTION app_audit_profile();
      DO $$ BEGIN
        IF NOT EXISTS(
          SELECT s.id FROM public.staff s JOIN public.roles r ON r.active AND NOT r.group_read_only AND (
            EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
            OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND r.code=s.role))
          JOIN public.role_permissions rp ON rp.role_id=r.id JOIN public.permissions p ON p.id=rp.permission_id
          WHERE s.status='active' AND p.code IN ('module.administration','account.view','account.manage','role.view','role.manage')
          GROUP BY s.id,r.id HAVING count(DISTINCT p.code)=5)
        THEN RAISE EXCEPTION 'Cần có ít nhất một hồ sơ quản trị đầy đủ trước khi chuyển sang chọn hồ sơ làm việc'; END IF;
      END $$;
    `,{transaction});
  });
}
export async function down(){throw new Error('Không gộp lại quyền của các hồ sơ hoặc xóa lịch sử hồ sơ làm việc.');}
