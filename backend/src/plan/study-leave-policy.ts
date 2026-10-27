import { participantRecordMatchSql } from "../common/participant-identity.js";

export const BUSINESS_DATE_SQL = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
export const BLOCKED_STUDY_STATUSES = ["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học", "Đã thôi học"];

// Expressions are owned by application code, never supplied by a request.
export function studyEligibleRecordSql(alias: string) {
  return `(COALESCE(${alias}.study_status, '') NOT IN ('Bảo lưu','Đang bảo lưu','Bảo lưu quá hạn','Thôi học','Đã thôi học')
    AND NOT EXISTS (SELECT 1 FROM study_leaves pause WHERE pause.admission_record_id = ${alias}.id
      AND pause.status = 'approved'))`;
}

export function notWithdrawnSql(participant: string, offering = ':offeringId') {
  return `NOT EXISTS (SELECT 1 FROM course_offering_withdrawals withdrawal
    JOIN admission_records withdrawn_record ON withdrawn_record.id = withdrawal.admission_record_id
    WHERE withdrawal.course_offering_id = ${offering} AND (withdrawal.participant_id = ${participant}
      OR ${participantRecordMatchSql('withdrawn_record', participant)}))`;
}

export function availableParticipantSql(participant: string) {
  return `NOT EXISTS (SELECT 1 FROM admission_records paused_record
    WHERE ${participantRecordMatchSql('paused_record', participant)}
      AND NOT ${studyEligibleRecordSql('paused_record')})`;
}

export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// A same-day approval starts when it is approved, never retroactively at midnight.
// A previously approved future leave starts at midnight even if reconciliation runs later.
export function studyLeaveEffectiveAt(leave: { startDate: string; createdAt?: string | Date; history?: Array<{ action: string; at: string }> }, now = new Date()) {
  const start = new Date(`${leave.startDate}T00:00:00+07:00`).getTime();
  const approval = leave.history?.find(event => event.action === 'approve')?.at;
  const approvedAt = new Date(approval || leave.createdAt || now).getTime();
  return new Date(Math.max(start, approvedAt)).toISOString();
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}
