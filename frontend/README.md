# Frontend

React 18 + Vite 6 + Material UI. The dev server và bản build đọc biến môi trường từ `.env` ở thư mục gốc dự án (không phải `frontend/.env`).

## Cài đặt

```bash
npm ci
```

## Chạy dev

```bash
npm run dev
```

Mặc định chạy ở `http://localhost:3100` (đổi bằng `WEB_PORT`). API URL lấy từ `REACT_APP_API_URL`, mặc định `http://localhost:3001`.

## Kiểm thử

```bash
npm test          # chạy toàn bộ test một lần
npm run test:watch
```

Vitest dùng jsdom. Số worker được giới hạn trong `vite.config.js` để tránh timeout giả do tranh bộ nhớ khi chạy cả bộ test.

## Build

```bash
npm run build
npm run preview
```

Kết quả build nằm trong `dist/`. Các thư viện xuất file nặng (`pdfmake`, `exceljs`, `docx`) được nạp theo nhu cầu ở thao tác xuất file.

## Cấu trúc chính

- `src/features/attendance`: điểm danh khuôn mặt, kiosk, đăng ký mẫu.
- `src/pages`: các trang theo nhóm chức năng.
- `src/test/integration`: test tích hợp UI.
- `src/test/unit`: test logic thuần.
