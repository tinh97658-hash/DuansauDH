# Assignment — mã học viên và họ tên riêng — 18/10/2026

Đã đổi bảng candidate từ4 sang5 cột theo yêu cầu. Browser 1440×900, split55:45: **clientWidth737px / scrollWidth737px / horizontal range0px** với10 candidates.

## Before → After

Before: checkbox | Học viên (họ tên + mã + giới tính) | Ngày sinh | Học phí nhập học. Bảng bốn cột không overflow nhưng mã bị đặt trong metadata dưới tên; hàng thường56px.

After: **checkbox | Mã học viên | Họ tên | Ngày sinh | Học phí nhập học**.

- Mã lấy nguyên `s.code` đang dùng; thiếu thì hiện **Chưa có**, không dùng UUID/admissionRecordId. Mã bình thường một dòng; mã quá dài có ellipsis và full title.
- Họ tên dùng nguyên construction `personNameParts` hiện có. Giữ full title và wrapping tự nhiên cho tên dài; không tách họ đệm/tên riêng.
- Bỏ giới tính khỏi visual row để tránh metadata làm hàng cao; không xóa field khỏi dữ liệu/model và không đổi logic.
- Không đưa lại cột Chuyên ngành, Nhóm hiện tại hoặc Giới tính. Scope và tên pane chưa phân nhóm vẫn nguyên trạng.
- Empty-state wording giữ **Không còn học viên chưa có nhóm.**

### Kích thước đo thực tế

| Cột | Base width | Browser width tại55:45 |
|---|---:|---:|
|Checkbox|44px|66.59px|
|Mã học viên|115px|137.59px|
|Họ tên|210px|232.59px|
|Ngày sinh|110px|132.59px|
|Học phí nhập học|145px|167.63px|

ResizableTable hiện có phân bổ phần dư cho các cột chưa có custom width; Họ tên vẫn lớn nhất. Tổng base624px, browser737px. Không sửa thuật toán shared table chỉ để ép width checkbox đúng base.

Hàng thường **39px**, so với56px của layout bốn cột. Mã và họ tên computed **13px**, tuition chip12px; ngày sinh/body theo global styles12.5px giữ nguyên. Không giảm font để vừa bảng. Mã QA-2026-01 và fallback Chưa có đều hiện đủ; học phí hiện trọn tại default split.

Width storage mới: **masters-assignment-candidate-compact-v2-column-widths**. Không tái sử dụng hoặc xóa key của bảng4/9 cột; việc resize tiếp tục qua ResizableTable/ResizableSplit hiện có.

## Sticky decision

Giữ `freezeThrough="learner"`; vì code đã nằm trước learner, shared implementation tự freeze **checkbox + Mã học viên + Họ tên**. Không sửa ResizableTable.

Đã kiểm bằng pointer resize và wheel ngang thật:

- **39% trái:** client516px, table624px, scroll range108px. Tổng frozen369px, còn147px, đủ xem tuition145px khi cuộn phải.
- Trước/sau scroll108px, ba ô frozen giữ x30/x74/x189; header/body cùng tọa độ. Identity có background opaque, không bị nội dung cuộn xuyên qua. Ngày sinh nằm sau vùng frozen khi cuộn hết phải; cuộn về trái để đọc ngày sinh, identity vẫn giữ.
- **65% trái:** client879px, table879px, không overflow. Trả split về55% sau kiểm tra.

Chọn freeze cả mã và tên vì vừa vùng kiểm tra hẹp39%, không cần đổi thứ tự cột hoặc viết sticky riêng. Không cam kết nhìn đồng thời mọi cột ở pane bị kéo sát minimum hoặc khi người dùng tự đặt custom width rất lớn.

## Files changed trong task này

1. `frontend/src/pages/masters/assignClassGroups.jsx`: thêm code column/cell, đổi header Họ tên, widths và storage key; bỏ metadata dưới tên.
2. `frontend/src/pages/masters/assignClassGroups.css`: thay style metadata bằng style mã một dòng13px.
3. `frontend/src/test/integration/AssignClassGroups.test.jsx`: cập nhật case presentation sang đúng5 headers, code/name ở hai cell riêng, fallback rõ, không dùng internal ID; sticky ba cell đầu.
4. `docs/ASSIGNMENT-CANDIDATE-COLUMNS-V2.md`: báo cáo này.

Working tree chứa các thay đổi có trước. Chỉ tính các điều chỉnh trên cho task này; không reset/revert công việc trước.

## Tests / Build

Lệnh từ `frontend`:

```powershell
npm test -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js --maxWorkers=2
npm run build
```

**73/73 pass**, giữ tổng số case từ lượt trước: Assignment49 / Create11 / logic13. Cập nhật existing presentation test, không bỏ các regression khác. Bao gồm code/name/phone search, hidden selection, target/capacity/remove và toàn bộ in-place create cases: cancel/success/failure/multiple/unusable/cap-overflow/response muộn. Long name/code được kiểm bằng integration fixture, không có pixel-perfect unit assertions.

Production build **pass**. Vẫn có chunk-size warning >500kB và React act warnings trong test logs; không có test failure. Logs `.tmp/assignment-columns-v2/tests.log`, `build.log`. `git diff --check` không báo lỗi whitespace. Không chạy suite toàn repository vì không thay shared implementation/backend.

## Manual browser — 1440×900

Edge thật, frontend3100/backend3001 và PostgreSQL DEV. Dùng UI bỏ members để có10 candidates, đo layout rồi gán lại bằng UI; không mock API response.

| Case | Evidence / actual |
|---|---|
|Default55:45,10 candidates|[CV2-001](../.tmp/qa-focused-20261018/CV2-001-default-ten.png): đủ5 cột, không horizontal scroll, chữ quan trọng không bị cắt|
|10 selected|[CV2-002](../.tmp/qa-focused-20261018/CV2-002-ten-selected.png): selected10, cap5, vượt5; không truncation|
|Search tên Đinh|[CV2-003](../.tmp/qa-focused-20261018/CV2-003-search-ten-selected.png): hiện3 rows nhưng selected vẫn10|
|Narrow39% +scroll108px|[CV2-004](../.tmp/qa-focused-20261018/CV2-004-narrow-sticky.png): checkbox/mã/tên cố định, tuition tới được|
|Wide65%|[CV2-005](../.tmp/qa-focused-20261018/CV2-005-wide-split.png): no horizontal overflow, split vẫn hoạt động|
|Có mã, search theo mã|[CV2-006](../.tmp/qa-focused-20261018/CV2-006-with-code.png): QA-2026-01 nằm cột riêng cạnh Hồ Phương Thảo; selected10 vẫn giữ|
|Thiếu mã, search theo họ tên|[CV2-007](../.tmp/qa-focused-20261018/CV2-007-without-code.png): Hoàng Đức Anh có Chưa có ở cột mã, không dùng internal ID|

Screenshot full-page giữ viewport layout1440×900, mở rộng capture dọc khi cần. Journal nằm cùng thư mục evidence; prefix CV2 thuộc task này. Tên dài khác thường chỉ có trong integration fixture, không tạo/sửa Admissions để chụp browser. Không chạy mobile/zoom200% hoặc screen reader ở lượt này.

Đã gán lại đúng5 người về QTKD .2 và5 người về .6. Read-only [db-columns-v2-final.json](../.tmp/qa-focused-20261018/db-columns-v2-final.json) xác nhận group data và learner→group/studyStatus mapping bằng snapshot trước task, duplicates rỗng; groups11/members15. Remove/reassign sinh membership row IDs mới, không giả định ID membership được giữ. Không đổi cap/status, không tạo group hoặc chỉnh hồ sơ. Candidate cuối quay về empty wording hiện có.

## Unchanged

Đối chiếu local snapshot: toàn bộ code trước candidateColumns (eligibility/load/search/selection/target/capacity/create/actions), JSX dialog, Summary và pane phải nguyên vẹn. **Business logic, backend, tuition/studyStatus, Dashboard, Summary và in-place create không sửa.** Không sửa ClassGroupCreateDialog hoặc shared ResizableTable/ResizableSplit. Không bundle duplicate-name/network-error findings. **Không commit/push/reset/revert.**
