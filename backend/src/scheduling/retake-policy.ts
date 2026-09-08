import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";

export const commonWeekdays = (groups: Array<{ allowedWeekdays?: number[] }>) =>
  [1, 2, 3, 4, 5, 6, 0].filter((day) => groups.every((group) => (group.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0]).includes(day)));

export const isEarlierAcademicYear = (source: string, target: string) => {
  const a = String(source || "").match(/\d+/g)?.map(Number);
  const b = String(target || "").match(/\d+/g)?.map(Number);
  return Boolean(a?.length && b?.length && a[0] < b[0]);
};

// A retake is an explicit, persisted decision after completion, never inferred from demo data.
export async function readRetakes(sequelize: Sequelize, subjectId: string, transaction?: Transaction): Promise<any[]> {
  return sequelize.query(`
    SELECT r.id AS "retakeId", a.id, a.code, a.full_name AS "fullName",
      a.academic_year AS "academicYear", a.major_id AS "majorId", a.student_id AS "studentId",
      CASE WHEN a.student_id IS NULL THEN 'admission:' || a.id::text ELSE 'student:' || a.student_id::text END AS "participantId",
      r.source_course_offering_id AS "sourceCourseOfferingId",
      ARRAY(SELECT day FROM unnest(ARRAY[1,2,3,4,5,6,0]) day WHERE NOT EXISTS (
        SELECT 1 FROM course_offering_class_groups sg JOIN class_groups g ON g.id = sg.class_group_id
        WHERE sg.course_offering_id = r.source_course_offering_id AND NOT (day = ANY(g.allowed_weekdays))
      )) AS "allowedWeekdays"
    FROM scheduling_retakes r
    JOIN admission_records a ON a.id = r.admission_record_id
    JOIN course_offerings source ON source.id = r.source_course_offering_id AND source.status = 'completed'
    WHERE r.subject_id = :subjectId AND r.assigned_course_offering_id IS NULL
      AND a.status = 'approved' AND a.training_level = 'Thạc sĩ'
      AND NOT EXISTS (
        SELECT 1 FROM course_offerings active
        WHERE active.subject_id = r.subject_id AND active.status = 'active' AND (
          EXISTS (SELECT 1 FROM course_offering_students os JOIN admission_records oa ON oa.id = os.admission_record_id
            WHERE os.course_offering_id = active.id AND (oa.id = a.id OR (a.student_id IS NOT NULL AND oa.student_id = a.student_id)))
          OR EXISTS (SELECT 1 FROM course_offering_class_groups og JOIN class_group_members gm ON gm.class_group_id = og.class_group_id
            LEFT JOIN admission_records ga ON ga.id = gm.admission_record_id
            WHERE og.course_offering_id = active.id AND (gm.admission_record_id = a.id OR (a.student_id IS NOT NULL AND (gm.student_id = a.student_id OR ga.student_id = a.student_id))))
        )
      ) ORDER BY a.full_name, a.id`, { replacements: { subjectId }, type: QueryTypes.SELECT, transaction });
}
