import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";

// A learner outcome is always the saved exam-gradebook outcome, including pending and exempt.
export async function learningExamResults(sequelize: Sequelize, admissionRecordId: string, transaction?: Transaction) {
  return sequelize.query<{ id: string; result: string; score: number | null }>(`
    SELECT learning.id, COALESCE(exam.grade->>'result', 'pending') result,
      NULLIF(exam.grade->>'courseScore', '')::numeric score
    FROM learner_subject_results learning
    JOIN admission_records record ON record.id = learning.admission_record_id
    LEFT JOIN bridge_knowledge_subjects bridge ON bridge.id = learning.bridge_knowledge_subject_id
    LEFT JOIN subjects source ON source.id = COALESCE(learning.subject_id, bridge.equivalent_subject_id)
    LEFT JOIN LATERAL (
      SELECT entry.value grade
      FROM course_exam_gradebooks book JOIN course_offerings offering ON offering.id = book.course_offering_id
      JOIN subjects subject ON subject.id = offering.subject_id
      CROSS JOIN LATERAL jsonb_array_elements(book.grades) entry(value)
      WHERE (entry.value->>'participantId' = 'admission:' || record.id::text
        OR entry.value->>'participantId' = 'student:' || record.student_id::text
        OR EXISTS (SELECT 1 FROM admission_records identity WHERE identity.student_id = record.student_id
          AND entry.value->>'participantId' = 'admission:' || identity.id::text))
        AND ((source.id IS NOT NULL AND
            COALESCE(subject.canonical_subject_id, subject.id) = COALESCE(source.canonical_subject_id, source.id))
          OR (source.id IS NULL AND book.course_offering_id = learning.course_offering_id))
      ORDER BY book.updated_at DESC, book.id DESC LIMIT 1
    ) exam ON true
    WHERE learning.admission_record_id = :recordId
  `, { type: QueryTypes.SELECT, replacements: { recordId: admissionRecordId }, transaction });
}

export function applyLearningExamResults(rows: any[], exams: { id: string; result: string; score: number | null }[]) {
  const byId = new Map(exams.map(exam => [exam.id, exam]));
  return rows.map(row => {
    const data = typeof row.toJSON === "function" ? row.toJSON() : row;
    const exam = byId.get(data.id);
    const result = exam?.result || "pending";
    return { ...data, result, score: exam?.score == null ? null : Number(exam.score),
      status: ["passed", "failed", "exempt"].includes(result) ? "completed" : data.status === "completed" ? "studying" : data.status };
  });
}
