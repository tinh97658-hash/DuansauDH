# Kiểm thử backend

Backend dùng Jest, `ts-jest` và chia test theo phạm vi trong thư mục `test/`:

- `unit/`: DTO, guard và logic thuần, không truy cập hạ tầng.
- `integration/`: kiểm tra nhiều thành phần phối hợp, mock các adapter bên ngoài.
- `e2e/`: kiểm tra contract HTTP qua một Nest application thực.

Chạy từng tầng hoặc toàn bộ test:

```powershell
npm run test:unit
npm run test:integration
npm run test:e2e
npm test
```

Chạy chế độ watch, báo cáo coverage hoặc pipeline CI:

```powershell
npm run test:watch
npm run test:coverage
npm run test:ci
```

Kiểm tra kiểu dữ liệu và production build:

```powershell
npm run typecheck
npm run build
```

Sau khi PostgreSQL hoạt động, kiểm tra migration và readiness:

```powershell
npm run db:migrate:status
Invoke-RestMethod http://localhost:3001/health/ready
```
