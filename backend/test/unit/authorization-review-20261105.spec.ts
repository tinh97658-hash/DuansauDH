/** Authorization regression tests based on the 2026-11-05 review.
 * No database connections or real account changes are made.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SystemController } from '../../src/system/system.controller.js';
import { SystemService } from '../../src/system/system.service.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';
import { effectiveProfilePermissions } from '../../src/auth/permission-tree.js';
import { routeViewCode, routeActionCode } from '../../src/auth/route-permissions.js';
import { routePermissionAllowed } from '../../src/auth/route-authorization.js';
import { operationalPermissions } from '../../src/dashboard/dashboard.service.js';
import { AccountsService } from '../../src/accounts/accounts.service.js';
import { PlanController } from '../../src/plan/plan.controller.js';
import { PlanService } from '../../src/plan/plan.service.js';
import { CurriculumService } from '../../src/plan/curriculum.service.js';
import { MajorTransferService } from '../../src/plan/major-transfer.service.js';
import { SubjectRecognitionService } from '../../src/plan/subject-recognition.service.js';
import { GroupResponsibilityService } from '../../src/auth/group-responsibility.service.js';
import { GroupScopeInterceptor } from '../../src/auth/group-scope.interceptor.js';
import { ValidationPipe } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { PermissionsGuard } from '../../src/common/permissions.guard.js';

describe('Authorization review evidence (2026-11-05)', () => {
  const actor = Object.assign(Object.create(Staff.prototype), { id: 'review-actor' });
  const grants = effectiveProfilePermissions(new Set([
    'module.catalog', 'catalog.view', 'catalog.manage',
    routeViewCode('/system/cities'), routeActionCode('/system/cities', 'catalog.manage'),
  ]));

  it('denies an unmapped mutation even when no permission decorator is present', async () => {
    const guard = new PermissionsGuard({ getAllAndOverride: () => undefined } as any,
      { effectiveAccess: async () => ({ permissions: grants, groupScope: { readOnly: false } }) } as any);
    const context: any = { getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ isAuthenticated: () => true, user: actor,
        method: 'POST', originalUrl: '/future/resource' }) }) };
    await workingProfileStorage.run({ staffId: actor.id, roleId: 'review-profile', selectionRequired: false }, async () => {
      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  it('keeps self-service password changes available to read-only profiles', async () => {
    const effectiveAccess = jest.fn().mockResolvedValue({ permissions: new Set(), groupScope: { readOnly: true } });
    const guard = new PermissionsGuard({ getAllAndOverride: () => undefined } as any, { effectiveAccess } as any);
    const context: any = { getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ isAuthenticated: () => true, user: actor,
        method: 'PATCH', originalUrl: '/accounts/me/password' }) }) };
    await workingProfileStorage.run({ staffId: actor.id, roleId: 'review-profile', selectionRequired: false }, async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  it('denies mixed-case URLs without the destination page permission', async () => {
    const updateMajor = jest.fn().mockResolvedValue({ updated: true });
    const updateDistrict = jest.fn().mockResolvedValue({ updated: true });
    const module = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        { provide: SystemService, useValue: { updateMajor, updateDistrict } },
        { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions: grants, groupScope: {} }) } },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.use((req: any, _res: any, next: any) => {
      req.user = actor;
      req.isAuthenticated = () => true;
      workingProfileStorage.run({ staffId: actor.id, roleId: 'review-profile', selectionRequired: false,
        requestPath: req.originalUrl, requestMethod: req.method }, next);
    });
    await app.init();
    try {
      await request(app.getHttpServer()).put('/system/majors/review-id').send({ name: 'Review' }).expect(403);
      expect(updateMajor).not.toHaveBeenCalled();
      await request(app.getHttpServer()).put('/system/districts/review-id').send({ name: 'Review' }).expect(403);
      expect(updateDistrict).not.toHaveBeenCalled();
      grants.add(routeViewCode('/system/majors'));
      grants.add(routeActionCode('/system/majors','catalog.manage'));
      try {
        await request(app.getHttpServer()).put('/SYSTEM/MAJORS/review-id/').send({ name: 'Review' }).expect(200);
        expect(updateMajor).toHaveBeenCalledTimes(1);
      } finally {
        grants.delete(routeViewCode('/system/majors'));
        grants.delete(routeActionCode('/system/majors','catalog.manage'));
        updateMajor.mockClear();
      }
      await request(app.getHttpServer()).put('/SYSTEM/majors/review-id').send({ name: 'Review' }).expect(403);
      expect(updateMajor).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('denies unmapped mutations while keeping shared lookup reads and own password changes', () => {
    expect(routePermissionAllowed(grants, '/system/majors/id', 'PUT', ['catalog.manage'])).toBe(false);
    expect(routePermissionAllowed(grants, '/system/districts/id', 'PUT', ['catalog.manage'])).toBe(false);
    expect(routePermissionAllowed(grants, '/system/districts', 'GET', [])).toBe(true);
    expect(routePermissionAllowed(grants, '/future/resource', 'POST', [])).toBe(false);
    expect(routePermissionAllowed(grants, '/accounts/me/password', 'PATCH', [])).toBe(true);
    expect(routePermissionAllowed(grants, '/accounts/me/password/other', 'PATCH', [])).toBe(false);
  });

  it('hides dashboard sections without their page grants', () => {
    const permissions = effectiveProfilePermissions(new Set(['module.scheduling', 'scheduling.view']));
    expect(routePermissionAllowed(permissions, '/scheduling/course-offerings', 'GET', ['scheduling.view'])).toBe(false);
    expect(operationalPermissions(actor, permissions).overview).toBe(false);
    permissions.add(routeViewCode('/masters/schedule'));
    expect(operationalPermissions(actor, permissions).overview).toBe(true);
  });

  it('denies restricted-view log access for every URL casing and trailing slash', async () => {
    const state: any = {};
    const scope: any = { current: () => state, configure: () => {},
      run: (_id: any, _access: any, work: any) => Promise.resolve().then(work),
      assertWriteReferences: async () => {} };
    const interceptor = new GroupScopeInterceptor({ effectiveAccess: async () => ({
      groupScope: { restrictView: true, restrictEdit: true, readOnly: false },
    }) } as any, scope);
    const ctx = (path: string): any => ({ switchToHttp: () => ({ getRequest: () => ({
      user: actor, method: 'GET', originalUrl: path,
    }) }) });
    await expect(interceptor.intercept(ctx('/accounts/change-logs'), { handle: () => of({ logs: [] }) })).rejects.toThrow();
    for (const path of ['/ACCOUNTS/change-logs', '/accounts/CHANGE-LOGS/', '/ACCOUNTS/AUDIT-LOGS?table=students']) {
      await expect(interceptor.intercept(ctx(path), { handle: () => of({ logs: [] }) })).rejects.toThrow();
    }
  });

  it('VERIFIED DEFENSE: validation strips assignment fields from plan updates', async () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    const staffId = '22222222-2222-4222-8222-222222222222';
    const permissions = effectiveProfilePermissions(new Set(['module.plan', 'plan.view', 'plan.manage',
      routeViewCode('/plan/training-plan'), routeActionCode('/plan/training-plan', 'plan.manage')]));
    expect(permissions.has('groups.assign')).toBe(false);
    const updateClass = jest.fn().mockResolvedValue({ updated: true });
    const forUpdate = jest.fn().mockRejectedValue(new Error('Assignment denied'));
    const module = await Test.createTestingModule({ controllers: [PlanController], providers: [
      { provide: PlanService, useValue: { updateClass } },
      { provide: GroupResponsibilityService, useValue: { forUpdate } },
      ...[CurriculumService, MajorTransferService, SubjectRecognitionService].map(provide => ({ provide, useValue: {} })),
      { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions, groupScope: {} }) } },
    ] }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use((req: any, _res: any, next: any) => {
      req.user = actor; req.isAuthenticated = () => true;
      workingProfileStorage.run({ staffId: actor.id, roleId: 'review-profile', selectionRequired: false,
        requestPath: req.originalUrl, requestMethod: req.method }, next);
    });
    await app.init();
    try {
      await request(app.getHttpServer()).put('/plan/classes/' + groupId).send({ responsibleStaffId: staffId }).expect(200);
      expect(forUpdate).not.toHaveBeenCalled();
      expect(updateClass).toHaveBeenCalledWith(groupId, expect.not.objectContaining({ responsibleStaffId: staffId }));
    } finally { await app.close(); }
  });

  it('preserves the authorized administrative privilege and records before/after role assignments', async () => {
    let submittedAssignments: unknown;
    const currentStaff: any = { id: actor.id, role: 'account-manager', email: 'review@example.invalid',
      reload: jest.fn(), update: jest.fn(), increment: jest.fn() };
    const currentRole = { id: 'manager-role', code: 'account-manager', active: true };
    const adminRole = { id: 'admin-role', code: 'admin', active: true };
    const record = jest.fn().mockResolvedValue(undefined);
    const service = new AccountsService(
      { findByPk: async () => currentStaff } as any,
      { findAll: async () => [currentRole, adminRole] } as any,
      { findAll: async () => [{ roleId: currentRole.id }], bulkCreate: async (rows: unknown) => { submittedAssignments = rows; } } as any,
      { transaction: async (work: any) => work({}) } as any,
      { record } as any, {} as any,
      { invalidate: () => {} } as any,
      { lock: async () => {}, assertRetained: async () => {} } as any,
    );
    jest.spyOn(service, 'detail').mockResolvedValue({ id: actor.id } as any);
    await workingProfileStorage.run({ staffId: actor.id, roleId: currentRole.id, selectionRequired: false }, () =>
      service.update(actor.id, actor.id, { roleIds: [currentRole.id, adminRole.id] }, {}));
    expect(submittedAssignments).toEqual([{ staffId: actor.id, roleId: adminRole.id }]);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actorStaffId: actor.id, targetStaffId: actor.id,
      metadata: expect.objectContaining({ roleChanges: {
        before: { roleIds: [currentRole.id], primaryRoleCode: currentRole.code },
        after: { roleIds: [currentRole.id, adminRole.id], primaryRoleCode: currentRole.code },
        addedRoleIds: [adminRole.id], removedRoleIds: [],
      } }) }), {});
  });
});
