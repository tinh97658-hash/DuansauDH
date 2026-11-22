import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE admission_rounds ADD COLUMN intake_round integer CHECK (intake_round BETWEEN 1 AND 99);
      ALTER TABLE admission_records ADD COLUMN intake_round integer CHECK (intake_round BETWEEN 1 AND 99);
      -- Only explicitly numbered, unambiguous names are safe to map automatically.
      WITH numbered AS (
        SELECT id, academic_year, (substring(lower(name) FROM '^đợt\\s+([0-9]{1,2})(?:\\D|$)'))::integer AS n
        FROM admission_rounds
      ), unique_numbers AS (
        SELECT academic_year, n FROM numbered WHERE n BETWEEN 1 AND 99 GROUP BY academic_year,n HAVING count(*)=1
      ) UPDATE admission_rounds r SET intake_round=n.n FROM numbered n
        JOIN unique_numbers u ON u.academic_year=n.academic_year AND u.n=n.n WHERE r.id=n.id;
      CREATE UNIQUE INDEX admission_rounds_year_intake_unique ON admission_rounds(academic_year,intake_round) WHERE intake_round IS NOT NULL;
      UPDATE admission_records r SET intake_round=a.intake_round FROM admission_evaluations e
        JOIN admission_rounds a ON a.id=e.round_id WHERE e.admission_record_id=r.id AND r.academic_year=a.academic_year;
      WITH memberships AS (
        SELECT r.id, min(g.intake_round) AS n FROM admission_records r
        JOIN class_group_members m ON m.admission_record_id=r.id OR m.student_id=r.student_id
        JOIN class_groups g ON g.id=m.class_group_id AND g.academic_year=r.academic_year AND g.program='masters'
        WHERE r.intake_round IS NULL AND NOT EXISTS (SELECT 1 FROM admission_evaluations e WHERE e.admission_record_id=r.id)
        GROUP BY r.id HAVING count(DISTINCT g.intake_round)=1
      ) UPDATE admission_records r SET intake_round=m.n FROM memberships m WHERE r.id=m.id;
      CREATE INDEX admission_records_year_intake_idx ON admission_records(academic_year,intake_round);
      -- A global round must also respect references hidden by a staff member's RLS scope.
      CREATE FUNCTION app_guard_intake_round_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
        SET search_path=pg_catalog,public AS $$ BEGIN
        IF OLD.intake_round IS NOT NULL AND
          (NEW.academic_year IS DISTINCT FROM OLD.academic_year OR NEW.intake_round IS DISTINCT FROM OLD.intake_round) AND (
            EXISTS(SELECT 1 FROM public.admission_records WHERE academic_year=OLD.academic_year AND intake_round=OLD.intake_round)
            OR EXISTS(SELECT 1 FROM public.class_groups WHERE academic_year=OLD.academic_year AND intake_round=OLD.intake_round)
            OR EXISTS(SELECT 1 FROM public.admission_evaluations WHERE round_id=OLD.id)
          ) THEN RAISE EXCEPTION 'Đợt đã có hồ sơ hoặc lớp; không thể đổi năm hoặc số đợt.' USING ERRCODE='23503'; END IF;
        IF OLD.intake_round IS NULL AND NEW.intake_round IS NOT NULL THEN
          IF EXISTS(SELECT 1 FROM public.admission_records r JOIN public.admission_evaluations e ON e.admission_record_id=r.id
            WHERE e.round_id=OLD.id AND (r.academic_year IS DISTINCT FROM NEW.academic_year
              OR (r.intake_round IS NOT NULL AND r.intake_round<>NEW.intake_round)))
            OR EXISTS(SELECT 1 FROM public.admission_evaluations e JOIN public.admission_records r ON r.id=e.admission_record_id
              JOIN public.class_group_members m ON m.admission_record_id=r.id OR m.student_id=r.student_id
              JOIN public.class_groups g ON g.id=m.class_group_id AND g.program='masters'
              WHERE e.round_id=OLD.id AND (g.academic_year IS DISTINCT FROM NEW.academic_year OR g.intake_round IS DISTINCT FROM NEW.intake_round))
          THEN RAISE EXCEPTION 'Hồ sơ hoặc lớp đang khác năm hoặc đợt; cần đối soát trước khi đánh số đợt.' USING ERRCODE='23503'; END IF;
          UPDATE public.admission_records r SET intake_round=NEW.intake_round FROM public.admission_evaluations e
            WHERE e.admission_record_id=r.id AND e.round_id=OLD.id AND r.intake_round IS NULL;
        END IF;
        RETURN NEW;
      END $$;
      REVOKE ALL ON FUNCTION app_guard_intake_round_scope() FROM PUBLIC;
      CREATE TRIGGER guard_intake_round_scope BEFORE UPDATE ON admission_rounds
        FOR EACH ROW EXECUTE FUNCTION app_guard_intake_round_scope();
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query('DROP TRIGGER guard_intake_round_scope ON admission_rounds; DROP FUNCTION app_guard_intake_round_scope(); ALTER TABLE admission_records DROP COLUMN intake_round; ALTER TABLE admission_rounds DROP COLUMN intake_round;', { transaction });
  });
}
