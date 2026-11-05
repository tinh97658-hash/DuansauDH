import type { QueryInterface } from 'sequelize';
import { PERMISSIONS } from '../../auth/permissions.js';

export async function up({context:qi}:{context:QueryInterface}) {
  await qi.sequelize.transaction(async transaction=>{
    for(const permission of PERMISSIONS.filter(value=>['exams.view','exams.write','scheduling.write'].includes(value.code))){
      await qi.sequelize.query(`INSERT INTO permissions(id,code,name,"group",description,sort_order,created_at,updated_at)
        VALUES(gen_random_uuid(),:code,:name,:group,:description,:sort,now(),now()) ON CONFLICT(code)
        DO UPDATE SET name=EXCLUDED.name,"group"=EXCLUDED."group",description=EXCLUDED.description,updated_at=now()`,
        {transaction,replacements:{...permission,sort:PERMISSIONS.indexOf(permission)}});
    }
    // Retain existing actions while narrowing their scope. Grade viewers do not
    // gain exam-writing access merely because they can enter or approve marks.
    await qi.sequelize.query(`
      INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT r.id,p.id,now(),now() FROM roles r CROSS JOIN permissions p
      WHERE p.code IN ('exams.view','exams.write') AND (r.code='admin' OR EXISTS (
        SELECT 1 FROM role_permissions old JOIN permissions legacy ON legacy.id=old.permission_id
        WHERE old.role_id=r.id AND ((p.code='exams.view' AND legacy.code IN ('scheduling.view','gradebook.view'))
          OR (p.code='exams.write' AND legacy.code='scheduling.write'))))
      ON CONFLICT(role_id,permission_id) DO NOTHING;
      DO $$ DECLARE definition text; BEGIN
        definition:=pg_get_functiondef('app_academic_write()'::regprocedure);
        definition:=replace(definition,
          'WHEN ''exam'' THEN public.app_institution_permission(''scheduling.write'',true)',
          'WHEN ''exam'' THEN current_setting(''app.academic_permission'',true)=''exams.write'' AND public.app_institution_permission(''exams.write'',true)');
        IF strpos(definition,'''exams.write''')=0 THEN RAISE EXCEPTION 'Unexpected exam write policy'; END IF;
        EXECUTE definition;
        definition:=pg_get_functiondef('app_academic_read()'::regprocedure);
        definition:=replace(definition,
          'WHEN ''exam'' THEN public.app_institution_permission(''scheduling.view'',false) OR public.app_institution_permission(''gradebook.view'',false) OR public.app_academic_write()',
          'WHEN ''exam'' THEN public.app_institution_permission(''exams.view'',false) OR public.app_academic_write()');
        IF strpos(definition,'''exams.view''')=0 THEN RAISE EXCEPTION 'Unexpected exam read policy'; END IF;
        EXECUTE definition;
      END $$;
      CREATE FUNCTION app_exam_arrangement_related(arrangement uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT
        NOT EXISTS(SELECT 1 FROM public.course_exam_sessions s WHERE s.arrangement_id=arrangement)
        OR EXISTS(SELECT 1 FROM public.course_exam_sessions s WHERE s.arrangement_id=arrangement
          AND public.app_gradebook_offering_visible(s.course_offering_id)) $$;
    `,{transaction});
    // Conflict checks retain access to the full timetable. Public list responses
    // are filtered by the service; writes are additionally constrained by RLS.
    const outside="COALESCE(current_setting('app.academic_domain',true),'')<>'exam'";
    const tables:Record<string,string>={
      course_exam_sessions:'app_gradebook_offering_visible(course_offering_id)',
      course_exam_session_candidates:'EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id AND app_gradebook_offering_visible(s.course_offering_id))',
      course_exam_workflows:'app_gradebook_offering_visible(course_offering_id)',
      gradebook_events:'app_gradebook_offering_visible(course_offering_id)',
      course_exam_arrangements:'app_exam_arrangement_related(id)',
    };
    for(const [table,predicate] of Object.entries(tables))for(const action of ['INSERT','UPDATE','DELETE']){
      const condition=`${outside} OR (${predicate})`;
      await qi.sequelize.query(`CREATE POLICY exam_responsibility_${action.toLowerCase()} ON ${table}
        AS RESTRICTIVE FOR ${action} TO pgsms_group_scoped
        ${action!=='INSERT'?`USING (${condition})`:''} ${action!=='DELETE'?`WITH CHECK (${condition})`:''}`,
        {transaction});
    }
    await qi.sequelize.query(`INSERT INTO auth_audit_logs(id,actor_staff_id,action,metadata,created_at,updated_at)
      VALUES(gen_random_uuid(),NULL,'policy.exam_schedule_permissions',
        jsonb_build_object('permissions',jsonb_build_array('exams.view','exams.write'),
          'scope','responsible classes and related merged offerings','legacyActionsPreserved',true),now(),now())`,{transaction});
  });
}

export async function down(){
  throw new Error('Không khôi phục quyền lịch học/lịch thi dùng chung hoặc mở rộng phạm vi tự động.');
}
