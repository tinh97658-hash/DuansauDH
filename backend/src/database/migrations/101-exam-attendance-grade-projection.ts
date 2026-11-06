import {QueryTypes,type QueryInterface} from 'sequelize';

export async function up({context:qi}:{context:QueryInterface}) {
 const [current]=await qi.sequelize.query<{schema:string}>('SELECT current_schema() AS schema',{type:QueryTypes.SELECT});
 const schema=`"${current.schema.replace(/"/g,'""')}"`;
 await qi.sequelize.transaction(async transaction=>{
  // Exam writers may record attendance, but must not acquire general mark-entry
  // privileges. Triggers project only server-derived attendance into saved books.
  await qi.sequelize.query(`CREATE FUNCTION app_project_exam_attendance(offering uuid) RETURNS void
   LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,${schema} AS $$
   BEGIN
    PERFORM 1 FROM course_offerings WHERE id=offering FOR UPDATE;
    WITH latest AS (
     SELECT DISTINCT ON(c.participant_id) c.participant_id,c.session_id,c.makeup_for_session_id,s.status,COALESCE(a.status,'present') AS attendance
     FROM course_exam_sessions s JOIN course_exam_session_candidates c ON c.session_id=s.id
     LEFT JOIN course_exam_candidate_attendance a ON a.session_id=c.session_id AND a.participant_id=c.participant_id
     WHERE s.course_offering_id=offering AND s.status IN ('scheduled','held')
     ORDER BY c.participant_id,s.exam_date DESC,s.start_time DESC,s.created_at DESC,s.id DESC
    ), effective AS (
     SELECT *,CASE WHEN makeup_for_session_id IS NOT NULL AND status<>'held' AND attendance='present'
       THEN 'absent_excused' ELSE attendance END AS attendance_status FROM latest
    ), projected AS (
     SELECT b.id,jsonb_agg(CASE WHEN mark->>'finalized'='true' OR (e.session_id IS NULL AND NOT(mark ? 'examSessionId')) THEN mark
      ELSE mark||jsonb_build_object('workflowPhase','final','examAttendanceStatus',COALESCE(e.attendance_status,'present'),
       'examSessionId',e.session_id,'isMakeup',e.makeup_for_session_id IS NOT NULL,
       'makeupScheduled',COALESCE(e.makeup_for_session_id IS NOT NULL AND e.status='scheduled' AND e.attendance='present',false))
       ||CASE WHEN COALESCE(e.attendance_status,'present')<>'present'
         OR (mark->>'examSessionId' IS DISTINCT FROM e.session_id::text AND
           (mark->>'examSessionId' IS NOT NULL OR e.makeup_for_session_id IS NOT NULL OR e.status IS DISTINCT FROM 'held'))
         OR COALESCE(mark->>'examAttendanceStatus','present')<>'present'
        THEN jsonb_build_object('examScore',NULL,'courseScore',NULL,'grade4',NULL,'letterGrade','','attemptScores','[]'::jsonb,
         'result',CASE WHEN e.attendance_status='absent_unexcused' THEN 'failed' ELSE 'pending' END)
        ELSE '{}'::jsonb END END ORDER BY pos) AS grades
     FROM course_exam_gradebooks b JOIN course_exam_workflows w ON w.course_offering_id=b.course_offering_id
     CROSS JOIN LATERAL jsonb_array_elements(b.grades) WITH ORDINALITY AS entries(mark,pos)
     LEFT JOIN effective e ON e.participant_id=mark->>'participantId'
     WHERE b.course_offering_id=offering AND w.mode='new' AND w.eligibility_status='approved' AND w.result_status NOT IN ('submitted','approved')
     GROUP BY b.id
    ) UPDATE course_exam_gradebooks b SET grades=p.grades,revision=b.revision+1,updated_at=now()
      FROM projected p WHERE b.id=p.id AND b.grades IS DISTINCT FROM p.grades;
   END $$;
   REVOKE ALL ON FUNCTION app_project_exam_attendance(uuid) FROM PUBLIC;
   CREATE FUNCTION app_project_exam_attendance_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,${schema} AS $$
   DECLARE offering uuid;
   BEGIN
    IF TG_TABLE_NAME='course_exam_sessions' THEN offering:=NEW.course_offering_id;
    ELSE SELECT course_offering_id INTO offering FROM course_exam_sessions WHERE id=NEW.session_id; END IF;
    PERFORM app_project_exam_attendance(offering);RETURN NEW;
   END $$;
   REVOKE ALL ON FUNCTION app_project_exam_attendance_trigger() FROM PUBLIC;
   CREATE TRIGGER exam_attendance_grade_projection AFTER INSERT OR UPDATE ON course_exam_candidate_attendance
    FOR EACH ROW EXECUTE FUNCTION app_project_exam_attendance_trigger();
   CREATE TRIGGER exam_candidate_grade_projection AFTER INSERT ON course_exam_session_candidates
    FOR EACH ROW EXECUTE FUNCTION app_project_exam_attendance_trigger();
   CREATE TRIGGER exam_session_grade_projection AFTER UPDATE OF status ON course_exam_sessions
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION app_project_exam_attendance_trigger();`,{transaction});
 });
}
export async function down({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.transaction(async transaction=>{
  await qi.sequelize.query(`DROP TRIGGER exam_attendance_grade_projection ON course_exam_candidate_attendance;
   DROP TRIGGER exam_candidate_grade_projection ON course_exam_session_candidates;
   DROP TRIGGER exam_session_grade_projection ON course_exam_sessions;
   DROP FUNCTION app_project_exam_attendance_trigger();DROP FUNCTION app_project_exam_attendance(uuid);`,{transaction});
 });
}
