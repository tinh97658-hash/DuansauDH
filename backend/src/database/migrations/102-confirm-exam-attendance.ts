import type {QueryInterface} from 'sequelize';

export async function up({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.transaction(async transaction=>{
  await qi.sequelize.query(`ALTER TABLE course_exam_sessions
   ADD COLUMN attendance_confirmed_at timestamptz,
   ADD COLUMN attendance_confirmed_by uuid REFERENCES staff(id) ON DELETE SET NULL;
   CREATE FUNCTION protect_confirmed_exam_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
   DECLARE confirmed_at timestamptz;
   BEGIN
    SELECT attendance_confirmed_at INTO confirmed_at FROM course_exam_sessions WHERE id=NEW.session_id FOR UPDATE;
    IF confirmed_at IS NOT NULL
    THEN RAISE EXCEPTION 'Trạng thái dự thi đã xác nhận và khóa, không thể chỉnh sửa.' USING ERRCODE='23514'; END IF;
    RETURN NEW;
   END $$;
   CREATE TRIGGER protect_confirmed_exam_attendance BEFORE INSERT OR UPDATE ON course_exam_candidate_attendance
    FOR EACH ROW EXECUTE FUNCTION protect_confirmed_exam_attendance();`,{transaction});
 });
}
export async function down({context:qi}:{context:QueryInterface}) {
 await qi.sequelize.transaction(async transaction=>{
  await qi.sequelize.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM course_exam_sessions WHERE attendance_confirmed_at IS NOT NULL)
   THEN RAISE EXCEPTION 'Confirmed attendance exists; downgrade refused'; END IF; END $$;
   DROP TRIGGER protect_confirmed_exam_attendance ON course_exam_candidate_attendance;
   DROP FUNCTION protect_confirmed_exam_attendance();
   ALTER TABLE course_exam_sessions DROP COLUMN attendance_confirmed_at,DROP COLUMN attendance_confirmed_by;`,{transaction});
 });
}
