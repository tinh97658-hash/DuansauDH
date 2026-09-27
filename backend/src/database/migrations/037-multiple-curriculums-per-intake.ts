/**
 * A cohort may use more than one complete curriculum. Each class points to the
 * curriculum it actually follows through class_groups.curriculum_id.
 *
 * Bỏ ràng buộc unique `(major_id, program, applicable_from_year)` của migration 030 và
 * thay bằng index thường, để một ngành + bậc + khóa có thể có nhiều CTĐT. Khi phạm vi có
 * nhiều CTĐT, lớp bắt buộc chọn CTĐT của mình (`CurriculumService.assignToClassGroup` ném
 * lỗi nếu lớp chưa chọn). Chỉ `curriculums.code` giữ unique toàn cục.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeConstraint("curriculums", "curriculums_major_program_year_unique", { transaction });
    await qi.addIndex("curriculums", ["major_id", "program", "applicable_from_year"], {
      name: "curriculums_major_program_year_idx",
      transaction,
    });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeIndex("curriculums", "curriculums_major_program_year_idx", { transaction });
    await qi.addConstraint("curriculums", {
      fields: ["major_id", "program", "applicable_from_year"],
      type: "unique",
      name: "curriculums_major_program_year_unique",
      transaction,
    });
  });
}
