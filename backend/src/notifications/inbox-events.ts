// Only persisted workflow/audit facts are accepted. No current-status polling.
export const eventTitles = {
  'grade.submitted': 'Có kết quả điểm chờ phê duyệt',
  'grade.approved': 'Kết quả điểm đã được phê duyệt',
  'grade.reopened': 'Kết quả điểm đã được mở lại',
  'leave.requested': 'Có yêu cầu bảo lưu mới',
  'leave.approved': 'Yêu cầu bảo lưu đã được duyệt',
  'leave.rejected': 'Yêu cầu bảo lưu bị từ chối',
  'extension.requested': 'Có yêu cầu gia hạn bảo lưu mới',
  'extension.approved': 'Gia hạn bảo lưu đã được duyệt',
  'extension.rejected': 'Gia hạn bảo lưu bị từ chối',
  'transfer.requested': 'Có yêu cầu chuyển chuyên ngành mới',
  'transfer.approved': 'Chuyển chuyên ngành đã được duyệt',
  'transfer.rejected': 'Chuyển chuyên ngành bị từ chối',
} as const;
export type InboxKind = keyof typeof eventTitles;
export interface InboxEvent {
  sourceKey: string; changeId: string; sourceRecordId: string; entityId: string;
  kind: InboxKind; occurredAt: string; actorStaffId: string | null; actorProfileId: string | null;
}
export interface AuditChange {
  id: string; table_name: string; operation: string; new_data: any; old_data: any;
  actor_staff_id: string | null; actor_profile_id: string | null; changed_at: string | Date;
}
export const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export const requestKind = (kind: InboxKind): InboxKind => kind.startsWith('grade.') ? 'grade.submitted'
  : kind.startsWith('extension.') ? 'extension.requested' : kind.startsWith('leave.') ? 'leave.requested' : 'transfer.requested';
export const needsApprover = (kind: InboxKind) => kind.endsWith('.requested') || kind === 'grade.submitted' || kind === 'grade.reopened';

export function eventsFromChange(change: AuditChange): InboxEvent[] {
  const row = change.new_data;
  // Seed/import/system writes without an authenticated staff/profile are not
  // evidence of a user workflow request. Never fabricate an inbox from them.
  if (!isUuid(change.actor_staff_id) || !isUuid(change.actor_profile_id)) return [];
  if (!row || !isUuid(row.id) || !['INSERT', 'UPDATE'].includes(change.operation)) return [];
  const result: InboxEvent[] = [];
  const add = (kind: InboxKind | undefined, entityId: string, key: string, at: unknown) => {
    const date = new Date(String(at));
    if (!kind || !Object.hasOwn(eventTitles, kind) || !isUuid(entityId) || !Number.isFinite(date.getTime())) return;
    result.push({ sourceKey: key, changeId: String(change.id), sourceRecordId: row.id, entityId, kind,
      occurredAt: date.toISOString(), actorStaffId: isUuid(change.actor_staff_id) ? change.actor_staff_id : null,
      actorProfileId: isUuid(change.actor_profile_id) ? change.actor_profile_id : null });
  };
  if (change.table_name === 'gradebook_events' && change.operation === 'INSERT') {
    const kinds: Record<string, InboxKind> = { 'final.submit': 'grade.submitted', 'final.approve': 'grade.approved', 'final.reopen': 'grade.reopened',
      'result.submit': 'grade.submitted', 'result.approve': 'grade.approved', 'result.reopen': 'grade.reopened' };
    add(kinds[row.action], row.course_offering_id, `gradebook:${row.id}`, row.created_at);
  } else if (change.table_name === 'study_leaves') {
    const before = change.operation === 'INSERT' ? [] : change.old_data?.history;
    const after = row.history;
    // Rewrites, truncations or repairs are not new business events.
    if (!Array.isArray(before) || !Array.isArray(after) || after.length < before.length
      || before.some((item: any, i: number) => JSON.stringify(item) !== JSON.stringify(after[i]))) return [];
    const kinds: Record<string, InboxKind> = { requested: 'leave.requested', approve: 'leave.approved', reject: 'leave.rejected',
      request_extension: 'extension.requested', approve_extension: 'extension.approved', reject_extension: 'extension.rejected' };
    after.slice(before.length).forEach((item: any, i: number) => {
      if (item && typeof item === 'object') add(kinds[item.action], row.admission_record_id,
        `leave:${row.id}:${before.length + i}`, item.at);
    });
  } else if (change.table_name === 'major_transfers') {
    if (change.operation === 'INSERT' && row.status === 'pending') add('transfer.requested', row.admission_record_id, `transfer:${row.id}:requested`, row.requested_at);
    if (change.operation === 'UPDATE' && change.old_data?.status === 'pending' && ['approved', 'rejected'].includes(row.status)) {
      add(`transfer.${row.status}` as InboxKind, row.admission_record_id, `transfer:${row.id}:${row.status}`, row.decided_at);
    }
  }
  return result;
}
