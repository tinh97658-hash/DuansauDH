import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    // Join the responsible group once inside the policy lookup. Calling another
    // policy function for every membership multiplied scans on ordinary roster joins.
    await qi.sequelize.query(`
      CREATE OR REPLACE FUNCTION app_record_allowed(record_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m
          JOIN public.class_groups g ON g.id=m.class_group_id
          JOIN public.staff s ON s.id=g.responsible_staff_id AND s.status='active'
          WHERE g.responsible_staff_id::text=current_setting('app.group_staff_id',true)
            AND (m.admission_record_id=record_id OR m.student_id=(
              SELECT r.student_id FROM public.admission_records r WHERE r.id=record_id)))) $$;

      CREATE OR REPLACE FUNCTION app_student_allowed(learner_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m
          JOIN public.class_groups g ON g.id=m.class_group_id
          JOIN public.staff s ON s.id=g.responsible_staff_id AND s.status='active'
          LEFT JOIN public.admission_records r ON r.id=m.admission_record_id
          WHERE g.responsible_staff_id::text=current_setting('app.group_staff_id',true)
            AND (m.student_id=learner_id OR r.student_id=learner_id))) $$;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE OR REPLACE FUNCTION app_record_allowed(record_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=record_id
          WHERE (m.admission_record_id=record_id OR m.student_id=r.student_id)
            AND public.app_group_allowed(m.class_group_id,writing))) $$;

      CREATE OR REPLACE FUNCTION app_student_allowed(learner_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=m.admission_record_id
          WHERE (m.student_id=learner_id OR r.student_id=learner_id) AND public.app_group_allowed(m.class_group_id,writing))) $$;
    `, { transaction });
  });
}
