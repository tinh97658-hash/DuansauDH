# Frontend

React 18, Vite và Vitest. Cấu hình development nằm trong `.env` ở gốc repository.

Chạy từ thư mục gốc:

```powershell
npm --prefix frontend ci
npm run dev:frontend
npm run build:frontend
npm run test:frontend
```

Bản build nằm trong `frontend/dist/`. `npm --prefix frontend run preview` chỉ
dùng kiểm tra local. Các biến `REACT_APP_*` được thay thế lúc build;
không đưa bí mật vào biến frontend. Docker build dùng URL API `/api`.

Production phục vụ file tĩnh bằng Nginx và chuyển `/api/` tới backend.
Xem [hướng dẫn triển khai](../docs/deployment.md) và [README chính](../README.md).
