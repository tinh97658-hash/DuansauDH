import { participantRecordMatchSql } from "../common/participant-identity.js";

/** Expressions passed here are application-owned SQL, never user input. */
export function foreignLanguageSubjectSql(subjectExpression: string): string {
  return `EXISTS (SELECT 1 FROM subjects language_subject
    LEFT JOIN subjects language_root ON language_root.id = language_subject.canonical_subject_id
    WHERE language_subject.id = ${subjectExpression} AND (
      LOWER(TRIM(language_subject.name)) IN ('tiếng anh', 'english', 'ngoại ngữ')
      OR UPPER(TRIM(language_subject.code)) = 'HPTA'
      OR LOWER(TRIM(language_root.name)) IN ('tiếng anh', 'english', 'ngoại ngữ')
      OR UPPER(TRIM(language_root.code)) = 'HPTA'))`;
}

export function profileForeignLanguageExemptSql(participantExpression: string, subjectExpression: string,
  academicYearExpression = "''"): string {
  return `(${foreignLanguageSubjectSql(subjectExpression)} AND COALESCE((
    SELECT exemption_record.is_exempt_foreign_language FROM admission_records exemption_record
    WHERE ${participantRecordMatchSql('exemption_record', participantExpression)}
    ORDER BY CASE WHEN ${participantExpression} = 'admission:' || exemption_record.id::text THEN 0 ELSE 1 END,
      CASE WHEN exemption_record.academic_year = ${academicYearExpression} THEN 0 ELSE 1 END,
      exemption_record.created_at DESC, exemption_record.id
    LIMIT 1), false))`;
}

/** A read projection: do not persist it over a learner's original exam marks. */
export const foreignLanguageExemptGrade = () => ({
  profileForeignLanguageExempt: true, examExempt: true, eligible: false,
  testScore: null, assignmentScore: null, examScore: null,
  courseScore: null, grade4: null, letterGrade: "", attemptScores: [], result: "passed" as const,
});
