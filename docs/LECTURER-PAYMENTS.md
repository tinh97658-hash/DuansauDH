# Thống kê thanh toán giảng viên

## Chức năng

- BÁO CÁO → BÁO CÁO CHUNG → Thanh toán giảng viên; route `/reports/lecturer-payments`.
- Một hàng bộ lọc: khoảng ngày hoàn thành (mở popover khi bấm), đơn vị công tác, giảng viên, trạng thái thanh toán, tìm kiếm. Xuất Excel bên phải.
- Bảng gồm STT, Giảng viên, Lớp học phần, Số buổi, Ngày hoàn thành, Đã thanh toán. Không có dashboard hoặc quy trình kế toán.
- Checkbox chỉ đổi sau khi API lưu thành công; truy vấn lại dữ liệu sau khi lưu. Khi lỗi, giữ trạng thái đang lưu trong cơ sở dữ liệu.

## Dữ liệu tái sử dụng

- `course_offerings.status`, `completed_at`: chỉ thống kê lớp `completed` có thời điểm hoàn thành đã lưu; không suy diễn ngày hoàn thành từ lịch học.
- `teaching_sessions`: đếm từng bản ghi `held`, theo `lecturer_id` và `course_offering_id`. `confirmed_at`, `created_at` và thời điểm kết thúc buổi học phải trước hoặc bằng `completed_at`.
- `lecturers.unit_id`, `lecturers.name`, `units`, `subjects`, tên lớp học phần: lấy trực tiếp dữ liệu có sẵn. Không sao chép hồ sơ giảng viên hay lớp.
- Ngày hoàn thành hiển thị/lọc theo múi giờ Việt Nam; hai đầu khoảng ngày đều được tính.
- Các bản ghi lịch sử thiếu `completed_at` hoặc thiếu bằng chứng xác nhận buổi học không được tự suy diễn hoặc sửa dữ liệu để đưa vào thống kê.
- `OfferingDetails` và các phương thức đọc của `SchedulingService`: dùng lại hộp thoại chi tiết của Thống kê tiến độ. Thêm prop tùy chọn `readBasePath`, `readOnly`; giá trị mặc định giữ nguyên hành vi màn cũ.
- `FeatureLayout`, `AppSelect`, CSS bảng/bộ lọc Thống kê tiến độ, `downloadReport(..., 'excel')`: dùng lại layout và cơ chế tạo Excel.

## Dữ liệu và quyền mới

Migration `090-lecturer-payments.ts` tạo duy nhất bảng `lecturer_payments`, khóa chính kép `(course_offering_id, lecturer_id)`, cờ `paid` mặc định false, thời điểm cập nhật và người cập nhật. Không tạo sẵn bản ghi thanh toán, không đánh dấu tự động, không cập nhật dữ liệu thanh toán cũ. Các khóa ngoại ngăn mất liên kết thanh toán do xóa lớp/giảng viên.

- Xem danh sách, tùy chọn và chi tiết: `reports.view`.
- Xuất Excel: đồng thời `reports.view`, `reports.export`.
- Tick/bỏ tick: đồng thời `reports.view`, quyền mới `reports.payments.manage`.
- Migration cấp quyền mới cho vai trò `admin`; vai trò khác được phân quyền bằng màn quản lý quyền hiện có.
- Backend dùng `AuthenticatedGuard`, `PermissionsGuard`, kiểm tra quyền mới nhất khi ghi, và cơ chế chặn vai trò Chỉ xem của `GroupScopeInterceptor`.
- Truy vấn giữ phạm vi nhóm hiện có. Bảng mới có RLS cho vai trò truy vấn giới hạn `pgsms_group_scoped`; quyền ghi không phát sinh từ quyền xem.
- API cập nhật xác minh chính cặp giảng viên–lớp có buổi đủ điều kiện, rồi upsert duy nhất cặp đó trong một câu lệnh SQL.

## File bổ sung/thay đổi

| File | Nội dung |
| --- | --- |
| `backend/src/database/migrations/090-lecturer-payments.ts` | Bảng, khóa ngoại, RLS và đăng ký quyền mới |
| `backend/src/auth/permissions.ts` | Danh mục quyền cập nhật thanh toán |
| `backend/src/reports/lecturer-payment.service.ts` | Truy vấn, lọc, đếm buổi, cập nhật trạng thái |
| `backend/src/reports/dto/lecturer-payment.dto.ts` | Kiểm tra tham số lọc và boolean thanh toán |
| `backend/src/reports/reports.controller.ts` | API xem, xuất, lưu và các API đọc chi tiết tái sử dụng |
| `backend/src/reports/reports.module.ts` | Đăng ký service, dùng lại SchedulingModule |
| `frontend/src/pages/reports/lecturerPayments.jsx` | Màn thống kê |
| `frontend/src/pages/reports/lecturerPayments.css` | CSS giới hạn trong màn mới |
| `frontend/src/App.js` | Route lazy load |
| `frontend/src/components/RibbonHeader.jsx` | Mục trong BÁO CÁO CHUNG |
| `frontend/src/features/scheduling/OfferingDetails.jsx` | Tham số tùy chọn cho tái sử dụng chi tiết theo quyền báo cáo |
| `frontend/src/test/integration/LecturerPayments.test.jsx` | Bộ lọc, lưu/bỏ tick, tải lại, quyền, chi tiết, Excel, lỗi ghi |
| `frontend/src/test/integration/RibbonPermissions.test.jsx` | Cập nhật hợp đồng điều hướng thêm mục báo cáo |
| `backend/test/unit/lecturer-payment-permissions.spec.ts` | Quyền xem/ghi/xuất và validation |
| `backend/test/integration/lecturer-payment-postgres.spec.ts` | Truy vấn PostgreSQL thực: thời điểm, nhiều giảng viên/lớp, lọc, lưu |
| `backend/test/run-lecturer-payment-db.cjs` | Tạo DB thử riêng, chạy toàn bộ migration và test SQL, xóa DB thử |
| `docs/LECTURER-PAYMENTS.md` | Báo cáo triển khai và hướng dẫn chạy |

## Kiểm tra và áp dụng

Kết quả kiểm tra: build frontend/backend thành công; 25 bài test backend về quyền/validation/interceptor, 6 bài test PostgreSQL thực và 63 bài test frontend liên quan đã qua. Một bài hồi quy Thống kê tiến độ bị timeout khi chạy đồng thời nhiều tác vụ; chạy lại riêng với `--maxWorkers=1` đã qua đủ 24/24 bài của màn này.

Toàn bộ migration chạy thành công trên database thử mới; khởi tạo AppModule và giải quyết dependency của ReportsController thành công. Sau khi áp dụng 090 vào database ứng dụng, truy vấn báo cáo và tùy chọn thành công, có 10 dòng thống kê và không có bản ghi thanh toán được tạo tự động.

```powershell
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend test -- test/unit/lecturer-payment-permissions.spec.ts test/unit/permissions.guard.spec.ts test/unit/group-scope-interceptor.spec.ts
npm --prefix frontend test -- src/test/integration/LecturerPayments.test.jsx src/test/integration/RibbonPermissions.test.jsx src/test/integration/ClassCourseHistory.test.jsx src/test/unit/schedulingNavigation.test.js
node backend/test/run-lecturer-payment-db.cjs
```

Runner PostgreSQL cần tài khoản kết nối có quyền tạo/xóa database thử. Database thử có tên `pgsms_lecturer_payment_test_<timestamp>`; không sử dụng bảng thanh toán của database ứng dụng để thử tick/bỏ tick.

Đã kiểm tra trực tiếp cấu trúc database ứng dụng: có các cột hoàn thành/xác nhận lịch cần thiết và ban đầu chưa có bảng thanh toán giảng viên. Đã áp dụng riêng migration 090 bằng Umzug với danh sách migration chỉ định; kiểm tra sau áp dụng có 0 bản ghi thanh toán. Hai migration 088–089 của công việc mã học phần vẫn đang chờ, không bị áp dụng kèm thay đổi này.

Khi triển khai sang môi trường khác, đối soát các migration đang chờ rồi chạy cơ chế chuẩn `npm --prefix backend run db:migrate`. Sau khi áp dụng 090, người dùng có quyền xem truy cập được màn mới; cấp thêm `reports.payments.manage` cho người phụ trách thanh toán khi cần. Không chạy seed dữ liệu mẫu.
