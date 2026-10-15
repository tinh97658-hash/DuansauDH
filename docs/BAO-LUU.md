# Bảo lưu và tiếp nhận học lại

Triển khai theo tài liệu `luồng bảo lưu.docx` người dùng cung cấp ngày 15/10/2026.

## Thao tác

- Mở hồ sơ học viên → tab **Bảo lưu** để tạo yêu cầu có lý do, ngày bắt đầu và ngày kết thúc; duyệt hoặc từ chối.
- Mục **Đào tạo thạc sĩ → Quản lý bảo lưu** (`/masters/study-leaves`) theo dõi toàn bộ yêu cầu, sắp hết hạn, quá hạn và gia hạn chờ duyệt. Mở hồ sơ từ mỗi dòng để xử lý.
- Chỉ quản trị viên thực hiện quyết định; tài khoản được phép xem hồ sơ có thể xem lịch sử.

## Quy tắc

- Chờ duyệt: giữ tên trong lớp và tiếp tục học. Ngay khi duyệt, rút khỏi danh sách các lớp học phần chưa hoàn thành, kể cả ngày bắt đầu bảo lưu còn ở tương lai. Trạng thái hồ sơ chuyển sang Đang bảo lưu từ ngày bắt đầu.
- Từ ngày hiệu lực: trạng thái **Đang bảo lưu**, giữ lớp hành chính, kết quả các lớp học phần đã hoàn thành. Dừng riêng lượt tham gia các lớp chưa hoàn thành, giữ điểm và lịch sử trong bản ghi dừng học phần. Không có nghiệp vụ chuyên cần.
- Lớp đã xác nhận hoàn thành trước thời điểm duyệt bảo lưu vẫn giữ tên học viên trong danh sách thi / bảng điểm, cả kết quả Đạt và Không đạt. Bảng điểm hiển thị trạng thái bảo lưu bên cạnh mã học viên. Lượt đã rút khỏi lớp khi duyệt không được khôi phục chỉ vì lớp cũ hoàn thành sau đó.
- Theo yêu cầu bổ sung ngày 15/10/2026: lượt đã có lịch buổi đầu hoặc đang học dở khi duyệt bảo lưu được ghi nhận Không đạt do bảo lưu, hiển thị ở bảng điểm thi, bảng điểm hồ sơ, tổng hợp điểm, thông tin học tập và bản xuất/in. Giữ tên trong bảng điểm để tra cứu; loại khỏi lịch học và danh sách đủ tư cách dự thi. Kết quả này chỉ đọc, không đổi thành Đạt khi lớp cũ hoàn thành sau đó. Không tự gán điểm thi hay điểm tổng kết bằng 0.
- Quy tắc bổ sung: nếu trước lúc duyệt, học phần đã có điểm thành phần hoặc đã được xếp lịch buổi đầu thì ghi Không đạt khi duyệt. Không phụ thuộc buổi học đã đến ngày hay chưa, diễn ra hay được xác nhận không diễn ra. Khi yêu cầu vẫn chờ duyệt thì chưa đánh trượt do bảo lưu; nếu từ chối thì giữ nguyên việc học và kết quả.
- Lớp chưa có lịch và chưa có điểm chỉ hủy lượt xếp lớp ngay khi duyệt, không đánh trượt. Lịch được tạo sau khi đã rút học viên không biến lượt đã hủy thành Không đạt. Lớp mở trong thời gian bảo lưu vẫn chỉ ghi nhận bị bỏ lỡ để bố trí sau.
- Không đưa học viên đã được duyệt bảo lưu / quá hạn / thôi học vào lượt ghép lớp mới, kể cả chưa đến ngày bắt đầu. Lớp mở sau khi duyệt bảo lưu ghi nhận môn bị bỏ lỡ để bố trí khi học viên quay lại.
- Hạn bảo lưu bao gồm cả ngày kết thúc; quá hạn từ ngày kế tiếp theo múi giờ Việt Nam. Hệ thống đối soát trước các yêu cầu API về hồ sơ, đào tạo, xếp lịch và báo cáo, kể cả khi máy chủ ngừng hoạt động qua ngày hiệu lực. Không cần mở sẵn trình duyệt. Trạng thái lưu trong cơ sở dữ liệu được cập nhật khi có yêu cầu API tiếp theo.
- **Sắp hết hạn**: còn tối đa 30 ngày. Chưa áp giới hạn số lần / tổng thời gian gia hạn vì tài liệu chưa chốt.
- Yêu cầu gia hạn chờ duyệt giữ nguyên hạn cũ. Gia hạn được duyệt mới đổi hạn; từ chối giữ hạn cũ. Nếu đã quá hạn thì vẫn hiển thị quá hạn kèm gia hạn chờ duyệt.
- **Tiếp nhận học lại**: quyết định có hiệu lực hôm nay, chuyển về **Đang học**. Môn dở dang / chưa bắt đầu / bỏ lỡ được đưa vào nhóm cần bố trí của lớp hành chính gốc, kể cả lớp học phần cũ vẫn hoạt động. Ghép lớp qua luồng tạo lớp học phần hiện có, học lại từ đầu và có điểm mới độc lập. Không tự quay lại lớp cũ.
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
