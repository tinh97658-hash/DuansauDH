# UI tạo lớp, phân nhóm và quyền ghép — 08/09/2026

1. UI Tạo lớp: frontend/src/pages/masters/courseOfferings.jsx, courseOfferings.css và frontend/src/components/CourseOfferingRoster.jsx.
2. Đã đối chiếu đủ 5 mockup bằng browser 1920 × 920: cột 28/72 và 56/44; dropdown đo được 51px; checkbox lớn; phân biệt selected/ĐANG XEM; footer căn phải; bảng xác nhận 4 cột, panel 1484px; success card 824px. Desktop 1440 không tràn ngang. Chuyển bước về đầu trang. Đổi tên/ghi chú sau tạo nằm trong phần chi tiết đóng mặc định.
3. Frontend chặn phân nhóm: frontend/src/pages/masters/assignClassGroups.jsx. Giữ record và mã nhóm hiện tại; disabled checkbox/row đã phân; chọn tất cả chỉ lấy học viên hợp lệ; dọn selection khi lọc/refresh; auto-assign chỉ lấy người chưa phân.
4. Backend: backend/src/masters/masters.service.ts. Kiểm tra toàn bộ trước bulkCreate, không xóa nhóm cũ để chuyển nhóm; transaction và khóa admission/student.
5. Không thêm constraint/migration: scope ở bảng nhóm (nhóm gốc có parentGroupId=null, cùng program + majorId + academicYear). Unique(studentId) sẽ chặn nhầm năm/ngành khác. Không áp rule này vào lớp con và roster Lớp HP.
6. Quyền ghép theo học phần tái sử dụng Subject.allowCrossMajor / subjects.allow_cross_major, chính là control cũ “Cho phép ghép lớp khác ngành”. Alias thể hiện quyền của học phần gốc.
7. Không thêm boolean. SubjectPackage.canMerge vẫn giữ quyền ghép cấp gói đã có; không đổi model/schema hoặc nghiệp vụ gói.
8. Sửa overlap trong frontend/src/components/SubjectIdentityFields.jsx: một checkbox “Có thể ghép lớp”; label riêng trên dropdown; grid co giãn. Browser đo label cách control 6px, không overlap/tràn ngang.
9. backend/src/plan/plan.service.ts cho phép tắt quyền mà giữ mapping/lớp đang tham chiếu. backend/src/scheduling/scheduling.service.ts kiểm tra quyền khi ghép khác chuyên ngành; tạo/xếp riêng vẫn hợp lệ.
10. Kiểm tra trực tiếp đều pass:
    - Tạo lớp 2 nhóm/4 học viên duy nhất; preview độc lập; quay lại giữ ghi chú; đổi tên/ghi chú, reload, tạo lớp khác, sang lịch và lưu buổi. Lịch cũ 4+2 buổi giữ nguyên.
    - HV1 vào A; reload; target B khóa checkbox; API 409 nêu mã A. Bulk [HV2, HV1] không ghi dở; HV2 sau đó gán B thành công. Hai request đồng thời: một 201, một 409. Auto-assign không vượt guard.
    - PostgreSQL: cùng Student được vào nhóm năm khác; hồ sơ thứ hai cùng năm vẫn bị chặn.
    - Bật quyền trên UI, lưu/reload, ghép Khai thác hàng hải và Kinh tế vận tải biển rồi xếp buổi thành công.
    - Tắt quyền trên UI, lưu/reload, API ghép khác ngành 400; UI không đưa nhóm khác ngành vào lựa chọn; từng ngành vẫn tạo lớp/xếp riêng được; mapping còn nguyên.
    - Không có lỗi browser network/console ngoài các API âm tính gọi riêng, đã xác nhận đúng 400/409.
11. Frontend: 23 test trong 5 suite liên quan pass; SchedulingPages 6 test chạy lại sau chỉnh cuộn trang. Backend: 60 test trong 4 suite liên quan pass. Frontend/backend build pass; git diff --check pass. Chỉ còn cảnh báo Browserslist cũ không chặn build.

Ảnh: [chọn lớp — đầu](../backend/coverage/real-mockup-1-selection-top.png), [cuối](../backend/coverage/real-mockup-2-selection-bottom.png), [xác nhận — đầu](../backend/coverage/real-mockup-3-confirmation-top.png), [cuối](../backend/coverage/real-mockup-4-confirmation-bottom.png), [thành công](../backend/coverage/real-mockup-5-success.png), [phân nhóm](../backend/coverage/real-rule-assignment-disabled.png), [quyền ghép bật](../backend/coverage/real-rule-shared-subject-on.png), [tắt](../backend/coverage/real-rule-shared-subject-off.png).

[Diff cuối](../backend/coverage/final-ui-rules.diff) là diff tích lũy so với HEAD của các file liên quan, gồm cả thay đổi đã có từ lượt trước. [Danh sách file đợt này](../backend/coverage/final-ui-rules-files.json).

URL: http://localhost:3100/masters/course-offerings · http://localhost:3100/masters/assign-class-groups · http://localhost:3100/plan/training-plan · http://localhost:3100/masters/schedule.
Tài khoản local admin@example.com có quyền quản lý xếp lịch; dùng ADMIN_PASSWORD hiện có, không ghi mật khẩu vào báo cáo.

Dữ liệu kiểm tra mới giữ local ở năm 2027 và một kiểm tra scope năm 2028. Manifest: backend/coverage/rule-check.json. Dùng học phần thật Bảo vệ môi trường biển; quyền đã trở về tắt sau kiểm tra. Không thay các model, migration và lockfile trong đợt này. Đối chiếu SHA-256 xác nhận chỉ ba file nguồn backend nêu trên thay đổi.
