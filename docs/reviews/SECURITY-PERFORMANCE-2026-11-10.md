# Sửa bảo mật và hiệu năng ngày 10/11/2026

## Thay đổi

- Tất cả POST/PUT/PATCH/DELETE phải gửi `Origin` trùng chính xác nguồn của `FRONTEND_URL`, gồm giao thức và cổng. Chặn nguồn rỗng, `null` và tên miền con khác. GET/HEAD/OPTIONS vẫn dùng được khi không có Origin. Client tích hợp ngoài trình duyệt cũng cần gửi header này.
- Rate limiter tổng, đăng nhập/khôi phục mật khẩu và upload chạy trước body parser, session và các truy vấn xác thực. Giữ hạn mức hiện tại.
- Dashboard dùng truy vấn lớp gọn, không tải danh sách học viên, participant notes, snapshot bảng điểm hoặc tính khả năng sửa/xung đột lịch chỉ để hiển thị chỉ số. Chỉ luồng lịch tải số buổi tổng hợp trong SQL; luồng bảng điểm chỉ lấy lớp đã hoàn thành. Các miền RLS vẫn tách biệt; không cache dữ liệu giữa người dùng/hồ sơ.
- Bảng điểm dùng Map cho đối chiếu và tái sử dụng kết quả giải điểm đã tính.
- Chỉ mục dung lượng upload được lưu trong database. Lần upload đầu tiên của mỗi tài khoản lập chỉ mục tệp cũ (kể cả tệp mồ côi); các lần sau dùng tổng dung lượng từ chỉ mục. Giữ khóa theo tài khoản, quota 160 MiB và dọn tệp sau commit. Tệp không dọn được vẫn nằm trong chỉ mục.
- Kết nối ứng dụng có `DB_LOCK_TIMEOUT_MS=5000`, `DB_STATEMENT_TIMEOUT_MS=30000`. Khi quá thời hạn, trả 503 với mã `DATABASE_BUSY` và `Retry-After: 2`, không tự phát lại thao tác ghi.

## Triển khai

1. Sao lưu database và volume upload theo quy trình triển khai hiện có.
2. Build backend, chạy `npm run db:migrate` để áp dụng migration `101-upload-storage-index`, sau đó khởi động lại backend. Không chạy đồng thời backend bản cũ và bản mới ghi upload vì bản cũ không cập nhật chỉ mục.
3. Nếu migration lớn cần chạy lâu, đặt timeout cao hơn riêng cho tiến trình migration (ví dụ `DB_STATEMENT_TIMEOUT_MS=300000`, `DB_LOCK_TIMEOUT_MS=60000`). Các biến này cũng có trong mẫu môi trường.

Không thêm/xóa/sửa tệp trực tiếp trong volume sau khi đã lập chỉ mục. Nếu phục hồi thủ công, phải phục hồi database và volume nhất quán hoặc, khi đã dừng API, xóa hàng tương ứng trong `upload_storage_accounts` để lần upload kế tiếp lập lại chỉ mục. Việc xóa hàng chỉ mục không xóa tệp thực tế.

## Giới hạn còn lại

Khóa nghiệp vụ chung `21026` vẫn được giữ vì còn bảo vệ các ràng buộc liên quan lớp ghép, sĩ số, học lại và bảng điểm. Thay bằng khóa theo từng lớp cần thiết kế và kiểm tra đồng thời trên toàn bộ luồng ghi và trigger; bản sửa này giới hạn thời gian chờ, chưa làm các thao tác đó chạy song song. Chưa đo tải production nên không khẳng định mức tăng tốc cụ thể. Lần lập chỉ mục upload đầu tiên vẫn cần quét thư mục cũ.

## Kiểm tra

- Backend typecheck và build thành công.
- Bộ backend: 92 suite đạt, 1.425 test đạt; các suite yêu cầu database riêng được bỏ qua theo cấu hình mặc định. Test bổ sung sau đó về lỗi dọn tệp cũng đạt.
- Trên PostgreSQL 18 tạm riêng: toàn bộ migration chạy thành công; 11 test integration dashboard/upload đạt, gồm SQL tổng hợp, phạm vi hồ sơ, nhập chỉ mục tệp cũ, rollback khi commit lỗi, quota và hai upload đồng thời tranh dung lượng còn lại.
- Test HTTP kiểm tra nguồn giả, nguồn thiếu/null, tên miền con, các phương thức ghi, rate limit trước middleware database và chuẩn hóa đường dẫn khôi phục mật khẩu.
- Không chạy migration trên database nghiệp vụ và không thay đổi volume upload đang sử dụng.
