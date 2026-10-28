# Phân quyền lịch học, thi và điểm — quy tắc mới

Cập nhật 28/10/2026 theo yêu cầu: **mọi quyền thuộc Lớp học phần & xếp lịch hoặc Thi & điểm tự động có phạm vi Toàn viện**. Quy tắc này thay thế kế hoạch chọn phạm vi theo phân công, lớp liên quan và gửi điểm theo nhóm trước đây.

## Quyền và phạm vi

| Quyền đã được cấp | Phạm vi tự động | Hành động |
| --- | --- | --- |
| scheduling.view | Toàn viện | Xem lớp học phần, lịch học và lịch thi |
| scheduling.write | Toàn viện | Xếp, sửa, xác nhận lịch học và lịch thi; hoàn thành giảng dạy |
| scheduling.organize | Toàn viện | Tổ chức lớp học phần theo điều kiện nghiệp vụ |
| scheduling.assign | Toàn viện | Phân công đầu mối lịch |
| gradebook.view | Toàn viện | Xem danh sách thi, điểm và lịch thi |
| gradebook.submit | Toàn viện | Nhập và gửi duyệt điểm |
| gradebook.approve | Toàn viện | Duyệt và mở lại theo quy trình |
| gradebook.policy | Toàn viện | Cấu hình quy chế điểm |
| studyleave.manage | Toàn viện | Xử lý bảo lưu |

Phạm vi được suy ra từ từng quyền thực sự được cấp qua vai trò đang hoạt động. Không cấp thêm quyền hành động, không dựa vào tên vai trò. Người không phụ trách nhóm nào vẫn sử dụng được quyền đã cấp trên toàn viện. Giao diện quản lý vai trò bỏ ô chọn phạm vi.

Chỉ có quyền xem không được sửa; quyền nhập không bao gồm duyệt; quyền lịch không bao gồm nhập điểm. Quyền xem để mở trang vẫn cấp riêng. Khóa **Chỉ xem** từ bất kỳ vai trò đang hoạt động nào luôn chặn ghi. Các điều kiện trạng thái lớp, trùng phòng/giảng viên/học viên, phiên bản dữ liệu và quy trình duyệt vẫn áp dụng.

Các màn hình trên hiện phục vụ lớp học phần Thạc sĩ; quy tắc không tự mở quyền nghiệp vụ Tiến sĩ. Phân công nhóm và khóa xem/sửa theo nhóm tiếp tục áp dụng cho hồ sơ, nhóm lớp và báo cáo qua API tương ứng. Dữ liệu học viên cần cho lịch, thi, điểm được đọc trong ngữ cảnh nghiệp vụ đó; không cho sửa hồ sơ qua API điểm.

## Thực hiện

- Resolver RBAC và API vai trò tự suy ra `institution`; scope cũ hoặc gửi từ client không quyết định quyền.
- Interceptor chọn ngữ cảnh nghiệp vụ từ đường dẫn phía server. PostgreSQL RLS kiểm tra tài khoản, vai trò và quyền thật; mở phạm vi chỉ trong ngữ cảnh lịch/thi/điểm/bảo lưu tương ứng.
- Giao dịch dùng khóa và kiểm tra quyền ghi mới; không tin thông tin actor hoặc scope từ body.
- Trigger chặn đổi nhóm lớp, hồ sơ và dữ liệu giảng dạy qua API điểm. Quyền duyệt tiếp tục được kiểm tra riêng.
- Giữ gửi/duyệt toàn lớp theo quy trình hiện tại, không triển khai gửi điểm theo nhóm.
- Migration 084 chuyển scope của các quyền đã cấp sang `institution`, ghi audit, không thêm role_permission.

## Chạy migration

Build backend rồi dùng `node backend/scripts/rollout-scheduling-scopes.cjs --apply`. Script sao lưu trước khi áp dụng các migration 082/083/084 còn thiếu. Không phát lại toàn bộ migration cũ khi ledger local thiếu lịch sử. Bản sao lưu và báo cáo nằm trong `.tmp/scheduling-scopes-rollout/`.

## Kiểm chứng

Kiểm thử bao gồm UI không còn chọn scope; tài khoản không phụ trách nhóm đọc/sửa lịch và nhập điểm ngoài nhóm; quyền duyệt độc lập; thu hồi quyền, tắt vai trò, khóa Chỉ xem; không sửa hồ sơ/nhóm lớp qua API điểm; chống trùng lịch và xử lý phiên đồng thời; hoàn thành giảng dạy và giữ nguyên quy trình điểm toàn lớp.

Xem `docs/scheduling-permission-verification.md` để biết lệnh kiểm thử và giới hạn môi trường.
