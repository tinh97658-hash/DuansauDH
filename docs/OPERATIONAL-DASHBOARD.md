# Home — Tổng quan công việc

## Phạm vi

Home thật là `/` hoặc `/viewLogged`, render từ `frontend/src/pages/viewLogged.js`. Chỉ thay nội dung hero trong `FeatureLayout`; không sửa header, ribbon, menu, footer hoặc asset `home-campus-banner.png`. Các bước nghiệp vụ và dữ liệu DB không bị sửa trong task dashboard.

Phiên bản đầu tập trung vào các luồng Thạc sĩ đang có service nghiệp vụ thực. Không tự tạo số liệu cho các màn Tiến sĩ còn chưa có cùng khả năng xử lý.

## Thiết kế

- Dùng token hiện tại: `--primary`, `--primary-dark`, `--secondary`, `--text-primary`, `--text-secondary`, `--table-border-color`, `--surface-bg`, `--canvas-bg`, màu success/warning hiện có.
- Thẻ nền trắng, icon pastel nhỏ; phân nhóm teal, lịch blue, điểm violet, xác nhận buổi học amber. Không gradient, biểu đồ trang trí, sidebar, hình minh họa mới hoặc KPI lớn.
- Icon outlined từ thư viện **MUI Icons** hiện có, không thêm dependency.
- Thẻ desktop cao 116px, responsive 4 → 2 → 1 cột; số cột cũng giảm theo số widget thực sự được cấp quyền. Góc 7px cho panel/card, ngoại lệ CSS được giới hạn trong dashboard đối với layer góc vuông toàn ứng dụng; không đổi style global.
- Phần việc/cảnh báo chia 2:1; tự về một cột khi không có quyền cảnh báo hoặc trên màn hình hẹp. Mỗi nhóm chỉ xem trước tối đa 5 mục. Tổng quan đào tạo là các số inline ở phần dưới.
- Trạng thái rỗng dùng thông báo hoàn tất và icon xác nhận, không hiển thị số 0 lớn. Không có quyền tác vụ dùng thông báo chưa được giao quyền, không giả là đã hoàn tất công việc.
- Link/button semantic, thao tác Enter, focus rõ, icon đi kèm text; skeleton tôn trọng reduced-motion. Error có retry theo nguồn.

## API và phân quyền

Thêm endpoint **GET `/dashboard/operational?year=2026`**, được bảo vệ bởi `AuthenticatedGuard`. Backend tính count và trả các preview ngắn; không đẩy danh sách học viên/bảng điểm thô về Home để ghép phía client.

Không thêm role hoặc permission store mới. Quyền hiển thị dùng role metadata của chính endpoint thao tác hiện tại và helper dùng chung với guard xếp lịch:

| Widget | Quyền hiện có | Nguồn / định nghĩa | Đích xử lý |
|---|---|---|---|
| Học viên chưa phân nhóm | Role metadata của `MastersController.assignMembers` → admin | `MastersService.listEligibleStudents(undefined, year)`; cùng danh mục major/discipline của summary phân nhóm; bỏ `assignedGroup`; không dùng học phí để quyết định | `/masters/assign-class-groups?year=…`; từng major thêm `disciplineId`, `majorId` |
| Lớp chưa xếp lịch | Role được đọc scheduling và `SchedulingWriteGuard` → Staff được giao `canManageScheduling=true` | `SchedulingService.listCourseOfferings({program:'masters', academicYear})`; offering active, `sessionSummary.totalCount === 0` | `/masters/schedule?year=…&queue=unscheduled`; từng lớp thêm `offeringId`, major scope nếu biết |
| Lớp chưa nhập đủ điểm | Role metadata của `MastersController.saveExamLists` → admin/examiner | `getClassCurriculumProgress` và cờ `needsGradeEntry`; đếm **nhóm hành chính có ít nhất một học phần thiếu điểm**, không đếm số học viên/học phần hoặc chỉ kiểm tra có gradebook hay chưa | `/masters/exam-lists?year=…&majorId=…&groupId=…&offeringId=…&subjectId=…&logicalSubjectId=…` |
| Tiến độ cần kiểm tra / Cảnh báo | Cùng quyền sửa lịch | Offering active có `sessionSummary.pendingCount > 0`; backend domain service xác định buổi planned đã qua giờ theo timezone nghiệp vụ | `/masters/schedule?year=…&queue=pending-confirmation`; từng cảnh báo thêm `offeringId` và mở danh sách chờ xác nhận đúng phạm vi |
| Tình hình đào tạo | Staff admin, quyền quản trị hiện có | Offering active; active có buổi held; active chưa có session; offering completed, lấy từ cùng service scheduling | Thông tin phụ, không dẫn đến thao tác ngoài quyền |

Admin **không** mặc nhiên có quyền sửa lịch: vẫn cần cờ phân công, đúng guard đang tồn tại. Tài khoản Student, kể cả có chuỗi role giống admin, không được coi là Staff. Backend không chạy query nguồn mà tài khoản không có quyền; frontend cũng không render widget, preview hoặc cảnh báo không được cấp.

Các source `grouping`, `teaching`, `grades` chạy qua `Promise.allSettled`. Lỗi điểm không loại bỏ dữ liệu phân nhóm/lịch. Có thể retry một nguồn bằng `&section=grades` (hoặc grouping/teaching). Nguồn teaching chia sẻ dữ liệu cho lịch, cảnh báo và overview để không tải lặp. Danh mục major dùng chung trong một request; progress query chạy tối đa hai major đồng thời. Chỉ truy vấn major có nhóm trong năm đang chọn.

Nếu domain progress service từ chối một phạm vi (ví dụ major đã inactive), metric điểm báo lỗi để retry, không âm thầm bỏ phạm vi đó rồi hiển thị số 0 lành mạnh. Endpoint không thêm mutation, migration, cache dữ liệu nghiệp vụ hoặc side effect. Lỗi trả về frontend không chứa nội dung lỗi driver.

## Deep-link và thay đổi tối thiểu ở trang đích

- Schedule nhận thêm phạm vi year/major/discipline từ URL và hai queue filter. Bộ lọc có nhãn và nút bỏ lọc. Danh sách pending được giới hạn theo scope năm và offering khi đến từ cảnh báo. Hành vi bình thường khi không có queue được giữ.
- ExamLists resolve các ID đã có trong options và đúng năm/major; không chọn một ID ngoài phạm vi. URL không có deep-link giữ cách chọn option đầu tiên. Nếu có subject mà không có offering ID, ưu tiên offering completed cùng logical subject.
- Progress response thêm `incompleteCourseOfferingId` lấy từ **cùng phép kiểm tra thiếu điểm hiện có** để mở đúng lần mở lớp, không nhầm một lần completed khác đã đủ điểm. Cờ `needsGradeEntry` giữ nguyên ý nghĩa.
- Thẻ điểm và link cuối preview mở bảng điểm cần xử lý đầu tiên; từng dòng mở đúng nhóm. Không giả làm bộ lọc “tất cả thiếu điểm” khi trang điểm hiện chưa có hàng đợi toàn hệ thống như vậy. Caption cho biết chỉ xem trước N/tổng số nhóm.
- Năm trên Home đồng bộ search params, hỗ trợ Back/Forward. Request của năm cũ bị bỏ qua; retry không ghi đè scope mới. Khi retry mất xác thực/quyền, dữ liệu cũ bị gỡ khỏi Home.

## Cảnh báo và metric chủ động không thêm

Chỉ cảnh báo việc **buổi học đã qua giờ nhưng còn planned/chưa xác nhận**; không coi failed/not-held là chưa xếp lịch, không coi mọi môn chưa bắt đầu là lớp học phần cần xếp lịch.

Không thêm “trễ tiến độ”, “thiếu tổng số buổi theo định mức”, deadline nhập điểm hoặc dự báo hoàn thành vì service hiện không cung cấp chuẩn thời hạn/định mức đủ để kết luận. Lời nhắc đóng lớp sau 4 buổi đang có trên trang xếp lịch không được biến thành cảnh báo trễ tiến độ trên Home. Không thêm chart chỉ để lấp chỗ trống.

Metric điểm tái dùng quy tắc hiện có cho roster, công nhận, miễn ngoại ngữ, thành phần, tổng điểm và lớp completed; không sửa công thức, học lại, studyStatus, tuition hoặc policy.

## Files

Frontend:

- `src/pages/viewLogged.js`
- `src/features/dashboard/OperationalDashboard.jsx`: `ActionCard`, `WorkCategory`, `WarningPanel`, trạng thái nguồn và orchestration Home.
- `src/features/dashboard/operationalDashboard.css`
- `src/features/dashboard/navigation.js`
- `src/features/scheduling/Schedule.jsx`
- `src/pages/masters/examLists.jsx`
- Test dashboard mới: `OperationalDashboard.test.jsx`, `DashboardScheduleLinks.test.jsx`, `dashboardNavigation.test.js`.
- Test liên quan được cập nhật: `ExamLists.test.jsx` (router, deep-link và mock async/persist thực tế), `schedulingNavigation.test.js` (mock icon nhẹ; giữ các assertion route/focus/ribbon).

Backend:

- `src/dashboard/dashboard.module.ts`, `dashboard.controller.ts`, `dashboard.service.ts`
- `src/app.module.ts`: đăng ký module.
- `src/common/scheduling-write.guard.ts`: export helper cùng điều kiện đã có, guard dùng lại helper đó.
- `src/scheduling/scheduling.service.ts`: thêm ID read-only của offering còn thiếu điểm vào progress response.
- `test/unit/dashboard.service.spec.ts`, `test/unit/scheduling.service.spec.ts`.

Các thay đổi local từ task phân nhóm và dev reset/reseed trước đó được giữ nguyên. Không commit/push.

## Kiểm tra

- Backend: 65 targeted tests (dashboard, guard xếp lịch, service progress/scheduling).
- Frontend: 56 targeted tests (Home/dashboard, deep-link xếp lịch, helper URL, FeatureLayout, ribbon navigation, ProtectedRoute, ExamLists); các failure fixture trong quá trình phát triển đã được chỉnh và chạy lại phạm vi liên quan.
- Backend build: passed. Frontend production build: passed; Vite còn cảnh báo một số bundle lớn hơn 500kB, không có lỗi compile.
- Khởi tạo Nest application context thật và gọi service dashboard bằng Staff admin hiện có: cả ba nguồn trả ready. DB sau reseed có hàng đợi rỗng đúng trạng thái; lần đọc local này khoảng 48ms, không phải benchmark cho dataset lớn.
- Gọi HTTP endpoint dashboard không có session: trả 401 đúng guard.
- Headless Edge: 1366×768, 1024×768, 390×844; không tràn ngang, lưới 4/2/1; card desktop 116px. Ở 1366×768, đáy thẻ khoảng y=522, phần việc bắt đầu y=536, nằm trong viewport đầu sau ribbon hiện có.
- Focus và Enter mở đúng `/masters/assign-class-groups?year=2026`; không có runtime exception trong phiên kiểm tra dashboard.
- Screenshot populated/partial-error dùng fixture browser-only và được ghi rõ, **không phải số liệu DB**; ảnh healthy dùng snapshot read-only từ service thật. Không ghi seed hay dữ liệu kiểm thử mới vào DB cho task này.

Ảnh kiểm tra local (thư mục `.tmp`, không đưa vào Git):

- `dashboard-browser/dashboard-fixture-1366.png`
- `dashboard-browser/dashboard-fixture-1024.png`
- `dashboard-browser/dashboard-fixture-390.png`
- `dashboard-browser/dashboard-live-healthy-1366.png`
- `dashboard-browser/dashboard-fixture-partial-error-1366.png`
