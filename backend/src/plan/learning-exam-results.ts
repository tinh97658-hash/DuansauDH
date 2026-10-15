import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";
import { resolveSavedExamGrade } from "../masters/exam-grade-calculation.js";
import type { CourseExamGrade } from "../database/models/training/course-exam-gradebook.model.js";
import type { GradingPolicy } from "../masters/grading-policy.js";
import { matchesExamSubjectSql } from "../masters/exam-subject-scope.js";
import { examOutcomesSql } from "./exam-outcomes.js";
import { foreignLanguageExemptGrade, foreignLanguageSubjectSql } from "../masters/foreign-language-exemption.js";

export const isPriorLearning = (row: { sourceType?: string }) => ["pre_masters", "early_enrollment", "external"].includes(row.sourceType || "");

// Prior-learning evidence is independent of the current course's exam gradebook.
export async function learningExamResults(sequelize: Sequelize, admissionRecordId: string, transaction?: Transaction) {
  const rows = await sequelize.query<{ id: string; result: string; score: number | null;
    sourceType?: string; grade?: Partial<CourseExamGrade>; eligibilityPolicy?: GradingPolicy }>(`
    SELECT learning.id, CASE WHEN learning.source_type IN ('pre_masters', 'early_enrollment', 'external')
        THEN learning.result ELSE COALESCE(exam.grade->>'result', 'pending') END result,
      CASE WHEN learning.source_type IN ('pre_masters', 'early_enrollment', 'external') THEN learning.score
        ELSE NULLIF(exam.grade->>'courseScore', '')::numeric END score,
      learning.source_type AS "sourceType", CASE WHEN record.is_exempt_foreign_language
        AND ${foreignLanguageSubjectSql('source.id')}
        AND COALESCE(exam.grade->>'studyLeaveFailure', 'false') <> 'true'
        THEN CAST(:foreignLanguageGrade AS jsonb) ELSE exam.grade END AS grade,
      (SELECT policy FROM shared_grading_rules ORDER BY version DESC LIMIT 1) AS "eligibilityPolicy"
    FROM learner_subject_results learning
    JOIN admission_records record ON record.id = learning.admission_record_id
    LEFT JOIN bridge_knowledge_subjects bridge ON bridge.id = learning.bridge_knowledge_subject_id
    LEFT JOIN subjects source ON source.id = COALESCE(learning.subject_id, bridge.equivalent_subject_id)
    LEFT JOIN LATERAL (
      SELECT outcome.grade
      FROM (${examOutcomesSql()}) outcome
      JOIN subjects subject ON subject.id = outcome.subject_id
      WHERE (outcome.participant_id = 'admission:' || record.id::text
        OR outcome.participant_id = 'student:' || record.student_id::text)
        AND ((source.id IS NOT NULL AND
            ${matchesExamSubjectSql('subject', 'source', 'outcome.course_offering_id', 'outcome.class_group_id')})
          OR (source.id IS NULL AND outcome.course_offering_id = learning.course_offering_id))
      ORDER BY outcome.recorded_at DESC, outcome.id DESC LIMIT 1
    ) exam ON true
    WHERE learning.admission_record_id = :recordId
  `, { type: QueryTypes.SELECT, replacements: { recordId: admissionRecordId,
    foreignLanguageGrade: JSON.stringify(foreignLanguageExemptGrade()) }, transaction });
  return rows.map(({ grade, eligibilityPolicy, sourceType, ...row }) => {
    if (!grade || isPriorLearning({ sourceType })) return row;
    const calculated = resolveSavedExamGrade(grade, eligibilityPolicy);
    return { ...row, result: calculated.result, score: calculated.courseScore, ...(grade.studyLeaveFailure ? { studyLeaveFailure: true } : {}) };
  });
}

export function applyLearningExamResults(rows: any[], exams: { id: string; result: string; score: number | null; studyLeaveFailure?: boolean }[]) {
  const byId = new Map(exams.map(exam => [exam.id, exam]));
  return rows.map(row => {
    const data = typeof row.toJSON === "function" ? row.toJSON() : row;
    if (isPriorLearning(data)) return { ...data, score: data.score == null ? null : Number(data.score) };
    const exam = byId.get(data.id);
    const result = exam?.result || "pending";
    return { ...data, result, score: exam?.score == null ? null : Number(exam.score),
      ...(exam?.studyLeaveFailure ? { studyLeaveFailure: true } : {}),
      status: ["passed", "failed", "exempt"].includes(result) ? "completed" : data.status === "completed" ? "studying" : data.status };
  });
}
