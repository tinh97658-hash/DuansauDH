import type {QueryInterface} from 'sequelize';

export async function up({context:qi}:{context:QueryInterface}) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`CREATE TABLE course_exam_candidate_attendance (
      session_id uuid NOT NULL,
      participant_id text NOT NULL,
      status varchar(20) NOT NULL CHECK(status IN ('present','absent_excused','absent_unexcused')),
      recorded_by uuid REFERENCES staff(id) ON DELETE SET NULL,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(session_id,participant_id),
      FOREIGN KEY(session_id,participant_id) REFERENCES course_exam_session_candidates(session_id,participant_id) ON DELETE RESTRICT
    );
    CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON course_exam_candidate_attendance
      FOR EACH ROW EXECUTE FUNCTION audit_capture();
    GRANT SELECT,INSERT,UPDATE ON course_exam_candidate_attendance TO pgsms_group_scoped;
    ALTER TABLE course_exam_candidate_attendance ENABLE ROW LEVEL SECURITY;
    CREATE POLICY exam_attendance_read ON course_exam_candidate_attendance FOR SELECT TO pgsms_group_scoped
      USING (EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id
        AND app_gradebook_offering_visible(s.course_offering_id)));
    CREATE POLICY exam_attendance_insert ON course_exam_candidate_attendance FOR INSERT TO pgsms_group_scoped
      WITH CHECK (EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id
        AND app_gradebook_offering_visible(s.course_offering_id) AND app_offering_allowed(s.course_offering_id,true)));
    CREATE POLICY exam_attendance_update ON course_exam_candidate_attendance FOR UPDATE TO pgsms_group_scoped
      USING (EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id
        AND app_gradebook_offering_visible(s.course_offering_id) AND app_offering_allowed(s.course_offering_id,true)))
      WITH CHECK (EXISTS(SELECT 1 FROM course_exam_sessions s WHERE s.id=session_id
        AND app_gradebook_offering_visible(s.course_offering_id) AND app_offering_allowed(s.course_offering_id,true)));`,{transaction});
  });
}

export async function down({context:qi}:{context:QueryInterface}) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM course_exam_candidate_attendance) THEN
        RAISE EXCEPTION 'Exam attendance records exist; downgrade refused';
      END IF;
    END $$;
    DROP TABLE course_exam_candidate_attendance;`,{transaction});
  });
}
