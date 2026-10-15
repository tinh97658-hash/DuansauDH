export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      CREATE TABLE study_leaves (
        id uuid PRIMARY KEY, admission_record_id uuid NOT NULL REFERENCES admission_records(id) ON DELETE RESTRICT,
        reason text NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','resumed','withdrawn')),
        activated_at timestamptz, closed_date date, decision_note text,
        extensions jsonb NOT NULL DEFAULT '[]', history jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW(),
        CHECK (end_date >= start_date)
      );
      CREATE UNIQUE INDEX study_leaves_one_open ON study_leaves(admission_record_id) WHERE status IN ('pending','approved');
      CREATE INDEX study_leaves_due ON study_leaves(status, start_date, end_date);
      CREATE TABLE course_offering_withdrawals (
        id uuid PRIMARY KEY, study_leave_id uuid NOT NULL REFERENCES study_leaves(id) ON DELETE RESTRICT,
        admission_record_id uuid NOT NULL REFERENCES admission_records(id) ON DELETE RESTRICT,
        course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,
        class_group_id uuid REFERENCES class_groups(id) ON DELETE RESTRICT,
        participant_id text NOT NULL, effective_date date NOT NULL,
        snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE(admission_record_id, course_offering_id)
      );
      CREATE INDEX course_withdrawals_participant ON course_offering_withdrawals(participant_id, course_offering_id);
    `, { transaction });
    await qi.sequelize.query(`INSERT INTO study_statuses (id, code, name, active, created_at, updated_at)
      VALUES (gen_random_uuid(), 'RESERVE_ACTIVE', 'Đang bảo lưu', true, NOW(), NOW()),
        (gen_random_uuid(), 'RESERVE_OVERDUE', 'Bảo lưu quá hạn', true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING`, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`DROP TABLE course_offering_withdrawals; DROP TABLE study_leaves;`);
}
