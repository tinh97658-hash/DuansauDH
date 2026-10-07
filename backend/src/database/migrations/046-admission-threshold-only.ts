export async function up({ context: qi }: any) {
  await qi.sequelize.query("ALTER TABLE admission_rounds DROP COLUMN IF EXISTS quota");
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query("ALTER TABLE admission_rounds ADD COLUMN quota INTEGER NOT NULL DEFAULT 1 CHECK (quota > 0)");
}
