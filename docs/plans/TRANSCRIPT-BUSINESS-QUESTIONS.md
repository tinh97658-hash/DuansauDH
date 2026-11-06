# Transcript: câu hỏi nghiệp vụ cần chốt

Baseline hiện hành: GPA hiển thị **—**; chức danh người ký có, tên để trống. Không thay đổi resolver điểm, dữ liệu thật hoặc schema trong pipeline.

## GPA

Evidence:

- `backend/src/database/models/plan/admission-record.model.ts`: `gpa` là điểm trung bình đại học đầu vào.
- `backend/src/plan/admission-scoring.ts`: `gpa10` dùng xét tuyển/tie-break.
- `backend/src/database/models/training/course-exam-gradebook.model.ts`: `courseScore` và `grade4` từng môn.
- `backend/src/masters/exam-gradebook.service.ts`: lưu điểm từng môn, không có công thức GPA sau đại học chính thức.
- `backend/src/reports/class-score-summary.service.ts`: resolver bảng điểm hiện hành không cung cấp GPA tổng hợp.

Cần quyết định trước khi hiển thị GPA thật:

1. Thang chính thức 4, 10 hay cả hai? Field/service chính thức nào cung cấp?
2. Có trọng số tín chỉ không? Làm tròn bao nhiêu chữ số, tại bước nào?
3. Môn chưa có điểm/incomplete, miễn học, miễn thi, công nhận, chuyển tín chỉ được xử lý thế nào?
4. Môn không đạt/học lại chọn lần thi nào? Chính sách thay thế điểm và tín chỉ tính GPA?
5. GPA lưu cố định hay tính tại thời điểm xuất? Nếu lịch sử thay đổi điểm, bảng điểm đã phát hành dùng snapshot nào?

## Người ký

Evidence:

- `backend/src/database/models/staff.model.ts`: tài khoản/role admin, supervisor, examiner; chưa ánh xạ người ký bảng điểm.
- `backend/src/database/models/common/unit.model.ts`: thông tin đơn vị, chưa có lãnh đạo/người ký.
- `frontend/src/config/branding.js`: branding tổ chức; không có signer chính thức.
- `frontend/src/pages/system/unitInfo.jsx`: trang thông tin đơn vị, chưa cung cấp mapping signer.
- `frontend/src/features/scheduling/scheduleExport.js`: biểu mẫu khác giữ chức danh và khoảng trống ký, không tự chọn tên.

Cần xác định nguồn chuyên viên và viện trưởng; người được ủy quyền; phạm vi theo đơn vị/chương trình/toàn trường; thời gian hiệu lực; ai có quyền cấu hình; bảng điểm lịch sử dùng tên tại ngày phát hành hay cấu hình hiện tại.

## Phát hành

Chưa có nguồn số văn bản chính thức. Phần số giữ trống; khóa chỉ dùng `academicYear` thật, không suy diễn khoảng năm. Ngày trên bản xuất dùng helper business timezone `Asia/Ho_Chi_Minh` hiện hành. Cần xác nhận nguồn số văn bản và ngày phát hành nếu khác ngày tạo bản xuất.

Số bằng thạc sĩ để trống trên PDF/DOCX và thời gian đào tạo giữ **—** khi API không có nguồn chuẩn; không dùng số bằng đại học đầu vào hay suy từ khóa.
