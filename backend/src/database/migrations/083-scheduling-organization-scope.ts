import type { QueryInterface } from 'sequelize';

// Keep 082 immutable. Organization needs a minimal roster even on scheduling GETs;
// timetable-only grants continue to use aggregate functions, never these reads.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE FUNCTION app_schedule_supported(offering uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        EXISTS(SELECT 1 FROM public.course_offerings o JOIN public.subjects s ON s.id=o.subject_id
          WHERE o.id=offering AND s.program='masters')
      $$;
      CREATE FUNCTION app_schedule_group_supported(group_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        EXISTS(SELECT 1 FROM public.class_groups g WHERE g.id=group_id AND g.program='masters')
      $$;
      CREATE FUNCTION app_schedule_roster_group_read(group_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        public.app_schedule_group_supported(group_id) AND public.app_schedule_group_allowed(group_id,false) AND EXISTS (
          SELECT 1 FROM public.app_schedule_grants('scheduling.view') g WHERE g.scope='institution'
            OR (g.scope='related_offerings' AND public.app_schedule_assigned(group_id))
            OR (g.scope='legacy' AND public.app_group_allowed(group_id,false)))
      $$;
      CREATE FUNCTION app_schedule_roster_record_read(record_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        (EXISTS(SELECT 1 FROM public.app_schedule_grants('scheduling.organize') g WHERE g.scope='institution')
          AND EXISTS(SELECT 1 FROM public.app_schedule_grants('scheduling.view') g WHERE g.scope='institution')
          AND EXISTS(SELECT 1 FROM public.admission_records r WHERE r.id=record_id AND r.training_level='Thạc sĩ'))
        OR EXISTS(SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=record_id
          WHERE (m.admission_record_id=record_id OR (r.student_id IS NOT NULL AND m.student_id=r.student_id))
            AND public.app_schedule_roster_group_read(m.class_group_id))
      $$;
      CREATE OR REPLACE FUNCTION app_schedule_groups(offering uuid) RETURNS TABLE(id uuid, program varchar, allowed_weekdays integer[])
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT g.id,g.program::varchar,g.allowed_weekdays FROM public.class_groups g
        JOIN public.course_offering_class_groups l ON l.class_group_id=g.id
        WHERE l.course_offering_id=offering AND public.app_schedule_allowed(offering,'scheduling.view')
          AND public.app_schedule_supported(offering) ORDER BY g.id
      $$;
      CREATE OR REPLACE FUNCTION app_schedule_count(offering uuid) RETURNS integer
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN public.app_schedule_supported(offering) AND public.app_schedule_allowed(offering,'scheduling.view') THEN
          (SELECT count(*)::integer FROM public.app_schedule_member_ids(offering)) ELSE NULL END
      $$;
      CREATE OR REPLACE FUNCTION app_schedule_conflict(offering uuid, day date, slot text, room uuid, lecturer uuid, excluded uuid)
      RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN s.room_id=room THEN 'ROOM_CONFLICT' WHEN s.lecturer_id=lecturer THEN 'LECTURER_CONFLICT'
          WHEN EXISTS (SELECT 1 FROM public.course_offering_class_groups a JOIN public.course_offering_class_groups b ON a.class_group_id=b.class_group_id
            WHERE a.course_offering_id=offering AND b.course_offering_id=s.course_offering_id) THEN 'CLASS_GROUP_CONFLICT'
          ELSE 'STUDENT_CONFLICT' END
        FROM public.teaching_sessions s WHERE public.app_schedule_supported(offering) AND public.app_schedule_allowed(offering,'scheduling.write')
          AND s.session_date=day AND s.period::text=slot AND s.status<>'not_held' AND (excluded IS NULL OR s.id<>excluded)
          AND (s.room_id=room OR s.lecturer_id=lecturer OR EXISTS (
            SELECT 1 FROM public.course_offering_class_groups a JOIN public.course_offering_class_groups b ON a.class_group_id=b.class_group_id
            WHERE a.course_offering_id=offering AND b.course_offering_id=s.course_offering_id)
            OR EXISTS (SELECT 1 FROM public.app_schedule_member_ids(offering) a JOIN public.app_schedule_member_ids(s.course_offering_id) b ON a.identity=b.identity))
        ORDER BY s.start_time,s.id LIMIT 1
      $$;

      ALTER POLICY group_scope_read ON class_group_members USING (
        app_group_allowed(class_group_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_group_read(class_group_id)));
      ALTER POLICY group_scope_read ON admission_records USING (
        app_record_allowed(id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(id)));
      ALTER POLICY group_scope_read ON students USING (
        app_student_allowed(id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>'' AND EXISTS (
          SELECT 1 FROM admission_records r WHERE r.student_id=students.id AND app_schedule_roster_record_read(r.id))));
      ALTER POLICY group_scope_read ON subject_recognitions USING (
        app_record_allowed(admission_record_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(admission_record_id)));
      ALTER POLICY group_scope_read ON study_leaves USING (
        app_record_allowed(admission_record_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(admission_record_id)));
      ALTER POLICY group_scope_read ON course_offering_students USING (
        (app_record_allowed(admission_record_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(admission_record_id))) AND app_schedule_read(course_offering_id));
      ALTER POLICY group_scope_read ON course_offering_withdrawals USING (
        (app_record_allowed(admission_record_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(admission_record_id))) AND app_schedule_read(course_offering_id));
      ALTER POLICY group_scope_read ON scheduling_retakes USING (
        app_record_allowed(admission_record_id,false) OR (COALESCE(current_setting('app.scheduling_action',true),'')<>''
          AND app_schedule_roster_record_read(admission_record_id)));

      CREATE POLICY scheduling_program ON course_offerings AS RESTRICTIVE FOR ALL TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='' OR EXISTS(SELECT 1 FROM subjects s WHERE s.id=subject_id AND s.program='masters'))
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='' OR EXISTS(SELECT 1 FROM subjects s WHERE s.id=subject_id AND s.program='masters'));
      CREATE POLICY scheduling_program ON teaching_sessions AS RESTRICTIVE FOR ALL TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='' OR app_schedule_supported(course_offering_id))
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='' OR app_schedule_supported(course_offering_id));
      CREATE POLICY scheduling_program ON class_groups AS RESTRICTIVE FOR ALL TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='' OR program='masters')
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='' OR program='masters');
      CREATE POLICY scheduling_program ON course_offering_class_groups AS RESTRICTIVE FOR ALL TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='' OR app_schedule_group_supported(class_group_id))
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='' OR app_schedule_group_supported(class_group_id));
    `, { transaction });
    for (const table of ['course_offering_students', 'course_offering_withdrawals', 'scheduling_retakes']) {
      const offering = table === 'scheduling_retakes' ? 'source_course_offering_id' : 'course_offering_id';
      const legacy = table === 'scheduling_retakes' ? 'app_record_allowed(admission_record_id,true)'
        : `app_record_allowed(admission_record_id,true) AND app_offering_allowed(${offering},true)`;
      const write = `CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')<>'' THEN
        current_setting('app.scheduling_action',true)='organize' AND app_schedule_record_allowed(admission_record_id,true) AND app_schedule_allowed(${offering},'scheduling.organize')
        ELSE ${legacy} END`;
      await qi.sequelize.query(`
        ALTER POLICY group_scope_insert ON ${table} WITH CHECK (${write});
        ALTER POLICY group_scope_update ON ${table} USING (${write}) WITH CHECK (${write});
        ALTER POLICY group_scope_delete ON ${table} USING (${write});
      `, { transaction });
    }
    // A timetable request cannot reuse unrestricted legacy profile/grade write
    // predicates. Organization changes offering enrollment, never the source profile.
    for (const table of ['class_group_members', 'admission_records', 'students', 'subject_recognitions', 'study_leaves',
      'learner_subject_results', 'course_exam_gradebooks', 'course_exam_workflows', 'course_exam_eligibility_snapshots',
      'course_exam_sessions', 'course_exam_arrangements', 'course_exam_session_candidates', 'gradebook_events']) {
      const allowed = "COALESCE(current_setting('app.scheduling_action',true),'')=''";
      await qi.sequelize.query(`
        CREATE POLICY scheduling_no_insert ON ${table} AS RESTRICTIVE FOR INSERT TO pgsms_group_scoped WITH CHECK (${allowed});
        CREATE POLICY scheduling_no_update ON ${table} AS RESTRICTIVE FOR UPDATE TO pgsms_group_scoped USING (${allowed}) WITH CHECK (${allowed});
        CREATE POLICY scheduling_no_delete ON ${table} AS RESTRICTIVE FOR DELETE TO pgsms_group_scoped USING (${allowed});
      `, { transaction });
    }
    await qi.sequelize.query(`
      CREATE POLICY scheduling_group_insert ON class_groups AS RESTRICTIVE FOR INSERT TO pgsms_group_scoped
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='');
      CREATE POLICY scheduling_group_delete ON class_groups AS RESTRICTIVE FOR DELETE TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='');
      CREATE POLICY scheduling_group_update ON class_groups AS RESTRICTIVE FOR UPDATE TO pgsms_group_scoped
        USING (COALESCE(current_setting('app.scheduling_action',true),'')='' OR
          (current_setting('app.scheduling_action',true)='organize' AND app_schedule_group_allowed(id,true)))
        WITH CHECK (COALESCE(current_setting('app.scheduling_action',true),'')='' OR
          (current_setting('app.scheduling_action',true)='organize' AND app_schedule_group_allowed(id,true)));
    `, { transaction });
  });
}

export async function down() {
  throw new Error('Use reviewed role compatibility mode; retain scope and audit data.');
}
