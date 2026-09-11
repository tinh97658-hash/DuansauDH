/**
 * 031 — GẮN LẠI CTĐT CHO CÁC LỚP CÒN THIẾU LIÊN KẾT.
 *
 * Bất biến nghiệp vụ: mỗi lớp/nhóm học viên luôn thuộc đúng **một** CTĐT của
 * ngành + bậc + khóa của mình. Liên kết có thể bị mất khi bản ghi CTĐT từng bị xoá
 * (`class_groups.curriculum_id` là `ON DELETE SET NULL`), nên migration này gắn lại.
 *
 * Idempotent: chỉ cập nhật những lớp còn `curriculum_id IS NULL` và có CTĐT khớp.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      UPDATE class_groups cg
      SET curriculum_id = c.id,
          updated_at = NOW()
      FROM curriculums c
      WHERE cg.curriculum_id IS NULL
        AND c.major_id = cg.major_id
        AND c.program::text = cg.program::text
        AND c.applicable_from_year = COALESCE(cg.academic_year, '')
    `, { transaction });
  });
}

export async function down() {
  // Không thể hoàn tác: không xác định được lớp nào vốn đã không có CTĐT.
}
