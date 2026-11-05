import type { QueryInterface } from 'sequelize';

const tables = {
  admission_records: 'id',
  admission_evaluations: 'admission_record_id',
  admission_evaluation_history: 'admission_record_id',
};

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE FUNCTION app_admission_unassigned_allowed(record_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        COALESCE(current_setting('app.admission_action',true),'') IN ('view','manage')
        AND public.app_institution_permission('admission.view',false)
        AND (NOT writing OR (current_setting('app.admission_action',true)='manage'
          AND public.app_institution_permission('admission.manage',true)))
        AND NOT EXISTS (
          SELECT 1 FROM public.class_group_members m
          WHERE m.admission_record_id=record_id OR m.student_id=(
            SELECT r.student_id FROM public.admission_records r WHERE r.id=record_id))
      $$;
    `, { transaction });
    // Add access only to admissions data. Do not change app_record_allowed:
    // grades, reports, students and class membership keep their existing scope.
    for (const [table, column] of Object.entries(tables)) {
      for (const action of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const allowed = `app_admission_unassigned_allowed(${column},${action !== 'SELECT'})`;
        await qi.sequelize.query(`CREATE POLICY admission_unassigned_${action.toLowerCase()} ON ${table}
          FOR ${action} TO pgsms_group_scoped
          ${action !== 'INSERT' ? `USING (${allowed})` : ''}
          ${action !== 'SELECT' && action !== 'DELETE' ? `WITH CHECK (${allowed})` : ''}`, { transaction });
      }
    }
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    for (const table of Object.keys(tables)) {
      for (const action of ['select', 'insert', 'update', 'delete']) {
        await qi.sequelize.query(`DROP POLICY admission_unassigned_${action} ON ${table}`, { transaction });
      }
    }
    await qi.sequelize.query('DROP FUNCTION app_admission_unassigned_allowed(uuid,boolean)', { transaction });
  });
}
