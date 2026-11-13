// Requires an independently provisioned test PostgreSQL server. Never loads .env.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const root = path.resolve(__dirname, '..');

function adminUrl(value) {
  if (!value) throw new Error('POSTGRES_TEST_ADMIN_URL is required; there is no application database fallback.');
  const url = new URL(value);
  if (url.protocol !== 'postgres:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username !== 'pgsms_ci' || url.pathname !== '/pgsms_ci_control' || url.search || url.hash) {
    throw new Error('Use the dedicated loopback PostgreSQL server, user pgsms_ci, database pgsms_ci_control.');
  }
  return url;
}

function discoverSuites() {
  return fs.readdirSync(path.join(root, 'test/integration')).filter(name => name.endsWith('.spec.ts'))
    .map(name => ({ name, source: fs.readFileSync(path.join(root, 'test/integration', name), 'utf8') }))
    .map(({ name, source }) => ({ name, flags: [...new Set([...source.matchAll(/process\.env\.(RUN_[A-Z_]+)/g)].map(match => match[1]))] }))
    .filter(suite => suite.flags.length).sort((a, b) => a.name.localeCompare(b.name));
}

function databaseName(suite, index) {
  if (/^(group-scope|gradebook-responsibility|working-profiles|unassigned-admission|scheduling-scopes)-/.test(suite)) return 'pgsms_group_scope_test';
  if (/^(dashboard-v2|upload-storage|learner-code-management)-/.test(suite)) return `pgsms_dashboard_test_${Date.now()}${index}`;
  if (suite.startsWith('lecturer-payment-')) return `pgsms_lecturer_payment_test_${Date.now()}${index}`;
  if (suite === 'notification-inbox-postgres.spec.ts') return 'notification_v2_template';
  return `pgsms_ci_test_${Date.now()}${index}`;
}

function suiteEnvironment(url, suite, suites, notificationUrl) {
  const flags = Object.fromEntries(suites.flatMap(item => item.flags).map(flag => [flag, 'false']));
  for (const flag of suite.flags) flags[flag] = 'true';
  return { ...process.env, ...flags, NODE_ENV: 'test',
    DATABASE_URL: url.toString(), TEST_DATABASE_URL: url.toString(),
    NOTIFICATION_TEST_DATABASE_URL: notificationUrl?.toString() || '',
    DB_HOST: url.hostname, DB_PORT: url.port, POSTGRES_DB: url.pathname.slice(1),
    POSTGRES_USER: decodeURIComponent(url.username), POSTGRES_PASSWORD: decodeURIComponent(url.password),
    PORT: '3001', SESSION_SECRET: 'disposable-ci-session-secret-at-least-32-characters',
    SESSION_COOKIE_SECURE: 'false', FRONTEND_URL: 'http://localhost:3100', API_PUBLIC_URL: 'http://localhost:3001',
    DATABASE_SSL: 'false', TRUST_PROXY: '0', DB_POOL_MIN: '0', DB_POOL_MAX: '10',
    // Never send mail or enable external OAuth from a developer's local .env.
    EMAIL_USERNAME: '', PASSWORD: '', HOST: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  };
}

async function main() {
  const control = adminUrl(process.env.POSTGRES_TEST_ADMIN_URL);
  const all = discoverSuites();
  const selected = process.argv.slice(2);
  if (selected.some(name => !all.some(suite => suite.name === name))) throw new Error('Select database suites by their exact integration filename.');
  const suites = selected.length ? all.filter(suite => selected.includes(suite.name)) : all;
  if (!suites.length) throw new Error('No PostgreSQL integration suites found.');
  const admin = new Sequelize(control.toString(), { logging: false });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pgsms-ci-results-'));
  let tests = 0;
  const failures = [];
  try {
    const [[identity]] = await admin.query('SELECT current_user AS owner, current_database() AS database');
    if (identity.owner !== 'pgsms_ci' || identity.database !== 'pgsms_ci_control') throw new Error('Test server identity mismatch.');
    for (const [index, suite] of suites.entries()) {
      const name = databaseName(suite.name, index);
      if (!/^(pgsms_group_scope_test|pgsms_(?:ci|dashboard|lecturer_payment)_test_\d+|notification_v2_template)$/.test(name)) throw new Error('Unsafe test database name.');
      const url = new URL(control); url.pathname = `/${name}`;
      let created = false;
      let db;
      try {
        // CREATE must succeed before cleanup is enabled. Never reuse or remove an existing database.
        await admin.query(`CREATE DATABASE "${name}"`);
        created = true;
        db = new Sequelize(url.toString(), { logging: false });
        const migrator = new Umzug({
          migrations: { glob: path.join(root, 'dist/database/migrations/*.js').replace(/\\/g, '/') },
          context: db.getQueryInterface(), storage: new SequelizeStorage({ sequelize: db, tableName: 'sequelize_meta' }),
          logger: undefined,
        });
        await migrator.up();
        // Match the explicit bootstrap fixture used by the existing dashboard
        // runner. Notification tests deliberately require an empty staff table.
        if (['dashboard-v2-postgres.spec.ts', 'learner-code-management-postgres.spec.ts', 'lecturer-payment-details-migration.spec.ts'].includes(suite.name)) {
          await db.query(`INSERT INTO staff(id,name,email,role,status,created_at,updated_at)
            VALUES(gen_random_uuid(),'CI fixture admin','dashboard-test@example.invalid','admin','active',now(),now())`);
        }
        await db.close(); db = undefined;
        let notificationUrl;
        if (suite.name === 'notification-inbox-postgres.spec.ts') {
          if (control.port !== '55440') throw new Error('Notification tests require the dedicated test server on port 55440.');
          const [roles] = await admin.query("SELECT 1 FROM pg_roles WHERE rolname='notification_test'");
          if (!roles.length) await admin.query(`CREATE ROLE notification_test LOGIN SUPERUSER PASSWORD ${admin.escape(decodeURIComponent(control.password))}`);
          await admin.query(`ALTER DATABASE "${name}" OWNER TO notification_test`);
          await admin.query(`COMMENT ON DATABASE "${name}" IS 'notification-v2-isolated-tests'`);
          notificationUrl = new URL(url); notificationUrl.username = 'notification_test';
        }
        console.log(`PostgreSQL ${index + 1}/${suites.length}: ${suite.name}`);
        const report = path.join(output, `${index}.json`);
        const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--config', 'test/jest.config.cjs',
          '--runInBand', '--runTestsByPath', `test/integration/${suite.name}`, '--testTimeout=60000', '--json', `--outputFile=${report}`], {
          cwd: root, stdio: 'inherit', env: suiteEnvironment(url, suite, all, notificationUrl), timeout: 12 * 60 * 1000,
        });
        if (result.status !== 0) throw new Error(`PostgreSQL suite failed: ${suite.name}`);
        const summary = JSON.parse(fs.readFileSync(report, 'utf8'));
        if (!summary.success || !summary.numPassedTests || summary.numPendingTests || summary.numTodoTests) {
          throw new Error(`PostgreSQL suite must run without skipped/todo tests: ${suite.name}`);
        }
        tests += summary.numPassedTests;
      } catch (error) {
        failures.push(suite.name);
        console.error(`${suite.name}: ${error.original?.message || error.message}`);
      } finally {
        if (db) await db.close();
        if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      }
    }
    if (failures.length) throw new Error(`Failed PostgreSQL suites (${failures.length}): ${failures.join(', ')}. Results: ${output}`);
    console.log(`PASS: ${suites.length} PostgreSQL suites, ${tests} tests, no skipped tests. Results: ${output}`);
  } finally { await admin.close(); }
}

module.exports = { adminUrl, discoverSuites, databaseName, suiteEnvironment };
if (require.main === module) main().catch(error => {
  // Do not print connection URLs, passwords or complete SQL error objects.
  console.error(error.original?.message || error.message); process.exitCode = 1;
});
