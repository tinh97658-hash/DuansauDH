import { eventsFromChange, type AuditChange } from '../../src/notifications/inbox-events.js';
const id = '11111111-1111-4111-8111-111111111111', entity = '22222222-2222-4222-8222-222222222222';
const change = (table: string, next: any, old: any = null): AuditChange => ({ id: '12', table_name: table,
  operation: old ? 'UPDATE' : 'INSERT', old_data: old, new_data: next, actor_staff_id: id, actor_profile_id: entity, changed_at: new Date() });
describe('Notification source facts', () => {
  it('does not deliver seed/system facts without an authenticated actor and profile', () => {
    const source = change('gradebook_events', { id, course_offering_id: entity, action: 'final.submit', created_at: '2026-11-06T00:00:00Z' });
    expect(eventsFromChange({ ...source, actor_staff_id: null })).toEqual([]);
    expect(eventsFromChange({ ...source, actor_profile_id: null })).toEqual([]);
  });
  it.each(['submit', 'approve', 'reopen'])('supports the current final.%s events with stable source identity', action => {
    const source = change('gradebook_events', { id, course_offering_id: entity, action: `final.${action}`, created_at: '2026-11-06T00:00:00Z' });
    expect(eventsFromChange(source)).toHaveLength(1);
    expect(eventsFromChange(source)[0].sourceKey).toBe(`gradebook:${id}`);
    expect(eventsFromChange({ ...source, id: '13' })[0].sourceKey).toBe(eventsFromChange(source)[0].sourceKey);
  });
  it('ignores mark saves, unrelated edits, malformed times and history rewrites', () => {
    expect(eventsFromChange(change('gradebook_events', { id, course_offering_id: entity, action: 'save', created_at: new Date() }))).toEqual([]);
    expect(eventsFromChange(change('course_offerings', { id, status: 'completed' }))).toEqual([]);
    const first = { action: 'requested', at: '2026-11-06T00:00:00Z' };
    expect(eventsFromChange(change('study_leaves', { id, admission_record_id: entity, history: [{ ...first, action: 'approve' }] }, { history: [first] }))).toEqual([]);
    expect(eventsFromChange(change('study_leaves', { id, admission_record_id: entity, history: [{ action: 'approve', at: 'invalid' }] }))).toEqual([]);
    expect(eventsFromChange(change('study_leaves', { id, admission_record_id: entity, history: [null, { action: 'constructor', at: '2026-11-06' }] }))).toEqual([]);
  });
  it('only consumes new appended leave/extension history and deduplicates by ordinal', () => {
    const first = { action: 'requested', at: '2026-11-06T00:00:00Z' }, second = { action: 'approve', at: '2026-11-06T01:00:00Z' };
    const next = { id, admission_record_id: entity, history: [first, second] };
    const events = eventsFromChange(change('study_leaves', next, { history: [first] }));
    expect(events.map(e => e.kind)).toEqual(['leave.approved']);
    expect(events[0].sourceKey).toBe(`leave:${id}:1`);
    expect(eventsFromChange(change('study_leaves', next, next))).toEqual([]);
  });
  it.each([
    ['requested','leave.requested'], ['approve','leave.approved'], ['reject','leave.rejected'],
    ['request_extension','extension.requested'], ['approve_extension','extension.approved'], ['reject_extension','extension.rejected'],
  ])('maps the persisted leave action %s to %s', (action, kind) => {
    expect(eventsFromChange(change('study_leaves', { id, admission_record_id: entity, history: [{ action, at: '2026-11-06T00:00:00Z' }] }))[0].kind).toBe(kind);
  });
  it('detects a transfer request and its actual decision, never a later note edit', () => {
    const row = { id, admission_record_id: entity, status: 'pending', requested_at: '2026-11-06T00:00:00Z' };
    expect(eventsFromChange(change('major_transfers', row))[0].kind).toBe('transfer.requested');
    const approved = { ...row, status: 'approved', decided_at: '2026-11-06T01:00:00Z' };
    expect(eventsFromChange(change('major_transfers', approved, row))[0].kind).toBe('transfer.approved');
    expect(eventsFromChange(change('major_transfers', { ...approved, reason: 'new note' }, approved))).toEqual([]);
  });
});
