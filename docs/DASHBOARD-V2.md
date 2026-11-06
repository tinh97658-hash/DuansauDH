# Dashboard V2

## Phạm vi và Git

Nhánh làm việc: `feat/dashboard-v2`, tạo từ `nt4` tại `387bef8`. Khi bắt đầu, `origin/tinh10` ở `92fa60b`; `nt4` chỉ có thêm commit thanh toán `387bef8`, không có thay đổi chưa commit. Commit thanh toán được giữ nguyên. Không merge, commit hoặc push phần Dashboard.

Không tìm thấy `Dashboard_V2_Mockup.html` trong repository và thư mục attachments. Bố cục được triển khai theo bản yêu cầu: lời chào và bộ lọc cùng hàng; công việc bên trái; phê duyệt và một biểu đồ bên phải; màu trắng, xanh dương, teal, không tím.

Dashboard chỉ đọc và điều hướng. Không thay đổi thuật toán phân nhóm, xếp lịch, xác nhận học/thi, tính điểm, workflow gửi/duyệt/mở điểm, bảo lưu/gia hạn, chuyển ngành, công nhận học phần, theme chung hoặc quy tắc cấp quyền/RLS. Không thêm migration và không chạy migration trên database thật.

## File thay đổi

Backend:

- `backend/src/dashboard/dashboard.service.ts`: tổng hợp chỉ đọc, bốn tầng điểm, biểu đồ và lịch sử hoạt động; áp dụng các read domain hiện có của trang đích.
- `backend/src/dashboard/dashboard.controller.ts`: chấp nhận các section chỉ đọc mới.

Frontend:

- `frontend/src/features/dashboard/OperationalDashboard.jsx`: bố cục, tab, xem trước, drill-down phê duyệt và biểu đồ.
- `frontend/src/features/dashboard/operationalDashboard.css`: CSS riêng cho Dashboard và phần header Dashboard.
- `frontend/src/features/dashboard/useDashboardData.js`: tải, thử lại từng nguồn, polling và loại response cũ theo hồ sơ/năm/hệ.
- `frontend/src/features/dashboard/DashboardActivity.jsx`: chuông và danh sách hoạt động chỉ đọc.
- `frontend/src/components/RibbonHeader.jsx`: chỉ ở trang tổng quan, bổ sung chuông và tên nhân sự/hồ sơ; giữ hamburger, menu, đổi hồ sơ và đăng xuất.

Kiểm thử:

- `backend/test/unit/dashboard.service.spec.ts`
- `backend/test/integration/dashboard-v2-postgres.spec.ts`
- `backend/test/run-dashboard-db.cjs`
- `frontend/src/test/integration/OperationalDashboard.test.jsx`
- `frontend/src/test/integration/RibbonPermissions.test.jsx`

Tài liệu: `docs/DASHBOARD-V2.md`.

Không sửa `viewLogged.js`, `navigation.js`, `AuthSession.js`, `usePermissions.js`, các file auth/RBAC hoặc service nghiệp vụ gốc: các giao diện và cơ chế hiện có đã đủ để tích hợp.

## Dữ liệu và tương tác

- Tab Tất cả hiển thị từng nhóm với đơn vị riêng. Tên/Chi tiết chuyển tab; Xem trước mở tại chỗ; mũi tên mở trang nghiệp vụ. Không cộng học viên, lớp và buổi thành một tổng.
- Phân nhóm dùng nguyên `listEligibleStudents()` và phạm vi chuyên ngành hiện có, loại trùng ID học viên; tab chi tiết hiển thị đầy đủ các chuyên ngành có việc.
- Lịch học phân biệt lớp active không có buổi nào với tổng buổi đã qua giờ chưa xác nhận. Đọc `sessionSummary` hiện có; giữ year/offeringId/queue trên URL trang lịch học.
- Điểm sử dụng kết quả `ExamGradebookService.tracking()` / `gradebookStage()` hiện có, không sửa quy tắc phân loại. Bốn tầng: `components_missing`, `awaiting_exam`, `exam_missing`, `result_ready`. Mỗi tầng mở rộng riêng; không trộn danh sách theo số ngày chung.
- Mốc chờ điểm thành phần lấy từ hoàn thành giảng dạy, mốc sau thi lấy từ tracking xác nhận thi. Không có mốc đáng tin thì không hiển thị số ngày. Không đặt hạn hoặc cảnh báo khẩn cấp tự tạo.
- Đọc ca thi `scheduled` để phân biệt có lịch sắp tới, ca qua giờ chưa xác nhận và chưa có lịch. Lịch tương lai không bị coi là quá hạn. Chỉ mở xếp lịch thi khi có đúng `exams.view`/`exams.write`, quyền trang tương ứng và danh sách thi đã duyệt; nếu không, mở bảng điểm.
- Tầng `result_ready` dành cho quyền gửi điểm; tách khỏi khung người duyệt. Không thêm thao tác gửi/duyệt tại Dashboard.
- Khung Chờ phê duyệt chỉ hiện loại người dùng được duyệt, mở danh sách ngay tại khung và có nút quay lại. Đếm toàn bộ yêu cầu, không lấy số dòng xem trước làm tổng. Bảo lưu/gia hạn và chuyển ngành mở đúng hồ sơ; điểm mở offeringId/groupId trong năm phù hợp.
- Phạm vi dữ liệu dùng `effectiveAccess()` của hồ sơ hiện tại và các context đọc sẵn có: schedule, gradebook, admission, study leave. Không dùng tên role để tự cấp quyền. HTTP profile cần quyền trang/thao tác tương ứng ngoài capability nghiệp vụ.

## Biểu đồ

Chỉ có một biểu đồ hiển thị tại một thời điểm; chọn chủ đề trong cùng khung.

- Hồ sơ/học viên: cần quyền tuyển sinh và quyền trang. Dùng `learnerStudyStatusSql()` như màn hồ sơ để phân biệt trạng thái đào tạo với xét tuyển, bao gồm trạng thái phụ thuộc học phí. Mỗi hồ sơ một lần, lọc đúng hệ/năm. Nhãn giữ trạng thái thực; chỉ dùng trạng thái xét tuyển nếu thiếu trạng thái đào tạo.
- Buổi học trong tuần: cần quyền xem lịch học và quyền trang. Tuần hiện tại thứ Hai–Chủ nhật theo giờ Việt Nam. Chỉ tính `planned`, `held`, `not_held`; loại lịch hủy, không cộng lớp chưa xếp lịch. COUNT DISTINCT tránh nhân đôi lớp ghép.
- Hoàn thành giảng dạy: sáu tháng gần nhất, theo `completed_at` của lớp completed, COUNT DISTINCT offeringId. Lớp thiếu ngày hoàn thành không được tự gán ngày.
- Mỗi biểu đồ có trạng thái lỗi/thử lại riêng. Số 0 từ truy vấn thật hiển thị trạng thái chưa có dữ liệu, không thêm dữ liệu minh họa.

## Chuông hoạt động và phần chưa triển khai

Chuông ở header trang Dashboard, chỉ tải danh sách khi mở. Đọc sự kiện `result.submit`/`result.approve` trong `gradebook_events`, lịch sử bảo lưu/gia hạn và trạng thái yêu cầu chuyển ngành. Mỗi mục mở bản ghi gốc; chỉ lấy nguồn mà hồ sơ được phép xem. Có tối đa 20 hoạt động gần đây, độc lập với tổng công việc/yêu cầu chờ xử lý.

**Chưa triển khai lưu trạng thái đã đọc/chưa đọc bền vững**, vì chưa có backend lưu trạng thái này và yêu cầu không cho tự tạo cơ chế ghi hoặc migration. UI nói rõ giới hạn, không hiển thị badge giả là số chưa đọc và không biến việc xem thông báo thành hoàn tất công việc. Nguồn hoạt động có thể trả partial nếu một nguồn lỗi.

**Chưa bổ sung provider Tiến sĩ** cho các nghiệp vụ chưa có hợp đồng đọc tương đương. Trả `not_implemented`, không lấy dữ liệu Thạc sĩ thay thế. Biểu đồ chưa triển khai bị ẩn; công việc phù hợp quyền có thông báo riêng, không báo hoàn thành giả.

Trang xếp lịch thi hiện chỉ hỗ trợ chọn offeringId từ URL, không khởi tạo bộ lọc năm/chuyên ngành từ query. Dashboard vẫn truyền các tham số, nhưng không sửa trang nghiệp vụ để thêm khả năng đó. Trang bảng điểm và lịch học sử dụng các tham số được hỗ trợ sẵn. Trang hồ sơ mở đúng recordId; không tự thêm trình chọn requestId mới.

## Xác minh

- Backend `npm run build` và `npm run typecheck`: đạt.
- Backend unit Dashboard và quyền thanh toán: **40/40**, trong đó Dashboard **33**.
- PostgreSQL `node test/run-dashboard-db.cjs`: **6/6**. Runner tạo database riêng có tên `pgsms_dashboard_test_<timestamp>`, áp dụng migration trên database tạm rồi xóa database khi kết thúc. Bao gồm truy vấn SQL chống đếm trùng/lẫn năm/hệ và tích hợp Nest/RBAC/RLS thật với hồ sơ được chọn hoặc chưa chọn.
- Frontend **91/91 trong 7 suite**: Dashboard, RibbonPermissions, dashboardNavigation, DashboardScheduleLinks, ProtectedRoute, LecturerPayments và LecturerPaymentInteraction.
- Frontend `npm run build`: đạt; còn cảnh báo chunk export lớn đã có sẵn.
- Edge headless ở **1440, 1024, 390 px**: không tràn ngang, không lỗi JavaScript; tab bàn phím, mở bốn tầng điểm, drill-down/quay lại hoạt động được. Ảnh kiểm tra dùng fixture bị chặn riêng trong trình duyệt, không seed vào app.
- Kiểm tra dịch vụ chỉ đọc trên database hiện tại dưới context hồ sơ admin: mọi nguồn Dashboard và activity đều ready; activity không partial. Thống kê quan sát tại thời điểm kiểm tra: 278 hồ sơ, 20 buổi trong tuần, 3 lớp hoàn thành trong sáu tháng gần nhất. Không có câu lệnh ghi dữ liệu trong lượt đọc này.
- Backend local đã khởi động lại từ build mới ở cổng 3001; frontend Vite tiếp tục ở cổng 3100. Không chạy migration, reset hoặc seed trên database thật.
- Kiểm tra diff theo base `387bef8`: chỉ các file được liệt kê ở trên thay đổi; các module nghiệp vụ/RBAC giữ nguyên. Artifact, ảnh và log trong `.tmp/` được ignore.

Không tuyên bố đã chạy toàn bộ bộ kiểm thử của dự án; kết quả trên chỉ bao gồm phạm vi và hồi quy liên quan đã liệt kê.
