# Rà soát logic hệ thống — 07/11/2026

## Phạm vi và cách kiểm tra

Rà soát theo các luồng: đăng nhập/phân quyền/phạm vi nhóm phụ trách, hồ sơ tuyển sinh và học viên, nhóm/lớp, lịch học/lịch thi, điều kiện thi và tính điểm, bảo lưu, thanh toán giảng viên. Đối chiếu mã nguồn với các kiểm tra tự động sẵn có; với lỗi mới, viết kiểm tra tái hiện trước khi sửa.

Đây là kiểm tra trên mã nguồn và môi trường kiểm thử cục bộ, không phải chứng nhận toàn bộ hệ thống không còn lỗi. Không thay đổi bản ghi học viên hay dữ liệu nghiệp vụ trong database làm việc.

## Các lỗi đã xác nhận và sửa

### 1. Hồ sơ có thể bị tự thay điểm GPA khi lưu một trường khác

- Mức độ: trung bình, ảnh hưởng tính đúng đắn dữ liệu.
- Trong biểu mẫu sửa từ danh sách, GPA thiếu hoặc bằng số 0 bị thay bằng giá trị mẫu `3.20`. Ở trang chi tiết, số 0 bị chuyển thành rỗng.
- Tái hiện: mở hồ sơ có `gpa: 0`, chỉ sửa số điện thoại rồi lưu; yêu cầu cập nhật trước sửa chứa `gpa: "3.20"`.
- Sửa: giữ số 0, để trống khi không có GPA; chuyển giá trị sang chuỗi đúng hợp đồng API. Không thêm điểm mẫu vào hồ sơ đang sửa.
- Mã nguồn: `frontend/src/pages/plan/admissionRecords.jsx`, `frontend/src/pages/plan/admissionRecordDetail.jsx`.
- Kiểm tra mới bao phủ GPA dạng số 0, chuỗi `"0"` và giá trị null.

### 2. Tạo nhóm học viên có thể hiển thị dữ liệu của bộ lọc cũ

- Mức độ: trung bình, người dùng có thể nhìn nhầm phạm vi năm/ngành/trạng thái.
- Khi đổi bộ lọc nhanh, phản hồi cũ về chậm có thể ghi đè kết quả mới. Trạng thái đang tải và lỗi cũng có thể bị yêu cầu cũ thay đổi.
- Sửa: gắn phiên bản cho mỗi lần tải; chỉ yêu cầu mới nhất được cập nhật dữ liệu, lỗi và trạng thái tải. Hủy hiệu lực phản hồi khi đổi phạm vi hoặc rời trang.
- Mã nguồn: `frontend/src/pages/masters/createClassGroups.jsx`.
- Kiểm tra mới cố tình trả kết quả năm mới trước, rồi mới trả kết quả năm cũ.

### 3. Học bổ sung kiến thức có cùng lỗi phản hồi đảo thứ tự

- Mức độ: trung bình, danh sách và số liệu tổng hợp có thể không thuộc năm/ngành/trạng thái đang chọn.
- Sửa: bảo vệ phiên bản yêu cầu cho cả dữ liệu, tổng hợp, lỗi và trạng thái tải.
- Mã nguồn: `frontend/src/pages/masters/bridgeCourse.jsx`.
- Kiểm tra mới: `frontend/src/test/integration/BridgeCourseRequestOrder.test.jsx`.

## Kiểm tra và giới hạn

- Backend unit: **81 bộ, 1.126 kiểm tra đạt**.
- API/phân quyền và health: **10 bộ, 283 kiểm tra đạt**; dùng các thành phần giả trong kiểm thử, không thay thế kiểm tra PostgreSQL thực.
- Backend TypeScript: đạt.
- Build frontend production sau sửa: đạt. Còn cảnh báo kích thước bundle và module vừa import tĩnh vừa import động; đây không phải lỗi logic đã xác nhận.
- Frontend unit: **55 bộ, 425 kiểm tra đạt**.
- Kiểm tra luồng hồ sơ, xác nhận học phí hàng loạt, tạo nhóm và học bổ sung sau sửa: **4 bộ, 56 kiểm tra đạt** (bao gồm các kiểm tra hồi quy mới).
- Tổng các kiểm tra đạt trong các lượt xác minh cuối, không cộng trùng những lượt chạy lại: **1.890**.

Một số bài kiểm tra cũ cần đồng bộ với ứng dụng hiện tại: bổ sung danh mục năm đào tạo vào dữ liệu giả; kiểm tra sidebar hai vùng, trạng thái giữ menu khi chuyển trang, breadcrumb dạng nút; đối chiếu cơ chế tải nền có giới hạn 30 giây và giữ số chờ xác nhận cũ trong lúc tải lại. Các thay đổi này nằm trong bài kiểm tra, không đổi hành vi ứng dụng để ép kiểm tra đạt.

Chưa chạy các bộ tích hợp PostgreSQL cần bật biến `RUN_POSTGRES_*`, chưa kiểm thử toàn bộ thao tác thủ công trên bản deploy. Lượt chạy frontend toàn bộ ban đầu được dừng để tách các kiểm tra cũ bị lệch kỳ vọng; không tính lượt này là đạt toàn bộ frontend integration.

Log kiểm tra lưu trong `.tmp/logic-audit-*.log` tại workspace.
