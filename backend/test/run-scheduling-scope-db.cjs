// Explicitly targets the isolated authorization test database, never the application database.
const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const config = {};
for (const file of ['.env', 'backend/config.env']) {
  for (const line of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const uri = config.DATABASE_URL ? new URL(config.DATABASE_URL) : new URL(`postgres://${encodeURIComponent(config.POSTGRES_USER)}:${encodeURIComponent(config.POSTGRES_PASSWORD)}@localhost:${config.DB_PORT}/${config.POSTGRES_DB}`);
uri.pathname = '/pgsms_group_scope_test';
(async () => {
  const db = new Sequelize(uri.toString(), { logging: false });
  try {
    const [currentPolicy] = await db.query("SELECT to_regprocedure('app_institution_permission(text,boolean)') AS automatic");
    if (process.argv.includes('--refresh') && currentPolicy[0].automatic) throw new Error('Do not replay 082/083 after 084; use a fresh disposable test database for migration development.');
    const [rows] = await db.query("SELECT to_regclass('role_permission_scopes') AS scopes, to_regprocedure('app_scheduling_offering_allowed(uuid)') AS baseline");
    if (!rows[0].baseline) throw new Error('Test database must have baseline migrations through 081.');
    if (!rows[0].scopes) {
      await require('../dist/database/migrations/082-scheduling-permission-scopes.js').up({ context: db.getQueryInterface() });
      console.log('Applied migration 082 to isolated test database.');
    } else if (process.argv.includes('--refresh')) {
      const sequelize = {
        transaction: work => db.transaction(work),
        query: (sql, options) => {
          if (sql.includes('ALTER TABLE roles ADD COLUMN')) {
            const start = sql.indexOf('GRANT SELECT');
            if (start < 0) throw new Error('Cannot locate the test-only refresh boundary.');
            sql = sql.slice(start);
          }
          return db.query(sql.replaceAll('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'), options);
        },
      };
      await require('../dist/database/migrations/082-scheduling-permission-scopes.js').up({ context: { sequelize } });
    }
    const [organization] = await db.query("SELECT to_regprocedure('app_schedule_roster_record_read(uuid)') AS ready");
    if (!organization[0].ready) {
      await require('../dist/database/migrations/083-scheduling-organization-scope.js').up({ context: db.getQueryInterface() });
      console.log('Applied migration 083 to isolated test database.');
    } else if (process.argv.includes('--refresh')) {
      const sequelize = {
        transaction: work => db.transaction(work),
        query: (sql, options) => db.query(sql.replaceAll('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION')
          .replace(/CREATE POLICY (\w+) ON (\w+)/g, 'DROP POLICY IF EXISTS $1 ON $2; CREATE POLICY $1 ON $2'), options),
      };
      await require('../dist/database/migrations/083-scheduling-organization-scope.js').up({ context: { sequelize } });
    }
    const [automatic] = await db.query("SELECT to_regprocedure('app_institution_permission(text,boolean)') AS ready");
    if (!automatic[0].ready) {
      await require('../dist/database/migrations/084-automatic-institution-academic-scope.js').up({ context: db.getQueryInterface() });
      console.log('Applied migration 084 to isolated test database.');
    }
  } finally { await db.close(); }
  const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--config', 'test/jest.config.cjs', '--runInBand', ...process.argv.slice(2).filter(arg => arg !== '--refresh')], {
    cwd: path.join(root, 'backend'), stdio: 'inherit', env: { ...process.env, DATABASE_URL: uri.toString(), POSTGRES_DB: 'pgsms_group_scope_test', NODE_ENV: 'test', RUN_GROUP_SCOPE_POSTGRES_TESTS: 'true', RUN_SCHEDULING_SCOPE_POSTGRES_TESTS: 'true', RUN_POSTGRES_SCHEDULING_TESTS: 'true' },
  });
  process.exitCode = result.status ?? 1;
})().catch(error => { console.error(error.original?.message || error.message); process.exitCode = 1; });
