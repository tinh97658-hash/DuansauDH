/**
 * 015 — FIX: Gỡ bỏ ràng buộc NOT NULL của student_id trong bảng class_group_members
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.query(`
    ALTER TABLE "class_group_members" ALTER COLUMN "student_id" DROP NOT NULL;
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE "class_group_members" DROP CONSTRAINT IF EXISTS "class_group_members_group_student_unique";
  `);
}

export async function down({ context: queryInterface }: any) {
  // no-op
}
