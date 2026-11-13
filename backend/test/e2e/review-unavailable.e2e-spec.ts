import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataController } from '../../src/management/data.controller.js';
import { StudentsService } from '../../src/students/students.service.js';
import { StaffService } from '../../src/staff/staff.service.js';
import { AuthenticatedGuard } from '../../src/common/authenticated.guard.js';
import { PermissionsGuard } from '../../src/common/permissions.guard.js';

describe('Unavailable review submission HTTP contract', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DataController],
      providers: [{ provide: StudentsService, useValue: {} }, { provide: StaffService, useValue: {} }],
    }).overrideGuard(AuthenticatedGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });
  it('returns 501 rather than acknowledging an unsaved review', async () => {
    const response = await request(app.getHttpServer()).post('/data/submitreview')
      .send({ studentId: 'learner', comment: 'A review that must not appear to be saved' }).expect(501);
    expect(response.body.message).toContain('chưa được gửi hoặc lưu');
    expect(response.body.status).not.toBe('success');
  });
});
