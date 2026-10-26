// Existing academic history is retained. Only the two active admission statuses
// are reconciled; leave/withdrawal decisions must never be rewritten here.
export async function up({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE admission_records SET study_status=CASE
    WHEN COALESCE(extra_data->'tuitionPayment'->>'paid','false')='true' THEN 'Đang học'
    ELSE 'Đã trúng tuyển' END, updated_at=NOW()
    WHERE training_level='Thạc sĩ' AND study_status IN ('Đã trúng tuyển','Đang học')
      AND study_status IS DISTINCT FROM CASE
        WHEN COALESCE(extra_data->'tuitionPayment'->>'paid','false')='true' THEN 'Đang học' ELSE 'Đã trúng tuyển' END`);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE admission_records ar SET study_status=CASE WHEN EXISTS (
    SELECT 1 FROM class_group_members member JOIN class_groups cg ON cg.id=member.class_group_id
    WHERE cg.program='masters' AND (member.admission_record_id=ar.id OR member.student_id=ar.student_id))
    THEN 'Đang học' ELSE 'Đã trúng tuyển' END, updated_at=NOW()
    WHERE ar.training_level='Thạc sĩ' AND ar.study_status IN ('Đã trúng tuyển','Đang học')`);
}
