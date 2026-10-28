import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RbacService } from '../../src/auth/rbac.service.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { SchedulingController } from '../../src/scheduling/scheduling.controller.js';
import { SchedulingService } from '../../src/scheduling/scheduling.service.js';

describe('Scheduling filter permissions', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  const classGroupOptions = jest.fn(async () => [{ id: 'assigned-group', academicYear: '2026' }]);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SchedulingController],
      providers: [
        { provide: SchedulingService, useValue: { classGroupOptions } },
        { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: any) => {
      req.user = Object.assign(Object.create(Staff.prototype), { mustChangePassword: false });
      req.isAuthenticated = () => true;
      next();
    });
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { classGroupOptions.mockClear(); });

  it('loads scheduling filters with scheduling.view and no masters.view', async () => {
    permissions = new Set(['scheduling.view', 'scheduling.organize']);
    const majorId = 'd5e2276c-ff3a-45a2-9948-d0b0e4c640d8';
    const result = await request(app.getHttpServer()).get(`/scheduling/class-groups/options?majorId=${majorId}`).expect(200);
    expect(result.body).toEqual([{ id: 'assigned-group', academicYear: '2026' }]);
    expect(classGroupOptions).toHaveBeenCalledWith(majorId);
  });

  it('rejects an account without scheduling.view', async () => {
    permissions = new Set(['masters.view']);
    await request(app.getHttpServer()).get('/scheduling/class-groups/options').expect(403);
    expect(classGroupOptions).not.toHaveBeenCalled();
  });
});
