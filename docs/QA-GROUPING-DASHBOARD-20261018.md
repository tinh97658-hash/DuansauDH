# Manual QA — Phân nhóm Thạc sĩ và Home Dashboard — 18/10/2026

## Kết luận và phạm vi

Đã kiểm thử hai tính năng bằng browser thật, gồm selection stress, capacity, auto-target, tạo nhanh, remove, keyboard, Back/Forward/refresh và Dashboard qua các trạng thái 0/1/3/4 cảnh báo, bốn hàng đợi đồng thời, xử lý và tái xuất hiện thiếu điểm.

**Không xác nhận thêm lỗi FUNCTIONAL BUG/DATA INTEGRITY trong phạm vi đã chạy.** Có **4 finding UX/visual mức S3**, chi tiết bên dưới. Không phát hiện S0/S1 chặn phát hành ở persona admin đã thử; đây không phải chứng nhận toàn hệ thống/permissions/concurrency đã pass.

Điểm cần cải thiện nhất là **tạo nhanh chuyển route làm mất selection và search**. Khuyến nghị modal/drawer **“+ Tạo mới” ngay trong Assignment**, tái sử dụng logic tạo nhóm hiện có; **chưa triển khai**.

Chỉ audit Grouping và Dashboard. CourseOffering/Scheduling/Grades được dùng để chuẩn bị hoặc xử lý các trạng thái Dashboard, không đánh giá UX toàn bộ các module đó. Không kiểm lại QA-ADM-001/002, không điều tra DOB/GPA. Quy tắc nhập học đã được thay đổi ngày 25/10/2026: **chỉ đã đóng học phí mới là Đang học**; phân nhóm không tự chuyển trạng thái. Các kết quả QA ngày 18/10 là ghi nhận lịch sử, không xác nhận quy tắc hiện tại. Xem [quy tắc học phí](TUITION-ENROLLMENT-POLICY.md).

## 1. Môi trường và dữ liệu

- Repo `D:\SauDH\DuansauDH`, branch `nguyentrang9`, local working tree là nguồn kiểm thử. Giữ nguyên toàn bộ thay đổi có trước. Không sửa production implementation, không chạy suite thay cho manual QA, không commit/push/reset/revert.
- Frontend `http://localhost:3100`; backend `http://localhost:3001`; PostgreSQL DEV `127.0.0.1:55432/pgsms`, environment development. DB guard chỉ chấp nhận đúng host/port/database DEV trước khi tạo time fixture.
- Browser Edge headless thật, viewport **1440×900**, profile riêng, tắt extension/sync bằng launch flags, một observer chính. Đăng nhập qua form bằng tài khoản admin DEV có phân công xếp lịch; không ghi mật khẩu/cookie.
- Thời gian audit theo Asia/Bangkok: baseline DB **19:42:59**, snapshot DB cuối **19:59:09**, ngày18/10/2026. Không lấy timezone host làm ngày nghiệp vụ.
- Baseline đã có lifecycle từ trước, **không reset/reseed**. Có211 admission records tại đầu lượt này; không giả định bằng210 của lượt audit trước và không điều tra/chỉnh record chênh lệch.
- Baseline: groups4/members11/offerings3/sessions2/gradebooks1. KTQT Nhóm2 đã completed, gradebook revision6 và đủ10 kết quả. Home2026: grouping4, unscheduled1, pending0, missing-grade0.
- Persona: chỉ admin thực tế. Chưa có account operational khác trong fixture để xác nhận UI ẩn/disabled theo quyền. Không dùng admin để suy ra các role khác pass.

Artifacts riêng của lượt này: [qa-focused-20261018](../.tmp/qa-focused-20261018/). Có `source-before.txt`, `source-after.txt`, `db-baseline.json`, `db-final.json`, `browser-journal.jsonl`, `time-fixtures.jsonl` và PNG. `.tmp` là evidence local, có thể bị gitignore; cần giữ thư mục khi review báo cáo.

### Chuẩn bị trạng thái

Ưu tiên UI: tạo3 ClassGroup; gán/remove/reassign; tạm đổi cap QTKD .2 từ10→5→10 và đóng nhóm .3; tạo3 CourseOffering tên dài; tạo4 TeachingSession mới; sửa/xóa/re-enter một exam score KTQT; xác nhận4 buổi đã diễn ra. Không tạo/sửa hồ sơ tuyển sinh trong lượt này.

**Ngoại lệ time fixture đã công khai:** chỉ đổi `session_date` và `updated_at` của4 planned sessions trong DB DEV. Không đặt held/completed/grade trực tiếp. Lý do: UI không tạo lịch đã qua, còn Dashboard cần trạng thái quá giờ. Tất cả xác nhận/giải quyết sau đó qua UI.

| Session | Ngày trước → fixture | Lớp |
|---|---|---|
| `b592e7e4-c094-469e-88de-da01d4f7d746` |20/10→16/10| QA-2026 KTQL Nhóm1, có từ baseline |
| `c4dad57c-40ba-4397-be45-fe57e7274827` |19/10→13/10| QA FOCUS — Phương pháp nghiên cứu kinh doanh, tên dài |
| `2dcad5df-cc0f-4efd-b9f2-b0997974d24d` |20/10→14/10| QA FOCUS — Quản trị chiến lược |
| `315e96b5-a6d1-4c17-9072-07ce1e3cc5fd` |21/10→15/10| QA FOCUS — Quản trị marketing |

Before/after đầy đủ trong [time-fixtures.jsonl](../.tmp/qa-focused-20261018/time-fixtures.jsonl). Ba session QA FOCUS được tạo qua UI trước khi đổi ngày. Fixture được chia thành các bước để quan sát thực tế warningCount1→3→4.

## 2. Manual methodology

Từng hành động được chọn sau khi đọc UI; pointer/keyboard CDP phát input thật vào app, không gọi write API để thay thao tác. DOM read-only dùng để đọc URL, label, selected/disabled và CSS; screenshot để đánh giá bố cục. Backend/DB chỉ dùng baseline, fixture thời gian đã nêu và đối chiếu cuối. Không mock response để tuyên bố UX pass.

Hai phép mô phỏng network được tách riêng:

- **Offline trong browser**, bấm Gán5: request thật thất bại, selection còn nguyên; online rồi retry thành công. Không dừng backend hay làm mất mạng toàn máy.
- **Latency1800ms trong browser**, đổi năm: quan sát trạng thái loading và nút Gán disabled; sau đó bỏ throttle. Không dùng thời gian mô phỏng làm benchmark sản phẩm.

Một phiên helper đầu thiếu character event cho native Enter. Đã sửa **dụng cụ trong .tmp**, khởi động lại browser rồi thử lại: Enter kích hoạt đúng major row. Không ghi lỗi dụng cụ thành accessibility bug. Không sửa code sản phẩm. Space checkbox được phát native keyDown/keyUp riêng; không dùng DOM `.click()`/`.focus()` để vượt UI.

Journal ghi action và network metadata, fill values redacted. Các lỗi selector do chọn nhầm card phía sau dialog trong bước chuẩn bị lịch không được tính là lỗi app. Không lấy HTTP200 làm chứng cứ UX đủ; kết luận dựa trên count, selection, warning, destination và dữ liệu sau thao tác.

## 3. Grouping coverage

### Summary và navigation

| Case | Quan sát thực tế | Kết quả |
|---|---|---|
| Không còn học viên chờ |Năm2025; sau gán hết2026 cũng có empty state |Pass, wording hướng về phạm vi hiện tại |
| Một major chờ |Sau gán MT3, còn KTHH1; sau remove QA, QTKD1 |Pass, một row/action rõ |
| Nhiều major/ngành |Baseline MT3 và KTHH1, tổng4 |Pass,2 card ngành trong2 cột |
| Ngành có một major |Lọc Quản lý tài nguyên và môi trường, hiện KTMT3 |Pass |
| Ngành có nhiều major |Khai thác hàng hải có nhiều major trong selector, nhưng chỉ một major có pending trong dữ liệu đã thử |Partial: chưa có2 pending majors cùng ngành trong Summary |
| Tên giống, ID khác |Selector có hai “Khai thác hàng hải”: `708c1ed3…` và `6338999f…` |Finding FG-UX-003; chưa có cả hai pending để xem Summary cạnh nhau |
| Năm khác |2025 empty,2026 pending/empty; đổi qua lại |Pass; không chạy toàn lifecycle đa năm |
| Tab/Enter vào major |Từ combobox cuối, Tab tới row KTHH, Enter |Pass; native button và focus rõ |
| Back/Forward/refresh |Scope year/discipline/major trên URL, quay đúng view |Pass; manual target giữ qua refresh |
| Tổng quan |Trở lại Summary cùng năm, bỏ major/discipline đang chọn |Pass, phù hợp action “Tổng quan” toàn năm |

Summary compact: baseline2 card cao khoảng một row, không cần cuộn; count và arrow cùng mép phải. Full row dùng button, không phải chỉ icon nhỏ. Ngành và major trùng tên có lặp chữ ở một vài card nhưng là hai cấp dữ liệu, không gọi đó là duplicate entity. Chưa thấy overflow với tên “Quản lý tài nguyên và môi trường”. Chưa có mẫu rất nhiều ngành/card hoặc count ba chữ số.

### Assignment / selection stress

| Phép thử | Expected | Actual / evidence |
|---|---|---|
| Chọn3 rồi search Lý |Giữ3 hidden; chọn visible thêm được |Header chọn visible Lý làm tổng4, bỏ Lý còn3; clear search lộ đúng Hoàng/Hồ Ngọc/QA |
| Switch target cùng major |Giữ selection |3 selected giữ khi đổi .2→.3→full .1 |
| Đổi business scope |Clear selection |Đổi2026→2025 làm selected0, Gán disabled |
| Select-all visible, search, unselect subset |Hidden selections giữ đúng |Đã thử3→4→3; không chỉ đếm checkbox đang thấy |
| Remove member bên phải khi có candidate đã chọn |Không mất selection khác |QA vẫn selected trong khi remove9 người khác; G-009 |
| Empty search nhưng có hidden selection |Không quên tổng selection |Search không khớp: title0 HV, nhưng dòng “Đã chọn1” và Gán1 vẫn hiện; G-020 |
| Assign correct records |Đúng người biến khỏi candidate pool |Gán1,3,5,10 thành công; đếm thành viên/candidate cập nhật, refresh giữ |
| Cancel/confirm remove |Cancel không đổi, confirm trả candidate/capacity |Đã cancel rồi confirm QA; full10/10 thành9/10; remove không ảnh hưởng selection khác |
| Keyboard remove confirm |Tab/Enter thao tác được |Dialog: close→Hủy→Bỏ khỏi nhóm; thử cancel và confirm bằng Enter |
| Failure/retry |Giữ selection để thử lại |Offline Gán5 thất bại; giữ5/target; online retry gán đúng5 |
| Loading scope |Không cho Gán vào dữ liệu scope cũ |Latency fixture: không giữ các hàng cũ, nhóm hiện “Đang tải nhóm…”, Gán disabled; G-021 |

**Không thấy silent selection truncation**. Tổng “Đã chọn N” vẫn nhìn thấy khi search chỉ còn một phần hoặc0 dòng. Chuyển target không tự clear. Sau action thành công selection mới về0 và có feedback tên nhóm/số học viên.

### Capacity và auto-target

Đã dùng các nhóm có thật để tạo đủ trạng thái, không giả DOM:

- Empty: QTKD .2 lúc0/10, .4 lúc0/10; partial: .2 lúc9/10 và .4 lúc5/10.
- Exactly full: .1=1/1, .2=5/5 rồi10/10; cap3 KTMT và cap1 KTHH.
- Selected bằng chỗ còn:5 selected/cap5,10 selected/cap10; Gán thực thi đúng.
- Selected vượt chỗ còn:3 selected/chỉ còn1 ở .1, giữ cả3 và báo vượt2; Gán disabled (G-010).5 selected/full .2 báo vượt5 (G-012).
- All open groups full: đóng .3, .1 full1/1 và .2 full5/5, còn5 candidates. Warning nêu không có nhóm mở còn chỗ và đưa Tạo nhanh.
- Một nhóm full/nhóm khác còn chỗ: warning gợi ý có nhóm khác; có thể inspect full target mà hệ thống không tự đổi sang nhóm khác.
- No groups: KTHH và KTMT trước tạo; hiển thị trạng thái + CTA tạo nhanh.
- Auto-selection: khi vào QTKD không target, .1/.2 full và .3 available, chọn .3. Khi có .2/.4 available, thứ tự chọn ổn định theo danh sách; manual .2 giữ qua refresh. Sau tạo nhanh chọn đúng ID nhóm mới .4. Scope đổi làm chọn lại theo phạm vi mới.
- Nhóm .3 closed bị loại khỏi targets. Chưa thử **tạo mới một nhóm closed từ quick-create rồi quay lại**; source hiện có kiểm tra status open nhưng không dùng source để đánh dấu UI case đó pass.

Không thấy target flicker/selection loop ở mạng bình thường. Throttle kiểm loading không cho kết luận về mọi race. Chưa có hai phiên cùng gán để xác nhận concurrency/stale-capacity race.

## 4. Dashboard state matrix

Các số là quan sát qua UI sau thay đổi/return/refresh, không chỉ đọc API. Thứ tự tuple: **Grouping / Unscheduled / Missing grade / Pending confirmation**. Pending confirmation tính **lớp có buổi**, không giả định bằng số session nếu một lớp có nhiều session.

| State | Expected Dashboard | Actual | Pass/Issue |
|---|---|---|---|
| No work,2025 |4 cards healthy; queue/warning empty |0/0/0/0; overview0; year giữ sau refresh |Pass — D-002 |
| No work,2026 có dữ liệu |Queue empty dù vẫn có active/future classes |0/0/0/0; active5, teaching4, completed1 |Pass — D-012/015/016 |
| Grouping pending nhiều major |Top total=detail total, row đến đúng major |Baseline4=MT3+KTHH1; link top vào Summary |Pass — D-001 |
| Grouping pending1 |Đúng1 và đúng QTKD |Remove QA: grouping1; row CTA mở Assignment có target9/10 |Pass — D-003 |
| Grouping resolved |Return/Back/refresh giảm về0 |Gán QA xong Back về Home không còn queue grouping |Pass |
| Unscheduled offering |Card/work section/row đúng lớp chưa có session |Baseline1, QA-2026 KTQL Nhóm2; top vào queue, row chọn sẵn offering |Pass |
| Unscheduled resolved |Tạo session làm queue giảm |Xếp sáng19/10 qua UI, Back về0 |Pass — D-011 |
| Pending confirmation1 |Top pending1 + cảnh báo đúng entity |Backdate1 planned session, hiện lớp KTQL Nhóm1 |Pass — D-004 |
| Missing grades |Card pending và đúng gradebook |Blank exam Hồ Thanh Hà trong completed KTQT:1 nhóm/1HP |Pass |
| Multiple simultaneous queues |4 cards và các work section/warning cùng tồn tại |1/1/1/4, ba work section + warning panel |Pass — D-006 |
|0 warnings |Empty panel chủ ý, không bị cắt |Icon xanh nhỏ + thông báo centered, border/footer hoàn chỉnh |Pass — D-002/012 |
|1 warning |Entity/description/action đọc được |Một warning, CTA mở pending drawer đúng1 |Pass — D-004 |
|3 warnings |Ba preview rows đọc được |3 lớp, tên dài ellipsis1 dòng, mô tả và arrow riêng |Pass — D-005 |
|Vượt preview limit |Không kéo panel thành list dài vô hạn; xem đủ được |4 lớp nhưng preview3; “Xem tất cả4 lớp” mở drawer4 |Pass — D-006/008 |
| Warning resolved |Entity mất, count giảm |Xác nhận1 qua UI, Back về3; xác nhận3 còn lại, Home về0 |Pass — D-009/010 |
| Grades completed |Queue mất sau bổ sung điểm |Re-enter exam8, Home/Back về0 |Pass — D-012 |
| Grade incomplete again |0→pending lại; link vẫn đúng lớp |Blank lại exam8, Home xuất hiện1; row/footer mở KTQT; nhập lại→0 |Pass — D-014/016 |

Không thấy stale count/warning sau Back hoặc Home navigation trong những checkpoint trên. Không cần refresh thêm để “ép” cập nhật, nhưng cũng đã refresh Home kiểm lại. Year2025 lưu trên URL `?year=2025`;2026 mặc định hợp lý. Chưa benchmark số request trùng/latency trên production.

### Deep-link quality

IDs đầy đủ trong URL/evidence, dưới đây dùng ký hiệu:

- `Q`=major QTKD `2a85148c-d8f3-48b1-bf94-f8e16215821c`.
- `G`=QTKD .2 `38ddcd40-74ee-46c1-842b-bb0371a767e4`.
- `O`=KTQT .2 `0d1b4686-3b6f-47ea-a1b2-682b9c4e7e2d`.
- `S`=KTQT subject `53cf59f4-f895-4a17-bdec-396ba1dcd33e`.

| CTA variant | Destination/URL pattern | Context & extra work trước thao tác |
|---|---|---|
|Top Phân nhóm / grouping Xem tất cả |`/masters/assign-class-groups?year=2026`|Năm giữ; chọn major1 lần trong Summary là có chủ ý, không phải re-filter toàn màn |
|Grouping major row |`/masters/assign-class-groups?year=2026&disciplineId=…&majorId=Q`|Assignment đúng major, auto-target hợp lệ;0 filter actions, chọn HV rồi Gán |
|Top Xếp lịch / section Xem tất cả |`/masters/schedule?year=2026&queue=unscheduled`|Năm2026 và đúng queue1; chọn Xếp lịch của offering1 lần |
|Offering row |`/masters/schedule?year=2026&offeringId=6d911578…&majorId=Q`|Offering được chọn sẵn;0 filter actions. Chọn tuần/ca là thao tác lịch, không mất scope |
|Top Nhập điểm / grade row / Mở bảng điểm cần xử lý |`/masters/exam-lists?year=2026&majorId=Q&groupId=G&offeringId=O&subjectId=S&logicalSubjectId=S`|Đúng năm/group/môn và ô thiếu điểm;0 filter actions, nhập/lưu ngay |
|Top Kiểm tra / warning footer |`/masters/schedule?year=2026&queue=pending-confirmation`|Pending drawer tự mở, đủ4;0 filter actions |
|Warning entity row |`/masters/schedule?year=2026&offeringId=…&queue=pending-confirmation`|Đã click row tên dài: drawer chỉ1 session của offering đó;0 filter actions |
|Healthy4 “Xem chi tiết”|Grouping year; scheduling unscheduled queue; gradebook year; scheduling pending queue|Đã click cả4; empty scope tương ứng. Gradebook healthy chỉ year, không tự mở một lớp cần xử lý vì không có queue |

Các section footer grouping/scheduling dùng cùng href với top aggregate. Đã đi actual destinations qua top/row, đọc href của footer; **không click riêng mọi footer trùng href**. Warning row tên dài và all-warning đã click; hai warning row còn lại kiểm href/ID nhưng không click riêng trước khi resolve. Không tuyên bố từng entity row đã click hết.

### Visual/readability của Dashboard

- Bốn card bằng nhau, số26px, title13px, CTA teal. H1 Dashboard22px lớn hơn text tên trường nhưng vẫn dưới khối brand/ribbon; không thấy đè/chồng global header.
- Empty warning không “cut off”. Với1/3/4 warnings vẫn có border, mô tả, rows và footer rõ. Preview3 tránh page tăng theo warningCount. Tên dài clamp1 dòng, aria-label giữ full name; entity được phân biệt bằng phần tên môn còn thấy và có thể mở full context ở đích.
- Healthy không phủ xanh cả card/panel; chỉ icon/check nhỏ. Work queue và top cards bổ sung nhau: top tóm tắt tổng, dưới nêu entity và CTA. Trùng year/major/discipline ở vài chỗ là thông tin scope, không có count/entity nhân đôi trong dữ liệu.
- Bốn queue đồng thời làm page full khoảng1162px khi ribbon mở; first900px có top cards và phần lớn work/warning. Overview/footer cần cuộn. Không thấy trang cực dài/chaotic. Thu gọn ribbon giúp healthy dashboard vừa900px (D-015).
- Chưa có thứ tự ưu tiên công việc được công bố; amber giúp nhận biết buổi quá giờ, nhưng các card không xếp hạng deadline. Không kết luận business priority sai. Nếu cần trả lời “làm gì trước” theo chính sách phòng đào tạo, cần policy riêng.
- Quick contrast read-back: subtitle `#607486` trên canvas≈4.54:1, empty/healthy copy trên trắng≈4.84:1, CTA `#056a8f` trên trắng≈6.06:1. Không có contrast failure được xác nhận từ các mẫu này; font phụ11.5–12.5px vẫn khá nhỏ. Đây không phải full WCAG audit.

## 5. Findings

### FG-UX-001 — Tạo nhanh làm mất học viên đã chọn và search

- **Area:** Grouping / Quick create. **Type:** UX FRICTION / MISSING WORKFLOW SUPPORT. **Severity:** S3. **Priority:** High.
- **Preconditions:** Assignment có candidate đã chọn, search đang lọc; không có nhóm hoặc toàn bộ open groups đã full.
- **Exact browser steps:** (1) KTHH chọn Đặng Ngọc Mai, tìm Đặng; hoặc QTKD chọn5, tìm Đinh còn3 visible. (2) Bấm “+ Tạo nhanh nhóm mới”. (3) Tạo nhóm trong route riêng, hoặc Hủy rồi browser Back. (4) Đọc search/selection khi trở về.
- **Expected:** tiếp tục công việc với draft đã chọn/tìm, hoặc cảnh báo rõ việc rời context. Cancel của flow tạo nhanh nên có đường trở lại rõ ràng.
- **Actual:** năm/ngành/major được prefill; tạo thành công chọn đúng nhóm mới. Nhưng search thành rỗng và selected0. Cancel chỉ đóng dialog, vẫn ở create route; Back về Assignment cũng không giữ draft. Tái hiện ở lô1,3 và5.
- **Evidence:** G-005 trước, [G-006](../.tmp/qa-focused-20261018/G-006-quick-return-lost-selection-search.png), G-012 trước5/G-013 sau tạo; journal có URL và read-back selected/search.
- **User impact:** phải chọn lại; nhìn danh sách “Chưa chọn học viên” sau đổi màn dễ lo mất các người vừa chọn. Với search chỉ hiện3 nhưng đã chọn5, người dùng còn phải nhớ2 hidden selections.
- **Business impact:** tăng nguy cơ bỏ sót/chọn sai khi phục hồi selection; **chưa chứng minh đã gán nhầm**.
- **Frequency:** mọi return đã thử trong các case trên. **Workaround:** ghi nhớ/search lại và reselect; không cần chọn lại year/major.
- **Approximate effort:**2 pathname transitions Assignment→Create→Assignment;1 thao tác select-all lại nếu toàn candidate pool đúng bằng selection cũ, có thể nhiều click nếu subset. Cancel cần Back riêng.
- **Suggested direction:** in-place shared form; preserve selected IDs/search; cancel không tác động draft; không duplicate backend rules. Chưa implement.

### FG-VIS-002 — Split pane che cột học phí/nhóm hiện tại ở1440×900

- **Area:** Grouping Assignment. **Type:** VISUAL / READABILITY / UX FRICTION. **Severity:** S3. **Priority:** Medium.
- **Preconditions:** default split,10 candidates hoặc10 members.
- **Steps:** (1) Mở Assignment QTKD. (2) Chọn10. (3) Đọc Học phí/Nhóm hiện tại cạnh tên. (4) Cuộn ngang trong pane trái để tìm trạng thái, rồi quay lại định danh.
- **Expected:** thông tin quyết định nằm trong vùng dễ đối chiếu; scroll không làm mất liên hệ người/trạng thái.
- **Actual:** tên/ngày sinh/chuyên ngành chiếm pane trái; Học phí bị cắt và Nhóm hiện tại ngoài vùng thấy. Scrollbar thật và resize có sẵn, nhưng người dùng phải dịch ngang. Pane phải trống tạo nhiều khoảng trắng khi target chưa có người.
- **Evidence:** [G-016](../.tmp/qa-focused-20261018/G-016-ten-selected.png), G-017 sau horizontal wheel, G-018 member list.
- **User impact:** phải cuộn/dò lại hàng; text phụ nhỏ. **Business impact:** tăng rủi ro bỏ sót trạng thái khi rà danh sách, không thay quy tắc học phí.
- **Frequency:** tái hiện với default layout ở viewport đã thử. **Workaround:** resize split, chỉnh cột hoặc search hẹp.
- **Effort:** thêm horizontal scroll đi/về đã thực hiện; không gán số giây tiết kiệm.10 hàng cần dịch dọc nhẹ khi global header mở đầy đủ.
- **Suggested direction:** giảm cột lặp, ưu tiên định danh/trạng thái và sticky định danh; giữ lựa chọn resize cho người cần. Không redesign trong audit.

### FG-UX-003 — Hai chuyên ngành cùng tên không phân biệt được trong selector

- **Area:** Grouping scope. **Type:** UX FRICTION / ERROR PREVENTION. **Severity:** S3. **Priority:** Medium.
- **Preconditions:** danh mục Masters hiện có hai majors tên Khai thác hàng hải, ID khác.
- **Steps:** (1) Mở Chuyên ngành trong Summary. (2) Đọc hai options Khai thác hàng hải. (3) Đối chiếu data-value bằng DOM read-only.
- **Expected:** hiển thị code hoặc mô tả phân biệt khi tên trùng; không cần người dùng nhớ thứ tự option.
- **Actual:** cùng text “Khai thác hàng hải”, IDs `708c1ed3-3599-4d87-afc5-5958facbdcd3` và `6338999f-8ca0-4199-a42b-23fe8dfe53bd`. Không khẳng định Summary trộn count: chưa có hai pending rows cùng tên để thử điều đó.
- **Evidence:** [G-019](../.tmp/qa-focused-20261018/G-019-same-major-display-different-ids.png), DOM read-back option text/id.
- **User impact:** khó chọn đúng phạm vi, có thể phải mở/thử rồi quay lại. **Business impact:** rủi ro xử lý nhầm major; chưa quan sát sai assignment/cross-link.
- **Frequency:** luôn gặp khi mở selector với catalog này. **Workaround:** kiểm group code/context sau chọn, nhờ danh mục phân biệt; không dùng UUID như nhãn chính.
- **Effort:** tối thiểu một lựa chọn thử lại nếu chọn sai; chưa đo một người dùng chọn nhầm nên không gán click trung bình.
- **Suggested direction:** `code — name` hoặc disambiguator ổn định cho các tên trùng ở selector và Summary khi cần; không tự gộp ID.

### FG-UX-004 — Lỗi mất mạng lại hướng người dùng “kiểm tra dữ liệu”

- **Area:** Grouping failure/retry. **Type:** UX FRICTION / ERROR RECOVERY. **Severity:** S3. **Priority:** Medium.
- **Preconditions:**5 selected, target .4 còn10 chỗ, browser offline tạm thời.
- **Steps:** (1) Offline bằng network emulation. (2) Gán5. (3) Đọc toast. (4) Bật online rồi Gán5 lại.
- **Expected:** nói rõ kết nối/request thất bại và có thể thử lại; tránh gợi sửa dữ liệu khi chưa có business validation.
- **Actual:** “Không thể phân học viên vào nhóm. Vui lòng kiểm tra lại dữ liệu.” Selection5 và target giữ đúng, retry online thành công.
- **Evidence:** [G-014](../.tmp/qa-focused-20261018/G-014-failed-assign-preserves-selection.png), journal network failure và G-015 retry.
- **User impact:** dễ đi sửa scope/dữ liệu đúng thay vì thử lại. **Business impact:** chậm thao tác, chưa thấy data corruption hoặc partial assignment.
- **Frequency:**1 controlled offline attempt; không suy ra mọi loại lỗi có cùng message.
- **Workaround:** kiểm kết nối rồi retry, giữ selection hiện có.
- **Effort:**1 click thất bại +1 retry; không phải reselect5. **Suggested direction:** phân biệt network/permission/capacity/validation trong feedback, giữ cơ chế bảo toàn draft đang tốt.

## 6. Accessibility và perceived response

- Summary major row Tab/Enter pass; checkbox Space toggle pass; Search→Tab tới Gán10→Enter gán thật pass. Target combo Arrow/Enter dùng được; manual choice không bị auto-target giành lại.
- Remove dialog giữ focus trong modal, Tab đi close/Hủy/Confirm; cancel và confirm qua Enter pass. Quick-create có action button thật; chưa chạy cả form tạo bằng keyboard thuần.
- Home: native year select→Tab tới CTA đầu; focus outline teal2px thấy rõ (D-013), Enter mở đúng route. Các warning rows có accessible name bao gồm full offering và mô tả; đọc tên dài từ DOM được.
- Header cột có resize slider tab stops. Khi Shift+Tab từ checkbox hàng, focus có đi qua slider độ rộng cột, làm đường keyboard dài hơn. Đây là tradeoff của resize accessibility; chưa kết luận trap hay lỗi chuẩn. Cần thử với staff dùng keyboard nhiều trước khi thay đổi.
- Không thấy action phải refresh lặp mới biết đã lưu. Assign/remove có trạng thái chờ/disabled và toast; capacity/roster cập nhật sau response. Mạng bình thường cảm nhận phản hồi liên tục, không benchmark millis do tool overhead/DEV.
- Throttle cho thấy nhóm có loading label, candidate body chưa có data thay vì giữ hàng scope cũ; selected0 và Gán disabled. Chưa đo loading flicker ở mọi mạng/race. Không chạy screen reader/zoom200%/mobile/full WCAG.

## 7. Quick-create decision — CURRENT vs PROPOSED

| Dimension | CURRENT: route tạo nhóm riêng | PROPOSED: “+ Tạo mới” overlay ngay Assignment |
|---|---|---|
|Scope |Year/discipline/major/CTĐT được prefill; không phải nhớ lại |Giữ nguyên scope, program Masters khóa theo context |
|Selection |Mất1/3/5 selected trong các lượt đã thử |Giữ selected learner IDs trong state Assignment |
|Search/scroll |Search reset; scroll không được bảo toàn qua remount |Giữ search và viewport underlying khi đóng overlay |
|Cognitive load |Đổi màn chức năng, phải tin việc đã chọn không bị mất; thực tế cần chọn lại |Tạo nhóm là bước phụ ngay cạnh target, công việc chính vẫn hiện |
|Route transitions |2 pathname transitions thành công; cancel ở lại create cần Back |0 pathname transitions; chỉ open/close overlay |
|Interaction count |Thao tác tạo vẫn cần form/save, cộng phục hồi selection/search |Vẫn cần form/save; bỏ thao tác phục hồi đã quan sát. Không hứa số giây tiết kiệm |
|Error recovery |Save error có thể ở dialog create, nhưng draft Assignment đã rời trang |Giữ overlay và draft; lỗi field/network rõ, retry ngay |
|Cancel |Đóng dialog, còn ở create page |Đóng overlay, không đổi target/search/selection |
|Created unusable |Source chọn created status open đúng scope; UI case tạo closed chưa chạy |Không blind-select; giải thích và giữ target/draft, cho sửa tiếp |
|Abandonment risk |Cao hơn vì chọn lại, đặc biệt selection có người đang bị search ẩn |Thấp hơn theo thiết kế giữ draft; đây là đánh giá thiết kế, chưa có usability test prototype |
|Reuse feasibility |Form đang inline trong CreateClassGroups, dùng AppDialog và shared naming logic |Có thể extract shared dialog/hook, route hiện tại và Assignment cùng dùng |

**Recommendation: chọn hướng in-place.** Hợp với staff thao tác theo cohort và giải quyết đúng friction đã tái hiện, không cần thay backend/business rules.

Feasibility đã đọc sau manual flow: `createClassGroups.jsx` dùng `AppDialog`, state/validation/load CTĐT và batch POST `/masters/class-groups/batch`; naming helpers ở `createClassGroups.logic`. `assignClassGroups.jsx` hiện chỉ navigate với scope, selected IDs/search là local state. Chưa có shared create-dialog component độc lập sẵn để import nguyên một dòng; cần tách UI/state orchestration có kiểm soát. Không nhúng cả page hoặc copy handleSave thành hai bản.

Acceptance criteria cho task triển khai sau:

1. Nút **+ Tạo mới** cạnh target dùng cùng form/validators/backend như route quản lý nhóm. Scope Masters/year/discipline/major prefill từ Assignment.
2. Success: reload groups, kiểm created group open/đúng scope/còn chỗ rồi select ID mới; giữ selected IDs còn eligible, search và scroll. Nếu tạo nhiều nhóm thì chọn một nhóm hợp lệ theo quy tắc rõ ràng.
3. Cancel không mutate draft; failure giữ overlay với field values và lỗi có nghĩa; draft bên dưới giữ nguyên.
4. Nếu scope/dữ liệu thay đổi trong lúc form mở hoặc group mới không usable, giải thích và revalidate trước Gán, không tự bỏ hidden selection để vừa cap.
5. Giữ route Tạo nhóm học viên cho quản lý đầy đủ. Không sửa quy tắc tuition/Đang học, không duplicate code-generation/capacity rules.

## 8. User effort quan sát được

Quy ước: click/Enter kích hoạt tính một interaction; focus+gõ một field tính một field interaction. Không tính snapshot, đọc DOM, setup, retry do helper hoặc chờ tool. Pathname transition khác query/view transition.

| Journey | Effort thực đã thấy | Context/scroll |
|---|---|---|
|Summary→gán10 khi có nhóm |Row major1 + select-all1 + Gán1 ≈3 interactions |0 pathname transitions,1 chuyển Summary→Assignment; không chọn lại year/major |
|Gán5 subset vào nhóm cap5 |5 checkbox +Gán1 =6 interactions sau scope |Không mở modal từng học viên; cap bằng selection nhìn rõ |
|No group→quick-create→return→gán1 |Major1, chọn1, search1, quick1, cap1, create1, chọn lại1, Gán1 ≈8 |2 pathname transitions; scope giữ, search/selection mất |
|All full→quick-create với5 selected |Từ draft: quick1, cap1, create1; return selected0, cần chọn lại trước Gán |2 pathname transitions; đã đo5, không giả vờ chạy riêng case no-group10 |
|Full target→nhóm còn chỗ |Mở target1 +option1, rồi Gán1 nếu selection đã có |Selection giữ, không phải chọn lại candidates |
|Remove+reassign một người |Remove1 +Confirm1 +candidate checkbox1 +Gán1 =4 |Cancel thử thêm2 interactions riêng; không gộp vào đường chuẩn |
|Remove10 để tái cân nhóm |10 remove +10 confirm =20 trước bước gán lại |Đã trải qua thật; hiện không có bulk remove ở member panel. Chỉ cân nhắc hỗ trợ nếu nghiệp vụ tái cân nhóm thường gặp |
|Home grouping row→gán1 |CTA1 +checkbox1 +Gán1 =3 |0 bộ lọc phải chọn lại |
|Home cảnh báo→xác nhận buổi |CTA1 +Đã diễn ra1 |Drawer tự mở;0 filter actions |

Luồng in-place dự kiến bỏ2 pathname transitions và thao tác phục hồi; **chưa chạy prototype**, không nêu số click/thời gian tiết kiệm như kết quả đo. Với subset đang bị search ẩn, chi phí nhớ/chọn lại quan trọng hơn một click select-all lý tưởng.

## 9. Những phần đang tốt, nên giữ

- Summary phân cấp ngành→major, row compact/clickable, count+arrow scan nhanh; không biến lại thành table dày.
- URL context và auto-target trong Assignment; giữ lựa chọn manual/full inspection, không giành target của user.
- Selection độc lập với visible rows, select-all chỉ tác động tập đang thấy, scope change clear đúng lúc.
- Capacity báo trước, không cắt selection để vừa nhóm; invalid/full khóa Gán và nêu alternative.
- Success feedback nêu số HV/tên nhóm; lỗi gán giữ selection để retry.
- Dashboard top signal + work-item detail, màu ocean/teal và amber có tiết chế; warning preview3 + link xem đủ hoạt động tốt. Không redesign panel chỉ vì empty state có khoảng trắng.
- Deep links theo entity và gradebook rất tốt; giữ0 filter actions đã đạt được. Back/Home/refresh làm mới đúng dữ liệu.

## 10. Trạng thái DB cuối và giới hạn còn lại

Snapshot [db-final.json](../.tmp/qa-focused-20261018/db-final.json), read-only sau thao tác:

| Entity | Baseline→Final | Thay đổi |
|---|---:|---|
|admission_records/evaluations|211/21→211/21|Không audit/chỉnh admission |
|class_groups|4→7|Thêm KTHH2 .1 cap1; KTMT .1 cap3; QTKD .4 cap10 |
|class_group_members|11→15|Thêm MT3+KTHH1; QTKD .1=1,.2=10 đã phục hồi sau remove/reassign |
|course_offerings|3→6|Thêm3 QA FOCUS, đều active để test warnings |
|teaching_sessions|2→6|Thêm3 QA FOCUS +1 lịch cho KTQL .2;5 held/1 planned cuối |
|course_exam_gradebooks|1→1|KTQT revision6→10, blank/re-enter Hà hai lượt;10 rows, pending0 |

QTKD .2 cap cuối10, .3 closed0/10, .4 open0/10. Không có duplicate admission_record_id memberships trong query cuối. Không reset/cleanup lifecycle để có thể review. Bốn time fixtures giữ ngày quá khứ và đã được xác nhận held qua UI. Session mới KTQL .2 sáng19/10 vẫn planned. Home cuối2026: **0/0/0/0**, active5/teaching4/unscheduled0/completed1.

Chưa kiểm thử đầy đủ:

- Account operational/read-only khác và quyền Dashboard/Grouping của account đó.
- Hai pending majors cùng ngành, hai Summary rows cùng display name, count rất lớn/50+ hàng. Selector duplicate-name đã quan sát, không suy ra count bị trộn.
- Hai phiên gán đồng thời, stale-capacity conflict và double-click in-flight có kiểm soát; không lấy an toàn UI thường làm bằng chứng race đã pass.
- Quick-create tạo closed/unusable hoặc save failure ngay tại form; proposed overlay chưa tồn tại nên chỉ có acceptance criteria, không “pass” behavior đề xuất.
- Toàn keyboard form tạo nhóm, screen reader, zoom200%, mobile, browser khác.
- Footer trùng href và hai warning entity CTAs chưa click riêng như ghi rõ ở bảng deep-link; long warning description tùy biến không có field UI, chỉ thử entity name dài và mô tả warning thực.

## 11. Ưu tiên đề nghị

1. **High UX:** tách shared create dialog và triển khai in-place + Tạo mới; giữ draft/search. Đây là thay đổi sau audit, cần regression selection/capacity/cancel/failure.
2. **Medium:** phân biệt code cho major tên trùng và giảm horizontal scroll tại Assignment; giữ resize/sticky/accessibility cần thiết.
3. **Medium:** phân loại feedback network cho Gán; giữ bảo toàn selection và retry hiện có.
4. **Trước kết luận release rộng:** bổ sung persona và concurrent/stale tests. Không có S0/S1 được xác nhận trong lượt này; không đánh đồng với hệ thống không còn lỗi.

Không cần thay toàn bộ Summary hoặc Dashboard. State matrix đã chứng minh các thành phần hiện có hoạt động ở healthy, một/nhiều warning và nhiều queue cùng lúc.

## 12. Evidence index

Grouping: G-001 baseline multi; G-002 empty year; G-003 focus; G-004 no group; G-005/006 quick draft→return; G-007 one major; G-008 all grouped; G-009 selection after removals; G-010 over cap; G-011 equals cap; G-012 all full; G-013 quick5 reset; G-014/015 failure/retry; G-016/017 horizontal scroll; G-018 assigned10; G-019 duplicate labels; G-020 empty search with hidden selection; G-021 loading guard.

Dashboard: D-001 baseline; D-002 healthy2025; D-003 pending1; D-004 all4 queues/one warning; D-005 warnings3/long copy; D-006 warnings4/preview3; D-007 exact warning destination; D-008 all4 drawer; D-009 resolve1+Back; D-010 resolve all; D-011 schedule+Back; D-012 healthy2026; D-013 keyboard focus; D-014 incomplete again; D-015 collapsed ribbon; D-016 final healthy.

Các PNG và journal nằm trong thư mục evidence đã link ở đầu. Không có source fix, commit, push hoặc reset/revert trong lượt này.
