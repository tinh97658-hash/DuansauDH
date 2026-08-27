/**
 * Ràng buộc toàn vẹn cho kế hoạch đào tạo, gói học phần và phân nhóm học viên.
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.sequelize.query(`
      UPDATE subject_packages AS package
      SET total_subjects = (
        SELECT COUNT(*)::integer
        FROM subject_package_subjects AS entry
        WHERE entry.package_id = package.id
      )
    `, { transaction });

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY class_group_id
                 ORDER BY active DESC, updated_at DESC, id
               ) AS row_number
        FROM subject_packages
        WHERE is_official = TRUE
      )
      UPDATE subject_packages AS package
      SET is_official = FALSE,
          updated_at = NOW()
      FROM ranked
      WHERE package.id = ranked.id
        AND ranked.row_number > 1
    `, { transaction });

    await queryInterface.sequelize.query(`
      DELETE FROM class_group_members AS duplicate
      USING class_group_members AS retained
      WHERE duplicate.admission_record_id IS NOT NULL
        AND duplicate.class_group_id = retained.class_group_id
        AND duplicate.admission_record_id = retained.admission_record_id
        AND duplicate.id > retained.id
    `, { transaction });

    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS subject_packages_code_unique`, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subject_packages_class_code_unique
      ON subject_packages (class_group_id, code)
    `, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subject_packages_one_official_per_class
      ON subject_packages (class_group_id)
      WHERE is_official = TRUE
    `, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS class_group_members_group_admission_unique
      ON class_group_members (class_group_id, admission_record_id)
      WHERE admission_record_id IS NOT NULL
    `, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_major_program_code_number_unique
      ON subjects (major_id, program, code_number)
      WHERE code_number > 0
    `, { transaction });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_major_program_code_text_unique
      ON subjects (major_id, program, code_text)
      WHERE code_text <> ''
    `, { transaction });
  });
}

export async function down({ context: queryInterface }: any) {
  for (const index of [
    "subjects_major_program_code_text_unique",
    "subjects_major_program_code_number_unique",
    "class_group_members_group_admission_unique",
    "subject_packages_one_official_per_class",
    "subject_packages_class_code_unique",
  ]) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${index}`);
  }
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS subject_packages_code_unique
    ON subject_packages (code)
  `);
}
