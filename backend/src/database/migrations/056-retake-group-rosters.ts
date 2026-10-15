export async function up({ context: qi }: any) {
  await qi.sequelize.query(`ALTER TABLE course_offering_class_groups ADD COLUMN participant_ids text[] NULL`);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`ALTER TABLE course_offering_class_groups DROP COLUMN participant_ids`);
}
