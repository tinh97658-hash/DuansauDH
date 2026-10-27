import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GroupResponsibilityService } from '../../src/auth/group-responsibility.service.js';
import { Staff } from '../../src/database/models/staff.model.js';

it('requires assignment permission even when selecting yourself in the group editor', async () => {
  const service = new GroupResponsibilityService({} as any, {
    effectiveAccess: async () => ({ permissions: new Set() }),
  } as any);
  await expect(service.forUpdate({ id: 'self' } as Staff, 'self')).rejects.toThrow(ForbiddenException);
});

it('accepts an active assignee with the assignment permission', async () => {
  const service = new GroupResponsibilityService({} as any, {
    effectiveAccess: async () => ({ permissions: new Set(['groups.assign']) }),
  } as any);
  jest.spyOn(Staff, 'findByPk').mockResolvedValue({ id: 'other', status: 'active' } as Staff);
  await expect(service.forUpdate({ id: 'self' } as Staff, 'other')).resolves.toBe('other');
});

it('rejects a disabled assignee in the group editor', async () => {
  const service = new GroupResponsibilityService({} as any, {
    effectiveAccess: async () => ({ permissions: new Set(['groups.assign']) }),
  } as any);
  jest.spyOn(Staff, 'findByPk').mockResolvedValue({ id: 'other', status: 'disabled' } as Staff);
  await expect(service.forUpdate({ id: 'self' } as Staff, 'other')).rejects.toThrow(BadRequestException);
});
