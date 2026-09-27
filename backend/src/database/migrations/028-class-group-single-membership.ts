/**
 * Mỗi học viên/hồ sơ tuyển sinh chỉ được thuộc một lớp học phần.
 * Giữ lại phân lớp được tạo sớm nhất nếu dữ liệu cũ đã bị trùng.
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY admission_record_id
                 ORDER BY enrolled_at ASC NULLS LAST, created_at ASC, id ASC
               ) AS row_number
        FROM class_group_members
        WHERE admission_record_id IS NOT NULL
      )
      DELETE FROM class_group_members AS membership
      USING ranked
      WHERE membership.id = ranked.id
        AND ranked.row_number > 1
    `, { transaction });

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY student_id
                 ORDER BY enrolled_at ASC NULLS LAST, created_at ASC, id ASC
               ) AS row_number
        FROM class_group_members
        WHERE student_id IS NOT NULL
      )
      DELETE FROM class_group_members AS membership
      USING ranked
      WHERE membership.id = ranked.id
        AND ranked.row_number > 1
    `, { transaction });

    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS class_group_members_group_admission_unique",
      { transaction },
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS class_group_members_admission_unique
      ON class_group_members (admission_record_id)
      WHERE admission_record_id IS NOT NULL
    `, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS class_group_members_student_unique
      ON class_group_members (student_id)
      WHERE student_id IS NOT NULL
    `, { transaction });
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS class_group_members_student_unique",
      { transaction },
    );
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS class_group_members_admission_unique",
      { transaction },
    );
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS class_group_members_group_admission_unique
      ON class_group_members (class_group_id, admission_record_id)
      WHERE admission_record_id IS NOT NULL
    `, { transaction });
  });
}
