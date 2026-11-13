const { test } = require('node:test');
const assert = require('node:assert/strict');
const { adminUrl, discoverSuites, databaseName, suiteEnvironment } = require('./run-postgres-ci.cjs');

test('rejects application URLs and missing dedicated server configuration', () => {
  for (const url of [undefined, 'postgres://pgsms:secret@127.0.0.1:15432/pgsms',
    'postgres://pgsms_ci:secret@db.example.com:55440/pgsms_ci_control',
    'postgres://pgsms_ci:secret@127.0.0.1:55440/pgsms_ci_control?options=unsafe']) {
    assert.throws(() => adminUrl(url));
  }
  assert.equal(adminUrl('postgres://pgsms_ci:secret@127.0.0.1:55440/pgsms_ci_control').pathname, '/pgsms_ci_control');
});

test('discovers the guarded database suites, including migration and RLS tests', () => {
  const suites = discoverSuites();
  for (const name of ['lecturer-payment-details-migration.spec.ts', 'working-profiles-postgres.spec.ts',
    'exam-workflow-postgres.spec.ts', 'notification-inbox-postgres.spec.ts', 'recognition-curriculum-postgres.spec.ts']) {
    assert.ok(suites.some(suite => suite.name === name));
  }
  assert.ok(suites.length >= 30);
  assert.equal(new Set(suites.map(suite => suite.name)).size, suites.length);
});

test('overrides database targets and enables only the selected suite flags', () => {
  const suites = discoverSuites();
  const suite = suites.find(item => item.name === 'lecturer-payment-batch-postgres.spec.ts');
  const url = new URL('postgres://pgsms_ci:secret@127.0.0.1:55440/pgsms_lecturer_payment_test_123');
  const env = suiteEnvironment(url, suite, suites);
  assert.equal(env.DATABASE_URL, url.toString());
  assert.equal(env.TEST_DATABASE_URL, url.toString());
  assert.equal(env.POSTGRES_DB, 'pgsms_lecturer_payment_test_123');
  assert.equal(env.RUN_LECTURER_PAYMENT_DB_TESTS, 'true');
  assert.equal(env.RUN_GROUP_SCOPE_POSTGRES_TESTS, 'false');
  assert.equal(env.EMAIL_USERNAME, '');
  assert.equal(env.SESSION_COOKIE_SECURE, 'false');
  assert.equal(databaseName('working-profiles-postgres.spec.ts', 0), 'pgsms_group_scope_test');
  assert.match(databaseName(suite.name, 0), /^pgsms_lecturer_payment_test_\d+$/);
});
