# Chuyên viên phụ trách và khóa quyền theo nhóm

Mỗi nhóm học viên có tối đa một chuyên viên phụ trách; một chuyên viên có thể phụ trách nhiều nhóm. Tài khoản phải đang hoạt động. Các nhóm có sẵn được giữ nguyên và hiển thị **Chưa phân công** cho đến khi người có quyền phân công lựa chọn người phụ trách.

## Thao tác

1. Tạo tài khoản ở **Tài khoản & phân quyền → Tài khoản nhân sự**.
2. Tạo hoặc chọn vai trò ở **Vai trò & phân quyền**, cấp các quyền nghiệp vụ cần thiết.
3. Cấu hình ba khóa ở phần **Khóa quyền theo nhóm học viên**, rồi chọn **Lưu quyền**.
4. Ở **Đào tạo Thạc sĩ → Tạo nhóm học viên**, dùng cột **Chuyên viên phụ trách → Phân công** cho nhóm chưa có người phụ trách. Muốn đổi chuyên viên đã phân công, mở **Chỉnh sửa nhóm học viên**, chọn người mới rồi bấm **Lưu nhóm**. Cần quyền **Phân công chuyên viên phụ trách nhóm** (`groups.assign`). Khi tạo nhiều nhóm, lựa chọn chuyên viên áp dụng cho tất cả nhóm trong lần tạo đó.

Các khóa đều mặc định **tắt**, kể cả với vai trò mới. Không có quy tắc tự giới hạn vì tài khoản là chuyên viên hoặc vì người đó đã tạo nhóm.

| Cấu hình | Bật | Tắt |
| --- | --- | --- |
| Chỉ xem — khóa mọi thao tác sửa | Chặn thao tác ghi trong các API học vụ, kể cả nhóm mình phụ trách và thao tác phân công | Cho phép thao tác theo quyền nghiệp vụ và các khóa còn lại |
| Chỉ xem nhóm được phân công phụ trách | Chỉ xem nhóm mình phụ trách, hồ sơ học viên, điểm và báo cáo liên quan; ẩn cả dữ liệu chưa có nhóm | Xem mọi nhóm nếu đã có quyền xem nghiệp vụ |
| Chỉ sửa nhóm được phân công phụ trách | Chỉ ghi dữ liệu trong phạm vi nhóm mình phụ trách | Được sửa nhóm khác nếu đã có quyền sửa nghiệp vụ |

Ví dụ: muốn chuyên viên **xem tất cả, chỉ sửa nhóm mình phụ trách**, cấp quyền xem/sửa nghiệp vụ, chỉ bật khóa **Chỉ sửa nhóm được phân công phụ trách**. Muốn **xem tất cả và không sửa**, bật **Chỉ xem — khóa mọi thao tác sửa** và tắt khóa giới hạn xem.

Khóa không tự cấp quyền nghiệp vụ. Một người có nhiều vai trò nhận hợp các quyền nghiệp vụ; khóa bật ở **bất kỳ vai trò đang hoạt động nào** đều có hiệu lực. Khóa **Chỉ xem** luôn ưu tiên. Nếu giới hạn xem đã bật, việc tắt giới hạn sửa không cho phép sửa dữ liệu vốn không được xem. Thay đổi vai trò có thể cần tối đa 30 giây để hết cache; tải lại trang để cập nhật các nút thao tác.

Khi có khóa theo nhóm, một lớp học phần hoặc đợt bố trí thi chứa dữ liệu nhiều nhóm chỉ được truy cập khi **tất cả** các nhóm và học viên liên quan đều thuộc phạm vi cho phép. Nhật ký toàn hệ thống bị chặn khi bật giới hạn xem vì có thể chứa bản chụp dữ liệu ngoài nhóm. Dữ liệu tuyển sinh chưa được phân vào nhóm cũng nằm ngoài phạm vi của người bị giới hạn xem.

## Quyền lớp học phần và lịch

Quyền vai trò quyết định thao tác; cờ người phụ trách lịch (`canManageScheduling`) chỉ ghi nhận trách nhiệm, không cấp hoặc chặn quyền sửa.

| Quyền | Thao tác |
| --- | --- |
| `scheduling.view` | Xem lớp học phần và lịch |
| `scheduling.organize` — Tổ chức lớp học phần | Tạo, quản lý, xóa lớp; cập nhật nhóm, học viên và ghi chú lớp |
| `scheduling.write` — Xếp, sửa và xác nhận lịch | Tạo, sửa, xóa buổi học; xác nhận và quản lý lịch |
| `scheduling.assign` | Phân công người phụ trách lịch, không tự cấp quyền sửa lịch |

Muốn vừa quản lý lớp vừa xếp lịch, cấp cả `scheduling.organize` và `scheduling.write`, cùng quyền xem. Các khóa theo nhóm vẫn áp dụng; bật **Chỉ xem** sẽ chặn thao tác ghi dù đã cấp quyền nghiệp vụ.

## Triển khai và kiểm thử

Chạy `npm --prefix backend run db:migrate` và khởi động lại backend. Migration 077 bổ sung chuyên viên phụ trách, các cờ khóa trên vai trò và quyền `groups.assign` (cấp ban đầu cho vai trò `admin`). Migration 078 bổ sung PostgreSQL row level security trên các bảng học viên, nhóm, điểm, lịch và các bảng liên quan; các view dùng `security_invoker` để báo cáo và SQL trực tiếp tuân theo cùng phạm vi.

Chỉ các truy vấn HTTP có ít nhất một khóa đang bật mới chạy dưới role PostgreSQL `pgsms_group_scoped` bằng `SET LOCAL ROLE` trong transaction. Role này không đăng nhập và không được bypass RLS. Context dùng AsyncLocalStorage, không tồn tại trên connection sau commit/rollback. Migration/seed ngoài HTTP và các vai trò không bật khóa giữ nguyên cách hoạt động. Tài khoản chạy migration cần quyền tạo role/cấp membership (cấu hình PostgreSQL cục bộ hiện tại đáp ứng).

Khi thêm bảng hoặc view mới có dữ liệu học viên, phải bổ sung policy/phân quyền tương ứng trong migration. Không dùng security-definer view để trả dữ liệu học viên cho HTTP. Các hàm kiểm tra phạm vi hiện tại dùng `SECURITY DEFINER` với `search_path` cố định và chỉ trả boolean hoặc ID lớp học phần phục vụ policy, không trả nội dung hồ sơ.

Bộ kiểm thử PostgreSQL: tạo database riêng `pgsms_group_scope_test` đã migrate, đặt `DATABASE_URL`/`POSTGRES_DB` trỏ đến database đó và `RUN_GROUP_SCOPE_POSTGRES_TESTS=true`, rồi chạy `npm --prefix backend test -- group-scope-postgres`. Test từ chối chạy nếu không trỏ đúng database kiểm thử. Không chạy các fixture trên database sử dụng thực tế.
