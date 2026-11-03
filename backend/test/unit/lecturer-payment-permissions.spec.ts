import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { PermissionsGuard } from '../../src/common/permissions.guard.js';
import { ReportsController } from '../../src/reports/reports.controller.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { LecturerPaymentQueryDto, UpdateLecturerPaymentDto } from '../../src/reports/dto/lecturer-payment.dto.js';
import { LecturerPaymentService } from '../../src/reports/lecturer-payment.service.js';

describe('Lecturer payment authorization and validation', () => {
  const user = Object.create(Staff.prototype);
  const context = (method: keyof ReportsController, httpMethod = 'GET') => ({
    getClass: () => ReportsController, getHandler: () => ReportsController.prototype[method],
    switchToHttp: () => ({ getRequest: () => ({ user, method: httpMethod, isAuthenticated: () => true }) }),
  }) as any;
  it('allows report viewing but rejects writes and exports without separate permissions', async () => {
    const rbac = { effectiveAccess: jest.fn().mockResolvedValue({ permissions: new Set(['reports.view']) }) };
    const guard = new PermissionsGuard(new Reflector(), rbac as any);
    await expect(guard.canActivate(context('lecturerPayments'))).resolves.toBe(true);
    await expect(guard.canActivate(context('paymentOffering'))).resolves.toBe(true);
    await expect(guard.canActivate(context('updatePayment', 'PUT'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context('exportPayments'))).rejects.toThrow(ForbiddenException);
    rbac.effectiveAccess.mockResolvedValue({ permissions: new Set(['reports.view', 'reports.payments.manage']) });
    await expect(guard.canActivate(context('updatePayment', 'PUT'))).resolves.toBe(true);
    expect(rbac.effectiveAccess).toHaveBeenLastCalledWith(user, true);
  });
  it.each(['false', 1, null, undefined])('rejects non-boolean paid value %s', async paid => {
    expect(await validate(Object.assign(new UpdateLecturerPaymentDto(), { paid }))).not.toHaveLength(0);
  });
  it('rejects invalid filters and reversed completion dates', async () => {
    expect(await validate(Object.assign(new LecturerPaymentQueryDto(), { from: '2026-02-30', lecturerId: 'invalid', paymentStatus: 'other' }))).not.toHaveLength(0);
    const db = { query: jest.fn() };
    await expect(new LecturerPaymentService(db as any).list({ from: '2026-11-03', to: '2026-11-01' })).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });
});
