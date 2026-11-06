// Subject lists are complete plans. Legacy group/selection data is retained for
// history, but no longer controls eligibility or curriculum credit totals.
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query("SELECT pg_advisory_xact_lock(21026)", { transaction });
    await qi.sequelize.query("SELECT pg_advisory_xact_lock(714062)", { transaction });
    await qi.sequelize.query(`UPDATE curriculums c SET total_credits = (
      SELECT COALESCE(SUM(s.credits),0) FROM curriculum_subjects cs
      JOIN subjects s ON s.id=cs.subject_id WHERE cs.curriculum_id=c.id
    ), updated_at=NOW()`, { transaction });
    const temporaryNote = 'Cấu hình tạm theo yêu cầu người quản lý: 3 nhóm tự chọn, mỗi nhóm 8 TC, chọn đúng 4 TC (2/4 môn). Tổng tối thiểu đang cấu hình: 35 TC bắt buộc + 12 TC tự chọn = 47 TC. Chưa đối chiếu định mức với CTĐT ban hành; không dùng con số này làm chuẩn tốt nghiệp chính thức.';
    await qi.sequelize.query(`UPDATE curriculums SET note=NULLIF(BTRIM(REPLACE(note,:temporaryNote,''), E' \\n\\r\\t'),'')
      WHERE code='CT-NGANH-2026-17' AND POSITION(:temporaryNote IN note)>0`, { replacements: { temporaryNote }, transaction });
  });
}

// Derived totals can be recomputed by whichever application version is active.
export async function down() {}
