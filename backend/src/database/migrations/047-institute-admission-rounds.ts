export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      ALTER TABLE admission_rounds ADD COLUMN major_thresholds JSONB NOT NULL DEFAULT '[]'::jsonb;
      UPDATE admission_rounds SET major_thresholds = jsonb_build_array(jsonb_build_object('majorId', major_id, 'cutoff', cutoff));
      ALTER TABLE admission_rounds DROP COLUMN major_id, DROP COLUMN cutoff;
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // A shared round with several majors cannot be represented by the old schema.
    const [rows] = await qi.sequelize.query("SELECT id FROM admission_rounds WHERE jsonb_array_length(major_thresholds) <> 1 LIMIT 1", { transaction });
    if (rows.length) throw new Error("Cannot restore single-major rounds while shared rounds exist.");
    await qi.sequelize.query(`
      ALTER TABLE admission_rounds ADD COLUMN major_id UUID REFERENCES majors(id), ADD COLUMN cutoff NUMERIC(5,2) CHECK (cutoff BETWEEN 0 AND 20);
      UPDATE admission_rounds SET major_id = (major_thresholds->0->>'majorId')::uuid, cutoff = (major_thresholds->0->>'cutoff')::numeric;
      ALTER TABLE admission_rounds ALTER COLUMN major_id SET NOT NULL, DROP COLUMN major_thresholds;
    `, { transaction });
  });
}
