export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      CREATE TABLE course_exam_eligibility_snapshots (
        id uuid PRIMARY KEY, course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
        version integer NOT NULL CHECK(version > 0), rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array'),
        actor jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(course_offering_id,version), UNIQUE(id,course_offering_id)
      );
      CREATE TABLE course_exam_workflows (
        course_offering_id uuid PRIMARY KEY REFERENCES course_offerings(id) ON DELETE CASCADE,
        mode text NOT NULL DEFAULT 'new' CHECK(mode IN ('new','legacy_preserved')),
        eligibility_status text NOT NULL DEFAULT 'draft' CHECK(eligibility_status IN ('draft','submitted','approved')),
        eligibility_version integer NOT NULL DEFAULT 0 CHECK(eligibility_version>=0),
        eligibility_submission jsonb, eligibility_snapshot_id uuid,
        result_status text NOT NULL DEFAULT 'not_available' CHECK(result_status IN ('not_available','draft','submitted','approved')),
        result_version integer NOT NULL DEFAULT 0 CHECK(result_version>=0), result_snapshot jsonb,
        legacy_evidence jsonb, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        FOREIGN KEY(eligibility_snapshot_id,course_offering_id) REFERENCES course_exam_eligibility_snapshots(id,course_offering_id) ON DELETE RESTRICT,
        CHECK(eligibility_status<>'approved' OR eligibility_snapshot_id IS NOT NULL)
      );
      INSERT INTO course_exam_workflows(course_offering_id,mode,legacy_evidence)
      SELECT o.id, CASE WHEN o.gradebook_status<>'draft' OR o.gradebook_snapshot IS NOT NULL OR EXISTS(
        SELECT 1 FROM course_exam_gradebooks b CROSS JOIN LATERAL jsonb_array_elements(b.grades) g
        WHERE b.course_offering_id=o.id AND (g->>'examScore' IS NOT NULL OR g->>'finalized'='true'
          OR g->>'courseScore' IS NOT NULL OR g->>'grade4' IS NOT NULL OR COALESCE(g->>'letterGrade','')<>'' )
      ) THEN 'legacy_preserved' ELSE 'new' END,
      jsonb_build_object('gradebookStatus',o.gradebook_status,'gradebookVersion',o.gradebook_version,'snapshotPresent',o.gradebook_snapshot IS NOT NULL)
      FROM course_offerings o;
      CREATE TABLE course_exam_sessions (
        id uuid PRIMARY KEY, course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
        eligibility_snapshot_id uuid NOT NULL,
        exam_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL CHECK(end_time>start_time),
        room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
        status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','held','not_held','cancelled')),
        version integer NOT NULL DEFAULT 0 CHECK(version>=0),
        created_by uuid NOT NULL REFERENCES staff(id), updated_by uuid NOT NULL REFERENCES staff(id),
        confirmed_by uuid REFERENCES staff(id), confirmed_at timestamptz,
        note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        FOREIGN KEY(eligibility_snapshot_id,course_offering_id) REFERENCES course_exam_eligibility_snapshots(id,course_offering_id) ON DELETE RESTRICT,
        CHECK((status IN ('held','not_held')) = (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
      );
      CREATE INDEX course_exam_sessions_room_date ON course_exam_sessions(room_id,exam_date) WHERE status IN ('scheduled','held');
      CREATE INDEX course_exam_sessions_offering ON course_exam_sessions(course_offering_id);
      CREATE TABLE course_exam_session_candidates (
        session_id uuid NOT NULL REFERENCES course_exam_sessions(id) ON DELETE RESTRICT,
        participant_id text NOT NULL, PRIMARY KEY(session_id,participant_id)
      );
      CREATE INDEX course_exam_candidates_identity ON course_exam_session_candidates(participant_id,session_id);
      CREATE FUNCTION protect_exam_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Approved exam snapshots and session candidates are immutable'; END; $$;
      CREATE TRIGGER immutable_exam_snapshot BEFORE UPDATE OR DELETE ON course_exam_eligibility_snapshots FOR EACH ROW EXECUTE FUNCTION protect_exam_snapshot();
      CREATE TRIGGER immutable_exam_candidates BEFORE UPDATE OR DELETE ON course_exam_session_candidates FOR EACH ROW EXECUTE FUNCTION protect_exam_snapshot();
    `, { transaction });
    for (const table of ['course_exam_workflows', 'course_exam_eligibility_snapshots', 'course_exam_sessions', 'course_exam_session_candidates']) {
      await qi.sequelize.query(`CREATE TRIGGER trg_audit_change AFTER INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION audit_capture()`, { transaction });
    }
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // Never discard newly created exam history or approved grades on downgrade.
    await qi.sequelize.query(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM course_exam_sessions) OR EXISTS(SELECT 1 FROM course_exam_eligibility_snapshots)
        OR EXISTS(SELECT 1 FROM course_exam_workflows WHERE eligibility_version>0 OR result_version>0)
      THEN RAISE EXCEPTION 'Exam workflow has business history; downgrade refused to preserve grades and snapshots'; END IF;
    END $$;
    DROP TABLE course_exam_session_candidates;
    DROP TABLE course_exam_sessions;
    DROP TABLE course_exam_workflows;
    DROP TABLE course_exam_eligibility_snapshots;
    DROP FUNCTION protect_exam_snapshot();`, { transaction });
  });
}
