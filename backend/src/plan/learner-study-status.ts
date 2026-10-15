// SQL aliases are supplied by application code, never by request parameters.
export function assignedLearnerSql(alias: string): string {
  return `EXISTS (SELECT 1 FROM class_group_members member
    JOIN class_groups learner_group ON learner_group.id = member.class_group_id
    WHERE learner_group.program::text = CASE WHEN ${alias}.training_level = 'Tiến sĩ' THEN 'doctoral' ELSE 'masters' END
      AND (member.admission_record_id = ${alias}.id
        OR (${alias}.student_id IS NOT NULL AND member.student_id = ${alias}.student_id)))`;
}

export function learnerStudyStatusSql(alias: string): string {
  return `CASE WHEN ${alias}.study_status IN ('Đã trúng tuyển', 'Đang học') THEN
    CASE WHEN ${assignedLearnerSql(alias)} THEN 'Đang học' ELSE 'Đã trúng tuyển' END
    ELSE ${alias}.study_status END`;
}
