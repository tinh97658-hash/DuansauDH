// Test-only schema template. Never reads .env or accepts an application DB URL.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
require('reflect-metadata');
const { Sequelize } = require('sequelize-typescript');
const { Umzug, SequelizeStorage } = require('umzug');
const container = 'duansaudh-notification-v2-clean-20261106';
const marker = 'notification-v2-isolated-tests';
const template = 'notification_v2_template';

async function main() {
  const result = spawnSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Dedicated Notification test container is unavailable.');
  const [info] = JSON.parse(result.stdout);
  const ports = info.NetworkSettings.Ports['5432/tcp'];
  if (info.Name !== `/${container}` || info.Config.Image !== 'postgres:16-alpine'
    || info.Config.Labels?.['codex.purpose'] !== marker || !info.State.Running
    || ports?.length !== 1 || ports[0].HostIp !== '127.0.0.1' || ports[0].HostPort !== '55440') {
    throw new Error('Refusing a container without the exact Notification test identity/port/label.');
  }
  const url = `postgres://notification_test:notification-test-only@127.0.0.1:55440/${template}`;
  let db = new Sequelize(url, { logging: false });
  try {
    if (process.argv.includes('--recreate-empty-template')) {
      const [identity] = await db.query(`SELECT current_database() AS name,shobj_description(oid,'pg_database') AS marker
        FROM pg_database WHERE datname=current_database()`, { type: 'SELECT' });
      if (identity.name !== template || identity.marker !== marker) throw new Error('Cannot recreate an unmarked template.');
      const [fixture] = await db.query(`SELECT (SELECT count(*) FROM staff)::int AS staff,
        (SELECT count(*) FROM notification_events)::int AS events,
        (SELECT count(*) FROM notification_deliveries)::int AS deliveries,
        (SELECT count(*) FROM pg_database WHERE datname LIKE 'notification_v2_case_%')::int AS cases`, { type: 'SELECT' });
      if (Object.values(fixture).some(value => value !== 0)) throw new Error('Template/case data exists; preserved without deletion.');
      await db.close();
      const admin = new Sequelize(url.replace(`/${template}`, '/postgres'), { logging: false });
      try {
        await admin.query(`DROP DATABASE "${template}"`);
        await admin.query(`CREATE DATABASE "${template}"`);
      } finally { await admin.close(); }
      db = new Sequelize(url, { logging: false });
    }
    const [identity] = await db.query('SELECT current_database() AS name', { type: 'SELECT' });
    if (identity.name !== template) throw new Error('Wrong template database.');
    const [count] = await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'", { type: 'SELECT' });
    // Never replay migrations against a populated/reused template.
    if (count.n !== 0) throw new Error('Template must be new and empty; existing data was preserved.');
    const migrator = new Umzug({
      migrations: { glob: path.resolve(__dirname, '../../dist/database/migrations/*.js').replaceAll('\\', '/') },
      context: db.getQueryInterface(), storage: new SequelizeStorage({ sequelize: db, tableName: 'sequelize_meta' }), logger: undefined,
    });
    const applied = await migrator.up();
    await db.query(`COMMENT ON DATABASE ${template} IS '${marker}'`);
    console.log(JSON.stringify({ container, port: 55440, template, applied: applied.length, marker }));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.original?.message || error.message); process.exitCode = 1; });
