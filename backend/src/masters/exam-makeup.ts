// The server chooses the roster. A CP absence becomes available again only
// when no later active attempt has already reserved that candidate.
export const pendingExamCandidatesSql = `SELECT w.course_offering_id,person AS person,
 person->>'participantId' AS participant_id,latest.id AS makeup_for_session_id
 FROM course_exam_workflows w JOIN course_exam_eligibility_snapshots p ON p.id=w.eligibility_snapshot_id
 CROSS JOIN LATERAL jsonb_array_elements(p.rows) person
 LEFT JOIN LATERAL (
  SELECT es.id,COALESCE(a.status,'present') AS attendance
  FROM course_exam_sessions es JOIN course_exam_session_candidates c ON c.session_id=es.id
  LEFT JOIN course_exam_candidate_attendance a ON a.session_id=c.session_id AND a.participant_id=c.participant_id
  WHERE es.course_offering_id=w.course_offering_id AND c.participant_id=person->>'participantId' AND es.status IN ('scheduled','held')
  ORDER BY es.exam_date DESC,es.start_time DESC,es.created_at DESC,es.id DESC LIMIT 1
 ) latest ON true
 WHERE w.course_offering_id IN (:offerings) AND w.mode='new' AND w.eligibility_status='approved'
 AND w.result_status NOT IN ('submitted','approved')
 AND person->>'eligible'='true' AND person->>'examExempt' IS DISTINCT FROM 'true'
 AND (latest.id IS NULL OR latest.attendance='absent_excused')`;
