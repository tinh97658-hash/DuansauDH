import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";
import { examAttemptOrderSql, studyLeaveFailureParticipantSql } from '../plan/exam-outcomes.js';
import { notWithdrawnSql, studyEligibleRecordSql } from "../plan/study-leave-policy.js";
import { resolveSavedExamGrade } from "../masters/exam-grade-calculation.js";
import type { CourseExamGrade } from "../database/models/training/course-exam-gradebook.model.js";
import type { GradingPolicy } from "../masters/grading-policy.js";
import { foreignLanguageExemptGrade, foreignLanguageSubjectSql } from "../masters/foreign-language-exemption.js";

export interface RetakeResult {
  classGroupId: string; subjectId: string; participantId: string; admissionRecordId: string;
  code: string; fullName: string; result: string; sourceStatus: string;
  recordedAt: string; attemptedAt?: string; bookId: string; sourceCourseOfferingId: string;
  studyType?: "retake" | "first_time";
}

// A resumed learner is queued even if their former merged class is still active.
// An explicit roster in a newer offering consumes the waiting item without touching history.
export async function readReturnedMembers(db: Sequelize, groupIds: string[], subjectIds: string[], transaction?: Transaction): Promise<RetakeResult[]> {
  if (!groupIds.length || !subjectIds.length) return [];
  return db.query<RetakeResult>(`
    SELECT DISTINCT ON (member.class_group_id, ar.id, source.subject_id) member.class_group_id AS "classGroupId",
      source.subject_id AS "subjectId", withdrawal.participant_id AS "participantId", ar.id AS "admissionRecordId",
      COALESCE(ar.code, '') code, ar.full_name AS "fullName", 'pending' AS result,
      source.status::text AS "sourceStatus", withdrawal.created_at AS "recordedAt", withdrawal.id AS "bookId",
      source.id AS "sourceCourseOfferingId",
      CASE WHEN withdrawal.snapshot->>'phase' = 'not_started' THEN 'first_time' ELSE 'retake' END AS "studyType"
    FROM course_offering_withdrawals withdrawal
    JOIN study_leaves leave ON leave.id = withdrawal.study_leave_id AND leave.status = 'resumed'
    JOIN admission_records ar ON ar.id = withdrawal.admission_record_id
    JOIN course_offerings source ON source.id = withdrawal.course_offering_id
    JOIN subjects source_subject ON source_subject.id = source.subject_id
    JOIN class_group_members member ON member.admission_record_id = ar.id OR member.student_id = ar.student_id
    WHERE member.class_group_id IN (:groupIds) AND source.subject_id IN (:subjectIds)
      AND ${studyEligibleRecordSql('ar')}
      AND NOT (COALESCE(ar.is_exempt_foreign_language, false) AND ${foreignLanguageSubjectSql('source.subject_id')})
      AND NOT EXISTS (SELECT 1 FROM course_offerings assigned JOIN subjects assigned_subject ON assigned_subject.id = assigned.subject_id
        WHERE assigned.subject_id IN (:subjectIds) AND assigned.created_at > withdrawal.created_at
          AND (COALESCE(assigned_subject.canonical_subject_id, assigned_subject.id) = COALESCE(source_subject.canonical_subject_id, source_subject.id)
            OR ((source_subject.allow_cross_major OR cardinality(source_subject.shared_major_ids) > 0)
              AND LOWER(TRIM(assigned_subject.name)) = LOWER(TRIM(source_subject.name))
              AND assigned_subject.credits = source_subject.credits AND assigned_subject.program = source_subject.program))
          AND ${notWithdrawnSql('withdrawal.participant_id', 'assigned.id')}
          AND (EXISTS (SELECT 1 FROM course_offering_class_groups link JOIN class_group_members enrolled ON enrolled.class_group_id = link.class_group_id
            WHERE link.course_offering_id = assigned.id AND (enrolled.admission_record_id = ar.id OR enrolled.student_id = ar.student_id)
              AND (link.participant_ids IS NULL OR withdrawal.participant_id = ANY(link.participant_ids)))
            OR EXISTS (SELECT 1 FROM course_offering_students individual WHERE individual.course_offering_id = assigned.id AND individual.admission_record_id = ar.id)))
    ORDER BY member.class_group_id, ar.id, source.subject_id, withdrawal.created_at DESC, withdrawal.id DESC
  `, { type: QueryTypes.SELECT, replacements: { groupIds, subjectIds }, transaction });
}

// Only admission after the previous class closed proves that a learner was not
// taught there. Missing grades for an existing participant mean waiting, not first study.
export async function readLateUnstudiedMembers(db: Sequelize, groupIds: string[], subjectIds: string[], transaction?: Transaction): Promise<RetakeResult[]> {
  if (!groupIds.length || !subjectIds.length) return [];
  return db.query<RetakeResult>(`
    SELECT DISTINCT member.class_group_id AS "classGroupId", :subjectId::uuid AS "subjectId",
      CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text ELSE 'admission:' || ar.id::text END AS "participantId",
      ar.id AS "admissionRecordId", COALESCE(ar.code, '') AS code, ar.full_name AS "fullName",
      'pending' AS result, 'completed' AS "sourceStatus", member.enrolled_at AS "recordedAt",
      member.id AS "bookId", '' AS "sourceCourseOfferingId", 'first_time' AS "studyType"
    FROM class_group_members member
    JOIN LATERAL (SELECT a.* FROM admission_records a WHERE a.id = member.admission_record_id
      OR (member.admission_record_id IS NULL AND a.student_id = member.student_id)
      ORDER BY a.created_at DESC, a.id LIMIT 1) ar ON true
    WHERE member.class_group_id IN (:groupIds)
      AND ar.training_level = 'Thạc sĩ' AND (ar.status::text = 'approved' OR ar.study_status IN ('Đã trúng tuyển', 'Đang học'))
      AND ${studyEligibleRecordSql('ar')}
      AND NOT (COALESCE(ar.is_exempt_foreign_language, false) AND ${foreignLanguageSubjectSql(':subjectId')})
      AND member.enrolled_at > (SELECT MAX(offering.completed_at) FROM course_offering_class_groups link
        JOIN course_offerings offering ON offering.id = link.course_offering_id
        WHERE link.class_group_id = member.class_group_id AND offering.subject_id IN (:subjectIds) AND offering.status = 'completed'
          AND link.participant_ids IS NULL)
      AND NOT EXISTS (SELECT 1 FROM course_offering_class_groups link
        JOIN course_offerings offering ON offering.id = link.course_offering_id
        WHERE link.class_group_id = member.class_group_id AND offering.subject_id IN (:subjectIds)
          AND link.participant_ids IS NOT NULL AND (('admission:' || ar.id::text) = ANY(link.participant_ids)
            OR ('student:' || ar.student_id::text) = ANY(link.participant_ids)))
      AND NOT EXISTS (SELECT 1 FROM course_exam_gradebooks book JOIN course_offerings offering ON offering.id = book.course_offering_id
        CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
        WHERE offering.subject_id IN (:subjectIds) AND (grade->>'participantId' = 'admission:' || ar.id::text
          OR grade->>'participantId' = 'student:' || ar.student_id::text))
  `, { type: QueryTypes.SELECT, replacements: { groupIds, subjectIds, subjectId: subjectIds[0] }, transaction });
}

// Read saved outcomes, including pending/passed outcomes, before selecting failures.
// A later passing attempt must remove an earlier failure from the waiting group.
export async function readRetakeResults(db: Sequelize, groupIds: string[], subjectIds: string[], transaction?: Transaction): Promise<RetakeResult[]> {
  if (!groupIds.length || !subjectIds.length) return [];
  const rows = await db.query<RetakeResult & { savedGrade?: Partial<CourseExamGrade>; eligibilityPolicy?: GradingPolicy }>(`
    WITH graded AS (SELECT DISTINCT ON (book.class_group_id, person.participant_id, offering.subject_id)
      book.class_group_id AS "classGroupId", offering.subject_id AS "subjectId",
      person.participant_id AS "participantId", ar.id AS "admissionRecordId",
      COALESCE(ar.code, '') AS code, ar.full_name AS "fullName",
      COALESCE(grade->>'result', 'pending') AS result, offering.status::text AS "sourceStatus",
      book.updated_at AS "recordedAt", offering.created_at AS "attemptedAt", book.id AS "bookId", offering.id AS "sourceCourseOfferingId",
      CASE WHEN ar.is_exempt_foreign_language AND COALESCE(grade->>'finalized','false') <> 'true' AND ${foreignLanguageSubjectSql('offering.subject_id')}
        THEN CAST(:foreignLanguageGrade AS jsonb) ELSE grade END AS "savedGrade",
      (SELECT policy FROM shared_grading_rules ORDER BY version DESC LIMIT 1) AS "eligibilityPolicy"
    FROM course_exam_gradebooks book
    JOIN course_offerings offering ON offering.id = book.course_offering_id
    JOIN course_offering_class_groups link ON link.course_offering_id = offering.id AND link.class_group_id = book.class_group_id
    CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
    JOIN LATERAL (SELECT a.* FROM admission_records a
      WHERE grade->>'participantId' = 'admission:' || a.id::text
        OR grade->>'participantId' = 'student:' || a.student_id::text
      ORDER BY CASE WHEN grade->>'participantId' = 'admission:' || a.id::text THEN 0 ELSE 1 END, a.created_at DESC, a.id
      LIMIT 1) ar ON true
    CROSS JOIN LATERAL (SELECT CASE WHEN ar.student_id IS NOT NULL THEN 'student:' || ar.student_id::text
      ELSE 'admission:' || ar.id::text END AS participant_id) person
    WHERE book.class_group_id IN (:groupIds) AND offering.subject_id IN (:subjectIds)
      AND ar.training_level = 'Thạc sĩ' AND (ar.status::text IN ('approved', 'admitted') OR ar.study_status IN ('Đã trúng tuyển', 'Đang học'))
      AND ${studyEligibleRecordSql('ar')}
      AND ${notWithdrawnSql('person.participant_id', 'offering.id')}
      AND (link.participant_ids IS NULL OR person.participant_id = ANY(link.participant_ids))
    ORDER BY book.class_group_id, person.participant_id, offering.subject_id, ${examAttemptOrderSql('offering.created_at', 'book.updated_at', 'book.id')})
    SELECT * FROM graded
    UNION ALL
    SELECT link.class_group_id, offering.subject_id, participant_id, ar.id,
      COALESCE(ar.code, ''), ar.full_name, 'pending', offering.status::text,
      offering.created_at, offering.created_at, offering.id, offering.id,
      CASE WHEN ar.is_exempt_foreign_language AND ${foreignLanguageSubjectSql('offering.subject_id')}
        THEN CAST(:foreignLanguageGrade AS jsonb) ELSE NULL::jsonb END, NULL::jsonb
    FROM course_offering_class_groups link
    JOIN course_offerings offering ON offering.id = link.course_offering_id
    CROSS JOIN LATERAL unnest(link.participant_ids) participant_id
    JOIN LATERAL (SELECT a.* FROM admission_records a
      WHERE participant_id = 'admission:' || a.id::text OR participant_id = 'student:' || a.student_id::text
      ORDER BY a.created_at DESC, a.id LIMIT 1) ar ON true
    WHERE link.class_group_id IN (:groupIds) AND offering.subject_id IN (:subjectIds)
      AND ${studyEligibleRecordSql('ar')}
      AND ${notWithdrawnSql('participant_id', 'offering.id')}
      AND NOT EXISTS (SELECT 1 FROM course_exam_gradebooks book
        CROSS JOIN LATERAL jsonb_array_elements(book.grades) grade
        WHERE book.course_offering_id = offering.id AND book.class_group_id = link.class_group_id
          AND (grade->>'participantId' = participant_id OR grade->>'participantId' = 'admission:' || ar.id::text
            OR grade->>'participantId' = 'student:' || ar.student_id::text))
  `, { type: QueryTypes.SELECT, replacements: { groupIds, subjectIds,
    foreignLanguageGrade: JSON.stringify(foreignLanguageExemptGrade()) }, transaction });
  return rows.map(({ savedGrade, eligibilityPolicy, ...row }) => savedGrade
    ? { ...row, result: resolveSavedExamGrade(savedGrade, eligibilityPolicy).result } : row);
}

export function failedRetakeMembers(results: RetakeResult[], classGroupId: string, subjectIds: Set<string>): RetakeResult[] {
  const latest = new Map<string, RetakeResult>();
  for (const row of results) {
    if (row.classGroupId !== classGroupId || !subjectIds.has(row.subjectId)) continue;
    const previous = latest.get(row.participantId);
    const attempt = new Date(row.attemptedAt || row.recordedAt).getTime();
    const previousAttempt = previous ? new Date(previous.attemptedAt || previous.recordedAt).getTime() : -Infinity;
    if (!previous || attempt > previousAttempt || (attempt === previousAttempt
      && (new Date(row.recordedAt).getTime() > new Date(previous.recordedAt).getTime()
        || (new Date(row.recordedAt).getTime() === new Date(previous.recordedAt).getTime() && row.bookId > previous.bookId)))) latest.set(row.participantId, row);
  }
  return [...latest.values()].filter(row => row.result === "failed" && row.sourceStatus === "completed");
}

// SQL fragments take application-owned expressions only.
export function enrolledOfferingMemberSql(groupExpression: string, participantExpression: string, includeLeaveFailures = false): string {
  return `((${notWithdrawnSql(participantExpression)}${includeLeaveFailures ? ` OR ${studyLeaveFailureParticipantSql(participantExpression)}` : ''}) AND EXISTS (SELECT 1 FROM course_offering_class_groups roster_link
    WHERE roster_link.course_offering_id = :offeringId AND roster_link.class_group_id = ${groupExpression}
      AND (roster_link.participant_ids IS NULL OR ${participantExpression} = ANY(roster_link.participant_ids))))`;
}
