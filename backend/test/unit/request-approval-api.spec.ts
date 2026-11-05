import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { PlanController } from '../../src/plan/plan.controller.js';
import { StudyLeaveController } from '../../src/plan/study-leave.controller.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { PermissionsGuard } from '../../src/common/permissions.guard.js';

const apiAccess = async (controller: any, method: string, role: string, permissions: string[], body: any = {}) => {
  const staffRoles = { findAll: jest.fn().mockResolvedValue([{ role: { code: role, active: true, permissions: permissions.map(code => ({ code })) } }]) };
  const rbac = new RbacService({} as any, staffRoles as any);
  const guard = new PermissionsGuard(new Reflector(), rbac);
  const user = Object.assign(Object.create(Staff.prototype), { id: 'staff' });
  const context: any = { getHandler: () => controller.prototype[method], getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ method: 'POST', isAuthenticated: () => true, user, body }) }) };
  return guard.canActivate(context);
};

it.each([
  [StudyLeaveController, 'request', 'studyleave.request'],
  [PlanController, 'requestMajorTransfer', 'majortransfer.request'],
])('checks the separate request grant on %s.%s', async (controller, method, permission) => {
  await expect(apiAccess(controller, method as string, 'supervisor', [permission as string])).resolves.toBe(true);
  await expect(apiAccess(controller, method as string, 'supervisor', ['admission.manage'])).rejects.toThrow(ForbiddenException);
});

it.each(['approve', 'reject'])('requires an explicit approval grant for %s independently of the role name', async action => {
  for (const role of ['supervisor', 'custom']) {
    await expect(apiAccess(StudyLeaveController, 'action', role, ['plan.view', 'studyleave.request'], { action })).rejects.toThrow(ForbiddenException);
    await expect(apiAccess(PlanController, 'decideMajorTransfer', role, ['admission.manage', 'majortransfer.request'])).rejects.toThrow(ForbiddenException);
    await expect(apiAccess(StudyLeaveController, 'action', role, ['plan.view', 'studyleave.approve'], { action })).resolves.toBe(true);
    await expect(apiAccess(PlanController, 'decideMajorTransfer', role, ['majortransfer.approve'])).resolves.toBe(true);
  }
  await expect(apiAccess(StudyLeaveController, 'action', 'admin', ['plan.view', 'studyleave.approve'], { action })).resolves.toBe(true);
  await expect(apiAccess(PlanController, 'decideMajorTransfer', 'admin', ['majortransfer.approve'])).resolves.toBe(true);
  await expect(apiAccess(PlanController, 'decideMajorTransfer', 'admin', ['majortransfer.request'])).rejects.toThrow(ForbiddenException);
});
