# Tối ưu quét và đo thời gian điểm danh — 29/10/2026

Phạm vi: kiosk React, backend NestJS trong repo này và face-service tại
`D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr`. Không đổi model hoặc
ngưỡng quyết định nhận diện. Không có migration mới cho đợt tối ưu này.

## Hành vi quét

- Khi sẵn sàng, kiosk bắt đầu lượt tự động sau 300 ms, vẫn lấy ba khung ổn định
  trong ít nhất 650 ms và chọn ảnh có quality score cao nhất.
- Sau ACCEPT/REVIEW: giữ thông báo tối thiểu 1 giây rồi kiểm tra khung camera.
  Chỉ mở lượt mới sau hai kết quả `no_face`, `face_count=0` liên tiếp, cách nhau
  tối thiểu 500 ms. Người đứng nguyên trong khung không phát thêm yêu cầu nhận diện.
  Kiểm tra rời khung hoạt động cả khi tắt quét tự động để nút quét tay sẵn sàng lại.
- Không có ảnh đạt yêu cầu: thử lại sau 1 giây. UNKNOWN/ERROR: hiển thị 1,8 giây
  rồi cho thử lại. Phản hồi 409 dừng quét tự động; 409 lúc kiểm tra rời khung cũng
  dừng vòng kiểm tra đó. Đóng kiosk hủy yêu cầu chụp/nhận diện đang chờ và tắt camera.
- ACCEPT vẫn phải có `attendanceId`. Kết quả gần nhất giữ trong bảng bên cạnh;
  quét lại vẫn dùng bản ghi và thời gian ban đầu theo quy tắc backend hiện có.
- Dùng import theo từng icon cho các component điểm danh để giảm chi phí tải
  module ở môi trường phát triển và kiểm thử.

Nhận biết rời khung dựa trên bộ phát hiện khuôn mặt, không phải theo dõi danh
tính hay chống giả mạo. Người tiếp theo cần chờ khung trống; nếu đứng nối tiếp
mà không có khoảng trống, kiosk sẽ tiếp tục yêu cầu rời khung.
Vòng kiểm tra rời khung phát thêm yêu cầu phân tích, tối đa khoảng hai lượt/giây
mỗi kiosk sau khoảng đọc kết quả ban đầu. Vì vậy giảm một detection trùng ở
nhận diện không đồng nghĩa giảm tổng tải camera; cần đo khi chạy nhiều kiosk.

## Tái sử dụng phân tích

`analyze` trả thêm `capture_token` khi ảnh nhận diện đạt chất lượng và có
`capture_context`. NestJS tự đặt context bằng ID buổi học đã kiểm tra quyền;
trình duyệt chỉ gửi token của đúng ảnh được chọn.

Cache face-service có tối đa 64 entry/worker, hiệu lực 15 giây, dùng khóa để
chỉ một request tiêu thụ token. Entry chứa hash SHA-256 của ảnh đã decode,
context, landmarks và quality metadata; không giữ pixel, crop hoặc embedding.
Entry hết hạn không còn dùng được và được dọn khi thao tác cache tiếp theo.
Token không được ghi vào log hoặc database.

Khi token khớp: bỏ detection và phép đo chất lượng đã thực hiện; vẫn decode ảnh,
căn chỉnh từ landmarks và tính embedding, kiểm tra quality gate, so với roster
hiện tại, áp ngưỡng và ghi điểm danh qua transaction hiện có. Ảnh đổi, context
đổi, token đã dùng/hết hạn/evicted hoặc request sang worker khác đều chạy lại
pipeline đầy đủ. Client hoặc face-service phiên bản cũ vẫn dùng luồng đầy đủ.

Đối chiếu kiểm thử cho thấy crop cấp vào backbone và embedding của hai nhánh
giống nhau với cùng ảnh/landmarks; chưa phải benchmark trên webcam thật.

## Đọc số đo

Backend xuất JSON một dòng với event `attendance.server_timing`:

| Trường | Phạm vi |
| --- | --- |
| `sessionMs` | Đọc buổi học theo phạm vi truy cập hiện tại |
| `rosterMs` | Lấy danh sách học viên |
| `faceServiceMs` | Lời gọi HTTP tới face-service |
| `persistenceMs` | Transaction ghi kết quả, gồm chờ khóa và hoàn tất transaction |
| `totalMs` | Toàn bộ service nhận diện, kể cả phần xử lý ngoài các chặng trên |
| `captureReused` | Face-service xác nhận dùng lại phân tích |
| `newAttendance` | ACCEPT tạo bản ghi điểm danh mới, không tính quét lặp |

Response nhận diện cũng có `timings` và `captureReused`. `latencyMs` cũ giữ
nguyên ý nghĩa để tương thích. Các ngưỡng accept/review do face-service trả về
được ghi vào event nhận diện; với service cũ hoặc chưa gọi model chúng vẫn null.
Chặng thất bại trước khi có số đo có thể để 0; không diễn giải là chi phí bằng 0.

Trình duyệt gửi chẩn đoán không chặn kết quả tới
`POST /attendance/sessions/:id/telemetry`, qua cùng kiểm tra đăng nhập, quyền
`attendance.record`, phạm vi buổi học và giới hạn dữ liệu chỉ xem. Backend xuất
event `attendance.client_timing` gồm:

- `captureMs`: chụp, nén, tải các khung phân tích và chờ ổn định.
- `recognitionHttpMs`: HTTP nhận diện, bao gồm mạng và xử lý backend.
- `uiCommitMs`: nhận response đến lúc React commit kết quả vào DOM.
- `totalMs`: bắt đầu lượt quét đến commit; không gồm chờ người bước vào khung.
- `frameCount`, `outcome`, `eventId` nếu có. `NO_CAPTURE` tách các lượt chưa gửi
  nhận diện. Không có ảnh, token, embedding hoặc tên học viên trong payload này.

Đây là số đo phía client do client báo cáo, không dùng quyết định điểm danh.
DOM commit chưa phải thời điểm màn hình thực sự vẽ xong. Gửi telemetry thất bại
không đổi kết quả và không retry; nếu cần đầy đủ số liệu hãy kiểm tra log client
và server có cùng `eventId`. Không cộng các chặng client với server vì chúng
lồng nhau, cũng không trừ hai timestamp ở hai máy khác nhau.

Lưu console backend vào file rồi tổng hợp từ thư mục gốc project:

```powershell
node scripts/attendance/summarize-timings.cjs backend.log
node scripts/attendance/summarize-timings.cjs backend.log - ACCEPT
node scripts/attendance/summarize-timings.cjs backend.log <session-uuid> ACCEPT
```

Script đọc UTF-8 hoặc UTF-16LE có BOM, bỏ dòng không liên quan, báo n/p50/p95
theo nearest-rank, số outcome, số cache hit và số điểm danh mới. Nên so riêng
ACCEPT/REVIEW/UNKNOWN/ERROR/NO_CAPTURE; phân bố tổng bị ảnh hưởng bởi số lượt
khung trống. Tỷ lệ outcome là tỷ lệ xử lý request, không phải độ chính xác.
Chưa có phép đo trước/sau trên webcam thực tế để công bố mức tăng tốc.

## Chạy phiên bản mới

Cần khởi động lại backend và dùng frontend mới. Để bật nhánh cache phải cập
nhật face-service cùng đợt; nếu chưa cập nhật, điểm danh vẫn chạy pipeline đầy đủ.
Với cấu hình Docker hiện có, chạy tại repo face-service:

```powershell
docker compose up -d --build app
```

Lệnh trên là hướng dẫn vận hành; chưa thực thi trên dịch vụ đang chạy trong
đợt sửa này. Bản chụp OpenAPI trong repo face-service đã được cập nhật.

## Kiểm chứng

- Frontend: 36 kiểm thử toàn bộ thư mục `src/features/attendance` đạt; build production.
- Backend: 47 kiểm thử đạt; typecheck/build; các bộ attendance service/policy, face client và
  validation dữ liệu chẩn đoán. Kiểm thử thời gian có cả chờ khóa và commit.
- Python: 54 kiểm thử đạt; cache expiry/eviction/one-use/concurrent access, pipeline bỏ detection,
  API token khớp/sai ảnh/sai buổi và roster hiện tại, OpenAPI, demo và product API.
- Công cụ tổng hợp: kiểm tra parser log, p50/p95 và đếm bản ghi mới.

Các kiểm thử mới dùng mock hoặc database SQLite tạm trong Python; không sửa dữ
liệu điểm danh thực tế. Kiểm thử không thay thế việc đo nhiều kiosk đồng thời,
camera thiếu sáng hoặc trải nghiệm người thật tại lớp.

## Rà soát bổ sung bằng Superpowers

[Rà soát ngày 29/10/2026](attendance-superpowers-review-20261029.md) bổ sung
kiểm tra khi cùng buổi học chuyển sang CLOSED hoặc `not_held` giữa một yêu cầu
đang chạy. Kiosk giờ hủy yêu cầu và tắt camera khi điều kiện điểm danh mất hiệu
lực, đồng thời bỏ phản hồi muộn. Bốn ca tái hiện đã được chạy thất bại trước sửa
và đạt sau sửa; kết quả kiểm thử mở rộng được ghi trong báo cáo rà soát.
