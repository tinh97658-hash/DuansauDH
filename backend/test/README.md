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
