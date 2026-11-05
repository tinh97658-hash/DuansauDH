# Rà soát logic phân quyền — 05/11/2026

> **Cập nhật khắc phục:** SCR-001, SCR-002 và SCR-003 đã được sửa trong mã nguồn: thống nhất so sánh URL ở các lớp quyền/phạm vi, từ chối API ghi chưa có mapping (giữ tra cứu dùng chung và đổi mật khẩu cá nhân), và ràng buộc dashboard theo quyền trang/hành động. Các ca tái hiện đã chuyển thành kiểm thử yêu cầu từ chối. Chưa kiểm chứng triển khai PostgreSQL thực tế.
>
> **Quyết định chủ dự án:** `account.manage` được chủ đích coi là đặc quyền tương đương quản trị viên, cho phép gán mọi vai trò kể cả admin cho bản thân. RBAC-BOUND-01 được xác nhận là hành vi đúng thiết kế, không yêu cầu hạn chế thêm. Đã bổ sung mô tả rõ trên giao diện và cảnh báo phạm vi reset mật khẩu; nhật ký tạo/cập nhật tài khoản lưu vai trò trước/sau cùng transaction với thay đổi.
>
> Phần phát hiện và kết quả 70 test bên dưới là ghi nhận tại thời điểm rà soát ban đầu, trước bản sửa. Các probe hiện tại kiểm tra hành vi sau sửa.
>
> **Kiểm chứng bản sửa:** toàn bộ unit backend: 76 suites / 1.026 test đạt; chạy lại 4 suite trực tiếp bị tác động sau các bổ sung cuối: 82 test đạt. Frontend Vai trò/Nhật ký: 14 test đạt. Typecheck backend và build production frontend đạt. Không chạy fixture PostgreSQL hoặc migration trên DB vận hành. Bản sửa không thêm migration/schema.

## Kết luận rà soát ban đầu

Kiến trúc có nền tảng hợp lý: xác thực session, chọn một hồ sơ làm việc, kiểm tra quyền ở backend, điều kiện module/quyền đọc và PostgreSQL RLS theo lớp. Tuy nhiên, **chưa thể coi logic phân quyền là an toàn**: xác nhận 3 điểm thiếu kiểm soát và 1 rủi ro thiết kế quyền quản trị cần chốt chính sách.

| Phân loại | Số lượng |
| --- | ---: |
| Critical đã xác nhận | 0 |
| High đã xác nhận | 1 |
| Medium đã xác nhận | 2 |
| Rủi ro thiết kế có điều kiện, tác động High | 1 |

Phạm vi: NestJS/TypeScript, Passport + express-session, Sequelize/PostgreSQL; kiểm tra frontend React tại `ProtectedRoute.jsx` để đối chiếu. Ranh giới tin cậy gồm HTTP URL/body/query/header, session phía server, hồ sơ/quyền trong DB và context RLS. Trọng tâm ASVS 4.0.3: V2, V3, V4, V11, V13. Không kiểm tra toàn bộ ứng dụng hoặc cấu hình vận hành thực tế.

Người rà soát: Codex, áp dụng secure-code-review v1.0.0 và rbac-design v1.0.0. Đánh giá từ mã nguồn và kiểm thử cô lập; không kết nối DB vận hành, không sửa quyền hoặc tài khoản thật.

## SCR-001 — URL khác chữ hoa/thường vượt kiểm tra quyền trang và nhánh chặn nhật ký

- **Mức độ:** High. **CWE:** CWE-863, Incorrect Authorization. **ASVS:** V4.1.1, V4.1.3, V4.2.1. **Trạng thái:** Open.
- **Vị trí:** `backend/src/auth/route-authorization.ts:6`, `:45`; `backend/src/auth/group-scope.interceptor.ts:16`; `backend/src/main.ts`.
- **Điều kiện:** Đã đăng nhập bằng nhân sự, có hồ sơ hợp lệ và quyền nghiệp vụ tổng quát liên quan. Đây không phải đường bỏ qua toàn bộ xác thực.
- **Nguyên nhân:** Router chấp nhận URL khác kiểu chữ, nhưng mapping quyền và regex phạm vi so sánh có phân biệt chữ hoa/thường. Mapping không nhận diện URL thì `if(!routes.length)return true`.
- **Bằng chứng HTTP:** Với hồ sơ chỉ có quyền sửa trang Thành phố cùng `catalog.manage`, gọi `PUT /system/majors/review-id` trả **403**; gọi `PUT /SYSTEM/majors/review-id` trả **200**, thực sự gọi `SystemService.updateMajor` đã mock. Dùng SystemController thật và PermissionsGuard thật; không ghi DB.
- **Bằng chứng nhật ký:** `restrictView=true`: interceptor từ chối `/accounts/change-logs`, nhưng cho `/ACCOUNTS/change-logs` đi tiếp. `ChangeLogService.list` trả `oldData/newData`; mã migration RLS đã rà soát không đặt RLS theo lớp lên `db_change_logs` hoặc `auth_audit_logs`. Do đó nhánh chặn ở interceptor là quan trọng để ngăn đọc bản chụp dữ liệu ngoài lớp. Chưa đọc nhật ký thật qua HTTP/DB để đo phạm vi dữ liệu thực tế.
- **Khắc phục:** Ưu tiên kiểm tra theo metadata của handler/controller đã được router giải quyết. Nếu giữ mapping URL, thống nhất quy tắc phân giải giữa router, quyền trang và phạm vi dữ liệu; có thể cấu hình router phân biệt kiểu chữ và/hoặc chuẩn hóa các đoạn đường dẫn tĩnh trước kiểm tra. Không tự lower-case ID tùy ý. Tránh mặc định cho phép endpoint nghiệp vụ chưa có policy.
- **Kiểm chứng bản sửa:** Các biến thể chữ hoa/thường phải cùng bị chặn hoặc không được router nhận; hồ sơ giới hạn lớp không lấy được nhật ký qua mọi biến thể URL. Kiểm tra riêng endpoint điểm, lịch và tuyển sinh vì interceptor cũng phân loại domain bằng URL.

## SCR-002 — Endpoint ghi không có mapping được mặc định bỏ qua quyền từng trang

- **Mức độ:** Medium. **CWE:** CWE-862, Missing Authorization ở tầng quyền trang. **ASVS:** V4.1.3. **Trạng thái:** Open.
- **Vị trí:** `backend/src/auth/route-authorization.ts:45`; `backend/src/system/system.controller.ts`, các endpoint `districts`; `backend/src/auth/route-permissions.ts`.
- **Nguyên nhân:** `routePermissionAllowed` trả `true` khi không tìm thấy mapping. `POST/PUT/DELETE /system/districts` vẫn tồn tại nhưng danh mục quyền trang không có `/system/districts`.
- **Bằng chứng:** Cùng tập quyền chỉ sửa Thành phố, `routePermissionAllowed(...,'/system/majors/id','PUT',['catalog.manage'])` là false; thay đường dẫn bằng `/system/districts/id` là true. Controller districts chỉ yêu cầu `catalog.manage`.
- **Tác động:** Người được cấp quyền sửa một danh mục có thể sửa danh mục quận/huyện qua API dù không được cấp riêng hành động đó. Quyền nghiệp vụ tổng quát và khóa chỉ đọc vẫn được kiểm tra. Không suy rộng thành truy cập ẩn danh.
- **Khắc phục:** Lập danh sách endpoint ghi, bắt buộc mỗi endpoint có policy hành động rõ ràng; bổ sung mapping cho endpoint còn sử dụng hoặc loại bỏ endpoint cũ. Lookup dùng chung phải được khai báo ngoại lệ cụ thể. Không đổi tất cả lookup sang deny một cách máy móc vì nhiều màn hình đang dùng chung.
- **Kiểm chứng bản sửa:** Kiểm thử bao phủ mapping của toàn bộ endpoint ghi và các ngoại lệ đọc; quyền sửa Thành phố không sửa được Quận/huyện.

## SCR-003 — Dashboard chưa áp dụng quyền xem/hành động từng trang

- **Mức độ:** Medium. **CWE:** CWE-863. **ASVS:** V4.1.1, V4.1.3. **Trạng thái:** Open nếu yêu cầu là khóa dữ liệu theo quyền trang; cần xác nhận nếu dashboard được chủ đích cấp quyền độc lập.
- **Vị trí:** `backend/src/dashboard/dashboard.controller.ts:15`; `backend/src/dashboard/dashboard.service.ts:16`, `:28`, `:184`.
- **Nguyên nhân:** Dashboard dùng AuthenticatedGuard và `operationalPermissions`, kiểm tra các quyền tổng quát như `scheduling.view`, `gradebook.submit`, `gradebook.approve`. Không đối chiếu `route.*.view` hoặc quyền hành động từng trang.
- **Bằng chứng:** Tập quyền hiệu lực `module.scheduling + scheduling.view`, không có bất kỳ quyền xem trang lịch nào, bị `routePermissionAllowed` từ chối GET lớp học phần nhưng vẫn nhận `operationalPermissions(...).overview === true`. `operational()` dùng kết quả đó để bật loader `teaching` và truy vấn lớp học phần. Các section khác có cùng kiểu kiểm tra quyền tổng quát.
- **Tác động:** Tắt quyền một trang chưa chắc tắt được dữ liệu tóm tắt/chờ xử lý tương ứng qua dashboard. RLS theo lớp vẫn là lớp bảo vệ riêng; chưa xác nhận vượt RLS hoặc lấy toàn bộ hồ sơ học viên.
- **Khắc phục:** Gắn từng section với quyền xem trang phù hợp và quyền hành động khi section dành cho tác vụ ghi/duyệt, hoặc định nghĩa quyền dashboard độc lập minh bạch. Dùng cùng hàm policy ở API và frontend.
- **Kiểm chứng bản sửa:** Khi bỏ quyền trang và giữ quyền tổng quát dùng chung, API dashboard không trả section tương ứng; kiểm tra cả section đơn lẻ và response tổng hợp.

## RBAC-BOUND-01 — Quản lý tài khoản có thể tự gán vai trò admin

- **Mức tác động:** High nếu quyền quản lý tài khoản được giao cho người chưa được tin cậy như quản trị toàn hệ thống. **CWE:** CWE-269. **ASVS:** V4.1.3. **Framework:** NIST RBAC0, giới hạn user-role assignment. **Trạng thái:** Cần xác nhận chính sách; hành vi gán vai trò đã tái hiện.
- **Vị trí:** `backend/src/accounts/accounts.controller.ts:80`; `backend/src/accounts/accounts.service.ts:154`, `:177`, `:360`. Liên quan: reset mật khẩu tại `:255`.
- **Hiện trạng:** `account.manage` được mô tả rõ là có khả năng gán vai trò. Helper `assertAssignableRoles` chỉ kiểm tra vai trò còn hoạt động, không so quyền actor với vai trò đích, không cấm tự thêm vai trò mạnh hơn. Chặn tự gỡ hồ sơ hiện tại không ngăn thêm admin.
- **Bằng chứng:** Gọi AccountsService.update thật với model/transaction mock, actor giữ nguyên hồ sơ account-manager rồi thêm `admin-role`; service gọi bulkCreate để thêm quan hệ admin. Không có quyền `role.manage` nào được kiểm tra trong service. Phiên cũ bị tăng sessionVersion nhưng đăng nhập lại vẫn nhận vai trò mới.
- **Tác động:** Phân tách giữa người quản lý tài khoản và người quản lý ma trận quyền không phải ranh giới bảo mật thực sự. Ngoài ra, quyền reset mật khẩu cho phép đặt mật khẩu bất kỳ tài khoản nhân sự theo ID; nếu cấp cho helpdesk thì cũng cần giới hạn tài khoản quản trị đích.
- **Đề xuất:** Hoặc công bố và quản lý `account.manage`/`account.password.reset` như đặc quyền toàn hệ thống, hoặc tách quyền gán vai trò, giới hạn tập vai trò được gán và cấm tự nâng quyền. Giới hạn reset tài khoản quản trị theo chính sách tương ứng. Không mặc định xem đây là lỗi nếu chủ dự án chủ đích trao đầy đủ quyền này.
- **Effort:** Medium; cần thống nhất mô hình ủy quyền trước khi triển khai.

## Những kiểm soát đã thấy và kiểm chứng

- HTTP dùng một hồ sơ đang chọn; không cộng quyền tất cả vai trò trong request có working-profile context. Hồ sơ trong session được đối chiếu với vai trò đang hoạt động của tài khoản.
- Header `X-Working-Profile-Id` kiểm tra tab cũ, không tự cấp vai trò.
- Quyền phải có module cha và quyền đọc phụ thuộc; tên vai trò tùy ý không tự tạo quyền.
- Ghi dữ liệu kiểm tra lại quyền; khóa chỉ đọc được kiểm tra ở guard/interceptor và có lớp SQL riêng.
- Session có sessionVersion; tài khoản bị khóa hoặc version cũ không được deserialize hợp lệ.
- Phân công qua endpoint nhóm kiểm tra quyền riêng. Nghi vấn gửi lén `responsibleStaffId` vào `PUT /plan/classes/:id` đã được loại trừ bằng test: ValidationPipe whitelist loại trường này khỏi UpdateClassDto trước khi gọi service.
- Có RLS, transaction và các khóa chống thay đổi quyền/phân công đồng thời. Chưa chạy DB integration nên không kết luận RLS đang triển khai đúng trên môi trường thực tế.

Mô hình hiện tại là RBAC theo hồ sơ kết hợp thuộc tính người phụ trách lớp; có tập trung giải quyết quyền nhưng policy vẫn phân tán ở URL mapping, guard, interceptor, service và SQL. Chưa đủ căn cứ đánh giá quy trình quản trị vai trò hoặc yêu cầu tách người lập/người duyệt của tổ chức.

## Kiểm thử

File bằng chứng: `backend/test/unit/authorization-review-20261105.spec.ts`.

Chạy:

```powershell
npm --prefix backend test -- --runTestsByPath test/unit/authorization-review-20261105.spec.ts test/unit/permissions.guard.spec.ts test/unit/route-authorization.spec.ts test/unit/working-profile.spec.ts test/unit/auth-session.spec.ts test/unit/group-scope-interceptor.spec.ts test/unit/roles.service.spec.ts
```

Kết quả: **7 suites, 70 tests passed**, gồm **6 probe mới**. Các probe ghi nhận hành vi hiện tại, bao gồm lỗ hổng; PASS không đồng nghĩa lỗ hổng đã được sửa. Sau khi sửa phải đổi các assertion về hành vi từ chối mong muốn. HTTP probe dùng controller/guard thật và service mock; kiểm thử account assignment dùng service thật, model/transaction mock. Không kiểm tra dữ liệu thật, trạng thái migration hoặc cấu hình reverse proxy thực tế.

| ASVS | Mức bao phủ | Kết quả |
| --- | --- | --- |
| V2 Authentication | Đọc code và test session liên quan | Chưa thấy bypass trong phạm vi đã xem; không đánh giá toàn bộ V2 |
| V3 Session | Hồ sơ, version, deserialize | Các test được chọn đạt; không đánh giá đầy đủ lifecycle runtime |
| V4 Access Control | Guard, route, scope, tài khoản, dashboard | Fail: SCR-001 đến SCR-003; RBAC-BOUND-01 cần chốt chính sách |
| V11 Business Logic | Profile/assignment, một phần luồng điểm và phân công | Chưa đánh giá toàn bộ quy trình nghiệp vụ |
| V13 API | Đối chiếu policy với URL/handler | Fail ở phân giải đường dẫn và mapping thiếu |

## Thứ tự khắc phục và bàn giao

1. Sửa SCR-001 trước: đồng nhất cách xác định tài nguyên/quyền và khóa đường đọc nhật ký vượt phạm vi.
2. Bổ sung policy cho endpoint còn thiếu và ràng buộc quyền dashboard theo quyết định sản phẩm.
3. Chốt liệu quản lý tài khoản/reset mật khẩu có phải đặc quyền toàn hệ thống; nếu không thì bổ sung giới hạn ủy quyền.
4. Trên DB kiểm thử riêng đã migrate, chạy hồi quy quyền theo hồ sơ, RLS và request HTTP với các biến thể URL; không chạy fixture trên DB đang sử dụng.

Theo Security Fixer Policy, các thay đổi authorization thuộc **human-review-required**: người duyệt cần xem predicate/quyền đích, ảnh hưởng lookup dùng chung, các assertion sau sửa và kết quả kiểm thử PostgreSQL. Đây là phân loại đường khắc phục; lần rà soát này chỉ bổ sung báo cáo và probe, không chỉnh mã phân quyền.

Rollback cho bản sửa tương lai: tách commit code/policy để revert đúng commit nếu hồi quy; mọi thay đổi quyền hoặc migration cần bản sao lưu và kế hoạch khôi phục riêng do người vận hành chịu trách nhiệm. Không xóa nhật ký hay chạy migration down nhằm rollback một cách tự động.
