import type { QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query(`
      ALTER TABLE teaching_sessions
        ADD COLUMN attendance_state varchar(16) NOT NULL DEFAULT 'NOT_OPEN'
          CHECK (attendance_state IN ('NOT_OPEN', 'OPEN', 'CLOSED')),
        ADD COLUMN attendance_opened_at timestamptz,
        ADD COLUMN attendance_closed_at timestamptz,
        ADD COLUMN attendance_opened_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
        ADD COLUMN attendance_closed_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL;
      ALTER TABLE teaching_session_attendance DROP CONSTRAINT teaching_session_attendance_source_check;
      ALTER TABLE teaching_session_attendance ADD CONSTRAINT teaching_session_attendance_source_check
        CHECK (source IN ('FACE', 'MANUAL', 'REVIEW', 'SYSTEM'));
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query(`
      UPDATE teaching_session_attendance SET source = 'MANUAL' WHERE source = 'SYSTEM';
      ALTER TABLE teaching_session_attendance DROP CONSTRAINT teaching_session_attendance_source_check;
      ALTER TABLE teaching_session_attendance ADD CONSTRAINT teaching_session_attendance_source_check
        CHECK (source IN ('FACE', 'MANUAL', 'REVIEW'));
      ALTER TABLE teaching_sessions DROP COLUMN attendance_state, DROP COLUMN attendance_opened_at,
        DROP COLUMN attendance_closed_at, DROP COLUMN attendance_opened_by_staff_id,
        DROP COLUMN attendance_closed_by_staff_id;
    `, { transaction });
  });
}
