import { QueryTypes, type QueryInterface } from 'sequelize';

const automaticCodes = ['scheduling.view','scheduling.write','scheduling.organize','scheduling.assign',
  'gradebook.view','gradebook.submit','gradebook.approve','gradebook.policy','studyleave.manage'];

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE FUNCTION app_institution_permission(wanted text, writing boolean DEFAULT false) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.staff s JOIN public.roles r ON r.active=true AND (
          EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
          OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND r.code=s.role))
        JOIN public.role_permissions rp ON rp.role_id=r.id JOIN public.permissions p ON p.id=rp.permission_id AND p.code=wanted
        WHERE s.status='active' AND s.id::text=current_setting('app.group_staff_id',true)
          AND (NOT writing OR (COALESCE(current_setting('app.group_read_only',true),'true')<>'true'
            AND NOT EXISTS(SELECT 1 FROM public.roles locked WHERE locked.active AND locked.group_read_only AND (
              EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=locked.id)
              OR (NOT EXISTS(SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND locked.code=s.role))))))
      $$;
      CREATE OR REPLACE FUNCTION app_schedule_grants(wanted text) RETURNS TABLE(scope text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT 'institution'::text WHERE wanted IN ('scheduling.view','scheduling.write','scheduling.organize','scheduling.assign')
          AND public.app_institution_permission(wanted,wanted<>'scheduling.view')
      $$;
      CREATE FUNCTION app_academic_write() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT
        CASE current_setting('app.academic_domain',true)
          WHEN 'gradebook' THEN current_setting('app.academic_permission',true) IN ('gradebook.submit','gradebook.approve')
            AND public.app_institution_permission(current_setting('app.academic_permission',true),true)
          WHEN 'exam' THEN public.app_institution_permission('scheduling.write',true)
          WHEN 'studyleave' THEN public.app_institution_permission('studyleave.manage',true)
          WHEN 'policy' THEN public.app_institution_permission('gradebook.policy',true)
          ELSE false END
      $$;
      CREATE FUNCTION app_academic_read() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT
        CASE current_setting('app.academic_domain',true)
          WHEN 'gradebook' THEN public.app_institution_permission('gradebook.view',false) OR public.app_academic_write()
          WHEN 'exam' THEN public.app_institution_permission('scheduling.view',false) OR public.app_institution_permission('gradebook.view',false) OR public.app_academic_write()
          WHEN 'studyleave' THEN public.app_institution_permission('studyleave.manage',false)
          WHEN 'policy' THEN public.app_institution_permission('gradebook.policy',false) OR public.app_institution_permission('gradebook.view',false)
          ELSE false END
      $$;
      CREATE FUNCTION app_academic_record(record_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.admission_records r WHERE r.id=record_id AND r.training_level='Thạc sĩ')
      $$;
      CREATE FUNCTION app_academic_student(student_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT EXISTS (
        SELECT 1 FROM public.admission_records r WHERE r.student_id=student_id AND r.training_level='Thạc sĩ')
      $$;
      CREATE FUNCTION app_academic_arrangement(arrangement uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT EXISTS(SELECT 1 FROM public.course_exam_sessions s WHERE s.arrangement_id=arrangement AND NOT public.app_schedule_supported(s.course_offering_id))
      $$;
    `, { transaction });

    const domain = "COALESCE(current_setting('app.academic_domain',true),'')";
    const grading = `${domain}='gradebook'`;
    const exams = `${domain}='exam'`;
    const leaves = `${domain}='studyleave'`;
    const read = 'app_academic_read()';
    const write = 'app_academic_write()';
    const offering = (column: string) => `app_schedule_supported(${column})`;
    const group = (column: string) => `app_schedule_group_supported(${column})`;
    const record = (column: string) => `app_academic_record(${column})`;
    const bookRead = `(${grading} OR ${leaves}) AND ${read}`;
    const workflowRead = `(${grading} OR ${exams}) AND ${read}`;
    const predicates: Record<string, { read: string; write?: string }> = {
      class_groups: { read: `${read} AND program='masters'`, write: `${grading} AND ${write} AND program='masters'` },
      class_group_members: { read: `${read} AND ${group('class_group_id')}`, write: 'false' },
      class_membership_history: { read: `${read} AND ${group('class_group_id')}`, write: 'false' },
      class_group_electives: { read: `${read} AND ${group('class_group_id')}`, write: 'false' },
      admission_records: { read: `${read} AND ${domain}<>'policy' AND training_level='Thạc sĩ'`, write: `${leaves} AND ${write} AND training_level='Thạc sĩ'` },
      students: { read: `${read} AND ${domain}<>'policy' AND app_academic_student(id)`, write: 'false' },
      subject_recognitions: { read: `${read} AND ${record('admission_record_id')}`, write: 'false' },
      study_leaves: { read: `${read} AND ${record('admission_record_id')}`, write: `${leaves} AND ${write} AND ${record('admission_record_id')}` },
      course_offerings: { read: `${read} AND EXISTS(SELECT 1 FROM subjects s WHERE s.id=subject_id AND s.program='masters')`, write: `(${grading} OR ${exams} OR ${leaves}) AND ${write} AND EXISTS(SELECT 1 FROM subjects s WHERE s.id=subject_id AND s.program='masters')` },
      course_offering_class_groups: { read: `${read} AND ${offering('course_offering_id')}`, write: 'false' },
      course_offering_students: { read: `${read} AND ${offering('course_offering_id')}`, write: 'false' },
      course_offering_withdrawals: { read: `${read} AND ${offering('course_offering_id')}`, write: `${leaves} AND ${write} AND ${record('admission_record_id')} AND ${offering('course_offering_id')}` },
      learner_subject_results: { read: `${bookRead} AND ${record('admission_record_id')}`, write: 'false' },
      course_exam_gradebooks: { read: `${bookRead} AND ${offering('course_offering_id')}`, write: `${grading} AND ${write} AND ${offering('course_offering_id')}` },
      course_exam_workflows: { read: `${workflowRead} AND ${offering('course_offering_id')}`, write: `(${grading} OR ${exams}) AND ${write} AND ${offering('course_offering_id')}` },
      course_exam_eligibility_snapshots: { read: `${workflowRead} AND ${offering('course_offering_id')}`, write: `${grading} AND current_setting('app.academic_permission',true)='gradebook.approve' AND ${write} AND ${offering('course_offering_id')}` },
      gradebook_events: { read: `${grading} AND ${read} AND ${offering('course_offering_id')}`, write: `(${grading} OR ${exams}) AND ${write} AND ${offering('course_offering_id')}` },
      course_exam_sessions: { read: `${workflowRead} AND ${offering('course_offering_id')}`, write: `${exams} AND ${write} AND ${offering('course_offering_id')}` },
      course_exam_arrangements: { read: `${workflowRead} AND app_academic_arrangement(id)`, write: `${exams} AND ${write} AND app_academic_arrangement(id)` },
      course_exam_session_candidates: { read: `${workflowRead} AND EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id AND ${offering('s.course_offering_id')})`, write: `${exams} AND ${write} AND EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id AND ${offering('s.course_offering_id')})` },
    };
    // Preserve existing policies verbatim outside these server-selected domains.
    for (const [table, predicate] of Object.entries(predicates)) {
      const policies = await qi.sequelize.query<{ polname: string; using_expr: string | null; check_expr: string | null }>(`
        SELECT polname,pg_get_expr(polqual,polrelid) using_expr,pg_get_expr(polwithcheck,polrelid) check_expr
        FROM pg_policy WHERE polrelid=CAST(:table AS regclass) AND polname IN ('group_scope_read','group_scope_insert','group_scope_update','group_scope_delete')`,
      { replacements: { table }, type: QueryTypes.SELECT, transaction });
      for (const policy of policies) {
        const domainActive = policy.polname === 'group_scope_read'
          ? `${domain}<>'' AND (${domain}<>'studyleave' OR app_institution_permission('studyleave.manage',false))`
          : `${domain}<>''`;
        const condition = policy.polname === 'group_scope_read' ? predicate.read : predicate.write || 'false';
        const clauses: string[] = [];
        if (policy.using_expr) clauses.push(`USING (CASE WHEN ${domainActive} THEN (${condition}) ELSE (${policy.using_expr}) END)`);
        if (policy.check_expr) clauses.push(`WITH CHECK (CASE WHEN ${domainActive} THEN (${condition}) ELSE (${policy.check_expr}) END)`);
        await qi.sequelize.query(`ALTER POLICY ${policy.polname} ON ${table} ${clauses.join(' ')}`, { transaction });
      }
    }
    await qi.sequelize.query(`
      CREATE FUNCTION app_academic_columns() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
      DECLARE domain text=current_setting('app.academic_domain',true);
      BEGIN
        IF COALESCE(domain,'')='' THEN
          IF TG_OP='DELETE' THEN RETURN OLD; END IF;
          RETURN NEW;
        END IF;
        IF TG_TABLE_NAME='class_groups' THEN
          RAISE EXCEPTION 'Grade action cannot change class groups' USING ERRCODE='42501';
        ELSIF TG_TABLE_NAME='course_offerings' THEN
          IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Academic request cannot create offerings' USING ERRCODE='42501'; END IF;
          IF domain='gradebook' THEN
            IF (to_jsonb(NEW)-ARRAY['gradebook_status','gradebook_version','gradebook_snapshot','updated_at'])
              IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['gradebook_status','gradebook_version','gradebook_snapshot','updated_at']) THEN
              RAISE EXCEPTION 'Grade action cannot change teaching or enrollment' USING ERRCODE='42501';
            END IF;
          ELSIF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
            RAISE EXCEPTION 'Exam action cannot change offering data' USING ERRCODE='42501';
          END IF;
        ELSIF TG_TABLE_NAME='admission_records' THEN
          IF domain<>'studyleave' OR TG_OP='INSERT' THEN RAISE EXCEPTION 'Academic request cannot change profiles' USING ERRCODE='42501'; END IF;
          IF (to_jsonb(NEW)-ARRAY['study_status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['study_status','updated_at']) THEN
            RAISE EXCEPTION 'Study leave can only update study status' USING ERRCODE='42501';
          END IF;
        ELSIF TG_TABLE_NAME='course_exam_workflows' THEN
          IF (TG_OP='INSERT' AND (NEW.eligibility_status='approved' OR NEW.result_status='approved')) OR
            (TG_OP='UPDATE' AND ((NEW.eligibility_status='approved' AND OLD.eligibility_status IS DISTINCT FROM NEW.eligibility_status)
              OR (NEW.result_status='approved' AND OLD.result_status IS DISTINCT FROM NEW.result_status))) THEN
            IF NOT public.app_institution_permission('gradebook.approve',true) THEN
              RAISE EXCEPTION 'Approval permission required' USING ERRCODE='42501';
            END IF;
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER academic_column_guard BEFORE INSERT OR UPDATE OR DELETE ON class_groups FOR EACH ROW EXECUTE FUNCTION app_academic_columns();
      CREATE TRIGGER academic_column_guard BEFORE INSERT OR UPDATE ON course_offerings FOR EACH ROW EXECUTE FUNCTION app_academic_columns();
      CREATE TRIGGER academic_column_guard BEFORE INSERT OR UPDATE ON admission_records FOR EACH ROW EXECUTE FUNCTION app_academic_columns();
      CREATE TRIGGER academic_column_guard BEFORE INSERT OR UPDATE ON course_exam_workflows FOR EACH ROW EXECUTE FUNCTION app_academic_columns();
      UPDATE roles SET scheduling_scope_version=1;
      UPDATE role_permission_scopes ps SET scope='institution',updated_at=now()
        FROM permissions p WHERE p.id=ps.permission_id AND p.code IN (:codes);
      INSERT INTO role_permission_scopes(role_id,permission_id,scope)
        SELECT rp.role_id,rp.permission_id,'institution' FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
        WHERE p.code IN (:codes) ON CONFLICT(role_id,permission_id) DO NOTHING;
      INSERT INTO auth_audit_logs(id,actor_staff_id,action,metadata,created_at,updated_at)
        VALUES(gen_random_uuid(),NULL,'policy.auto_institution',jsonb_build_object('permissions',CAST(:codesJson AS jsonb),
          'source','User-requested automatic institution scope','readOnlyRetained',true,'additionalActionsGranted',false),now(),now());
    `, { replacements: { codes: automaticCodes, codesJson: JSON.stringify(automaticCodes) }, transaction });
  });
}

export async function down() {
  throw new Error('Restore a reviewed policy explicitly; do not destroy scope or audit data.');
}
