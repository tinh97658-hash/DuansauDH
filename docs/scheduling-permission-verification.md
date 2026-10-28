# Kiểm chứng phạm vi tự động Toàn viện — 28/10/2026

Quy tắc mới thay thế scope theo phân công trong phiên bản 082/083. Mỗi quyền thực sự được cấp thuộc lịch học hoặc thi/điểm có scope `institution`; không cấp thêm hành động. Áp dụng cả vai trò cũ, vai trò mới và tài khoản không phụ trách nhóm.

## Kiểm thử

- Backend unit và e2e: `npm test --prefix backend -- test/unit test/e2e --silent`.
- PostgreSQL/HTTP trên DB riêng: `node backend/test/run-scheduling-scope-db.cjs --runTestsByPath test/integration/scheduling-scopes-postgres.spec.ts test/integration/group-scope-postgres.spec.ts test/integration/scheduling-postgres.spec.ts test/integration/study-leaves-postgres.spec.ts`.
- Frontend: `npm test --prefix frontend -- --run src/test/integration/Roles.test.jsx src/test/integration/RibbonPermissions.test.jsx src/test/integration/ExamSchedule.test.jsx`.
- Build: `npm run build --prefix backend` và `npm run build --prefix frontend`.

Các ca mới kiểm tra quyền không có scope cũ vẫn Toàn viện, scope client cũ bị bỏ qua, tài khoản không phân công xem toàn bộ lớp ghép và lưu điểm cho cả hai nhóm qua HTTP, thiếu quyền duyệt bị 403, bật Chỉ xem chặn lưu. RLS tiếp tục chặn sửa hồ sơ/nhóm lớp/giảng dạy qua ngữ cảnh điểm; không mở thêm nghiệp vụ Tiến sĩ. Các ca ngoài ngữ cảnh lịch/điểm tiếp tục kiểm tra giới hạn nhóm cũ.

## Rollout

`node backend/scripts/rollout-scheduling-scopes.cjs --apply` sao lưu DB rồi áp dụng riêng migration còn thiếu trong 082/083/084. Báo cáo trong `.tmp/scheduling-scopes-rollout/`; migration 084 ghi audit chuyển chính sách, không thay danh sách quyền hành động. Không đổi scope về phiên bản 0 để rollback vì resolver mới luôn tự xác định Toàn viện; cần thay đổi chính sách rõ ràng và đối chiếu dữ liệu.

## Giới hạn kiểm thử mở rộng

Bộ `exam-workflow-postgres` có bước tự tạo migration 066 nên không chạy nguyên trạng trên DB đã có toàn bộ schema (báo bảng đã tồn tại). Bộ `exam-arrangements-postgres` cần `TEST_DATABASE_URL` riêng. Khi mở rộng kiểm thử trên DB scope hiện tại, bộ retake còn một ca lệch trạng thái hồ sơ đầu vào (`Đã trúng tuyển` so với `Nộp hồ sơ đầu vào`), ngoài thay đổi scope. Các lỗi này được ghi nhận riêng, không tính là kiểm thử scope đã đạt.

## Kết quả lượt kiểm tra này

- 1.134 unit/e2e backend đạt; 72 ca PostgreSQL/HTTP liên quan đạt; 137 ca frontend liên quan đạt.
- Backend và frontend build thành công. Các giới hạn của lượt mở rộng nêu trên vẫn được ghi nhận.
- Local đã áp dụng 084 sau backup `before-084-2026-10-28T09-46-19-056Z.dump`; không thêm quyền hành động. Backend được khởi động lại, health ready trả 200; Vite cổng 3100 trả 200.
- Đọc lớp CKTM + QLSX qua service thật: quyền đang được cấp cho tài khoản kiểm tra cho phép sửa lịch, tổ chức lớp và hoàn thành giảng dạy; vẫn giữ trạng thái active, 1 buổi held + 3 buổi planned; không ghi dữ liệu nghiệp vụ trong bước xác minh local.
