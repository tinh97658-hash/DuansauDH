# Assignment — tạo nhóm tại chỗ — 18/10/2026

Đã thay contextual “+ Tạo nhanh nhóm mới” chuyển route bằng **“+ Tạo mới” mở AppDialog ngay trong Assignment**. Tạo nhóm là tác vụ phụ; selected IDs, search và workspace không bị remount. Không triển khai các finding UX khác của lượt audit.

## Files changed trong task này

- `frontend/src/pages/masters/ClassGroupCreateDialog.jsx` — mới: form create/edit dùng chung, initial defaults, tải CTĐT, preview mã, validation và API write.
- `frontend/src/pages/masters/createClassGroups.jsx` — dùng shared dialog; tiếp tục quản lý list, filters, edit/delete và navigation của route đầy đủ.
- `frontend/src/pages/masters/assignClassGroups.jsx` — mở dialog theo scope hiện tại, giữ draft, reload targets và chọn nhóm mới hợp lệ.
- `frontend/src/test/integration/AssignClassGroups.test.jsx` — cập nhật kỳ vọng CTA/route, thêm hồi quy feature.
- `docs/ASSIGNMENT-INPLACE-CREATE.md` — báo cáo này.

Working tree trước task đã có nhiều thay đổi của các task khác. Danh sách trên chỉ tính phần thực hiện ở lượt này; không dùng `git diff HEAD` để quy toàn bộ thay đổi sẵn có cho task này. Baseline source và status lưu local trong `.tmp/inplace-create/`.

## Shared create refactor

Tách dialog và orchestration vốn inline trong CreateClassGroups thành `ClassGroupCreateDialog`. Tách cả nhánh edit để route quản lý không phải giữ một bản form/state/CTĐT gần giống riêng. Component chỉ được mount khi bắt đầu một phiên create/edit.

Cả management route và Assignment dùng cùng:

- Initial defaults, load CTĐT active đúng major/year; tự chọn khi chỉ có một CTĐT.
- Naming helpers nguyên trạng trong `createClassGroups.logic.js`, preview và các index còn trống.
- Validation và batch POST `/masters/class-groups/batch`, count 1–10; không thêm auto-assignment vào creation.
- Nhánh edit PUT hiện có; không fork handleSave hoặc copy request logic sang Assignment.

Management route vẫn còn, giữ filters/list/delete và các legacy quick-create deep links để tương thích. Assignment không còn sinh các link chuyển route đó. Không nhúng toàn page quản lý vào dialog.

Shared dialog dùng AppDialog hiện có; không sửa AppDialog hay tạo modal framework. Khi đang save, chặn submit lặp và đóng dialog. Lỗi save hiện trong dialog, giữ field values để retry. Đã bỏ phần UI auto-assignment vốn nằm trong comment khỏi đoạn được tách; không thay business behavior.

## New Assignment flow

**Open:** chỉ hiện CTA khi chưa có open target hoặc tất cả open targets đã full, theo visibility rules hiện có. Nếu target full nhưng nhóm khác còn chỗ, vẫn hướng sang nhóm hiện có. Scope Masters/year/discipline/major được prefill; ba control phạm vi khóa. CTĐT vẫn dùng logic chung, cho chọn nếu có nhiều CTĐT hợp lệ.

**Cancel:** chỉ unmount dialog. Không gọi reload, không POST, không navigate, không đổi target/search/selection/URL.

**Success:** GET lại groups cho scope đã mở dialog, không reload candidate list. Đối chiếu response creation với rows đã tải lại: có ID, Masters, đúng major/year, status open và còn chỗ theo Assignment hiện có. Chọn nhóm mới bằng `groupId` trên URL với replace; pathname giữ nguyên. Dialog đóng, selection/search giữ nguyên, có thể Gán ngay nếu đủ chỗ.

**Multiple:** chọn **nhóm khả dụng đầu tiên theo thứ tự `groups` trong response tạo**, không theo thứ tự code ở target selector. Nhóm closed/full/sai scope bị bỏ qua. Quy tắc có comment và integration test với thứ tự code ngược thứ tự response.

**Unusable/missing ID:** reload targets, giữ selected IDs/search/scope; giữ target cũ nếu còn hợp lệ, nếu không thì bỏ ID invalid. Chặn background auto-selection trong kết quả này để không âm thầm chọn nhóm khác. Hiện thông báo tạo thành công nhưng chưa có nhóm mới khả dụng; người dùng có thể chọn target thủ công. Không suy ID mới từ tên hoặc vị trí list.

**Failure:** dialog giữ nguyên form và Assignment draft. Nếu POST đã thành công nhưng GET groups thất bại, đóng dialog và báo rõ tình trạng; nút **Tải lại nhóm** chỉ retry GET, không POST lại. Draft vẫn giữ nguyên.

**Scope/navigation:** modal chặn pointer/focus xuống workspace. Kiểm scope trước submit và sau response; mỗi phiên có object identity riêng. Đổi scope hoặc unmount Assignment vô hiệu hóa phiên cũ, không để response muộn reload/chọn target/navigate trở lại trang. Đổi scope vẫn clear draft theo hành vi cũ.

**Capacity:** tạo cap 3 khi chọn 5 vẫn chọn đủ 5, báo vượt 2 và disable Gán. Không cắt selection. Capacity và backend validation không thay đổi.

### Draft preservation

| State | Open/Cancel/POST failure | Create success |
|---|---|---|
|Selected learner IDs, gồm người bị search ẩn|Giữ nguyên|Giữ nguyên; chỉ clear sau Gán thành công như trước|
|Candidate search/results|Giữ nguyên|Giữ nguyên, không refetch candidates|
|Target|Giữ nguyên|Chủ động chuyển sang nhóm mới usable; không chọn ID invalid|
|Year/discipline/major|Giữ nguyên, locked trong dialog|Giữ nguyên|
|URL|Giữ nguyên|Chỉ đổi `groupId` khi có target mới; pathname không đổi|
|Split/candidate DOM/scroll|Không remount workspace|Không remount; reload chỉ targets|

## Tests

Trước: **57 existing cases** — AssignClassGroups 33, CreateClassGroups 11, naming logic 13. Đã cập nhật một navigation test và ba assertion visibility theo tên CTA mới, không bỏ các assertion khác. Thêm **14 cases** ở Assignment:

1. Open/Cancel với 5 selected, search Đinh có 3 visible; khóa scope, giữ URL/target và không reload/POST.
2. Create cap 5 rồi submit đủ 5 ID, gồm 2 hidden selections.
3. Create cap 3 giữ 5 và disable Gán với vượt 2.
4. POST failure giữ form/target/draft rồi retry.
5–10. Không chọn created group thiếu ID, closed, full, sai major, sai year hoặc sai program; có feedback và manual target vẫn dùng được.
11. Multiple groups chọn usable đầu tiên theo creation order.
12. POST success/GET failure; retry GET không tạo trùng, draft giữ nguyên.
13. Đổi scope trước response: không attach target cũ.
14. Rời Assignment trước response: không reload/navigate từ component đã unmount.

Các regression Summary, URL, target manual/full, auto-target, selection/search, remove, scope response cũ, submit, capacity và split vẫn chạy. Shared dialog được kiểm qua cả hai consumer trong integration tests, không thay bằng mock form.

Lệnh chạy từ `frontend`:

```powershell
npm test -- src/test/integration/AssignClassGroups.test.jsx src/test/integration/CreateClassGroups.test.jsx src/test/unit/createClassGroups.logic.test.js --maxWorkers=2
npm run build
```

Kết quả bản cuối: **71/71 pass**, 3 test files; Assign 47 / Create 11 / logic 13. Production build **pass**. Log: `.tmp/inplace-create/tests-verified.log`, `.tmp/inplace-create/build-verified.log`. Vitest còn cảnh báo React `act(...)` từ async UI test; không có test fail. Build còn cảnh báo chunk >500 kB. Lượt đầu sandbox chặn esbuild spawn (EPERM); chạy lại ngoài sandbox thành công.

Không chạy full repository suite vì không đổi shared dependency dùng rộng, backend hay Dashboard. `git diff --check` cho các file đã sửa không báo whitespace error. Summary JSX được đối chiếu nguyên vẹn với bản local đầu task.

## Manual browser regression

Edge thật, viewport 1440×900; frontend `localhost:3100`, backend `localhost:3001`, PostgreSQL DEV `127.0.0.1:55432/pgsms`. Thao tác bằng pointer/keyboard qua browser CDP, không gọi API write thay UI. Browser offline được bật riêng lúc thử failure rồi trả online.

| Case | Before → Actual after |
|---|---|
|Open + Cancel|5 selected, search **Đinh**, 3 rows visible, QTKD .2 full → giữ nguyên cả bốn; URL nguyên vẹn|
|Create offline failure|Cap 3, note đã nhập → dialog vẫn mở, báo lỗi, cap/note/5 selected/search/target giữ nguyên|
|Retry và cap nhỏ|Online retry → nhóm **QTKD 2026.1.5** được chọn, dialog đóng; **5 selected / 3 chỗ / vượt 2**, Gán disabled, search Đinh và 3 rows giữ nguyên|
|Create đủ chỗ|Sau chuẩn bị nhóm .5 closed qua management UI, chọn lại 5/search Đinh → tạo **QTKD 2026.1.6 cap 5**, chọn đúng nhóm mới, đủ 5 selected và search giữ nguyên|
|Assign tiếp ngay|Gán 5 → .6 có **5/5**, roster đúng ba Đinh + Hồ Ngọc Mai + Hoàng Đức Anh; candidates không còn các ID đó, selection clear sau success; search vẫn Đinh|
|Management route|Render list, sửa cap/status qua form chung thành công; mã thiếu `{n}` làm nút tạo disabled; sửa lại rule rồi tạo batch **CNTT .2/.3**, đều closed cap 2, đúng 2 rows xuất hiện; pathname vẫn route quản lý|

**Contextual create: 0 pathname transitions** khi open/cancel/failure/retry/success. Success chỉ đổi query `groupId` để giữ target qua refresh. Navigation sang management trong bảng trên là bước chuẩn bị/kiểm route riêng, không phải một phần contextual create.

Evidence local trong [qa-focused-20261018](../.tmp/qa-focused-20261018/):

- [IP-001](../.tmp/qa-focused-20261018/IP-001-dialog-draft.png): dialog và draft bên dưới.
- [IP-002](../.tmp/qa-focused-20261018/IP-002-failure-preserved.png): create failure giữ form.
- [IP-003](../.tmp/qa-focused-20261018/IP-003-created-cap3-selection5.png): cap 3/selected 5.
- [IP-004](../.tmp/qa-focused-20261018/IP-004-created-cap5-preserved.png): cap 5 và hidden selection giữ nguyên.
- [IP-005](../.tmp/qa-focused-20261018/IP-005-assigned-five.png): Gán 5 thành công.
- [IP-006](../.tmp/qa-focused-20261018/IP-006-management-batch-created.png): route quản lý tạo batch.

Journal của browser ở cùng thư mục (`browser-journal.jsonl`, các action IP thuộc lượt triển khai này). Nhiều nhóm/ID unusable, late response và reload failure được kiểm tự động có điều khiển; không tuyên bố đã dựng từng case đó bằng dữ liệu browser thật. Chưa chạy screen reader/toàn keyboard form hoặc hai staff gán đồng thời.

### DEV data sau hồi quy

Tất cả mutation qua UI, không dùng time fixture trong task này. Tạo thêm 4 groups: QTKD .5 cap3 (sau đó closed), .6 cap5 (open, 5 members); CNTT .2/.3 closed cap2. QTKD .2 đổi cap10→5 và còn5 members; .4 closed; .3 giữ closed như baseline. Năm học viên từ .2 được gán sang .6. Không reset/cleanup dữ liệu review.

Read-only snapshot [db-inplace-final.json](../.tmp/qa-focused-20261018/db-inplace-final.json): groups **7→11**, memberships **15→15**, admission records/evaluations **211/21** giữ nguyên; offerings6/sessions6/gradebook1 giữ nguyên. Báo cáo QA trước vẫn là snapshot lịch sử, không sửa lại để phản ánh dataset mới.

## Unchanged

Dashboard không sửa. Backend/API/business rules, tuition/studyStatus rules không sửa. Summary JSX, assignment CSS/split layout, major-name labels và thông báo lỗi Gán không sửa. Shared AppDialog không sửa. Giữ nguyên các local changes có trước. **Không commit, push, reset hoặc revert.**
