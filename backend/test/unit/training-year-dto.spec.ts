import { validate } from 'class-validator';
import { TrainingYearDto, UpdateTrainingYearDto } from '../../src/system/dto/training-year.dto.js';

describe('TrainingYearDto', () => {
  it('allows changing status alone, but rejects clearing the start date', async () => {
    expect(await validate(Object.assign(new UpdateTrainingYearDto(), { active: false }))).toHaveLength(0);
    expect(await validate(Object.assign(new UpdateTrainingYearDto(), { startDate: null }))).not.toHaveLength(0);
  });
  it.each([
    ['2026', '2026-09-05', true],
    ['26', '2026-09-05', false],
    ['2026', '2026-02-30', false],
    ['2026', '2026-09-05T00:00:00Z', false],
    ['2026', '', false],
  ])('validates year %s and start date %s', async (name, startDate, valid) => {
    const dto = Object.assign(new TrainingYearDto(), { name, startDate });
    expect((await validate(dto)).length === 0).toBe(valid);
  });
});
