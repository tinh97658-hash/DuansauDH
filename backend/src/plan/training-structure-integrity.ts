import { ConflictException } from "@nestjs/common";
import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";
import { matchesExamSubjectSql } from "../masters/exam-subject-scope.js";

// Serialize curriculum assignment and structure edits. Take this before row
// locks so a class cannot start using a curriculum between checking and editing.
export async function lockTrainingStructure(db: Sequelize, transaction?: Transaction) {
  if (transaction) await db.query("SELECT pg_advisory_xact_lock(714062)", { transaction });
}

export async function assertClassScopeEditable(db: Sequelize, id: string, transaction?: Transaction) {
  if (transaction) await db.query("SELECT id FROM class_groups WHERE id = :id FOR UPDATE", { replacements: { id }, transaction });
  const [usage] = await db.query<{ used: boolean }>(`SELECT (
    EXISTS (SELECT 1 FROM class_group_members WHERE class_group_id = :id)
    OR EXISTS (SELECT 1 FROM class_membership_history WHERE class_group_id = :id)
    OR EXISTS (SELECT 1 FROM course_offering_class_groups WHERE class_group_id = :id)
    OR EXISTS (SELECT 1 FROM course_exam_gradebooks WHERE class_group_id = :id)
    OR EXISTS (SELECT 1 FROM course_offering_withdrawals WHERE class_group_id = :id)
    OR EXISTS (SELECT 1 FROM major_transfers WHERE from_class_group_id = :id)
  ) AS used`, { replacements: { id }, transaction, type: QueryTypes.SELECT });
  if (usage?.used) throw new ConflictException({ code: "CLASS_SCOPE_IN_USE",
    message: "Không thể đổi ngành, bậc, khóa hoặc CTĐT của lớp đã có học viên hoặc dữ liệu đào tạo. Hãy tạo lớp mới và xử lý chuyển lớp/chuyển ngành theo nghiệp vụ." });
}

export async function assertCurriculumEditable(db: Sequelize, id: string, transaction?: Transaction) {
  const [usage] = await db.query<{ used: boolean }>(`SELECT (
    EXISTS (SELECT 1 FROM class_groups WHERE curriculum_id = :id)
    OR EXISTS (SELECT 1 FROM major_transfers WHERE from_curriculum_id = :id OR to_curriculum_id = :id)
  ) AS used`, { replacements: { id }, transaction, type: QueryTypes.SELECT });
  if (usage?.used) throw new ConflictException({ code: "CURRICULUM_IN_USE",
    message: "CTĐT đã được sử dụng nên không thể thay đổi ngành, bậc, khóa, tín chỉ hoặc danh sách học phần. Hãy tạo CTĐT mới để giữ nguyên chương trình và kết quả của các lớp cũ." });
}

// Assignment reserves a curriculum's identity. The subject list stays
// editable until a linked class has teaching or academic records.
export async function curriculumSubjectsInUse(db: Sequelize, id: string, transaction?: Transaction) {
  const [usage] = await db.query<{ used: boolean }>(`WITH linked_groups AS (
    SELECT id FROM class_groups WHERE curriculum_id = :id
  ), members AS (
    SELECT admission_record_id, student_id FROM class_group_members WHERE class_group_id IN (SELECT id FROM linked_groups)
    UNION
    SELECT admission_record_id, student_id FROM class_membership_history WHERE class_group_id IN (SELECT id FROM linked_groups)
  ), learners AS (
    SELECT record.id FROM admission_records record JOIN members member
      ON member.admission_record_id = record.id OR member.student_id = record.student_id
  ) SELECT (
    EXISTS (SELECT 1 FROM course_offering_class_groups WHERE class_group_id IN (SELECT id FROM linked_groups))
    OR EXISTS (SELECT 1 FROM course_exam_gradebooks WHERE class_group_id IN (SELECT id FROM linked_groups))
    OR EXISTS (SELECT 1 FROM course_offering_withdrawals WHERE class_group_id IN (SELECT id FROM linked_groups))
    OR EXISTS (SELECT 1 FROM learner_transcript_issues WHERE class_group_id IN (SELECT id FROM linked_groups))
    OR EXISTS (SELECT 1 FROM learner_subject_results result JOIN curriculum_subjects entry ON entry.subject_id = result.subject_id
      WHERE entry.curriculum_id = :id AND result.admission_record_id IN (SELECT id FROM learners))
    OR EXISTS (SELECT 1 FROM subject_recognitions recognition JOIN curriculum_subjects entry ON entry.subject_id = recognition.target_subject_id
      WHERE entry.curriculum_id = :id AND recognition.status = 'approved' AND recognition.admission_record_id IN (SELECT id FROM learners))
    OR EXISTS (SELECT 1 FROM major_transfers WHERE from_curriculum_id = :id OR to_curriculum_id = :id)
  ) AS used`, { replacements: { id }, transaction, type: QueryTypes.SELECT });
  return Boolean(usage?.used);
}

export async function assertCurriculumSubjectsEditable(db: Sequelize, id: string, transaction?: Transaction) {
  if (await curriculumSubjectsInUse(db, id, transaction)) throw new ConflictException({ code: "CURRICULUM_IN_USE",
    message: "CTĐT đã có dữ liệu đào tạo nên không thể thêm/xóa học phần. Chỉ những môn chưa được sử dụng mới được đổi Bắt buộc / Tự chọn." });
}

/** Used entry ids in this curriculum; the same catalog course in another curriculum stays independent. */
export async function usedCurriculumSubjectIds(db: Sequelize, curriculumId: string, transaction?: Transaction) {
  const rows = await db.query<{ entryId: string }>(`WITH linked_groups AS (
    SELECT id FROM class_groups WHERE curriculum_id=:curriculumId
  ), members AS (
    SELECT admission_record_id,student_id FROM class_group_members WHERE class_group_id IN (SELECT id FROM linked_groups)
    UNION SELECT admission_record_id,student_id FROM class_membership_history WHERE class_group_id IN (SELECT id FROM linked_groups)
  ), learners AS (
    SELECT record.id FROM admission_records record JOIN members member
      ON record.id=member.admission_record_id OR record.student_id=member.student_id
    UNION SELECT admission_record_id FROM major_transfers WHERE status='approved'
      AND (from_curriculum_id=:curriculumId OR to_curriculum_id=:curriculumId)
  ) SELECT entry.id AS "entryId" FROM curriculum_subjects entry JOIN subjects target ON target.id=entry.subject_id
  WHERE entry.curriculum_id=:curriculumId AND (
    EXISTS (SELECT 1 FROM course_offering_class_groups link JOIN course_offerings offering ON offering.id=link.course_offering_id
      JOIN subjects source ON source.id=offering.subject_id
      WHERE link.class_group_id IN (SELECT id FROM linked_groups)
        AND ${matchesExamSubjectSql('source', 'target', 'offering.id', 'link.class_group_id')})
    OR EXISTS (SELECT 1 FROM course_exam_gradebooks book JOIN course_offerings offering ON offering.id=book.course_offering_id
      JOIN subjects source ON source.id=offering.subject_id
      WHERE book.class_group_id IN (SELECT id FROM linked_groups)
        AND ${matchesExamSubjectSql('source', 'target', 'offering.id', 'book.class_group_id')})
    OR EXISTS (SELECT 1 FROM course_offering_withdrawals withdrawal JOIN course_offerings offering ON offering.id=withdrawal.course_offering_id
      JOIN subjects source ON source.id=offering.subject_id
      WHERE withdrawal.class_group_id IN (SELECT id FROM linked_groups)
        AND ${matchesExamSubjectSql('source', 'target', 'offering.id', 'withdrawal.class_group_id')})
    OR EXISTS (SELECT 1 FROM learner_subject_results result JOIN subjects source ON source.id=result.subject_id
      WHERE result.admission_record_id IN (SELECT id FROM learners)
        AND COALESCE(source.canonical_subject_id,source.id)=COALESCE(target.canonical_subject_id,target.id))
    OR EXISTS (SELECT 1 FROM subject_recognitions recognition JOIN subjects source
      ON source.id=recognition.target_subject_id OR source.id=recognition.source_subject_id
      WHERE recognition.status='approved' AND recognition.admission_record_id IN (SELECT id FROM learners)
        AND COALESCE(source.canonical_subject_id,source.id)=COALESCE(target.canonical_subject_id,target.id))
    OR EXISTS (SELECT 1 FROM learner_transcript_issues issued
      WHERE issued.class_group_id IN (SELECT id FROM linked_groups) OR issued.snapshot->'curriculum'->>'id'=:curriculumId)
  )`, { replacements: { curriculumId }, transaction, type: QueryTypes.SELECT });
  return new Set(rows.map(row => row.entryId).filter(Boolean));
}

export async function assertSubjectStructureEditable(db: Sequelize, id: string, transaction: Transaction) {
  const [usage] = await db.query<{ used: boolean }>(`WITH affected AS (
    SELECT id FROM subjects WHERE id = :id OR canonical_subject_id = :id
  ) SELECT (
    EXISTS (SELECT 1 FROM curriculum_subjects cs JOIN class_groups cg ON cg.curriculum_id = cs.curriculum_id
      WHERE cs.subject_id IN (SELECT id FROM affected))
    OR EXISTS (SELECT 1 FROM curriculum_subjects cs JOIN major_transfers transfer
      ON transfer.from_curriculum_id = cs.curriculum_id OR transfer.to_curriculum_id = cs.curriculum_id
      WHERE cs.subject_id IN (SELECT id FROM affected))
    OR EXISTS (SELECT 1 FROM course_offerings WHERE subject_id IN (SELECT id FROM affected))
    OR EXISTS (SELECT 1 FROM learner_subject_results WHERE subject_id IN (SELECT id FROM affected))
    OR EXISTS (SELECT 1 FROM learner_subject_results learning JOIN bridge_knowledge_subjects bridge
      ON bridge.id = learning.bridge_knowledge_subject_id WHERE bridge.equivalent_subject_id IN (SELECT id FROM affected))
    OR EXISTS (SELECT 1 FROM subject_recognitions WHERE source_subject_id IN (SELECT id FROM affected)
      OR target_subject_id IN (SELECT id FROM affected))
  ) AS used`, { replacements: { id }, transaction, type: QueryTypes.SELECT });
  if (usage?.used) throw new ConflictException({ code: "SUBJECT_STRUCTURE_IN_USE",
    message: "Học phần đã được sử dụng trong đào tạo nên không thể sửa thông tin ảnh hưởng CTĐT và bảng điểm. Hãy tạo học phần mới cho CTĐT mới." });
}
