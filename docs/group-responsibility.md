> Cập nhật 28/10/2026: Migration 084 và quy tắc mới trong `KE-HOACH-PHAN-QUYEN-LICH-HOC-VA-DIEM.md` thay thế mô tả scope lịch cũ bên dưới. Mỗi quyền đã cấp thuộc **Lớp học phần & xếp lịch** hoặc **Thi & điểm** tự động **Toàn viện**, không cần phân công nhóm. Khóa Chỉ xem vẫn chặn ghi. Phân công và khóa theo nhóm tiếp tục áp dụng cho hồ sơ, nhóm lớp và báo cáo. Những phần nói scope theo phân công, phiên bản tương thích hoặc giới hạn riêng supervisor là lịch sử trước 084.

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

Khóa không tự cấp quyền nghiệp vụ. Một người có nhiều vai trò nhận hợp các quyền nghiệp vụ; khóa bật ở **bất kỳ vai trò đang hoạt động nào** đều có hiệu lực đối với nghiệp vụ chưa chuyển đổi. Khóa **Chỉ xem** luôn ưu tiên, kể cả lịch học đã chuyển đổi. Request ghi tải lại quyền; tải lại trang để cập nhật các nút thao tác.

Với **điểm, lịch thi và các nghiệp vụ chưa chuyển đổi**, lớp học phần hoặc đợt bố trí thi nhiều nhóm vẫn cần **tất cả** nhóm và học viên liên quan thuộc phạm vi. Lịch học đã cấu hình phạm vi mới dùng quy tắc bên dưới. Nhật ký toàn hệ thống bị chặn khi bật giới hạn xem vì có thể chứa bản chụp dữ liệu ngoài nhóm. Dữ liệu tuyển sinh chưa được phân vào nhóm cũng nằm ngoài phạm vi của người bị giới hạn xem.

## Quyền lớp học phần và lịch

Quyền vai trò quyết định thao tác; cờ người phụ trách lịch (`canManageScheduling`) chỉ ghi nhận trách nhiệm, không cấp hoặc chặn quyền sửa.

| Quyền | Thao tác |
| --- | --- |
| `scheduling.view` | Xem lớp học phần và lịch |
| `scheduling.organize` — Tổ chức lớp học phần | Tạo, quản lý, xóa lớp; cập nhật nhóm, học viên và ghi chú lớp |
| `scheduling.write` — Xếp, sửa và xác nhận lịch | Tạo, sửa, xóa buổi học; xác nhận và quản lý lịch |
| `scheduling.assign` | Phân công người phụ trách lịch, không tự cấp quyền sửa lịch |

Muốn vừa quản lý lớp vừa xếp lịch, cấp cả `scheduling.organize` và `scheduling.write`, cùng quyền xem.

Từ migration **082** (bổ sung policy tổ chức lớp bằng **083**), chọn phạm vi riêng bên cạnh từng quyền lịch:

| Quyền | Theo phân công | Toàn viện |
| --- | --- | --- |
| Xem lịch | `related_offerings`: lớp học phần có ít nhất một nhóm đang phụ trách | `institution`: không cần phụ trách nhóm |
| Thao tác lịch | `related_offerings`: được sửa lịch chung, xác nhận buổi và hoàn thành giảng dạy của toàn lớp ghép | `institution`: không cần phụ trách nhóm |
| Tổ chức lớp | `assigned_groups`: phải phụ trách đủ mọi nhóm bị tác động | `institution`: không cần phụ trách nhóm |

Quyền xem phải bao phủ phạm vi thao tác. Quyền xem toàn viện không tự nâng quyền sửa theo phân công. Phạm vi mới không giao ngầm với hai khóa xem/sửa nhóm cũ; khóa **Chỉ xem** vẫn chặn mọi ghi. Không có bypass theo tên `admin`, người tạo lớp hay cờ đầu mối lịch.

Các vai trò cũ giữ `scheduling_scope_version=0` và chính sách tương thích, không tự được cấp Toàn viện. Khi đã đối chiếu tác vụ, chọn phạm vi cho **tất cả** quyền lịch đã cấp rồi lưu để chuyển vai trò sang phiên bản 1. Vai trò mới và quyền lịch cấp mới phải có phạm vi hợp lệ. Nút **Tất cả** chỉ chọn permission. Muốn quay lại chính sách cũ, quản trị viên có thể đặt lại version 0 cho các vai trò đã duyệt trong một transaction; không xóa bảng scope, điểm hay nhật ký.

Backend trả `canWriteSchedule`, `canOrganize`, `canCompleteTeaching` và lý do bị chặn. Xóa lịch và xóa lớp dùng capability khác nhau. Lớp có một buổi đã diễn ra và ba buổi chưa xác nhận vẫn phải xử lý đúng ba buổi đó; quyền mới không tự đóng lớp hoặc tự xóa lịch.

Kiểm tra trùng phòng, giảng viên, nhóm, học viên và sức chứa đọc đủ tài nguyên trong các hàm nội bộ chỉ trả số lượng hoặc mã xung đột. Không mở hồ sơ ngoài phạm vi, không trả snapshot điểm/ID học viên ẩn qua JSON lịch. Thay đổi lịch và audit actor, grant, nhóm, trạng thái, revision được ghi trong cùng transaction.

## Triển khai và kiểm thử

Với database sạch, dùng chuỗi migration thông thường. Với local đã có schema nhưng ledger thiếu lịch sử, **không chạy lại toàn bộ pending**. Chạy `npm --prefix backend run build`, sau đó `node backend/scripts/rollout-scheduling-scopes.cjs` để xuất bảng đối chiếu. Thêm `--apply` để sao lưu toàn database và chỉ chạy các migration 082/083 còn thiếu sau khi kiểm tra baseline 081; script không đổi scope của vai trò. Báo cáo và bản sao lưu nằm ở `.tmp/scheduling-scopes-rollout/`. Có thể đặt `PG_DUMP` nếu đường dẫn công cụ khác môi trường local.

Policy 083 cho phép người có quyền tổ chức lớp đọc roster tối thiểu cần cho dropdown, preview và học lại theo chính scope được cấp. Quyền chỉ thao tác lịch không kế thừa khả năng này. Các request lịch không được dùng cờ nhóm cũ để ghi hồ sơ, đổi thành viên nhóm hoặc ghi điểm; dữ liệu thuộc chương trình chưa hỗ trợ bị chặn cả ở SQL. Danh sách nhóm có `canOrganize` riêng để giao diện không cho chọn nhóm ngoài quyền.

Các request lịch luôn chạy dưới role PostgreSQL `pgsms_group_scoped`, kể cả không bật khóa nhóm. Các request khác giữ cơ chế cũ. Role này không đăng nhập và không được bypass RLS. Context dùng AsyncLocalStorage và `SET LOCAL`, không tồn tại trên connection sau commit/rollback. Transaction ghi lịch giữ khóa chia sẻ với thay đổi tài khoản/vai trò/phân công; quyền và quan hệ thật được kiểm tra lại trong database.

Khi thêm bảng hoặc view mới có dữ liệu học viên, phải bổ sung policy/phân quyền tương ứng trong migration. Không dùng security-definer view để trả hồ sơ học viên cho HTTP. Các hàm nội bộ lịch dùng `SECURITY DEFINER` với `search_path` cố định, chỉ trả quyết định quyền, số lượng, mã xung đột và metadata nhóm tối thiểu. Hàm lấy danh tính học viên phục vụ so trùng không được cấp `EXECUTE` cho role scoped.

Bộ kiểm thử PostgreSQL: tạo database riêng `pgsms_group_scope_test` đã migrate, đặt `DATABASE_URL`/`POSTGRES_DB` trỏ đến database đó và `RUN_GROUP_SCOPE_POSTGRES_TESTS=true`, rồi chạy `npm --prefix backend test -- group-scope-postgres`. Test từ chối chạy nếu không trỏ đúng database kiểm thử. Không chạy các fixture trên database sử dụng thực tế.

Chạy hồi quy lịch mới và cũ bằng `node backend/test/run-scheduling-scope-db.cjs test/integration/scheduling-scopes-postgres.spec.ts test/integration/group-scope-postgres.spec.ts test/integration/scheduling-postgres.spec.ts`. Script cố định database kiểm thử, chỉ thêm 082/083 nếu thiếu; `--refresh` chỉ phục vụ cập nhật hàm/policy trên database kiểm thử khi phát triển migration. Các ca gồm API thật, RLS SQL, hai người cùng sửa lịch ghép, người toàn viện không có phân công, phân quyền tách biệt, nguồn học viên, trùng tài nguyên ngoài phạm vi và hoàn thành lớp có ba buổi chưa xác nhận. Không chạy `--refresh` với môi trường vận hành.
