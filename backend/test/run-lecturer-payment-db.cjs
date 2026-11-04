// Creates a fresh disposable database, applies real migrations, runs the payment SQL tests, then removes it.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const root = path.resolve(__dirname, '..');
const config = {};
for (const file of [path.join(root, '../.env'), path.join(root, 'config.env')]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const uri = new URL(process.env.DATABASE_URL || config.DATABASE_URL ||
  `postgres://${encodeURIComponent(config.POSTGRES_USER)}:${encodeURIComponent(config.POSTGRES_PASSWORD)}@localhost:${config.DB_PORT}/${config.POSTGRES_DB}`);
const testName = `pgsms_lecturer_payment_test_${Date.now()}`;
const admin = new Sequelize(uri.toString(), { logging: false });
uri.pathname = `/${testName}`;
const db = new Sequelize(uri.toString(), { logging: false });
let created = false;
(async () => {
  try {
    await admin.query(`CREATE DATABASE "${testName}"`);
    created = true;
    const migrator = new Umzug({
      migrations: { glob: path.join(root, 'dist/database/migrations/*.js').replace(/\\/g, '/') },
      context: db.getQueryInterface(), storage: new SequelizeStorage({ sequelize: db, tableName: 'sequelize_meta' }), logger: undefined,
    });
    await migrator.up();
    console.log('All migrations, including 090, passed on a fresh disposable database.');
    const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--config', 'test/jest.config.cjs', '--runInBand', 'test/integration/lecturer-payment-postgres.spec.ts', 'test/integration/lecturer-payment-batch-postgres.spec.ts'], {
      cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: uri.toString(), RUN_LECTURER_PAYMENT_DB_TESTS: 'true', NODE_ENV: 'test' },
    });
    process.exitCode = result.status ?? 1;
  } finally {
    await db.close();
    if (created) await admin.query(`DROP DATABASE "${testName}"`);
    await admin.close();
  }
})().catch(error => { console.error(error.original?.message || error.message); process.exitCode = 1; });
