import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';

const template = 'notification_v2_template';
const marker = 'notification-v2-isolated-tests';

// One independently cloned schema per test. A failed test cannot poison the next.
// No fallback to .env, no shared fixture DB, no app port accepted.
export async function createNotificationDatabase(value: string | undefined) {
  if (!value) throw new Error('NOTIFICATION_TEST_DATABASE_URL is required.');
  const url = new URL(value);
  if (url.protocol !== 'postgres:' || url.hostname !== '127.0.0.1' || url.port !== '55440'
    || url.pathname !== `/${template}` || url.username !== 'notification_test') {
    throw new Error('Requires the isolated Notification template at 127.0.0.1:55440; no application database is allowed.');
  }
  const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
  const admin = new Sequelize(adminUrl.toString(), { logging: false });
  const name = `notification_v2_case_${randomUUID().replaceAll('-', '')}`;
  try {
    const [identity] = await admin.query<{ marker: string; owner: string }>(`SELECT
      shobj_description(d.oid,'pg_database') AS marker, pg_get_userbyid(d.datdba) AS owner
      FROM pg_database d WHERE d.datname=:template`, { type: QueryTypes.SELECT, replacements: { template } });
    if (identity?.marker !== marker || identity.owner !== 'notification_test') throw new Error('Notification template marker/owner mismatch.');
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    url.pathname = `/${name}`;
    return {
      name, url: url.toString(),
      async close() {
        // Only drop the UUID database allocated by this exact call, after all pools close.
        if (!/^notification_v2_case_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test database name.');
        try { await admin.query(`DROP DATABASE "${name}"`); } finally { await admin.close(); }
      },
    };
  } catch (error) { await admin.close(); throw error; }
}
