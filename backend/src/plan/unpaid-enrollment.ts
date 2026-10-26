import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryTypes, type Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';
import type { AdmissionRecord } from '../database/models/plan/admission-record.model.js';
import { hasPaidAdmissionTuition } from './learner-study-status.js';
import { archiveMembership, auditActor } from './membership-history.js';

// Callers hold the learner mutex and record row lock. All changes roll back together.
export async function returnUnpaidToApplication(
  db: Sequelize, record: AdmissionRecord, actor: any, reason: string, transaction: Transaction, legacyLeaveRepair = false,
) {
  if (!reason.trim()) throw new BadRequestException('Nhập lý do rút hồ sơ chưa nhập học.');
  if (record.trainingLevel !== 'Thạc sĩ' || (!legacyLeaveRepair && !['Đã trúng tuyển', 'Đang học', 'Bảo lưu', 'Đang bảo lưu', 'Bảo lưu quá hạn'].includes(record.studyStatus || ''))) {
    throw new ConflictException('Chỉ rút hồ sơ thạc sĩ đã trúng tuyển nhưng chưa nhập học.');
  }
  if (hasPaidAdmissionTuition(record)) throw new ConflictException('Học viên đã đóng học phí và đang học. Hãy xử lý bảo lưu hoặc thôi học.');
  const replacements = { recordId: record.id, studentId: record.studentId || null };
  const select = <T extends object>(sql: string, extra: any = {}) => db.query<T>(sql, {
    type: QueryTypes.SELECT, transaction, replacements: { ...replacements, ...extra },
  });
  const open = await select(`SELECT id FROM study_leaves WHERE admission_record_id=:recordId AND status IN ('pending','approved')
    UNION ALL SELECT id FROM major_transfers WHERE admission_record_id=:recordId AND status='pending'`);
  if (open.length) throw new ConflictException('Cần xử lý yêu cầu bảo lưu hoặc chuyển chuyên ngành đang mở trước khi rút hồ sơ.');
  const members = await select<{ id: string; class_group_id: string }>(`SELECT member.id, member.class_group_id
    FROM class_group_members member JOIN class_groups cg ON cg.id=member.class_group_id
    WHERE cg.program='masters' AND (member.admission_record_id=:recordId
      OR (:studentId IS NOT NULL AND member.student_id=:studentId)) ORDER BY member.id FOR UPDATE OF member`);
  const identities = [`admission:${record.id}`, ...(record.studentId ? [`student:${record.studentId}`] : [])];
  await select(`SELECT o.id FROM course_offerings o WHERE EXISTS (
    SELECT 1 FROM course_offering_students individual WHERE individual.course_offering_id=o.id AND individual.admission_record_id=:recordId)
    OR EXISTS (SELECT 1 FROM course_offering_class_groups link JOIN class_group_members member ON member.class_group_id=link.class_group_id
      WHERE link.course_offering_id=o.id AND (member.admission_record_id=:recordId OR (:studentId IS NOT NULL AND member.student_id=:studentId)))
    ORDER BY o.id FOR UPDATE OF o`);
  const frozen = await select(`SELECT w.course_offering_id FROM course_exam_workflows w
    LEFT JOIN course_exam_eligibility_snapshots snapshot ON snapshot.id=w.eligibility_snapshot_id
    WHERE w.result_status<>'approved' AND EXISTS (SELECT 1 FROM jsonb_array_elements(
      COALESCE(snapshot.rows,w.eligibility_submission->'rows','[]'::jsonb)) entry
      WHERE entry->>'participantId' IN (:identities)) LIMIT 1`, { identities });
  if (frozen.length) throw new ConflictException('Hồ sơ còn trong danh sách thi đã gửi/duyệt chưa kết thúc. Xử lý hoặc mở lại danh sách thi trước khi rút hồ sơ.');

  const before = { status: record.status, studyStatus: record.studyStatus, extraData: record.extraData };
  for (const member of members) await archiveMembership(db, member.id, actor, reason.trim(), transaction);
  await db.query(`DELETE FROM class_group_members member USING class_groups cg
    WHERE cg.id=member.class_group_id AND cg.program='masters'
      AND (member.admission_record_id=:recordId OR (:studentId IS NOT NULL AND member.student_id=:studentId))`, { replacements, transaction });
  // A membership trigger may freeze a started roster before removal. Remove the
  // withdrawn identities afterwards, retaining other learners and completed history.
  if (members.length) await db.query(`UPDATE course_offering_class_groups link SET participant_ids=ARRAY(
    SELECT person FROM unnest(link.participant_ids) person WHERE person NOT IN (:identities)), updated_at=NOW()
    FROM course_offerings o WHERE o.id=link.course_offering_id AND o.status='active'
      AND link.class_group_id IN (:groupIds) AND link.participant_ids IS NOT NULL`, {
    replacements: { identities, groupIds: [...new Set(members.map(member => member.class_group_id))] }, transaction,
  });
  await db.query(`DELETE FROM course_offering_students individual USING course_offerings o
    WHERE o.id=individual.course_offering_id AND o.status='active' AND individual.admission_record_id=:recordId`, { replacements, transaction });
  // The old decision stays in history; the current evaluation is editable again.
  const evaluations = await select(`SELECT * FROM admission_evaluations WHERE admission_record_id=:recordId FOR UPDATE`);
  await db.query(`UPDATE admission_evaluations SET decision='pending',version=version+1,updated_at=NOW()
    WHERE admission_record_id=:recordId`, { replacements, transaction });
  const withdrawal = { at: new Date().toISOString(), actor: auditActor(actor), reason: reason.trim() };
  await record.update({ status: 'pending', studyStatus: 'Nộp hồ sơ đầu vào',
    extraData: { ...record.extraData, unpaidWithdrawal: withdrawal } }, { transaction });
  await db.query(`INSERT INTO admission_evaluation_history(id,admission_record_id,action,actor,snapshot,created_at,updated_at)
    VALUES(:id,:recordId,'unpaid_withdrawal',:actor,CAST(:snapshot AS jsonb),NOW(),NOW())`, {
    transaction, replacements: { id: randomUUID(), recordId: record.id,
      actor: String(actor?.name || actor?.email || actor?.id || 'unknown'),
      snapshot: JSON.stringify({ before, evaluation: evaluations[0] || null, memberships: members, withdrawal }) },
  });
  return { id: record.id, status: record.status, studyStatus: record.studyStatus, updatedAt: record.updatedAt };
}
