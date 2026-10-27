import type { QueryInterface } from 'sequelize';

// Scope is applied by PostgreSQL to ORM queries, raw SQL, joins and report views alike.
// The login role remains unchanged; only scoped HTTP queries SET LOCAL ROLE in a transaction.
const policies: Record<string, string> = {
  class_groups: 'app_group_allowed(id, WRITE)',
  class_group_members: 'app_group_allowed(class_group_id, WRITE)',
  class_membership_history: 'app_group_allowed(class_group_id, WRITE)',
  class_group_electives: 'app_group_allowed(class_group_id, WRITE)',
  admission_records: 'app_record_allowed(id, WRITE)',
  students: 'app_student_allowed(id, WRITE)',
  admission_evaluations: 'app_record_allowed(admission_record_id, WRITE)',
  admission_evaluation_history: 'app_record_allowed(admission_record_id, WRITE)',
  masters_bridge_courses: 'app_record_allowed(admission_record_id, WRITE)',
  learner_subject_results: 'app_record_allowed(admission_record_id, WRITE)',
  subject_recognitions: 'app_record_allowed(admission_record_id, WRITE)',
  study_leaves: 'app_record_allowed(admission_record_id, WRITE)',
  major_transfers: 'app_record_allowed(admission_record_id, WRITE)',
  scheduling_retakes: 'app_record_allowed(admission_record_id, WRITE)',
  learner_transcript_issues: 'app_group_allowed(class_group_id, WRITE) AND app_record_allowed(admission_record_id, WRITE)',
  course_offerings: `(app_offering_allowed(id, WRITE) OR
    (scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)))`,
  course_offering_class_groups: 'app_group_allowed(class_group_id, WRITE) AND app_offering_allowed(course_offering_id, WRITE)',
  course_offering_students: 'app_record_allowed(admission_record_id, WRITE) AND app_offering_allowed(course_offering_id, WRITE)',
  course_offering_withdrawals: 'app_record_allowed(admission_record_id, WRITE) AND app_offering_allowed(course_offering_id, WRITE)',
  course_exam_gradebooks: 'app_group_allowed(class_group_id, WRITE) AND app_offering_allowed(course_offering_id, WRITE)',
  course_exam_workflows: 'app_offering_allowed(course_offering_id, WRITE)',
  course_exam_eligibility_snapshots: 'app_offering_allowed(course_offering_id, WRITE)',
  course_exam_sessions: 'app_offering_allowed(course_offering_id, WRITE)',
  gradebook_events: 'app_offering_allowed(course_offering_id, WRITE)',
  teaching_sessions: 'app_offering_allowed(course_offering_id, WRITE)',
  course_exam_arrangements: `(scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) OR EXISTS (SELECT 1 FROM course_exam_sessions s WHERE s.arrangement_id=course_exam_arrangements.id))
    AND NOT EXISTS (SELECT 1 FROM app_arrangement_offerings(course_exam_arrangements.id) o WHERE NOT app_offering_allowed(o.offering_id, WRITE))`,
  course_exam_session_candidates: 'EXISTS (SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id AND app_offering_allowed(s.course_offering_id, WRITE))',
  exam_sessions: 'app_group_allowed(class_group_id, WRITE)',
  exam_eligibilities: 'app_group_allowed(class_group_id, WRITE)',
  exam_results: 'app_group_allowed(class_group_id, WRITE)',
  masters_admission_scores: 'app_student_allowed(student_id, WRITE) OR app_record_allowed(admission_record_id, WRITE)',
};
for (const table of ['doctoral_admission_scores', 'doctoral_defenses', 'doctoral_reviews', 'doctoral_thesis_topics',
  'doctoral_workshops', 'english_certifications', 'english_exam_scores', 'graduation_defenses', 'graduation_records',
  'staff_students', 'submissions']) policies[table] = 'app_student_allowed(student_id, WRITE)';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pgsms_group_scoped') THEN
          CREATE ROLE pgsms_group_scoped NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT pgsms_group_scoped TO CURRENT_USER;
      GRANT USAGE ON SCHEMA public TO pgsms_group_scoped;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pgsms_group_scoped;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pgsms_group_scoped;

      ALTER TABLE course_offerings ADD COLUMN scope_created_by_staff_id uuid REFERENCES staff(id)
        DEFAULT NULLIF(current_setting('app.group_staff_id',true),'')::uuid;
      ALTER TABLE course_exam_arrangements ADD COLUMN scope_created_by_staff_id uuid REFERENCES staff(id)
        DEFAULT NULLIF(current_setting('app.group_staff_id',true),'')::uuid;
      CREATE FUNCTION app_group_scope_enabled(writing boolean) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT
        CASE WHEN writing THEN current_setting('app.group_edit_restricted',true)='true'
          ELSE current_setting('app.group_view_restricted',true)='true' END $$;
      CREATE FUNCTION app_group_allowed(group_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_groups g JOIN public.staff s ON s.id=g.responsible_staff_id
          WHERE g.id=group_id AND s.status='active' AND g.responsible_staff_id::text=current_setting('app.group_staff_id',true))) $$;
      CREATE FUNCTION app_record_allowed(record_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=record_id
          WHERE (m.admission_record_id=record_id OR m.student_id=r.student_id)
            AND public.app_group_allowed(m.class_group_id,writing))) $$;
      CREATE FUNCTION app_student_allowed(learner_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR EXISTS (
          SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=m.admission_record_id
          WHERE (m.student_id=learner_id OR r.student_id=learner_id) AND public.app_group_allowed(m.class_group_id,writing))) $$;
      CREATE FUNCTION app_offering_allowed(offering_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT (writing AND COALESCE(current_setting('app.group_read_only',true),'true')='true')
        AND (NOT COALESCE(public.app_group_scope_enabled(writing),true) OR (
          (EXISTS (SELECT 1 FROM public.course_offerings own WHERE own.id=offering_id AND own.scope_created_by_staff_id::text=current_setting('app.group_staff_id',true))
            OR EXISTS (SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering_id)
            OR EXISTS (SELECT 1 FROM public.course_offering_students s WHERE s.course_offering_id=offering_id))
          AND NOT EXISTS (SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering_id AND NOT public.app_group_allowed(g.class_group_id,writing))
          AND NOT EXISTS (SELECT 1 FROM public.course_offering_students s WHERE s.course_offering_id=offering_id AND NOT public.app_record_allowed(s.admission_record_id,writing)))) $$;
      CREATE FUNCTION app_arrangement_offerings(arrangement uuid) RETURNS TABLE(offering_id uuid)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT s.course_offering_id FROM public.course_exam_sessions s WHERE s.arrangement_id=arrangement $$;
      CREATE FUNCTION app_offering_empty(offering uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT EXISTS (SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering)
        AND NOT EXISTS (SELECT 1 FROM public.course_offering_students s WHERE s.course_offering_id=offering) $$;
    `, { transaction });
    for (const [table, predicate] of Object.entries(policies)) {
      const read = predicate.replaceAll('WRITE', 'false');
      const write = `COALESCE(current_setting('app.group_read_only',true),'true') <> 'true' AND (${predicate.replaceAll('WRITE', 'true')})`;
      await qi.sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
        CREATE POLICY group_scope_read ON "${table}" FOR SELECT TO pgsms_group_scoped USING (${read});
        CREATE POLICY group_scope_insert ON "${table}" FOR INSERT TO pgsms_group_scoped WITH CHECK (${write});
        CREATE POLICY group_scope_update ON "${table}" FOR UPDATE TO pgsms_group_scoped USING (${write}) WITH CHECK (${write});
        CREATE POLICY group_scope_delete ON "${table}" FOR DELETE TO pgsms_group_scoped USING (${write});`, { transaction });
    }
    await qi.sequelize.query(`DO $$ DECLARE v record; BEGIN
      FOR v IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v.viewname);
      END LOOP;
    END $$;`, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    for (const table of Object.keys(policies)) await qi.sequelize.query(`
      DROP POLICY group_scope_read ON "${table}"; DROP POLICY group_scope_insert ON "${table}";
      DROP POLICY group_scope_update ON "${table}"; DROP POLICY group_scope_delete ON "${table}";
      ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`, { transaction });
    await qi.sequelize.query(`DROP FUNCTION app_offering_empty(uuid); DROP FUNCTION app_arrangement_offerings(uuid);
      DROP FUNCTION app_offering_allowed(uuid,boolean); DROP FUNCTION app_student_allowed(uuid,boolean);
      DROP FUNCTION app_record_allowed(uuid,boolean); DROP FUNCTION app_group_allowed(uuid,boolean);
      DROP FUNCTION app_group_scope_enabled(boolean);
      ALTER TABLE course_offerings DROP COLUMN scope_created_by_staff_id;
      ALTER TABLE course_exam_arrangements DROP COLUMN scope_created_by_staff_id;`, { transaction });
  });
}
