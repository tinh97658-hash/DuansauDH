// Creates and drops only a uniquely named disposable database. Never copies real data.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const base = path.resolve(__dirname, '../backend');
const { Client } = require(path.join(base, 'node_modules/pg'));
const envFile = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const name = 'pgsms_security_test_' + crypto.randomBytes(8).toString('hex');
const url = new URL('postgres://localhost');
url.hostname = process.env.DB_HOST; url.port = process.env.DB_PORT;
url.username = process.env.POSTGRES_USER; url.password = process.env.POSTGRES_PASSWORD;
url.pathname = '/postgres';
const admin = new Client({ connectionString: url.toString() });
let app, folder, created = false;
const originalCwd = process.cwd();
(async () => {
  assert.match(name, /^pgsms_security_test_[a-f0-9]{16}$/);
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true;
  url.pathname = '/' + name;
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url.toString() };
  const migrated = spawnSync(process.execPath, ['dist/database/migrate.js', 'up'], { cwd: base, env, encoding: 'utf8' });
  // Test DB contains no personal data; suppress credentials and SQL in console.
  fs.writeFileSync(path.join(__dirname, 'postgres-migrations-test.log'), (migrated.stdout || '') + (migrated.stderr || ''));
  assert.equal(migrated.status, 0, 'Disposable database migrations failed; inspect postgres-migrations-test.log');
  Object.assign(process.env, env);
  require(path.join(base, 'node_modules/reflect-metadata'));
  const { NestFactory } = require(path.join(base, 'node_modules/@nestjs/core'));
  const { AppModule } = require(path.join(base, 'dist/app.module'));
  const { Student } = require(path.join(base, 'dist/database/models/student.model'));
  const { Staff } = require(path.join(base, 'dist/database/models/staff.model'));
  const { StudentsService } = require(path.join(base, 'dist/students/students.service'));
  const { AccountsService } = require(path.join(base, 'dist/accounts/accounts.service'));
  const { AuthService } = require(path.join(base, 'dist/auth/auth.service'));
  const { UploadStorageService } = require(path.join(base, 'dist/students/upload-storage.service'));
  const bcrypt = require(path.join(base, 'node_modules/bcrypt'));
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const auth = app.get(AuthService);
  const hash = await bcrypt.hash('Synthetic-old-password', 4);
  const token = crypto.randomBytes(32).toString('hex');
  const student = await Student.create({ nameWithInitials: 'Test', fullName: 'Synthetic test', postalAddress: 'Test',
    email: 'test@example.invalid', telNo: '0000000000', password: hash, accountType: 'registered', approvalState: 'approved',
    passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'), passwordResetExpires: new Date(Date.now() + 60000) });
  assert.equal(student.sessionVersion, 0);
  assert.ok(await auth.deserialize(`student:${student.id}:0`));
  const resets = await Promise.allSettled([1, 2].map(() => app.get(StudentsService).resetPassword(token, 'Synthetic-new-password')));
  assert.equal(resets.filter(x => x.status === 'fulfilled').length, 1, 'Reset token must succeed exactly once under concurrency');
  assert.equal(await auth.deserialize(`student:${student.id}:0`), null);
  await student.reload(); assert.equal(student.sessionVersion, 1);
  await student.update({ approvalState: 'not approved' });
  assert.equal(await auth.deserialize(`student:${student.id}:1`), null);
  const staff = await Staff.create({ name: 'Synthetic', email: 'staff@example.invalid', role: 'admin', status: 'active', password: hash, mustChangePassword: true });
  await app.get(AccountsService).changeOwnPassword(staff, { currentPassword: 'Synthetic-old-password', newPassword: 'Synthetic-new-password' }, {});
  assert.equal(staff.sessionVersion, 1);
  assert.equal(await auth.deserialize(`staff:${staff.id}:0`), null);
  assert.ok(await auth.deserialize(`staff:${staff.id}:1`));
  folder = await fsp.mkdtemp(path.join(os.tmpdir(), 'pgsms-security-postgres-'));
  process.chdir(folder);
  const storage = app.get(UploadStorageService);
  const file = { originalname: 'test.pdf', buffer: Buffer.from('%PDF-synthetic'), mimetype: 'application/pdf' };
  let oldFile;
  for (let i = 0; i < 2; i++) await storage.replace(student.id, 'submission', file, async (_tx, filename) => {
    const previous = oldFile; oldFile = filename; return { oldFile: previous, value: undefined };
  });
  assert.deepEqual(await fsp.readdir(path.join(folder, 'public/submissions/submitted')), [oldFile]);
  console.log('PASS: fresh database migrations, atomic single-use reset, real session versions, withdrawn approval, Staff rotation, upload transaction/cleanup.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  process.chdir(originalCwd);
  if (app) await app.close();
  if (created) { assert.match(name, /^pgsms_security_test_[a-f0-9]{16}$/); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); }
  await admin.end();
  if (folder) {
    assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(folder).startsWith('pgsms-security-postgres-'));
    await fsp.rm(folder, { recursive: true, force: true });
  }
});
