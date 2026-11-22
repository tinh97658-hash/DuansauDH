import { intakeRoundFilter } from '../../src/plan/intake-round.js';
import { PlanService } from '../../src/plan/plan.service.js';
import { MastersService } from '../../src/masters/masters.service.js';
import { Op } from 'sequelize';

describe('Unified intake round scope', () => {
  it.each(['0', '-1', '100', '1.5', '2x', 'NaN', '1 OR 1=1'])('rejects invalid round %s', value => {
    expect(() => intakeRoundFilter(value)).toThrow();
  });
  it('keeps all, unknown and a numbered round distinct', () => {
    expect(intakeRoundFilter('')).toBeUndefined();
    expect(intakeRoundFilter('unassigned')).toBeNull();
    expect(intakeRoundFilter('2')).toBe(2);
  });
  it.each(['applications', 'learners', 'study-management'])('uses the round for rows and every statistic in %s', async stage => {
    const records = { findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }), count: jest.fn().mockResolvedValue(0) };
    const service = new PlanService({} as any, {} as any, {} as any, {} as any, records as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await service.listAdmissionRecords(undefined, undefined, '2026', undefined, undefined, undefined, '1', '20', undefined, false, stage, undefined, '2');
    expect(records.findAndCountAll.mock.calls[0][0].where.intakeRound).toBe(2);
    for (const [query] of records.count.mock.calls) {
      const where = query.where;
      expect(where.intakeRound ?? where[Op.and]?.[0]?.intakeRound).toBe(2);
    }
  });
  it('filters both classes and candidates by the same round', async () => {
    const groups = { findAll: jest.fn().mockResolvedValue([]) };
    const records = { findAll: jest.fn().mockResolvedValue([]) };
    const members = { findAll: jest.fn().mockResolvedValue([]) };
    const service = new MastersService(groups as any, members as any, records as any, {} as any, {} as any, {} as any, {} as any);
    await service.listClassGroups('m1', '2026', undefined, '2');
    await service.listEligibleStudents('m1', '2026', '2');
    expect(groups.findAll.mock.calls[0][0].where).toMatchObject({ academicYear: '2026', intakeRound: 2 });
    expect(records.findAll.mock.calls[0][0].where).toMatchObject({ academicYear: '2026', intakeRound: 2 });
    // Membership lookup must remain global, so another round's assignment cannot be hidden.
    expect(members.findAll.mock.calls[0][0].include[0].where).toEqual({ program: 'masters' });
  });
  it('validates and creates a numbered record inside the same locked transaction', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const db = { query: jest.fn().mockResolvedValue([]), transaction: jest.fn(async work => work(transaction)) };
    const majors = { findByPk: jest.fn().mockResolvedValue({ id: 'm1', name: 'CNTT', active: true, program: 'masters' }) };
    const records = { create: jest.fn().mockResolvedValue({ id: 'r1' }), findByPk: jest.fn().mockResolvedValue({ id: 'r1' }) };
    const evaluations = { guardRecordUpdate: jest.fn().mockResolvedValue(undefined) };
    const service = new PlanService({} as any, {} as any, {} as any, majors as any, records as any, db as any, {} as any, {} as any, {} as any, {} as any, evaluations as any);
    const dto = { fullName: 'Nguyễn Văn An', majorId: 'm1', academicYear: '2026', intakeRound: 2 };
    await service.createAdmissionRecord(dto);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(21026)', { transaction });
    expect(evaluations.guardRecordUpdate).toHaveBeenCalledWith(null, dto, transaction);
    expect(majors.findByPk).toHaveBeenCalledWith('m1', { transaction });
    expect(records.create).toHaveBeenCalledWith(expect.objectContaining({ intakeRound: 2 }), { transaction });
    expect(records.findByPk).toHaveBeenCalledWith('r1', expect.objectContaining({ transaction }));
  });
});
