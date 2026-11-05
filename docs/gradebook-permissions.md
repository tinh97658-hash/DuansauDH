# Quyền xem và nhập điểm theo lớp phụ trách

Màn Nhập điểm sử dụng trường **CV phụ trách** (`responsibleStaffId`) của lớp để giới hạn dữ liệu. Quyền hành động vẫn phải được cấp qua vai trò: **Xem bảng điểm** (`gradebook.view`), **Nhập và gửi duyệt điểm** (`gradebook.submit`), **Duyệt, khóa và mở lại điểm** (`gradebook.approve`).

| Tình huống | Hiển thị | Nhập/sửa điểm |
| --- | --- | --- |
| Lớp mình phụ trách | Toàn bộ lớp | Học viên thuộc lớp mình |
| Lớp ghép có lớp mình phụ trách | Toàn bộ học viên của lớp ghép | Toàn bộ lớp ghép |
| Lớp không liên quan | Không hiển thị; gọi trực tiếp API bị từ chối | Không được phép |
| Chưa được phân công lớp nào | Danh sách nhập điểm trống | Không được phép |
| Admin | Toàn bộ | Theo quyền nhập điểm và trạng thái bảng điểm |

Chỉ cần phụ trách một lớp thành viên là được xem và nhập điểm của toàn bộ lớp ghép, nếu đã có quyền nhập điểm. Quyền “Chỉ xem” vẫn chặn lưu, kể cả admin. Không tự cấp thêm quyền nhập hoặc duyệt cho người được phân công.

## Thiết lập

1. Admin gán **CV phụ trách** cho từng lớp tại màn quản lý lớp. Lớp chưa phân công cần được gán trước khi chuyên viên nhập điểm.
2. Gán cho tài khoản một vai trò có **Xem bảng điểm** và **Nhập và gửi duyệt điểm**; tắt “Chỉ xem” nếu cần nhập.
3. Với lớp ghép A + B, người phụ trách A hoặc B đều có thể xem và sửa toàn bộ bảng điểm. Lưu đồng thời vẫn kiểm tra phiên bản; người lưu sau tải lại trước khi lưu tiếp.

Gửi duyệt và khóa kết quả cuối vẫn xử lý trên toàn bộ lớp học phần ghép, chỉ thực hiện khi đủ kết quả của các lớp thành viên. Người duyệt cần quyền duyệt và quyền truy cập lớp học phần đó; admin có thể xử lý toàn bộ.

## Triển khai và kiểm chứng

Migration `091-automatic-exam-eligibility` bỏ yêu cầu quyền duyệt khi tạo tư cách thi tự động. Migration `092-gradebook-responsibility-scope` bổ sung giới hạn nhập điểm theo người phụ trách ở database. Migration `093-exam-schedule-permissions` tách riêng quyền lịch thi và áp dụng cùng phạm vi lớp; xem [Phân quyền lịch thi](exam-schedule-permissions.md). Quyền quản lý hồ sơ không thay đổi.

```powershell
npm --prefix backend run db:migrate
```

Backend kiểm tra quyền trên options, danh sách môn, bảng điểm, lịch sử và thao tác lưu/duyệt. Database tiếp tục kiểm tra phạm vi lớp; giao diện dùng cờ `canEditGrade` do backend cung cấp để khóa dòng ngoài phạm vi. Tư cách thi tự động luôn tính trên danh sách đầy đủ của lớp ghép, không chỉ phần học viên người đang nhập phụ trách.

Kiểm thử database chạy trên database riêng `pgsms_group_scope_test`, không áp dụng migration vào database ứng dụng:

```powershell
npm --prefix backend run build
node backend/test/run-scheduling-scope-db.cjs --runTestsByPath test/integration/gradebook-responsibility-postgres.spec.ts
```
