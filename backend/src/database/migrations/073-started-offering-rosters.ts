import type { QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE course_offerings ADD COLUMN roster_started_at timestamptz;
      -- Both held and not-held sessions consume the scheduled start boundary.
      -- Snapshots are materialized before membership/timetable changes, so all
      -- roster readers (including grade entry) share the same participant IDs.
      CREATE FUNCTION freeze_started_offering_roster(offering_id uuid, previous_start timestamptz DEFAULT NULL)
      RETURNS void LANGUAGE plpgsql AS $$
      DECLARE cutoff timestamptz;
      BEGIN
        SELECT roster_started_at INTO cutoff FROM course_offerings WHERE id = offering_id;
        IF cutoff IS NULL THEN
        SELECT MIN(moment) INTO cutoff FROM (
          SELECT (session_date + start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' AS moment
          FROM teaching_sessions WHERE course_offering_id = offering_id
          UNION ALL
          SELECT completed_at FROM course_offerings WHERE id = offering_id AND status = 'completed'
          UNION ALL SELECT previous_start
        ) boundaries WHERE moment <= clock_timestamp();
        END IF;
        IF cutoff IS NULL THEN RETURN; END IF;
        UPDATE course_offerings SET roster_started_at = cutoff WHERE id = offering_id AND roster_started_at IS NULL;
        UPDATE course_offering_class_groups link SET participant_ids = ARRAY(
          SELECT DISTINCT participant_id FROM (
            SELECT CASE WHEN COALESCE(member.student_id, record.student_id) IS NOT NULL
              THEN 'student:' || COALESCE(member.student_id, record.student_id)::text
              WHEN member.admission_record_id IS NOT NULL THEN 'admission:' || member.admission_record_id::text END AS participant_id
            FROM academic_class_members member
            LEFT JOIN admission_records record ON record.id = member.admission_record_id
            WHERE member.class_group_id = link.class_group_id AND member.enrolled_at <= cutoff
              AND (member.left_at IS NULL OR member.left_at >= (SELECT created_at FROM course_offerings WHERE id = offering_id))
            UNION ALL
            -- Preserve recorded results when historical enrollment timestamps
            -- were imported after the actual teaching dates.
            SELECT grade->>'participantId' FROM course_exam_gradebooks book
            CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
            WHERE book.course_offering_id = offering_id AND book.class_group_id = link.class_group_id
          ) people WHERE participant_id IS NOT NULL ORDER BY participant_id
        ), updated_at = clock_timestamp()
        WHERE link.course_offering_id = offering_id AND link.participant_ids IS NULL;
      END $$;

      CREATE FUNCTION freeze_rosters_before_membership_change() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE linked record;
      BEGIN
        PERFORM pg_advisory_xact_lock(21026);
        FOR linked IN SELECT DISTINCT course_offering_id FROM course_offering_class_groups
          WHERE class_group_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.class_group_id ELSE NEW.class_group_id END
            OR (TG_OP = 'UPDATE' AND class_group_id = OLD.class_group_id)
        LOOP PERFORM freeze_started_offering_roster(linked.course_offering_id); END LOOP;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER freeze_rosters_before_membership_change
        BEFORE INSERT OR UPDATE OR DELETE ON class_group_members
        FOR EACH ROW EXECUTE FUNCTION freeze_rosters_before_membership_change();

      CREATE FUNCTION freeze_rosters_before_timetable_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(21026);
        IF TG_OP <> 'INSERT' THEN
          PERFORM freeze_started_offering_roster(OLD.course_offering_id,
            (OLD.session_date + OLD.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh');
        END IF;
        IF TG_OP <> 'DELETE' THEN
          PERFORM freeze_started_offering_roster(NEW.course_offering_id,
            (NEW.session_date + NEW.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh');
          RETURN NEW;
        END IF;
        RETURN OLD;
      END $$;
      CREATE TRIGGER freeze_rosters_before_timetable_change
        BEFORE INSERT OR UPDATE OR DELETE ON teaching_sessions
        FOR EACH ROW EXECUTE FUNCTION freeze_rosters_before_timetable_change();

      SELECT freeze_started_offering_roster(id) FROM course_offerings;
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      DROP TRIGGER freeze_rosters_before_timetable_change ON teaching_sessions;
      DROP TRIGGER freeze_rosters_before_membership_change ON class_group_members;
      DROP FUNCTION freeze_rosters_before_timetable_change();
      DROP FUNCTION freeze_rosters_before_membership_change();
      DROP FUNCTION freeze_started_offering_roster(uuid, timestamptz);
      ALTER TABLE course_offerings DROP COLUMN roster_started_at;
      -- Retain roster history already captured; rollback must not enroll late arrivals.
    `, { transaction });
  });
}
