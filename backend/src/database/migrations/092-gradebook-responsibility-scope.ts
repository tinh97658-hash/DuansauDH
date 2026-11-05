import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE OR REPLACE FUNCTION app_gradebook_admin() RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.roles r ON r.active AND r.code='admin'
        WHERE s.status='active' AND s.id::text=current_setting('app.group_staff_id',true) AND (
          EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
          OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND s.role=r.code))) $$;
      CREATE OR REPLACE FUNCTION app_gradebook_group_owned(group_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.class_groups g JOIN public.staff s ON s.id=g.responsible_staff_id
        WHERE g.id=group_id AND g.program='masters' AND s.status='active'
          AND s.id::text=current_setting('app.group_staff_id',true)) $$;
      CREATE OR REPLACE FUNCTION app_gradebook_offering_visible(offering uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        public.app_gradebook_admin() OR EXISTS (
          SELECT 1 FROM public.course_offering_class_groups l
          WHERE l.course_offering_id=offering AND public.app_gradebook_group_owned(l.class_group_id)) $$;
      CREATE OR REPLACE FUNCTION app_gradebook_group_visible(group_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        public.app_gradebook_admin() OR public.app_gradebook_group_owned(group_id) OR EXISTS (
          SELECT 1 FROM public.course_offering_class_groups l
          WHERE l.class_group_id=group_id AND public.app_gradebook_offering_visible(l.course_offering_id)) $$;
    `, { transaction });

    // Add restrictive policies alongside the existing action/readonly policies.
    // They apply only to gradebook requests, leaving scheduling and profiles alone.
    const outside = "COALESCE(current_setting('app.academic_domain',true),'')<>'gradebook'";
    const predicates: Record<string, string> = {
      class_groups: 'app_gradebook_group_visible(id)',
      class_group_members: 'app_gradebook_group_visible(class_group_id)',
      course_offerings: 'app_gradebook_offering_visible(id)',
      course_offering_class_groups: 'app_gradebook_offering_visible(course_offering_id)',
      course_offering_students: 'app_gradebook_offering_visible(course_offering_id)',
      course_offering_withdrawals: 'app_gradebook_offering_visible(course_offering_id)',
      course_exam_gradebooks: 'app_gradebook_offering_visible(course_offering_id)',
      course_exam_workflows: 'app_gradebook_offering_visible(course_offering_id)',
      course_exam_eligibility_snapshots: 'app_gradebook_offering_visible(course_offering_id)',
      gradebook_events: 'app_gradebook_offering_visible(course_offering_id)',
      course_exam_sessions: 'app_gradebook_offering_visible(course_offering_id)',
    };
    for (const [table, predicate] of Object.entries(predicates)) {
      await qi.sequelize.query(`DROP POLICY IF EXISTS gradebook_responsibility_read ON ${table};
        CREATE POLICY gradebook_responsibility_read ON ${table}
        AS RESTRICTIVE FOR SELECT TO pgsms_group_scoped USING (${outside} OR (${predicate}))`, { transaction });
    }
    for (const table of ['course_exam_gradebooks','course_exam_workflows','course_exam_eligibility_snapshots','gradebook_events']) {
      const offering='app_gradebook_offering_visible(course_offering_id)';
      for (const action of ['INSERT','UPDATE','DELETE']) {
        const predicate=`${outside} OR (${offering})`;
        await qi.sequelize.query(`DROP POLICY IF EXISTS gradebook_responsibility_${action.toLowerCase()} ON ${table};
          CREATE POLICY gradebook_responsibility_${action.toLowerCase()} ON ${table}
          AS RESTRICTIVE FOR ${action} TO pgsms_group_scoped
          ${action!=='INSERT'?`USING (${predicate})`:''} ${action!=='DELETE'?`WITH CHECK (${predicate})`:''}`, { transaction });
      }
    }
  });
}

export async function down() {
  throw new Error('Removing gradebook responsibility boundaries requires an explicit reviewed policy change.');
}
