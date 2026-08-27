export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.query(`
    ALTER TABLE students ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE staff ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE submissions ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE staff_students ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
  `);
  await queryInterface.addConstraint("students", { fields: ["email"], type: "check", where: queryInterface.sequelize.literal("email = lower(email)"), name: "students_email_lowercase" });
  await queryInterface.addConstraint("staff", { fields: ["email"], type: "check", where: queryInterface.sequelize.literal("email = lower(email)"), name: "staff_email_lowercase" });
  await queryInterface.addConstraint("students", { fields: ["completion_year"], type: "check", where: queryInterface.sequelize.literal("completion_year IS NULL OR completion_year BETWEEN 1900 AND 2200"), name: "students_completion_year_range" });
  await queryInterface.addConstraint("students", { fields: ["research_program"], type: "check", where: queryInterface.sequelize.literal("research_program IS NULL OR research_program IN ('phd', 'mphill')"), name: "students_research_program_values" });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeConstraint("students", "students_research_program_values");
  await queryInterface.removeConstraint("students", "students_completion_year_range");
  await queryInterface.removeConstraint("staff", "staff_email_lowercase");
  await queryInterface.removeConstraint("students", "students_email_lowercase");
  await queryInterface.sequelize.query(`
    ALTER TABLE students ALTER COLUMN id DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;
    ALTER TABLE staff ALTER COLUMN id DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;
    ALTER TABLE submissions ALTER COLUMN id DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;
    ALTER TABLE staff_students ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;
    ALTER TABLE sessions ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;
  `);
}
