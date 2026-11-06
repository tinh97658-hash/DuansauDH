# Xác nhận chuỗi CI ngày 06/11/2026

## Phạm vi và nguyên nhân

Workflow `Security checks / dependencies-and-regressions` có nhiều bước nối tiếp. Lỗi test backend trước đó đã được sửa trong commit `41699d5`; bước kế tiếp lộ lỗi khi chạy migration trên database trống.

Migration `094-working-profiles-permission-tree` yêu cầu có nhân sự với đầy đủ quyền quản trị, dù cài mới chưa tạo tài khoản nào và tài khoản chỉ được seed sau khi migration hoàn tất. Vì vậy database PostgreSQL tạm của CI thất bại trước khi chạy các bước frontend.

## Bản sửa

- Migration 094 cho phép bảng `staff` trống. Khi đã có nhân sự, vẫn yêu cầu quản trị đang hoạt động, vai trò đang hoạt động, không chỉ đọc, có đủ năm quyền quản trị đã quy định.
- `security-review/verify-postgres.cjs` dùng cùng câu SQL bảo vệ của migration để kiểm tra bốn trạng thái: chưa có nhân sự; có nhân sự nhưng không có quản trị; có quản trị hợp lệ; quản trị bị vô hiệu hóa. Hai trạng thái không có quản trị hợp lệ trên database có nhân sự phải bị từ chối.
- Khi migration thất bại, trình kiểm chứng in dòng `MigrationError` ra CI thay vì chỉ báo tên file log. SQL chi tiết vẫn nằm trong log riêng.

## Kiểm tra bảo mật trong phạm vi bản sửa

Ngôn ngữ: TypeScript và JavaScript, NestJS/Sequelize/PostgreSQL. Ranh giới tin cậy: kết nối migration có quyền DDL và dữ liệu phân quyền hiện có trong database. Không có đầu vào HTTP mới, API mới, tài khoản mặc định hoặc quyền mới được cấp bởi bản sửa.

Phân loại theo Security Fixer Policy: thay đổi điều kiện chặn migration liên quan phân quyền, cần người quản lý repository xem diff trước khi merge. Người dùng đã yêu cầu sửa toàn bộ chuỗi CI; bản sửa được chuẩn bị và kiểm chứng trong workspace, chưa tự merge hay triển khai.

| ASVS 4.0.3 | Phạm vi kiểm tra | Bằng chứng |
| --- | --- | --- |
| V4 — Access Control | Database có nhân sự vẫn bị chặn nếu thiếu quản trị hợp lệ | Kiểm tra thực trên PostgreSQL tạm trong verifier |
| V3 — Session Management | Reset mật khẩu và đổi mật khẩu tiếp tục thu hồi phiên cũ | Các assertion sessionVersion / deserialize trong verifier |
| V7 — Error Handling and Logging | Hiển thị nguyên nhân migration, không in toàn bộ SQL vào console | Chỉ lấy dòng MigrationError; toàn bộ kiểm tra dùng dữ liệu tổng hợp |

Không thay đổi điều kiện kiểm tra quyền ở API hoặc bỏ qua bước CI nào. Với database đã chạy migration 094, Umzug không chạy lại migration đó.

Rollback mã nguồn khi chưa commit: khôi phục hai file `backend/src/database/migrations/094-working-profiles-permission-tree.ts` và `security-review/verify-postgres.cjs` từ HEAD sau khi bảo toàn thay đổi đang cần giữ. Không chạy `down` trên database thật: migration này vốn không hỗ trợ đảo ngược mô hình phân quyền. Các database/container kiểm chứng đều riêng biệt và chỉ chứa dữ liệu tổng hợp.

## Môi trường kiểm chứng

- PostgreSQL 16 trong container riêng, không dùng database ứng dụng.
- Linux với image Node 22; cài lại dependency từ lockfile bằng đúng các lệnh `npm ci` của workflow.
- Chạy lần lượt audit, build backend, toàn bộ test backend mặc định, verifier PostgreSQL, toàn bộ test frontend với hai worker và build frontend.
- Các bộ test PostgreSQL tùy chọn vẫn theo cơ chế bật/tắt của repository; không coi các bài bị skip là đã chạy.

Kết quả cuối được bổ sung sau khi hoàn tất toàn chuỗi.
