# Assignment — split-pane table readability — 18/10/2026

Đã xử lý FG-VIS-002 ở bảng candidate: tại **1440×900, split mặc định 55:45**, identity, ngày sinh và học phí hiện đủ **không cần cuộn ngang**. Không đổi logic phân nhóm hoặc flow tạo nhóm tại chỗ.

## Before

Đo trực tiếp browser Edge trên `localhost:3100`, dữ liệu DEV QTKD năm2026, không có custom column widths (`{}`).

| Đo tại default split | Before |
|---|---:|
|Viewport|1440×900|
|Pane trái / phải|764.5 / 625.5 px|
|Vùng scroll candidate, clientWidth|737 px|
|Table / scrollWidth|946 px|
|Phần phải cần cuộn|209 px|

Chín cột tách riêng: checkbox, mã, họ đệm, tên, ngày sinh, giới tính, chuyên ngành, học phí, nhóm hiện tại. Học phí bắt đầu tại x732, kéo đến852; nhóm hiện tại bắt đầu x852, kéo đến976. Phần lớn học phí và toàn bộ nhóm hiện tại nằm ngoài vùng nhìn ban đầu. Đã chụp trạng thái **10 candidates** trước sửa: [RD-001](../.tmp/qa-focused-20261018/RD-001-before-ten.png).

## Column-value audit và quyết định

Đã đọc cả `listEligibleStudents` phía backend và `unassignedInScope` phía frontend. Endpoint có thể trả assignedGroup, nhưng frontend lọc `!student.assignedGroup` trước khi đưa vào bảng. Assignment chỉ hoạt động khi chọn đúng một major; candidates còn được lọc `student.majorId === selectedMajor`. Không sửa các predicate này.

| Cột cũ | Quyết định | Lý do / cách giữ thông tin |
|---|---|---|
|Checkbox|Giữ|Chọn người, select-all visible và hidden selection nguyên trạng|
|Mã / Họ đệm / Tên|Gộp thành **Học viên**|Tên đầy đủ ở dòng chính; mã ở dòng phụ. Giữ `personNameParts` ưu tiên structured fields như trước|
|Giới tính|Gộp vào metadata của Học viên|Vẫn hiện cùng mã, không bỏ dữ liệu có thể khác nhau giữa học viên|
|Ngày sinh|Giữ cột riêng|Giúp phân biệt người trùng tên; giá trị/format giữ nguyên|
|Học phí nhập học|Giữ cột riêng|Ba trạng thái Đã nộp / Chưa nộp / Chưa có dữ liệu vẫn có; không thay semantics hoặc điều kiện Gán|
|Chuyên ngành|Bỏ dedicated column|Cố định bởi scope; chuyên ngành được chọn vẫn hiện trong filter ngay trên workspace. Search theo majorName vẫn nguyên trạng|
|Nhóm hiện tại|Bỏ dedicated column|Mọi candidate đều chưa có nhóm. Tên pane và accessible table name **Học viên chưa phân nhóm** diễn đạt đúng trạng thái chung; không có group name khác nhau bị che/bỏ|

Không thêm cách lọc/sắp xếp mới. Không thay đổi học viên nào được coi là eligible. Thông tin nhóm/thành viên khác nhau ở pane phải được giữ nguyên hoàn toàn.

## After

Bốn cột: **checkbox · Học viên · Ngày sinh · Học phí nhập học**. Dùng ResizableTable hiện có, tổng default base widths582px, không đổi ResizableSplit hoặc tỷ lệ55:45.

| Đo thực tế với10 candidates | After |
|---|---:|
|Pane trái / phải sau refresh default|764.5 / 625.5 px|
|Candidate clientWidth|731 px|
|Table / scrollWidth|731 px|
|Cuộn ngang cần thiết|**0 px**|
|Cột Học viên|327.25 px tại checkpoint này|
|Cột Học phí|177.25 px, hiện trọn trong pane|
|Row thường|56 px|
|Viewport dọc của bảng / scrollHeight|518 / 597 px, có cuộn dọc cho10 người|

ClientWidth giảm nhẹ so với before do scrollbar dọc khi identity chuyển thành hai dòng. Đây là đổi mật độ theo chiều dọc để giữ identity/status dễ đọc; không ép font nhỏ hoặc làm trang rộng ngang. Có thể cuộn dọc riêng trong bảng; nút Gán nằm phía trên và vẫn nhìn thấy.

Tên và mã cho phép wrap, không line-clamp tên hoặc ép cắt một dòng. Tên có `title` đầy đủ; mã có title khi có giá trị. Thiếu mã hiện **Mã: Chưa có**; thiếu giới tính có nhãn rõ. Không dùng dấu gạch trống để giả định đã có mã.

Computed typography: tên **13px / line-height19.5px**, metadata **13px /19.5px**, tuition chip **12px /18px**. Ngày sinh/body cell còn **12.5px** theo global project styles, bằng before; không giảm cỡ chữ. Metadata màu `#526579`. Header và tên cột vẫn dùng thuật ngữ đầy đủ.

Tạo storage key mới `masters-assignment-candidate-compact-column-widths` cho cấu trúc bốn cột; không áp các custom widths của layout chín cột vào layout mới. Không xóa key cũ. Người dùng tiếp tục resize cột và split như trước.

### Resize và sticky identity

Chỉ truyền `freezeThrough="learner"` vào khả năng sticky có sẵn của ResizableTable, không viết sticky framework mới và không sửa shared component.

- Pointer kéo pane trái về **39%**: candidate clientWidth516px, table582px; horizontal range66px. Wheel ngang thực tế đạt offset66px, identity x72 **giữ nguyên trước/sau**; tuition hiện trọn khi cuộn phải.
- Checkbox + identity có background opaque, selected background `rgb(237,244,250)`. Header sticky z-index4, body z-index2. Header/checkbox vẫn hiểu được khi cuộn. Ngày sinh có thể nằm ngoài phần đang nhìn ở pane hẹp; cuộn lại để đọc, identity vẫn đứng yên.
- Pointer kéo lên **65%**: pane trái907.4px, phải488.6px; bảng trái879/879px, không cần cuộn ngang. Pane phải giữ target/capacity/empty guidance; bảng member vẫn có scroll ngang và nút remove sticky hiện có khi bị thu hẹp.
- Tab9 lần từ vị trí focus đang thử đến divider; ArrowLeft đổi65→63, ArrowRight trả65. Pointer sau đó trả55%. Không kết luận mọi viewport cực hẹp đều nhìn toàn bộ dữ liệu cùng lúc.
- Không đổi giới hạn resize, layout hai pane hoặc responsive breakpoint. Trường hợp tự resize cột rất rộng vẫn có thể scroll; đây là lựa chọn người dùng, không phải layout mặc định.

Pane phải rỗng vẫn có lời hướng dẫn “Nhóm này hiện chưa có học viên…” trong bảng. Giữ khoảng trắng của workspace; không thêm trang trí để lấp chỗ và không redesign member list.

## Files changed trong task này

1. `frontend/src/pages/masters/assignClassGroups.jsx`: column definitions, candidate identity composition, colSpan theo số cột, key lưu độ rộng mới và sử dụng sticky có sẵn.
2. `frontend/src/pages/masters/assignClassGroups.css`: style identity/metadata/tuition; bỏ container rules dành riêng cho các cột candidate cũ.
3. `frontend/src/test/integration/AssignClassGroups.test.jsx`: thêm hai regression cases cho presentation và search.
4. `docs/ASSIGNMENT-TABLE-READABILITY.md`: báo cáo này.

Đối chiếu với local snapshot đầu task: toàn bộ code trước `candidateColumns` (eligibility/load/actions/selection/target/create), JSX dialog, Summary JSX và toàn bộ pane phải đều giống hệt. Không lấy toàn bộ diff HEAD vốn chứa công việc trước đó làm thay đổi của task này.

## Tests và build

Lệnh từ `frontend`:

```powershell
npm test -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js --maxWorkers=2
npm run build
```

**73/73 pass**: Assignment49, Create11, naming logic13; trước task71. Hai case mới:

- Tên dài nhiều thành phần có structured name, code dài, giới tính, ngày sinh và ba trạng thái tuition; thiếu mã; đúng bốn headers; chỉ bỏ các cột invariant. Người assigned và sai major vẫn không được hiển thị. Structural assertions xác nhận checkbox/identity sticky, không kiểm pixel.
- Search theo mã và điện thoại vẫn lọc đúng, giữ selection của người đang bị search ẩn.

Sau bổ sung structural assertions sticky, chạy lại riêng:

```powershell
npm test -- src/test/integration/AssignClassGroups.test.jsx --maxWorkers=2
```

**49/49 pass**. Các regressions tạo tại chỗ open/cancel/success/failure/multiple/unusable/cap-overflow/hidden selection/URL và response muộn đều giữ xanh. Không sửa `ClassGroupCreateDialog`, management route hoặc test expectation của flow tạo.

Production build **pass**. Có cảnh báo chunk >500kB như trước; Vitest còn async React act warnings, không có test failure. Logs local: `.tmp/assignment-readability/tests.log`, `assign-final.log`, `build.log`. `git diff --check` không báo whitespace error. Không chạy full repository suite vì không đổi shared component/backend.

## Manual browser evidence — 1440×900

Edge thật qua CDP pointer/keyboard, DEV backend/database thực; không mock API response để kết luận layout pass. Screenshot full-page giữ viewport layout1440×900, chỉ mở rộng vùng capture theo chiều dọc.

| Check | Actual / evidence |
|---|---|
|~10 candidates, default|[RD-002](../.tmp/qa-focused-20261018/RD-002-after-ten-empty-target.png): có mã QA-2026-01 và người thiếu mã; identity/ngày sinh/tuition hiện trọn; không cuộn ngang|
|10 selected|[RD-003](../.tmp/qa-focused-20261018/RD-003-ten-selected.png): selected10, cap5, vượt5; không silent truncation|
|Search active|[RD-004](../.tmp/qa-focused-20261018/RD-004-search-ten-selected.png): Đinh hiện3 nhưng tổng selected vẫn10|
|Narrow split|[RD-005](../.tmp/qa-focused-20261018/RD-005-narrow-sticky.png):39%, scroll66px, checkbox/tên giữ cố định; tuition đọc được|
|Wide split|[RD-006](../.tmp/qa-focused-20261018/RD-006-wide-split.png):65%; cả hai pane vẫn thao tác được; search/selection giữ nguyên|
|Full target|[RD-007](../.tmp/qa-focused-20261018/RD-007-full-target.png): nhóm .1 full1/1; Gán không thể vượt chỗ|
|Partial target +5 selected|[RD-008](../.tmp/qa-focused-20261018/RD-008-partial-target-five-selected.png): nhóm .2=2/5, còn3, selected5/vượt2;8 candidates vẫn không horizontal overflow|
|Full target +5 candidates|[RD-009](../.tmp/qa-focused-20261018/RD-009-full-target-five-candidates.png): nhóm .2=5/5; bảng trái vẫn đọc được|
|Empty target +Gán tiếp|[RD-010](../.tmp/qa-focused-20261018/RD-010-five-selected-before-restore.png): nhóm .6 trống, selected5/còn5; sau Gán roster đủ5, selection clear đúng lúc|

Kết luận trên dataset đã thử: **Học phí hiện đủ; trạng thái chưa có nhóm rõ ở tên pane; identity nối được với trạng thái cùng hàng, không phải cuộn qua lại ở default split. Không thấy cắt chữ quan trọng ở default.** Rows có thể cuộn dọc; split/column resizing vẫn giữ.

Tên rất dài được kiểm bằng integration fixture, chưa có tên dài tương đương trong10 candidates DEV thực để chụp browser; không sửa hồ sơ Admissions chỉ để tạo mẫu. Không tuyên bố browser long-name case đã pass. Long arbitrary group code thuộc pane phải không được tạo riêng ở lượt này; pane phải không thay đổi. Chưa kiểm zoom200%, mobile hoặc screen reader.

Artifacts trong [qa-focused-20261018](../.tmp/qa-focused-20261018/), prefix RD; browser-journal.jsonl có action/network metadata. Hai ảnh RD-005/006 cuối là checkpoint đã đo sau pointer resize thực, không phải lần helper click divider chưa có keyboard focus.

### DEV data và khôi phục

Đã bỏ10 members khỏi QTKD .2/.6 qua UI để tạo candidate list, rồi gán lại qua UI theo các checkpoint partial/full. Cuối lượt đã khôi phục đúng learner→group mapping, cap và status như trước task: .2=5/5, .6=5/5, .1=1/1; groups11/members15. Membership IDs mới được sinh do remove/reassign, không giả định row IDs giữ nguyên.

Read-only [db-readability-final.json](../.tmp/qa-focused-20261018/db-readability-final.json) so với snapshot trước: group data bằng nhau, learner/name/code/studyStatus→group mapping bằng nhau; duplicates rỗng. Admission records/evaluations211/21, offerings6, sessions6, gradebook1 giữ nguyên. Không tạo/xóa group, không sửa hồ sơ, không time fixture/reset/reseed trong lượt này.

## Unchanged

Business logic, eligibility, sorting/search semantics, selection/target/capacity/remove, tuition/studyStatus và backend không sửa. Summary và Dashboard không sửa. In-place “+ Tạo mới” và shared dialog không sửa; regressions vẫn pass. Không bundle major-name disambiguation hoặc network error wording. **Không commit, push, reset hoặc revert local work.**
