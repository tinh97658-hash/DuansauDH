# QA thủ công end-to-end — Sau đại học, 18/10/2026

**Kết quả cập nhật sau follow-up: đã thực hiện hành trình đến lưu điểm và đối chiếu kết quả cho lớp KTQT, roster10 học viên.** Hồ sơ → xét tuyển → học phí → phân nhóm → tạo lớp học phần → xếp lịch → xác nhận đã dạy → hoàn thành lớp → điểm → tổng hợp điểm đều đã thao tác qua UI. Có **một ngoại lệ chuẩn bị fixture được người dùng chấp thuận rõ ràng**: chuyển ngày của đúng một session DEV từ19/10 sang17/10; không đổi trạng thái/điểm trực tiếp. Đây là E2E có fixture thời gian, không phải toàn bộ hành trình thuần UI trong cùng ngày. Không sửa implementation, không commit/push, không reset/reseed. Coverage role khác, retake và phép thử refresh chưa lưu vẫn có giới hạn bên dưới.

Có **3 lỗi chức năng đã xác nhận: S2 × 1, S3 × 2; chưa xác nhận lỗi S0/S1**. Có thêm **2 rủi ro nghiệp vụ/dữ liệu, 5 finding UX/visual và 1 quan sát accessibility**; không gộp các nhóm này vào số lỗi chức năng.

## Môi trường và baseline

- Working branch `nguyentrang9`; local working tree có thay đổi từ các task trước, được giữ nguyên. Snapshot status: `.tmp/qa-source-status-before.txt`.
- Frontend `http://localhost:3100`, backend `http://localhost:3001`, đều phản hồi 200 trước kiểm thử.
- Preview read-only bằng công cụ DEV hiện có xác nhận `development`, `127.0.0.1:55432/pgsms`. Docker container `/duansaudh-db-1`, `postgres:16-alpine`, publish loopback 55432→5432. Đã đọc tài liệu reset/reseed; **không reset/reseed**.
- DB đầu lượt: 210 admission records, 15 admission evaluations / 24 history rows, 2 ClassGroup / 1 membership, 0 CourseOffering / teaching session / gradebook. Đây là dataset đã được thao tác trước audit, không phải baseline hoàn toàn mới. Report: `.tmp/qa-baseline-20261018.json`.
- Đăng nhập qua form thật bằng tài khoản DEV đã cấu hình; không ghi password/cookie vào báo cáo.
- UI quản lý người dùng có một tài khoản admin, đang phụ trách xếp lịch; chưa có persona khác để đăng nhập. Giới hạn coverage sẽ ghi rõ.

## Phương pháp

Edge headless 1440×900, DOM/screenshot của ứng dụng thật và thao tác pointer/keyboard CDP. Không mock/intercept response và không gọi write API để hoàn tất nghiệp vụ. Helper chỉ điều khiển browser, ghi thao tác/network metadata và chụp ảnh, không chạy kịch bản tự quyết định toàn bộ flow. Từng bước được chọn sau khi đọc trạng thái UI.

Evidence và action journal: `.tmp/qa-20261018/`. Click vào menu/form, nhập/chọn, save/cancel/refresh/Back/Forward được ghi lại; không tính các snapshot/eval read-only là thao tác của người dùng. Sai sót do helper/đổi tab extension không được ghi thành lỗi ứng dụng. Ngoại lệ fixture có before/after tại `authorized-past-fixture.json`, được tách khỏi thao tác UI; không dùng fixture để tự đặt held/completed/grade.

## Finding đã xác nhận

### QA-ADM-001 — Lưu được hồ sơ khi ô bắt buộc “Tên *” rỗng

- Area: Admissions.
- Type: FUNCTIONAL BUG / DATA INTEGRITY.
- Severity: **S2 HIGH**. Frequency: tái hiện với một hồ sơ; ảnh hưởng: từng hồ sơ, có thể lặp nhiều lần.
- Preconditions: admin mở Nhập hồ sơ tuyển sinh, năm 2026; hồ sơ Hồ Phương Thảo, email `hoso.2026.067@example.invalid`.
- Steps: (1) Tìm hồ sơ. (2) Sửa hồ sơ. (3) Xóa nội dung ô “Tên *”. (4) Bấm “Chấp nhận (Enter)”.
- Expected: không lưu; báo lỗi bắt buộc cạnh ô Tên, giữ người dùng trong form.
- Actual: toast “Cập nhật hồ sơ thành công”, form đóng; danh sách có Họ đệm “Hồ Phương” và Tên rỗng.
- Evidence: `ADM-003-required-name-validation.png`, `QA-ADM-001-required-given-name-saved-empty.png` trong thư mục evidence.
- Business impact: hồ sơ định danh không đầy đủ có thể đi tiếp sang xét tuyển/danh sách lớp.
- User impact: người dùng tin lưu thành công dù dữ liệu bắt buộc bị thiếu.
- Workaround: mở lại form, điền Tên đầy đủ và lưu; dữ liệu mẫu được phục hồi bằng UI để tiếp tục kiểm thử.
- Suggested direction: xác thực bắt buộc nhất quán ở UI và backend; chỉ đề xuất, chưa triển khai.

### QA-ADM-002 — Email sai định dạng vẫn được lưu

- Area: Admissions. Type: FUNCTIONAL BUG / DATA INTEGRITY. Severity: **S3 MEDIUM**. Frequency: tái hiện một hồ sơ; impact: từng hồ sơ.
- Preconditions: cùng hồ sơ Hồ Phương Thảo năm 2026.
- Steps: (1) Sửa hồ sơ. (2) Nhập `not-an-email` vào Email. (3) Chấp nhận.
- Expected: chặn định dạng email sai trước khi lưu, chỉ rõ trường cần sửa.
- Actual: báo cập nhật thành công, danh sách hiển thị `not-an-email`.
- Evidence: `QA-ADM-002-email-validation.png` và browser journal (write request qua UI).
- Business impact: mất khả năng sử dụng thông tin liên hệ/email trong quy trình sau; chưa kết luận gửi thư vì chưa thử module gửi thư.
- User impact: không biết nhập sai do phản hồi thành công.
- Workaround: mở lại form và sửa; đã phục hồi `hoso.2026.067@example.invalid` qua UI. Đặt code `QA-2026-01` để theo dõi cohort; tên đã phục hồi. Thử sửa số điện thoại rồi Hủy giữ nguyên `0000000187` (pass).
- Suggested direction: validate email nhất quán UI/API, không bắt nhập nếu trường được phép tùy chọn; chưa sửa.

### QA-SCHED-003 — Lịch tuần cho xếp buổi chiều đã kết thúc, form lại từ chối lưu

- Area: Scheduling. Type: FUNCTIONAL BUG / UX feedback inconsistency. Severity: **S3 MEDIUM**.
- Preconditions: giờ thực tế 17:46 ngày 18/10/2026, Asia/Bangkok; có lớp active chưa có lịch, admin được phân công xếp lịch.
- Steps: (1) Mở Xếp lịch, tuần 12–18/10. (2) Chọn Xếp lịch cho `QA-2026 KTQL Nhóm 2`. (3) Bấm ô Chiều 18/10 đang có affordance “+ Xếp buổi”. (4) Chọn Đỗ Hải Đăng và phòng BTDEMO26P1 còn trống. (5) Lưu lịch.
- Expected: lịch tuần và form thống nhất điều kiện ca đã qua; không mời nhập một ca chắc chắn không thể lưu.
- Actual: form mở và cho chọn đủ thông tin, sau đó báo **“Không thể xếp lịch vào buổi học đã kết thúc.”** Không tạo session; không phải lỗi mất dữ liệu đã lưu.
- Evidence: [QA-SCHED-003-afternoon-cutoff-mismatch.png](../.tmp/qa-20261018/QA-SCHED-003-afternoon-cutoff-mismatch.png), journal khoảng 10:46 UTC. Tái hiện hai lần trong lượt audit.
- Diagnosis, sau khi quan sát UI: `Schedule.jsx` tính slot chiều đến `23:59`; `SessionEditor.jsx` dùng giờ ca chiều `13:00–17:00`. Thông báo từ kiểm tra trong form; không khẳng định backend gây ra lỗi này.
- Business impact: không lưu sai lịch, nhưng tốn thao tác điều phối vào ca không còn hợp lệ.
- User impact: khoảng 5–6 thao tác vô ích, phải hủy và chọn ngày khác.
- Frequency: tái hiện 2/2 ở điều kiện trên; dự kiến ảnh hưởng khung giờ sau 17:00 trước hết ngày, cần regression theo timezone.
- Workaround: chọn ngày/ca tương lai. Suggested direction: dùng cùng định nghĩa kết thúc ca tại calendar/editor/API; chưa sửa.

## Rủi ro cần quyết định nghiệp vụ

### RISK-TUI-001 — Chưa nộp học phí vẫn được phân nhóm và chuyển “Đang học”

- Area: Post-admission / Grouping. Type: **BUSINESS LOGIC RISK**, không kết luận vi phạm quy tắc khi chưa được xác nhận. Severity: **S3**, impact nhiều học viên.
- Preconditions: 10 học viên QTKD chưa có nhóm, gồm 6 đã xác nhận học phí và 4 chưa xác nhận.
- Steps: (1) Xem trạng thái học phí ở Assignment. (2) Chọn cả 10. (3) Gán vào QTKD 2026.1.2. (4) Mở Hồ sơ trúng tuyển, tìm `hoso.2026.049`.
- Expected: nếu học phí là điều kiện bắt đầu học thì cần chặn/cảnh báo; nếu không phải thì phải giải thích rõ hai trạng thái độc lập. Đây là câu hỏi cần chủ nghiệp vụ trả lời.
- Actual: gán cả 10 thành công; Đinh Thanh Tùng thuộc QTKD 2026.1.2, checkbox học phí chưa chọn, trạng thái **Đang học**. Cả người đã/chưa nộp xuất hiện ở roster học phần.
- Evidence: [RISK-001-unpaid-grouped-studying.png](../.tmp/qa-20261018/RISK-001-unpaid-grouped-studying.png), GROUP-004; `db-after.json` xác nhận membership/study_status.
- Business impact: có thể hiểu nhầm đã đủ điều kiện tài chính; chưa chứng minh có sai thu/chi hay thu trùng.
- User impact: phải tự nhớ ý nghĩa “Đang học” không đồng nghĩa đã đóng học phí.
- Frequency: 4 học viên chưa nộp trong lô 10 đều được gán; tác động theo cohort.
- Workaround: kiểm tra cột học phí riêng trước khi chọn. Suggested direction: thống nhất và công bố quy tắc học phí/studyStatus trước khi thay đổi logic. **Không sửa trong audit.**

### RISK-ADM-002 — Giá trị mẫu ngày sinh/điểm TB trở thành dữ liệu thật khi thêm hồ sơ

- Area: Admissions. Type: **BUSINESS LOGIC RISK / DATA QUALITY**. Severity: **S2**, không tính vào 3 lỗi chức năng đã xác nhận.
- Preconditions: năm 2024, bộ lọc Tiến sĩ; bấm Thêm hồ sơ mới.
- Steps: (1) Quan sát form mặc định. (2) Chỉ nhập code `QA-2024-TEMP`, họ/tên và email audit. (3) Lưu. (4) Đổi Trình độ về tất cả để tìm hồ sơ. (5) Mở sửa lại, đọc Ngày sinh/Điểm TB ĐH.
- Expected: dữ liệu cá nhân/thành tích chưa được cung cấp cần trống hoặc được xác nhận chủ động; default tổ chức nên phân biệt với dữ liệu cá nhân. Cần chủ nghiệp vụ xác nhận có chủ ý dùng giá trị mẫu hay không.
- Actual: **2000-01-01** và **3.20** đã điền sẵn và được lưu, giữ nguyên khi mở lại. Form mặc định Thạc sĩ/CNTT dù danh sách đang lọc Tiến sĩ; lưu xong hồ sơ mới bị ẩn bởi chính bộ lọc đó.
- Evidence: ADM-007-created-temporary-record.png; [UX-ADM-006-prefilled-personal-data.png](../.tmp/qa-20261018/UX-ADM-006-prefilled-personal-data.png). Read-back từ form edit: dob `2000-01-01`, gpa `3.20`.
- Business impact: ngày sinh/điểm đầu vào không được người nhập xác thực có thể đi vào nghiệp vụ sau.
- User impact: phải rà soát và thay các giá trị có vẻ hợp lệ; sau lưu còn phải đổi bộ lọc mới thấy hồ sơ.
- Frequency: quan sát một lượt thêm và một lượt mở lại; không khẳng định mọi cấu hình đều giống nhau.
- Workaround: kiểm tra mọi default và trình độ/chuyên ngành trước lưu. Hồ sơ thử đã được xóa qua UI, tìm lại cùng năm không còn kết quả; tổng DB trở lại 210.
- Suggested direction: bỏ dữ liệu cá nhân mẫu khỏi initial values; tôn trọng phạm vi đang làm việc hoặc báo rõ form tạo đang dùng phạm vi khác. Chưa triển khai.

## UX friction và visual/readability

Các effort dưới đây tính thao tác thực ở đường đi đã thử; không tính snapshot/chụp ảnh, không dùng thời gian chạy tool làm thời gian thao tác nhân viên.

### UX-NAV-001 — Mất chuyên ngành/lớp khi refresh hoặc chuyển module liên quan

- Area / Workflow: Admissions → scheduling → grades → report. Type: UX FRICTION / MISSING WORKFLOW SUPPORT. Severity **S3**. Priority **High**.
- Preconditions: đã chọn năm/chuyên ngành/lớp cụ thể và đang làm QTKD 2026.
- Steps / observed journey: (1) Ở điểm thi chọn QTKD, KTQT Nhóm 2, tìm QA-2026-01. (2) Refresh. (3) Mở Tổng hợp điểm của lớp. (4) Mở Thống kê tiến độ. Đối chiếu tương tự refresh màn hồ sơ và lịch tuần.
- Expected: giữ context đang làm hoặc có chuyển tiếp mang đủ context với người dùng biết phạm vi đích.
- Actual: refresh điểm thi về CNTT, không có lớp học phần và mất search; report mở CNTT dù vừa xem QTKD. Lịch tuần sau refresh về tuần hiện tại dù buổi mới tạo nằm tuần sau; offeringId vẫn giữ. Màn Phân nhóm giữ context qua URL/Back/Forward tốt hơn.
- Bổ sung sau follow-up: đường **Home → Nhập điểm** mang đủ year/major/group/offering/subject trên URL; refresh theo deep link này giữ đúng lớp. Finding áp dụng đường ribbon không có context và report/lịch đã mô tả, không áp dụng mọi đường vào gradebook.
- Approximate effort: để mở lại lớp điểm QTKD từ default cần 4 click dropdown/option (chuyên ngành và lớp), thêm một lần nhập search; xem lại tuần vừa xếp cần thêm click Tuần sau. Chuyển report cần chọn lại ngành/lớp. Đã lặp thật trong audit; không nhân số lần giả định.
- Business impact: dễ thao tác nhầm phạm vi sau refresh; không chứng minh đã lưu nhầm trong lượt này.
- User impact / friction: phải nhớ tên/code lớp ở màn trước; mất nhịp khi đang xử lý cohort.
- Frequency: lặp được khi refresh các màn nêu trên. Evidence: journal `refresh` và các URL, GRADES-001, RESULT-001; không có context trên URL điểm thi.
- Workaround: chọn lại filter, ghi nhớ tên lớp. Suggested improvement: persist scope nhất quán, dùng deep link mang năm/chuyên ngành/offering, giữ tuần/date; chưa sửa.

### UX-VIS-002 — Cột nghiệp vụ quan trọng nằm ngoài chiều rộng đang thấy

- Area / Workflow: Assignment và Grades/Results. Type: VISUAL / READABILITY / UX FRICTION. Severity **S3**. Priority **Medium**.
- Preconditions: viewport desktop 1440×900, nhóm 10 HV.
- Steps: (1) Mở Assignment chia hai pane. (2) Đọc cột học phí/nhóm hiện tại bên trái. (3) Mở bảng điểm 10 HV và đối chiếu cột kết quả phía phải.
- Expected: đọc được định danh cùng trạng thái cần quyết định, giữ liên hệ hàng khi phải cuộn.
- Actual: pane trái Assignment cắt cột Học phí/Nhóm hiện tại; bảng điểm rộng **1880px**, lớn hơn vùng hiển thị trong viewport 1440px. Ở đầu bảng điểm chỉ khoảng 6 hàng đầu thấy trong 900px chiều cao; các cột thang chữ/lần thi/kết quả cần cuộn ngang. Report toàn chương trình rộng hơn nữa theo số môn; đây là tradeoff cần tối ưu, không phải lỗi mất dữ liệu.
- Evidence: GROUP-002-full-target.png, GROUP-004-ten-assigned.png, GRADES-001-ten-roster-locked.png, RESULT-001-roster-no-grades.png. DOM xác nhận header bảng điểm `position: sticky` — điểm tốt, không báo thiếu sticky header.
- Approximate effort: cần đọc hai pane và cuộn ngang; lớp 10 người cần cuộn dọc để xem đủ bảng điểm. Chưa đo số scroll bằng wheel nên không gán một con số giả.
- Business impact: tăng nguy cơ bỏ sót trạng thái học phí/kết quả khi rà nhiều hàng.
- User impact: cần di chuyển mắt và cuộn để ghép tên với giá trị; density cao ở pane hẹp.
- Frequency: luôn thấy ở kích thước và dataset đã thử. Workaround: resize split pane; dùng search thu hẹp danh sách, cuộn ngang bảng.
- Suggested improvement: ưu tiên cột quyết định, gộp thông tin định danh, sticky định danh hàng và cho mode bảng gọn; chưa redesign.

### UX-KEY-003 — Tab trong nhập điểm xét tuyển đi qua link tên trước ô điểm kế tiếp

- Area / Workflow: Admission scores, nhập điểm trực tiếp theo lô. Type: UX FRICTION / keyboard efficiency. Severity **S3**. Priority **Medium**.
- Preconditions: bảng hồ sơ chưa duyệt QTKD, nhiều dòng có ô điểm.
- Steps: (1) Focus ô điểm dòng đầu. (2) Nhập 20. (3) Bấm Tab và quan sát active element.
- Expected: có đường nhập liên tục rõ ràng qua các ô điểm, vẫn truy cập được link tên bằng bàn phím.
- Actual: Tab chuyển đến link họ tên dòng kế tiếp thay vì ô điểm. Không kết luận keyboard hoàn toàn không dùng được; có thể Tab tiếp. Lượt 5 người đã dùng mouse để chọn từng ô.
- Approximate effort: 5 lần chọn ô + 5 giá trị + 1 Lưu + 1 Xét tuyển + 1 Đồng ý duyệt, ngoài filter. Bulk save/approval có thật; không báo thiếu bulk.
- Evidence: journal hành động key/eval ở batch điểm; ADM-006-batch-five-preview.png.
- Business impact: không sai kết quả điểm đã lưu; thao tác lặp tốn công khi nhập trực tiếp.
- User impact: khó duy trì nhịp kiểu bảng tính.
- Frequency: quan sát một chuyển focus trên bảng đang dùng; chưa kiểm tra toàn bộ keyboard matrix.
- Workaround: Tab thêm hoặc dùng mouse; Excel template/import có sẵn nhưng chưa kiểm thử import file thực.
- Suggested improvement: hỗ trợ điều hướng vùng nhập điểm bằng Enter/arrow hoặc tab order rõ ràng và hướng dẫn; không suy diễn hiệu quả của gradebook đang khóa.

### UX-PROG-004 — Nút hoàn thành bị khóa nhưng không chỉ rõ điều kiện còn thiếu

- Area / Workflow: Offering detail / teaching progress. Type: UX FRICTION / feedback. Severity **S3**. Priority **Medium**.
- Preconditions: lớp active có 0 buổi held, thử cả lớp chưa có session và lớp có 1 session tương lai.
- Steps: (1) Mở chi tiết lớp ở Xếp lịch. (2) Xem Lịch học. (3) Xem nút “Xác nhận hoàn thành giảng dạy”.
- Expected: biết vì sao nút khóa và thao tác nào mở khóa, bằng nội dung cạnh nút.
- Actual: nút disabled; không có explanation riêng tại nút. Drawer gắn nhãn **ĐANG DẠY** kể cả lớp chưa có buổi, trong khi matrix/Home thể hiện chưa tổ chức/0 đang giảng dạy theo tiến độ. Không khẳng định dữ liệu trạng thái sai vì có thể đây là nhãn chung cho active.
- Evidence: journal kiểm tra `disabled=true` khi mở chi tiết ở schedule; PROGRESS-003-future-completion-guard.png bổ sung nội dung lịch tương lai trong drawer mở từ matrix.
- Approximate effort: phải mở detail, đọc nhiều tab/counter rồi tự suy luận; không đo một đường hoàn thành vì chưa đủ precondition.
- Business impact: nhân viên có thể tưởng bị thiếu quyền hoặc lỗi, chậm chốt lớp.
- User impact: không rõ next action/điều kiện thời gian.
- Frequency: cả hai precondition đã xem. Workaround: xem held count và session status; cần tối thiểu một buổi đã diễn ra theo điều kiện hiện hành.
- Suggested improvement: hiển thị điều kiện còn thiếu/cách đi đến xác nhận buổi, dùng từ active/đang dạy nhất quán; không thay business transition.

### UX-GRADE-005 — Lý do khóa điểm chỉ là toast, mất sau khi chuyển tab

- Area / Workflow: Gradebook, lớp chưa hoàn thành. Type: UX FRICTION / error recovery. Severity **S3**. Priority **High**.
- Steps: (1) Mở KTQT Nhóm 2. (2) Đọc toast yêu cầu hoàn thành giảng dạy. (3) Bấm DS thi rồi Cả bảng điểm. (4) Quan sát trạng thái nhập.
- Expected: lý do khóa luôn gắn với vùng điểm, có đường đi về đúng lớp để hoàn thành precondition.
- Actual: ô điểm và Cập nhật cả bảng vẫn disabled, thông báo “Vui lòng xác nhận hoàn thành…” không còn trong body. Tab DS thi lại báo “Hãy nhập đủ điểm thành phần…” dù hiện không thể nhập. Không có CTA sang đúng offering trong lý do khóa đã quan sát.
- Evidence: [GRADES-001-ten-roster-locked.png](../.tmp/qa-20261018/GRADES-001-ten-roster-locked.png), [UX-GRADE-005-locked-without-persistent-reason.png](../.tmp/qa-20261018/UX-GRADE-005-locked-without-persistent-reason.png); DOM `notice=false`, điểm QA-2026-01 `disabled=true` sau chuyển tab.
- Approximate effort: thêm 2 click tab là mất lý do; muốn xử lý phải quay lại scheduling và tìm lớp.
- Business impact: không vượt được guard trái phép; có nguy cơ bỏ dở nhập điểm vì không hiểu khóa.
- User impact: hai hướng dẫn không giúp hoàn tất việc đang làm; memory load cao khi toast biến mất.
- Frequency: tái hiện trong lớp 10 HV đang active. Workaround: nhớ yêu cầu trong toast, tự tìm offering ở Xếp lịch.
- Suggested improvement: banner bền vững mô tả điều kiện và deep link đến đúng lớp; chỉ hiện hướng dẫn nhập đủ điểm khi đã được nhập. Chưa sửa.

## Accessibility và giới hạn đánh giá

### A11Y-GRADE-001 — Accessible label ô điểm thiếu định danh khi học viên chưa có mã

- Area: Grades. Type: ACCESSIBILITY observation. Severity **S3**. Priority Medium.
- Preconditions: roster 10 người, 9 người chưa có code, 1 người có QA-2026-01.
- Steps: (1) Mở KTQT Nhóm 2. (2) Đọc DOM semantic của các ô Điểm kiểm tra và hàng tương ứng; đối chiếu tên hiển thị.
- Expected: label phân biệt được học viên, dùng tên hoặc ID fallback khi code trống.
- Actual: 9 ô có cùng aria-label **`Điểm kiểm tra `**; ô có code là `Điểm kiểm tra QA-2026-01`. Các component khác như BTL/thi/kết quả cũng dùng label không đủ định danh khi code trống.
- Evidence: DOM read-back trong lượt 10:50 UTC và GRADES-001 cho roster; tên Hoàng Đức Anh/Lý Anh Dũng/Đỗ Quỳnh Hoa… có trên hàng nhưng không được dùng trong label.
- Business impact: rủi ro nhầm ô khi dựa vào tên control; **chưa chứng minh nhập nhầm**. Sau mở khóa và nhập thật, label thiếu mã vẫn giống quan sát ban đầu; chưa chạy screen reader.
- User impact: tìm control bằng accessible name không phân biệt 9 hàng. Frequency: 9/10 hàng trong roster đã kiểm tra.
- Workaround: dò ngữ cảnh bảng/hàng hiển thị. Suggested direction: tên đầy đủ + định danh ổn định làm fallback; kiểm thử screen reader khi mở khóa nhập điểm.

Đã quan sát tên aria của các action Gán/Bỏ học viên, combobox filter và tooltip/nút ở các màn chính. Header bảng điểm sticky. Chưa thực hiện screen reader, contrast đo theo chuẩn, zoom 200%, mobile, keyboard đầy đủ của mọi dialog; **không tuyên bố WCAG pass/fail toàn hệ thống**. Các lỗi selector/hit-test của helper và control ẩn ngày/ca trong SessionEditor không được tính là lỗi người dùng.

## Coverage thực tế theo lifecycle

| Phase | Đã thực hiện qua browser | Kết quả / giới hạn |
|---|---|---|
| A — Hồ sơ | Search tên/code/email; năm 2024/2025/2026; lọc trình độ Thạc sĩ/Tiến sĩ; majors; page 2; edit required/email; save/cancel; thêm/xóa một hồ sơ tạm | List 2024 = 50, 2025 = 70. 2026 applications 81 đầu lượt → 75 sau duyệt thêm 6. Page 2 hiển thị 16–30/75. Tạo/xóa có confirmation và cancel hoạt động. Hai lỗi validation; default data risk. |
| B — Xét tuyển | 1 hồ sơ rồi 5 hồ sơ; điểm 21/20; bulk save; modal preview/select; hủy/reopen/duyệt; refresh và qua danh sách trúng tuyển | 21 bị chặn giới hạn 0–20, giữ điểm chưa lưu và khóa xét tuyển. 20 lưu được. Duyệt +1 rồi +5; tổng duyệt 9→10→15, không thấy bản sao. 5 evaluation mới + single tạo tổng evaluations 15→21. |
| C — Học phí | Quan sát unpaid; checkbox xác nhận riêng QA-2026-01; chọn đúng 5 và xác nhận hàng loạt; refresh | 6 checkbox paid giữ sau refresh. Trạng thái trúng tuyển không tự đổi thành Đang học ngay khi xác nhận học phí; chuyển sau grouping. Không thử bỏ xác nhận học phí đã lưu, không suy diễn nghiệp vụ thu tiền thực. |
| D — Grouping | Summary 14 HV/3 majors; năm 2025 empty; QTKD 10; Back/Forward/refresh; target full; quick-create; multiple targets; select all 10; search khi đã chọn; Gán; remove cancel/confirm; gán lại 1 | Tạo 2 nhóm cap10, tự chọn nhóm .2, giữ URL context. Full target .1 hiện vượt10, Gán disabled. Search còn 1 dòng nhưng hiển thị rõ đã chọn10, selection được giữ. Gán10 thành công. Bỏ QA rồi gán lại thành công; refresh giữ membership. |
| E — CourseOffering | Chọn major/year/subject; chọn ClassGroup và xem roster10; thiếu group nút Tiếp tục disabled; review/create; create another; sang scheduling | Tạo 3 offering, phân biệt rõ ClassGroup quản lý HV và CourseOffering dạy một môn. Sau tạo KTQL Nhóm2, group .2 không còn ở danh sách tạo KTQL tiếp → có prevention trên đường UI này. Chưa thử race/duplicate API. |
| F — Scheduling | Tuần/date focus; chọn offering; lecturer/room; tạo 2 session tồn tại ở 2 ngày; thử đồng thời cùng ca; edit phòng/note; cancel delete, confirm delete rồi tạo lại; refresh | Room P1 bận disabled, lecturer Đỗ Hải Đăng “Đang bận” disabled. Cùng ClassGroup ca đã bận không có add affordance; khác group vẫn mở được. Lưu đồng thời hai lớp khác group/phòng/GV cùng sáng 19/10 thành công trước khi xóa một lịch thử. Có lỗi cutoff chiều. |
| G — Tiến độ | Sau fixture có1 pending; bấm Đã diễn ra; complete cancel/reopen/confirm; held1, lớp completed | **Đã chạy UI nhánh held→completed**. Pending1→0. Không thử nhánh not_held/reopen lớp. |
| H — Điểm | Nhập từng phần1, hoàn tất1; lưu lô5 rồi4 còn lại; biên0/10, 5.5, điểm thiếu, thử11/-1; Tab; refresh sau save; xóa/re-enter điểm thi | **Đã lưu10 kết quả**, 9 đạt/1 không đủ tư cách; weighted/letter/grade4 đọc lại đúng. Blank có thể lưu pending. Phép refresh khi chưa lưu bị kẹt Edge/CDP, không kết luận chống mất việc đã pass. |
| I — Kết quả | Đối chiếu đủ10 điểm KTQT ở Tổng hợp điểm của lớp, refresh và chọn lại group | **Đã đối chiếu** 0/10/5.5/7.3/6/7/8.5/7/7/7 đúng từng người và môn; không có điểm môn khác bị điền chéo. Chỉ một attempt; retake chưa thử. |
| Dashboard | Baseline8→acceptance14→grouping4; pending1→0; complete tạo grade queue1; đủ10 kết quả queue0; xóa điểm1→queue1; nhập lại→queue0 | Các checkpoint đã thấy khớp. Home Nhập điểm deep link đúng lớp và giữ context khi refresh; scheduling queue vẫn đúng1 lớp chưa có lịch. |

Không ghi “pass” cho các phần chỉ đọc UI hoặc thiếu precondition. Không chạy test suite/build để thay thế audit; **không chạy automated regression trong lượt này**.

## Persona / permissions

- Đã thực sự đăng nhập admin DEV qua form; admin là người đang được phân công scheduling.
- QL Người dùng có đúng một account được liệt kê. Không có nhân viên thứ hai để login và không thấy action tạo user trong UI đã kiểm tra.
- Menu/admin action đang dùng hiển thị và thực thi được. Không dùng quyền admin để kết luận role specialist/read-only đã pass.
- **Chưa kiểm thử** menu ẩn/disabled, deep link và dashboard theo một account không được phân công, manager khác hoặc operational specialist; cần account/fixture hợp lệ. Không tạo role giả hoặc chỉnh quyền qua DB.

## Mẫu dữ liệu đã dùng

Cohort chính QTKD 2026 (nam/nữ, nhiều tuổi, một người có code, nhiều người chưa code). Sau single+batch approval có 10 người chưa phân nhóm:

| Học viên | Suffix email seed | Học phí đã xác nhận trong audit |
|---|---|---|
| Hoàng Đức Anh | 2026.047 | Có |
| Hồ Ngọc Mai | 2026.089 | Có |
| Hồ Phương Thảo — QA-2026-01 | 2026.067 | Có |
| Hồ Thanh Hà | 2026.083 | Có |
| Hồ Trung Kiên | 2026.031 | Có |
| Lý Anh Dũng | 2026.066 | Có |
| Đinh Thanh Tùng | 2026.049 | Không |
| Đinh Thu Trang | 2026.042 | Không |
| Đinh Thành Đạt | 2026.082 | Không |
| Đỗ Quỳnh Hoa | 2026.085 | Không |

Đinh Minh Tuấn đã ở group .1 từ trước, được dùng cho offering roster1/conflict khác group. Kĩ thuật môi trường có 3 HV và Khai thác hàng hải có1 trong Summary/Home, đã xem scope tổng quan nhưng chưa đưa hai majors này qua toàn lifecycle. Năm2024/2025 chỉ thử danh sách/filter và hồ sơ tạm năm2024; không phải lifecycle đa năm đã hoàn thành.

## User effort quan sát được

| Việc | 1 record | 5 records | 10–20 records | Scope/scroll/bulk |
|---|---|---|---|---|
| Điểm xét tuyển + duyệt | ~4 thao tác: chọn/nhập ô, Lưu, Xét tuyển, Đồng ý; chưa tính filter | ~8 thao tác: 5 ô, Lưu, Xét tuyển, Đồng ý; 5 giá trị, không phải mở từng modal | Chưa thử save/approve10–20; không ngoại suy | 1 màn + modal, threshold phía trên tạo cuộn; Excel có sẵn chưa thử file |
| Xác nhận học phí | 1 click checkbox, phản hồi thành công | 5 checkbox chọn + 1 action bulk =6 click, giữ sau refresh | Có UI chọn tất cả qua trang/tối đa500 nhưng chưa chạy lô10–20 | 1 màn; không cần mở từng hồ sơ |
| Gán khi nhóm đã sẵn | Chọn QA + Gán1 =2 click sau remove | Chưa gán riêng lô5 | Chọn tất cả + Gán10 =2 click; đã thử thật | Selection còn khi search; số chọn hiển thị rõ |
| Tạo nhóm từ Summary rồi gán10 | — | — | Đường chuẩn đã dùng: chọn major, quick-create, 2 field lượng nhóm/capacity, Tạo2, Select all, Gán10 ≈7 thao tác | 2 route chức năng/3 lần chuyển view, context được prefill; các bước phá thử target/search không tính vào đường chuẩn |
| Tạo CourseOffering | Roster1 và roster10 cùng số bước tạo | Không có roster5 riêng | Offering10: sau scope có chọn môn, nhập tên, chọn group, Tiếp tục, Xác nhận ≈5 thao tác | Offering thứ hai không phải chọn lại major/year; 2 view trong cùng route + result; chưa chọn lecturer ở bước tạo |
| Xếp một buổi tương lai | Chọn Xếp lịch, ô ca, mở/chọn GV, chọn phòng, Lưu ≈6 click | Chưa tạo5 session; đã tạo3 lượt, edit1, delete1, còn2 | Chưa thử10–20 session, chưa benchmark | 1 workspace + editor; chọn tuần thêm1; form mặc định đơn vị theo GV/ngành |
| Nhập điểm học phần | 3 giá trị +2 lần Save do thử lưu partial rồi nhập exam; Tab KT→BTL đúng | 14 giá trị +1 Save; người không đủ tư cách không gõ exam | Hoàn tất10 người: 29 giá trị ban đầu +4 Save, gồm lô1/5/4; thêm phép sửa/xóa/re-enter được tính riêng | Có bulk Save, không mở modal từng người. Lượt này chủ yếu click từng ô; có thử Tab giữa thành phần, chưa đo đường keyboard tối ưu cho10–20 người |

Đây là ước lượng theo các action thực đã quan sát, không phải đo thời gian tiết kiệm. Một “thao tác chọn/nhập ô” gồm click focus + gõ; số giá trị tách riêng. Không tính thao tác snapshot, retry do helper, chờ reload và setup CDP vào effort nghiệp vụ.

## Screen scorecard (1 thấp → 5 tốt)

Điểm là đánh giá định tính ở viewport/dataset/persona đã thử, không thay thế finding. C = clarity; E = efficiency; P = error prevention; F = feedback; R = readability; N = navigation/context.

| Màn | C | E | P | F | R | N | Giải thích ngắn |
|---|---:|---:|---:|---:|---:|---:|---|
| Home operational dashboard | 4 | 4 | 4 | 4 | 4 | 4 | Queue/count đúng qua pending/completed/đủ hoặc thiếu lại điểm; chưa kiểm permission khác. |
| Nhập hồ sơ — list | 4 | 3 | 3 | 4 | 3 | 2 | Search/filter/page dùng được; refresh mất scope, bảng nhiều cột. |
| Form hồ sơ | 3 | 2 | 1 | 3 | 3 | 2 | Nhiều nhóm field, tên/email sai vẫn lưu; default cá nhân và scope mới dễ gây nhầm. |
| Điểm xét tuyển | 4 | 4 | 4 | 4 | 3 | 2 | Biên0–20/bulk/preview tốt; Tab qua link, filter context mất khi refresh. |
| Hồ sơ trúng tuyển / học phí | 3 | 4 | 3 | 4 | 3 | 2 | Checkbox/bulk hiệu quả; ý nghĩa học phí so với Đang học cần rõ hơn. |
| Grouping — Summary | 5 | 5 | 4 | 4 | 4 | 5 | Có số HV từng major và empty state; click thẳng phạm vi, URL giữ tốt. |
| Grouping — Assignment | 4 | 5 | 4 | 5 | 3 | 5 | Gán10 ít click, full/capacity rõ, remove có confirm; table trong split bị cắt cột. |
| Tạo ClassGroup | 4 | 4 | 4 | 4 | 4 | 5 | Quick-create prefill CTĐT/year/major, tạo nhiều nhóm, quay lại đúng target. |
| Tạo CourseOffering | 4 | 4 | 4 | 5 | 4 | 4 | Chọn group ra roster và review rõ; tạo tiếp giữ scope, có next action scheduling. |
| Scheduling workspace/editor | 4 | 4 | 3 | 3 | 4 | 3 | Phòng/GV bận ngăn sớm, calendar/day view hữu ích; cutoff chiều không thống nhất, refresh mất tuần. |
| Offering detail / tiến độ | 3 | 3 | 4 | 2 | 4 | 3 | Planned/held counts rõ, complete guard đúng precondition đã thấy; lý do disabled thiếu. |
| Thống kê tiến độ matrix | 4 | 4 | 4 | 4 | 3 | 4 | Chọn ô xem chi tiết, trạng thái scheduled phản ánh2 lớp; chưa qua completed. |
| Điểm thi — đã nhập10 người | 4 | 4 | 4 | 3 | 3 | 3 | Bulk/partial save và Tab thành phần tốt; read-only/dirty status rõ, lý do khóa thoáng qua và bảng rộng. Context tốt khi vào từ Home deep link; ribbon vẫn mất scope. |
| Tổng hợp điểm — đã đối chiếu10 người | 4 | 3 | 4 | 4 | 2 | 2 | Điểm đúng từng người/môn và sau refresh; rất rộng, phải chọn lại scope. |

QL Người dùng/Login chỉ dùng để baseline/persona và phục hồi kết nối; không đủ coverage để chấm scorecard quản trị tài khoản.

## Hành trình end-to-end thực tế và đánh giá

**Hồ sơ sẵn có → sửa/kiểm tra → nhập20 → xét tuyển1+5 → xác nhận học phí1+5 → Summary14 → QTKD10 → tạo2 ClassGroup → gán10 → tạo3 CourseOffering → tạo/sửa/xóa lịch → chuẩn bị1 ngày fixture được duyệt → xác nhận held qua UI → đóng lớp qua UI → lưu điểm1/5/4 người → sửa/xóa/re-enter điểm → đối chiếu10 kết quả ở report sau refresh.**

Đã dùng **11 route nghiệp vụ kể cả Home**, cộng Login và QL Người dùng = **13 màn/route khác nhau**; Summary/Assignment và wizard/review là các view trong cùng route, không thổi số màn bằng số modal. Hồ sơ tạm được tạo/xóa để thử CRUD, không dùng làm học viên chính xuyên suốt lifecycle.

- Mượt nhất: Summary→Assignment→quick-create→return→Gán10; không re-enter year/major/CTĐT. CourseOffering chọn nhóm lấy sẵn roster và có next action scheduling. Bulk admission/tuition tránh mở form riêng từng người.
- Chuyển context lớn nhất: từ scheduling đến điểm rồi tổng hợp điểm, phải chọn lại chuyên ngành/lớp. Refresh của lịch làm người dùng quay về tuần không có lịch vừa tạo.
- Bottleneck đã chứng minh: form hồ sơ validation/default; bảng chia pane/grade quá rộng; lý do khóa hoàn thành/điểm thiếu hoặc thoáng qua. Gradebook nhập thành phần có Tab và bulk/partial save, hiệu quả hơn việc mở form từng người.
- Dashboard giúp trả lời “cần làm gì tiếp” ở grouping/unscheduled/pending/grade queue và phản ánh đúng việc thiếu lại điểm khi xóa một giá trị. `Đang giảng dạy` không mặc định bằng số active offering.

### Năm cải thiện UX có giá trị cao nhất

1. **Sửa chất lượng form hồ sơ trước:** required/email và loại bỏ default cá nhân chưa xác nhận; không để toast thành công che dữ liệu sai.
2. **Mang scope xuyên module và refresh:** năm/chuyên ngành/group/offering/tuần, nhất là scheduling→gradebook→report; dùng cách URL context của Assignment làm tham chiếu.
3. **Giải thích khóa và đưa đến bước mở khóa:** banner bền vững ở gradebook, điều kiện còn thiếu ở complete, link đúng offering/session.
4. **Giảm cuộn trong thao tác quyết định:** bảng Assignment ưu tiên học phí/nhóm; bảng điểm sticky định danh + density/layout phù hợp. Giữ header sticky hiện có.
5. **Tối ưu nhập điểm theo vùng dữ liệu:** cải thiện keyboard path của admission scores; giữ Tab thành phần và bulk/partial save đang hoạt động tốt ở gradebook. Đo tiếp đường keyboard đầy đủ10–20 người trước khi redesign.

## Blocker đã gỡ bằng fixture và giới hạn còn lại

**B-GRADE-001 — Đã gỡ bằng chấp thuận follow-up của người dùng.** Đầu lượt không có teaching_sessions quá khứ và UI ngăn backdate. Người dùng đã trả lời “Cho phép chuẩn bị một lịch DEV đã qua”; không phải đồng ý suy diễn từ thời gian chờ.

- Lúc11:01:22UTC, transaction local `127.0.0.1:55432/pgsms` khóa/check đúng session `682435b4-9408-4654-9105-d97dd19f01a5`, offering KTQT .2, ngày19/10, status planned. UPDATE đúng1 row: `session_date='2026-10-17'`, `updated_at=NOW()`. **Không đổi status, confirmed/completed, grade hoặc policy bằng DB.** Evidence: [authorized-past-fixture.json](../.tmp/qa-20261018/authorized-past-fixture.json).
- Sau đó chỉ dùng UI: pending→held; complete cancel/confirm; nhập/lưu/sửa/xóa/re-enter điểm; report. Blocker thời gian không còn chặn coverage đã nêu.
- **Refresh khi điểm chưa lưu: chưa kết luận.** Sau đổi local exam QA từ9 thành9.5 chưa save rồi refresh, CDP không hoàn tất action. Runtime/ảnh không trả về, thử handle browser dialog báo không có dialog; có Edge sync target. Không suy diễn đây là mất dữ liệu hay ứng dụng treo. Source có beforeunload handler, nhưng đọc source không thay được kiểm thử thành công. DB read-only cuối vẫn exam9/course8.5, chứng minh9.5 chưa lưu; không chứng minh UX cảnh báo đã đúng. Cần thử lại trên browser sạch với một CDP observer.
- Còn phải thử: nhánh not_held, unresolved nhiều session, reopen nếu hỗ trợ, miễn thi, retake/nhiều attempt, conflict hai phiên, keyboard đầy đủ xuyên hàng. Không gán pass cho các nhánh đó.

Giới hạn khác:

- Persona ngoài admin; không có account khả dụng để login. Permission denial/hidden actions chưa pass.
- Chưa tạo conflict đồng thời từ hai phiên/stale race hoặc double-click đúng thời điểm in-flight; không lấy disabled-button của helper làm bằng chứng duplicate prevention ở race.
- Chưa thử Excel import/export nội dung file, roster20–50, mobile, screen reader, browser matrix, mọi major/năm qua full flow, admission quota/duplicate identifiers toàn diện.
- Partial scheduling có lớp0 và lớp1 session; không kiểm chứng đủ số buổi theo CTĐT hoặc close warning threshold. Đã thử pending warning với fixture quá khứ và hoàn thành theo điều kiện hiện hành; không xác nhận quy tắc số buổi tối thiểu của nghiệp vụ.

## Môi trường, performance và sự cố dụng cụ

- Edge thật headless, frontend/backend thật, fake learner data `example.invalid`. Không dùng Sites/Figma/mockup. DOM read-only và source chỉ để chẩn đoán finding sau khi quan sát.
- Có tiện ích Edge tự mở tab ngoài app/sync dialog trong lúc đầu. Đã đóng tab ngoài, bring app to front. Batch5 nhận response200 và điểm giữ sau refresh; journal có thời gian213979ms trước OPTIONS/response, một GET trước đó35s. **Không kết luận lỗi performance sản phẩm** vì tab background/extension và scheduling browser có thể tác động; không dùng các số này làm benchmark. Không đưa screenshot pending bị treo vào bằng chứng functional failure.
- Khoảng10:47UTC backend tạm `ERR_CONNECTION_REFUSED`, PID listener đổi6832→17368; app chuyển về Login và lần login đầu báo NET_ERROR. Backend tự có listener lại, retry login UI thành công; không restart/fix implementation. Chưa xác định nguyên nhân restart, có thể môi trường dev watcher; **không gọi đây là session-expiry/auth bug hay crash đã root-cause**.
- Nhiều response xuất hiện lặp trong journal do nhiều CDP observer cùng target. Khi đọc counts request phải khử trùng URL/method/started; không xem là app gửi nhiều write. Tool `command-error` do selector/disabled/hit-test không tự động là bug.
- Không ghi password/cookie trong evidence. Input fill value được redacted. Journal có lỗi hiển thị Unicode ở một vài entry do encoding PowerShell; report và screenshot là UTF-8 đúng, không gán thành lỗi tiếng Việt của sản phẩm.

## DB sau audit và các thay đổi đã thực hiện

Read-only snapshot cuối: [db-after.json](../.tmp/qa-20261018/db-after.json), 18/10/2026 18:09:06 GMT+7, transaction `BEGIN READ ONLY` rồi rollback, có grades/revision để kiểm chứng sau sự cố CDP. **Ngoại lệ DB write duy nhất** là ngày session/updated_at được người dùng duyệt ở phần fixture. Không có write API ngoài request từ UI.

| Entity | Trước | Sau | Ý nghĩa |
|---|---:|---:|---|
| admission_records | 210 | 210 | Tạo1 rồi xóa1 hồ sơ tạm qua UI; không reseed |
| admission_evaluations | 15 | 21 | Nhập/xét thêm6 người, gồm single và batch5 |
| class_groups | 2 | 4 | Thêm QTKD 2026.1.2 và .3, max10 mỗi nhóm |
| class_group_members | 1 | 11 | Gán thêm10; remove/reassign QA không tạo membership trùng |
| course_offerings | 0 | 3 | KTQL Nhóm1/2 active; KTQT Nhóm2 completed |
| course_offering_class_groups | 0 | 3 | Một group link mỗi offering |
| course_offering_students | 0 | 0 | Roster đi qua group association |
| teaching_sessions | 0 | 2 | Một held17/10, một planned20/10 |
| course_exam_gradebooks | 0 | 1 | Revision6; 10 kết quả, passed9/failed1, pending0 |

- QA-2026-01 = Hồ Phương Thảo: tên/email đúng đã phục hồi sau validation tests; code giữ để truy vết; phone cancel không đổi. Paid đã xác nhận, membership QTKD .2, studyStatus Đang học.
- 5 người trong bulk20/approval cũng đã paid. Tổng6 xác nhận học phí. 4 người QTKD còn lại chưa paid nhưng đã được gán.
- QTKD .1 giữ1 người sẵn có; .2 có10/10; .3 trống0/10; CNTT .1 trống0/1. Query membership duplicate theo admission_record_id trả `[]`.
- `QA-2026 KTQT Nhóm 2`, id `0d1b4686-3b6f-47ea-a1b2-682b9c4e7e2d`: session `682435b4-9408-4654-9105-d97dd19f01a5`, **17/10/2026 Sáng**, Đỗ Hải Đăng, BTDEMO26P1; đã held và offering completed qua UI. Ngày ban đầu19/10 được chuyển thành17/10 theo chấp thuận fixture.
- `QA-2026 KTQL Nhóm 1`, id `09bee30b-b9a8-43fd-8e61-59ed9006d130`: session `b592e7e4-c094-469e-88de-da01d4f7d746`, **20/10/2026 Sáng**, Nguyễn Thanh Long, BTDEMO26P3. Lịch thử19/10 của offering này đã sửa rồi xóa qua confirmation UI, tạo lại ngày20/10.
- `QA-2026 KTQL Nhóm 2`, id `6d911578-0213-479c-a358-ae0db16d27fd`: chưa có session để giữ một queue item kiểm chứng Home.
- Home checkpoint sau đủ10 kết quả: grouping4 (MT3, KTHH1), unscheduled1, pending confirmations0, grade queue0, active2, teaching0, completed1. Sau xóa điểm QA queue1; sau re-enter9 đã kiểm tra dữ liệu cuối/report, kết quả không pending. Không cleanup lifecycle và không reset giữa lượt.

## Kết quả follow-up: giảng dạy → điểm → báo cáo

### Xác nhận/hoàn thành và Dashboard

- Sau fixture, Home hiện **Tiến độ cần kiểm tra1** và cảnh báo đúng lớp có1 buổi quá giờ chưa xác nhận (DASH-004). Pending drawer hiện17/10, đúng GV/phòng; bấm **✓ Đã diễn ra**, pending về0, heldCount thành1.
- Nút complete mở confirmation nêu không thể xếp thêm buổi sau đóng lớp. Đã Hủy rồi mở lại và xác nhận. Lớp biến khỏi worklist active và Home có completed1, active2; grade queue xuất hiện1 nhóm/1HP (DASH-005).
- Link Home **Nhập điểm** đi đúng KTQT .2, mang đủ context; khác đường ribbon không có URL context đã nêu ở UX-NAV-001.
- Sau lưu10 kết quả, grade queue0 (DASH-006). Xóa exam QA và lưu làm kết quả pending, course/letter/attempt display trống; Home queue1 (DASH-007). Nhập lại exam9, lưu, điểm học phần8.5/A/4.0; report đọc giá trị mới.

### Điểm đã thực sự nhập và đối chiếu

Đọc cấu hình hiện có qua nút Cài đặt điểm số, **không đổi cấu hình**: KTQT kiểm tra25%, BTL25%, exam50%, course minimum5.5. Snapshot DB sau cùng ghi minimum từng thành phần4 và các band hiện hành. Không tự áp một quy tắc “exam phải5.5” khác cấu hình.

| Học viên | KT | BTL | Exam đã lưu | Course / chữ / thang4 ở UI | Kết quả | KTQT trên report sau refresh |
|---|---:|---:|---:|---|---|---:|
| Hoàng Đức Anh | 0 | 0 | null | 0 / F / 0 | Không đủ tư cách, failed; exam bị khóa | 0 |
| Lý Anh Dũng | 10 | 10 | 10 | 10 / A+ / 4 | passed | 10 |
| Đỗ Quỳnh Hoa | 5.5 | 5.5 | 5.5 | 5.5 / C / 2 | passed | 5.5 |
| Hồ Thanh Hà | 6 | 7 | 8 | 7.3 / B / 3 | passed | 7.3 |
| Hồ Trung Kiên | 8 | 8 | 4 | 6 / C / 2 | passed theo policy hiện có | 6 |
| Hồ Ngọc Mai | 7 | 7 | 7 | 7 / B / 3 | passed | 7 |
| Hồ Phương Thảo — QA-2026-01 | 8 | 8 | 9 | 8.5 / A / 4 | passed | 8.5 |
| Đinh Thu Trang | 7 | 7 | 7 | 7 / B / 3 | passed | 7 |
| Đinh Thanh Tùng | 7 | 7 | 7 | 7 / B / 3 | passed | 7 |
| Đinh Thành Đạt | 7 | 7 | 7 | 7 / B / 3 | passed | 7 |

- Weighted sample `6×25% +7×25% +8×50% =7.25`, UI làm tròn7.3. Report đúng7.3; QA sau edit từ exam8→blank→9 ra course8→blank→8.5. Không có stale8 ở report cuối.
- Với Hoàng, UI hiển thị exam/attempt0 theo trạng thái không đủ tư cách; DB vẫn exam null/attemptScores[], course0/F. **Không tính đây là nhập exam0 thực tế.** Có khác biệt trình bày cần hiểu, chưa kết luận sai business logic.
- Lưu partial QA với KT8/BTL8/exam blank thành công, refresh giữ8/8/blank và pending. Sau đó exam8 lưu ra8/B+/3.5. Chỉ một row thay đổi mỗi lần; không bắt nhập đủ cả lớp để lưu partial.
- Lưu lô5 và lô4 tiếp theo có phản hồi cập nhật theo số học viên thay đổi, không cần mở modal từng người. Sau save/refresh đủ10 kết quả đúng. DS thi hiện9 người đủ tư cách, loại Hoàng; bảng tất cả vẫn10 người.
- Nhập11 ở ô trống bị từ chối, vẫn blank; thử-1 khi có8 giữ8.0. Không lưu ngoài0–10. Không có inline error rõ trong các phép thử này, nên prevention tốt nhưng phản hồi invalid có thể dễ hiểu hơn. Không gọi screenshot GRADES-002 là “đã lưu điểm11”.
- Tab từ KT QA chuyển đúng BTL QA, nhập qua keyboard được; không phải dùng mouse sau mọi giá trị. Chưa đo keyboard xuyên toàn hàng/10–20 người.
- Bảng tổng hợp đúng group .2, cột KTQT và10 người; các môn khác trống. Đã refresh report, chọn lại scope và đọc đủ10 giá trị một lần nữa. Single attempt QA cuối là `[9]`; không phát sinh attempt thứ hai khi sửa cùng ô. Chưa thử nghiệp vụ học lại/thi lại.

Ảnh bổ sung: PROGRESS-004-completion-confirm; DASH-004/005/006/007; GRADES-002/003/004/005/006; [RESULT-002-ten-grades-synced.png](../.tmp/qa-20261018/RESULT-002-ten-grades-synced.png). Phép thử unsaved refresh không tạo ảnh hoàn tất; không dùng tên UX-GRADE-006 như ảnh có thật.

## Evidence và đề nghị ưu tiên

Evidence nằm local tại [.tmp/qa-20261018](../.tmp/qa-20261018/), journal `browser-journal.jsonl`; baseline `.tmp/qa-baseline-20261018.json`, working-tree snapshot `.tmp/qa-source-status-before.txt`. Đây là artifact local, có thể không nằm trong git do `.tmp` ignored; cần giữ thư mục này nếu muốn review ảnh sau lượt làm việc.

Các ảnh chính: BASE-001; ADM-001/002/003/004/005/006/007; QA-ADM-001/002; GROUP-001/002/003/004; OFFER-001/002; SCHED-001/002/003; QA-SCHED-003; PROGRESS-002/003; GRADES-001; RESULT-001; DASH-002/003; RISK-001; UX-ADM-006; UX-GRADE-005. Tên đầy đủ là các file PNG trong thư mục evidence. Không dùng ảnh không tạo thành công hoặc chỉ phục vụ debug dụng cụ làm finding.

**Ưu tiên đầu:** xác thực hồ sơ và xử lý default cá nhân (QA-ADM-001/002, RISK-ADM-002); sau đó thống nhất cutoff scheduling và feedback/context trước khi tối ưu visual. Chủ nghiệp vụ cần trả lời RISK-TUI-001. Blocker fixture đã được gỡ; lượt tiếp theo cần account operational khác và browser sạch để thử các nhánh còn thiếu, rồi thiết kế regression tests cho finding đã xác nhận. Follow-up không xác nhận thêm lỗi chức năng; tổng vẫn S2×1, S3×2. Audit chỉ giao report/đề xuất; không sửa sản phẩm.
