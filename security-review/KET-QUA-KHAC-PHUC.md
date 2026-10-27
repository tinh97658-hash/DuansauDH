# Kết quả khắc phục bảo mật — 27/10/2026

## Thay đổi đã thực hiện

| Phát hiện | Kết quả trong workspace |
|---|---|
| SEC-01 Backup trong Git | Đã bỏ archive và thư mục backup khỏi index, thêm ignore. File vật lý vẫn còn nguyên trên máy. Lịch sử commit cũ chưa bị viết lại. |
| SEC-02 Host poisoning | Email dùng FRONTEND_URL, không dùng Host/forwarded header. Thêm trang `/reset-password`, token trong fragment và được xóa khỏi thanh địa chỉ. |
| SEC-03 Phiên cũ | Staff tự đổi mật khẩu tăng session_version bằng SQL, đăng nhập lại phiên hiện tại để đổi SID. Học viên có version riêng; đổi/reset tăng version; khóa phiên legacy thiếu version bị từ chối. Reset token được tiêu thụ bằng update có điều kiện, chống dùng đồng thời. |
| SEC-04 Dependencies | Nâng cây phụ thuộc có kiểm thử, audit sau sửa báo 0 ở root/backend/frontend. Không ép downgrade ExcelJS để né audit; override uuid tương thích API sử dụng. |
| SEC-05 OAuth state | Bật state gắn session; test state sai, đúng và replay. |
| SEC-06 Login CSRF | Kiểm Origin trước LocalAuthGuard. Chặn origin thiếu, null hoặc miền khác. Client API đăng nhập trực tiếp cần gửi Origin khớp FRONTEND_URL. |
| SEC-07 Trạng thái học viên | Deserialize kiểm lại registered/approved và version trên mỗi request. |
| SEC-08 DB TLS | Bật xác minh chứng thư ở ứng dụng và hai công cụ seed; hỗ trợ PEM CA qua DATABASE_SSL_CA. |
| SEC-09 Upload | Parse memory có giới hạn trước khi ghi; giới hạn 4 upload đồng thời/process, một upload/tài khoản/process, rate limit riêng, kiểm signature, quota 160 MB/tài khoản, khóa PostgreSQL theo tài khoản để đồng bộ nhiều process; dọn tệp thay thế và tệp mới nếu giao dịch lỗi. |

Đồng thời sửa Dockerfile frontend cho Vite (`index.html`, config, thư mục `dist`, Node 22), thêm header bảo vệ HTML Nginx và workflow kiểm tra dependencies/tests/migration. React Router 7 được cấu hình `useTransitions={false}` để giữ cơ chế điều hướng đồng bộ trước đây; các test router dùng cùng cấu hình, không loại bỏ assertion nghiệp vụ.

## Migration và kiểm chứng

- Migration `080-student-session-version` đã áp dụng thành công trên database local cấu hình bởi `.env`. Chỉ migration này còn pending trước khi chạy. Không xóa hồ sơ học viên hay đổi mật khẩu người dùng thật.
- Cài đặt mới trên database dùng một lần đã phát hiện migration 078 tham chiếu bảng legacy `masters_bridge_courses` không tồn tại. Đã sửa để chỉ bỏ qua bảng legacy này khi vắng mặt; các bảng nghiệp vụ khác vẫn bắt buộc có RLS. Không thay RLS trên database đang chạy.
- Harness `verify-postgres.cjs` tạo database rỗng với tên ngẫu nhiên, chạy toàn bộ migration, kiểm chứng reset đồng thời, version Staff/Student, thu hồi phiên và vòng đời upload rồi tự xóa đúng database test đã tạo. Không sao chép dữ liệu thật.
- Regression HTTP dùng Passport/session thật kiểm hai trình duyệt: phiên đổi mật khẩu tiếp tục hoạt động với SID mới, phiên còn lại bị từ chối. Reset quên mật khẩu thu hồi tất cả phiên cũ.
- File `audit-after-*.json` là kết quả sau nâng dependencies. Các file `audit-root.json`, `audit-backend.json`, `audit-frontend.json` là snapshot trước sửa, giữ lại làm bằng chứng.
- `verify-findings.cjs` hiện chạy regression test; `verification.log` cũ ghi kết quả tái hiện trước sửa, không phải kết luận hiện tại.

Kết quả kiểm chứng:

| Kiểm tra | Kết quả |
|---|---|
| Backend toàn bộ | 71 suite đạt, **1.128 test đạt**; 12 suite/217 test phụ thuộc DB không bật trong lượt chạy này |
| Regression bảo mật sau chỉnh sửa cuối | 3 suite, **18/18 test đạt** |
| Frontend | **945 test đạt** trên 83 file: lượt toàn bộ 939 đạt/3 lỗi tương thích; chạy lại 2 suite liên quan đạt 24/24 sau chỉnh test, cộng 3/3 test reset mới. Không có lượt chạy lại toàn bộ sau sửa test. |
| PostgreSQL dùng một lần | Toàn bộ migration, token reset cạnh tranh, version thật, trạng thái duyệt và cleanup upload đều đạt |
| Dependency audit sau sửa | Root/backend/frontend: **0 vulnerabilities** theo npm audit tại thời điểm chạy |
| Build | TypeScript/backend, frontend Vite và hai Docker image đều build thành công |
| Nginx | `nginx -t` đạt trong image frontend |

Bằng chứng: `remediation-backend-tests.log`, `remediation-final-security-tests.log`, `frontend-verified-results.json`, `postgres-verification.log`, `audit-after-*.json`, `frontend-docker-build.log`, `backend-docker-build.log`, `nginx-verification.log`. Các test tương thích frontend sửa mock ResizeObserver thành constructor và truy vấn DOM tài liệu in với `hidden: true` trong JSDOM; không xóa ca kiểm thử hay bỏ kiểm tra nội dung tài liệu.

## Việc còn cần phối hợp khi triển khai

1. **Lịch sử Git vẫn chứa backup.** Thay đổi đã stage chỉ ngừng theo dõi ở commit tiếp theo; chưa có commit/push trong phiên này. Chủ repo cần xác định ai đã nhận bản sao, chuyển backup vào kho riêng, phối hợp làm sạch lịch sử/mirror/clone và thu hồi credential/phiên liên quan nếu còn hiệu lực. Không tự force-push hoặc xóa bản backup duy nhất.
2. Môi trường khác phải chạy migration 080 **trước** khi chạy backend mới. Người đang có phiên legacy sẽ phải đăng nhập lại. Không cần thay secret ký cookie để áp dụng version mới.
3. Với PostgreSQL SSL dùng CA riêng, cấu hình DATABASE_SSL_CA bằng nội dung PEM hợp lệ; chứng thư giả/sai hostname sẽ bị từ chối. Chưa có máy chủ TLS production để kiểm chuỗi CA thực tế.
4. Quota tính cả tệp cũ không còn tham chiếu, nhưng không tự xóa toàn bộ tệp lịch sử. Nếu tài khoản đã vượt quota, cần kiểm kê đối chiếu DB và dry-run trước khi dọn. Không thể bảo đảm atomic tuyệt đối giữa filesystem và DB khi process/host chết đúng thời điểm commit; cần lịch đối soát orphan trong vận hành.
5. Chưa đăng nhập Google thật và chưa gửi email SMTP thật. Cần smoke test cấu hình callback, cookie secure/proxy và URL frontend ở môi trường triển khai.
6. Workflow GitHub mới chưa chạy trên dịch vụ GitHub; không thay branch protection, không bật tính năng trả phí hoặc cài scanner toàn máy. Không có kết luận base image không còn CVE nếu chưa quét image.

## Phạm vi review và rollback

Các thay đổi xác thực/phân quyền, dữ liệu và triển khai được thực hiện theo yêu cầu khắc phục của người dùng. Không sửa các thay đổi có sẵn trong `.vscode/settings.json` hoặc hai file kết quả lifecycle đã bị xóa trước phiên này.

Review các file auth/accounts/students và migration trước triển khai. Rollback mã và manifest/lockfile phải theo cùng bộ thay đổi; cột version mới có thể giữ lại khi rollback để tránh thao tác schema phá hủy. Không hạ session version để khôi phục phiên đã thu hồi. Nếu cần khôi phục theo dõi backup trong index thì có thể stage lại file vật lý đang giữ local, nhưng không khuyến nghị đưa dữ liệu nhạy cảm trở lại repo. Không tự xóa local backup để làm Git sạch.

Không dùng `git reset --hard` hoặc `git restore .` để rollback cả workspace vì có thay đổi từ trước của người dùng. Các thay đổi hiện chưa được commit; giữ diff và chọn từng hunk khi revert.
