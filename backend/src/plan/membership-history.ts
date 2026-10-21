import { randomUUID } from "node:crypto";
import type { Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";

export const auditActor = (actor: any) => ({ id: actor?.id || null, name: actor?.name || actor?.email || "system", role: actor?.role || "system" });

export async function archiveMembership(db: Sequelize, memberId: string, actor: any, reason: string, transaction: Transaction) {
  await db.query(`INSERT INTO class_membership_history
    (id,class_group_id,admission_record_id,student_id,enrolled_at,left_at,actor,reason)
    SELECT :id,class_group_id,admission_record_id,student_id,COALESCE(enrolled_at,NOW()),clock_timestamp(),CAST(:actor AS jsonb),:reason
    FROM class_group_members WHERE id = :memberId`, {
    transaction, replacements: { id: randomUUID(), memberId, actor: JSON.stringify(auditActor(actor)), reason },
  });
}
