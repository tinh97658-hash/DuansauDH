# Sửa CI nhánh tinh10 ngày 04/11/2026

Run lỗi: https://github.com/tinh97658-hash/DuansauDH/actions/runs/41818459134

## Nguyên nhân và bản sửa

CI dừng ở bước `Audit all dependency trees`. Audit lại từ lockfile xác nhận:

| Gói | Thay đổi | Advisory |
| --- | --- | --- |
| Joi | 17.13.8 → 17.13.9 | [GHSA-4528-x5fx-h6hg](https://github.com/advisories/GHSA-4528-x5fx-h6hg) |
| Vite | 6.4.4 → 6.4.5 | [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj) |
| minimatch | Override bản vá 11.0.1 cho backend và frontend | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| glob từ 9 trở lên | Override 14.0.3 cho backend | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) |

Nâng Nest CLI lên 12.0.11 và test-exclude lên 8 để dùng bộ công cụ mới;
runtime Nest vẫn ở nhánh 11. Project dùng trình biên dịch TypeScript mặc định,
không cấu hình webpack/rspack. Lockfile được kiểm tra bằng cài mới `npm ci`.
Việc nâng major ở bộ công cụ cần xem xét khi thay đổi builder trong tương lai.

Sau audit, chạy tiếp các bước CI phát hiện hai vấn đề sẵn có trong test:

- E2E `learner-data-access` thiếu mock provider `LecturerPaymentService` và
  `SchedulingService` sau khi constructor `ReportsController` được mở rộng.
  Bổ sung provider trong test module; giữ nguyên guards và các kiểm tra HTTP.
- Ba test dashboard kỳ vọng đơn vị lớp ở nhóm cảnh báo buổi học. Cập nhật test
  để kiểm tra đúng tổng lớp, số buổi và liên kết theo từng nhóm.

## Kiểm chứng và phạm vi

- Giữ nguyên workflow và ngưỡng audit. Root/frontend/production backend không
  còn finding; backend dev còn các finding mức thấp liên quan deepmerge, được
  workflow cho phép từ trước.
- `npm ci` backend và `npm ci --ignore-scripts` frontend cài lại thành công.
- Build backend và frontend thành công.
- Script `security-review/verify-postgres.cjs` qua trên container PostgreSQL 16
  tạm, gồm migration từ database mới và kiểm tra thu hồi phiên/reset mật khẩu.
- Bộ 32 test dashboard và 120 test backend liên quan qua sau sửa.
- Toàn bộ backend: 81 suite qua, 1.248 test qua; 18 suite/278 test yêu cầu
  môi trường riêng được skip theo cấu hình sẵn có. Typecheck qua.

Theo Security Fixer Policy của skill dependency-scanning, các bản vá trong cùng
major là auto-fix; nâng major công cụ là assisted-fix trong phạm vi người dùng
đã yêu cầu sửa CI và đẩy nhánh. Bằng chứng review là audit, lockfile, build,
test và database tạm; không thay chính sách phân quyền hay cấu hình production.

Rollback: revert commit sửa CI rồi chạy `npm ci` lại trong backend/frontend.
Thao tác này đưa dependency và test fixture về phiên bản trước, đồng thời cũng
khôi phục các cảnh báo audit đã khiến CI lỗi. Không cần rollback dữ liệu vì
bản sửa không thêm migration hay chỉnh dữ liệu ứng dụng.
