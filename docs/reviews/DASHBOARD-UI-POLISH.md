# Home dashboard — UI/copy polish

Phạm vi: giữ cấu trúc dashboard hiện tại và working tree từ các task trước. Không commit/push.

## Các file chỉnh trong lượt polish

- `frontend/src/features/dashboard/OperationalDashboard.jsx`: chỉ markup/copy hiển thị.
- `frontend/src/features/dashboard/operationalDashboard.css`: hierarchy, màu, khoảng cách, tương tác.
- `frontend/src/test/integration/OperationalDashboard.test.jsx`: cập nhật assertion theo copy mới, kiểm tra trạng thái rỗng.
- Tài liệu này.

## Wording

- Bỏ nhãn “ĐÀO TẠO SAU ĐẠI HỌC”.
- Tiêu đề: “Bảng điều khiển công việc”.
- Mô tả: “Theo dõi nhanh các đầu việc, cảnh báo và tình hình đào tạo theo năm tuyển sinh.”
- CTA có việc: “Phân nhóm”, “Xếp lịch”, “Nhập điểm”, “Kiểm tra”.
- CTA không có việc: “Xem chi tiết”, thay “Xem phạm vi”; giữ nguyên đích điều hướng.
- Thẻ hoàn tất dùng tiêu đề “Phân nhóm học viên”, “Xếp lịch học”, “Nhập điểm học phần”, “Kiểm tra tiến độ”; giữ các mô tả trạng thái hoàn tất hiện có.
- Việc rỗng: “Không có mục chờ xử lý” / “Mọi đầu việc trong phạm vi hiện tại đã hoàn thành.”
- Cảnh báo rỗng: “Không có cảnh báo” / “Chưa phát hiện vấn đề cần xử lý trong phạm vi hiện tại.”

## Giao diện

Số việc chờ 34px đứng trước tiêu đề navy; badge “Cần xử lý” nhỏ. Thẻ trắng có đường trên và icon pastel theo teal/blue/violet/amber, footer CTA nhạt cùng tông. Thẻ hoàn tất có icon check xanh dịu, đường trên trung tính, không có số 0 lớn. Dùng lại thư viện MUI icons và các token hiện có.

Đường phân cách dưới header và nền xanh nhạt ở tiêu đề panel giúp tách khu vực trên canvas trung tính hiện có. Giữ tỷ lệ việc/cảnh báo 2:1, phần đào tạo là số liệu inline thứ cấp. Padding trạng thái rỗng còn 16px, khoảng cách khu vực 12–14px, bo góc scoped 6–7px. Link thật có hover/focus và mũi tên phản hồi; hỗ trợ reduced motion.

## Kiểm tra

- 16/16 targeted frontend tests qua: OperationalDashboard, dashboardNavigation, FeatureLayout, ProtectedRoute.
- Frontend production build qua (`vite build`); còn cảnh báo bundle lớn hơn 500kB, không có lỗi compile.
- Edge headless: 1366×768, 1024×768, 390×844; lưới 4/2/1, không tràn ngang, không runtime exception. Ở desktop, bốn thẻ kết thúc khoảng y=537 và panel việc bắt đầu y=551; ribbon cao hiện tại được giữ nguyên. Danh sách có nhiều việc vẫn cuộn tự nhiên.
- Focus + Enter mở đúng `/masters/assign-class-groups?year=2026`.
- SHA256 đối chiếu trước/sau xác nhận không đổi backend dashboard/guard/scheduling, helper điều hướng, trang xếp lịch/điểm, RibbonHeader, FeatureLayout, footer. Không đổi permission, metric, API, bộ lọc năm, route hay dữ liệu DB.
- Ảnh local: `.tmp/dashboard-polish-browser/dashboard-fixture-1366.png`, `dashboard-fixture-1024.png`, `dashboard-fixture-390.png`, `dashboard-live-healthy-1366.png`, `dashboard-fixture-partial-error-1366.png`.
- Ảnh có việc/lỗi dùng fixture chỉ trong trình duyệt; ảnh healthy dùng snapshot read-only của service thật. Không seed hoặc ghi DB cho lần polish này.
