import { createNotificationDatabase } from '../helpers/notification-database.js';

describe('Notification test database safety boundary', () => {
  it.each([
    ['missing URL', undefined],
    ['application port/database', 'postgres://notification_test:test@127.0.0.1:55432/pgsms_nt3_import_20261104'],
    ['old accumulated fixture database', 'postgres://notification_test:test@127.0.0.1:55439/notification_v2_test'],
    ['application database on test port', 'postgres://notification_test:test@127.0.0.1:55440/pgsms_nt3_import_20261104'],
    ['remote host', 'postgres://notification_test:test@192.0.2.1:55440/notification_v2_template'],
    ['unexpected owner', 'postgres://postgres:test@127.0.0.1:55440/notification_v2_template'],
  ])('rejects %s before opening a connection', async (_name, url) => {
    await expect(createNotificationDatabase(url)).rejects.toThrow();
  });
});
