/** Mã chữ học phần không phải định danh duy nhất; tài liệu chính thức có thể dùng cùng mã chữ với mã số khác nhau. */
export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.query("DROP INDEX IF EXISTS subjects_major_program_code_text_unique");
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_major_program_code_text_unique
    ON subjects (major_id, program, code_text)
    WHERE code_text <> ''
  `);
}
