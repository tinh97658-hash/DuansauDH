# Rà soát tối ưu điểm danh bằng Superpowers — 29/10/2026

Áp dụng `requesting-code-review`, `systematic-debugging`, `test-driven-development`
và `verification-before-completion` cho phần tối ưu được mô tả trong
[ghi chú triển khai](attendance-optimization-20261029.md).

## Checklist

- [x] Đối chiếu yêu cầu quét, hủy yêu cầu, cache và số đo thời gian.
- [x] Rà soát độc lập, chỉ đọc, trong hai repo ứng dụng và face-service.
- [x] Tái hiện phát hiện bằng kiểm thử thất bại trước khi sửa.
- [x] Sửa nguyên nhân và chạy lại bốn ca tái hiện.
- [x] Rà soát lại phần sửa.
- [ ] Đọc kết quả toàn bộ kiểm thử frontend và ghi rõ các giới hạn.
- [ ] Kiểm tra bản build frontend sau sửa.

## Phát hiện và sửa

Kiosk trước đây chỉ dọn camera/hủy yêu cầu khi đổi ID buổi học hoặc unmount.
Nếu cùng ID chuyển từ OPEN sang CLOSED hoặc `status=not_held`, yêu cầu phân tích
hay nhận diện đang chờ vẫn tiếp tục. Backend có kiểm tra trạng thái dưới khóa
giao dịch, nên phát hiện này không chứng minh có ghi điểm danh sau khi chốt;
ảnh hưởng xác định được là gửi thừa yêu cầu và cập nhật giao diện/callback muộn.

Thêm bốn test dùng response trì hoãn, bao phủ hai trạng thái trên ở cả giai
đoạn phân tích lẫn nhận diện. Lượt trước sửa: cả bốn thất bại tại
`signal.aborted`, nhận false thay vì true. Lượt sau sửa: cả bốn đạt.
Log tái hiện local: `.tmp/attendance-cancellation-red.log`.

Camera giờ chỉ mở khi buổi được phép điểm danh. Thay đổi điều kiện này sẽ hủy
yêu cầu, dừng track và gỡ stream khỏi video. Trước khi gửi nhận diện hoặc nhận
kết quả/lỗi, kiosk kiểm tra điều kiện hiện tại để bỏ phản hồi cũ.
Giao diện hiển thị trạng thái dừng thay vì tiếp tục báo đang mở camera.

Một test cũ chờ callback rồi kiểm tra DOM ngay lập tức đã thất bại trong lượt
kiểm tra mới: callback có thể được gọi trước React commit. Sửa test để chờ
chính nội dung kết quả trên DOM; không thêm thời gian ngủ tùy ý.

Rà soát độc lập lần hai không còn phát hiện quan trọng trong phạm vi này.
Không có thay đổi mới vào model, ngưỡng, cache Python hay schema database.

## Bằng chứng kiểm chứng

- Backend: chạy mới bốn suite attendance service/policy, face client và telemetry;
  47 kiểm thử đạt.
- Python: chạy toàn bộ `pytest`; 113 đạt, 6 bỏ qua do không cấu hình PostgreSQL
  test, 5 cảnh báo deprecation trong LVFace/timm. Các test bỏ qua không được
  tính là kiểm chứng PostgreSQL.
- Frontend: đang tổng hợp kết quả full suite và production build.

Đây là kiểm chứng tự động và rà soát mã nguồn; chưa phải phép đo webcam thật
hoặc kiểm thử tải nhiều kiosk. Không restart dịch vụ, chạy migration, commit
hoặc gửi PR trong đợt rà soát này.
