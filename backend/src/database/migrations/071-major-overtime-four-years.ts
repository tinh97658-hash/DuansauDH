export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      ALTER TABLE majors ALTER COLUMN max_overtime_years SET DEFAULT 4;
      UPDATE majors SET max_overtime_years = 4, updated_at = NOW()
      WHERE max_overtime_years IS DISTINCT FROM 4;
    `, { transaction });
  });
}

export async function down() {
  throw new Error('Previous overtime values cannot be reconstructed automatically; restore a backup to roll back.');
}
