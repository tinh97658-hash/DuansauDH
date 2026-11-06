# Notification V2 — triển khai

## Baseline và phạm vi

- Branch `feat/dashboard-v2`, HEAD `78d40afd5d94da066edc129c574499fee3c9acbf`.
- Khi bắt đầu: đã sửa OperationalDashboard JSX/CSS, lecturerPayments JSX/CSS, OperationalDashboard integration test; chưa track báo cáo layout, AdaptiveTaskList, DashboardColumns. Giữ nguyên tất cả; không commit/push/merge.
- Không sửa service workflow, RBAC/RLS nghiệp vụ hoặc Dashboard KPI/tab/biểu đồ.

## Giai đoạn 1 — Audit và thiết kế: DONE

- `NotificationService` hiện có chỉ gửi SMTP; `DashboardActivity` là lịch sử hoạt động, chưa phải inbox. `RibbonHeader` là header chung, chuông cũ chỉ render ở Dashboard.
- Điểm mới ghi `gradebook_events.action = final.submit/final.approve/final.reopen`; actor và before/after nằm trong transaction workflow. Bộ đọc activity cũ dùng result.* không đại diện cho inbox mới.
- Bảo lưu/gia hạn ghi history append-only có action/at/actorId; extensions riêng chỉ có tên người gửi nhưng history có ID.
- Chuyển ngành có requestedAt/decidedAt nhưng bản ghi không có ID người tạo. Audit `db_change_logs` hiện có trigger cho các bảng này, chứa ID duy nhất, old/new, actor_staff_id, actor_profile_id và changed_at. Đây là nguồn để xác định người gửi chính xác; không thêm hook/trigger nghiệp vụ.
- Module mới đọc các audit đã commit của `gradebook_events`, `study_leaves`, `major_transfers`; phân loại đúng sự kiện được ghi, không suy diễn từ snapshot hiện tại. Đối chiếu history prefix để chỉ nhận phần append. Không thông báo save điểm, sửa lịch/hồ sơ hoặc lượt xem.

## Ma trận sự kiện đã triển khai

| Sự kiện | Người nhận | Quyền/trang đích | Link |
| --- | --- | --- | --- |
| final.submit | Staff/profile được duyệt và thấy lớp qua RLS | gradebook.view + approve + route view/action | /masters/exam-lists?offeringId=…&groupId=…&year=… |
| final.approve | Người/profile gửi tương ứng, còn quyền xem | gradebook.view + route view + RLS | Bảng điểm gốc |
| final.reopen | Người gửi và profile duyệt còn quyền | Quyền xem/duyệt tương ứng + RLS | Bảng điểm gốc; nội dung là mở lại |
| requested/request_extension | Profile được xử lý bảo lưu | plan.view + studyleave.approve + route view/action + RLS | /masters/study-leaves/:recordId?tab=leave |
| approve/reject/approve_extension/reject_extension | Người/profile đã gửi yêu cầu tương ứng | plan.view + route view + RLS | Hồ sơ bảo lưu gốc |
| transfer pending INSERT | Profile duyệt chuyển ngành | admission.view + majortransfer.approve + route view/action + RLS | /plan/admission-records/:recordId?tab=profile |
| transfer pending→approved/rejected | Người/profile tạo từ audit INSERT | admission.view + route view + RLS | Hồ sơ gốc |

Recipient resolution dùng RbacService trong từng working profile, rồi chạy truy vấn bằng GroupScopeService với context giống trang đích. Không chọn theo tên role; không loại người gửi khỏi tập approver. Kiểm tra lại quyền/phạm vi mỗi lần list/count/read; tên đối tượng chỉ lấy sau khi truy vấn RLS thành công. Chỉ nhận source audit có staff/profile xác định, bỏ seed/import/system không có ngữ cảnh người dùng; không xác định được sender/profile thì không đoán người nhận kết quả.

## Lưu trữ và phục hồi

Migration Notification riêng: activation cutoff, processed audit receipts, event metadata, delivery theo staff/profile với read_at riêng. Unique source key và (event,staff,profile). Cutoff hiện là **ID audit đã cấp lúc kích hoạt**, lấy từ sequence (kể cả ID đã cấp nhưng chưa commit); `activated_at` chỉ là metadata. Chỉ quét ID lớn hơn ranh giới cố định này; không backfill inbox cũ. Receipt và delivery cùng transaction, advisory lock cho nhiều worker; **không nâng watermark sau mỗi batch**, nên không bỏ transaction mới commit muộn. Migration từ chối sequence không tăng từng 1, có cache khác 1 hoặc cycle; không tự sửa sequence nghiệp vụ. Không sửa bảng/trạng thái nghiệp vụ.

Gating triển khai: mặc định không bật worker/ghi Notification trên DB hiện tại. Chỉ bật NOTIFICATION_V2_ENABLED sau migration trong môi trường được phép. Lượt này không migration/seed/reset/ghi DB thật; test trên PostgreSQL container riêng hoặc mocks.

## Tiến độ

- Giai đoạn 2 backend: **DONE trong môi trường test** — storage/migration/worker/API/recipient resolution, đã kiểm thử HTTP và PostgreSQL RLS.
- Giai đoạn 3 frontend: **DONE trong môi trường test** — nối `NotificationBell` vào `RibbonHeader` trên mọi trang; giữ nguyên DashboardActivity là component lịch sử cũ, không dùng làm badge/inbox mới.
- Giai đoạn 4 kiểm thử/bàn giao: **PARTIAL** — build, automated tests và desktop/mobile đã đạt; nghiệm thu đăng nhập hai tài khoản thực chưa thực hiện.
- Lượt triển khai đầu áp dụng 106 migration (gồm 099 Notification) chỉ trên container `duansaudh-notification-v2-test`, database `notification_v2_test`, `127.0.0.1:55439`. Lượt rework dùng container mới cổng 55440 như phần cuối báo cáo. DB đang phục vụ ứng dụng không thay đổi.
- Kết quả lượt triển khai đầu (lịch sử): **22 test Notification** (13 source parser + 9 integration PostgreSQL/HTTP/RLS), **75 test nghiệp vụ hồi quy**, **60 test frontend/header/deep-link** đều PASS. Log hồi quy ban đầu có thêm 6 parser tại thời điểm chạy, tổng 81; parser sau đó được mở rộng và kiểm tra riêng trong nhóm Notification. Kết quả rework và kiểm tra độ ổn định mới nhất ở cuối báo cáo.
- Chưa kích hoạt module trên DB đang phục vụ người dùng; API ở môi trường chưa bật trả 503, UI hiển thị lỗi rõ, không hiển thị inbox rỗng giả.

## API và chính sách quyền

- GET `/notifications?page=1&pageSize=6`: items/total/unreadCount/page/pageSize.
- GET `/notifications/unread-count`: số chưa đọc sau khi lọc quyền/phạm vi hiện tại.
- POST `/notifications/:id/read`: cập nhật riêng read_at và trả link được kiểm tra lại tại thời điểm bấm.
- POST `/notifications/read-all`: chỉ cập nhật các delivery hiện còn được phép xem trong staff/profile hiện tại.
- Không nhận userId để chọn inbox. Session và working-profile middleware/guard xác định principal; header profile cũ bị từ chối. Bảng delivery có RLS staff/profile, chỉ cấp UPDATE(read_at) cho scoped role. Event API không lấy tên đối tượng từ payload lịch sử, chỉ đọc tên hiện tại sau khi vượt qua đúng business RLS của trang đích.
- Polling frontend 45 giây khi tab visible, cập nhật khi mở chuông/focus; abort và khóa response bằng identity/request token, dọn request/timer khi đổi profile/logout/unmount. Đây là polling, không phải realtime tức thời.

## File thêm/sửa trong lượt Notification

Backend:

- `backend/src/database/migrations/099-notification-inbox.ts`.
- `backend/src/notifications/inbox-events.ts`, `inbox-access.service.ts`, `inbox-sync.service.ts`, `inbox.service.ts`, `inbox.controller.ts`, `inbox.module.ts`.
- `backend/src/app.module.ts`: đăng ký module bổ sung; `backend/src/config/configuration.ts` và `.env.example`: flag mặc định false.
- `backend/test/unit/notification-events.spec.ts`, `backend/test/integration/notification-inbox-postgres.spec.ts`.

Frontend:

- `frontend/src/features/notifications/NotificationBell.jsx`, `useNotificationInbox.js`, `notifications.css`.
- `frontend/src/components/RibbonHeader.jsx`: thay chuông lịch sử bằng inbox thật, thêm chuông trên các trang dùng header chung; không đổi hamburger/tài khoản.
- `frontend/src/test/integration/NotificationInbox.test.jsx`.
- Báo cáo này. Các thay đổi Dashboard/lecturerPayments đã có từ baseline không thuộc lượt Notification và không bị ghi đè.

## Kết quả kiểm thử cụ thể

1. `npm --prefix backend run build`: PASS; `npm --prefix frontend run build`: PASS (1612 modules, 16,44s ở lần cuối). Frontend còn cảnh báo chunk lớn và static/dynamic import của classProgressReport có sẵn.
2. PostgreSQL riêng chạy toàn bộ 106 migration thành công. Flag test `RUN_NOTIFICATION_POSTGRES_TESTS=true`; URL test buộc đúng host 127.0.0.1, port 55439, database notification_v2_test, không có fallback tới `.env`.
3. `notification-events` + `notification-inbox-postgres`: **22 PASS**, 27,088s. Kiểm tra A submit-only, B/D approvers, C ngoài lớp; B nhiều profile; người vừa gửi vừa duyệt vẫn nhận; sender nhận approval/reopen đúng profile; read state riêng B/D; đọc lại/khởi tạo lại InboxService giữ dữ liệu; replay không trùng; sự kiện trước cutoff không backfill; transaction commit muộn không mất; bảo lưu/gia hạn và chuyển ngành từ audit; phân trang; mark-all; quyền/phụ trách bị thu hồi; HTTP 401/403/404/400; userId giả không chọn được inbox người khác; truy vấn delivery không có WHERE vẫn bị RLS giới hạn; source seed/system không có actor/profile không tạo notification.
4. Backend hồi quy: `gradebook-workflow-access`, `exam-eligibility-reopen`, `major-transfer.service`, `major-transfer-admission`, `study-leave-policy`, `study-leave-lookup`: **6 file, 75 PASS**. Lệnh lưu trong regression.log chạy kèm 6 parser khi đó, tổng **7 file, 81 PASS**; bộ parser mở rộng đã chạy riêng ở mục 3. Không sửa các service nghiệp vụ này.
5. Frontend: NotificationInbox, RibbonPermissions, RibbonLogout, DashboardScheduleLinks: **4 file, 60 PASS**, 13,75s. Có mở chuông không POST, click chỉ POST Notification, mark-all/refresh, loading/empty/error/retry, lỗi mark read không điều hướng, GET/POST cũ khi đổi profile bị bỏ, polling 45s/hidden/unmount, chuông ở trang khác, phân trang, link nội bộ và hủy điều hướng khi còn thay đổi chưa lưu.
6. Edge headless **8 trạng thái** tại desktop 1440×900 và mobile 390×844; đã quan sát ảnh. Session và Dashboard dùng fixture; API Notification được chuyển tới Nest HTTP harness dùng **PostgreSQL tạm thật** tại 3304. Mở chuông giữ unread count; POST read-all duy nhất làm badge về 0; refresh giữ read state; Dashboard Chờ phê duyệt vẫn 15/1/1. Chuông còn hoạt động trên trang Cài đặt giao diện. Popup nằm dưới chuông, không tràn ngang. Empty/error UI được mô phỏng ở lớp network, không ghi sự kiện giả vào database ứng dụng.
7. Không lỗi runtime trong lượt browser đạt; request ghi chỉ `/notifications/read-all`, không gọi API gửi/duyệt nghiệp vụ. `git diff --check`: PASS. Backend đang chạy vẫn health ready, Notification không đăng nhập trả 401.

Artifact local (không commit): [DB tests](../.tmp/notification-v2/postgres-final.log), [hồi quy backend](../.tmp/notification-v2/regression.log), [frontend tests](../.tmp/notification-v2/frontend-tests-final.log), [backend build](../.tmp/notification-v2/backend-build.log), [frontend build](../.tmp/notification-v2/frontend-build-final.log), [browser audit](../.tmp/notification-v2/browser-audit.json).

Ảnh: [desktop chưa đọc](../.tmp/notification-v2/screenshots/desktop-populated.png), [đã đọc tất cả](../.tmp/notification-v2/screenshots/desktop-all-read.png), [refresh giữ read state](../.tmp/notification-v2/screenshots/desktop-refresh-read-persisted.png), [mobile/header trang khác](../.tmp/notification-v2/screenshots/mobile-common-header.png), [lỗi tải](../.tmp/notification-v2/screenshots/mobile-error.png), [empty](../.tmp/notification-v2/screenshots/mobile-empty.png).

## Giới hạn và phần chưa kích hoạt

- **Trạng thái tổng: PARTIAL ở môi trường đang phục vụ người dùng.** Migration/worker chưa bật trên DB này vì yêu cầu cấm migration/seed/ghi DB thật. Không tạo notification thực vào đó; UI khi chưa kích hoạt hiển thị lỗi 503 rõ ràng, không badge hay inbox rỗng giả. `.env` thật không sửa.
- Nguồn dữ liệu thiếu actor/profile chính xác: **BLOCKED cho event của riêng bản ghi đó**; seed/import/system không có ngữ cảnh staff/profile không được tự tạo inbox. Thiếu audit request gốc thì **BLOCKED delivery kết quả tới sender**, không đoán theo tên, email hoặc tất cả admin. Cần giữ audit từ thời điểm tạo yêu cầu; nếu dữ liệu cũ không có thì tích hợp bổ sung phải được xem xét riêng. Không thêm trigger/hook nghiệp vụ.
- Lớp không có liên kết nhóm để tạo `groupId` hợp lệ không được phát link bảng điểm đoán. Chưa bổ sung cách điều hướng cho dữ liệu legacy này.
- Cutoff sau rework là `db_change_logs.id > activated_after_change_id` tại migration 099, không dùng timestamp để quyết định nhận sự kiện. ID đã cấp trước kích hoạt thuộc lịch sử kể cả khi commit muộn; ID mới sau ranh giới cố định vẫn được nhận khi commit muộn. `changed_at` tiếp tục dùng làm thời gian sự kiện, không sửa audit. Không reset/reseed sequence journal.
- Không backfill lịch sử mặc định. Không bổ sung inbox route riêng, push/SSE, email Notification mới, retention hay xóa notification. Bảng event chỉ lưu metadata/title chung, nhãn đối tượng được dựng sau kiểm tra RLS hiện tại.
- Read/count hiện lọc quyền trước phân trang bằng quét delivery theo batch 500 và cache target trong request; đúng số đếm nhưng chi phí tăng khi inbox rất lớn. Trước khi dùng ở quy mô lớn cần đo tải và thiết kế retention/SQL lọc quyền tối ưu, không cắt tổng số để giả count.
- Worker tối đa 100 audit mỗi lượt 45 giây, giữ receipt/delivery cùng transaction. Cần giữ audit nguồn đủ lâu và theo dõi log `Notification sync failed`; khi lỗi transaction rollback, lượt sau thử lại. Không khẳng định realtime tức thời.
- Kiểm thử Notification dùng source DB fixtures và phương thức ghi gradebook event thật, cùng trigger audit/RLS hiện có. Chưa E2E đăng nhập Passport bằng hai tài khoản người dùng thực rồi thao tác đầy đủ các form gửi/duyệt; unit hồi quy bảo vệ các workflow hiện tại. F11 thủ công chưa nghiệm thu.

## Nghiệm thu thủ công hai tài khoản trên development/test được phép

1. Chỉ dùng database development/test đã được cho phép ghi; chuẩn bị dữ liệu baseline trước migration 099, áp dụng 099 bằng quy trình migration sẵn có, sau đó bật `NOTIFICATION_V2_ENABLED=true` và khởi động backend. Không chạy các bước này mặc định trên DB hiện tại. Ranh giới ID được chụp khi migration, không phải khi bật flag; chỉ tắt flag không loại các audit có staff/profile phát sinh sau ranh giới khỏi backlog.
2. Chuẩn bị A có profile gửi điểm + quyền trang bảng điểm; B có profile duyệt + quyền trang + trách nhiệm lớp hợp lệ. Chuẩn bị lớp có đủ dữ liệu để gửi theo workflow hiện có. Không mở rộng quyền để vượt scope chỉ vì Notification.
3. A gửi duyệt thật, chờ worker tối đa khoảng 45 giây cộng thời gian xử lý, mở chuông B: có notification mới và link đúng bảng điểm. A chỉ có quyền gửi không nhận dưới tư cách approver; B profile khác không có quyền duyệt không thấy inbox của profile duyệt.
4. Mở chuông B không giảm badge. Đọc một notification chỉ đổi read state; số yêu cầu chờ duyệt Dashboard giữ nguyên. Refresh/đăng nhập lại giữ read state.
5. B duyệt thật: A nhận kết quả trên đúng profile gửi nếu còn quyền xem. B có cả submit/approve được phép gửi và tự duyệt; Notification không thêm quy tắc cấm tự duyệt. Mở lại phải hiển thị “đã được mở lại”, không coi là approval mới.
6. Tạo và xử lý bảo lưu/gia hạn/chuyển ngành theo form hiện có; kiểm tra approver nhận yêu cầu và sender nhận đúng quyết định. Click mở đúng record và tab được hỗ trợ.
7. Thu hồi quyền/phạm vi trên môi trường test rồi tải lại: API list/count/read không trả tên đối tượng hoặc cho mở trái quyền. Thử profile khác, ID người khác, read-all riêng từng profile; lỗi API phải hiện retry, không thành empty.

## Nếu tiếp tục ở phiên sau

- Đọc Git baseline và báo cáo này, giữ các thay đổi chưa commit; không chạy lại seed/migrate vào DB đang dùng.
- Mã và tests đã có, không cần làm lại UI/header hoặc workflow. Container test `duansaudh-notification-v2-test` là môi trường tách biệt; script `.tmp/notification-v2-migrate.cjs` hardcode URL test, tests cũng kiểm tra URL an toàn.
- Bước còn lại để nghiệm thu live là triển khai migration/flag trên DB development được phép, chuẩn bị hai tài khoản đăng nhập thật và chạy checklist trên. Chỉ đánh dấu DONE toàn hệ thống sau bước đó.
- Nếu cần hỗ trợ sender lịch sử thiếu actor/profile hoặc lớp thiếu groupId, ghi yêu cầu tích hợp riêng, không tự sửa workflow/RLS hoặc tạo notification giả.
- Kết thúc lượt làm việc: HTTP harness 3304 đã dừng; container test đã dừng và giữ lại dữ liệu để xem xét. Frontend 3100/backend 3001 và database đang phục vụ người dùng vẫn giữ nguyên môi trường chạy.

## Preflight kích hoạt an toàn — 2026-11-06

- Backend PID 6896 chạy `backend/dist/main`, có kết nối TCP tới PostgreSQL local 55432; frontend 3100 và backend `/health/ready` trả HTTP 200. `.env` trỏ `127.0.0.1:55432/pgsms_nt3_import_20261104`; truy vấn PostgreSQL chỉ đọc xác nhận đúng tên database. Không xuất credentials hoặc connection string.
- Phân loại: **database local nhập từ bản sao dữ liệu, chưa xác nhận là development được phép ghi**. Preflight import cũ ghi nguồn `pgsms`, 80 bảng / 8.696 dòng. Localhost và NODE_ENV mặc định development không chứng minh dữ liệu là giả hoặc được phép thay đổi. Vì vậy **BLOCKED triển khai trên database đang dùng**, chờ người dùng xác nhận phạm vi.
- Chỉ thực hiện `BEGIN READ ONLY`/SELECT/ROLLBACK trên database này. Ledger chính `sequelize_meta` có 100 mục; ledger cũ `SequelizeMeta` có 5 mục. Theo ledger chính, 099 chưa chạy, bốn bảng notification chưa tồn tại. 072/073 đã có trong ledger cũ; còn các mục chưa có ở ledger chính: 081-unique-learner-codes, 088, 089, 098-training-years và 099. Không tự sửa ledger hoặc chạy `db:migrate` tổng vì có thể chạy các thay đổi nghiệp vụ ngoài phạm vi.
- Migration 099 được đọc lại: transaction tạo bốn bảng notification, hai index, grants/policies chỉ trên bảng mới; ghi một dòng cutoff, không backfill sự kiện. FK tham chiếu staff/roles; không sửa schema/dữ liệu nghiệp vụ hoặc trigger hiện có. `down` xóa toàn bộ dữ liệu notification, không dùng tùy tiện để phục hồi. Sau khi được phép, triển khai riêng migration 099 và ghi ledger đúng một lần theo mẫu rollout chọn migration hiện có.
- Có backup cũ `.tmp/import-exports-20261104/local-before-import.dump` (1.124.685 bytes, ngày 04/11), nhưng đây là backup trước import, **không chứng minh phục hồi được database đang dùng hiện nay**. Máy có pg_dump/pg_restore. Chưa tạo backup mới/chưa thử restore bản hiện tại; trước triển khai cần dump custom của đúng DB, restore thử sang DB riêng rồi đối soát schema/row counts và kiểm tra hoàn tất không lỗi. Quy trình rollout hiện có: `backend/scripts/rollout-scheduling-scopes.cjs` (không chạy script này vì nó dành cho migration 082–084).
- Không sửa `.env`, không bật flag, không restart backend để bật worker. `.env` không đặt flag; schema cấu hình mặc định false. Chuông trên 3100 **chưa hoạt động**; không coi HTTP 200 health hay HTTP 401 của API chưa đăng nhập là nghiệm thu Notification.
- Đã khởi động lại container riêng `duansaudh-notification-v2-test`, database `notification_v2_test` trên 127.0.0.1:55439; truy vấn chỉ đọc xác nhận migration 099 và đủ bốn bảng từ lượt kiểm thử trước. Không sao chép dữ liệu của database đang dùng sang container test. Môi trường này dành riêng dữ liệu fixture; chưa chuyển backend 3001/frontend 3100 sang đó.
- Bằng chứng: `.tmp/notification-v2-activation/preflight.json`, `test-database.json`, `test.log`. Preflight ghi trạng thái database tại thời điểm kiểm tra; không phải chứng nhận được phép ghi.
- Chạy lại hai suite Notification trên container test đang giữ fixture cũ: **15/22 PASS, 7 FAIL**, 43,732 giây. Parser 13/13 PASS; PostgreSQL 2/9 PASS. Ca gửi duyệt đầu tiên timeout 5 giây; các ca sau có thiếu delivery, lệch count và timeout. Có dữ liệu fixture tích lũy trong DB test; chưa kết luận nguyên nhân gốc là timeout, fixture hay worker. Không đổi timeout/assertion, không sửa logic nghiệp vụ để làm xanh kết quả. Lượt này **chưa chứng minh được trọn luồng gửi → nhận → đọc → duyệt → nhận kết quả**. Cần cô lập fixture và điều tra riêng trước khi cho phép kích hoạt; kết quả PASS trước đây không thay thế kết quả lần chạy này. Container test được giữ chạy để kiểm tra tiếp, không mở backend/harness riêng hoặc chuyển app đang dùng sang nó.
- Cần phê duyệt cụ thể: xác nhận `pgsms_nt3_import_20261104` là DB dev được phép backup/restore thử và áp dụng **riêng 099**, rồi bật worker và tạo dữ liệu test hợp lệ; hoặc chọn chuyển sang database dev riêng (cần chuẩn bị tài khoản/dữ liệu test và xác nhận việc chuyển kết nối). Chưa thực hiện luồng form gửi duyệt/đọc/duyệt trên database đang phục vụ người dùng.

## Rework 7 lỗi — database test sạch, 2026-11-06

Quyết định người dùng: tiếp tục **chỉ trong test riêng**. Chưa cho phép migration, bật flag hoặc chuyển backend 3001 sang DB khác. Những kết quả PASS ở lượt triển khai đầu phía trên là lịch sử; kết quả rework cuối mục này mới quyết định mức sẵn sàng hiện tại.

### Nguyên nhân và bằng chứng

- **Fixture tồn đọng + phụ thuộc thứ tự test:** suite cũ dùng `beforeAll`, thêm UUID mới mỗi lần chạy nhưng không dọn fixture. DB cũ có 31 staff active, 30 role, 72 event, 205 delivery. Diagnostic replay 7 audit trong transaction rollback: **16.441ms**, 241 lần kiểm tra target/effectiveAccess, 862 query trên connection kiểm tra quyền (~14.948ms tổng; query dài nhất ~148ms), 31 lần lấy profile (~439ms). Không thấy wait event loại Lock trong các mẫu 1 giây. Đây là chi phí nhiều kiểm tra tuần tự, không phải một truy vấn bị treo. Số event/delivery/receipt/cutoff trước và sau diagnostic hoàn toàn bằng nhau. Artifact: [đo worker cũ](../.tmp/notification-v2-activation/old-database-diagnostic.json).
- **Lỗi thật của Notification, độc lập timeout:** sau khi đã tách DB sạch, vẫn bắt được audit ID 561/562 có `changed_at` 10:15:09.027/09.075Z trong khi cutoff được tạo trước đó theo thứ tự thao tác là 10:15:10.498Z. Đồng hồ PostgreSQL/VM lùi khoảng **1,47 giây**; chưa xác định tác nhân điều chỉnh đồng hồ của host/VM. Worker kết thúc trong 25/16ms, không tạo event/receipt/delivery, trong khi cùng principal D truy vấn target thành công. Điều kiện timestamp cũ bỏ sót dữ kiện mới. Artifact [snapshot lỗi độc lập](../.tmp/notification-v2-activation/clock-regression-evidence.json).
- Test mô phỏng chỉ chỉnh timestamp **metadata Notification** sang tương lai, không sửa audit hoặc dữ liệu nghiệp vụ, tái hiện xác định: code cũ **FAIL, expected 1 / actual 0** ([red log](../.tmp/notification-v2-activation/clock-red.log)). Code mới dùng ranh giới journal ID vượt qua test này; test riêng kiểm tra ID đã cấp trước kích hoạt nhưng commit sau vẫn bị loại, và ca commit muộn sau kích hoạt vẫn nhận đủ.

| Test FAIL trong log gốc 15/22 | Quan sát / phân loại |
| --- | --- |
| delivers submitted grades… | Timeout 5s: worker xét fixture nhân sự/profile tích lũy. Cần DB sạch, không tăng timeout. |
| persists read state independently… | `items[0]` undefined; phụ thuộc hai lần gửi ở test đầu vốn chưa hoàn tất. Dây chuyền, không chứng minh lỗi lưu read state. |
| replays safely and sends approval/reopen… | 168→170: phép đo trước/sau xen với worker chưa hoàn tất sau timeout; không phải bằng chứng delivery trùng. Cần kiểm chứng replay riêng với fixture đã ổn định và unique constraints. |
| captures leave and extension… | Timeout 5s khi chờ worker nhiều người nhận; tác vụ async không bị Jest hủy, tiếp tục ảnh hưởng ca sau. |
| correlates transfer sender… | Chưa thấy `transfer.requested` sau sync; suite đang có worker cũ chạy, `sync()` coalesce promise của lượt đã lấy batch trước khi nguồn mới được ghi. Dây chuyền cần loại bằng cô lập. |
| enforces HTTP auth… | Timeout 5s trong chuỗi kiểm tra HTTP; log gốc không có timing từng request để kết luận request cụ thể. Sau cô lập đã kiểm lại đầy đủ 401/403/404/400, đọc đúng principal và userId giả. |
| does not lose a source transaction… | Timeout 5s qua nhiều lượt worker; cần kiểm tra commit muộn riêng trên DB sạch. Cũng phát hiện lỗi cutoff clock độc lập khi chạy riêng, không quy tất cả lỗi cho fixture. |

Hook `afterAll` cũ cũng timeout khi phải chờ worker còn chạy. Các lỗi timeout không có nghĩa Jest đã hủy công việc async; vì vậy không dùng kết quả các ca sau để kết luận độc lập trước khi cô lập.

### Sửa đúng phạm vi

- `backend/src/database/migrations/099-notification-inbox.ts`: thêm `activated_after_change_id`, chụp sequence đã cấp tại kích hoạt; giữ `activated_at` metadata. Kiểm tra điều kiện sequence, fail closed nếu không phù hợp. **099 chưa triển khai trên DB ứng dụng**, nên sửa migration mới này; không sửa migration nghiệp vụ khác. Schema test 099 cũ tại cổng 55439 không tương thích worker mới và chỉ giữ làm chứng cứ, không bật app vào đó.
- `backend/src/notifications/inbox-sync.service.ts`: lọc theo ID sau ranh giới **cố định**, vẫn dùng receipt/transaction/unique key. Không biến thành advancing cursor làm mất commit muộn; không sửa recipient, RBAC/RLS, dữ liệu hoặc handler workflow.
- `backend/test/helpers/prepare-notification-postgres.cjs`: chỉ chấp nhận container tên `duansaudh-notification-v2-clean-20261106`, image postgres:16-alpine, label `codex.purpose=notification-v2-isolated-tests`, bind 127.0.0.1:55440. Không đọc `.env`. Có lệnh tái tạo riêng schema template khi đã xác minh marker, không staff/event/delivery và không case DB tồn tại; từ chối nếu có dữ liệu.
- `backend/test/helpers/notification-database.ts`: chỉ nhận URL template ở cổng 55440, đúng owner/marker; tạo database UUID mới cho **từng test**, không chỉ từng suite. Teardown chỉ drop đúng DB vừa cấp, sau khi drain worker và đóng HTTP/pools; không force ngắt kết nối khác.
- `backend/test/integration/notification-inbox-postgres.spec.ts`: kiểm tra baseline trống mỗi ca, tự chuẩn bị fixture, không phụ thuộc test trước. Các ca cần hai yêu cầu đã gửi có fixture riêng, kiểm chứng cả B và D đều nhận 2. Tách ca gộp replay+kết quả thành hai ca độc lập, giữ mọi assertion cũ và thêm kiểm tra số event khi replay. Thêm regression clock rollback và ID cũ commit sau kích hoạt. Ghi timing fixture/test/worker/query và snapshot nguồn/receipt/delivery khi đặt `NOTIFICATION_TEST_TRACE_DIR`.
- `backend/test/unit/notification-database-guard.spec.ts`: 6 ca từ chối thiếu URL, database ứng dụng/port 55432, DB fixture cũ 55439, sai DB trên port test, host khác và owner khác trước kết nối.
- **Không tăng timeout**, không giảm assertion, không sửa expected count cũ, không nới quyền hoặc sửa nghiệp vụ. Hai ca replay/kết quả được tách vì đo được ~2.017ms replay + 365ms quyết định + 1.814ms batch kết quả, cộng writes/list vượt 5s; đây là các hành vi độc lập, không cần gộp cùng ngân sách thời gian.

### Database và cách chạy

- Container mới chỉ dành Notification: `duansaudh-notification-v2-clean-20261106`, cổng **55440**, volume riêng. Template `notification_v2_template` chỉ có schema và danh mục do 106 migration tạo; không có staff/dữ liệu nghiệp vụ người dùng, event/delivery/receipt.
- Chuẩn bị: `npm --prefix backend run build`, rồi `node backend/test/helpers/prepare-notification-postgres.cjs` trên container mới rỗng đã xác minh. Muốn cập nhật schema test: thêm `--recreate-empty-template`; các guard trên phải đạt. Log [template cuối](../.tmp/notification-v2-activation/final-template.log).
- Chạy Jest với `RUN_NOTIFICATION_POSTGRES_TESTS=true`, `NOTIFICATION_TEST_DATABASE_URL` trỏ **template đúng host/port/db/owner trên**; mật khẩu test lấy từ cấu hình container test, không dùng `.env`. Command: `node backend/node_modules/jest/bin/jest.js --config backend/test/jest.config.cjs --runInBand backend/test/unit/notification-events.spec.ts backend/test/unit/notification-database-guard.spec.ts backend/test/integration/notification-inbox-postgres.spec.ts`. Chạy từng ca bằng `-t '<tên test>'`; không có skip mặc định trong các lượt nghiệm thu đã bật cờ.

### Các lượt kiểm chứng

1. Log gốc: 15/22 PASS, 7 FAIL, hook cleanup timeout.
2. Tách DB từng ca nhưng còn cutoff cũ và fixture Arrange trong thân test: 5/9 chạy riêng PASS; phát hiện ca worker không nhận audit vì clock rollback. Lặp riêng HTTP+commit muộn 3 lượt có lúc PASS, xác nhận tính không ổn định của cutoff timestamp thay vì coi một lượt xanh là đủ.
3. Chuyển Arrange vào fixture: 8/9 PASS riêng; snapshot bắt được clock rollback 1,47s. Đã lưu evidence, không ghi đè log gốc.
4. Regression clock trên code cũ: FAIL có chủ đích, 0 thay vì 1 notification. Sau sửa sequence cutoff: regression clock và pre-activation uncommitted đều PASS riêng. Lượt 11 ca: 10 PASS, 1 ca gộp replay+kết quả timeout; đã tách hai trách nhiệm với nguyên assertions và timing nêu trên.
5. Sau tách replay: **12/12 PASS khi chạy từng ca**; thân test dài nhất 4.409ms, worker dài nhất 2.082ms. [Tóm tắt timing](../.tmp/notification-v2-activation/individual-summary.json).
6. Hai lượt toàn bộ sơ bộ: backend **30/31 rồi 31/31**, frontend **15/15 cả hai**. Lượt đầu ca gộp chuyển ngành/phân trang/mark-all vượt 5s (test body 5.019ms; các lượt worker 1.451 + 280 + 1.086ms, cộng nhiều read/list). Lượt sau xanh chưa đủ coi là ổn định. Đã tách kiểm tra chuyển ngành và kiểm tra phân trang/read-all thành hai ca, giữ expected page 2 / pageSize 2 / 2 dòng và read state A/B; thêm assertion A có unread thật trước read-all, B giữ nguyên số unread sau A đọc. Fixture phân trang dùng yêu cầu thực trên test DB, không kế thừa dữ liệu ca khác.
7. Hai ca chuyển ngành và phân trang/read-all sau tách **2/2 PASS riêng**. Kết hợp 11 ca không đổi đã PASS riêng, toàn bộ **13/13 integration hiện tại đã được chạy riêng**, không test nào phụ thuộc test trước. [Kết quả từng ca](../.tmp/notification-v2-activation/final-individual-results.json).
8. **Hai lượt toàn bộ cuối trên cùng mã nguồn đều PASS**, mỗi integration test có database UUID mới, không skip:

| Lượt cuối | Backend Notification | Frontend Notification | Thời gian |
| --- | --- | --- | --- |
| 1 | **32/32**, 0 FAIL, 0 pending | **15/15**, 0 FAIL, 0 pending | Backend 85,416s; frontend ~18,55s |
| 2 độc lập | **32/32**, 0 FAIL, 0 pending | **15/15**, 0 FAIL, 0 pending | Backend 76,888s; frontend ~16,07s |

Backend gồm 13 parser + 6 guard môi trường + 13 integration PostgreSQL/HTTP/RLS. Số test tăng từ 22 lên 32 do thêm guard, 2 regression cutoff và tách 2 ca gộp; không bỏ assertion cũ. Thân integration test chậm nhất ở hai lượt cuối là **4.271ms / 3.732ms**, dưới timeout 5.000ms; worker dài nhất 2.206ms / 1.827ms. Fixture tổng dài nhất 6.550ms / 5.647ms, được ghi riêng, bao gồm các hook Arrange kế thừa; hook setup schema giữ ngân sách 60s từ setup cũ, không tăng timeout thân test hoặc dùng timeout mới để bỏ qua lỗi.

Artifacts cuối: [summary](../.tmp/notification-v2-activation/stability-final/summary.json), [backend lượt 1](../.tmp/notification-v2-activation/stability-final/backend-1.log), [backend lượt 2](../.tmp/notification-v2-activation/stability-final/backend-2.log), [frontend lượt 1](../.tmp/notification-v2-activation/stability-final/frontend-1.log), [frontend lượt 2](../.tmp/notification-v2-activation/stability-final/frontend-2.log). Các JSON report cùng tên và thư mục `timings-1`, `timings-2` lưu kết quả từng assertion/test, fixture, worker, query và snapshot audit/receipt/delivery.

Backend build và `git diff --check` PASS. Không chạy toàn bộ test suite nghiệp vụ vì không sửa các service đó. Không phát hiện lỗi quyền/RLS/read state/idempotency trong các ca đã chạy. Test dùng Nest HTTP harness/principal fixture và audit thật trên PostgreSQL test, **chưa phải nghiệm thu đăng nhập và thao tác toàn bộ form bằng hai tài khoản thật**.

### Trạng thái kết thúc và bàn giao

- **READY FOR ACTIVATION về điều kiện kiểm thử tự động / sẵn sàng bước chọn môi trường để nghiệm thu.** Không còn test FAIL trong bộ Notification hiện tại qua hai lượt độc lập; không có lỗi bảo mật đã phát hiện còn mở trong phạm vi kiểm chứng này.
- [Kiểm tra cô lập cuối](../.tmp/notification-v2-activation/final-isolation.json): template cổng 55440 có 106 migration, **0 staff, 0 event, 0 delivery, 0 receipt, 0 case database còn lại**. Container test mới giữ chạy với schema template để có thể chạy lại; từng case DB đã được dọn sau khi đóng kết nối. Container test cũ 55439 giữ dữ liệu chẩn đoán và schema 099 cũ, không dùng cho worker mới.
- SHA-256 `.env` trước/sau sửa bằng nhau. **Không kết nối hoặc ghi DB ứng dụng cổng 55432 trong lượt rework này; không migration 099, không bật `NOTIFICATION_V2_ENABLED`, không chuyển backend 3001.** Chuông localhost:3100 vẫn chưa kích hoạt trên DB đang dùng.
- Không sửa Dashboard/UI, RBAC/RLS nghiệp vụ, service điểm/bảo lưu/chuyển ngành hay migration nghiệp vụ khác. Không commit/push/merge.
- Còn **BLOCKED theo quyết định người dùng**: chọn database được phép kích hoạt, backup mới và kiểm chứng restore, triển khai migration/flag rồi nghiệm thu live hai tài khoản. Các bước đó dành cho lượt tiếp theo; kết thúc lượt này ở báo cáo, không tự triển khai.

## Kích hoạt trên database hiện tại — 2026-11-06

**Ủy quyền mới thay thế giới hạn triển khai trước đó:** người dùng xác nhận “cứ sử dụng db hiện tại”. Đã triển khai lên đúng bản nhập local đang được ứng dụng sử dụng, không đổi database kết nối backend 3001.

- Database: `127.0.0.1:55432/pgsms_nt3_import_20261104`, container `duansaudh-db-1`; kiểm tra tên database thật và binding container trước thao tác. Không in mật khẩu, cookie hoặc connection string.
- Backup mới: `.tmp/notification-v2-live/before-099-2026-11-06T10-44-42-748Z.dump`, **1.704.144 bytes**. Dùng pg_dump 16 trong container, snapshot PostgreSQL exported từ transaction REPEATABLE READ READ ONLY; checksum bảng nguồn được tính trong cùng snapshot với dump.
- Restore thử bằng pg_restore 16, `--exit-on-error --no-owner --no-privileges`, sang **database riêng** `notification_v2_restore_1793961890245` trong container test có label cổng **55440**. Cả **83 bảng khớp số dòng và checksum**, 0 sai lệch. Bản dump có SHA-256 trong [backup-verified.json](../.tmp/notification-v2-live/backup-verified.json); giữ dump và DB restore để phục hồi/đối chiếu.
- Migration: **đã chạy riêng `099-notification-inbox.js`**, qua Umzug/SequelizeStorage với glob duy nhất 099; ledger chính tăng đúng một mục. Tạo đủ 4 bảng Notification. Không chạy các migration nghiệp vụ còn pending, không hợp nhất hai ledger cũ. Cutoff lúc **2026-11-06 10:45:47.941 UTC**, `activated_after_change_id=10021`.
- Cấu hình: **`NOTIFICATION_V2_ENABLED=true` trong `.env`** chỉ sau khi migration thành công. Backend được khởi động lại bằng build hiện có (`npm --prefix backend run start:prod`); frontend Vite 3100 chạy lại sau khi dừng watcher cũ. Backend 3001/frontend 3100 đều HTTP 200; không đổi DATABASE_URL, quyền hoặc workflow.
- API thật: đăng nhập qua `/user/login` bằng tài khoản admin đã cấu hình, sử dụng session/working profile hiện có; **GET `/notifications` và `/notifications/unread-count` đều 200**, total=0, unreadCount=0. Không còn thông báo chưa kích hoạt. Không giả principal hoặc mock network.
- Edge thật, 1440×900, đăng nhập thật vào localhost:3100, đợi Dashboard render và mở chuông: hiển thị **“Bạn chưa có thông báo.”**, không alert lỗi, 0 runtime exception. [Ảnh giao diện thật sau bật](../.tmp/notification-v2-live/notification-enabled.png), [browser report](../.tmp/notification-v2-live/browser-verified.json). Session browser kiểm thử được logout qua endpoint chính thức khi hoàn tất; không ảnh hưởng phiên đang dùng của người dùng.
- Worker không ghi nhận `Notification sync failed` trong log quan sát. Không backfill audit ID ≤10021. Inbox rỗng lúc mới bật là trạng thái hợp lệ; sự kiện gửi/duyệt **mới** được xử lý theo polling 45s.
- **Kích hoạt đã hoàn tất; BLOCKED triển khai trước đó được gỡ bằng ủy quyền mới.** Luồng thao tác gửi/duyệt/đọc bằng hai tài khoản trên database hiện tại còn chờ nghiệm thu thực tế; đã kiểm chứng các hành vi này trong các test PostgreSQL/HTTP riêng ở trên. Không tự sửa trạng thái bản ghi nghiệp vụ hiện có để tạo thông báo trình diễn.
- Thay đổi trong lượt kích hoạt: `.env` (bật flag), báo cáo này, artifact/script triển khai trong `.tmp/notification-v2-live*`. Không sửa Dashboard/UI, RBAC/RLS nghiệp vụ hoặc service nghiệp vụ. Không commit/push/merge.

Artifact: [migration-applied.json](../.tmp/notification-v2-live/migration-applied.json), [API report](../.tmp/notification-v2-live/api-verified.json), [kết quả kích hoạt](../.tmp/notification-v2-live/activation-result.json). Các mục “chưa kích hoạt” phía trên là lịch sử trước ủy quyền mới.

## FINAL VERIFICATION — 2026-11-06

**PARTIAL — HOẠT ĐỘNG NHƯNG CHƯA NGHIỆM THU ĐỦ.** Kiểm tra ứng dụng thật bằng đăng nhập chính thức, không mock network/frontend. Chưa đủ tài khoản/bản ghi test an toàn để nghiệm thu E2E hai người trên DB hiện tại.

| Tiêu chí | PASS / FAIL / BLOCKED | Bằng chứng |
| --- | --- | --- |
| Migration 099 và schema | PASS | DB `pgsms_nt3_import_20261104`, local 55432; ledger có 099, đủ 4 bảng; cutoff `activated_after_change_id bigint NOT NULL=10021`; worker dùng điều kiện audit ID. [Preflight](../.tmp/final-notification-20261106/preflight.json). |
| Flag và worker thực sự hoạt động | PASS | Hai cổng 3001/3100 đều 200; flag true, API thật 200. PID backend 23460 có kết nối tới 55432; log cùng PID tăng **45→48 lượt sync, 0 lỗi**, không restart. [Summary](../.tmp/final-notification-20261106/summary.json). |
| API Notification | PASS | Đăng nhập admin cấu hình qua `/user/login`; GET danh sách và unread-count đều 200, không 503. |
| Chuông trên localhost:3100 | PASS | Edge 1440×900: popover dưới chuông, empty hợp lệ, không dòng đỏ; hoạt động cả Dashboard và `/system/appearance`, reload vẫn hoạt động; 0 runtime exception. |
| Số thông báo chưa đọc | PASS | Live total=0, unread=0, không badge; số trong popover/title chuông khớp API trước/sau mở. Mở chuông có **0 POST Notification**, không tự mark-all. [Browser](../.tmp/final-notification-20261106/browser.json). |
| Đánh dấu đã đọc và refresh | BLOCKED | Inbox thật rỗng, không có notification test an toàn để đổi read state. Refresh UI/count=0 đạt; read persistence có dữ liệu chỉ PASS trong test PostgreSQL/frontend riêng của lượt này. |
| Mở đúng hồ sơ/lớp | BLOCKED | Không có notification live để bấm; không tạo sự kiện trình diễn hoặc mở/đọc thông báo người thật. Deep-link và access checks PASS trong test riêng, chưa nghiệm thu click live. |
| A gửi → B nhận → B duyệt → A nhận | BLOCKED | DB hiện tại chỉ **1 staff active**, 0 tài khoản Notification test được định danh; chưa có cặp A/B và bảng điểm test an toàn. Không cấp quyền hoặc tạo fixture trên DB này. |
| Phân quyền working profile | PASS | **Test riêng** kiểm tra profile mismatch, foreign delivery, RLS không WHERE và thu hồi quyền/phạm vi đều đạt. Phiên live có 1 working profile, chưa nghiệm thu chuyển giữa hai profile/tài khoản thật. |
| Notification và Dashboard độc lập | BLOCKED | Mở chuông giữ nguyên số phê duyệt Dashboard và không POST; chưa có notification live để kiểm tra việc đọc không làm mất yêu cầu. Test riêng xác nhận read không sửa source gradebook. |
| Test backend/frontend cuối | PASS | **Lượt mới: backend 32/32 (13 integration + 13 parser + 6 guard), frontend 15/15**, 0 FAIL, 0 skip; không đổi timeout/assertion. Backend ghi fixture chỉ tại DB case riêng cổng 55440, đúng guard. |

- **Log lượt này:** [preflight](../.tmp/final-notification-20261106/preflight.log), [worker/health sau kiểm tra](../.tmp/final-notification-20261106/preflight-after.log), [browser](../.tmp/final-notification-20261106/browser.log), [backend](../.tmp/final-notification-20261106/tests/backend-1.log), [frontend](../.tmp/final-notification-20261106/tests/frontend-1.log). JSON kết quả cùng tên và [summary](../.tmp/final-notification-20261106/summary.json) lưu bằng chứng máy đọc được.
- **Ảnh thật đã quan sát:** [popover Dashboard](../.tmp/final-notification-20261106/popover-dashboard.png), [popover trang khác](../.tmp/final-notification-20261106/popover-other-page.png).
- **Giới hạn còn lại:** inbox live rỗng; E2E hai tài khoản, mark-read và click đúng đích có dữ liệu trên DB ứng dụng chưa kiểm chứng. Không có test FAIL trong lượt này; không dùng kết quả cũ thay kết quả mới.
- **Ghi DB:** không ghi bảng nghiệp vụ/read state trên DB ứng dụng, không migration/sửa ledger/cấu hình. Đăng nhập/đăng xuất kiểm thử chỉ ghi session/audit xác thực theo luồng ứng dụng; fixture ghi/xóa chỉ ở DB test 55440. Không in credentials/cookie/token/connection string.
- **File thay đổi:** chỉ bổ sung mục này vào `docs/NOTIFICATION_V2_IMPLEMENTATION.md`; thêm script kiểm tra `.tmp/final-notification-{preflight,browser,tests}.cjs` và artifact trong `.tmp/final-notification-20261106/`. Không sửa mã ứng dụng, UI, nghiệp vụ, RBAC/RLS hoặc test; không commit/push.

**Hành vi Notification có thay đổi:** có, ranh giới kích hoạt dùng thứ tự journal thay cho đồng hồ để tránh bỏ sót nguồn mới khi thời gian lùi. Quy tắc người nhận, quyền, scope, read state và workflow giữ nguyên. Không tiếp nhận audit cũ chỉ vì bật worker lại; backlog sau ranh giới vẫn được xử lý theo receipt.
