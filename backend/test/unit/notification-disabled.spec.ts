import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Staff } from '../../src/database/models/staff.model.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';
import { InboxService } from '../../src/notifications/inbox.service.js';

it('returns an explicit disabled code without querying notifications', async () => {
  const actor = Object.create(Staff.prototype);
  Object.defineProperties(actor, { id: { value: 'staff-1' }, status: { value: 'active' } });
  const db = { query: jest.fn() };
  const service = new InboxService(db as any, {} as any, new ConfigService({ NOTIFICATION_V2_ENABLED: false }));
  await workingProfileStorage.run({ staffId: 'staff-1', roleId: 'profile-1', selectionRequired: false, requestMethod: 'GET' }, async () => {
    try { await service.list(actor); throw new Error('Expected disabled response'); }
    catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ code: 'NOTIFICATION_V2_DISABLED' });
    }
  });
  expect(db.query).not.toHaveBeenCalled();
});
