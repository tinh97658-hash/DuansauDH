/** Mã số học phần có thể lặp khi mã chữ khác nhau theo chương trình khung chính thức. */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS subjects_major_program_code_number_unique");
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_major_program_code_number_unique
    ON subjects (major_id, program, code_number)
    WHERE code_number > 0
  `);
}
