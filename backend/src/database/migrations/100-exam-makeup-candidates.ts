import type {QueryInterface} from 'sequelize';

export async function up({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.transaction(async transaction=>{
  await qi.sequelize.query(`ALTER TABLE course_exam_session_candidates ADD COLUMN makeup_for_session_id uuid,
   ADD CONSTRAINT exam_makeup_source FOREIGN KEY(makeup_for_session_id,participant_id)
    REFERENCES course_exam_session_candidates(session_id,participant_id) ON DELETE RESTRICT,
   ADD CONSTRAINT exam_makeup_not_self CHECK(makeup_for_session_id IS DISTINCT FROM session_id);
   CREATE INDEX exam_makeup_source_idx ON course_exam_session_candidates(makeup_for_session_id,participant_id)
    WHERE makeup_for_session_id IS NOT NULL;
   WITH latest AS (
    SELECT DISTINCT ON(s.course_offering_id,c.participant_id) s.course_offering_id,c.participant_id,s.id AS session_id,COALESCE(a.status,'present') AS attendance
    FROM course_exam_sessions s JOIN course_exam_session_candidates c ON c.session_id=s.id
    LEFT JOIN course_exam_candidate_attendance a ON a.session_id=c.session_id AND a.participant_id=c.participant_id
    WHERE s.status IN ('scheduled','held') ORDER BY s.course_offering_id,c.participant_id,s.exam_date DESC,s.start_time DESC,s.created_at DESC,s.id DESC
   ), updated AS (
    SELECT b.id,jsonb_agg(CASE WHEN l.attendance IN ('absent_excused','absent_unexcused') AND mark->>'finalized' IS DISTINCT FROM 'true'
      THEN mark||jsonb_build_object('examAttendanceStatus',l.attendance,'examSessionId',l.session_id,'examScore',NULL,'courseScore',NULL,'grade4',NULL,
       'letterGrade','','attemptScores','[]'::jsonb,'result',CASE WHEN l.attendance='absent_unexcused' THEN 'failed' ELSE 'pending' END)
      ELSE mark END ORDER BY pos) AS grades,
     bool_or(l.attendance IN ('absent_excused','absent_unexcused') AND mark->>'finalized' IS DISTINCT FROM 'true') AS changed
    FROM course_exam_gradebooks b JOIN course_exam_workflows w ON w.course_offering_id=b.course_offering_id
    CROSS JOIN LATERAL jsonb_array_elements(b.grades) WITH ORDINALITY AS entries(mark,pos)
    LEFT JOIN latest l ON l.course_offering_id=b.course_offering_id AND l.participant_id=mark->>'participantId'
    WHERE w.mode='new' AND w.result_status NOT IN ('submitted','approved') GROUP BY b.id
   ) UPDATE course_exam_gradebooks b SET grades=u.grades,revision=b.revision+1,updated_at=now() FROM updated u WHERE b.id=u.id AND u.changed;`,{transaction});
 });
}
export async function down({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.transaction(async transaction=>{
  await qi.sequelize.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM course_exam_session_candidates WHERE makeup_for_session_id IS NOT NULL)
   THEN RAISE EXCEPTION 'Makeup exams exist; downgrade refused'; END IF; END $$;
   ALTER TABLE course_exam_session_candidates DROP COLUMN makeup_for_session_id;`,{transaction});
 });
}
