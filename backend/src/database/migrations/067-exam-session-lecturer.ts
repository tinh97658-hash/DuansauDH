export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      ALTER TABLE course_exam_sessions
        ADD COLUMN lecturer_id uuid REFERENCES lecturers(id) ON DELETE RESTRICT;
      CREATE INDEX course_exam_sessions_lecturer_date
        ON course_exam_sessions(lecturer_id, exam_date) WHERE status IN ('scheduled','held');
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM course_exam_sessions WHERE lecturer_id IS NOT NULL)
        THEN RAISE EXCEPTION 'Exam lecturer assignments exist; downgrade refused'; END IF;
      END $$;
      ALTER TABLE course_exam_sessions DROP COLUMN lecturer_id;
    `, { transaction });
  });
}
