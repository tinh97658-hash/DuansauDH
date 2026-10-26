# Bảo lưu và tiếp nhận học lại

Triển khai theo tài liệu `luồng bảo lưu.docx` người dùng cung cấp ngày 15/10/2026.

## Thao tác

- Mở hồ sơ học viên → tab **Bảo lưu** để tạo yêu cầu có lý do, ngày bắt đầu và ngày kết thúc; duyệt hoặc từ chối.
- Mục **Đào tạo thạc sĩ → Quản lý bảo lưu** (`/masters/study-leaves`) theo dõi toàn bộ yêu cầu, sắp hết hạn, quá hạn và gia hạn chờ duyệt. Mở hồ sơ từ mỗi dòng để xử lý.
- Chỉ quản trị viên thực hiện quyết định; tài khoản được phép xem hồ sơ có thể xem lịch sử.

## Quy tắc

- Từ 25/10/2026, thạc sĩ phải xác nhận đã nộp học phí nhập học mới là **Đang học** và được tạo/duyệt bảo lưu; phân lớp không tự làm người chưa đóng tiền thành Đang học. Người chưa đóng tiền muốn nghỉ dùng **Rút hồ sơ chưa nhập học** để rút lớp, về **Nộp hồ sơ đầu vào**, không tạo bảo lưu. Xem [quy tắc học phí và nhập học](TUITION-ENROLLMENT-POLICY.md).

- Chờ duyệt: giữ tên trong lớp và tiếp tục học. Ngay khi duyệt, rút khỏi danh sách các lớp học phần chưa hoàn thành, kể cả ngày bắt đầu bảo lưu còn ở tương lai. Trạng thái hồ sơ chuyển sang Đang bảo lưu từ ngày bắt đầu.
- Từ ngày hiệu lực: trạng thái **Đang bảo lưu**, giữ lớp hành chính, kết quả các lớp học phần đã hoàn thành. Dừng riêng lượt tham gia các lớp chưa hoàn thành, giữ điểm và lịch sử trong bản ghi dừng học phần. Không có nghiệp vụ chuyên cần.
- Lớp đã xác nhận hoàn thành trước thời điểm duyệt bảo lưu vẫn giữ tên học viên trong danh sách thi / bảng điểm, cả kết quả Đạt và Không đạt. Bảng điểm hiển thị trạng thái bảo lưu bên cạnh mã học viên. Lượt đã rút khỏi lớp khi duyệt không được khôi phục chỉ vì lớp cũ hoàn thành sau đó.
- Khi **duyệt bảo lưu cho học viên đã nộp học phí**, mọi lượt đã đăng ký vào lớp học phần nhưng chưa hoàn thành được ghi **Không đạt do bảo lưu**, kể cả chưa có lịch hoặc điểm, theo migration `061-study-leave-enrolled-attempts`. Giữ điểm và lịch sử, không tự điền 0; kết quả dừng học chỉ đọc và không tự thành Đạt khi lớp cũ hoàn thành sau đó. Chờ duyệt/từ chối chưa làm phát sinh kết quả này.
- Môn mở trong thời gian bảo lưu mà học viên chưa đăng ký chỉ là môn bỏ lỡ để bố trí sau. **Người chưa đóng tiền xin nghỉ không dùng bảo lưu**: rút hồ sơ về đầu vào, không tạo kết quả Không đạt do bảo lưu.
- Không đưa học viên đã được duyệt bảo lưu / quá hạn / thôi học vào lượt ghép lớp mới, kể cả chưa đến ngày bắt đầu. Lớp mở sau khi duyệt bảo lưu ghi nhận môn bị bỏ lỡ để bố trí khi học viên quay lại.
- Hạn bảo lưu bao gồm cả ngày kết thúc; quá hạn từ ngày kế tiếp theo múi giờ Việt Nam. Hệ thống đối soát trước các yêu cầu API về hồ sơ, đào tạo, xếp lịch và báo cáo, kể cả khi máy chủ ngừng hoạt động qua ngày hiệu lực. Không cần mở sẵn trình duyệt. Trạng thái lưu trong cơ sở dữ liệu được cập nhật khi có yêu cầu API tiếp theo.
- **Sắp hết hạn**: còn tối đa 30 ngày. Chưa áp giới hạn số lần / tổng thời gian gia hạn vì tài liệu chưa chốt.
- Yêu cầu gia hạn chờ duyệt giữ nguyên hạn cũ. Gia hạn được duyệt mới đổi hạn; từ chối giữ hạn cũ. Nếu đã quá hạn thì vẫn hiển thị quá hạn kèm gia hạn chờ duyệt.
- **Tiếp nhận học lại**: phải có xác nhận đã nộp học phí, quyết định có hiệu lực hôm nay và chuyển về **Đang học**. Môn dở dang / chưa bắt đầu / bỏ lỡ được đưa vào nhóm cần bố trí của lớp hành chính gốc, kể cả lớp học phần cũ vẫn hoạt động. Ghép lớp qua luồng tạo lớp học phần hiện có, học lại từ đầu và có điểm mới độc lập. Không tự quay lại lớp cũ.
- **Thôi học**: phải xác nhận quyết định và nhập thông tin quyết định. Không tự động thôi học khi quá hạn. Giữ hồ sơ, lớp hành chính, điểm hoàn thành và lịch sử.
- Khi tiếp nhận hoặc thôi học, yêu cầu gia hạn còn chờ được đóng và giữ lịch sử. Không cho xử lý lặp một quyết định đã kết thúc.
- Tạo / duyệt bảo lưu không hồi tố trước hôm nay; nếu yêu cầu chờ quá ngày bắt đầu, từ chối và lập lại với ngày mới. Gia hạn mới phải sau hạn cũ và không trước hôm nay. Ngày tiếp nhận / thôi học là ngày xác nhận.
- Trạng thái bảo lưu / thôi học được thay đổi bằng luồng nghiệp vụ, không sửa trực tiếp từ biểu mẫu hồ sơ. Không đồng thời mở yêu cầu chuyển chuyên ngành và yêu cầu bảo lưu.

## Dữ liệu và kiểm tra

Migration `057-study-leaves` thêm `study_leaves` và `course_offering_withdrawals`. Migration `058-study-leave-failed-attempts` cập nhật phân loại lượt dở dang đã bảo lưu trước khi có quy tắc đánh trượt. Migration `059-study-leave-scheduled-attempts` bổ sung lượt đã có lịch trước lúc duyệt, kể cả buổi tương lai và buổi không diễn ra; giữ ảnh chụp trước cập nhật để hoàn tác. Quyết định, gia hạn và lịch sử được lưu cùng đợt bảo lưu; bản ghi dừng học phần lưu ảnh chụp thông tin lớp và điểm cũ. Bảng điểm, kết quả học và báo cáo dùng chung nguồn kết quả, bao gồm lượt Không đạt do bảo lưu. Không xóa hoặc chuyển điểm cũ sang bảng điểm mới; lượt học lại có điểm độc lập.

Kiểm thử PostgreSQL dùng transaction hoàn tác, không để lại học viên thử:

```powershell
$env:RUN_POSTGRES_SCHEDULING_TESTS='true'
$env:NODE_ENV='test'
npm --prefix backend test -- test/integration/study-leaves-postgres.spec.ts
npm --prefix frontend run test:ci -- --runTestsByPath src/test/integration/StudyLeavePanel.test.jsx
```
