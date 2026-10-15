// Callers supply a SQL expression from their own roster query, never request input.
export function excludeRecognizedExamParticipant(participantExpression: string, subjectExpression = ':subjectId'): string {
  return `NOT EXISTS (
    SELECT 1 FROM subject_recognitions recognition
    JOIN admission_records recognized_record ON recognized_record.id = recognition.admission_record_id
    JOIN subjects target ON target.id = recognition.target_subject_id
    JOIN subjects offering_subject ON offering_subject.id = ${subjectExpression}
    WHERE recognition.status = 'approved'
      AND (CASE WHEN recognized_record.student_id IS NOT NULL
        THEN 'student:' || recognized_record.student_id::text
        ELSE 'admission:' || recognized_record.id::text END) = ${participantExpression}
      AND (COALESCE(target.canonical_subject_id, target.id) = COALESCE(offering_subject.canonical_subject_id, offering_subject.id)
        OR ((offering_subject.allow_cross_major OR cardinality(offering_subject.shared_major_ids) > 0)
          AND LOWER(TRIM(target.name)) = LOWER(TRIM(offering_subject.name))
          AND target.credits = offering_subject.credits AND target.program = offering_subject.program))
  )`;
}
