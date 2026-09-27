# Sinh dữ liệu hàng loạt để test database

Để thử màn **Tạo lớp học phần** với bộ mẫu tối thiểu chỉ dùng trong development, xem [SCHEDULING-TEST.md](SCHEDULING-TEST.md). Frontend không có chức năng chèn dữ liệu test; dữ liệu được seed từ backend.

Chạy các lệnh trong thư mục `backend`. Script dùng cấu hình database hiện có của backend (`DATABASE_URL` và cấu hình SSL). Database cần được chạy đầy đủ migration trước khi chèn. Không cần chạy seed demo/common trước.

## Các lệnh

```powershell
cd backend

# Xem số lượng sẽ tạo, không kết nối database
npm run db:seed:bulk:preview

# Thử chèn, kiểm tra số lượng và ràng buộc DB, rồi rollback toàn bộ
npm run db:test:bulk -- --classes 5 --students 10

# Lưu dữ liệu test và cấp quyền xếp lịch cho tài khoản development
npm run db:seed:bulk -- --prefix BTTEST01 --grant-scheduling-to admin@example.com

# Bộ lớn: 100 lớp, mỗi lớp 50 học viên, 6 học phần, mỗi học phần 8 buổi
npm run db:seed:bulk -- --prefix BTLOAD01 --classes 100 --students 50 --subjects 6 --weeks 8

# Chọn ngày bắt đầu lịch học
npm run db:seed:bulk -- --prefix BTLATER --start 2026-10-05
```

Mặc định tạo đầy đủ danh mục trình độ/hình thức đào tạo, **3 chương trình và 3 kế hoạch tuyển sinh**, chỉ tiêu, khoản thu, **20 lớp, 600 hồ sơ học viên đã phân lớp, 12 học phần thuộc 3 chuyên ngành, 3 chương trình đào tạo (mỗi chuyên ngành một CTĐT theo khóa), 40 lớp học phần, 20 giảng viên, 20 phòng và 160 buổi học**. Mỗi lớp kế thừa CTĐT của chuyên ngành mình và được chỉ định sẵn học phần tự chọn; một nửa số học phần hiệu lực của lớp đã được tổ chức và có lịch, nửa còn lại vẫn xuất hiện ở màn **Tạo lớp học phần**, nhờ vậy có thể test cả quy trình tạo lớp lẫn xếp lịch. Các bảng liên kết được tạo tự động. Đây là hồ sơ tuyển sinh đã trúng tuyển, không phải tài khoản đăng nhập học viên.

`--students` là số học viên mỗi lớp; `--subjects` là số học phần của chuyên ngành (nửa đầu bắt buộc, nửa sau là tự chọn được chỉ định cho lớp); `--weeks` là số buổi của mỗi học phần đã mở (mỗi tuần một buổi). Ngày bắt đầu mặc định là hôm nay theo giờ Việt Nam. Lịch dùng các buổi sáng 08:00–11:00, chiều 13:00–16:00; mỗi lớp có phòng và giảng viên riêng nên bộ sinh không tạo trùng lịch. Tất cả lớp học phần đang hoạt động và các buổi có trạng thái `planned`; nếu chọn ngày quá khứ, buổi đã qua sẽ hiện chờ xác nhận.

Tìm tiền tố, ví dụ `BTTEST01`, ở danh sách lớp/chuyên ngành. Mở **Đào tạo Thạc sĩ → Xếp lịch**, chọn lớp học phần và chuyển tới tuần bắt đầu đã chọn. Có thể thử đặt thêm buổi trùng giờ/phòng/giảng viên để kiểm tra API từ chối xung đột.

Mỗi lần chạy không truyền `--prefix` sẽ sinh tiền tố mới. Nếu dùng lại tiền tố đã có, script báo lỗi; không xóa hay ghi đè dữ liệu cũ. Một lượt chèn nằm trong một transaction, lỗi ở bất kỳ bảng nào sẽ rollback toàn bộ lượt đó. Dữ liệu được chèn theo lô 500 dòng và kiểm tra lại số lượng theo ID trước khi commit. Chế độ `db:test:bulk` kiểm tra thao tác ghi thật nhưng rollback dữ liệu test khi kết thúc.

Script chèn trực tiếp qua Sequelize: kiểm tra ràng buộc database và tạo dữ liệu để thử giao diện; không thay thế kiểm thử API, quyền truy cập, hoặc đo tải nhiều người dùng đồng thời. Script không tự chạy migration hoặc thay đổi cấu trúc bảng.

`--grant-scheduling-to` nhận email của một tài khoản nhân sự đã tồn tại. Vì hệ thống chỉ có một người phụ trách xếp lịch tại một thời điểm, quyền của người phụ trách cũ sẽ được gỡ trong cùng transaction. Nếu email không tồn tại hoặc bất kỳ bước seed nào lỗi, toàn bộ lượt chạy được rollback.
