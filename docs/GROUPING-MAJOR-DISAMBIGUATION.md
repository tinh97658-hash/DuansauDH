# Grouping — phân biệt chuyên ngành trùng tên — 18/10/2026

Đã xử lý FG-UX-003 trong Grouping bằng nhãn nghiệp vụ. Selector, scope hiện tại và Summary dùng cùng formatter; value/key/navigation/count vẫn dựa trên **ID**.

## Data inspected

Đọc API DEV `/system/majors?program=masters` và source `Major`, `system.service`, trang danh mục chuyên ngành, naming của ClassGroup.

| ID | code | name | disciplineId | active |
|---|---|---|---|---|
|708c1ed3-3599-4d87-afc5-5958facbdcd3|KTHH|Khai thác hàng hải|7e3b2609-2aef-4c96-ae3b-bc3d075767c1|true|
|6338999f-8ca0-4199-a42b-23fe8dfe53bd|KTHH2|Khai thác hàng hải|7e3b2609-2aef-4c96-ae3b-bc3d075767c1|true|

Cả hai thuộc Masters, cùng ngành `7840101 — Khai thác hàng hải`. `englishName`/description đều null. `Major.code` là mã chuyên ngành, bắt buộc trong model, unique theo program+code và được service kiểm tra khi tạo/sửa; UI danh mục đặt nhãn **Mã chuyên ngành**. ClassGroup cũng dùng mã này để sinh tên. Vì vậy dùng `code` là định danh nghiệp vụ phù hợp, không phải tự suy từ UUID.

Endpoint lọc program/isCommon, không tự loại inactive. Task này không thêm/bớt active filtering hoặc thay visible option set.

## Display rule

**Conditional:** tên duy nhất giữ tên bình thường; các tên bị trùng trong `visibleMajors` hiện **CODE — Tên**. Dùng dấu phân cách đang có ở nhãn ngành/CTĐT của dự án, không hard-code KTHH/KTHH2.

Duplicate detection dùng trim, collapse whitespace, Unicode NFC và `toLocaleLowerCase("vi")`. Chỉ dùng name để phát hiện ambiguity; label map luôn keyed bằng major.id, không merge entities/counts. Không mutate tên hoặc mã gốc. Khi đổi discipline, formatter nhận tập options sau filter hiện có; không tự lọc riêng theo active.

Before: hai options **Khai thác hàng hải** giống nhau.

After:

- **KTHH — Khai thác hàng hải**
- **KTHH2 — Khai thác hàng hải**

Unique majors như Công nghệ thông tin/Quản trị kinh doanh vẫn chỉ hiện tên. Không thêm code vào candidate rows hoặc đổi label ở toàn hệ thống.

## Scope, Summary, accessibility

- MenuItem value/key vẫn major ID, không encode label vào URL. Text option khác nhau nên accessible option names khác nhau, không dựa vào màu/tooltip.
- Select sau khi chọn vẫn hiện label có code, giữ nhận biết scope ngay trong Assignment.
- Summary dùng cùng label cho visible row và aria-label; key/count/navigation giữ major.id. Hai same-name majors có pending sẽ hiện hai row và hai count riêng. Không đổi card layout hoặc thêm badge.
- DEV hiện không có cả hai major pending cùng lúc; **không gọi đây là Summary bug đã tái hiện thực tế**. Tình huống hai pending rows/count1 và2 được kiểm bằng integration fixture.
- Dialog “+ Tạo mới” không thay đổi theo phạm vi task; scope label của Assignment nằm ở selector hiện có.

### Missing codes / catalog deficiency

Unique name thiếu code vẫn hiện tên. Duplicate name thiếu code hiện **Tên (chưa có mã chuyên ngành)**; không có `undefined`, `null`, prefix rỗng hay UUID.

Nếu hai labels vẫn không phân biệt được, ví dụ cả hai thiếu mã hoặc có cùng mã, hiển thị warning: **Danh mục có chuyên ngành trùng tên chưa có mã phân biệt. Vui lòng kiểm tra danh mục trước khi chọn.** Không tạo ordinal giả hoặc thay ID semantics. Trong catalog lỗi này, UI không thể cung cấp định danh nghiệp vụ chưa tồn tại; cần bổ sung mã qua một task quản trị dữ liệu riêng. Không khẳng định warning đã làm hai nhãn thiếu mã trở nên khác nhau.

Hai bản ghi DEV thực tế đều có mã khác nhau nên không gặp deficiency đó. Missing/duplicate-code cases là regression fixtures, không sửa DB để tạo lỗi catalog.

## Files changed

1. `frontend/src/pages/masters/groupingMajorLabels.js` — formatter cục bộ cho Grouping, normalization và phát hiện label chưa phân biệt được.
2. `frontend/src/pages/masters/assignClassGroups.jsx` — dùng label ở selector/selected scope và Summary text/aria-label; warning cho catalog unresolved.
3. `frontend/src/test/unit/groupingMajorLabels.test.js` — 5 cases cho unique/normalized duplicates/visible scope/inactive/missing hoặc duplicate code.
4. `frontend/src/test/integration/AssignClassGroups.test.jsx` — 4 cases cho Summary counts, options/IDs, Back/Forward, remount hai IDs và catalog unresolved.
5. `docs/GROUPING-MAJOR-DISAMBIGUATION.md` — báo cáo này.

## Tests / build

Lệnh từ `frontend`:

```powershell
npm test -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js src/test/unit/groupingMajorLabels.test.js --maxWorkers=2
npm run build
```

**82/82 pass**, 4 files: Assignment53, Create11, create logic13, labels5. Trước task73; thêm9 cases, không bỏ các regression cũ. Unique-name cases cũ vẫn pass; mới có labels/URL/counts/back-forward/refresh remount và safe missing-code presentation. Recent candidate5 columns, selection/search/target/capacity/remove và in-place create suite giữ xanh.

Production build **pass**. Log `.tmp/grouping-major-labels/tests.log`, `build.log`; còn React act warnings và build chunk-size warning như các lượt trước. `git diff --check` không báo whitespace error. Không chạy unrelated full repository suite.

## Manual browser

Edge thật, viewport1440×900, DEV frontend3100/backend3001. Không tạo pending giả hoặc dùng API write.

1. Mở selector ở Summary, thấy cả hai options khác nhau: [ML-001](../.tmp/qa-focused-20261018/ML-001-duplicate-options.png). Đọc option text/data-value xác nhận hai ID riêng.
2. Chọn KTHH, refresh thật: label **KTHH — Khai thác hàng hải**, `majorId=708c1ed3-3599-4d87-afc5-5958facbdcd3`: [ML-002](../.tmp/qa-focused-20261018/ML-002-major-A-refreshed.png).
3. Bấm Tổng quan, chọn KTHH2, refresh thật: label **KTHH2 — Khai thác hàng hải**, `majorId=6338999f-8ca0-4199-a42b-23fe8dfe53bd`: [ML-003](../.tmp/qa-focused-20261018/ML-003-major-B-refreshed.png).
4. Browser Back về Summary `?year=2026`, Forward phục hồi đúng KTHH2 ID/label; không nhảy sang bản ghi đứng trước.

Cả hai URL giữ `disciplineId=7e3b2609-2aef-4c96-ae3b-bc3d075767c1` và `year=2026`. Scope KTHH không có candidate vẫn là kết quả hợp lệ, không thêm hồ sơ để ép case. Từng refresh A/B đã quan sát thực tế; vòng Back/Forward nhiều bước A→Summary→B được kiểm thêm trong integration test.

Evidence/journal local nằm trong `.tmp/qa-focused-20261018/`, prefix ML; log thao tác `.tmp/grouping-major-labels/browser.log`. Summary hai pending majors được kiểm tự động, không tuyên bố có screenshot data thật cho case chưa tồn tại.

## Unchanged

Không merge/rename/delete catalog, chọn canonical record hoặc migrate foreign keys. Không đổi backend/business rules, eligibility/URL identity/counts, tuition/studyStatus. Không sửa candidate5-column layout, split pane, search/selection/target/capacity/remove, ClassGroupCreateDialog hoặc flow “+ Tạo mới”. Candidate columns/pane và shared dialog được đối chiếu nguyên vẹn với local snapshot đầu task. Dashboard và Summary layout không sửa. Không chỉnh Admissions hoặc dữ liệu nghiệp vụ. **Không commit/push/reset/revert; giữ local work có trước.**
