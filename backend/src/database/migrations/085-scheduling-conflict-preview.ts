import type { QueryInterface } from 'sequelize';

// Expose only conflict reasons between visible offerings, never private roster identities.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query(`
    CREATE FUNCTION app_schedule_offering_conflicts(wanted uuid[])
    RETURNS TABLE(offering_id uuid, other_id uuid, reason text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
      WITH visible AS MATERIALIZED (
        SELECT o.id FROM public.course_offerings o WHERE o.id=ANY(wanted)
          AND public.app_schedule_supported(o.id)
          AND public.app_schedule_allowed(o.id,'scheduling.view')
      ), members AS MATERIALIZED (
        SELECT v.id,m.identity FROM visible v CROSS JOIN LATERAL public.app_schedule_member_ids(v.id) m
      ), shared_groups AS (
        SELECT DISTINCT a.course_offering_id AS a,b.course_offering_id AS b
        FROM public.course_offering_class_groups a
        JOIN public.course_offering_class_groups b ON b.class_group_id=a.class_group_id
        JOIN visible va ON va.id=a.course_offering_id JOIN visible vb ON vb.id=b.course_offering_id
      ), shared_students AS (
        SELECT DISTINCT a.id AS a,b.id AS b FROM members a JOIN members b ON b.identity=a.identity
      )
      SELECT a.id,b.id,CASE WHEN a.id=b.id THEN 'SAME_OFFERING'
        WHEN g.a IS NOT NULL THEN 'CLASS_GROUP_CONFLICT' ELSE 'STUDENT_CONFLICT' END
      FROM visible a CROSS JOIN visible b
      LEFT JOIN shared_groups g ON g.a=a.id AND g.b=b.id
      LEFT JOIN shared_students s ON s.a=a.id AND s.b=b.id
      WHERE a.id=b.id OR g.a IS NOT NULL OR s.a IS NOT NULL
    $$;
  `);
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query('DROP FUNCTION app_schedule_offering_conflicts(uuid[])');
}
