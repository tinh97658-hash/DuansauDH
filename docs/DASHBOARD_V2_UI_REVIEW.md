# Dashboard V2 — UI Review

## Baseline

- Branch: `feat/dashboard-v2`.
- HEAD: `387bef8eeb1d07966f11b676e849e59e321a0e65`.
- Trước khi sửa UI có 13 file Dashboard thay đổi chưa commit từ lượt triển khai chức năng. Đã lưu bản sao và SHA-256 trong `.tmp/dashboard-v2-ui-baseline/manifest.json` trước khi chỉnh.
- Các file có sẵn: backend Dashboard service/controller; backend unit/integration test và runner; RibbonHeader; OperationalDashboard và CSS; test Dashboard/Ribbon; DashboardActivity; useDashboardData; `docs/DASHBOARD-V2.md`.
- Giữ nguyên branch/HEAD và toàn bộ thay đổi có sẵn. Không reset, clean, stash, rebase, merge, commit hoặc push.
- Bộ ZIP đã được kiểm tra và giải nén vào `.tmp/dashboard-v2-ui-reference/`. Đã đọc README/HTML và xem trực tiếp cả bốn ảnh tham chiếu trước khi chỉnh. Chỉ tham khảo bố cục, không sao chép JS hoặc số liệu mockup vào ứng dụng.

## Các vấn đề UI đã xác định

| Vấn đề | Cách sửa | Trạng thái |
|---|---|---|
| Nhóm công việc cao, tách rời thành các ô | Danh sách thống nhất, mỗi dòng desktop 88px, chỉ một đường phân cách nhẹ | Đã sửa |
| Chi tiết, xem trước và mở chức năng bị tách xuống hàng | Đặt cùng cụm bên phải; icon mở rộng giữ tên truy cập được và handler cũ | Đã sửa |
| Nhóm 0 chiếm chiều cao lớn | Mô tả trạng thái ngay dưới tên; 72px trên desktop, 77–78px ở ảnh mobile | Đã sửa |
| Viền xanh xám đậm giống bảng hành chính | Dùng viền `#e1eaf1`, đường phân cách nhạt hơn, bóng rất nhẹ | Đã sửa |
| Card vuông, phân cấp typography yếu | Bo card 13px trong CSS layer riêng Dashboard; tên đậm, mô tả nhỏ, số đếm rõ | Đã sửa |
| Ba dòng phê duyệt cách xa, đặc biệt khi đều 0 | Dòng gọn, icon nhỏ; thêm thông báo rỗng khi tất cả nguồn đã tải và đều 0; vẫn mở được từng nhóm | Đã sửa |
| Dropdown và mô tả dài đẩy biểu đồ xuống | Đặt dropdown cùng hàng tiêu đề; đưa mô tả xuống dưới hình và chú giải | Đã sửa |
| Tầng điểm thiếu cụm tên/mô tả và khung mở rộng rõ | Accordion bo 10px, số tầng, tên/mô tả, số lớp và chevron; giữ nguyên bốn tầng cùng dữ liệu | Đã sửa |

## Những file đã thay đổi

- `frontend/src/features/dashboard/OperationalDashboard.jsx`: chỉ markup trình bày, icon, mô tả ngắn và trạng thái phê duyệt rỗng. Không đổi cách lấy dữ liệu, số liệu, quyền, URL hay handler nghiệp vụ.
- `frontend/src/features/dashboard/operationalDashboard.css`: bố cục, khoảng cách, màu viền, typography, bo góc và responsive riêng Dashboard. Phần CSS header/account/activity từ `.od-header-account` trở xuống được giữ nguyên từng byte.
- `frontend/src/test/integration/OperationalDashboard.test.jsx`: thêm hai kiểm thử giữ thao tác của nhóm phê duyệt 0 và không báo rỗng khi một nguồn lỗi; giữ toàn bộ kiểm thử cũ.
- `docs/DASHBOARD_V2_UI_REVIEW.md`: báo cáo bàn giao này.

Các file `.tmp/` chỉ chứa baseline, tham chiếu, script chụp, diff, ảnh và log kiểm tra; đều bị Git ignore.

## So sánh với mockup

- Header: lời chào và filter trong một dải xanh rất nhạt, bo nhẹ; chiều cao desktop khoảng 116px. Tên nhân sự/hồ sơ tiếp tục từ session. Không sửa header component hoặc hành vi hamburger/tài khoản.
- Tab Tất cả: cùng cấu trúc icon trái, tên/mô tả, số và đơn vị, Chi tiết, mở rộng, mở chức năng bên phải. Tỷ lệ hai cột `1.82fr / .98fr` sát mẫu; không kéo dài các dòng để lấp cột.
- Tab Điểm: bốn tầng theo thứ tự cũ, mỗi tầng có mô tả ngắn và accordion rõ. Đã xem ảnh một tầng mở ở cả desktop và mobile, có trường hợp tên lớp rất dài. Không cắt nội dung để ép chiều cao.
- Chờ phê duyệt: ba dòng tổng quan gọn; click mở danh sách ngay trong khung, có quay lại. Khi cả ba bằng 0 vẫn giữ các nút, hiển thị rõ không có yêu cầu thay vì hiểu nhầm thiếu quyền.
- Tổng quan: dropdown và tiêu đề cùng hàng; donut/chú giải là phần chính. Tại 1440×900, donut nằm từ y≈596 đến y≈748 trong trạng thái có yêu cầu; khi không có yêu cầu từ y≈567 đến y≈719. Ảnh snapshot dữ liệu thật cũng hiển thị trọn biểu đồ ở viewport đầu tiên.
- Bố cục responsive: hai cột desktop, một cột khi hẹp. Ở 390px, tên/mô tả và số đếm xuống hàng tự nhiên, thao tác giữ riêng, chuỗi dài không đè lên link. Không có tràn ngang trong các ảnh kiểm tra.
- Màu sắc: trắng, xanh dương nhạt và teal; không dùng tím/lavender. Giữ nguyên bảng màu và phép tính biểu đồ đã triển khai. Ngoại lệ bo góc chỉ áp dụng dưới `.operational-dashboard`, không đổi theme/CSS chung.

So sánh cùng fixture tại 1440×900:

| Chỉ số | Trước | Sau |
|---|---:|---:|
| Dòng công việc có việc | 108–109px | 88px |
| Dòng công việc 0 | 147–148px | 72px |
| Khung phê duyệt có yêu cầu | 277px | 244px |
| Khung phê duyệt đều 0 | 277px | 214.5px |
| Điểm bắt đầu khung Tổng quan, có yêu cầu | y≈498px | y≈491px |
| Điểm bắt đầu donut, có yêu cầu | y≈685px | y≈596px |
| Kích thước donut | 128px | 152px |
| Góc card | 0px | 13px |

Header mới có nền và padding theo mẫu nên bắt đầu card thấp hơn khoảng 29px; việc giảm phê duyệt và gom header biểu đồ vẫn đưa hình chart lên khoảng 89px.

## Ảnh kiểm tra

- Ảnh hiện trạng do người dùng cung cấp: `.tmp/dashboard-v2-ui-reference/Current_Codex_UI.png`.
- Ảnh đích: `.tmp/dashboard-v2-ui-reference/Dashboard_V2_Preview.png`, `Dashboard_V2_Grade_1600.png`, `Dashboard_V2_Approval_1600.png`.
- Đường dẫn ảnh trước: `.tmp/dashboard-v2-ui-review/before/`.
- Đường dẫn ảnh sau: `.tmp/dashboard-v2-ui-review/after/`.
- Mỗi thư mục có **20 ảnh**: `all`, `grades`, `approval`, `empty`, `limited`, `long` ở các chiều rộng **1440, 1900, 390px**; chiều cao viewport **900px**. Tên ví dụ: `all-1440.png`, `grades-390.png`, `approval-1900.png`, `empty-1440.png`, `limited-390.png`, `long-390.png`.
- Có thêm `partial-error-1440.png` và `live-snapshot-1440.png`. Ảnh live dùng snapshot chỉ đọc đã có từ lượt trước, không thay đổi hoặc kiểm thử ghi database lần này.
- Các trạng thái đã chụp: Tất cả; Điểm mở tầng đầu; phê duyệt mở 5 bản ghi; không có yêu cầu; thiếu quyền xem phê duyệt/biểu đồ; tên dài; lỗi từng nguồn; snapshot thật.
- Ngoài ảnh snapshot thật, ảnh kiểm thử dùng fixture riêng bị chặn ở trình duyệt. Không đưa fixture vào ứng dụng/API/database. Script báo **0 yêu cầu ghi API**, **0 lỗi JavaScript**.
- Script và số đo: `.tmp/dashboard-v2-ui-review.cjs`, `before/result.json`, `after/result.json`. Diff riêng lượt UI được lưu cạnh hai thư mục ảnh.

## Chức năng được giữ nguyên

- Tab: Tất cả, Phân nhóm, Lịch học, Điểm; roving focus và phím mũi tên/Home/End.
- Điểm: thứ tự/phân loại bốn tầng, số đếm, mở/thu từng tầng và các deep-link.
- Phê duyệt: mở danh sách tại chỗ, quay lại, mở bản ghi gốc; nhóm 0 vẫn truy cập được. Không thêm nút duyệt.
- Biểu đồ: nguồn, số liệu, cách tính, palette, chọn chủ đề và điều kiện hiển thị không đổi; chỉ chuyển vị trí phần trình bày.
- Notification: `DashboardActivity.jsx` và CSS activity không đổi; không thêm số chưa đọc.
- Phân quyền/deep-link: giữ nguyên điều kiện quyền, định danh lớp/hồ sơ và query parameters.
- Hook tải dữ liệu/polling, chống response cũ theo hồ sơ/năm/hệ: không đổi.
- Loading, error, retry, chưa triển khai và no-data tiếp tục hiển thị.

## Kiểm thử

- Baseline trước khi sửa: `npm test -- src/test/integration/OperationalDashboard.test.jsx src/test/integration/RibbonPermissions.test.jsx src/test/unit/dashboardNavigation.test.js src/test/integration/DashboardScheduleLinks.test.jsx`: **60/60**, 4 suite.
- Cùng lệnh sau khi sửa, thêm hai kiểm thử UI rỗng/lỗi: **62/62**, 4 suite.
- `npm run build` trong `frontend`: đạt. Còn cảnh báo chunk lớn của các thư viện export, đã có ở baseline.
- `node .tmp/dashboard-v2-ui-review.cjs before` và `after`: đạt sau khi rà ảnh và tinh chỉnh mobile. Đã sửa kiểm tra đo ảnh để chỉ áp giới hạn chiều cao của nhóm 0 cho đúng các dòng 0, không áp nhầm cho dòng có việc/nội dung dài.
- Đã mở ảnh thực tế và đối chiếu với cả Preview, Grade và Approval reference; không dùng kết quả build/test làm thay thế đánh giá hình ảnh.
- `git diff --check`: đạt.
- Không chạy lại PostgreSQL/backend test vì không sửa backend/API hoặc logic xử lý dữ liệu.
- Lỗi còn lại trong phạm vi kiểm tra: chưa phát hiện. Không tuyên bố đã kiểm thử toàn bộ website hoặc mọi browser.

## Kiểm tra phạm vi

- Có sửa backend không: **Không trong lượt UI này**. Các file backend đang hiện modified trong Git là thay đổi có sẵn; hash so với baseline UI giữ nguyên.
- Có sửa logic nghiệp vụ không: **Không**.
- Có sửa database không: **Không**; không migration, seed, reset hoặc ghi dữ liệu.
- Có file nào ngoài phạm vi không: chỉ thêm test frontend liên quan và tài liệu bắt buộc. Không sửa RibbonHeader, useDashboardData, DashboardActivity, RBAC, session, RLS hoặc CSS chung.
- Đối chiếu SHA-256 của 13 file baseline: chỉ `OperationalDashboard.jsx`, `operationalDashboard.css`, `OperationalDashboard.test.jsx` thay đổi; 10 file còn lại giữ nguyên. Thêm báo cáo mới này.
- Branch/HEAD giữ nguyên; chưa stage, commit, push hoặc merge.

## Kết luận

- **DONE — phần chỉnh UI theo phạm vi yêu cầu.**
- Giao diện đã được so trực quan với mẫu về tỷ lệ cột, mật độ dòng, phân cấp điểm, phê duyệt mở tại chỗ và vị trí biểu đồ; thay bảng màu tham chiếu bằng màu sản phẩm.
- Những điểm còn chưa đạt: không có lỗi UI đã xác định còn mở trong các trạng thái/kích thước được kiểm tra. Việc chấp nhận thẩm mỹ cuối cùng thuộc người dùng; các ảnh fixture không thay thế việc xem dữ liệu/hồ sơ thực tế.
- Việc cần người dùng kiểm tra: mở `/viewLogged?year=2026`, kiểm tra bằng hồ sơ đang dùng; xem Tất cả, mở một tầng Điểm và mở/quay lại nhóm phê duyệt. Đối chiếu các ảnh trong thư mục `after` với bộ tham chiếu đã duyệt.
