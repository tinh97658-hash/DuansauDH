# Dashboard V2 — Visual Review

Trạng thái: DONE — đã qua quality gate UI trong phạm vi và các kích thước kiểm tra bên dưới. Đánh giá thẩm mỹ cuối cùng thuộc người dùng.

## 1. Baseline Git và file thay đổi ban đầu

Branch `feat/dashboard-v2`, HEAD `387bef8eeb1d07966f11b676e849e59e321a0e65`. Khi bắt đầu có 14 file thay đổi chưa commit từ các lượt trước. Bản sao từng file, danh sách và SHA-256 nằm trong `.tmp/dashboard-v2-visual-baseline/manifest.json`; lưu thêm bản `AppSelect.jsx` chung để chứng minh phạm vi.

Giữ nguyên mọi thay đổi hiện có. Không reset/clean/stash/merge/rebase/commit/push.

Đã mở trực tiếp bốn URL Dribbble được cung cấp và đọc được nội dung mô tả thiết kế. Ảnh shot chính không tải được qua web reader; link ảnh reader trả về là ảnh quảng cáo, không phải thiết kế. Tải HTML trực tiếp và tìm kiếm ảnh cũng không lấy được shot. Không tuyên bố đã xem ảnh của bốn mẫu này. Dùng thêm các ảnh/HTML đã được người dùng cung cấp trong `.tmp/dashboard-v2-ui-reference/`, vốn đã được xem trực tiếp ở lượt trước.

Các nguồn tham khảo:

- [AI Productivity](https://dribbble.com/shots/27216318-AI-Productivity-Dashboard-UI-Task-Workspace-App): phân cấp công việc, luồng chú ý và nền mềm.
- [E-Flow](https://dribbble.com/shots/27715382-E-Flow-Modern-Project-Management-SaaS-Dashboard): độ tương phản, tính nhất quán component.
- [Medixal](https://dribbble.com/shots/27814348-Medixal-AI-Health-Analytics-Dashboard): dữ liệu chính nổi bật, phần phụ yên tĩnh.
- [AI Coaching](https://dribbble.com/shots/27857722-AI-Coaching-Platform-Dashboard): lời chào và bố cục hướng hành động.

## 2. Design specification thực tế

Định hướng cố định: Modern Productivity Workspace — Calm Contrast.

| Hạng mục | Specification trước khi chỉnh CSS |
|---|---|
| Palette | Canvas #F5F6F9; surface #FFF; ink #252B3B; muted #69758A; primary #4651C8, tint #EEF0FD; teal #178E8B, tint #E8F5F2; coral #DA795B, tint #FFF0E9; border #E4E8F0. Chỉ áp trong Dashboard. |
| Typography | Font hệ thống sẵn có; greeting 27px; panel 17px/600; tên việc 14px/600; mô tả 12px; số 26px/700; số 0 là 18px, trung tính; nhãn 11–12px. |
| Icon | Phân nhóm teal nền mềm; lịch indigo nền mềm; xác nhận clock màu ấm nhận diện; điểm indigo không cùng nền với phân nhóm; phê duyệt icon quyết định; chart icon thống kê. Không emoji. |
| Grid / spacing | Dòng công việc dùng cùng bốn cột: 44px / minmax(0,1fr) / 88px / 136px; gap 14px. Cụm action có slot cố định dù thiếu nút preview. Hai cột nội dung khoảng 1.8/1; gap 20px. Mobile chuyển grid nhưng giữ trục số chung. |
| Focus / hover / active | Focus ring primary 2px; tab active nền primary/chữ trắng; hover tint; tầng điểm mở có dấu primary, không phân cấp cảnh báo. |
| Căn số | Cột 88px trên desktop, tabular-nums, căn cùng cạnh; thử 0, 1, 2, 3, 4 chữ số và đơn vị dài. Không margin riêng từng dòng. |
| Dropdown | Đo anchor/menu trước khi sửa; ưu tiên component chọn riêng Dashboard, anchor là chính control, menu cập nhật khi scroll/resize, giữ keyboard và option values. Không sửa AppSelect chung nếu có giải pháp cục bộ. |
| Biểu đồ | Hai donut giữ nguồn, tổng và chú giải, palette rõ ràng; hoàn thành giảng dạy chuyển thành cột đứng theo các tháng trả về, cột 0 có height 0, không đổi số liệu hoặc truy vấn. |

## 3. Mười vấn đề UI ưu tiên và trạng thái

| Vấn đề | Hướng xử lý | Trạng thái |
|---|---|---|
| Số lệch vì cụm action co giãn mỗi dòng | Grid cố định bốn cột và slot preview | DONE |
| Menu chủ đề mở xa control | Đo portal/anchor và sửa cục bộ | DONE |
| Không có điểm nhìn chính | Tăng hierarchy chữ/số và selected state | DONE |
| Màu/icon đồng đều | Ba biến thể icon có chủ đích | DONE |
| Số 0 ngang độ nổi bật với việc thật | Trung tính, nhỏ hơn, giữ link | DONE |
| Action chưa phân biệt | Chi tiết rõ, preview nhẹ, mở chức năng outline + tooltip | DONE |
| Tầng điểm mở chưa rõ | Nhấn tầng active và link bảng điểm | DONE |
| Phê duyệt ít tương phản | Badge số có việc, hover, chữ rõ | DONE |
| Donut và legend quá nhạt | Tổng lớn, palette riêng biệt, legend rõ | DONE |
| Chart tháng là thanh ngang | Cột đứng, đủ sáu tháng và 0 thật | DONE |

## 4. Những file đã sửa

Sáu file thay đổi trong lượt này:

- `frontend/src/features/dashboard/OperationalDashboard.jsx`: markup trình bày, icon, tooltip, cột tháng, dùng dropdown cục bộ.
- `frontend/src/features/dashboard/operationalDashboard.css`: grid, typography, palette và responsive scoped Dashboard.
- `frontend/src/features/dashboard/DashboardSelect.jsx` (mới): menu anchor theo control thực, chuột/bàn phím.
- `frontend/src/test/integration/OperationalDashboard.test.jsx`: thêm kiểm tra sáu cột tháng và giá trị 0.
- `frontend/src/test/integration/DashboardSelect.test.jsx` (mới): kiểm tra dropdown trong theme thật.
- `docs/DASHBOARD_V2_VISUAL_REVIEW.md` (mới): specification và bằng chứng bàn giao.

## 5. Root cause lỗi dropdown

Đã tái hiện trên Edge trước khi sửa: ở 1440px, đáy control y=469.25px nhưng menu bắt đầu y=146.25px; ở 1024px menu bắt đầu y=361.25px. Menu thực tế cao khoảng 114px.

`theme.js` tại override `MuiMenu` gọi `dropdownMenuStyles(ownerState.anchorEl)` trong `utils/dropdownGeometry.js`. Hàm này giả định chiều cao menu 360px và xuất `top/left/width !important` theo tọa độ anchor lúc tính style. Nó chọn vị trí phía trên cho chiều cao giả định, rồi tọa độ không còn khớp sau cuộn/focus. Bằng chứng: MUI đã cập nhật inline `top: 542px`, nhưng computed style vẫn là `146.25px` do override important. Đây là lỗi tính hình học và style ghi đè, không phải z-index.

Sửa cục bộ bằng `DashboardSelect`: Popper portal dùng chính select làm anchor, `strategy: fixed`, offset 6px, flip theo kích thước menu thực, preventOverflow; ResizeObserver cập nhật chiều rộng. Không đi qua MuiMenu nên tránh override theme. Focus option với `preventScroll: true` để không kéo trang khi portal vừa mở. Giữ giá trị/onChange của bộ lọc, chuột, phím mũi tên, Home/End, Enter, Escape và Tab. Không sửa AppSelect/theme chung.

12 phép đo chuột/cuộn/bàn phím trên bốn kích thước đều đạt. Khoảng cách menu–control 5.75px trên desktop và 6.5px trên mobile do làm tròn; chiều rộng bằng control, sai số ngang tối đa 0.016px. Escape trả focus về ô chọn; End/Enter chọn đúng chủ đề và đóng menu.

## 6. Cách căn cột số và bằng chứng kiểm tra

Baseline có metric width 54px hoặc 58px tùy đơn vị; cụm action mất nút preview ở dòng 0 nên độ rộng thay đổi. Sau sửa, heading dùng `display: contents` để icon/copy/metric tham gia cùng grid ngoài; mỗi action có slot cố định dù preview không có. Số dùng tabular-nums và căn phải, đơn vị nằm dưới. Không có margin riêng từng dòng.

| Viewport | Cạnh phải chung của bốn metric (px) | Độ rộng metric | Kết quả |
|---|---:|---:|---|
| 1440 | 723.703125 | 88px | PASS |
| 1900 | 1016.28125 | 88px | PASS |
| 1024 | 807 | 88px | PASS |
| 390 | 351 | 66px | PASS |

Đo cả bộ 31/0/54/2 và 4096/7/278/2; kiểm tra thêm trạng thái mọi nhóm 0 và tên dài. Bốn cạnh phải bằng nhau, gồm dòng không có preview; không tràn ngang. Mobile đưa action sang hàng sau để giữ chỗ đọc tên và trục số.

## 7. Màu, icon, hierarchy

Triển khai đúng specification mục 2: lời chào 27px, panel 17px, tên việc 14px, mô tả 12px; số có việc 26px, số 0 trung tính 18px. Tab active primary nền đậm/chữ trắng; Chi tiết dùng tint, preview nhẹ hơn, link đi chức năng có outline và tooltip. Hero có nền chuyển sắc nhẹ và điểm nhấn trái.

Icon phân nhóm teal, lịch indigo, xác nhận clock nền ấm tròn; màu ấm chỉ nhận diện loại việc. Tầng điểm đang mở có dấu primary, số và link bảng điểm rõ hơn; không sửa bốn tầng hay gán mức cảnh báo. Nhóm phê duyệt có việc dùng badge primary, nhóm 0 trung tính. Donut 160px, tổng 30px và legend 12px với palette phân biệt. Không thêm KPI, dữ liệu trang trí, font hoặc thư viện.

## 8. So sánh ảnh trước/sau

Đã xem trực tiếp ảnh desktop/mobile, trạng thái Điểm mở, dropdown, tháng có một cột khác 0 và trạng thái toàn 0. So sánh:

| Trước | Sau |
|---|---|
| Bốn số lệch vì metric/action thay đổi độ rộng | Cùng một trục số và slot action cố định |
| Dropdown xa control, style important ghi đè vị trí | Menu sát control, theo cuộn và dùng được bàn phím |
| Tab, icon, chữ, action gần cùng sắc độ | Tab active rõ; số có việc nổi bật; icon ba biến thể; action có thứ bậc |
| Tầng điểm mở ít khác biệt | Có accent, counter và link bảng điểm dễ đọc |
| Thanh tháng ngang, nhiều vùng trống | Sáu cột đứng, nhãn số/tháng, cột 0 cao đúng 0 |
| Donut/legend nhạt | Tổng và chú giải rõ hơn, màu phân biệt |

Không ép giảm mọi khoảng trắng: dòng có việc tại 1440 tăng từ khoảng 88 lên 98px để đủ chữ 14px và số 26px; dòng 0 từ 72 lên 82px. Khung phê duyệt 264px, donut nằm y=643.75–803.75, vẫn nhìn đủ trong viewport cao 900px. Hồ sơ ít quyền tự dùng vùng nội dung rộng, không thêm widget lấp chỗ.

## 9. Danh sách ảnh và vị trí lưu

- Trước: `.tmp/dashboard-v2-visual-review/before/`.
- Sau: `.tmp/dashboard-v2-visual-review/after/`.
- Fixture chỉ trong browser test, không thêm vào app/API/DB. Ảnh `live-snapshot` dùng snapshot chỉ đọc đã có, không phải truy vấn mới.

Có 34 ảnh trước và 46 ảnh sau, cùng `result.json` từng thư mục. Các viewport 1440×900, 1900×900, 390×900 và 1024×900; ảnh nội dung chụp full page, ảnh dropdown chụp viewport để giữ nguyên vị trí cuộn. Tên ảnh có hậu tố chiều rộng:

- `all`, `grades`, `approval`, `empty`, `limited`, `longnames`: các trạng thái bắt buộc.
- `dropdown`, `dropdown-keyboard`: mở bằng chuột và bàn phím.
- `monthly`, `monthly-zero`: một tháng có dữ liệu và toàn bộ tháng 0.
- `metric-values`: số từ một đến bốn chữ số; `live-snapshot-1440`, `partial-error-1440`: dữ liệu snapshot và lỗi một phần.

Ảnh xem nhanh: [desktop trước](../.tmp/dashboard-v2-visual-review/before/all-1440.png), [desktop sau](../.tmp/dashboard-v2-visual-review/after/all-1440.png), [mobile sau](../.tmp/dashboard-v2-visual-review/after/all-390.png), [dropdown mobile](../.tmp/dashboard-v2-visual-review/after/dropdown-390.png), [biểu đồ tháng mobile](../.tmp/dashboard-v2-visual-review/after/monthly-390.png). Artifact `.tmp` được Git ignore, chỉ lưu local.

## 10. Test/build và kết quả thực tế

Lần chạy cuối: 65 test PASS trong 5 suite, frontend build PASS (18.09s). Các suite: OperationalDashboard, DashboardSelect, RibbonPermissions, dashboardNavigation, DashboardScheduleLinks. Log: `.tmp/dashboard-v2-visual-tests.log`, `.tmp/dashboard-v2-visual-build.log`.

Browser gate `.tmp/dashboard-v2-visual-check.cjs` PASS: 46 ảnh không tràn ngang, không exception JavaScript, không API write; 12 phép đo anchor; click chuột thật, cuộn khi menu mở, Escape, mở bằng ArrowDown, End/Enter chọn chủ đề; tab keyboard; trục metric; chiều cao sáu cột và zero. Kết quả `.tmp/dashboard-v2-visual-review/after/result.json`, log `.tmp/dashboard-v2-visual-after.log`.

`git diff --check` PASS. Build còn cảnh báo bundle lớn hơn 500kB; không có lỗi build. Không chạy lại backend/PostgreSQL vì không sửa backend.

## 11. Những phần chưa đạt

Không còn lỗi mở trong các quality gate đã kiểm tra. Giới hạn: ảnh bốn shot Dribbble không tải được (mục 1); browser thực tế đã kiểm tra Edge, chưa xác nhận Safari/Firefox hoặc thiết bị cảm ứng thật. Lỗi geometry chung vẫn có thể ảnh hưởng màn hình khác; lượt này chỉ xử lý Dashboard theo phạm vi được giao. Độ hài lòng thị giác cuối cùng cần người dùng xem giao diện; không tự chấm điểm thẩm mỹ.

## 12. Kiểm tra không sửa nghiệp vụ

Đối chiếu SHA-256 với baseline: chỉ ba file baseline thay đổi là OperationalDashboard.jsx, operationalDashboard.css và test OperationalDashboard. Mười một file baseline còn lại và AppSelect chung giữ nguyên hash. Ba file mới liệt kê tại mục 4. Phần CSS header/activity sau marker `.od-header-account{` giữ nguyên.

Không sửa backend, API, query, RBAC, DB, migration, hook dữ liệu, theme chung hoặc logic notification. Nguồn/count chart và handler chuyển tab/xem trước/mở chức năng giữ nguyên. Fixture chỉ tồn tại trong browser test. Không thực hiện commit/push hoặc thao tác Git thay đổi lịch sử; branch và HEAD giữ nguyên.

## 13. Điểm tiếp tục nếu phiên bị ngắt

Triển khai và kiểm tra đã hoàn tất. Đọc báo cáo này, manifest baseline và result.json nếu tiếp tục. Xem ảnh hoặc giao diện đang chạy trước khi nhận chỉnh sửa thị giác tiếp theo. Nếu sửa UI mới, chạy lại đúng suite/browser gate liên quan. Giữ nguyên branch và mọi thay đổi hiện có; chưa commit/push.
