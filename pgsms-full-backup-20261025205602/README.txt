BẢN SAO LƯU ĐẦY ĐỦ DATABASE pgsms
Thời điểm bắt đầu: lúc 20:56:02 GMT+7 Chủ Nhật, 25 tháng 10, 2026
Máy chủ: PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
Công cụ xuất: pg_dump (PostgreSQL) 17.11
Số bảng: 80; tổng số dòng: 8696.

NỘI DUNG
- database.dump: bản sao lưu PostgreSQL custom, bao gồm cấu trúc, dữ liệu, sequence, index, constraint, quyền và các đối tượng của database.
- database.sql: bản SQL UTF-8 chứa cấu trúc và dữ liệu, dùng tài khoản thực hiện khôi phục làm chủ sở hữu.
- manifest.json: thống kê số dòng từng bảng tại cùng snapshot với hai bản sao lưu.
- archive-contents.txt: danh sách đối tượng trong database.dump.
- SHA256SUMS.txt: mã SHA-256 để kiểm tra tính toàn vẹn các file.

KHÔI PHỤC (chọn một trong hai cách)
Dùng bộ công cụ PostgreSQL 17 hoặc mới hơn. Các lệnh bên dưới dành cho CMD hoặc terminal có công cụ PostgreSQL trong PATH.
Thay localhost, postgres và pgsms_restore theo máy đích. Chạy trong thư mục đã giải nén.
Tạo database trống mới:
  createdb -h localhost -U postgres pgsms_restore

Cách 1 - khôi phục bản custom:
  pg_restore -h localhost -U postgres --no-owner --no-privileges --exit-on-error -d pgsms_restore database.dump

Cách 2 - khôi phục bản SQL vào database trống:
  psql -h localhost -U postgres --set ON_ERROR_STOP=1 -d pgsms_restore -f database.sql

Hai bản sao lưu chứa cùng dữ liệu, chỉ cần dùng một cách khôi phục.
Đây là bản sao lưu logic của toàn bộ database ứng dụng; các file upload nằm ngoài database không thuộc gói này.
