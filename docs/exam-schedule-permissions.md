# Phân quyền lịch thi

Lịch thi có hai quyền riêng trong nhóm **Thi & điểm**:

| Quyền | Chức năng |
| --- | --- |
| **Xem lịch thi** (`exams.view`) | Mở lịch, xem danh sách chờ xếp, xem ca thi và xuất lịch trong phạm vi được phép |
| **Xếp, sửa và xác nhận lịch thi** (`exams.write`) | Tạo buổi/ca thi, sửa, hủy, xác nhận đã diễn ra hoặc không diễn ra |

Để sử dụng đầy đủ giao diện xếp lịch thi, cấp cả hai quyền. Có quyền xem bảng điểm hoặc xếp lịch học không tự cho phép truy cập/thay đổi lịch thi. Chế độ **Chỉ xem** luôn chặn thao tác ghi.

## Phạm vi lớp

- Chuyên viên chỉ truy cập lớp mình phụ trách và lớp ghép có ít nhất một lớp mình phụ trách.
- Với lớp ghép A + B, người phụ trách A hoặc B đều có thể xếp và xử lý lịch thi cho toàn bộ lớp ghép.
- Admin có phạm vi toàn bộ, nhưng vẫn phải có quyền hành động tương ứng.
- Khi sửa một buổi thi chứa nhiều **lớp học phần** khác nhau, tất cả lớp học phần đó phải nằm trong phạm vi phụ trách. Nếu có lớp học phần ngoài phạm vi, không cho sửa chung phòng/giờ của buổi. Vẫn được xác nhận hoặc hủy ca thi thuộc phạm vi của mình theo quy trình.

“Lớp ghép” của một lớp học phần khác với “buổi thi ghép” chứa nhiều lớp học phần. Việc phụ trách một lớp hành chính trong lớp học phần ghép cho phép xử lý toàn bộ lớp học phần đó; không mở thêm quyền với các lớp học phần không liên quan trong cùng buổi thi.

Backend vẫn kiểm tra trùng phòng, giám thị và học viên trên toàn bộ lịch thi, kể cả lịch không hiển thị cho tài khoản. Lọc hiển thị không làm mất kiểm tra xung đột.

## Áp dụng

Chạy migration `093-exam-schedule-permissions`:

```powershell
npm --prefix backend run db:migrate
```

Migration tạo hai quyền mới, đổi tên quyền lịch cũ thành **Xếp, sửa và xác nhận lịch học**, đồng thời giữ các hành động đã có: vai trò vốn xem lịch thi qua quyền xem lịch học/bảng điểm được chuyển sang quyền xem lịch thi; vai trò vốn có quyền xếp lịch học được chuyển thêm quyền thao tác lịch thi. Từ đó hai quyền được quản trị độc lập, với phạm vi lịch thi giới hạn như trên. Không cấp quyền ghi lịch thi chỉ vì tài khoản có quyền nhập hoặc duyệt điểm.

Sau migration, vào **Phân quyền → Vai trò → Thi & điểm**, đánh dấu hai quyền lịch thi cho vai trò cần dùng. Đăng nhập lại để tải lại quyền. Tài khoản Vũ Đức Tình chỉ được thao tác lịch thi khi vai trò của tài khoản được cấp `exams.write`; không tự cấp thêm quyền này cho tài khoản cụ thể.

Kiểm tra database trên database thử nghiệm riêng:

```powershell
npm --prefix backend run build
node backend/test/run-scheduling-scope-db.cjs --runTestsByPath test/integration/gradebook-responsibility-postgres.spec.ts
```
