import type { QueryInterface } from 'sequelize';
import { PERMISSIONS } from '../../auth/permissions.js';
import { permissionTreeMeta } from '../../auth/permission-tree.js';
import { ROUTE_PERMISSION_ENTRIES } from '../../auth/route-permissions.js';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE TABLE training_years (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(4) NOT NULL UNIQUE CHECK (name ~ '^[1-9][0-9]{3}$'),
        start_date date NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO training_years(name,start_date)
      SELECT year, make_date(year::integer,1,1) FROM (
        SELECT generate_series(EXTRACT(YEAR FROM CURRENT_DATE)::integer-3,
          EXTRACT(YEAR FROM CURRENT_DATE)::integer+2)::text AS year
        UNION SELECT academic_year FROM admission_records WHERE academic_year ~ '^[1-9][0-9]{3}$'
        UNION SELECT academic_year FROM class_groups WHERE academic_year ~ '^[1-9][0-9]{3}$'
      ) years;
      GRANT SELECT,INSERT,UPDATE ON training_years TO pgsms_group_scoped;
      CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON training_years
        FOR EACH ROW EXECUTE FUNCTION audit_capture();
    `, { transaction });
    for (const entry of ROUTE_PERMISSION_ENTRIES.filter(entry => entry.route.path === '/system/training-years')) {
      const definition = PERMISSIONS.find(permission => permission.code === entry.code)!;
      const meta = permissionTreeMeta(entry.code);
      await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
        VALUES(gen_random_uuid(),:code,:name,:group,:description,:sort,now(),now()) ON CONFLICT(code) DO NOTHING`,
        { transaction, replacements: { ...definition, sort: PERMISSIONS.indexOf(definition) } });
      const old = [...entry.route.read, ...(entry.capability ? [entry.capability] : [])];
      await qi.sequelize.query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
        SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p WHERE p.code=:code
        AND NOT EXISTS(SELECT 1 FROM permissions required WHERE required.code IN (:old)
          AND NOT EXISTS(SELECT 1 FROM role_permissions granted WHERE granted.role_id=r.id AND granted.permission_id=required.id))
        ON CONFLICT DO NOTHING`, { transaction, replacements: { code: entry.code, old } });
      await qi.sequelize.query(`INSERT INTO permission_requirements(permission_id,required_permission_id)
        SELECT child.id,parent.id FROM permissions child CROSS JOIN permissions parent
        WHERE child.code=:code AND parent.code IN (:required) ON CONFLICT DO NOTHING`,
        { transaction, replacements: { code: entry.code, required: [`module.${meta.moduleId}`, ...meta.requires] } });
    }
    await qi.sequelize.query(`DO $$ DECLARE inserted integer; BEGIN LOOP
      INSERT INTO permission_requirements(permission_id,required_permission_id)
      SELECT direct.permission_id,parent.required_permission_id FROM permission_requirements direct
      JOIN permission_requirements parent ON parent.permission_id=direct.required_permission_id
      WHERE direct.permission_id<>parent.required_permission_id ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted=ROW_COUNT; EXIT WHEN inserted=0; END LOOP; END $$;`, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.dropTable('training_years');
}
