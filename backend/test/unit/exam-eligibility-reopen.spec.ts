import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { ExamWorkflowService } from '../../src/masters/exam-workflow.service.js';

function fixture(permissions = ['gradebook.submit']) {
  const actor = Object.defineProperties(Object.create(Staff.prototype), { id: {value:'staff'}, name: {value:'Supervisor'}, role: {value:'supervisor'} });
  const state: any = { mode: 'new', eligibility_status: 'approved', eligibility_version: 2, eligibility_can_reopen: true,
    eligibility_snapshot_id: 'snapshot', eligibility_submission: { rows: [{ participantId: 'learner', testScore: 8 }] }, result_status: 'not_available', result_version: 0 };
  const db: any = { transaction: jest.fn(async callback => callback({})), query: jest.fn().mockResolvedValue([]) };
  const rbac: any = { effectiveAccess: jest.fn().mockResolvedValue({ permissions: new Set(permissions) }) };
  const service = new ExamWorkflowService(db, rbac);
  jest.spyOn(service, 'lock').mockResolvedValue({ state, offering: {} });
  jest.spyOn(service, 'revision').mockResolvedValue(3);
  jest.spyOn(service, 'state').mockResolvedValue(state);
  const sql = jest.spyOn(service, 'query').mockResolvedValue([]);
  const event = jest.spyOn(service, 'event').mockResolvedValue();
  const load = jest.fn();
  const dto = { courseOfferingId: 'offering', action: 'request_reopen', version: 2, revision: 3, note: 'Cần sửa điểm thành phần' };
  return { service, state, db, sql, event, load, dto, actor };
}

it.each(['reopen', 'request_reopen', 'reject_reopen'])('requires a reason for %s', async action => {
  const f = fixture(['gradebook.approve', 'gradebook.submit']);
  await expect(f.service.transition({...f.dto, action, note: '  '}, f.actor, 'eligibility', f.load)).rejects.toThrow(BadRequestException);
  expect(f.db.transaction).not.toHaveBeenCalled();
});

it.each(['eligibility', 'final'] as const)('allows submitting and approving %s without a reason', async phase => {
  const f = fixture(['gradebook.approve', 'gradebook.submit']);
  const row = {participantId:'learner', classGroupId:'group', eligible:true, examExempt:false, testScore:8, assignmentScore:8, examScore:8, courseScore:8, result:'passed'};
  f.load.mockResolvedValue([row]);
  jest.spyOn(f.service, 'approvedRows').mockResolvedValue([row]);
  jest.spyOn(f.service as any, 'writeRows').mockResolvedValue(undefined);
  for (const action of ['submit', 'approve']) {
    f.state.eligibility_status = phase === 'eligibility' ? (action === 'submit' ? 'draft' : 'submitted') : 'approved';
    f.state.result_status = action === 'submit' ? 'draft' : 'submitted';
    f.state.eligibility_submission = {rows:[row]};
    f.state.result_snapshot = {rows:[row]};
    await f.service.transition({...f.dto, action, version:phase === 'final' ? 0 : 2, note:undefined}, f.actor, phase, f.load);
    expect(f.event).toHaveBeenLastCalledWith('offering', `${phase}.${action}`, f.actor, '', expect.any(Object), expect.any(Object), expect.any(Object));
  }
});

it('records a supervisor request without reopening the approved roster or changing scores', async () => {
  const f = fixture();
  await f.service.transition(f.dto, f.actor, 'eligibility', f.load);
  const update = f.db.query.mock.calls.find(([sql]: any[]) => sql.includes('UPDATE course_exam_workflows'));
  const submission = JSON.parse(update[1].replacements.submission);
  expect(submission).toMatchObject({ rows: f.state.eligibility_submission.rows, reopenRequest: { note: f.dto.note } });
  expect(update[0]).not.toContain("eligibility_status='draft'");
  expect(f.event).toHaveBeenCalledWith('offering', 'eligibility.request_reopen', f.actor, f.dto.note, expect.any(Object), expect.any(Object), expect.any(Object));
  expect(f.load).not.toHaveBeenCalled();
});

it.each(['scheduled', 'held', 'not_held'])('blocks requests after a %s exam exists, including races after rendering', async status => {
  const f = fixture();
  f.sql.mockImplementation(async sql => sql.includes('FROM course_exam_sessions') ? [{ id: 'exam', status }] : []);
  await expect(f.service.transition(f.dto, f.actor, 'eligibility', f.load)).rejects.toThrow(ConflictException);
  expect(f.db.query).not.toHaveBeenCalled();
});

it('hides the request details once scheduling disables reopening', () => {
  const f = fixture(); f.state.eligibility_submission.reopenRequest = { note: 'Sửa điểm', at: '2026-10-29' };
  expect(f.service.publicState(f.state).eligibility.reopenRequest).toMatchObject({ note: 'Sửa điểm' });
  expect(f.service.publicState({ ...f.state, eligibility_can_reopen: false }).eligibility).toMatchObject({ canReopen: false, reopenRequest: null });
});

it('blocks duplicate, stale and unapproved requests', async () => {
  const f = fixture();
  f.state.eligibility_submission.reopenRequest = { note: 'Đang chờ' };
  await expect(f.service.transition(f.dto, f.actor, 'eligibility', f.load)).rejects.toThrow(ConflictException);
  delete f.state.eligibility_submission.reopenRequest;
  await expect(f.service.transition({ ...f.dto, version: 1 }, f.actor, 'eligibility', f.load)).rejects.toThrow(ConflictException);
  f.state.eligibility_status = 'draft';
  await expect(f.service.transition(f.dto, f.actor, 'eligibility', f.load)).rejects.toThrow(ConflictException);
});

it('permits only approvers to reject a pending request and preserves the approved submission', async () => {
  const f = fixture(['gradebook.approve']);
  f.state.eligibility_submission.reopenRequest = { note: 'Sửa điểm' };
  await f.service.transition({ ...f.dto, action: 'reject_reopen' }, f.actor, 'eligibility', f.load);
  const update = f.db.query.mock.calls.find(([sql]: any[]) => sql.includes('UPDATE course_exam_workflows'));
  expect(JSON.parse(update[1].replacements.submission)).toEqual({ rows: f.state.eligibility_submission.rows });
  const staff = fixture();
  await expect(staff.service.transition({ ...staff.dto, action: 'reopen' }, staff.actor, 'eligibility', staff.load)).rejects.toThrow(ForbiddenException);
  await expect(staff.service.transition({ ...staff.dto, action: 'reject_reopen' }, staff.actor, 'eligibility', staff.load)).rejects.toThrow(ForbiddenException);
  await expect(staff.service.transition(staff.dto, staff.actor, 'final', staff.load)).rejects.toThrow(BadRequestException);
});

it('lets the admin reopen a requested roster only before scheduling and clears the request', async () => {
  const f = fixture(['gradebook.approve']);
  f.state.eligibility_submission.reopenRequest = {note:'Sửa điểm'};
  await f.service.transition({...f.dto,action:'reopen'}, f.actor, 'eligibility', f.load);
  expect(f.db.query).toHaveBeenCalledWith(expect.stringContaining('eligibility_snapshot_id=NULL,eligibility_submission=NULL'), expect.any(Object));
  f.sql.mockImplementation(async sql => sql.includes('FROM course_exam_sessions') ? [{id:'exam'}] : []);
  await expect(f.service.transition({...f.dto,action:'reopen'}, f.actor, 'eligibility', f.load)).rejects.toThrow(ConflictException);
});
