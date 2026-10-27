# Báo cáo rà soát bảo mật dự án

> Báo cáo này ghi nhận trạng thái **trước sửa**. Các thay đổi và kiểm chứng sau sửa nằm tại [KET-QUA-KHAC-PHUC.md](KET-QUA-KHAC-PHUC.md); không dùng danh sách dưới đây như trạng thái hiện tại.

Ngày: 27/10/2026, Asia/Saigon. Phương pháp: SecuritySkills `security-engineer`, `secure-code-review`, `api-security`, `dependency-scanning`, `secrets-management`, `container-security`, `sast-config`.

## Kết luận

Phát hiện **9 vấn đề cần xử lý: 4 High, 5 Medium**. Đây là mức đánh giá trong bối cảnh dự án, không phải điểm CVSS tự tính. Ngoài ra có các khuyến nghị tăng cường và một lỗi đóng gói frontend. Chưa đủ cơ sở kết luận hệ thống đã bị khai thác hoặc dữ liệu đã lộ ra Internet.

Ưu tiên trước khi đưa hệ thống ra Internet: kiểm soát bản backup đang được Git theo dõi, sửa nguồn tạo URL khôi phục mật khẩu, thu hồi phiên khi thay đổi mật khẩu và cập nhật dependencies có đường sử dụng thực tế. Không nên coi việc 46 kiểm thử hiện tại đều đạt là bằng chứng hệ thống đã an toàn.

## Phạm vi và độ bao phủ

- Lập danh mục 880 file được Git theo dõi tại thời điểm rà soát; backend có 333 file trong `src`, frontend có 339 file trong `src` (đã bao gồm 86 file dưới `src/test`). Backend có 85 file trong `test`.
- Lập danh mục **16 controller, 256 khai báo route REST** bằng TypeScript AST, kèm guard và permission tại lớp/phương thức: `api-inventory.json`.
- Quét mẫu trên toàn mã nguồn ứng dụng, đọc sâu các luồng xác thực, RBAC, phạm vi nhóm, tài khoản, phục hồi mật khẩu, upload, truy vấn SQL, serializer, audit; xem cấu hình Docker, Compose, Nginx, Vite và lockfile. Phần quản lý đào tạo gồm plan/admission, masters/exam/gradebook, doctoral, scheduling, reports, dashboard và catalog được rà theo route, điểm kiểm soát và các sink dữ liệu.
- Ranh giới tin cậy: trình duyệt → HTTP/body/query/header/upload → NestJS/Passport/session → RBAC/RLS → PostgreSQL; thêm OAuth Google và SMTP. Dữ liệu nhạy cảm gồm hồ sơ học viên, định danh cá nhân, điểm, mật khẩu băm và phiên.
- Đối chiếu theo ASVS V2/V3/V4/V5/V6/V7/V8/V9/V12/V13/V14, OWASP API Top 10:2023 và CWE. Chỉ dùng chương ASVS thay vì suy diễn mã yêu cầu chi tiết.
- Dependency audit online cho root/backend/frontend, cả đầy đủ và `--omit=dev` cho hai ứng dụng. Đối chiếu một số advisory quan trọng trên GitHub Advisory Database.
- Chạy 5 suite hiện có, **46/46 test đạt**. Chạy thêm harness độc lập với tài khoản giả và repository mock, không kết nối DB hay gửi email: `verify-findings.cjs`, `verification.log`.
- Đây là rà soát mã và cấu hình có kiểm chứng chọn lọc, **không phải pentest đầy đủ từng endpoint hay chứng nhận tuân thủ**. Không thực hiện stress test, không đọc dữ liệu production qua mạng, không thay đổi database, không dựng image và chưa chạy integration PostgreSQL/RLS trên DB cô lập. Không kiểm tra toàn bộ lịch sử Git, branch protection, cấu hình máy chủ, TLS termination hoặc quyền của dịch vụ ngoài repo. Không có xác minh dữ liệu backup là dữ liệu thật hay dữ liệu mẫu.
- Thư mục `SecuritySkills` là bộ hướng dẫn; các fixture cố ý chứa lỗ hổng trong đó không được tính là lỗ hổng ứng dụng. `node_modules`, file build và font/ảnh không được đọc thủ công từng dòng.

## Danh sách phát hiện

| ID | Mức | Vấn đề | CWE / ánh xạ | Bằng chứng |
|---|---|---|---|---|
| SEC-01 | High | Backup chứa hồ sơ và thông tin xác thực được Git theo dõi | CWE-538; ASVS V8 | Git + cấu trúc SQL |
| SEC-02 | High | Host header chi phối miền trong email đặt lại mật khẩu | CWE-640; ASVS V2; API2 | Harness xác nhận |
| SEC-03 | High | Đổi/đặt lại mật khẩu chưa thu hồi các phiên cũ | CWE-613; ASVS V3; API2 | Harness + đối chiếu serializer |
| SEC-04 | High | Lockfile còn dependencies có advisory bảo mật | CWE-1395; API8 | npm audit online |
| SEC-05 | Medium | Google OAuth không kiểm tra state gắn với phiên | CWE-352; ASVS V3; API2 | Strategy thực tế dùng NullStore |
| SEC-06 | Medium | Local login thiếu kiểm tra nguồn yêu cầu chống login CSRF | CWE-352; ASVS V3 | Phân tích luồng HTTP |
| SEC-07 | Medium | Phiên học viên không kiểm tra lại điều kiện tài khoản | CWE-863; ASVS V4; API2 | Harness xác nhận |
| SEC-08 | Medium | Kết nối PostgreSQL SSL bỏ xác minh chứng thư | CWE-295; ASVS V9; API8 | Cấu hình source |
| SEC-09 | Medium | Upload không có quota và không dọn tệp bị thay thế | CWE-400; ASVS V12; API4 | Luồng lưu file và upsert |

### SEC-01 — Backup dữ liệu nằm trong Git

**Vị trí:** `pgsms-full-backup-20261025205602/database.sql:2944`, `:10725`, `:10742`; bản `database.restore-local.sql` tương ứng và `pgsms-full-backup-20261025205602.zip`.

`git ls-files` xác nhận cả archive và SQL được theo dõi. Commit gần nhất chạm file SQL: `8283f34`. Bản SQL khoảng 15 MB chứa 278 bản ghi admission_records, 1 staff và 1 session. Cột có email, phone, dob, id_card, password, session data. Không chép giá trị cá nhân, hash hay SID vào báo cáo. Chưa xác minh mật khẩu/phiên còn sử dụng được.

**Tác động:** bất kỳ người hoặc công cụ nào có quyền lấy repo đều có thể tiếp cận bản sao dữ liệu ngoài cơ chế RBAC/RLS của ứng dụng. Password hash hỗ trợ dò offline. Dữ liệu phiên có thể hỗ trợ tấn công nếu kết hợp thêm bí mật ký cookie; riêng dữ liệu này chưa chứng minh chiếm phiên trực tiếp. Nếu toàn bộ là dữ liệu giả, tác động về riêng tư giảm nhưng cách lưu trữ vẫn cần thay đổi.

**Khắc phục:** chuyển backup sang kho riêng có kiểm soát truy cập và mã hóa; xác nhận nguồn dữ liệu, phạm vi repo đã được chia sẻ, và bí mật liên quan. Quyết định loại bỏ bản đang theo dõi/làm sạch lịch sử cần có kế hoạch giữ bằng chứng và phối hợp các bản clone. Thêm ignore không xóa file đã được track. Thu hồi credential/phiên liên quan nếu xác định còn hiệu lực hoặc đã lộ.

**Xác minh:** `git ls-files` không còn backup nhạy cảm; kiểm tra lịch sử và các bản mirror theo phạm vi đã thống nhất; thử khôi phục bản sao từ kho backup riêng. **Rollback:** giữ bản sao an toàn trước mọi thay đổi lịch sử; không xóa backup duy nhất.

### SEC-02 — Password reset poisoning qua Host

**Vị trí:** `backend/src/auth/user.controller.ts:43`, `backend/src/students/students.service.ts:25` và `:36`.

Controller tạo `baseUrl` từ `request.protocol` và `request.get("host")`; service nhúng trực tiếp vào email chứa reset token. Harness đưa host giả và xác nhận email trỏ tới `https://attacker.example.invalid/user/resetPassword/...`.

**Điều kiện/tác động:** nếu API hoặc reverse proxy chấp nhận Host tùy ý, kẻ tấn công gửi yêu cầu quên mật khẩu cho email nạn nhân. Khi nạn nhân mở link, miền của kẻ tấn công nhận token, có thể dùng đặt mật khẩu trong thời hạn 10 phút. Đây là nguy cơ chiếm tài khoản **học viên**; endpoint này không phục hồi tài khoản Staff. Proxy có allowlist Host có thể giảm khả năng khai thác nhưng source không tự bảo vệ.

**Khắc phục:** lấy reset URL từ cấu hình tin cậy, ưu tiên trang frontend đặt lại mật khẩu, không từ header; validate scheme và miền khi khởi động. Kiểm tra frontend có trang tiếp nhận token và gọi PATCH API đúng luồng.

**Xác minh:** gửi cùng yêu cầu với Host/X-Forwarded-Host giả và kiểm tra email vẫn có miền cấu hình; token chỉ dùng một lần, đúng hạn. **Rollback:** triển khai cùng cấu hình URL đã xác nhận; nếu email sai miền thì tắt luồng gửi để sửa cấu hình, không quay lại lấy miền từ Host.

### SEC-03 — Phiên cũ sống tiếp sau thay đổi mật khẩu

**Vị trí:** `backend/src/accounts/accounts.service.ts:280`, `:293`; `backend/src/students/students.service.ts:44`, `:53`; `backend/src/auth/session.serializer.ts:11`; `backend/src/auth/auth.service.ts:75`.

Staff tự đổi mật khẩu chỉ cập nhật password/mustChangePassword/passwordChangedAt, không tăng sessionVersion. Trong khi reset bởi quản trị viên và revoke-sessions đã có cơ chế tăng version. Học viên dùng khóa `student:id` và không có version; cả resetPassword và updatePassword không thu hồi phiên cũ. Harness đã xác nhận đường cập nhật thiếu cơ chế thu hồi và lookup học viên vẫn thành công sau reset.

**Tác động:** người có cookie phiên bị đánh cắp tiếp tục truy cập sau khi chủ tài khoản đổi mật khẩu. Với mật khẩu Staff cấp tạm và `mustChangePassword`, phiên thứ hai mở trước lúc đổi mật khẩu cũng được mở khóa khi flag đổi thành false. TTL cookie hiện khoảng 8 giờ giới hạn thời gian nhưng không thay thế thu hồi.

**Khắc phục:** đổi mật khẩu phải vô hiệu hóa các phiên khác; có thể tăng sessionVersion và cấp lại khóa session cho phiên hiện tại sau khi đổi thành công. Bổ sung version cho học viên hoặc cơ chế xóa/revoke phiên theo user. Reset quên mật khẩu phải vô hiệu hóa toàn bộ phiên cũ. Xử lý chuyển tiếp khóa legacy của Staff không có version, hiện được `deserialize` chấp nhận.

**Xác minh:** dùng hai browser session, đổi/reset mật khẩu rồi phiên cũ phải bị từ chối; kiểm tra trường hợp bắt buộc đổi mật khẩu, học viên và khóa legacy. **Rollback:** migration tương thích và dự phòng đăng nhập lại; không hạ version để khôi phục phiên đã bị thu hồi.

### SEC-04 — Dependencies có advisory

| Lockfile | Critical | High | Moderate | Tổng package được npm đánh dấu |
|---|---:|---:|---:|---:|
| root | 0 | 3 | 0 | 3 |
| backend | 2 | 9 | 4 | 15 |
| frontend | 3 | 7 | 10 | 20 |
| backend, omit dev | 1 | 7 | 4 | 12 |
| frontend, omit dev | 1 | 6 | 9 | 16 |

Số trên là **package entries**, gồm cảnh báo lan truyền qua phụ thuộc; không phải số CVE độc lập và không cộng các hàng production vào tổng. Một dependency có thể xuất hiện ở nhiều lockfile. npm audit trả exit 1 vì có phát hiện, không phải lỗi chạy. Metadata chi tiết trong các file `audit-*.json`, phiên bản phân giải trong `inventory.json`.

Các điểm cần triage trước:

- Backend có `proxy-addr@2.0.7`, scanner Critical. Advisory [CVE-2026-90711](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) yêu cầu kiểu cấu hình trust subnet IPv6 cụ thể; ứng dụng hiện dùng `TRUST_PROXY` dạng số nên **chưa chứng minh có điều kiện khai thác advisory này**. Bản vá advisory: 2.0.8. Không gọi đây là Critical đã khai thác được trong dự án.
- `handlebars@4.7.9` bị scanner đánh Critical nhưng là dev dependency. Cần cập nhật toolchain và đánh giá đầu vào build; không suy diễn thành RCE production.
- Backend runtime có `body-parser`, `compression`, `multer`, `nodemailer`, `joi` bị đánh High. Body parser và compression được dùng trên HTTP; multer dùng ở upload có đăng nhập. Joi hiện xác thực cấu hình startup nên advisory cần đầu vào không tin cậy không mặc nhiên khai thác từ HTTP. Đọc từng advisory trước khi gán mức ảnh hưởng ứng dụng.
- Frontend có `axios@0.27.2`; audit đề xuất cập nhật major lên nhánh mới. Các advisory chỉ ảnh hưởng adapter Node không đồng nghĩa trình duyệt bị SSRF. Cần kiểm tra request/header/cookie behavior trong browser sau nâng cấp.
- `form-data@4.0.0` bị đánh Critical và nằm trong cây production theo metadata. [CVE-2025-7783](https://github.com/advisories/GHSA-fjxv-7rqg-78g4) liên quan boundary khi chạy Node; frontend browser thường dùng FormData native. Chưa chứng minh package Node này có đường chạy trong bundle trình duyệt.
- `vitest@3.2.7` và `tinypool@1.1.1` bị đánh Critical ở dev tree. [Advisory Vitest/@vitest/mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) riêng về đọc file được GitHub đánh Moderate và cần plugin/server mode cụ thể; không phải mọi test run đều bị khai thác. Không đánh đồng mức tổng hợp npm của package với mức của riêng advisory này.
- Root có cây React Router cũ bị đánh High. Frontend có lockfile riêng, vì vậy không suy diễn cây ở root chắc chắn được deploy.

**Khắc phục:** cập nhật từng nhóm trên nhánh riêng, bắt đầu runtime HTTP backend; chạy audit lại, test và build. Không chạy `npm audit fix --force` hàng loạt. Cố định cây bằng lockfile và `npm ci`; bổ sung audit ở CI. Ghi lại từng advisory có đường chạy hay không để ưu tiên.

**Giới hạn:** chưa enrich đầy đủ mọi CVE bằng EPSS/CISA KEV; trạng thái khai thác thực tế là **chưa đánh giá**, không phải “không có”. Chưa quét CVE các base image hay đưa ra kết luận dựa trên image tag.

**Xác minh/rollback:** audit phải giảm các finding mục tiêu, kiểm thử API và export/import tài liệu, build frontend/backend; rollback bằng manifest+lockfile đồng bộ từ commit trước, không giữ lẫn node_modules cũ.

### SEC-05 — OAuth thiếu state

**Vị trí:** `backend/src/auth/google.strategy.ts:9`, `backend/src/auth/auth.guards.ts:20`.

Strategy không truyền `state: true`; guard không bổ sung state. Khởi tạo strategy từ source trong harness xác nhận `_stateStore` là `NullStore`. Không có ràng buộc callback OAuth với phiên đã khởi tạo đăng nhập.

**Điều kiện/tác động:** chỉ áp dụng khi Google auth được cấu hình bật. Có nguy cơ login CSRF/session swapping khi kẻ tấn công đưa authorization response của tài khoản mình tới trình duyệt nạn nhân. Chưa thực hiện OAuth với Google thật. Kẻ tấn công vẫn cần tài khoản Staff được cấp quyền, do `validateGoogle` không tự tạo người dùng.

**Khắc phục:** bật state có lưu và kiểm chứng theo session; kiểm tra cookie/proxy/callback để state tồn tại qua redirect; cân nhắc PKCE nếu thư viện hỗ trợ đúng luồng. Bổ sung kiểm tra email được nhà cung cấp xác minh trước khi ánh xạ tài khoản là bước hardening riêng.

**Xác minh:** callback thiếu/sai/state dùng lại phải bị từ chối; callback của phiên A không hoàn thành ở phiên B. **Rollback:** có thể tạm tắt Google auth nếu rollout lỗi; không tắt kiểm chứng state để làm luồng chạy lại.

### SEC-06 — Local login thiếu chống login CSRF

**Vị trí:** `backend/src/auth/user.controller.ts:31`, `backend/src/auth/auth.guards.ts:7`, `backend/src/main.ts:29`.

`POST /user/login` chỉ có LocalAuthGuard, gọi logIn ngay sau xác thực. Ứng dụng nhận URL-encoded body; không kiểm Origin/Referer hoặc token CSRF cho login. LogoutOriginGuard hiện chỉ dùng cho logout.

**Tác động/điều kiện:** trang ngoài có thể submit form login bằng tài khoản của kẻ tấn công vào trình duyệt nạn nhân, tạo nhầm ngữ cảnh danh tính. CORS chặn đọc response, không chặn form submit; SameSite=Lax không tự ngăn việc tạo phiên đăng nhập mới khi chưa có cookie. Tác động cần nạn nhân tiếp tục thao tác mà không nhận ra tài khoản đang dùng. Đây là kết luận từ source, chưa kiểm chứng browser end-to-end.

**Khắc phục:** kiểm nguồn chính xác theo FRONTEND_URL cho local login hoặc dùng CSRF token gắn với pre-login session. Đánh giá các mutation khác theo mô hình cùng site và proxy thực tế; không khẳng định mọi endpoint đang khai thác CSRF được.

**Xác minh:** top-level cross-origin form và Origin null phải bị từ chối; login từ UI hợp lệ vẫn tạo/regenerate session. **Rollback:** kiểm thử client được hỗ trợ trước rollout; nếu lỗi cấu hình, điều chỉnh allowlist miền chính xác, không cho phép wildcard.

### SEC-07 — Học viên mất điều kiện đăng nhập vẫn giữ quyền qua phiên

**Vị trí:** `backend/src/auth/auth.service.ts:40`, `:77`; `backend/src/common/student.guard.ts:13`.

Login local yêu cầu `accountType=registered` và `approvalState=approved`. Deserialize học viên chỉ `findById(id)`; StudentGuard chỉ kiểm tra đã xác thực và đúng instance. Vì vậy thay đổi học viên về prospective/not approved không vô hiệu hóa phiên đã mở. Harness lookup một học viên không được duyệt vẫn trả user.

**Tác động:** người đã bị rút điều kiện tài khoản vẫn dùng các API tự phục vụ học viên cho đến khi hết phiên. Không suy diễn thành vượt permission Staff hay đọc chéo hồ sơ khác.

**Khắc phục:** áp cùng predicate trạng thái tài khoản ở deserialize hoặc guard dùng chung; phân biệt rõ trạng thái tuyển sinh với chính sách khóa đăng nhập nếu nghiệp vụ cần khác nhau.

**Xác minh:** đăng nhập hợp lệ, đổi trạng thái tài khoản rồi gọi profile/submit/upload phải bị từ chối theo chính sách; trường hợp học viên đang hoạt động vẫn dùng bình thường. **Rollback:** thống nhất chính sách trạng thái trước triển khai và migration dữ liệu; không bỏ check chỉ để né lỗi dữ liệu.

### SEC-08 — PostgreSQL SSL không xác minh chứng thư

**Vị trí:** `backend/src/database/database.module.ts:103`; cùng pattern trong `backend/src/database/seeds/import-dtvt-2025-subjects.cjs:22`, `clear-qlsx-to-core-subjects.cjs:19`.

Khi bật DATABASE_SSL, cấu hình dùng `rejectUnauthorized: false`. Có mã hóa nhưng không xác nhận chứng thư máy chủ.

**Điều kiện/tác động:** nếu kết nối DB qua mạng mà kẻ tấn công có thể chặn hoặc chuyển hướng, có nguy cơ giả mạo server và thu thập dữ liệu/credential. Compose local chưa bật SSL không chứng minh production hiện có MITM.

**Khắc phục:** xác minh chứng thư với CA tin cậy/cấu hình CA riêng và đúng hostname; áp dụng cả công cụ seed. **Xác minh:** DB có chứng thư hợp lệ kết nối được; chứng thư giả/sai hostname bị từ chối. **Rollback:** chuẩn bị CA và cơ chế đổi chứng thư, không dùng việc tắt xác minh làm trạng thái production lâu dài.

### SEC-09 — Upload tích lũy file và thiếu quota

**Vị trí:** `backend/src/common/uploads.ts:53`, `:63`, `:67`; `backend/src/students/students.service.ts:58`, `:67`.

Mỗi lần upload tạo tên theo timestamp và ghi disk. Khi đổi ảnh hoặc upsert lại submission, service chỉ thay tham chiếu DB, không xóa file cũ. Lỗi xử lý sau multer cũng không có cleanup. Có limit 5 MB/20 MB mỗi file và global rate limit 1.500 request/15 phút/IP, nhưng không có quota theo tài khoản hoặc tổng dung lượng.

**Tác động:** học viên đăng nhập có thể làm tích lũy tệp và đầy ổ đĩa, ảnh hưởng ứng dụng cùng host. Trần lý thuyết riêng submission gần 30 GB/15 phút/IP trước overhead nếu đủ băng thông; đây không phải kết quả load test.

**Khắc phục:** quota dung lượng/số tệp theo user, giới hạn riêng endpoint; dọn file thay thế và file upload khi giao dịch thất bại; giám sát disk. Chỉ tin extension/MIME phía client chưa xác thực nội dung: bổ sung magic-byte validation và quét tài liệu nếu luồng sử dụng cần. Chưa thấy route static trong bootstrap, nên không kết luận file public hiện truy cập ẩn danh được.

**Xác minh:** dùng file nhỏ trên thư mục test riêng, thay cùng submission nhiều lần và gây lỗi DB; chỉ file còn tham chiếu tồn tại, quota phải chặn trước khi ghi vượt giới hạn. **Rollback:** cleanup chỉ được xóa file đã chứng minh không còn tham chiếu; chạy dry-run và giữ đường khôi phục trước khi dọn dữ liệu thật.

## Các kiểm soát đã thấy và điểm chưa kết luận lỗi

- Session cookie HttpOnly, SameSite=Lax, secure mặc định theo production; secret bắt buộc tối thiểu 32 ký tự. Passport login đi qua cơ chế session của thư viện.
- Staff bị disabled hoặc có sessionVersion mới sẽ bị từ chối với khóa có version. Các test hiện có xác nhận hành vi này.
- Guard permission, kiểm tra Staff, DTO whitelist; các endpoint gradebook có permission động riêng. `@RequirePermissions()` rỗng ở workflow không bị tính là bypass khi đã có GradebookWorkflowGuard kiểm action.
- RLS migration 078 có vai trò NOBYPASSRLS, transaction-local scope, chính sách trên bảng nghiệp vụ và view security_invoker. Không kết luận superuser mặc định tự động bypass mọi truy vấn vì ứng dụng có SET LOCAL ROLE. Chưa chứng minh runtime trên PostgreSQL thật; cần chạy integration DB cô lập.
- Các truy vấn raw SQL đọc sâu ở báo cáo và điểm dùng replacements; chưa có bằng chứng SQL injection từ các sink được xem. Quét mẫu không thấy `dangerouslySetInnerHTML`/`innerHTML`/shell exec làm sink trực tiếp trong mã ứng dụng. Đây không phải cam kết không có injection ở toàn bộ logic.
- Serializer loại mật khẩu; audit có redaction khóa credential. Endpoint session lấy user đã deserialize, không mặc nhiên trả password hash. .env local không được Git track.
- Quét bốn định dạng key/token độ tin cậy cao trong tracked text <=2 MB không có match; **không đồng nghĩa không có secret**. Không quét brute force toàn history và không đưa credential vào báo cáo.

## Hardening, toolchain và vận hành

1. Chưa thấy workflow CI/SAST/secret scan trong các file được theo dõi. Bổ sung CodeQL hoặc Semgrep, secret scanning và npm audit; ưu tiên rule URL reset từ Host, SSL bỏ xác minh và mutation auth thiếu kiểm tra nguồn. Không tự nhận đã chạy Semgrep/CodeQL/Trivy. Branch protection và cấu hình scanner ngoài repo chưa được kiểm tra.
2. Frontend Nginx không có CSP/frame policy riêng. Helmet bảo vệ response backend, không tự gắn header cho HTML Nginx. Thiết kế CSP dựa trên font/image/export thực tế rồi rollout report-only; không gắn CSP cứng khiến app hỏng.
3. Vite dev/preview bind `0.0.0.0`, còn envDir đặt ở thư mục cha. Hạn chế tiếp cận môi trường dev, tránh dùng preview làm production. Chưa có bằng chứng public exposure; không quy thành rò .env đã xảy ra.
4. **Lỗi đóng gói, không tính vào 9 lỗ hổng:** `frontend/Dockerfile:8` chỉ copy public/src, không copy `vite.config.js` và index.html tại root; `:17` copy `/app/build` trong khi Vite mặc định ra dist. Cần đồng bộ Dockerfile với build Vite, rồi build image thật. Compose hiện chỉ khai báo db/pgadmin, không đủ bằng chứng Docker frontend này đang được dùng production.
5. Compose bind db/pgadmin về 127.0.0.1 là điểm tốt. pgAdmin chạy desktop mode/master password off chỉ phù hợp khi tiếp cận local được kiểm soát; không suy diễn thành console public. Backend Docker chạy USER node. Image tag không ghim digest; chưa quét image hoặc kiểm runtime capabilities/resources.
6. License inventory từ lockfile nằm trong inventory.json. Có nhiều entry thiếu license metadata (root 8/backend 49/frontend 189), không đồng nghĩa package không có giấy phép. Một entry `(MIT OR GPL-3.0-or-later)` là lựa chọn kép, không phải GPL bắt buộc. Chưa kết luận vi phạm giấy phép, package ngừng bảo trì hoặc tuổi của dependency.

## Kế hoạch xử lý và bàn giao

| Ưu tiên đề xuất | Công việc | Vai trò phụ trách đề xuất | Kiểm chứng |
|---|---|---|---|
| P1, trước public release | SEC-01 và SEC-02 | Chủ repo + backend + vận hành | Xác minh backup/nguồn dữ liệu; URL reset cố định |
| P1 | SEC-03, triage SEC-04 runtime | Backend + frontend | Hai phiên; audit/test/build sau từng nhóm upgrade |
| P2, sprint kế tiếp | SEC-05/06/07 | Backend + QA | OAuth callback replay, cross-origin form, thay trạng thái |
| P2 | SEC-08/09 | Backend + vận hành | CA trust, quota và cleanup ở môi trường test |
| P3 | CI/SAST, CSP, Docker build, SBOM chuẩn | Chủ repo + DevOps | Pipeline và image build đã kiểm chứng |

Đây là thứ tự đề xuất dựa trên bằng chứng hiện có, chưa phải SLA đã được tổ chức phê duyệt. Không có thay đổi mã ứng dụng, credential, lịch sử Git hoặc database trong lần rà soát này.

Phân loại theo Security Fixer Policy đã đọc: SEC-01 và SEC-02/03/05/06/07 liên quan dữ liệu nhạy cảm/xác thực/phân quyền cần review của chủ hệ thống trước áp dụng bản sửa; SEC-04 nâng major cần kiểm tra tương thích; SEC-08 cần cấu hình CA môi trường; SEC-09 cần kiểm tra vòng đời dữ liệu trước cleanup. Đây là yêu cầu khi thực hiện remediation, không phải bước chặn hoàn thành việc rà soát.

## Tái lập kết quả

Từ root:

```powershell
node security-review/inventory.cjs
node security-review/verify-findings.cjs
npm --prefix backend test -- --runTestsByPath test/unit/auth-session.spec.ts test/unit/permissions.guard.spec.ts test/unit/accounts.service.spec.ts test/unit/roles.service.spec.ts test/e2e/password-change-required.e2e-spec.ts
npm audit --json --package-lock-only
npm --prefix backend audit --json --package-lock-only
npm --prefix frontend audit --json --package-lock-only
npm --prefix backend audit --omit=dev --json --package-lock-only
npm --prefix frontend audit --omit=dev --json --package-lock-only
```

Harness là kiểm chứng source-level bằng mock, không thay thế e2e trình duyệt/DB. Nó in `CONFIRMED` khi tái hiện hành vi đang có; sau khi sửa đúng, assertion hiện tại cần đổi thành regression test mong đợi an toàn. Inventory script đọc lại các audit JSON đã lưu, không tự refresh advisory; chạy audit mới và lưu file trước nếu muốn cập nhật báo cáo.

Các artifact: `audit-root.json`, `audit-backend.json`, `audit-frontend.json`, `audit-backend-production.json`, `audit-frontend-production.json`, `api-inventory.json`, `inventory.json`, `secret-pattern-scan.json`, `security-tests.log`, `verification.log`. Chúng không chứa bản sao giá trị credential hoặc dữ liệu học viên.
