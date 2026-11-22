import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      DROP INDEX IF EXISTS admission_rounds_year_intake_unique;
      CREATE INDEX IF NOT EXISTS admission_rounds_year_intake_idx
        ON admission_rounds (academic_year, intake_round)
        WHERE intake_round IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS admission_rounds_year_name_unique
        ON admission_rounds (academic_year, lower(btrim(name)));

      CREATE OR REPLACE FUNCTION app_guard_intake_round_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, public AS $$
      BEGIN
        IF OLD.intake_round IS NOT NULL AND
          (NEW.academic_year IS DISTINCT FROM OLD.academic_year OR NEW.intake_round IS DISTINCT FROM OLD.intake_round) AND (
            EXISTS(SELECT 1 FROM public.admission_evaluations WHERE round_id = OLD.id)
            OR (
              NOT EXISTS(
                SELECT 1 FROM public.admission_rounds other
                WHERE other.id <> OLD.id AND other.academic_year = OLD.academic_year AND other.intake_round = OLD.intake_round
              )
              AND (
                EXISTS(SELECT 1 FROM public.admission_records WHERE academic_year = OLD.academic_year AND intake_round = OLD.intake_round)
                OR EXISTS(SELECT 1 FROM public.class_groups WHERE academic_year = OLD.academic_year AND intake_round = OLD.intake_round)
              )
            )
          )
        THEN
          RAISE EXCEPTION 'Đợt đã có hồ sơ hoặc lớp; không thể đổi năm hoặc số đợt.' USING ERRCODE = '23503';
        END IF;

        IF OLD.intake_round IS NULL AND NEW.intake_round IS NOT NULL THEN
          IF EXISTS(
            SELECT 1 FROM public.admission_records r
            JOIN public.admission_evaluations e ON e.admission_record_id = r.id
            WHERE e.round_id = OLD.id
              AND (r.academic_year IS DISTINCT FROM NEW.academic_year OR (r.intake_round IS NOT NULL AND r.intake_round <> NEW.intake_round))
          ) OR EXISTS(
            SELECT 1 FROM public.admission_evaluations e
            JOIN public.admission_records r ON r.id = e.admission_record_id
            JOIN public.class_group_members m ON m.admission_record_id = r.id OR m.student_id = r.student_id
            JOIN public.class_groups g ON g.id = m.class_group_id AND g.program = 'masters'
            WHERE e.round_id = OLD.id AND (g.academic_year IS DISTINCT FROM NEW.academic_year OR g.intake_round IS DISTINCT FROM NEW.intake_round)
          ) THEN
            RAISE EXCEPTION 'Hồ sơ hoặc lớp đang khác năm hoặc đợt; cần đối soát trước khi đánh số đợt.' USING ERRCODE = '23503';
          END IF;
          UPDATE public.admission_records r
          SET intake_round = NEW.intake_round
          FROM public.admission_evaluations e
          WHERE e.admission_record_id = r.id AND e.round_id = OLD.id AND r.intake_round IS NULL;
        END IF;

        RETURN NEW;
      END $$;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      DROP INDEX IF EXISTS admission_rounds_year_name_unique;
      DROP INDEX IF EXISTS admission_rounds_year_intake_idx;
      CREATE UNIQUE INDEX IF NOT EXISTS admission_rounds_year_intake_unique
        ON admission_rounds (academic_year, intake_round)
        WHERE intake_round IS NOT NULL;

      CREATE OR REPLACE FUNCTION app_guard_intake_round_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, public AS $$
      BEGIN
        IF OLD.intake_round IS NOT NULL AND
          (NEW.academic_year IS DISTINCT FROM OLD.academic_year OR NEW.intake_round IS DISTINCT FROM OLD.intake_round) AND (
            EXISTS(SELECT 1 FROM public.admission_records WHERE academic_year = OLD.academic_year AND intake_round = OLD.intake_round)
            OR EXISTS(SELECT 1 FROM public.class_groups WHERE academic_year = OLD.academic_year AND intake_round = OLD.intake_round)
            OR EXISTS(SELECT 1 FROM public.admission_evaluations WHERE round_id = OLD.id)
          ) THEN RAISE EXCEPTION 'Đợt đã có hồ sơ hoặc lớp; không thể đổi năm hoặc số đợt.' USING ERRCODE = '23503'; END IF;
        IF OLD.intake_round IS NULL AND NEW.intake_round IS NOT NULL THEN
          IF EXISTS(SELECT 1 FROM public.admission_records r JOIN public.admission_evaluations e ON e.admission_record_id = r.id
            WHERE e.round_id = OLD.id AND (r.academic_year IS DISTINCT FROM NEW.academic_year
              OR (r.intake_round IS NOT NULL AND r.intake_round <> NEW.intake_round)))
            OR EXISTS(SELECT 1 FROM public.admission_evaluations e JOIN public.admission_records r ON r.id = e.admission_record_id
              JOIN public.class_group_members m ON m.admission_record_id = r.id OR m.student_id = r.student_id
              JOIN public.class_groups g ON g.id = m.class_group_id AND g.program = 'masters'
              WHERE e.round_id = OLD.id AND (g.academic_year IS DISTINCT FROM NEW.academic_year OR g.intake_round IS DISTINCT FROM NEW.intake_round))
          THEN RAISE EXCEPTION 'Hồ sơ hoặc lớp đang khác năm hoặc đợt; cần đối soát trước khi đánh số đợt.' USING ERRCODE = '23503'; END IF;
          UPDATE public.admission_records r SET intake_round = NEW.intake_round FROM public.admission_evaluations e
            WHERE e.admission_record_id = r.id AND e.round_id = OLD.id AND r.intake_round IS NULL;
        END IF;
        RETURN NEW;
      END $$;
    `, { transaction });
  });
}
