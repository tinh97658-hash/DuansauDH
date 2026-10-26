import { StudyLeaveService } from '../../src/plan/study-leave.service.js';

describe('Study leave request date range', () => {
  it.each(['2099-03-01', '2099-02-28'])('rejects an end date equal to or before the start: %s', async endDate => {
    const db = { transaction: jest.fn() };
    const service = new StudyLeaveService(db as any);
    await expect(service.request('learner', { reason: 'Điều trị', startDate: '2099-03-01', endDate }, {}))
      .rejects.toThrow('Ngày kết thúc bảo lưu phải sau ngày bắt đầu bảo lưu.');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['2099-03-01', '2099-03-02'], ['2099-12-31', '2100-01-01'], ['2096-02-28', '2096-02-29'],
  ])('accepts the following day across calendar boundaries: %s to %s', async (startDate, endDate) => {
    const db = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'learner', study_status: 'Đang học', training_level: 'Thạc sĩ', extra_data: { tuitionPayment: { paid: true } } }])
        .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined),
      transaction: jest.fn(async callback => callback({})),
    };
    const service = new StudyLeaveService(db as any);
    jest.spyOn(service, 'detail').mockResolvedValue({} as any);
    await service.request('learner', { reason: 'Điều trị', startDate, endDate }, {});
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO study_leaves'),
      expect.objectContaining({ replacements: expect.objectContaining({ startDate, endDate }) }));
  });
});
