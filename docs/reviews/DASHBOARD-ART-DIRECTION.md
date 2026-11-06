# Home — visual art direction pass

## Phạm vi

Chỉ chỉnh `frontend/src/features/dashboard/OperationalDashboard.jsx` và `frontend/src/features/dashboard/operationalDashboard.css`, kèm tài liệu này. Không commit/push/reset; giữ local work từ các task trước.

JSX chỉ đổi cách trình bày healthy: icon tính năng giữ nguyên, dấu check chuyển thành trạng thái nhỏ “Đã hoàn tất”, mô tả giữ nguyên. Không đổi phép tính, API, permission, deep link, year behavior, rule nghiệp vụ hoặc kiến trúc trang.

## Art direction

- Canvas cool neutral `#F5F8FB`; surface trắng, border dùng `--table-border-color`, divider dùng `--border-light`. Không đổi nền ribbon/header toàn cục.
- Token scoped `--dashboard-*` cho canvas/surface/border/hairline/text/muted/navy/primary, bốn accent tính năng, success và shadow. Dùng lại `--surface-bg`, `--text-primary`, `--text-secondary`, `--primary-dark`, `--primary-light`, `--warning`, `--warning-light`, `--success` của dự án.
- Navy `#17324D`, brand CTA `--primary-dark` (`#056A8F`), grouping teal `#087E86`, scheduling blue `#176EB5`, grades violet `#6953AA`, attention amber `--warning` (`#B86216`). Green `--success` (`#137B3B`) chỉ biểu thị hoàn tất.
- Tiêu đề 26px/700 với nét brand dọc ngắn, 23px ở màn hình nhỏ; năm tuyển sinh là label nhỏ và select trắng đồng bộ.
- Thẻ trắng bo 9px, icon tile 38px bo 8px; số việc 32px/700, tên 14px/600. Pending có nét accent 3px và dot “Cần xử lý”; healthy bỏ nét accent, giữ icon tính năng, mô tả slate và dấu hoàn tất nhỏ. CTA mọi trạng thái dùng xanh VMU trên nền trắng, tách bằng hairline, không còn footer pastel lớn.
- Panel heading nền trắng, chữ navy 14px/700, icon tile nhỏ và metadata bên phải; bỏ dải tiêu đề xanh nhạt. Border và shadow hai lớp rất nhẹ tạo độ sâu.
- Work queue dùng dot theo nhóm, hàng tối thiểu 42px, số lượng và mũi tên canh phải. Warning giữ nền trắng và tile amber. Overview giữ bốn metric cells với divider mảnh, số 26px, dot nhỏ.
- Hover 160ms: viền hướng brand blue, shadow nhích nhẹ, icon tile rõ hơn, mũi tên dịch 2px. Focus ring rõ, hỗ trợ reduced motion. Không thêm dependency/font mới.

## Xác minh

- Targeted frontend: 16/16 tests qua (OperationalDashboard, dashboardNavigation, FeatureLayout, ProtectedRoute).
- Production frontend build bản cuối qua (`vite build`, exit 0); còn cảnh báo chunk lớn hơn 500kB, không có lỗi compile.
- Đối chiếu SHA256: backend dashboard, scheduling service/guard, navigation helper, Schedule, examLists, RibbonHeader, FeatureLayout và footer không đổi so với trước các lượt visual polish.
- Edge headless kiểm tra 1366×768, 1024×768, 390×844: lưới 4/2/1, không tràn ngang, focus + Enter mở đúng route và giữ năm 2026, không runtime exception.
- Geometry bản cuối: thẻ có việc cao khoảng 125px; tại 1366×768, bốn thẻ kết thúc y≈531 và vùng việc/cảnh báo bắt đầu y≈545. Cảnh báo và nhóm việc đầu nằm trong viewport đầu; queue dài vẫn cần cuộn.
- Đã xem ảnh pending, healthy và mobile thực tế. Sau review chỉnh thêm màu navy scoped để tránh CSS heading toàn cục ghi đè, giảm padding thẻ và đồng bộ gap 14px. Ribbon và cấu trúc việc/cảnh báo 2:1 giữ nguyên; danh sách dài cuộn tự nhiên.
- Ảnh và geometry bản cuối nằm trong `.tmp/dashboard-art-direction-browser/` (local, không đưa vào Git). Ảnh `dashboard-fixture-*` dùng dữ liệu mô phỏng chỉ trong trình duyệt; ảnh `dashboard-live-healthy-1366.png` dùng snapshot read-only của service thật. Không ghi dữ liệu DB.
