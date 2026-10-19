# Backend test suite

- `unit/`: pure logic, DTOs and isolated guards/services.
- `integration/`: collaboration between application components with external adapters mocked.
- `e2e/`: HTTP contracts through a real Nest application instance.

Tests must be deterministic and must not use production credentials or production data. Put reusable builders and fakes in `fixtures/` when the suite grows. Database integration tests should use a disposable PostgreSQL instance and clean their own records.

Run from `backend/`:

```powershell
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:ci
```

Regression tests for learner data access run with `npm run test:e2e` and use a real Nest HTTP app with mocked services, without a database.

To check attempt ordering across reports, learning results, credits and retakes, use a disposable PostgreSQL instance (no migrations needed):

```powershell
$env:RUN_POSTGRES_REPORT_TESTS = 'true'
$env:TEST_DATABASE_URL = 'postgres://test_user:test_password@127.0.0.1:TEST_PORT/test_db'
npm test -- --runTestsByPath test/integration/exam-attempt-order-postgres.spec.ts test/integration/class-score-summary-postgres.spec.ts
```

These suites create connection-local temporary tables and roll back their fixtures. The attempt-order suite requires an explicit `TEST_DATABASE_URL`; the report suite also accepts it instead of local `.env` settings.

To check account and role administration (RBAC) against a database already migrated to 062/063, use a disposable PostgreSQL instance with the application schema:

```powershell
$env:RUN_POSTGRES_ACCOUNT_TESTS = 'true'
npm test -- --runTestsByPath test/integration/accounts-roles-postgres.spec.ts
```

This suite boots a real Nest application context (using `.env` settings), forces every query into a single rolled-back transaction and asserts the `auth_audit_logs` entries plus, when the `db_change_logs` table from migration 063 exists, the trigger-captured changes.

