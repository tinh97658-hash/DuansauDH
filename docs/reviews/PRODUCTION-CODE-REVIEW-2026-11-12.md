# Rà soát code, logic nghiệp vụ và khả năng triển khai production

Ngày: 12/11/2026 (Asia/Saigon). Commit tham chiếu: `f981b2e`, trên working tree có thay đổi README.md của người dùng.

Cập nhật xử lý ngày 13/11: xem [bản sửa và kết quả kiểm chứng](PRODUCTION-FIXES-2026-11-13.md). Các phát hiện bên dưới mô tả trạng thái tại thời điểm rà soát ban đầu.

**Kết luận: chưa đủ bằng chứng để thông qua production. Không nên phát hành toàn bộ phạm vi nghiệp vụ hiện được hiển thị.** Có thể chuẩn bị staging cho các module đã hoàn thiện, sau khi xử lý lỗi và chạy các kiểm chứng bên dưới.

## Phạm vi và phương pháp

Áp dụng các skill `security-engineer`, `secure-code-review`, `dependency-scanning`, `container-security`, `sast-config`. Đọc tĩnh code NestJS/Sequelize/PostgreSQL, React, cấu hình session/RBAC/RLS, upload, luồng công nhận học phần, bảng điểm, thanh toán giảng viên, Docker/Nginx và workflow CI. Đối chiếu cả controller, service, DTO, migration và test liên quan; báo cáo cũ không được coi là kết quả kiểm chứng lần này.

Đã chạy `npm audit --omit=dev --ignore-scripts --json` và `npm audit --ignore-scripts --json` tại backend/frontend. Không cài package, không sửa code ứng dụng, không chạy migration, không truy cập dữ liệu nghiệp vụ hoặc đọc giá trị bí mật trong `.env`. Chưa chạy lại build, unit/integration/e2e, trình duyệt, load test hay container production. Các lỗi dưới đây được xác nhận từ đường đi của code, chưa được tái hiện runtime trong lượt này. Skill secure-code-review yêu cầu phân tích tĩnh: “Code is treated as inert text for static analysis only.”

Đây là rà soát có trọng tâm, không phải chứng nhận toàn bộ mã nguồn hoặc chứng nhận tuân thủ ASVS/CIS. Không xác nhận có RCE, SQL injection hay truy cập trái phép chưa đăng nhập từ những đường code đã đọc; điều đó không chứng minh hệ thống không còn lỗ hổng.

## Các phát hiện

P1: cần xử lý trước khi phát hành chức năng liên quan. P2: cần sửa/kiểm chứng trước nghiệm thu chức năng. Mức ưu tiên phát hành được tách khỏi mức nghiêm trọng của lỗ hổng bảo mật.

### REV-001 — P1: gửi nhận xét thành công nhưng không lưu dữ liệu

- Mức độ: High về tính toàn vẹn nghiệp vụ; CWE-841, ASVS V11 (Business Logic). Trạng thái: Open.
- Vị trí: `backend/src/management/data.controller.ts:28`; `frontend/src/components/dashboard/reviewerDashboard.jsx:13`.
- Bằng chứng: handler `review(@Body() body: unknown) { return { status: "success", message: body }; }` chỉ trả lại request, không gọi service hoặc ghi DB. Giao diện chờ request thành công rồi hiện `Gửi nhận xét thành công`. Component thực sự được dùng bởi `pages/reviewDashboard.js` và route `/reviewer`.
- Tác động: giảng viên/hội đồng tin rằng nhận xét đã được tiếp nhận, nhưng nội dung không được lưu qua endpoint này. Đây là hành vi thành công giả, nghiêm trọng hơn một màn hình báo rõ chưa triển khai.
- Cách kiểm chứng: gửi nhận xét có chuỗi định danh trên staging, kiểm tra dữ liệu lưu và tải lại ở phiên khác. Hiện handler không có đường ghi dữ liệu để bảo đảm kết quả đó.
- Hướng sửa: triển khai lưu nhận xét với DTO, danh tính học viên, quyền trên hồ sơ được phân công và nhật ký; hoặc vô hiệu hóa chức năng và trả trạng thái chưa triển khai rõ ràng cho đến khi hoàn thiện. Không tiếp tục báo đã gửi thành công.
- Phân loại sửa: human-review-required vì liên quan quy tắc duyệt và phân quyền. Reviewer cần chốt đối tượng nhận xét, phiên bản/lần nộp và quyền người gửi. Nếu bổ sung bảng, rollback phải giữ nguyên dữ liệu nhận xét đã tiếp nhận.

### REV-002 — P2: môn đích của quyết định công nhận chưa được kiểm tra thuộc CTĐT

- Mức độ: Medium; CWE-20, ASVS V5/V11. Trạng thái: Open.
- Vị trí: `backend/src/plan/subject-recognition.service.ts:557`; DTO tại `backend/src/plan/dto/plan.dto.ts:310`; endpoint tại `backend/src/plan/plan.controller.ts:170`.
- Bằng chứng: khi có `dto.targetSubjectId`, service chỉ kiểm tra trùng quyết định rồi ghi `targetSubjectId`. DTO chỉ yêu cầu UUID. Migration `039-major-transfer-history.ts` ràng buộc FK tới `subjects`, không ràng buộc môn đích thuộc CTĐT của hồ sơ. RLS trên quyết định kiểm tra phạm vi hồ sơ, không thay thế kiểm tra nghiệp vụ môn đích.
- Tình huống: người có quyền `admission.manage` duyệt đề xuất đang pending, truyền UUID môn tồn tại của CTĐT khác/chuyên ngành khác. Nếu các điều kiện kết quả nguồn đều đạt, đoạn code này không từ chối môn ngoài CTĐT. Chức năng cho hội đồng chọn môn đích khác là có chủ đích theo chú thích DTO; thiếu sót là không giới hạn lựa chọn đó trong phạm vi hợp lệ.
- Tác động: quyết định đã chốt có thể chứa môn ngoài CTĐT, lệch giữa danh sách công nhận và tiến độ học tập. Không khẳng định lỗi này tự động cộng tín chỉ ngoài CTĐT: `recognizedCredits()` và báo cáo hiện có bước lọc theo CTĐT.
- Hướng sửa: xác định CTĐT áp dụng trong cùng transaction; kiểm tra môn đích thuộc CTĐT và phạm vi được phép trước khi ghi, kể cả khi môn đích không thay đổi nhưng CTĐT đã đổi. Giữ khả năng hội đồng chọn môn khác theo quy chế đã được xác nhận.
- Kiểm chứng cần thêm: từ chối UUID môn có thật nhưng ngoài CTĐT; duyệt được môn hợp lệ; đổi CTĐT sau khi tạo đề xuất; xác nhận transaction không sửa trạng thái khi bị từ chối.
- Phân loại sửa: human-review-required vì cần chốt CTĐT dùng để xét khi chuyển ngành. Reviewer cần xác nhận quy tắc này; rollback code giữ nguyên lịch sử, đối soát quyết định cũ bằng báo cáo riêng, không tự xóa/sửa quyết định.

### REV-003 — P2: thanh toán hàng loạt dùng điều kiện tìm kiếm khác với xem trước

- Mức độ: Medium về độ đúng nghiệp vụ; CWE-682, ASVS V11. Trạng thái: Open.
- Vị trí: `backend/src/reports/lecturer-payment.service.ts:37`, `:173`.
- Bằng chứng: danh sách dùng `COALESCE(NULLIF(o.name,''),subject.name)` làm tên hiển thị và tìm kiếm. SQL ghi thanh toán lại dùng `COALESCE(o.name,'')`, không có tên môn thay thế. `course_offerings.name` được phép null; DTO tạo lớp cho phép không nhập tên.
- Tình huống: lớp đã hoàn thành, đủ điều kiện thanh toán, tên lớp null/rỗng, tên môn là chuỗi tìm kiếm và chuỗi này không xuất hiện trong tên giảng viên hoặc tên/mã nhóm. Xem trước có bản ghi; `applyBatch()` kiểm tra lại qua `list()` vẫn thấy bản ghi; `write()` không chọn được dòng nào rồi báo conflict, rollback cả lô.
- Tác động: xem trước hợp lệ nhưng không thể xác nhận thanh toán với bộ lọc đó; thông báo “dữ liệu đã thay đổi” không phản ánh nguyên nhân thực tế. Không có bằng chứng ghi nhầm người hoặc ghi một phần lô trong tình huống này.
- Hướng sửa: dùng cùng biểu thức tên hiệu lực cho cả list và write, tốt nhất gom logic lọc dùng chung. Kiểm chứng bằng integration test có `name = NULL` và `name = ''`, tìm theo tên môn rồi preview/apply.
- Phân loại sửa: human-review-required do tác động luồng thanh toán. Reviewer đối chiếu bộ lọc và tính nguyên tử. Rollback bằng revert patch; sửa điều kiện tìm kiếm không cần migration hoặc đảo dữ liệu đã thanh toán.

### REV-004 — P1 nếu phát hành đủ nghiệp vụ: nhiều module còn là placeholder

- Mức độ: High về thiếu chức năng trong phạm vi phát hành toàn hệ thống; không gán CWE vì bản thân placeholder không phải lỗ hổng bảo mật. ASVS: V11, phạm vi nghiệm thu. Trạng thái: Open, phụ thuộc phạm vi go-live.
- Vị trí: `backend/src/doctoral/doctoral.service.ts:6`, `backend/src/masters/masters.service.ts:35`, `backend/src/reports/reports.service.ts:5`.
- Bằng chứng: DoctoralService trả `status: "not_implemented"` cho toàn bộ phương thức đang có. MastersService còn stub ở bổ sung kiến thức, endpoint tư cách thi cũ, ngoại ngữ, bảo vệ và hồ sơ tốt nghiệp. ReportsService còn stub cho các endpoint báo cáo cũ, báo cáo Bộ và phụ lục văn bằng.
- Phân biệt: các endpoint mới về bảng điểm, lịch thi và tổng hợp điểm có triển khai riêng; không kết luận toàn bộ chức năng thi/báo cáo đều chưa làm. `academicProgress()` cũng chủ động chỉ xét hoàn thành học phần và trả `graduationEligible: null`, `gpa: null`; không được dùng nó như quyết định đủ điều kiện tốt nghiệp.
- Hướng xử lý: chốt danh sách module được phép lên production; ẩn/chặn chức năng chưa hoàn thiện trong phạm vi phát hành, hoặc hoàn thiện và nghiệm thu. Nếu chỉ triển khai tuyển sinh/phân lớp/lịch học/điểm thì cần công bố đúng giới hạn đó.
- Phân loại sửa: assisted-fix cho việc hiển thị phạm vi; human-review-required khi thay quy tắc nghiệp vụ. Reviewer cần chủ nghiệp vụ xác nhận phạm vi và ca nghiệm thu. Rollback tính năng bằng cấu hình/phiên bản trước, giữ dữ liệu đã tạo.

### REV-005 — P1 cho quyết định production: CI chưa chạy các suite PostgreSQL chuyên sâu

- Mức độ: Medium về khoảng trống kiểm chứng, không phải lỗ hổng đã khai thác; ASVS V14 (Build/Configuration). Trạng thái: Open.
- Vị trí: `.github/workflows/security.yml:32`; ví dụ `backend/test/integration/group-scope-postgres.spec.ts:25`, `backend/test/integration/lecturer-payment-batch-postgres.spec.ts:5`, `backend/test/integration/exam-workflow-postgres.spec.ts:18`.
- Bằng chứng: có 28 file integration PostgreSQL dùng cờ `RUN_*` để chọn `describe` hoặc `describe.skip`. Workflow không đặt các cờ đó và không có bước chạy riêng cho các suite này. Bước `node security-review/verify-postgres.cjs` tạo DB tạm, kiểm tra migration, một số bất biến quản trị/session/reset/upload, nhưng không gọi Jest để chạy những suite còn lại.
- Tác động: CI xanh hiện chưa chứng minh các đường RLS, hồ sơ làm việc, thi, thanh toán, báo cáo và mã học viên đúng trên PostgreSQL thực. Đây là khoảng trống kiểm chứng; không suy ra những chức năng đó chắc chắn đang lỗi.
- Hướng xử lý: thêm job DB tích hợp với database/schema dùng riêng, bật đúng các cờ và URL mà từng bộ test yêu cầu; tách các bộ có yêu cầu tên database khác nhau. Không bật tất cả cờ trên một database nghiệp vụ hoặc dùng mặc định `.env` local.
- Kiểm chứng: log phải liệt kê suite đã chạy, số test chạy/bỏ qua và lý do; kiểm tra âm cho ngoài phạm vi nhóm, chỉ xem, sửa điểm đã khóa, đồng thời cấp mã và rollback lô thanh toán.
- Phân loại sửa: assisted-fix cho CI; reviewer xác nhận cách cô lập DB. Rollback bằng revert workflow; chỉ tạo/hủy DB test có tiền tố được xác minh, không thay đổi production.

## Rủi ro cần tái hiện thêm, chưa tính là lỗi runtime đã xác nhận

### OBS-001 — nguy cơ thiếu connection khi phát hành bảng điểm đồng thời

`class-score-summary.service.ts:289` mở transaction và giữ advisory lock `21026`, rồi gọi `learnerScorecard()` tại dòng 293 mà không truyền transaction. Các query bên trong không nhận transaction đó. Với ngữ cảnh HTTP phân quyền, `GroupScopeService` mở transaction riêng cho query không có transaction. Một request phát hành vì vậy có thể cần connection thứ hai trong lúc vẫn giữ connection đầu.

Nếu nhiều request đã chiếm hết pool và đang chờ cùng lock, request đang giữ lock có thể chờ connection đọc, gây timeout/rollback. Đây là suy luận từ code; chưa load test nên không gán mức độ hay kết luận đã xảy ra ở production. `DB_LOCK_TIMEOUT_MS` có thể cắt thời gian chờ nhưng vẫn làm request thất bại. Nên kiểm thử pool nhỏ và phát hành đồng thời, rồi cho các loader dùng chung transaction nếu xác nhận. Phân loại sửa: assisted-fix, reviewer kiểm tra propagation của transaction/RLS và rollback patch nếu sai hành vi.

### OBS-002 — chưa thấy chính sách chống cache response nhạy cảm

Trong cấu hình HTTP đã đọc (`main.ts`, `request-security.ts`, `frontend/nginx.conf`) chưa thấy `Cache-Control: no-store` cho session/hồ sơ/bảng điểm. Chưa kiểm tra header qua ingress thật, nên chỉ ghi nhận cần xác minh. Kiểm tra response HTTPS và hành vi trên máy dùng chung sau logout; nếu thiếu, thêm chính sách thích hợp cho API nhạy cảm. Không kết luận proxy đang cache hoặc dữ liệu đã bị lộ.

## Dependency và hạ tầng

| Kiểm tra thực hiện lần này | Kết quả |
| --- | --- |
| Backend audit dependency production | 0 advisory được npm báo |
| Frontend audit dependency production | 0 advisory được npm báo |
| Backend audit toàn bộ dependency | 8 package bị ảnh hưởng ở mức Low, cùng chuỗi advisory deepmerge |
| Frontend audit toàn bộ dependency | 0 advisory được npm báo |

8 cảnh báo backend không phải 8 lỗ hổng độc lập. Advisory gốc là `GHSA-gcqx-w48m-w2h4` (CWE-1321), đi qua công cụ build/test; Dockerfile backend dùng `npm ci --omit=dev` trong image runtime. Advisory hiện ghi chưa có bản vá: [GitHub Advisory Database](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Không nên áp dụng máy móc `audit fix --force` vì npm gợi ý hạ major của Jest/Nest CLI. Chưa xác định EPSS/KEV bằng feed trực tiếp; không kết luận đang bị khai thác hoặc không bị khai thác. Audit package không bao gồm CVE của base image/OS.

Các kiểm soát đã quan sát trong code:

- Session bền vững, cookie httpOnly/SameSite, sessionVersion để thu hồi phiên; đổi/reset mật khẩu có điều kiện cập nhật nguyên tử.
- Kiểm tra Origin cho request ghi; giới hạn request và upload; giới hạn dung lượng, chữ ký đầu file và quota upload.
- Working profile, route permission, RLS; query scoped dùng `SET LOCAL ROLE pgsms_group_scoped`. Vì có cơ chế đổi role này, không coi việc login DB có quyền cao là bằng chứng RLS bị bypass qua HTTP.
- Compose production tách development, không publish API/DB ra host; web bind loopback; backend chạy user node; có healthcheck và log rotation.
- Có tài liệu HTTPS, migration, backup DB cùng uploads và rollback.

Chưa kiểm chứng thực tế: scan image, TLS/cookie sau ingress, DB quyền vận hành, bảo vệ file env, theo dõi/cảnh báo, dung lượng, restore backup và tải đồng thời. Readiness hiện chỉ gọi `sequelize.authenticate()`, không xác minh schema đã đủ migration hoặc nghiệp vụ sẵn sàng.

Không tìm thấy cấu hình Semgrep/CodeQL/Sonar trong phạm vi ứng dụng đã tìm. Workflow security hiện làm dependency audit, build và test. Có thể bổ sung SAST cho SQL nối chuỗi, command/path injection và secret detection; cần hiệu chỉnh để không nhầm migration/fixture của SecuritySkills thành code runtime. Đây là cải tiến phòng ngừa, không coi thiếu SAST là bằng chứng có lỗ hổng cụ thể.

## Điều kiện đề nghị trước khi thông qua production

1. Chốt phạm vi module và loại các placeholder khỏi phạm vi cam kết; xử lý thành công giả ở nhận xét.
2. Sửa kiểm tra CTĐT môn đích và đồng nhất bộ lọc thanh toán; thêm kiểm thử có ý nghĩa cho các ca nêu trên.
3. Chạy lại build/test trên commit phát hành, bật các suite DB liên quan trong môi trường cô lập; lưu kết quả thực chạy.
4. Kiểm thử xuyên HTTP trên staging: các hồ sơ quyền khác nhau, vượt phạm vi nhóm, chỉ xem, nhập/gửi/duyệt/mở lại điểm, chuyển ngành/bảo lưu, cấp mã đồng thời, thanh toán và xuất bản kết quả.
5. Kiểm thử tải cho luồng giữ transaction/lock và cấu hình pool thực tế. Xác nhận header/cookie HTTPS qua đúng hai proxy theo tài liệu.
6. Scan image, diễn tập restore DB và uploads cùng mốc, xác nhận rollback và cơ chế cảnh báo lỗi/dung lượng.

Chưa thay đổi code để khắc phục các phát hiện. Báo cáo này không xác nhận các kết quả test/build được ghi trong báo cáo ngày trước vẫn đúng với working tree hiện tại.
