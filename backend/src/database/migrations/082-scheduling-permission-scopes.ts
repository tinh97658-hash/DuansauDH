import type { QueryInterface } from 'sequelize';

// Existing roles stay in explicit compatibility mode. No automatic institution grants.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE roles ADD COLUMN scheduling_scope_version integer NOT NULL DEFAULT 0;
      ALTER TABLE roles ALTER COLUMN scheduling_scope_version SET DEFAULT 1;
      CREATE TABLE role_permission_scopes (
        role_id uuid NOT NULL, permission_id uuid NOT NULL, scope varchar(24) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(role_id,permission_id),
        FOREIGN KEY(role_id,permission_id) REFERENCES role_permissions(role_id,permission_id) ON DELETE CASCADE,
        CHECK(scope IN ('assigned_groups','related_offerings','institution'))
      );
      GRANT SELECT,INSERT,UPDATE,DELETE ON role_permission_scopes TO pgsms_group_scoped;
      DROP TRIGGER IF EXISTS trg_audit_change ON role_permission_scopes;
      CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON role_permission_scopes
        FOR EACH ROW EXECUTE FUNCTION audit_capture();

      CREATE FUNCTION app_schedule_grants(wanted text) RETURNS TABLE(scope text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN r.scheduling_scope_version=0 THEN 'legacy' ELSE ps.scope::text END
        FROM public.staff s JOIN public.roles r ON r.active=true AND (
          EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
          OR (NOT EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND r.code=s.role))
        JOIN public.role_permissions rp ON rp.role_id=r.id
        JOIN public.permissions p ON p.id=rp.permission_id AND p.code=wanted
        LEFT JOIN public.role_permission_scopes ps ON ps.role_id=rp.role_id AND ps.permission_id=rp.permission_id
        WHERE s.id::text=current_setting('app.group_staff_id',true) AND s.status='active'
          AND (wanted='scheduling.view' OR (COALESCE(current_setting('app.group_read_only',true),'true')<>'true'
            AND NOT EXISTS (SELECT 1 FROM public.roles locked WHERE locked.active=true AND locked.group_read_only=true AND (
              EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=locked.id)
              OR (NOT EXISTS (SELECT 1 FROM public.staff_roles sr WHERE sr.staff_id=s.id) AND locked.code=s.role)))))
      $$;

      CREATE FUNCTION app_schedule_assigned(group_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT EXISTS (SELECT 1 FROM public.class_groups g JOIN public.staff s ON s.id=g.responsible_staff_id
          WHERE g.id=group_id AND s.status='active' AND s.id::text=current_setting('app.group_staff_id',true))
      $$;
      CREATE FUNCTION app_schedule_allowed(offering uuid, wanted text) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT EXISTS (SELECT 1 FROM public.app_schedule_grants(wanted) grant_scope WHERE
          grant_scope.scope='institution'
          OR (grant_scope.scope='related_offerings' AND wanted IN ('scheduling.view','scheduling.write') AND EXISTS (
            SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering AND public.app_schedule_assigned(g.class_group_id)))
          OR (grant_scope.scope='assigned_groups' AND wanted='scheduling.organize'
            AND EXISTS (SELECT 1 FROM public.class_groups assigned WHERE public.app_schedule_assigned(assigned.id)) AND (
            EXISTS (SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering)
            OR EXISTS (SELECT 1 FROM public.course_offerings o WHERE o.id=offering AND o.scope_created_by_staff_id::text=current_setting('app.group_staff_id',true)))
            AND NOT EXISTS (SELECT 1 FROM public.course_offering_class_groups g WHERE g.course_offering_id=offering AND NOT public.app_schedule_assigned(g.class_group_id))
            AND NOT EXISTS (SELECT 1 FROM public.course_offering_students i WHERE i.course_offering_id=offering AND NOT EXISTS (
              SELECT 1 FROM public.class_group_members m WHERE m.admission_record_id=i.admission_record_id AND public.app_schedule_assigned(m.class_group_id))))
          OR (grant_scope.scope='legacy' AND CASE WHEN wanted='scheduling.view' THEN public.app_scheduling_offering_allowed(offering)
            ELSE public.app_offering_allowed(offering,true) AND public.app_offering_allowed(offering,false) END))
      $$;
      CREATE FUNCTION app_schedule_read(offering uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')<>''
        THEN public.app_schedule_allowed(offering,'scheduling.view')
        ELSE public.app_scheduling_offering_allowed(offering) END $$;
      CREATE FUNCTION app_schedule_write(offering uuid, organizing boolean) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')<>''
        THEN public.app_schedule_allowed(offering,CASE WHEN organizing THEN 'scheduling.organize' ELSE 'scheduling.write' END)
          AND current_setting('app.scheduling_action',true)=CASE WHEN organizing THEN 'organize' ELSE 'write' END
        ELSE public.app_offering_allowed(offering,true) END $$;

      CREATE FUNCTION app_schedule_group_allowed(group_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')=''
        THEN public.app_group_allowed(group_id,writing) ELSE EXISTS (SELECT 1 FROM public.app_schedule_grants('scheduling.organize') g
        WHERE g.scope='institution' OR (g.scope='assigned_groups' AND public.app_schedule_assigned(group_id))
        OR (g.scope='legacy' AND public.app_group_allowed(group_id,writing))) END $$;
      CREATE FUNCTION app_schedule_record_allowed(record_id uuid, writing boolean) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        EXISTS (SELECT 1 FROM public.app_schedule_grants('scheduling.organize') g WHERE g.scope='institution')
        OR EXISTS (SELECT 1 FROM public.class_group_members m LEFT JOIN public.admission_records r ON r.id=record_id
          WHERE (m.admission_record_id=record_id OR (r.student_id IS NOT NULL AND m.student_id=r.student_id))
          AND public.app_schedule_group_allowed(m.class_group_id,writing)) $$;

      ALTER POLICY group_scope_read ON course_offerings USING (app_schedule_read(id) OR
        (COALESCE(current_setting('app.scheduling_action',true),'') IN ('','organize') AND
          scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)));
      ALTER POLICY group_scope_read ON teaching_sessions USING (app_schedule_read(course_offering_id));
      ALTER POLICY group_scope_read ON course_offering_class_groups USING (
        CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')<>'' THEN app_schedule_read(course_offering_id)
          OR (current_setting('app.scheduling_action',true)='organize' AND app_schedule_write(course_offering_id,true))
        ELSE app_group_allowed(class_group_id,false) AND app_scheduling_offering_allowed(course_offering_id) END);
      -- Only the organization request needs roster selection. Shared timetable writers
      -- continue to use the restricted profile policies and aggregate resource functions.
      ALTER POLICY group_scope_read ON class_groups USING (
        CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')<>'' THEN
          app_schedule_group_allowed(id,false) OR EXISTS (SELECT 1 FROM course_offering_class_groups l
            WHERE l.class_group_id=class_groups.id AND app_schedule_read(l.course_offering_id))
        ELSE app_group_allowed(id,false) END);
      ALTER POLICY group_scope_read ON class_group_members USING (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN app_schedule_group_allowed(class_group_id,false)
        ELSE app_group_allowed(class_group_id,false) END);
      ALTER POLICY group_scope_read ON admission_records USING (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN app_schedule_record_allowed(id,false)
        ELSE app_record_allowed(id,false) END);
      ALTER POLICY group_scope_read ON subject_recognitions USING (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN app_schedule_record_allowed(admission_record_id,false)
        ELSE app_record_allowed(admission_record_id,false) END);
      ALTER POLICY group_scope_read ON course_offering_students USING (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN
          app_schedule_read(course_offering_id) AND app_schedule_record_allowed(admission_record_id,false)
        ELSE app_record_allowed(admission_record_id,false) AND app_scheduling_offering_allowed(course_offering_id) END);
      ALTER POLICY group_scope_update ON class_groups USING (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN app_schedule_group_allowed(id,true)
        ELSE app_group_allowed(id,true) END) WITH CHECK (
        CASE WHEN current_setting('app.scheduling_action',true)='organize' THEN app_schedule_group_allowed(id,true)
        ELSE app_group_allowed(id,true) END);
    `, { transaction });
    for (const table of ['course_offerings', 'teaching_sessions']) {
      const offering = table === 'course_offerings' ? 'id' : 'course_offering_id';
      const write = table === 'course_offerings'
        ? `(CASE WHEN current_setting('app.scheduling_action',true)='write' THEN app_schedule_write(id,false) ELSE app_schedule_write(id,true) END)`
        : `app_schedule_write(${offering},false)`;
      await qi.sequelize.query(`
        ALTER POLICY group_scope_insert ON ${table} WITH CHECK (${table === 'course_offerings' ? `
          scope_created_by_staff_id::text=current_setting('app.group_staff_id',true) AND app_offering_empty(id)
          AND CASE WHEN COALESCE(current_setting('app.scheduling_action',true),'')=''
            THEN COALESCE(current_setting('app.group_read_only',true),'true')<>'true'
            ELSE current_setting('app.scheduling_action',true)='organize' AND EXISTS (
              SELECT 1 FROM app_schedule_grants('scheduling.organize') g WHERE g.scope IN ('institution','legacy')
                OR (g.scope='assigned_groups' AND EXISTS (SELECT 1 FROM class_groups assigned WHERE app_schedule_assigned(assigned.id)))) END
        ` : write});
        ALTER POLICY group_scope_update ON ${table} USING (${write}) WITH CHECK (${write});
        ALTER POLICY group_scope_delete ON ${table} USING (${table === 'course_offerings' ? 'app_schedule_write(id,true)' : write});
      `, { transaction });
    }
    // Links are organization data; scheduling.write must never change membership.
    await qi.sequelize.query(`
      ALTER POLICY group_scope_insert ON course_offering_class_groups WITH CHECK (
        app_schedule_write(course_offering_id,true) AND app_schedule_group_allowed(class_group_id,true));
      ALTER POLICY group_scope_update ON course_offering_class_groups USING (app_schedule_write(course_offering_id,true)) WITH CHECK (
        app_schedule_write(course_offering_id,true) AND app_schedule_group_allowed(class_group_id,true));
      ALTER POLICY group_scope_delete ON course_offering_class_groups USING (app_schedule_write(course_offering_id,true));

      CREATE FUNCTION app_schedule_groups(offering uuid) RETURNS TABLE(id uuid, program varchar, allowed_weekdays integer[])
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT g.id,g.program::varchar,g.allowed_weekdays FROM public.class_groups g
        JOIN public.course_offering_class_groups l ON l.class_group_id=g.id
        WHERE l.course_offering_id=offering AND public.app_schedule_allowed(offering,'scheduling.view') ORDER BY g.id
      $$;

      -- Private canonical identity query. No names, grades or arbitrary SQL are exposed.
      CREATE FUNCTION app_schedule_member_ids(offering uuid) RETURNS TABLE(identity text)
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        WITH target AS (SELECT o.*,s.canonical_subject_id,s.name AS subject_name,s.credits,s.program,
          CASE WHEN s.shared_major_ids IS NOT NULL THEN cardinality(s.shared_major_ids)>0 ELSE s.allow_cross_major END AS sharing
          FROM public.course_offerings o JOIN public.subjects s ON s.id=o.subject_id WHERE o.id=offering),
        equivalent AS (SELECT s.id FROM public.subjects s,target t WHERE s.id=t.subject_id OR (s.active=true AND (
          COALESCE(s.canonical_subject_id,s.id)=COALESCE(t.canonical_subject_id,t.subject_id)
          OR (t.sharing AND s.program=t.program AND s.credits=t.credits
            AND lower(regexp_replace(trim(s.name),'\s+',' ','g'))=lower(regexp_replace(trim(t.subject_name),'\s+',' ','g')))))),
        participants AS (
          SELECT m.id,m.admission_record_id,COALESCE(m.student_id,r.student_id) AS student_id,l.participant_ids
          FROM public.course_offering_class_groups l JOIN public.class_group_members m ON m.class_group_id=l.class_group_id
          LEFT JOIN public.admission_records r ON r.id=m.admission_record_id WHERE l.course_offering_id=offering
          UNION ALL
          SELECT i.id,i.admission_record_id,r.student_id,NULL::text[] FROM public.course_offering_students i
          JOIN public.admission_records r ON r.id=i.admission_record_id WHERE i.course_offering_id=offering),
        canonical AS (SELECT p.*,CASE WHEN p.student_id IS NOT NULL THEN 'student:'||p.student_id::text
          WHEN p.admission_record_id IS NOT NULL THEN 'admission:'||p.admission_record_id::text ELSE 'membership:'||p.id::text END AS identity FROM participants p)
        SELECT DISTINCT p.identity FROM canonical p WHERE (p.participant_ids IS NULL OR p.identity=ANY(p.participant_ids))
          AND NOT EXISTS (SELECT 1 FROM public.course_offering_withdrawals w JOIN public.admission_records r ON r.id=w.admission_record_id
            WHERE w.course_offering_id=offering AND (w.participant_id=p.identity OR r.id=p.admission_record_id OR (p.student_id IS NOT NULL AND r.student_id=p.student_id)))
          AND NOT EXISTS (SELECT 1 FROM public.subject_recognitions r WHERE r.admission_record_id=p.admission_record_id AND r.status='approved' AND r.target_subject_id IN (SELECT id FROM equivalent))
          AND ((SELECT status FROM target)='completed' OR NOT EXISTS (SELECT 1 FROM public.admission_records r WHERE r.id=p.admission_record_id
            AND COALESCE(r.study_status,'') IN ('Bảo lưu','Đang bảo lưu','Bảo lưu quá hạn','Thôi học','Đã thôi học')))
      $$;
      REVOKE ALL ON FUNCTION app_schedule_member_ids(uuid) FROM PUBLIC;
      CREATE FUNCTION app_schedule_count(offering uuid) RETURNS integer
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN public.app_schedule_allowed(offering,'scheduling.view') THEN
          (SELECT count(*)::integer FROM public.app_schedule_member_ids(offering)) ELSE NULL END
      $$;
      CREATE FUNCTION app_schedule_conflict(offering uuid, day date, slot text, room uuid, lecturer uuid, excluded uuid)
      RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
        SELECT CASE WHEN s.room_id=room THEN 'ROOM_CONFLICT' WHEN s.lecturer_id=lecturer THEN 'LECTURER_CONFLICT'
          WHEN EXISTS (SELECT 1 FROM public.course_offering_class_groups a JOIN public.course_offering_class_groups b ON a.class_group_id=b.class_group_id
            WHERE a.course_offering_id=offering AND b.course_offering_id=s.course_offering_id) THEN 'CLASS_GROUP_CONFLICT'
          ELSE 'STUDENT_CONFLICT' END
        FROM public.teaching_sessions s WHERE public.app_schedule_allowed(offering,'scheduling.write')
          AND s.session_date=day AND s.period::text=slot AND s.status<>'not_held' AND (excluded IS NULL OR s.id<>excluded)
          AND (s.room_id=room OR s.lecturer_id=lecturer OR EXISTS (
            SELECT 1 FROM public.course_offering_class_groups a JOIN public.course_offering_class_groups b ON a.class_group_id=b.class_group_id
            WHERE a.course_offering_id=offering AND b.course_offering_id=s.course_offering_id)
            OR EXISTS (SELECT 1 FROM public.app_schedule_member_ids(offering) a JOIN public.app_schedule_member_ids(s.course_offering_id) b ON a.identity=b.identity))
        ORDER BY s.start_time,s.id LIMIT 1
      $$;
      CREATE OR REPLACE FUNCTION app_schedule_audit() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
      DECLARE previous jsonb; next_value jsonb; offering uuid;
      BEGIN
        IF COALESCE(current_setting('app.scheduling_action',true),'')='' THEN
          IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        IF TG_OP<>'INSERT' THEN previous=to_jsonb(OLD); END IF;
        IF TG_OP<>'DELETE' THEN next_value=to_jsonb(NEW); END IF;
        offering=CASE WHEN TG_TABLE_NAME='course_offerings' THEN COALESCE(next_value->>'id',previous->>'id')::uuid
          ELSE COALESCE(next_value->>'course_offering_id',previous->>'course_offering_id')::uuid END;
        INSERT INTO public.auth_audit_logs(id,actor_staff_id,action,metadata,created_at,updated_at)
        VALUES (gen_random_uuid(),NULLIF(current_setting('app.group_staff_id',true),'')::uuid,
          'scheduling.'||TG_TABLE_NAME||'.'||lower(TG_OP),jsonb_build_object(
            'courseOfferingId',offering,'recordId',COALESCE(next_value->>'id',previous->>'id'),
            'groupIds',(SELECT jsonb_agg(l.class_group_id) FROM public.course_offering_class_groups l WHERE l.course_offering_id=offering),
            'action',current_setting('app.scheduling_action',true),
            'grants',COALESCE(NULLIF(current_setting('app.scheduling_grants',true),''),'[]')::jsonb,
            'statusBefore',previous->>'status','statusAfter',next_value->>'status',
            'revisionBefore',previous->>'updated_at','revisionAfter',next_value->>'updated_at'),now(),now());
        IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END $$;
      CREATE OR REPLACE FUNCTION app_schedule_columns() RETURNS trigger
      LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
      DECLARE action text=current_setting('app.scheduling_action',true);
      BEGIN
        IF COALESCE(action,'')='' THEN RETURN NEW; END IF;
        IF TG_TABLE_NAME='course_offerings' THEN
          IF TG_OP='INSERT' THEN
            IF NEW.gradebook_snapshot IS NOT NULL OR COALESCE(NEW.gradebook_status,'draft')<>'draft' OR COALESCE(NEW.gradebook_version,0)<>0 THEN
              RAISE EXCEPTION 'Organization cannot create grade data' USING ERRCODE='42501';
            END IF;
            RETURN NEW;
          END IF;
          IF action='write' AND (to_jsonb(NEW)-ARRAY['status','completed_at','completed_by_staff_id','updated_at'])
            IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','completed_at','completed_by_staff_id','updated_at']) THEN
            RAISE EXCEPTION 'Schedule write cannot change offering membership or grade data' USING ERRCODE='42501';
          END IF;
          IF action='organize' AND (to_jsonb(NEW)->'gradebook_snapshot' IS DISTINCT FROM to_jsonb(OLD)->'gradebook_snapshot'
            OR NEW.gradebook_status IS DISTINCT FROM OLD.gradebook_status OR NEW.gradebook_version IS DISTINCT FROM OLD.gradebook_version) THEN
            RAISE EXCEPTION 'Organization cannot change grades' USING ERRCODE='42501';
          END IF;
        ELSIF TG_TABLE_NAME='teaching_sessions' THEN
          IF NEW.course_offering_id IS DISTINCT FROM OLD.course_offering_id THEN
            RAISE EXCEPTION 'Session cannot be moved to another offering' USING ERRCODE='42501';
          END IF;
        ELSIF TG_TABLE_NAME='class_groups' THEN
          IF action='organize' AND (to_jsonb(NEW)-ARRAY['allowed_weekdays','group_type','updated_at']) IS DISTINCT FROM
            (to_jsonb(OLD)-ARRAY['allowed_weekdays','group_type','updated_at']) THEN
            RAISE EXCEPTION 'Organization cannot change group assignment or learner profiles' USING ERRCODE='42501';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS scheduling_column_guard ON course_offerings;
      CREATE TRIGGER scheduling_column_guard BEFORE INSERT OR UPDATE ON course_offerings FOR EACH ROW EXECUTE FUNCTION app_schedule_columns();
      DROP TRIGGER IF EXISTS scheduling_column_guard ON teaching_sessions;
      CREATE TRIGGER scheduling_column_guard BEFORE UPDATE ON teaching_sessions FOR EACH ROW EXECUTE FUNCTION app_schedule_columns();
      DROP TRIGGER IF EXISTS scheduling_column_guard ON class_groups;
      CREATE TRIGGER scheduling_column_guard BEFORE UPDATE ON class_groups FOR EACH ROW EXECUTE FUNCTION app_schedule_columns();
      DROP TRIGGER IF EXISTS scheduling_scope_audit ON course_offerings;
      CREATE TRIGGER scheduling_scope_audit BEFORE INSERT OR UPDATE OR DELETE ON course_offerings
        FOR EACH ROW EXECUTE FUNCTION app_schedule_audit();
      DROP TRIGGER IF EXISTS scheduling_scope_audit ON teaching_sessions;
      CREATE TRIGGER scheduling_scope_audit BEFORE INSERT OR UPDATE OR DELETE ON teaching_sessions
        FOR EACH ROW EXECUTE FUNCTION app_schedule_audit();
    `, { transaction });
  });
}

export async function down() {
  throw new Error('Use application compatibility mode; preserve grant scopes and audit history.');
}
