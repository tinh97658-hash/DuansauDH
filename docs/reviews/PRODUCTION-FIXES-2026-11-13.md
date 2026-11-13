# Khắc phục lỗi và bổ sung kiểm chứng trước production

Ngày cập nhật: 13/11/2026, Asia/Saigon. Tiếp nối [báo cáo rà soát](PRODUCTION-CODE-REVIEW-2026-11-12.md).

## Phạm vi đã xử lý

Thực hiện theo yêu cầu sửa ba lỗi cụ thể, bổ sung hồi quy và đưa các suite PostgreSQL vào CI. Không triển khai thêm các module còn thiếu, không triển khai lên production, không thay đổi dữ liệu nghiệp vụ. Giữ nguyên thay đổi README.md có sẵn của người dùng.

### Nhận xét: chặn thành công giả (REV-001)

- `DataController.review()` trả HTTP 501 với thông báo nhận xét chưa được gửi/lưu.
- Trang nhận xét hiển thị rõ chưa hỗ trợ, không cho nhập/gửi và không gọi API.
- Giữ nguyên các guard và quyền truy cập hiện có.
- Đây là biện pháp tạm khóa chức năng chưa hoàn thiện; chưa có cơ chế lưu/duyệt nhận xét mới.
- Test HTTP kiểm tra endpoint không báo thành công; test React kiểm tra thông báo, nút bị khóa và không có request ghi.

### Công nhận học phần: kiểm tra CTĐT khi duyệt (REV-002)

- Trong cùng transaction, giữ khóa điều phối học viên rồi khóa cấu trúc đào tạo theo thứ tự của hệ thống, khóa hồ sơ và xác định CTĐT áp dụng: ưu tiên CTĐT đã gán cho lớp; nếu chưa phân lớp, dùng CTĐT trong quyết định chuyển ngành đã duyệt; nếu không có quyết định đó, chỉ tự chọn khi phạm vi có đúng một CTĐT.
- Nếu có nhiều CTĐT và chưa xác định được CTĐT áp dụng, từ chối duyệt và yêu cầu phân lớp/chọn CTĐT.
- Kiểm tra CTĐT phù hợp chuyên ngành, bậc, khóa; kiểm tra môn đích thực sự thuộc CTĐT, kể cả môn không đổi so với đề xuất cũ.
- Giữ khả năng hội đồng chọn môn đích khác trong CTĐT hợp lệ. Vẫn cho phép từ chối đề xuất lỗi thời.
- Không tự sửa các quyết định đã chốt trước đây.
- Bổ sung kiểm thử đơn vị và PostgreSQL thật cho môn ngoài CTĐT, đề xuất lỗi thời, lớp theo CTĐT riêng, lựa chọn không rõ ràng và thay thế hợp lệ. Ca bị từ chối giữ nguyên trạng thái pending và môn đích cũ. Test đồng thời giữ khóa cấu trúc, xóa môn khỏi CTĐT rồi xác nhận duyệt phải chờ và từ chối sau khi giao dịch sửa CTĐT hoàn tất.

### Thanh toán hàng loạt: thống nhất tên dùng để tìm kiếm (REV-003)

- Danh sách/xem trước và câu SQL ghi cùng dùng một biểu thức tên lớp: tên riêng nếu có, nếu rỗng/NULL thì dùng tên môn học.
- Giữ nguyên kiểm tra phạm vi, phiên bản dữ liệu và rollback nguyên lô.
- Test PostgreSQL xác nhận xem trước rồi thanh toán thành công khi tên lớp NULL hoặc rỗng, tìm bằng tên môn; bản ghi ngoài bộ lọc giữ nguyên.

### CI: chạy test PostgreSQL thật, không bỏ qua ngầm (REV-005)

- Thêm job `postgres-integration` với PostgreSQL 16 dành riêng cho test.
- Lệnh `npm --prefix backend run test:postgres` tự tìm các suite integration dùng cờ `RUN_*`, hiện có 30 file: 29 file có sẵn và một file hồi quy CTĐT mới. Báo cáo ban đầu chỉ đếm 28 file mang hậu tố PostgreSQL, chưa tính file test migration chi tiết thanh toán.
- Mỗi suite dùng database mới do runner tạo, áp dụng migration đầy đủ, bật đúng cờ và xóa đúng database đã tạo sau khi chạy. Nếu tên database đã tồn tại, runner báo lỗi, không sử dụng hay xóa database đó.
- Kết nối quản trị phải được cung cấp tường minh qua `POSTGRES_TEST_ADMIN_URL`, trỏ tới server test loopback, user `pgsms_ci`, database `pgsms_ci_control`. Không dùng `.env` để tìm kết nối quản trị. Ghi đè các biến DB của tiến trình test và tắt SMTP/OAuth bên ngoài.
- Runner báo thất bại nếu một suite không có test đạt, có test skipped/todo hoặc tiến trình lỗi. Các suite còn lại vẫn được chạy để thu đủ lỗi độc lập.
- Notification dùng template có marker/owner theo cơ chế cô lập sẵn có. Các fixture cần admin được seed rõ ràng trên database test.
- Nâng thời hạn job kiểm chứng lên 45 phút; không tăng timeout từng test frontend trong mã nguồn.
- Kiểm tra bộ chạy bằng `node --test backend/test/postgres-runner.test.cjs`; đã kiểm tra cú pháp YAML của workflow.

## Các fixture cũ được cập nhật khi bật test database

Các thay đổi sau chỉ nằm trong test; không nới quyền hoặc đổi quy tắc của ứng dụng để làm test đạt:

- Tài khoản/vai trò: thêm module cha và quyền phụ thuộc; kiểm tra phải giữ một hồ sơ quản trị đầy đủ, không coi hợp của hai hồ sơ thiếu quyền là hồ sơ quản trị hợp lệ.
- Nhật ký và lịch học: cấp rõ quyền trang/module cho fixture HTTP để các test thực sự đi qua phân quyền phạm vi hiện tại.
- Thi: chạy thử up/down của migration 066 trong schema riêng, giữ nguyên schema hiện tại với các migration điểm danh/RLS mới hơn.
- Dùng khung giờ 08:00–12:00, 14:00–18:00 và mã lỗi tương ứng từng mốc; giữ độ chính xác điểm thành phần đã nhập, giữ tư cách thi đóng băng khi mở lại kết quả cuối.
- Dựng đủ danh sách thành viên trước khi lớp học phần đóng băng roster; vẫn kiểm tra đủ 1/10/40 thí sinh.
- Học lại: xác nhận danh sách dự thi và đọc lại revision mới trước khi lưu/chốt điểm.

## Kiểm chứng

- Backend build và typecheck đạt.
- Backend thông thường chạy lại ngày 13/11: 95 suite đạt, 1.448 test đạt. Các suite PostgreSQL được bỏ qua có chủ đích trong lệnh thông thường và được chạy bằng lệnh riêng ở trên. Sau khi bổ sung khóa cấu trúc, 46 test đơn vị/HTTP liên quan tiếp tục đạt.
- PostgreSQL: 30 suite, tổng 398 test đạt, không có test skipped/todo trong từng lượt kiểm chứng suite. Kết quả được tổng hợp từ các lượt chạy cô lập và chạy lại các suite đã sửa fixture, không phải một lượt toàn bộ duy nhất. Suite thi đạt 71/71; học lại 27/27; phân quyền lịch học 23/23; CTĐT/công nhận đạt 4/4.
- Bộ chạy database: 3 test an toàn/cấu hình đạt; workflow YAML hợp lệ.
- Các hồi quy nhận xét, CTĐT và thanh toán đã đạt, gồm kiểm chứng trên PostgreSQL thật cho hai lỗi nghiệp vụ.
- Frontend: lượt toàn bộ với 4 worker đạt 1.443/1.444 test, 134/135 file đạt; một ca tạo hồ sơ vượt timeout 25 giây khi máy đồng thời chạy nhiều bộ test. Chạy lại riêng chính ca đó với timeout giữ nguyên đã đạt (khoảng 7 giây cho test, 12,69 giây cả tiến trình). Như vậy mọi ca đều có kết quả đạt qua hai lượt; không coi lượt song song ban đầu là xanh. Không tăng timeout hoặc sửa logic ứng dụng để bỏ qua ca này. CI dùng 2 worker; vẫn cần xác nhận kết quả trên runner CI thực tế.
- Frontend build đạt; còn cảnh báo chunk lớn. Test frontend còn warning React act/jsdom CSS; một số fixture PostgreSQL còn warning query song song của pg. Các warning này được giữ trong log.

Log local (được gitignore): `.local/backend-review-final.log`, `.local/frontend-review-final.log`, `.local/frontend-review-timeout-rerun.log`, `.local/postgres-review-resume.log`, `.local/postgres-review-exam-final.log`, `.local/postgres-review-recognition-final.log`. Các lượt kiểm chứng trước có log `postgres-review-fixes-all.log`, `postgres-review-rerun.log`, `postgres-review-seeded.log`. Mỗi lượt PostgreSQL in đường dẫn JSON Jest trong thư mục tạm của hệ điều hành; các lượt đầu có lỗi fixture đã được sửa và chạy lại. Bảng tổng hợp 30 suite/398 test nằm ở `.local/production-fixes-postgres-verification.json` và tham chiếu JSON gốc của từng suite.

## Triển khai và rollback

- Không cần migration mới cho bản sửa này. Các migration được chạy trong lượt kiểm chứng chỉ áp dụng lên PostgreSQL test riêng.
- Trước phát hành cần CI chạy trên commit sẽ phát hành và kiểm thử staging với tài khoản/phạm vi thực tế. Chưa chạy GitHub Actions từ xa trong lượt này.
- Nếu cần rollback code: hoàn tác patch của các file ứng dụng, test và workflow trong bản sửa này; không hoàn tác toàn bộ working tree vì README.md có thay đổi riêng của người dùng. Không chạy `migrate down`, không xóa quyết định công nhận hoặc lịch sử thanh toán.
- Chức năng nhận xét chỉ được mở lại sau khi có lưu trữ và nghiệm thu đầy đủ. Hoàn tác bản khóa tạm sẽ khôi phục hành vi thành công giả nên không phù hợp làm phương án vận hành lâu dài.

Chưa kết luận toàn bộ hệ thống sẵn sàng production. Các module chưa triển khai (REV-004), kiểm thử tải/connection pool, kiểm tra header qua ingress, scan image và diễn tập restore/rollback vẫn nằm ngoài phần sửa này.
