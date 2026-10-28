import type { QueryInterface } from 'sequelize';

// Shared timetable visibility is enabled only for scheduling GET requests. Gradebooks,
// learner profiles and all write policies retain their original scope predicates.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE FUNCTION app_scheduling_offering_allowed(offering uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        public.app_offering_allowed(offering,false) OR (
          current_setting('app.scheduling_shared_view',true)='true' AND (
            EXISTS (SELECT 1 FROM public.course_offering_class_groups g
              WHERE g.course_offering_id=offering AND public.app_group_allowed(g.class_group_id,false))
            OR EXISTS (SELECT 1 FROM public.course_offering_students s
              WHERE s.course_offering_id=offering AND public.app_record_allowed(s.admission_record_id,false))
          )) $$;
      ALTER POLICY group_scope_read ON course_offerings USING (
        app_scheduling_offering_allowed(id) OR
        (scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)));
      ALTER POLICY group_scope_read ON teaching_sessions USING (app_scheduling_offering_allowed(course_offering_id));
      ALTER POLICY group_scope_read ON course_offering_class_groups USING (
        app_group_allowed(class_group_id,false) AND app_scheduling_offering_allowed(course_offering_id));
      ALTER POLICY group_scope_read ON course_offering_students USING (
        app_record_allowed(admission_record_id,false) AND app_scheduling_offering_allowed(course_offering_id));
      ALTER POLICY group_scope_read ON course_offering_withdrawals USING (
        app_record_allowed(admission_record_id,false) AND app_scheduling_offering_allowed(course_offering_id));
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER POLICY group_scope_read ON course_offerings USING (
        app_offering_allowed(id,false) OR
        (scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)));
      ALTER POLICY group_scope_read ON teaching_sessions USING (app_offering_allowed(course_offering_id,false));
      ALTER POLICY group_scope_read ON course_offering_class_groups USING (
        app_group_allowed(class_group_id,false) AND app_offering_allowed(course_offering_id,false));
      ALTER POLICY group_scope_read ON course_offering_students USING (
        app_record_allowed(admission_record_id,false) AND app_offering_allowed(course_offering_id,false));
      ALTER POLICY group_scope_read ON course_offering_withdrawals USING (
        app_record_allowed(admission_record_id,false) AND app_offering_allowed(course_offering_id,false));
      DROP FUNCTION app_scheduling_offering_allowed(uuid);
    `, { transaction });
  });
}
