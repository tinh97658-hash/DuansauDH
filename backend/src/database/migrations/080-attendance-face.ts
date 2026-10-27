import type { QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query(`
      CREATE TABLE IF NOT EXISTS teaching_session_attendance (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teaching_session_id uuid NOT NULL REFERENCES teaching_sessions(id) ON DELETE CASCADE,
        participant_id varchar(80) NOT NULL,
        display_name varchar(200) NOT NULL,
        status varchar(20) NOT NULL,
        source varchar(20) NOT NULL,
        face_event_id bigint,
        confidence numeric(6, 5),
        policy_version varchar(64),
        note text,
        recorded_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT teaching_session_attendance_participant_check
          CHECK (participant_id ~ '^(student|admission):[0-9a-fA-F-]{36}$'),
        CONSTRAINT teaching_session_attendance_status_check
          CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'LEFT_EARLY', 'LATE_EARLY')),
        CONSTRAINT teaching_session_attendance_source_check
          CHECK (source IN ('FACE', 'MANUAL', 'REVIEW')),
        CONSTRAINT teaching_session_attendance_confidence_check
          CHECK (confidence IS NULL OR confidence BETWEEN -1 AND 1),
        CONSTRAINT teaching_session_attendance_unique_participant
          UNIQUE (teaching_session_id, participant_id)
      );

      CREATE INDEX IF NOT EXISTS teaching_session_attendance_session_idx
        ON teaching_session_attendance (teaching_session_id, status);
      CREATE INDEX IF NOT EXISTS teaching_session_attendance_participant_idx
        ON teaching_session_attendance (participant_id);

      CREATE TABLE IF NOT EXISTS attendance_recognition_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teaching_session_id uuid NOT NULL REFERENCES teaching_sessions(id) ON DELETE CASCADE,
        participant_id varchar(80),
        face_event_id bigint,
        decision varchar(16) NOT NULL,
        reason varchar(64),
        top1_subject_id varchar(80),
        top1_score numeric(6, 5),
        top2_subject_id varchar(80),
        top2_score numeric(6, 5),
        margin numeric(6, 5),
        threshold_accept numeric(6, 5),
        threshold_review numeric(6, 5),
        quality_score numeric(6, 5),
        quality jsonb NOT NULL DEFAULT '{}'::jsonb,
        candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
        model_version varchar(128) NOT NULL,
        policy_version varchar(64),
        latency_ms integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT attendance_recognition_events_participant_check
          CHECK (participant_id IS NULL OR participant_id ~ '^(student|admission):[0-9a-fA-F-]{36}$'),
        CONSTRAINT attendance_recognition_events_decision_check
          CHECK (decision IN ('ACCEPT', 'REVIEW', 'UNKNOWN', 'ERROR')),
        CONSTRAINT attendance_recognition_events_score_check
          CHECK (
            (top1_score IS NULL OR top1_score BETWEEN -1 AND 1)
            AND (top2_score IS NULL OR top2_score BETWEEN -1 AND 1)
            AND (margin IS NULL OR margin BETWEEN 0 AND 2)
            AND (threshold_accept IS NULL OR threshold_accept BETWEEN 0 AND 1)
            AND (threshold_review IS NULL OR threshold_review BETWEEN 0 AND 1)
            AND (quality_score IS NULL OR quality_score BETWEEN 0 AND 1)
          ),
        CONSTRAINT attendance_recognition_events_candidates_check
          CHECK (jsonb_typeof(candidates) = 'array'),
        CONSTRAINT attendance_recognition_events_quality_check
          CHECK (jsonb_typeof(quality) = 'object')
      );

      CREATE INDEX IF NOT EXISTS attendance_recognition_events_session_idx
        ON attendance_recognition_events (teaching_session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS attendance_recognition_events_decision_idx
        ON attendance_recognition_events (decision, created_at DESC);
      CREATE INDEX IF NOT EXISTS attendance_recognition_events_face_event_idx
        ON attendance_recognition_events (face_event_id)
        WHERE face_event_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS attendance_review_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teaching_session_id uuid NOT NULL REFERENCES teaching_sessions(id) ON DELETE CASCADE,
        event_id uuid NOT NULL UNIQUE REFERENCES attendance_recognition_events(id) ON DELETE CASCADE,
        participant_id varchar(80),
        suggested_subject_id varchar(80),
        status varchar(16) NOT NULL DEFAULT 'PENDING',
        resolution varchar(32),
        resolved_subject_id varchar(80),
        reviewed_attendance_id uuid REFERENCES teaching_session_attendance(id) ON DELETE SET NULL,
        resolved_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
        resolved_at timestamptz,
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT attendance_review_queue_status_check
          CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
        CONSTRAINT attendance_review_queue_resolution_check
          CHECK (resolution IS NULL OR resolution IN ('ACCEPT_SUGGESTED', 'ASSIGN_OTHER', 'REJECT', 'DISMISS')),
        CONSTRAINT attendance_review_queue_subject_check
          CHECK (
            (participant_id IS NULL OR participant_id ~ '^(student|admission):[0-9a-fA-F-]{36}$')
            AND (suggested_subject_id IS NULL OR suggested_subject_id ~ '^(student|admission):[0-9a-fA-F-]{36}$')
            AND (resolved_subject_id IS NULL OR resolved_subject_id ~ '^(student|admission):[0-9a-fA-F-]{36}$')
          )
      );

      CREATE INDEX IF NOT EXISTS attendance_review_queue_pending_idx
        ON attendance_review_queue (teaching_session_id, created_at)
        WHERE status = 'PENDING';

      COMMENT ON TABLE teaching_session_attendance IS
        'One attendance row per participant per teaching session. No biometric payloads.';
      COMMENT ON TABLE attendance_recognition_events IS
        'Audit of face-service decisions. Stores scores/metadata only, never images or embeddings.';
      COMMENT ON TABLE attendance_review_queue IS
        'PGSMS-owned review queue. Face-service integration calls do not create local reviews.';

      -- Helper to verify session scope with app_offering_allowed if installed.
      CREATE OR REPLACE FUNCTION app_attendance_session_allowed(p_session_id uuid, p_writing boolean)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_offering_allowed') THEN
          RETURN EXISTS (
            SELECT 1
            FROM public.teaching_sessions s
            WHERE s.id = p_session_id
              AND public.app_offering_allowed(s.course_offering_id, p_writing)
          );
        ELSE
          RETURN TRUE;
        END IF;
      END;
      $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgsms_group_scoped') THEN
          CREATE ROLE pgsms_group_scoped NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;

      ALTER TABLE teaching_session_attendance ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS group_scope_read ON teaching_session_attendance;
      CREATE POLICY group_scope_read ON teaching_session_attendance
        FOR SELECT TO pgsms_group_scoped
        USING (app_attendance_session_allowed(teaching_session_id, false));

      DROP POLICY IF EXISTS group_scope_insert ON teaching_session_attendance;
      CREATE POLICY group_scope_insert ON teaching_session_attendance
        FOR INSERT TO pgsms_group_scoped
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_update ON teaching_session_attendance;
      CREATE POLICY group_scope_update ON teaching_session_attendance
        FOR UPDATE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        )
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_delete ON teaching_session_attendance;
      CREATE POLICY group_scope_delete ON teaching_session_attendance
        FOR DELETE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      ALTER TABLE attendance_recognition_events ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS group_scope_read ON attendance_recognition_events;
      CREATE POLICY group_scope_read ON attendance_recognition_events
        FOR SELECT TO pgsms_group_scoped
        USING (app_attendance_session_allowed(teaching_session_id, false));

      DROP POLICY IF EXISTS group_scope_insert ON attendance_recognition_events;
      CREATE POLICY group_scope_insert ON attendance_recognition_events
        FOR INSERT TO pgsms_group_scoped
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_update ON attendance_recognition_events;
      CREATE POLICY group_scope_update ON attendance_recognition_events
        FOR UPDATE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        )
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_delete ON attendance_recognition_events;
      CREATE POLICY group_scope_delete ON attendance_recognition_events
        FOR DELETE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      ALTER TABLE attendance_review_queue ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS group_scope_read ON attendance_review_queue;
      CREATE POLICY group_scope_read ON attendance_review_queue
        FOR SELECT TO pgsms_group_scoped
        USING (app_attendance_session_allowed(teaching_session_id, false));

      DROP POLICY IF EXISTS group_scope_insert ON attendance_review_queue;
      CREATE POLICY group_scope_insert ON attendance_review_queue
        FOR INSERT TO pgsms_group_scoped
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_update ON attendance_review_queue;
      CREATE POLICY group_scope_update ON attendance_review_queue
        FOR UPDATE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        )
        WITH CHECK (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      DROP POLICY IF EXISTS group_scope_delete ON attendance_review_queue;
      CREATE POLICY group_scope_delete ON attendance_review_queue
        FOR DELETE TO pgsms_group_scoped
        USING (
          COALESCE(current_setting('app.group_read_only', true), 'true') <> 'true'
          AND app_attendance_session_allowed(teaching_session_id, true)
        );

      GRANT SELECT, INSERT, UPDATE, DELETE ON teaching_session_attendance TO pgsms_group_scoped;
      GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_recognition_events TO pgsms_group_scoped;
      GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_review_queue TO pgsms_group_scoped;

      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_capture') THEN
          DROP TRIGGER IF EXISTS audit_capture_trg ON teaching_session_attendance;
          CREATE TRIGGER audit_capture_trg
            AFTER INSERT OR UPDATE OR DELETE ON teaching_session_attendance
            FOR EACH ROW EXECUTE FUNCTION audit_capture();

          DROP TRIGGER IF EXISTS audit_capture_trg ON attendance_recognition_events;
          CREATE TRIGGER audit_capture_trg
            AFTER INSERT OR UPDATE OR DELETE ON attendance_recognition_events
            FOR EACH ROW EXECUTE FUNCTION audit_capture();

          DROP TRIGGER IF EXISTS audit_capture_trg ON attendance_review_queue;
          CREATE TRIGGER audit_capture_trg
            AFTER INSERT OR UPDATE OR DELETE ON attendance_review_queue
            FOR EACH ROW EXECUTE FUNCTION audit_capture();
        END IF;
      END $$;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query(`
      DROP TABLE IF EXISTS attendance_review_queue CASCADE;
      DROP TABLE IF EXISTS attendance_recognition_events CASCADE;
      DROP TABLE IF EXISTS teaching_session_attendance CASCADE;
      DROP FUNCTION IF EXISTS app_attendance_session_allowed(uuid, boolean);
    `, { transaction });
  });
}
