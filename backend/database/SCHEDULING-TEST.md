# Dữ liệu mẫu cho Tạo lớp học phần (development)

```powershell
cd D:\SAU-DAI-HOC\DuansauDH\backend
npm run db:migrate
npm run db:seed:scheduling-test
npm run dev
```

Seed đọc `.env` ở thư mục gốc; `NODE_ENV` phải là `development` (mặc định của dự án). Nếu cấu hình là `production` hoặc `test`, script dừng trước khi kết nối database. Script không tự đổi môi trường. Backend tạo kết nối PostgreSQL development từ `DB_HOST`, `DB_PORT` và `POSTGRES_*`.

Lệnh chạy `nest build` rồi Node giống `db:seed:common`, nên không cần cài `tsx` hoặc thay đổi cách xử lý decorator của Nest/Sequelize.

## Kết quả trên web

Reload web, mở **Đào tạo Thạc sĩ → Tạo lớp học phần**, chọn:

- Chuyên ngành: **Khai thác hàng hải (mẫu development)**, mã `DEV-SCHED-KTHH`.
- Khóa / năm học: **2026**.
- Có **3 học phần còn cần tổ chức** khi seed lần đầu: Toán cao cấp, Phương pháp nghiên cứu khoa học, Khai thác hàng hải.

Chọn học phần → nhóm `DEV-SCHED-2026` → **Tạo lớp học phần** để xem bảng preview gồm **STT, Mã học viên, Họ tên, Ghi chú** của 3 học viên. Có thể bổ sung học viên lẻ ở cột bên phải; người đã thuộc nhóm được tính một lần. Bấm **Xác nhận tạo lớp** để lưu. Quản trị viên hoặc nhân sự được phân công xếp lịch có thể tổ chức lớp; quyền sửa lịch vẫn dành cho người được phân công. Seed không sửa quyền người dùng.

## Chuỗi dữ liệu và điều kiện ứng viên

Seed tạo một chuyên ngành thạc sĩ đang hoạt động, ba học phần cùng ngành đang hoạt động (không có alias), một nhóm thuộc ngành/năm 2026, ba hồ sơ trúng tuyển và ba thành viên nhóm, một gói học phần **active + isOfficial**, ba liên kết từ gói tới học phần. Một giảng viên và một phòng 30 chỗ được thêm để thử bước xếp lịch sau đó.

`SchedulingService.listCourseOfferingCandidates` đọc chính chuỗi này. Service hiện không yêu cầu bản ghi `TrainingProgram` cho điều kiện ứng viên. Seed không tạo `CourseOffering`, `CourseOfferingClassGroup` hoặc `TeachingSession`: nếu tạo trước lớp học phần thì cặp nhóm–học phần sẽ bị loại khỏi danh sách còn cần tổ chức. Các migration cần được chạy đầy đủ, bao gồm 021–024 và các migration nền cho gói học phần.

Frontend gọi API thật, API đọc PostgreSQL thật. Sau khi chèn, script gọi chính service của `/scheduling/course-offering-candidates` và in số lượng cùng URL truy vấn để kiểm tra.

## Chạy lại

Seed dùng ID cố định, chỉ bổ sung dòng còn thiếu trong một transaction, không xóa hay ghi đè dữ liệu có sẵn. Chạy lại không nhân đôi hồ sơ, nhóm hoặc gói học phần. Khi đã dùng giao diện để tạo lớp, học phần tương ứng có thể không còn là ứng viên; chạy seed lại không xóa lịch sử đó. Nếu cần bắt đầu lại từ đầu, dùng database development mới rồi migrate và seed.
