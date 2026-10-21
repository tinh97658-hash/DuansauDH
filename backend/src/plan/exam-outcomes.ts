import { notWithdrawnSql } from './study-leave-policy.js';

// Rank the learning attempt before edits to its gradebook. Expressions are
// application-owned SQL, never request input. Updates only break ties within
// the same attempt chronology, so editing an old class cannot revive its marks.
export function examAttemptOrderSql(attemptedAt: string, recordedAt: string, id: string) {
  return `${attemptedAt} DESC, ${recordedAt} DESC, ${id} DESC`;
}

// Withdrawals are the immutable evidence for failed, interrupted attempts. Keep
// original component marks in the snapshot; no unearned exam/final score is invented.
export function studyLeaveFailureOutcomesSql() {
  return `SELECT withdrawal.id::text id, withdrawal.admission_record_id,
    offering.id course_offering_id, withdrawal.class_group_id, offering.subject_id,
    CASE WHEN record.student_id IS NOT NULL THEN 'student:' || record.student_id::text
      ELSE 'admission:' || record.id::text END participant_id,
    withdrawal.created_at recorded_at, offering.created_at attempted_at,
    COALESCE(withdrawal.snapshot->'grades'->0, '{}'::jsonb) || jsonb_build_object(
      'participantId', CASE WHEN record.student_id IS NOT NULL THEN 'student:' || record.student_id::text ELSE 'admission:' || record.id::text END,
      'studyLeaveFailure', true, 'result', 'failed', 'courseScore', NULL, 'grade4', NULL,
      'letterGrade', '', 'examExempt', false, 'eligible', false,
      'notes', 'Không đạt do bảo lưu khi đã ghép lớp học phần; phải học lại từ đầu.') grade
    FROM course_offering_withdrawals withdrawal
    JOIN admission_records record ON record.id = withdrawal.admission_record_id
    JOIN course_offerings offering ON offering.id = withdrawal.course_offering_id
    WHERE withdrawal.snapshot->>'phase' = 'studying'`;
}

// All academic result readers use the same attempts, including leave failures.
// Scheduling continues to exclude every withdrawn learner from active rosters.
export function examOutcomesSql() {
  return `SELECT book.id::text id, identity.id admission_record_id, offering.id course_offering_id,
    book.class_group_id, offering.subject_id,
    CASE WHEN identity.student_id IS NOT NULL THEN 'student:' || identity.student_id::text
      ELSE entry.value->>'participantId' END participant_id,
    book.updated_at recorded_at, offering.created_at attempted_at, entry.value grade
    FROM course_exam_gradebooks book JOIN course_offerings offering ON offering.id = book.course_offering_id
    CROSS JOIN LATERAL jsonb_array_elements(book.grades) entry(value)
    LEFT JOIN admission_records identity ON entry.value->>'participantId' = 'admission:' || identity.id::text
    WHERE ${notWithdrawnSql("entry.value->>'participantId'", 'offering.id')}
    UNION ALL ${studyLeaveFailureOutcomesSql()}`;
}

export function studyLeaveFailureParticipantSql(participant: string, offering = ':offeringId') {
  return `EXISTS (SELECT 1 FROM course_offering_withdrawals failure
    JOIN admission_records failure_record ON failure_record.id = failure.admission_record_id
    WHERE failure.course_offering_id = ${offering} AND failure.snapshot->>'phase' = 'studying'
      AND (${participant} = failure.participant_id OR ${participant} = 'admission:' || failure_record.id::text
        OR ${participant} = 'student:' || failure_record.student_id::text))`;
}
