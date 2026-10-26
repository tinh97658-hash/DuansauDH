# Buổi thi ghép

Màn hình Xếp lịch thi có nút **Tạo buổi thi ghép**. Chọn ngày, buổi,
phòng và giám thị, thêm lớp học phần vào từng đợt rồi lưu. Có thể mở
luồng này từ hộp xếp lịch một môn bằng **Ghép học phần / thêm đợt thi**.

- Trong một đợt, các nhóm bắt đầu cùng lúc và có thể kết thúc khác nhau.
- Đợt sau bắt đầu khi tất cả nhóm đợt trước đã kết thúc.
- Sáng: 08:00–12:00; chiều: 14:00–18:00.
- Giờ Việt Nam: từ 08:01 không được ghép vào buổi sáng cùng ngày, từ 14:01 không được ghép vào buổi chiều cùng ngày. Thao tác xếp mới tại ô lịch đã khóa được ẩn; lịch đã xếp vẫn xem được. Nút tạo buổi ghép nằm cạnh tiêu đề và mặc định chọn buổi còn mở gần nhất, hoặc sáng ngày mai khi cả hai buổi hôm nay đã khóa. Máy chủ kiểm tra lại mốc khóa trước khi lưu.
- Đơn vị và giám thị cho phép chọn từ danh sách hoặc nhập tên bên ngoài. Thông tin bên ngoài được lưu riêng trên lịch thi, không tạo giảng viên trong danh mục; kiểm tra trùng giờ theo tên giám thị và đơn vị sau khi chuẩn hóa chữ hoa/thường và khoảng trắng.
- Chạy migration `069-external-exam-invigilators` trước khi sử dụng phần nhập giám thị bên ngoài.
- Sức chứa tính theo đợt đông nhất. Phòng và giám thị được giữ liên tục,
  gồm khoảng nghỉ giữa các đợt.
- Thí sinh không được thi hai môn giao giờ, kể cả cùng một người mang
  mã hồ sơ tuyển sinh và mã sinh viên khác nhau.
- Thêm hoặc chuyển môn vào đợt bị trùng giờ thí sinh sẽ bị chặn ngay và hiện cảnh báo vàng với số thí sinh trùng lịch (mỗi người tính một lần) và hướng dẫn chọn đợt hoặc giờ khác. Nếu đổi giờ gây trùng lịch, không được lưu cho đến khi xử lý hết xung đột.
- Danh sách lấy nguyên từ bản duyệt tư cách thi; không chia nhỏ danh sách.

Mở ô lịch để xem buổi, chọn **Chi tiết** của nhóm để hủy riêng hoặc mở
bảng điểm. Hủy cần lý do và chỉ thực hiện trước khi nhóm bắt đầu. Nhóm
khác giữ nguyên giờ, phòng, giám thị. Xác nhận đã thi/không diễn ra vẫn
theo từng nhóm; điểm và kết quả thuộc lớp học phần gốc.

Khi sửa buổi, các nhóm đã bắt đầu hoặc đã xác nhận bị khóa. Vẫn có thể
sửa thời gian nhóm chưa bắt đầu nhưng không đổi phòng, ngày hoặc giám thị
của buổi có nhóm bị khóa. Đổi giờ bắt đầu/chuyển đợt giữ nguyên thời lượng
nhóm đang sửa; các nhóm khác không tự dịch giờ.

## Cập nhật cơ sở dữ liệu

Chạy `npm --prefix backend run db:migrate` trước khi dùng backend mới.
Migration `068-exam-arrangements` bổ sung bảng buổi thi, mã buổi và số đợt
trên lịch thi. Mỗi lịch cũ trở thành một buổi có một đợt/một nhóm, giữ
nguyên mã lịch, danh sách, trạng thái và liên kết bảng điểm. Downgrade bị
chặn khi đã có lịch sử ghép hoặc thay đổi buổi.

## Kiểm thử

- Backend: `npm --prefix backend test -- test/unit/exam-arrangement.spec.ts test/unit/exam-confirmation.dto.spec.ts test/unit/exam-gradebook.service.spec.ts`.
- Frontend: `npm --prefix frontend test -- src/test/integration/ExamArrangements.test.jsx src/test/integration/ExamSchedule.test.jsx src/test/unit/examCalendar.test.js`.
- PostgreSQL: đặt `TEST_DATABASE_URL` trỏ đến database thử nghiệm và
  `RUN_POSTGRES_EXAM_ARRANGEMENT_TESTS=true`, chạy
  `npm --prefix backend test -- test/integration/exam-arrangements-postgres.spec.ts`.
  Bộ kiểm thử dùng schema riêng và tự dọn schema đó khi kết thúc.
