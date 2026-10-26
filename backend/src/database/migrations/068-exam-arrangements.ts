// Existing sessions remain the academic records used by gradebooks. An
// arrangement only groups their room/invigilator reservation and rounds.
export async function up({context: qi}: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      CREATE TABLE course_exam_arrangements (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 0 CHECK(version>=0),
        note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      INSERT INTO course_exam_arrangements(id) SELECT id FROM course_exam_sessions;
      ALTER TABLE course_exam_sessions
        ADD COLUMN arrangement_id uuid REFERENCES course_exam_arrangements(id) ON DELETE RESTRICT,
        ADD COLUMN round_no integer NOT NULL DEFAULT 1 CHECK(round_no>0);
      UPDATE course_exam_sessions SET arrangement_id=id;
      ALTER TABLE course_exam_sessions ALTER COLUMN arrangement_id SET NOT NULL;
      CREATE INDEX course_exam_sessions_arrangement ON course_exam_sessions(arrangement_id);
      CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON course_exam_arrangements
        FOR EACH ROW EXECUTE FUNCTION audit_capture();
    `, {transaction});
  });
}

export async function down({context: qi}: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM course_exam_sessions WHERE arrangement_id<>id OR round_no<>1)
          OR EXISTS(SELECT 1 FROM course_exam_arrangements WHERE version>0)
        THEN RAISE EXCEPTION 'Grouped exam history exists; downgrade refused'; END IF;
      END $$;
      ALTER TABLE course_exam_sessions DROP COLUMN arrangement_id, DROP COLUMN round_no;
      DROP TABLE course_exam_arrangements;
    `, {transaction});
  });
}
