import type { QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query(`
      ALTER TABLE course_offering_class_groups
        ADD COLUMN study_role varchar(12) NOT NULL DEFAULT 'primary'
        CHECK (study_role IN ('primary', 'retake'));

      -- Started primary classes also have frozen participant_ids. An array alone
      -- is not evidence of a retake: there must be an earlier attempt for this group.
      UPDATE course_offering_class_groups link SET study_role = 'retake'
      FROM course_offerings offering JOIN subjects subject ON subject.id = offering.subject_id
      WHERE offering.id = link.course_offering_id AND link.participant_ids IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM course_offering_class_groups previous_link
          JOIN course_offerings previous ON previous.id = previous_link.course_offering_id
          JOIN subjects previous_subject ON previous_subject.id = previous.subject_id
          WHERE previous_link.class_group_id = link.class_group_id
            AND (previous.created_at, previous.id) < (offering.created_at, offering.id)
            AND (COALESCE(previous_subject.canonical_subject_id, previous_subject.id)
                  = COALESCE(subject.canonical_subject_id, subject.id)
              OR ((subject.allow_cross_major OR previous_subject.allow_cross_major
                    OR cardinality(subject.shared_major_ids) > 0 OR cardinality(previous_subject.shared_major_ids) > 0)
                AND lower(trim(subject.name)) = lower(trim(previous_subject.name))
                AND subject.credits = previous_subject.credits AND subject.program = previous_subject.program))
        );
    `, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.removeColumn("course_offering_class_groups", "study_role");
}
