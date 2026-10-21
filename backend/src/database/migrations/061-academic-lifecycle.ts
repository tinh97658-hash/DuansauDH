import type { QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      CREATE TABLE class_membership_history (
        id uuid PRIMARY KEY, class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE RESTRICT,
        admission_record_id uuid REFERENCES admission_records(id) ON DELETE RESTRICT,
        student_id uuid REFERENCES students(id) ON DELETE RESTRICT,
        enrolled_at timestamptz NOT NULL, left_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        actor jsonb NOT NULL, reason text NOT NULL, CHECK (admission_record_id IS NOT NULL OR student_id IS NOT NULL)
      );
      CREATE INDEX class_membership_history_record_idx ON class_membership_history(admission_record_id, class_group_id);
      CREATE INDEX class_membership_history_student_idx ON class_membership_history(student_id, class_group_id);
      -- Recover memberships already removed before this migration only when a
      -- saved grade identifies the learner. Never infer history from a name.
      INSERT INTO class_membership_history (id,class_group_id,admission_record_id,student_id,enrolled_at,left_at,actor,reason)
      SELECT gen_random_uuid(), evidence.class_group_id, evidence.record_id, evidence.student_id,
        MIN(evidence.created_at), GREATEST(MAX(evidence.created_at), MAX(evidence.updated_at)),
        '{"name":"migration-061","role":"system"}'::jsonb, 'Khôi phục lịch sử từ bảng điểm đã lưu'
      FROM (
        SELECT book.class_group_id, ar.id record_id, COALESCE(ar.student_id,st.id) student_id, offering.created_at,book.updated_at
        FROM course_exam_gradebooks book JOIN course_offerings offering ON offering.id=book.course_offering_id
        JOIN class_groups cg ON cg.id=book.class_group_id
        CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
        LEFT JOIN students st ON grade->>'participantId'='student:' || st.id::text
        LEFT JOIN LATERAL (SELECT a.* FROM admission_records a WHERE grade->>'participantId'='admission:' || a.id::text
          OR (st.id IS NOT NULL AND a.student_id=st.id)
          ORDER BY CASE WHEN a.academic_year=cg.academic_year THEN 0 ELSE 1 END,a.created_at DESC,a.id LIMIT 1) ar ON true
        WHERE (ar.id IS NOT NULL OR st.id IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM class_group_members cm
          WHERE cm.class_group_id=book.class_group_id AND (cm.admission_record_id=ar.id OR cm.student_id=COALESCE(ar.student_id,st.id)))
      ) evidence GROUP BY evidence.class_group_id,evidence.record_id,evidence.student_id;
      CREATE VIEW academic_class_members AS
        SELECT id, class_group_id, admission_record_id, student_id, enrolled_at, NULL::timestamptz AS left_at FROM class_group_members
        UNION ALL SELECT id, class_group_id, admission_record_id, student_id, enrolled_at, left_at FROM class_membership_history;
      ALTER TABLE course_offerings ADD COLUMN gradebook_status varchar(20) NOT NULL DEFAULT 'draft'
        CHECK (gradebook_status IN ('draft','submitted','approved')),
        ADD COLUMN gradebook_version integer NOT NULL DEFAULT 0,
        ADD COLUMN gradebook_snapshot jsonb;
      CREATE TABLE gradebook_events (
        id uuid PRIMARY KEY, course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
        action varchar(30) NOT NULL, actor jsonb NOT NULL, note text NOT NULL,
        before_data jsonb NOT NULL, after_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX gradebook_events_offering_idx ON gradebook_events(course_offering_id, created_at);
      CREATE TABLE learner_transcript_issues (
        id uuid PRIMARY KEY, admission_record_id uuid NOT NULL REFERENCES admission_records(id) ON DELETE RESTRICT,
        class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE RESTRICT,
        actor jsonb NOT NULL, snapshot jsonb NOT NULL, digest varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX learner_transcript_issues_record_idx ON learner_transcript_issues(admission_record_id, created_at);
      UPDATE admission_records SET training_level='Thạc sĩ' WHERE lower(trim(training_level)) IN ('masters','master','thac si');
      UPDATE admission_records SET training_level='Tiến sĩ' WHERE lower(trim(training_level)) IN ('doctoral','doctor','phd','tien si');
      UPDATE admission_records ar SET study_status = CASE WHEN EXISTS (
        SELECT 1 FROM class_group_members cm JOIN class_groups cg ON cg.id = cm.class_group_id
        WHERE (cm.admission_record_id = ar.id OR (ar.student_id IS NOT NULL AND cm.student_id = ar.student_id))
          AND cg.program::text = CASE WHEN ar.training_level = 'Tiến sĩ' THEN 'doctoral' ELSE 'masters' END
      ) THEN 'Đang học' ELSE 'Đã trúng tuyển' END
      WHERE ar.study_status IN ('Đang học','Đã trúng tuyển');
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  // No automatic DROP of academic history or issued records.
  throw new Error("Migration 061 retains academic history. Restore a verified backup to roll back.");
}
