# Dashboard V2 — Layout review

Ngày kiểm tra: 06/11/2026. Đã triển khai và kiểm tra tự động. Các giới hạn URL và kiểm tra cửa sổ thật được ghi bên dưới; chưa tuyên bố nghiệm thu thủ công F11/zoom hoàn tất.

## Baseline và phạm vi

- Nhánh: `feat/dashboard-v2`; HEAD: `78d40afd5d94da066edc129c574499fee3c9acbf`.
- Trước lần sửa này đã có thay đổi chưa commit trong OperationalDashboard.jsx, operationalDashboard.css, OperationalDashboard.test.jsx. Dùng chính các bản này làm nền, không ghi đè bằng HEAD.
- [Baseline manifest](../.tmp/dashboard-v2-layout-review/baseline.json) chứa status và SHA-256; bản sao tại `.tmp/dashboard-v2-layout-review/baseline/`.
- Không commit/push/merge/reset/clean/stash. Không ghi database. Không sửa backend, API, RBAC, workflow, notification hoặc theme chung. Giữ palette, gradient, icon, font; chỉ chỉnh kích thước phục vụ bố cục.

## Các mốc hoàn thành

1. Đọc Dashboard, navigation, hook và test; đọc backend để xác minh payload/deep-link. Lưu baseline và ảnh trước khi sửa.
2. Thay nội dung Công việc bằng bản ghi trực tiếp, bốn tab và bộ chọn Điểm.
3. Triển khai grid chung, preview theo DOM thực và container queries.
4. Chạy 81 test, build, 78 trạng thái browser và 8 trạng thái dữ liệu bổ sung; lưu ảnh, số đo và kiểm tra phạm vi file.

## File thay đổi

| File | Nội dung |
| --- | --- |
| frontend/src/features/dashboard/OperationalDashboard.jsx | Bốn tab, danh sách thật, bộ chọn Điểm, KPI/deep-link |
| frontend/src/features/dashboard/operationalDashboard.css | Grid chung, kích thước panel/KPI/dòng và container queries |
| frontend/src/features/dashboard/DashboardColumns.jsx | Đo khoảng trống thực dưới header |
| frontend/src/features/dashboard/AdaptiveTaskList.jsx | Đo dòng, preview hoàn chỉnh và footer |
| frontend/src/test/integration/OperationalDashboard.test.jsx | Hành vi mới, quyền, URL, resize, trạng thái dữ liệu/scope |
| docs/DASHBOARD_V2_LAYOUT_REVIEW.md | Báo cáo này |

[Đối chiếu SHA-256](../.tmp/dashboard-v2-layout-review/protected-files.json) xác nhận navigation.js, useDashboardData.js, backend dashboard.service.ts, RibbonHeader.jsx, theme.js và DashboardActivity.jsx giống baseline. Phần CSS tài khoản/chuông/activity cuối stylesheet giữ nguyên.

## Cấu trúc và dữ liệu

Desktop dùng hai cột chung một grid row: trái KPI + Công việc; phải Phê duyệt + Tổng quan. Bốn KPI một hàng, cao thông thường **137.4375px**, chia đều khi quyền cho phép ít thẻ. Bấm KPI đi thẳng nghiệp vụ gốc, không đổi tab.

Không còn tab Tất cả, hàng tổng hợp lặp KPI hoặc accordion trong Công việc:

- **Phân nhóm:** chuyên ngành có số học viên chờ > 0, giảm dần theo số lượng rồi tên/ID. Dòng có tên, số học viên và URL đúng chuyên ngành.
- **Xếp lịch:** bản ghi teaching.scheduling, trạng thái ngắn và URL lớp từ API. Nguồn đã lọc lớp active chưa có buổi; frontend không tính lại nghiệp vụ.
- **Xác nhận:** teaching.progress đã gom theo lớp; dòng có tên, số buổi và URL lớp. API không có timestamp buổi chưa xác nhận cũ nhất; dùng số buổi giảm dần, tên/ID để ổn định. Không tự gắn nhãn quá hạn.
- **Điểm:** chỉ hiện stage count > 0. Bộ chọn hai cột, tối đa hai hàng; một stage dùng nhãn ngắn; không có việc dùng empty state gọn. Chỉ hiện lớp của stage đang chọn. Giữ href/action/nextExamAt của nguồn, không sửa gradebookStage(), tracking hoặc điều kiện exams.write.

Phê duyệt giữ ba nhóm theo quyền, số lượng, drill-down, quay lại và URL bản ghi; không duyệt trực tiếp. Danh sách drill-down có một vùng cuộn tối đa 174px; tiêu đề/nút quay lại nằm ngoài vùng cuộn.

Tổng quan giữ dropdown ba chủ đề, nguồn và cách tính số liệu, màu/gradient. Donut vẫn tròn, không kéo méo để lấp panel. Các cột giá trị 0 vẫn là 0.

## Chiều cao và Adaptive Preview

DashboardColumns đo vị trí thật của grid trong document và chiều cao viewport. Grid dùng clamp(560px, availableHeight, 840px), không dùng cùng một height cho mọi màn hình. Hai cột dùng hàng cuối minmax(0,1fr), min-height:0 và cùng grid row để căn đáy, không bù bằng margin. Viewport quá thấp cho phép scroll trang tự nhiên.

AdaptiveTaskList giữ header/tab/bộ chọn Điểm/footer ngoài viewport danh sách. Các dòng đo ẩn, inert, cùng chiều rộng và CSS với dòng thật. Cộng getBoundingClientRect().height từng dòng để chọn prefix hoàn chỉnh vừa chỗ, kể cả tên xuống dòng. Footer luôn có slot 48px, tránh nút mới xuất hiện làm thay đổi sức chứa.

ResizeObserver theo dõi viewport và vùng đo; gom thay đổi bằng animation frame, chỉ cập nhật state khi capacity khác. Vùng đo ngoài flow, không tăng chiều cao panel theo số dòng. Không có scrollbar trong danh sách Công việc. Tên clamp hai dòng, tooltip giữ tên đầy đủ.

Xem tất cả chỉ hiện khi còn dòng đã tải bị ẩn hoặc itemCount hợp lệ lớn hơn số đang hiện. Không dùng tổng học viên/buổi làm tổng bản ghi. itemCount phải nguyên và không nhỏ hơn danh sách tải về. Khi lọc bỏ zero làm đổi số dòng, bỏ tổng chưa được xác minh. Không suy diễn tổng từ preview hoặc khẳng định đã tải hết nếu không có tổng đáng tin. Có tổng > 0 nhưng preview rỗng vẫn có đường tới trang nguồn.

Dashboard là size container: chiều rộng thực dưới 1040px chuyển một cột, dưới 700px KPI chuyển hai cột. Mobile xếp dọc nên không áp dụng căn đáy ngang.

## Số đo DOM thực

Đơn vị CSS px, trước khi scroll. Fixture dài giống nhau cho before/after, không phải số liệu production. Baseline desktop lệch đáy **13.953125px**.

| Viewport | Cao KPI | Cao Công việc | Đáy Công việc | Đáy Tổng quan | Lệch | Dòng Phân nhóm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 137.4375 | 567.5625 | 880 | 880 | 0 | 7 |
| 1900×900 | 137.4375 | 567.5625 | 880 | 880 | 0 | 7 |
| 1366×768 | 137.4375 | 435.5625 | 748 | 748 | 0 | 5 |
| 1366×650 | 137.4375 | 404.5625 | 717 | 717 | 0 | 4 |
| 390×844 | 143.046875 | 464.1875 | 1005.171875 | 1672.171875 | Một cột | 5 |

Ở viewport cao 650px, đáy dưới viewport do chiều cao tối thiểu; scroll trang tiếp cận được nội dung.

Zoom mô phỏng bằng effective viewport/device scale của khung 1900×900:

| Zoom | CSS viewport | Đáy cả hai panel | Lệch | Dòng |
| --- | --- | ---: | ---: | ---: |
| 80% | 2375×1125 | 997 | 0 | 9 |
| 100% | 1900×900 | 880 | 0 | 7 |
| 125% | 1520×720 | 717 | 0 | 4 |
| 150% | 1267×600 | 717 | 0 | 4 |

[Audit 78 trạng thái](../.tmp/dashboard-v2-layout-review/after/audit.json): năm viewport; từng tab và bốn stage; phê duyệt dài; ba chủ đề biểu đồ; zoom; normal/fullscreen/restored; container 900/600/1200px; font ứng dụng 150%; resize không reload. Lệch desktop lớn nhất **0px**. Không cắt dòng cuối, tràn ngang document, exception runtime hoặc request ghi. Đổi tab/stage/chủ đề/drill-down giữ chiều cao Công việc trong cùng viewport.

Resize thực qua CDP từ 1440×900 xuống 1440×650 giảm preview **7 → 4 dòng**. Font ứng dụng 150% vẫn lệch đáy 0px, preview 5 dòng; KPI tăng chiều cao để chứa nhãn đọc được.

[Audit 8 trạng thái dữ liệu](../.tmp/dashboard-v2-layout-review/states/audit.json): danh sách ngắn, rỗng, partial (tổng 40/tải 1), source error, source loading, quyền chỉ hai KPI, một stage, bốn stage rỗng. Tất cả lệch đáy 0px, không lỗi/request ghi. Empty/short không hiện Xem tất cả, partial có liên kết.

## Ảnh before/after

| Trạng thái | Before | After |
| --- | --- | --- |
| 1440×900 | [Ảnh](../.tmp/dashboard-v2-layout-review/before/1440x900.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/1440x900.png) |
| 1900×900 | [Ảnh](../.tmp/dashboard-v2-layout-review/before/1900x900.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/1900x900.png) |
| 1366×768 | [Ảnh](../.tmp/dashboard-v2-layout-review/before/1366x768.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/1366x768.png) |
| 1366×650 | [Ảnh](../.tmp/dashboard-v2-layout-review/before/1366x650.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/1366x650.png) |
| Mobile 390px | [Ảnh](../.tmp/dashboard-v2-layout-review/before/390x844.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/390x844.png) |
| Normal | [Ảnh](../.tmp/dashboard-v2-layout-review/before/window-normal.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/window-normal.png) |
| Fullscreen CDP | [Ảnh](../.tmp/dashboard-v2-layout-review/before/window-fullscreen.png) | [Ảnh](../.tmp/dashboard-v2-layout-review/after/window-fullscreen.png) |

Ảnh thêm: [Điểm](../.tmp/dashboard-v2-layout-review/after/1440x900-grades.png), [phê duyệt dài](../.tmp/dashboard-v2-layout-review/after/1440x900-approval-detail.png), [font 150%](../.tmp/dashboard-v2-layout-review/after/font-150.png), [container 600px](../.tmp/dashboard-v2-layout-review/after/container-600.png), [zoom 150%](../.tmp/dashboard-v2-layout-review/after/zoom-1.5.png).

Artifact .tmp là file local, không đưa vào commit. Script: .tmp/dashboard-v2-layout-audit.cjs (before/after), .tmp/dashboard-v2-layout-states.cjs. Baseline dùng Vite tách biệt, không ghi đè source hiện tại.

## Test/build

Chạy trong frontend:

```text
npm test -- src/test/integration/OperationalDashboard.test.jsx src/test/integration/DashboardSelect.test.jsx src/test/integration/RibbonPermissions.test.jsx src/test/integration/DashboardScheduleLinks.test.jsx --testTimeout=60000
```

**4 file, 81 test PASS**, 19.01s. Bao gồm KPI/deep-link, bốn tab, stage, số buổi theo lớp, zero-stage, adaptive capacity, partial/loading/empty/error/retry, quyền, keyboard, đổi năm/hệ đào tạo/hồ sơ và bỏ response cũ. Căn đáy được xác minh bằng browser measurement, không suy từ CSS/JSDOM.

`npm run build`: **PASS**, 26.61s, 1610 modules. Cảnh báo Vite về classProgressReport.js vừa static/dynamic import và chunk lớn; giữ ngoài phạm vi. `git diff --check`: PASS.

## Giới hạn / BLOCKED

1. **BLOCKED — URL lọc toàn bộ lớp theo stage Điểm:** trang gốc chưa hỗ trợ stage cho cả bốn giai đoạn. Xem tất cả mở route hợp lệ /masters/exam-lists?year=..., không tự tuyên bố đã lọc stage. Mũi tên từng lớp giữ đúng URL API, gồm lịch thi nếu được quyền. Muốn lọc stage ở trang đích cần công việc riêng, không sửa workflow trong đợt này.
2. API progress không có timestamp buổi chờ cũ nhất; thứ tự thay thế đã ghi ở trên.
3. **Chưa nghiệm thu thủ công F11/zoom UI:** Edge headless xác nhận windowState normal → fullscreen → normal qua CDP, CSS viewport được điều khiển riêng và có ảnh cùng fixture. Đây không phải quan sát phím F11 trên cửa sổ Windows thật. Zoom là effective viewport emulation. Cần kiểm tra thủ công F11 và zoom browser UI trước khi xác nhận mục này hoàn tất.
4. Đổi năm/hệ đào tạo/hồ sơ và late responses có integration tests. Browser audit dùng session/API fixture, không xác nhận tài khoản/dữ liệu production. Không ghi DB hoặc thay đổi quyền.

### Chỉnh cột phải — Chờ phê duyệt và Tổng quan

- File sửa trong lượt này: `frontend/src/features/dashboard/OperationalDashboard.jsx`, `frontend/src/features/dashboard/operationalDashboard.css`; chỉ bổ sung mục này vào báo cáo. Giữ nguyên các thay đổi có sẵn khi bắt đầu, không commit/push.
- Chờ phê duyệt: trước **217,39px** với fixture đủ ba nhóm; sau dùng `clamp(300px, 35dvh, 330px)`: **315px** tại 1440×900/1900×900, **300px** tại 1366×768/1366×650/390×844. Grid dành sẵn cùng một hàng cho tổng quan và chi tiết; mở nhóm/quay lại không đổi chiều cao.
- Chi tiết dùng danh sách phẳng, tên tối đa hai dòng và một thông tin phụ, giữ URL mở bản ghi. ResizeObserver đo hàng và khoảng trống để phân trang ngay trong khung; mọi mục đã tải đều xem được, không cuộn danh sách hay cắt bỏ bản ghi bằng overflow. Phân trang ghi rõ “mục đã tải”, không suy diễn tổng bản ghi từ số đếm nghiệp vụ.
- Tổng quan: bỏ border, nền trang trí, padding và bo góc của `figure`; biểu đồ/chú giải nằm trực tiếp trong card chính. Dropdown và tiêu đề chung hàng khi đủ chỗ; donut 132–160px, giữ nguyên màu, tổng giữa và số liệu. Biểu đồ cột dùng cùng bố cục.
- Căn đáy bằng một hàng Grid chung, sidebar chia hàng cố định cho phê duyệt và phần còn lại cho biểu đồ. Hàng chung có tối thiểu theo nội dung, biểu đồ tối thiểu 300px; cột trái dùng size containment để preview không tự tăng chiều cao khi chuyển tab. Màn hình thấp cho trang cuộn tự nhiên; mobile bỏ containment, xếp một cột. Không dùng margin/offset để căn đáy.
- Đã chạy browser audit với fixture: 1440×900, 1900×900, 1366×768, 1366×650, 390×844; ba chủ đề, mở/quay lại và phân trang cả ba nhóm, tên hồ sơ dài, ba nhóm đều 0, resize, container hẹp, font 150%, zoom mô phỏng 80–150%, fullscreen/normal qua CDP. **Lệch đáy desktop 0px**, khung phê duyệt không đổi chiều cao, mọi dòng phân trang vừa khung; không tràn ngang, scrollbar lồng trong cột phải, lỗi runtime hoặc request ghi. Audit: [78 trạng thái bố cục](../.tmp/dashboard-right-review/after/audit.json), [chi tiết và dropdown](../.tmp/dashboard-right-review/detail/detail-audit.json), [tên dài](../.tmp/dashboard-right-review/stress/detail-audit.json), [ba nhóm rỗng](../.tmp/dashboard-right-review/empty/detail-audit.json).
- Ảnh đã quan sát: [1440px](../.tmp/dashboard-right-review/detail/1440x900-learnersChart.png), [viewport thấp với biểu đồ cột](../.tmp/dashboard-right-review/detail/1366x650-completionChart.png), [mobile](../.tmp/dashboard-right-review/detail/390x844-learnersChart.png). Artifact nằm trong `.tmp`, không đưa vào commit.
- `npm --prefix frontend run build`: PASS (1610 modules); còn cảnh báo import static/dynamic và chunk lớn có sẵn. `git diff --check`: PASS. Không chạy test suite/backend/PostgreSQL test. Diff so với bản chụp lúc bắt đầu chỉ thay phần trình bày phê duyệt, biểu đồ và cơ chế bố cục; giữ nguyên KPI, tab/danh sách công việc, font, màu, icon, notification, nguồn dữ liệu, công thức, quyền, deep-link và handler nghiệp vụ. Không sửa backend/API/database/RBAC/workflow.
- Giới hạn: kiểm tra bằng Edge headless và dữ liệu fixture; chưa nghiệm thu F11 và zoom từ giao diện trình duyệt Windows thật, chưa xác nhận dữ liệu tài khoản thực. Phân trang áp dụng cho các yêu cầu API đã trả về, không bổ sung API tải thêm.

### Sửa kéo giãn chiều cao Dashboard V2

Mục này cập nhật kết quả lượt chỉnh cột phải phía trên. Nguyên nhân đã xác minh từ code và số đo trước sửa: `DashboardColumns.jsx` tính `clientHeight - top - 20` vào `--od-layout-height`; `.od-layout` lấy giá trị đó trong `height: clamp(640px, ..., 840px)`. Grid chia phần dư xuống hai card dưới, còn `figure`, `.od-chart-body`, `.od-columns` dùng `flex: 1` và track cột `height: 100%`, khiến biểu đồ giãn theo khung. Tại 1920×1080, Công việc cao 684,56px, Tổng quan 498px; căn đáy đạt nhưng tỷ lệ chưa đạt.

Sửa đúng hai file trình bày `frontend/src/features/dashboard/DashboardColumns.jsx` và `frontend/src/features/dashboard/operationalDashboard.css`: bỏ đo chiều cao viewport và height clamp của grid cha. Chỉ đo chiều cao thực của hàng KPI (không sửa KPI) để chừa tối thiểu 380px cho Công việc. Grid tự tính chiều cao từ nội dung và các giới hạn thiết kế: Chờ phê duyệt 270–280px theo chiều rộng container, Tổng quan tối thiểu 270px; cả hai cột chung một hàng và chung đáy. Bỏ flex giãn dọc của biểu đồ, giữ vùng cột cao 112px, giảm khoảng cách dư. Danh sách vẫn đo số dòng vừa khung và giữ nút Xem tất cả; thay tab không đổi chiều cao. Mobile dùng Công việc 380px, không tăng theo chiều cao màn hình. Màn hình thấp cuộn trang tự nhiên.

Số đo `getBoundingClientRect()`, đơn vị CSS px; cùng fixture trước/sau, không phải dữ liệu production:

| Viewport | Công việc trước → sau | Chờ phê duyệt trước → sau | Tổng quan trước → sau | Đáy chung trước → sau | Lệch đáy sau |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 567,56 → 396,56 | 315 → 270 | 396 → 270 | 880 → 709 | 0 |
| 1920×1080 | 684,56 → 406,56 | 330 → 280 | 498 → 270 | 997 → 719 | 0 |
| 1366×768 | 484,56 → 396,56 | 300 → 270 | 328 → 270 | 797 → 709 | 0 |
| 1366×650 | 484,56 → 396,56 | 300 → 270 | 328 → 270 | 797 → 709 | 0 |

Đã quan sát ảnh ở cả bốn viewport và đo 31 trạng thái: tab một bản ghi/nhiều bản ghi, bốn tab, ba chủ đề biểu đồ, fullscreen/normal qua CDP kết hợp đổi chiều cao 900 → 1080 → 900. Cùng chiều rộng, card không cao thêm khi fullscreen. Kiểm tra thêm chi tiết/phân trang ba nhóm, dropdown và mobile 390px; không cắt dòng/biểu đồ, mất Xem tất cả, tràn ngang hay scrollbar lồng trong cột phải. Trạng thái rỗng và quyền chỉ Công việc/không có phê duyệt vẫn giữ vùng Công việc 380–397px. Vite đã biên dịch JSX/CSS qua trình duyệt, không lỗi runtime; `git diff --check` đạt. Không chạy lại build hoặc toàn bộ test suite trong lượt này.

Artifact: [trước sửa](../.tmp/dashboard-height-fix/before/measurements.json), [sau sửa](../.tmp/dashboard-height-fix/after/measurements.json), [phê duyệt và mobile](../.tmp/dashboard-height-fix/detail/detail-audit.json), [rỗng/quyền](../.tmp/dashboard-height-fix/states/states.json). Ảnh: [1440×900 nhiều mục](../.tmp/dashboard-height-fix/after/1440x900-many-donut.png), [1920×1080 ít mục và biểu đồ cột](../.tmp/dashboard-height-fix/after/1920x1080-few-completionChart.png), [viewport thấp](../.tmp/dashboard-height-fix/after/1366x650-few-donut.png).

Điểm còn cần nghiệm thu: F11 bằng bàn phím và zoom trên cửa sổ Windows thật chưa kiểm tra; CDP/headless chỉ mô phỏng thay đổi fullscreen/viewport. Dữ liệu tài khoản thực cần người dùng xác nhận. Tab một bản ghi vẫn có khoảng trống trong khung ổn định khoảng 397–407px; không tự thu khung khi đổi tab. Tại desktop rộng, Công việc cao hơn mốc định hướng 400px khoảng 7px do phân bổ cột phải, không tăng theo chiều cao viewport. Không thay màu, font, icon, dữ liệu/công thức, logic nghiệp vụ, backend, API, RBAC, workflow, notification hoặc database; không commit/push.

### Rà soát tiếp lỗi kéo giãn — trường hợp thiếu Chờ phê duyệt

Xác minh trên mã hiện tại: phép đo viewport và height clamp đã được bỏ ở lượt trước. Tuy nhiên, `.od-sidebar:not(:has(.od-approvals))` vẫn dùng `minmax(min-content, 1fr)`, làm Tổng quan chiếm cả chiều cao cột trái: **535,44px** khi không có quyền xem phê duyệt. Đây là trường hợp kéo giãn còn sót; lần báo cáo trước chưa đánh giá đúng tỷ lệ card ở trạng thái này.

Lượt này chỉ sửa `frontend/src/features/dashboard/operationalDashboard.css`: hàng biểu đồ khi thiếu phê duyệt dùng `max-content` và `align-content: end`, giữ card gọn và chung đáy với Công việc. Giảm mức tối thiểu của Tổng quan từ 270 xuống 264px, donut tối đa 152px để cả donut và cột cùng vừa khung; giữ nguyên màu, dữ liệu, font, chú giải và công thức. Vùng cột vẫn cao 112px. Không đổi JSX, KPI, tab, handler, nghiệp vụ, backend hoặc notification.

Số đo DOM trước/sau lượt này, cùng fixture; Chờ phê duyệt giữ nguyên:

| Viewport | Công việc trước → sau | Chờ phê duyệt | Tổng quan trước → sau | Đáy chung sau | Lệch đáy |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440×900 | 396,56 → 390,56 | 270 | 270 → 264 | 703 | 0 |
| 1920×1080 | 406,56 → 400,56 | 280 | 270 → 264 | 713 | 0 |
| 1366×768 | 396,56 → 390,56 | 270 | 270 → 264 | 703 | 0 |
| 1366×650 | 396,56 → 390,56 | 270 | 270 → 264 | 703 | 0 |

Không có Chờ phê duyệt: Công việc 380px; Tổng quan **535,44 → 264px**, vẫn lệch đáy 0px. Khoảng trống nằm ngoài card phía trên biểu đồ, không kéo dài card để bù khung bị ẩn theo quyền.

Đã đo và quan sát trực tiếp bằng Edge headless ở bốn viewport trên: 31 trạng thái gồm ít/nhiều bản ghi, bốn tab, ba chủ đề, fullscreen/normal mô phỏng qua CDP; thêm rỗng, chỉ Công việc, không có phê duyệt. Card không tăng chiều cao khi tăng viewport, số dòng vừa khung và Xem tất cả còn truy cập được; không tràn ngang/cắt nội dung, không lỗi runtime/request ghi trong lượt kiểm tra đạt. Ảnh cuối chụp đúng viewport (không dùng captureBeyondViewport, vốn có thể làm ResizeObserver thay số dòng trong lúc chụp). `git diff --check` đạt; không chạy toàn bộ suite/build/backend test.

Artifact: [trước](../.tmp/dashboard-height-refinement/before2/measurements.json), [sau](../.tmp/dashboard-height-refinement/after/measurements.json), [trạng thái quyền/rỗng](../.tmp/dashboard-height-refinement/states/states.json); ảnh [1440×900 nhiều mục](../.tmp/dashboard-height-refinement/after/1440x900-many-donut.png), [1920×1080 ít mục và cột](../.tmp/dashboard-height-refinement/after/1920x1080-few-completionChart.png), [không có phê duyệt](../.tmp/dashboard-height-refinement/states/without-approvals.png).

Chưa nghiệm thu F11 bằng bàn phím trên cửa sổ Windows thật hoặc dữ liệu tài khoản thực. Tab một mục vẫn có khoảng trống trong chiều cao ổn định 391–401px; không tăng theo viewport. Ở màn hình cao 650px, đáy 703px nằm dưới viewport và truy cập bằng cuộn trang. Không commit/push; giữ nguyên các thay đổi có sẵn ngoài phạm vi.

### Rework empty state — kiểm chứng DOM và ảnh render

Đã xác nhận branch `feat/dashboard-v2`, Vite chạy từ `D:\SauDH\DuansauDH\frontend` tại cổng 3100. Trước khi sửa đã tái hiện và chụp lỗi trên chính frontend này. Nguyên nhân: `AdaptiveTaskList.jsx` vẫn render “Không có lớp chờ xếp lịch” bằng `.od-empty` chung (12px, margin 14px, icon 17px), không có căn giữa và vẫn chừa footer 48px. `ApprovalList` dùng cùng kiểu cho “Không có mục chờ xử lý”; `ApprovalPanel` render h3 nhóm vô điều kiện, đồng thời chừa vùng pagination 38px cả khi rỗng. `.od-approval-groups` là danh sách theo chiều cao nội dung nên ba hàng dồn lên trên, icon dùng màu muted. CSS cổng 3100 chưa có selector căn giữa; các lượt trước mới sửa chiều cao, chưa triển khai yêu cầu empty state, không phải một quy tắc căn giữa đúng đã bị cache hoặc bị ghi đè.

Chỉ sửa `AdaptiveTaskList.jsx`, `OperationalDashboard.jsx`, `operationalDashboard.css` trong feature dashboard. Thêm `.od-centered-empty` riêng cho empty state: Flex căn giữa hai trục, nhận toàn bộ chiều cao viewport nội dung thực, chữ 16px, icon 32px dùng màu teal hiện có; không dùng margin-top để định vị. Bỏ footer/pagination rỗng; trường hợp cần Xem tất cả vẫn giữ liên kết. Phê duyệt rỗng không render h3 nhóm trong DOM, chỉ một câu “Không có yêu cầu chờ phê duyệt”, giữ header và nút quay lại; có dữ liệu vẫn có h3 và phân trang. Ba nhóm tổng quan dùng Grid chia đều phần còn lại, icon dùng blue/tint sẵn có dù số lượng bằng 0. Không đổi kích thước dashboard, KPI, tab, biểu đồ, nguồn dữ liệu, quyền hoặc handler/deep-link.

Đã dùng CDP trên Edge headless lấy `getBoundingClientRect()` và `getComputedStyle()` trước/sau tại 1440×900 và 1440×650, 24 trạng thái mỗi lượt. Sau sửa: vùng Công việc khả dụng cao **288,17px**, p empty cao đúng **288,17px**; vùng chi tiết phê duyệt dưới nút quay lại và p empty cùng cao **184,61px**. CSS thực: display flex, align-items/justify-content center, margin 0, font-size 16px. Đo hợp vùng icon + chữ so với tâm content: lệch ngang tối đa **0,008px**, dọc **1,008px**; áp dụng đủ bốn tab và ba nhóm chi tiết. DOM chi tiết rỗng không còn h3. Công việc vẫn 390,56px, Phê duyệt 270px, Tổng quan 264px, lệch đáy 0px. Ba hàng tổng quan cao bằng nhau, icon computed color `rgb(8, 124, 156)`. CSS đang phục vụ đã chứa selector mới.

Đã mở xem ảnh render sau sửa, không chỉ dựa vào CSS: [Xếp lịch 0 lớp](../.tmp/dashboard-empty-review/after/1440x900-scheduling-empty.png), [ba nhóm](../.tmp/dashboard-empty-review/after/1440x900-approval-groups.png), [chi tiết rỗng](../.tmp/dashboard-empty-review/after/1440x900-approval-empty-0.png), [có dữ liệu](../.tmp/dashboard-empty-review/after/1440x900-approval-populated.png). Ảnh viewport thấp: [Xếp lịch](../.tmp/dashboard-empty-review/after/1440x650-scheduling-empty.png), [chi tiết rỗng](../.tmp/dashboard-empty-review/after/1440x650-approval-empty-0.png). [Audit trước](../.tmp/dashboard-empty-review/before/audit.json), [audit sau](../.tmp/dashboard-empty-review/after/audit.json) lưu cả bounds/style. Danh sách có dữ liệu và Xem tất cả còn hoạt động; loading/error vẫn riêng, không hiện empty state. Không lỗi runtime/request ghi; `git diff --check` đạt. Không chạy toàn bộ suite/backend/database test.

Giới hạn: kiểm tra bằng session/API fixture trên ứng dụng thực ở cổng 3100, chưa nghiệm thu bằng tài khoản/dữ liệu người dùng thực, chưa kiểm tra F11 thủ công trong lượt này. Màn hình thấp vẫn cuộn trang tự nhiên. Không sửa backend/API/RBAC/workflow/database/notification, không commit/push; giữ nguyên các thay đổi ngoài phạm vi có sẵn.
