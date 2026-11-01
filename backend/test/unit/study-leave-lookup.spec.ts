import { StudyLeaveService } from '../../src/plan/study-leave.service.js';

describe('Study leave learner lookup', () => {
  it('does not list learners until at least three code characters are entered', async () => {
    const db = { query: jest.fn() };
    const service = new StudyLeaveService(db as any);
    expect(await service.findLearners(' ')).toEqual([]);
    expect(await service.findLearners('H')).toEqual([]);
    expect(await service.findLearners(' HV ')).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('searches codes literally and excludes unpaid learners and open requests', async () => {
    const rows = [{ id: 'learner', code: 'HV_01', fullName: 'Nguyễn Văn A' }];
    const db = { query: jest.fn().mockResolvedValue(rows) };
    const service = new StudyLeaveService(db as any);
    expect(await service.findLearners(' HV_01 ')).toEqual(rows);
    const [sql, options] = db.query.mock.calls[0];
    expect(options.replacements).toEqual({ code: 'HV_01', pattern: '%HV\\_01%' });
    expect(sql).toContain('record.code ILIKE :pattern');
    expect(sql).toContain("record.study_status = 'Đang học'");
    expect(sql).toContain("record.extra_data->'tuitionPayment'->>'paid'");
    expect(sql).toContain("leave.status IN ('pending', 'approved')");
    expect(sql).toContain('LIMIT 20');
  });
});
