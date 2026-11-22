import type {QueryInterface} from 'sequelize';

export async function up({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.query(`ALTER TABLE course_exam_sessions ADD COLUMN attendance_started_at timestamptz;
  UPDATE course_exam_sessions SET attendance_started_at=COALESCE(attendance_confirmed_at,confirmed_at)
  WHERE status='held'`);
}
export async function down({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.query(`DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM course_exam_sessions WHERE attendance_started_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Attendance has started; downgrade refused'; END IF;
 END $$;
 ALTER TABLE course_exam_sessions DROP COLUMN attendance_started_at`);
}
