import { QueryTypes } from 'sequelize';
import { AdmissionRecord } from '../models/plan/admission-record.model.js';
import { repairUnpaidStudyLeave } from '../../plan/unpaid-study-leave-repair.js';

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query('SELECT pg_advisory_xact_lock(21026)', { transaction });
    const targets = await qi.sequelize.query(`SELECT ar.id FROM admission_records ar
      WHERE ar.training_level='Thạc sĩ' AND COALESCE(ar.extra_data->'tuitionPayment'->>'paid','false')<>'true'
      AND (ar.study_status IN ('Bảo lưu','Đang bảo lưu','Bảo lưu quá hạn') OR EXISTS (
        SELECT 1 FROM study_leaves leave WHERE leave.admission_record_id=ar.id AND leave.status IN ('pending','approved')))
      ORDER BY ar.id FOR UPDATE OF ar`, { type: QueryTypes.SELECT, transaction });
    for (const target of targets) {
      const record = await AdmissionRecord.findByPk(target.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (record) await repairUnpaidStudyLeave(qi.sequelize, record, { name: 'Đối soát bảo lưu chưa nộp học phí' }, transaction);
    }
  });
}

// An audited data correction must not recreate invalid approvals on rollback.
export async function down() {}
