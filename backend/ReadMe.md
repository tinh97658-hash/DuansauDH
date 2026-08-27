# NestJS API

Backend là một ứng dụng NestJS độc lập, được build hoàn toàn từ thư mục `src` bằng Nest CLI.

## Cấu trúc

- `auth`: Passport local/Google, session serializer và các route xác thực.
- `students`: DTO, controller, service và repository học viên.
- `staff`: service/repository nhân sự và nghiệp vụ quản trị.
- `management`: API dashboard, duyệt học viên và review.
- `database`: cấu hình Sequelize, model, migration và admin seed.
- `notifications`: gửi email và thông báo nền.
- `common`: guards, decorator, filter và cấu hình upload dùng chung.
- `health`: liveness và readiness endpoint.

## Lệnh chính

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run db:migrate
npm run dev
```

Production chạy mã đã build:

```powershell
npm run build
npm start
```

Schema không được tạo bằng `synchronize`; mọi thay đổi database phải đi qua migration trong
`src/database/migrations`.
