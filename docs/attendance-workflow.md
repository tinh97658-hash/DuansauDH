# Quy trình điểm danh khuôn mặt

## Đăng ký mẫu

Trong **Đăng ký mẫu**, chọn **Mở camera chụp mẫu**. Hệ thống hướng dẫn nhìn thẳng, quay nhẹ sang một bên, rồi sang bên còn lại. Mỗi góc cần một khuôn mặt đủ sáng, rõ nét và ổn định qua ba khung hình. Hệ thống chọn khung tốt nhất cho mỗi góc; sau khi đủ ba ảnh, cán bộ kiểm tra ảnh xem trước rồi bấm **Lưu mẫu khuôn mặt**.

Vẫn có thể chọn 3–5 ảnh có sẵn. Không được chọn ảnh hoặc lưu bộ mẫu cũ trong lúc camera đang chụp. Đóng hộp thoại hoặc dừng chụp sẽ tắt camera và hủy yêu cầu kiểm tra còn chờ.

### Một khuôn mặt chỉ thuộc một học viên

Trước khi lưu mẫu, backend so từng ảnh đăng ký với toàn bộ hồ sơ đang hoạt động khác trong dịch vụ nhận diện. Nếu có hồ sơ khác đạt độ tương đồng từ ngưỡng trùng lặp trở lên, hệ thống từ chối và hiển thị tên học viên đã đăng ký trước. Ngưỡng mặc định là `0.60`, điều chỉnh bằng biến môi trường `FACE_ENROLLMENT_DUPLICATE_THRESHOLD`; đặt `0` để tắt kiểm tra.

Hai danh tính `admission:<id>` và `student:<id>` của cùng một học viên sau khi chuyển đổi không bị coi là trùng. Cụ thể, nếu hồ sơ tuyển sinh có `student_id` trùng với mã học viên đang đăng ký thì hệ thống cho phép đăng ký lại.

Khi nhận diện, nếu khuôn mặt khớp với hai học viên trong danh sách lớp với điểm gần nhau, hệ thống không tự chọn người có điểm cao hơn mà chuyển sang **Chờ duyệt** với lý do `ambiguous_identity`. Hai ngưỡng điều chỉnh là `ATTENDANCE_AMBIGUITY_SCORE` (mặc định `0.45`) và `ATTENDANCE_AMBIGUITY_MARGIN` (mặc định `0.15`).

### Xử lý dữ liệu đã bị trùng

Dữ liệu đăng ký trước khi bật kiểm tra vẫn có thể chứa hai hồ sơ dùng chung khuôn mặt. Khi phát hiện, xác định học viên đúng, dùng **Thu hồi mẫu** trên hồ sơ đăng ký nhầm, rồi đăng ký lại bằng ảnh của đúng người. Nếu hai hồ sơ thực chất là cùng một học viên, xử lý hồ sơ tuyển sinh/student trùng trước khi đăng ký lại.

Truy vấn kiểm tra trên database của dịch vụ nhận diện:

```sql
SELECT p1.external_code AS subject_a, p1.display_name AS name_a,
       p2.external_code AS subject_b, p2.display_name AS name_b,
       ROUND(MAX(1 - (t1.embedding <=> t2.embedding))::numeric, 4) AS max_cosine
FROM face_templates t1
JOIN face_templates t2 ON t1.person_id < t2.person_id
JOIN persons p1 ON p1.person_id = t1.person_id
JOIN persons p2 ON p2.person_id = t2.person_id
GROUP BY p1.person_id, p2.person_id, p1.external_code, p1.display_name, p2.external_code, p2.display_name
ORDER BY max_cosine DESC;
```

Cặp có `max_cosine` từ `0.60` trở lên cần được xem xét thủ công; điểm càng cao càng chắc chắn là cùng một khuôn mặt.

### Theo dõi trạng thái trên bảng điểm danh

Bảng học viên của buổi học có cột **Khuôn mặt** hiển thị `Đã có N mẫu`, `Chưa đăng ký` hoặc `Đã thu hồi`. Nút **Đăng ký** mở hộp thoại chụp ảnh; với học viên đã có mẫu, nút **Cập nhật** mở cùng hộp thoại để thay mẫu, còn nút **Thu hồi** xóa toàn bộ mẫu sau khi xác nhận. Chip phía trên bảng cho biết tổng số học viên đã có khuôn mặt.

## Mở và chốt buổi

- Cần quyền `attendance.record` và tài khoản có quyền ghi dữ liệu.
- **Mở điểm danh** khả dụng từ 30 phút trước giờ học đến hết buổi, theo giờ Việt Nam. Buổi không diễn ra và lớp chưa có học viên không được mở.
- Chỉ buổi đang mở và trong thời gian cho phép mới nhận ảnh quét.
- Trước khi chốt, người chưa có bản ghi vẫn là **Chưa điểm danh**.
- Xử lý hết ca chờ duyệt trước khi bấm **Chốt điểm danh**. Thao tác này giữ nguyên bản ghi đã có và thêm trạng thái **Vắng mặt**, nguồn **Chốt buổi**, cho học viên còn thiếu trong danh sách lớp.
- Sau khi chốt không được mở lại hoặc ghi thêm kết quả qua quét/duyệt. Hiện chưa có luồng sửa kết quả sau chốt.
- Các buổi cũ được khởi tạo trạng thái **Chưa mở**; kết quả điểm danh đã lưu được giữ nguyên.

## Kiểm tra trước nhận diện

Camera lấy ít nhất ba khung đủ chất lượng trong khoảng tối thiểu 650 ms. Vị trí khuôn mặt phải ổn định; ảnh tốt nhất trong chuỗi được dùng để nhận diện. Không có mặt, nhiều mặt, thiếu sáng hoặc di chuyển sẽ được hướng dẫn điều chỉnh và chưa gửi nhận diện. Dịch vụ nhận diện cũng từ chối ảnh nhiều mặt, kể cả khi gửi trực tiếp qua API.

Các lượt phân tích khung hình không tạo bản ghi điểm danh, nhật ký nhận diện hay mẫu sinh trắc. Không bổ sung việc lưu ảnh gốc hoặc ảnh minh chứng. Kiểm tra khung hình ổn định không phải là kiểm tra chống giả mạo người thật.

Sau kết quả thành công hoặc chờ duyệt, kiosk chờ người vừa quét rời khung. Hai lượt phân tích liên tiếp không có khuôn mặt, cách nhau ít nhất 500 ms, mới cho phép lượt tiếp theo. Kết quả thành công gần nhất vẫn được giữ ở bảng bên cạnh. Không còn cộng thời gian giữ kết quả 4 giây với chu kỳ quét 2,8 giây. Khi ảnh chưa đủ điều kiện, kiosk đợi 1 giây trước lần thử tự động tiếp theo; lỗi nhận diện hiển thị 1,8 giây trước khi thử lại.

Ảnh được chọn có thể mang token phân tích dùng một lần, hiệu lực 15 giây và gắn với nội dung ảnh cùng buổi học. Face-service dùng lại landmarks/chất lượng đã phân tích để bỏ lần chạy bộ phát hiện khuôn mặt trùng lặp, rồi căn chỉnh và tính embedding từ ảnh tải lên. Token không hợp lệ, hết hạn hoặc không còn trong worker hiện tại sẽ quay về pipeline đầy đủ. Chi tiết đo lường và vận hành: [tối ưu điểm danh ngày 29/10/2026](attendance-optimization-20261029.md).

## Tính nhất quán

Mở/chốt, ghi điểm danh và duyệt kết quả sử dụng cùng khóa buổi học trong giao dịch database. Nếu chốt trong lúc nhận diện đang chạy, lượt nhận diện đó không thể ghi sau khi chốt. Lượt quét lại trả về bản ghi cũ và thời gian ghi nhận ban đầu.

Kiểm thử bao gồm ranh giới thời gian Việt Nam, ca chờ duyệt, không ghi đè kết quả cũ, chốt khi đang nhận diện, chọn ảnh ổn định, nhiều khuôn mặt, ba góc chụp và hủy camera. Luồng mở → nhận diện → chốt → ghi vắng đã được kiểm tra với PostgreSQL thật trong giao dịch được rollback toàn bộ.
