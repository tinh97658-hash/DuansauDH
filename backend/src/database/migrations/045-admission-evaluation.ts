export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      CREATE TABLE admission_rounds (
        id UUID PRIMARY KEY, name VARCHAR(200) NOT NULL, academic_year VARCHAR(10) NOT NULL,
        major_id UUID NOT NULL REFERENCES majors(id), quota INTEGER NOT NULL CHECK (quota > 0),
        cutoff NUMERIC(5,2) CHECK (cutoff BETWEEN 0 AND 20), regulation_no VARCHAR(300) NOT NULL,
        decision_no VARCHAR(300), decision_date DATE, rules JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE admission_evaluations (
        id UUID PRIMARY KEY, admission_record_id UUID NOT NULL UNIQUE REFERENCES admission_records(id) ON DELETE CASCADE,
        round_id UUID NOT NULL REFERENCES admission_rounds(id), inputs JSONB NOT NULL, record_snapshot JSONB NOT NULL,
        decision VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','admitted','rejected')),
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX admission_evaluations_round_idx ON admission_evaluations(round_id);
      CREATE TABLE admission_evaluation_history (
        id UUID PRIMARY KEY, admission_record_id UUID NOT NULL REFERENCES admission_records(id) ON DELETE RESTRICT,
        action VARCHAR(20) NOT NULL, actor VARCHAR(200) NOT NULL, snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX admission_evaluation_history_record_idx ON admission_evaluation_history(admission_record_id, created_at);
    `, { transaction });
  });
}
export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query("DROP TABLE admission_evaluation_history; DROP TABLE admission_evaluations; DROP TABLE admission_rounds", { transaction });
  });
}
