import { BadRequestException } from '@nestjs/common';

// Empty means all rounds; "unassigned" is deliberately distinct from round 1.
export function intakeRoundFilter(value?: string): number | null | undefined {
  if (!value || value === 'ALL') return undefined;
  if (value === 'unassigned') return null;
  if (!/^[1-9]\d{0,1}$/.test(value)) throw new BadRequestException('Đợt phải là số từ 1 đến 99.');
  return Number(value);
}
