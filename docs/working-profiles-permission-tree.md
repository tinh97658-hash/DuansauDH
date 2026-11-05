# Hồ sơ làm việc và cây phân quyền

Mỗi vai trò đang được gán cho nhân viên là một hồ sơ làm việc. Hồ sơ dùng UUID của vai trò, không liên kết bằng tên hiển thị. Phạm vi dữ liệu tiếp tục dựa trên lớp có `responsible_staff_id` của nhân viên; không tạo thêm mô hình đơn vị.

## Chọn hồ sơ

- Có một hồ sơ hợp lệ: tự chọn khi bắt đầu phiên.
- Có nhiều hồ sơ: bắt buộc chọn trước khi mở chức năng nghiệp vụ. Header hiển thị hồ sơ hiện tại và nút **Đổi phiên làm việc**.
- Backend chỉ dùng quyền và cờ phạm vi của hồ sơ đang chọn, không cộng quyền từ các vai trò khác.
- Hồ sơ đã chọn bị gỡ hoặc vô hiệu hóa: chặn nghiệp vụ và yêu cầu chọn lại; không tự chuyển sang hồ sơ khác.
- Hồ sơ được lưu trong session phía máy chủ. Header `X-Working-Profile-Id` chỉ phát hiện tab cũ sau khi đổi hồ sơ; không cấp quyền.

## Cấu hình quyền

Trang **Vai trò** có danh sách vai trò bên trái, cây **Module → Tab/Hành động** bên phải và hai cột **Xem / Ghi**.

- Bật module mở hộp gợi ý bật các tab xem; không tự cấp quyền ghi.
- Tắt module gỡ quyền con và làm mờ các lựa chọn con. Phải bật module trước khi chọn quyền con.
- Quyền ghi cần quyền xem liên quan. Một số quyền đọc được dùng chung giữa các module; tắt quyền đọc sẽ gỡ các hành động phụ thuộc.
- Backend kiểm tra cả module cha và quyền đọc phụ thuộc, kể cả khi gọi API trực tiếp.
- Đổi vai trò khi chưa lưu có ba lựa chọn: **Lưu & Chuyển**, **Bỏ qua thay đổi**, **Ở lại**. Lưu thất bại giữ nguyên màn hình và bản chỉnh sửa.
- Hồ sơ chỉ đọc bị chặn thao tác ghi ở backend. Không cho tự gỡ quyền quản lý vai trò hoặc gỡ hồ sơ đang dùng của chính mình; đồng thời phải còn ít nhất một hồ sơ quản trị đầy đủ trong hệ thống.

Vai trò mới mặc định giới hạn xem và sửa theo lớp phụ trách. Cờ phạm vi của các vai trò cũ được giữ nguyên. Với nhập điểm và lịch thi, chuyên viên có quyền chức năng được thao tác lớp phụ trách; lớp ghép được xem và thao tác toàn bộ khi phụ trách ít nhất một lớp thành phần. Xem thêm [nhập điểm](gradebook-permissions.md) và [lịch thi](exam-schedule-permissions.md).

### Quản trị viên không phụ trách lớp

Tài khoản phải được gán và chọn hồ sơ **Quản trị hệ thống**, mã `admin`. Chỉ đặt tên một vai trò tùy tạo là “Admin” không tạo quyền quản trị điểm/lịch thi toàn viện.

Trong trang Vai trò, chọn hồ sơ đó, bật đủ module và quyền xem/ghi cần thiết, chọn **Xem và sửa toàn viện** rồi lưu. Lựa chọn này tắt cả `restrictGroupView`, `restrictGroupEdit` và `groupReadOnly`. Không cần gán quản trị viên làm chuyên viên phụ trách của bất kỳ lớp nào. Quyền chức năng vẫn bắt buộc; mở phạm vi không tự cấp quyền.

Các lựa chọn nhanh còn lại là **Theo lớp phụ trách** (giới hạn cả xem và sửa, cho phép ghi khi có quyền) và **Chỉ đọc toàn viện** (mở phạm vi đọc hồ sơ/báo cáo, chặn ghi). Với hồ sơ không có mã `admin`, điểm và lịch thi vẫn giới hạn theo lớp phụ trách hoặc lớp ghép liên quan, kể cả khi mở phạm vi hồ sơ/báo cáo toàn viện.

## Cơ sở dữ liệu và nhật ký

Migration `094-working-profiles-permission-tree` thêm quyền module cha cho các quyền đã được cấp, không tự thêm quyền hành động hoặc quyền đọc còn thiếu. Quyền ghi cũ thiếu quyền đọc liên quan sẽ chưa có hiệu lực cho đến khi quản trị viên cấp đủ điều kiện.

`permission_requirements` liên kết điều kiện bằng UUID có khóa ngoại. SQL kiểm tra quyền theo hồ sơ đang chọn. Không có hồ sơ hợp lệ hoặc không có lớp phụ trách trong phạm vi giới hạn thì không mở rộng sang toàn viện.

Nhật ký lưu nhân viên, UUID và ảnh chụp tên hồ sơ; nhật ký thay đổi dữ liệu tiếp tục lưu bảng, khóa bản ghi và giá trị cũ/mới. Việc đổi hồ sơ có sự kiện `auth.profile.switch`. Nhật ký cũ không được suy đoán bổ sung hồ sơ.

Sau khi cập nhật mã nguồn, chạy `npm run db:migrate` từ thư mục gốc. Migration dừng và rollback nếu không còn nhân viên có một hồ sơ quản trị đầy đủ; cần điều chỉnh dữ liệu phân quyền trước khi chạy lại.
