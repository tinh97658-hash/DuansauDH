# Kiểm chứng cấu hình production — 06/11/2026

Phạm vi: cấu trúc repository, Git/Docker ignore, image ứng dụng và quy trình
khởi tạo bằng `compose.prod.yaml`. Không triển khai lên production thực tế.

## Kết quả

- Compose validate thành công; chỉ web publish lên loopback, API/DB không
  publish cổng host. Database/volume dùng project tạm `pgsms-prod-verify`.
- Backend và frontend Docker build thành công từ lockfile, bao gồm code đang
  có trong workspace và migration chưa commit tại thời điểm kiểm tra.
- 106 migration chạy thành công trên PostgreSQL trống, gồm 099 và 100.
- Trang gốc, route SPA `/procedure`, API liveness/readiness và auth capabilities
  trả HTTP 200 qua web Nginx. Index sử dụng assets do Vite build.
- Nginx kiểm tra cú pháp thành công. Database/API/web đạt healthcheck.
- File kiểm tra uploads tồn tại sau khi recreate API; node user ghi được volume.
- `seed-common` chạy lại không tạo thêm dữ liệu. Thử đổi mã chuyên ngành trong
  database tạm rồi seed lại: mã hiện hữu được giữ nguyên.
- `seed-auth` và `seed-admin` chạy thành công. Admin với email không hợp lệ
  thoát mã 1, không treo kết nối.
- Đăng nhập qua web với forwarded headers mô phỏng ingress HTTPS trả HTTP 200
  và session cookie có `Secure`. Chưa kiểm tra chứng chỉ/domain thực tế.
- Hai test script development tại root đều đạt. Diff các file sửa trong lượt
  này qua `git diff --check`; Git index không chứa file khớp ignore.

## Sửa lỗi phát hiện khi kiểm chứng

`seed-common` chưa khai báo `Major.code` bắt buộc trong schema hiện tại. Đã thêm
mã mặc định theo migration 042 cho bản ghi mới, giữ mã đã tồn tại và đóng app
trong `finally`. `seed-admin` cũng đóng app nếu validation cấu hình thất bại.
Không chạy seed hoặc migration vào database development/production đang có.

## Giới hạn và bước vận hành

Chưa chạy toàn bộ test nghiệp vụ/browser hoặc khôi phục backup trên máy chủ
thực tế. Chưa kiểm thử tải. Build frontend còn bundle lớn; npm trong build
backend báo 8 phát hiện mức low ở cây dependency có dev dependencies, cây
production báo 0 tại thời điểm build. Đây không phải audit toàn bộ image/host.

Người vận hành cần chốt commit/tag gồm đủ migration, điền env production,
cấu hình domain/HTTPS, kiểm chứng backup/restore và smoke test nghiệp vụ trước
khi mở dịch vụ. Các thay đổi có thể review từ Git diff; hướng dẫn triển khai
và rollback nằm trong [deployment.md](../deployment.md). Hoàn nguyên code seed
không tự xóa hoặc hoàn nguyên dữ liệu đã seed.
