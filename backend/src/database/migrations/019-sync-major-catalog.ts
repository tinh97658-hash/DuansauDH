/**
 * Đồng bộ bậc đào tạo của chuyên ngành và dữ liệu snapshot trong hồ sơ tuyển sinh.
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.sequelize.query(`
      UPDATE majors AS major
      SET training_level_id = level.id,
          updated_at = NOW()
      FROM training_levels AS level
      WHERE (major.program = 'masters' AND level.code = 'MASTER')
         OR (major.program = 'doctoral' AND level.code = 'DOCTOR')
    `, { transaction });

    await queryInterface.sequelize.query(`
      UPDATE admission_records AS record
      SET major_name = major.name,
          training_level = CASE
            WHEN major.program = 'doctoral' THEN 'Tiến sĩ'
            ELSE 'Thạc sĩ'
          END,
          updated_at = NOW()
      FROM majors AS major
      WHERE record.major_id = major.id
        AND (
          record.major_name IS DISTINCT FROM major.name
          OR record.training_level IS DISTINCT FROM CASE
            WHEN major.program = 'doctoral' THEN 'Tiến sĩ'
            ELSE 'Thạc sĩ'
          END
        )
    `, { transaction });
  });
}

export async function down() {
  // Chuẩn hóa dữ liệu không được đảo ngược để tránh tái tạo trạng thái sai.
}
