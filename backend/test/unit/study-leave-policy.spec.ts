import { businessDate, studyLeaveEffectiveAt, validDate } from '../../src/plan/study-leave-policy.js';
import { admissionLearnerWhere } from '../../src/plan/admission-learner-policy.js';
import { Op } from 'sequelize';

describe('Study leave boundaries', () => {
  it('preserves same-day classes completed before approval and uses midnight for a preapproved future leave', () => {
    const history = [{ action: 'requested', at: '2026-10-15T01:00:00Z' }, { action: 'approve', at: '2026-10-15T08:00:00Z' }];
    expect(studyLeaveEffectiveAt({ startDate: '2026-10-15', history })).toBe('2026-10-15T08:00:00.000Z');
    expect(studyLeaveEffectiveAt({ startDate: '2026-10-16', history }, new Date('2026-10-17T00:00:00Z'))).toBe('2026-10-15T17:00:00.000Z');
  });
  it('uses the local business day at midnight and honors leap years', () => {
    expect(businessDate(new Date('2026-10-15T16:59:59Z'))).toBe('2026-10-15');
    expect(businessDate(new Date('2026-10-15T17:00:00Z'))).toBe('2026-10-16');
    expect(validDate('2028-02-29')).toBe(true);
    for (const value of ['2027-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'garbage']) expect(validDate(value)).toBe(false);
  });
  it('keeps paused learners in the master learner list while excluding them from new assignments', () => {
    expect(admissionLearnerWhere().studyStatus).toBeUndefined();
    expect(admissionLearnerWhere(true).studyStatus?.[Op.or][0][Op.notIn]).toEqual(expect.arrayContaining(['Đang bảo lưu', 'Bảo lưu quá hạn', 'Thôi học']));
  });
});
