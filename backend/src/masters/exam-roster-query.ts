import { excludeRecognizedExamParticipant } from './recognized-exam-participant.js';
import { enrolledOfferingMemberSql } from '../scheduling/retake-groups.js';
import { notWithdrawnSql } from '../plan/study-leave-policy.js';
import { studyLeaveFailureOutcomesSql, studyLeaveFailureParticipantSql } from '../plan/exam-outcomes.js';
import { profileForeignLanguageExemptSql } from './foreign-language-exemption.js';

// Both readers use exactly the same roster, exemptions, saved marks and eligibility.
export function gradebookRosterSql(shared: boolean, summaryOnly = false): string {
  const roster = `      WITH book AS (
        SELECT revision, grades, class_group_id, updated_at FROM course_exam_gradebooks
        WHERE class_group_id IN (:groupIds) AND course_offering_id = :offeringId
      ), identities AS (
        SELECT cm.id member_id, ar.id admission_id, cm.class_group_id AS "classGroupId",
          CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text
            WHEN ar.id IS NOT NULL THEN 'admission:' || ar.id::text END AS "participantId",
          COALESCE(NULLIF(ar.code, ''), st.reg_no, '') AS code,
          COALESCE(NULLIF(ar.full_name, ''), st.full_name, '') AS "fullName",
          COALESCE(ar.last_name, '') AS "lastName", COALESCE(ar.first_name, '') AS "firstName",
          COALESCE(ar.dob::text, '') AS dob, COALESCE(ar.gender, '') AS gender,
          ar.study_status AS "studyStatus"
        FROM academic_class_members cm
        LEFT JOIN admission_records ar ON ar.id = cm.admission_record_id
        LEFT JOIN students st ON st.id = cm.student_id
        WHERE (cm.left_at IS NULL OR cm.left_at >= (SELECT created_at FROM course_offerings WHERE id = :offeringId)) AND cm.class_group_id IN (:groupIds)
          AND ${enrolledOfferingMemberSql('cm.class_group_id', `(CASE WHEN COALESCE(cm.student_id, ar.student_id) IS NOT NULL
            THEN 'student:' || COALESCE(cm.student_id, ar.student_id)::text ELSE 'admission:' || ar.id::text END)`, true)}
        ${shared ? `UNION ALL
        SELECT os.id, ar.id, CAST(:individualGroupId AS uuid),
          CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text ELSE 'admission:' || ar.id::text END,
          COALESCE(NULLIF(ar.code, ''), st.reg_no, ''), COALESCE(NULLIF(ar.full_name, ''), st.full_name, ''),
          COALESCE(ar.last_name, ''), COALESCE(ar.first_name, ''), COALESCE(ar.dob::text, ''), COALESCE(ar.gender, ''), ar.study_status
        FROM course_offering_students os JOIN admission_records ar ON ar.id = os.admission_record_id
        LEFT JOIN students st ON st.id = ar.student_id WHERE os.course_offering_id = :offeringId` : ""}
      ), people AS (
        SELECT DISTINCT ON ("participantId") "participantId", "classGroupId", code, "fullName", "lastName", "firstName", dob, gender, "studyStatus"
        FROM identities WHERE "participantId" IS NOT NULL
          AND (${notWithdrawnSql('"participantId"')} OR ${studyLeaveFailureParticipantSql('"participantId"')})
          AND ${excludeRecognizedExamParticipant('"participantId"')}
        ORDER BY "participantId", "classGroupId", admission_id NULLS LAST, member_id
      ), grade_map AS (
        SELECT DISTINCT ON (value->>'participantId') value->>'participantId' participant_id, value grade
        FROM book, LATERAL jsonb_array_elements(book.grades)
        ORDER BY value->>'participantId', book.updated_at DESC, book.class_group_id
      ), roster AS (
        SELECT p.*, COALESCE((SELECT failure.grade FROM (${studyLeaveFailureOutcomesSql()}) failure
          WHERE failure.course_offering_id = :offeringId AND failure.participant_id = p."participantId" LIMIT 1),
          CASE WHEN COALESCE(g.grade->>'finalized', 'false') <> 'true' AND ${profileForeignLanguageExemptSql('p."participantId"', ':subjectId', '(SELECT academic_year FROM class_groups WHERE id = p."classGroupId")')}
          THEN COALESCE(g.grade, '{}'::jsonb) || CAST(:foreignLanguageGrade AS jsonb)
          ELSE COALESCE(g.grade, '{}'::jsonb) END) grade,
          COALESCE(CASE WHEN g.grade->>'finalized' = 'true' THEN g.grade->'eligibilityPolicy' END, CAST(:policies AS jsonb)->p."classGroupId"::text) AS policy FROM people p
        LEFT JOIN grade_map g ON g.participant_id = p."participantId"
      ), assessed AS (
        SELECT roster.*, CASE
          WHEN grade->>'studyLeaveFailure' = 'true' THEN false
          WHEN grade->>'examExempt' = 'true' THEN false
          WHEN jsonb_typeof(grade->'testScore') IS DISTINCT FROM 'number'
            OR jsonb_typeof(grade->'assignmentScore') IS DISTINCT FROM 'number' THEN NULL
          WHEN (grade->>'testScore')::numeric NOT BETWEEN 0 AND 10
            OR (grade->>'assignmentScore')::numeric NOT BETWEEN 0 AND 10 THEN NULL
          ELSE (grade->>'testScore')::numeric >= (policy->'minimums'->>'testScore')::numeric
            AND (grade->>'assignmentScore')::numeric >= (policy->'minimums'->>'assignmentScore')::numeric
        END AS eligibility FROM roster
`;
  if (summaryOnly) return roster + `
      ) SELECT (SELECT COUNT(*)::int FROM roster) AS "totalRows",
        (SELECT COUNT(*)::int FROM assessed WHERE eligibility IS NULL) AS "unassessedRows"`;
  return roster + `      ), filtered AS (
        SELECT * FROM assessed
        WHERE (:mode <> 'exam' OR (
          ("participantId" = ANY(STRING_TO_ARRAY(:includeIds, ',')) OR eligibility = true)
          AND grade->>'examExempt' IS DISTINCT FROM 'true'
          AND grade->>'studyLeaveFailure' IS DISTINCT FROM 'true'
          AND NOT ("participantId" = ANY(STRING_TO_ARRAY(:excludeIds, ',')))
        ))
          AND (:search = '' OR POSITION(LOWER(:search) IN LOWER(code || ' ' || "fullName")) > 0)
      ), metadata AS (
        SELECT (SELECT COUNT(*)::int FROM roster) AS "totalRows",
          (SELECT COUNT(*)::int FROM assessed WHERE eligibility IS NULL) AS "unassessedRows",
          (SELECT COUNT(*)::int FROM filtered) AS total,
          COALESCE((SELECT SUM(revision)::int FROM book), 0) AS revision
      ), paging AS (
        SELECT *, LEAST(:page, GREATEST(1, CEIL(total::numeric / :pageSize)::int)) AS page FROM metadata
      ), selected AS (
        SELECT * FROM filtered
        ORDER BY LOWER(COALESCE(NULLIF("firstName", ''), SUBSTRING(TRIM("fullName") FROM '[^ ]+$'))), LOWER("fullName"), "participantId"
        LIMIT :pageSize OFFSET (SELECT (page - 1) * :pageSize FROM paging)
      )
      SELECT paging.*, COALESCE((SELECT jsonb_agg(to_jsonb(selected)) FROM selected), '[]'::jsonb) AS rows FROM paging`;
}
