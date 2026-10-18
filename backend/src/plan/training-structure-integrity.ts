import { ConflictException } from "@nestjs/common";
import { QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";

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
