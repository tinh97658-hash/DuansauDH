# Triển khai UI/UX và kiểm thử bản tích hợp — 04/11/2026

## Phạm vi và trạng thái

- Worktree: `D:\SauDH\DuansauDH-integration-nt1-vt9`.
- Branch khi bắt đầu: `integration/nt1-vt9-selective`, HEAD: `41d391dc7086de1dca97109ba37b40ef90ea4618`.
- Không merge, rebase hoặc thay đổi hai branch gốc. Đích commit/push theo yêu cầu cuối của người dùng: `nt2`.
- Không thêm migration, seed, dependency ứng dụng hoặc thay đổi cấu hình kết nối.
- Không ghi database thật `pgsms`. Backend đang dùng bản sao `pgsms_integration_review_1793723587935`.
- Frontend: `http://localhost:3100`; backend: `http://localhost:3001`.

## Thay đổi đã triển khai

### Thanh toán giảng viên

Trước đây PUT thành công tăng revision; GET tiếp theo làm rỗng toàn bộ bảng bằng `setRows([])`, khiến chiều cao trang co lại và trình duyệt điều chỉnh cuộn. Hiện tại PUT cập nhật đúng cặp lớp/giảng viên bằng trạng thái backend trả về; không tháo các dòng còn lại và không GET lại danh sách sau một lần tick thông thường.

Mỗi cặp ID có trạng thái đang lưu riêng và chặn gửi trùng khi yêu cầu trước chưa hoàn tất. Lỗi lưu giữ nguyên dữ liệu; bộ lọc vẫn dùng được khi đang lưu một dòng. Nếu bộ lọc thay đổi trong khi PUT đang chạy, danh sách được đồng bộ nền, giữ các dòng hiện có trong lúc chờ.

Khi dòng rời bộ lọc trạng thái, lưu điểm neo của dòng kế tiếp còn hiển thị, bù cuộn tức thời và chuyển focus với `preventScroll`. Tắt native scroll anchoring trong bảng để tránh bù cuộn hai lần. Không dùng cách ép cuộn về đầu trang.

Header có checkbox ba trạng thái, tooltip phạm vi và dialog xác nhận số bản ghi thực sự thay đổi, bộ lọc và hành động. Phạm vi lấy từ backend theo toàn bộ bộ lọc; không giới hạn ở các dòng trong viewport.

API mới:

- `POST /reports/lecturer-payments/batch-preview`: kiểm tra quyền; chốt các cặp cần đổi, trạng thái và phiên bản thanh toán; trả token ký HMAC gắn tài khoản, bộ lọc và hạn 10 phút.
- `PUT /reports/lecturer-payments/batch`: xác minh token, khóa các cặp theo thứ tự ổn định, kiểm tra lại quyền/RLS, điều kiện hoàn thành, bộ lọc và phiên bản; cập nhật trong một transaction. Xung đột hủy toàn bộ và trả 409.

Không tự thêm các dòng mới phát sinh sau preview, không ghi lại các dòng đã có trạng thái đích. Tối đa 10.000 bản ghi thay đổi mỗi lượt; vượt giới hạn phải thu hẹp bộ lọc. Single PUT cũng dùng cùng khóa theo cặp để phối hợp với batch.

Giữ nguyên phép đếm buổi thực tế, thời điểm `completedAt`, bộ lọc đơn vị theo ID, hộp thoại chi tiết và cơ chế xuất báo cáo.

### Xuất file và bảng điểm

- Dùng chung SVG outline: Download, Word xanh dương, Excel xanh lá, PDF đỏ; không thêm thư viện.
- Nhãn phổ thông: `Excel (.xlsx)`, `Word (.docx)`, `PDF (.pdf)`; giữ nhãn nghiệp vụ đặc thù.
- Giữ nút nền trắng, menu portal và chiều rộng/căn cạnh theo nút. Nhãn menu có `aria-label` riêng để tooltip PDF không thay tên truy cập.
- Toolbar giữ hai luồng riêng: `Bảng điểm` → Bảng điểm môn học; `Phiếu theo dõi` → BM.02-QT.SDH.03. Chế độ danh sách thi dùng tên `Danh sách thi`, tooltip mô tả biểu mẫu Lịch thi kết thúc học phần.
- Giữ nguyên các điều kiện khóa xuất, quyền và xử lý điểm chưa lưu.
- Các dialog bảng điểm cá nhân và xuất báo cáo tiến độ dùng cùng bộ icon; không thay luồng xuất.

### Excel phiếu theo dõi học tập

Tách các mốc vật lý metadata/chữ ký khỏi 17 cột logic của bảng điểm bằng `createExcelForm`. Vùng Khóa/Năm/Địa điểm theo tỷ lệ 14/14/72 trong vùng thông tin; Khóa và Năm mỗi vùng khoảng 101 pt, Địa điểm khoảng 519 pt. Ba vùng chữ ký bằng nhau, khoảng 255 pt/vùng.

Giữ đủ cột bảng điểm, các ô 0 và ô trống, tên/ghi chú gốc, Times New Roman, metadata, khổ A4 ngang, vùng in đầy đủ và lặp hai hàng tiêu đề. Không tự điền dữ liệu năm/giảng viên/đơn vị còn thiếu từ API. Word/PDF giữ mẫu biểu hiện có.

### Dropdown và lịch

- Bỏ badge “Đang giảng dạy” ở từng lựa chọn thuộc nhóm đang giảng dạy; giữ tiêu đề nhóm và các trạng thái khác.
- Nút chờ xác nhận dùng component chung: chữ 13px, nền vàng nhạt/chữ nâu đủ tương phản, icon đồng hồ, hover/focus/open/busy, `aria-expanded` và `aria-controls`.
- Phân biệt số 0, chưa tải, đang tải, lỗi tải; lỗi tải lịch thi được lưu riêng khỏi lỗi thao tác xác nhận.
- Giữ nguyên số lượng, điều kiện xem/sửa và luồng xác nhận lịch. Không thiết kế lại thẻ, sidebar hoặc bảng lịch.

## Kiểm thử đã thực thi

| Nhóm | Kết quả |
| --- | --- |
| Build backend | PASS |
| Build frontend sau các thay đổi cuối | PASS; cảnh báo bundle trên 500 kB |
| PostgreSQL thanh toán | PASS: 13 test / 2 suite trên database tạm mới; migrations tới 090 chạy trên DB tạm, sau đó xóa DB tạm |
| Quyền/validation thanh toán | PASS: 6 test |
| Thanh toán UI, menu, Excel, dropdown, nút chờ xác nhận | PASS: 24 test / 6 file |
| Hồi quy xuất báo cáo | PASS sau chạy lại: 71 test / 8 file; ba test xuất lịch nặng cần timeout 120 giây |
| Hai luồng xuất độc lập | PASS: test riêng xác minh hai tài liệu preview khác nhau |
| Nút chờ xác nhận trên hai lịch | PASS: 3 test integration có phạm vi; test component các trạng thái đã PASS trong nhóm 24 test |
| Các điều kiện khóa xuất bảng điểm liên quan | PASS: 6 test trong lượt lọc; assertion toast bị timeout trong lượt chung đã chạy riêng và PASS |
| Trình duyệt Edge — thanh toán/menu/responsive | PASS; fixture/mock, chặn request backend, không ghi dữ liệu |
| Đăng nhập thủ công bằng tài khoản hiện có | NOT TESTED trong lượt sửa này |
| Kiểm tra trực quan bằng Microsoft Excel/Word | NOT TESTED đầy đủ; COM Excel xuất được PDF nhưng báo RPC khi đọc thuộc tính/đóng ứng dụng, không dùng kết quả đó để xác nhận bố cục |

Kiểm thử batch bao gồm bộ lọc AND, bỏ qua dòng đã đúng trạng thái, bỏ tick, không mở rộng danh sách, token sai/hết hạn/khác tài khoản, lớp không còn đủ điều kiện, đổi trạng thái rồi đổi lại, cập nhật đồng thời, RLS và rollback khi một mục không được phép ghi.

Đo trình duyệt với 160 dòng ở viewport 1366×900: scroll trước/trong/sau lưu lần lượt giữ nguyên tại 6799, 3527 và 0 px; không refetch; dòng khác giữ nguyên DOM và vẫn thao tác được. Khi dòng rời bộ lọc, dòng kế tiếp giữ tọa độ 474,75 px và nhận focus. Ở 390×844, bảng giữ 6 cột và cuộn ngang. Menu rộng/căn trái đúng bằng nút (~159,08 px); các nhãn phổ thông một dòng; không có exception trong lượt kiểm tra hoàn tất.

Các test print hiện có tạo PDF/screenshot cho biểu mẫu; test Excel đọc lại workbook, kiểm tra merge, độ rộng vật lý, row heights và print area. Cảnh báo JSDOM không parse được CSS margin boxes và navigation không được hỗ trợ xuất hiện ở một số test print; không sửa CSS in chỉ để loại cảnh báo môi trường test.

Artefact kiểm tra nằm trong thư mục ignored `.tmp/`:

- `subject-signing-ux-sample.xlsx`, `subject-signing-sample.docx`.
- `subject-signing-preview-{11,15,55}.pdf` và ảnh tương ứng.
- `ux-verification/browser-result.json`, `ux-verification/controls.png`.

## Giới hạn và nghiệm thu

Không tuyên bố đã kiểm thử toàn bộ nghiệp vụ ứng dụng. Lượt chạy toàn bộ hai file lịch quá chậm trên máy hiện tại đã dừng để chạy riêng các case liên quan đến nút chờ xác nhận; kết quả của lượt toàn bộ đó không được tính PASS. Cần người dùng nghiệm thu trực quan file Office và giao diện với dữ liệu thực tế.

Đây chưa phải bước chuyển sang database thật. Việc dọn dữ liệu trùng/chạy migration 088–089 hoặc cutover database vẫn ngoài phạm vi và chưa được thực hiện.

## Danh sách file

Danh sách dưới đây chỉ gồm thay đổi của lượt triển khai này; không xóa file ứng dụng.

- `backend/src/reports/dto/lecturer-payment.dto.ts`
- `backend/src/reports/lecturer-payment.service.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/test/integration/lecturer-payment-postgres.spec.ts`
- `backend/test/run-lecturer-payment-db.cjs`
- `backend/test/unit/lecturer-payment-permissions.spec.ts`
- `frontend/src/components/DocumentExportMenu.jsx`
- `frontend/src/components/ReportExportIcons.jsx`
- `frontend/src/components/documentExportMenu.css`
- `frontend/src/features/exams/OfferingOptions.jsx`
- `frontend/src/features/exams/subjectSigningExport.js`
- `frontend/src/features/learners/LearnerTranscriptDialog.jsx`
- `frontend/src/features/scheduling/ClassProgressExportDialog.jsx`
- `frontend/src/features/scheduling/Schedule.jsx`
- `frontend/src/features/scheduling/shared.jsx`
- `frontend/src/features/scheduling/workspace.css`
- `frontend/src/pages/masters/examLists.jsx`
- `frontend/src/pages/masters/examSchedule.jsx`
- `frontend/src/pages/reports/lecturerPayments.css`
- `frontend/src/pages/reports/lecturerPayments.jsx`
- `frontend/src/test/integration/AdmissionDocumentExport.test.jsx`
- `frontend/src/test/integration/ClassCourseHistory.test.jsx`
- `frontend/src/test/integration/DocumentExportAlignment.test.jsx`
- `frontend/src/test/integration/ExamLists.test.jsx`
- `frontend/src/test/integration/ExamSchedule.test.jsx`
- `frontend/src/test/integration/LecturerPayments.test.jsx`
- `frontend/src/test/integration/PageExportBoundary.test.jsx`
- `frontend/src/test/integration/ScheduleCalendar.test.jsx`
- `frontend/src/test/integration/ScheduleExport.test.jsx`
- `frontend/src/test/unit/OfferingOptions.test.jsx`
- `frontend/src/test/unit/subjectSigningExport.test.js`
- `backend/test/integration/lecturer-payment-batch-postgres.spec.ts`
- `frontend/src/features/scheduling/PendingConfirmationButton.jsx`
- `frontend/src/test/integration/LecturerPaymentInteraction.test.jsx`
- `frontend/src/test/unit/PendingConfirmationButton.test.jsx`
- `docs/ui-ux-integration-verification-2026-11-04.md`

## Bổ sung: lỗi runtime React khi chạy đồng thời bản gốc và tích hợp

Sau nghiệm thu phát sinh `Cannot read properties of null (reading 'useContext')` từ MUI. `frontend/node_modules` của bản tích hợp là junction tới bản gốc; cache optimizer mặc định vì vậy cũng dùng chung giữa các dev server. Stack lỗi có hai chunk React khác nhau. Kiểm tra HTTP 200 đơn thuần trước đó không phát hiện được lỗi render này.

Đã sửa `frontend/vite.config.js`: dùng cache riêng trong `.tmp/vite-cache/<mode>` của worktree và `resolve.dedupe` cho React, React DOM, Emotion; khởi động lại riêng hai tiến trình tích hợp trên 3100/3001. Không xóa cache hoặc dừng tiến trình của bản gốc. Cấu hình này dựa trên [tùy chọn cacheDir và resolve.dedupe của Vite](https://vite.dev/config/shared-options).

Kiểm tra lại bằng Edge với các component thực, dữ liệu fixture và request backend bị chặn: thanh toán 160 dòng và bảng điểm đều render, không có runtime exception. Backend health/ready và frontend trả 200. Người dùng cần tải lại tab cũ để bỏ các module đang giữ trong trình duyệt.

## Quyết định UI mới nhất của người dùng

Người dùng yêu cầu bỏ nút xuất “Bảng điểm”, chỉ giữ “Phiếu theo dõi” trên toolbar bảng điểm. Sau đó hủy yêu cầu chọn nhiều dòng thanh toán: màn Thanh toán giảng viên hiện giữ 6 cột và checkbox “Đã thanh toán” riêng từng dòng, không có checkbox chọn tất cả, cột chọn dòng, thanh thao tác hoặc dialog thanh toán hàng loạt. Giữ sửa lỗi cuộn và lưu từng cặp ID. Phần mở rộng API nhận danh sách dòng vừa thử triển khai đã hoàn tác; không thay đổi dữ liệu thanh toán.

Theo yêu cầu tiếp theo, đã bỏ nút Xuất Excel ở màn Thanh toán giảng viên và đổi nhãn Phiếu theo dõi thành Xuất báo cáo; vẫn xuất biểu mẫu BM.02-QT.SDH.03. Hai kiểm thử liên quan đã PASS. Kiểm thử thanh toán sau khi bỏ tick tất cả: 13/13 PASS. Build frontend cuối: PASS (cảnh báo kích thước bundle); build backend và 6 test quyền/validation: PASS. API thanh toán đã được xác minh có đăng ký trên backend tích hợp port 3001; backend gốc chiếm trùng port đã dừng, không chỉnh cấu hình DB hoặc source của bản gốc.
