> Quy tắc hiện hành 28/10/2026: các quyền đã cấp trong Lớp học phần & xếp lịch và Thi & điểm tự động có phạm vi Toàn viện (migration 084), bỏ lựa chọn phạm vi. Quyền hành động độc lập; khóa Chỉ xem được giữ. Xem `KE-HOACH-PHAN-QUYEN-LICH-HOC-VA-DIEM.md`. Nội dung scope theo phân công trước 084 không còn áp dụng cho hai nhóm nghiệp vụ này.

# KẾ HOẠCH: MODULE QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (RBAC)

> Trạng thái: **Đã hoàn thành — Phase 1–8 xong (RBAC, API tài khoản/vai trò, chuyển `@Roles`→permission, giao diện, dọn dẹp/test/tài liệu, nhật ký thay đổi dữ liệu cấp DB, ghi nhận đăng nhập/đăng xuất; thống nhất admin vào RBAC permission).**
> Ngày lập: 2026-10-18 (cập nhật 2026-10-19: thống nhất mọi vai trò theo permission).
> Phạm vi áp dụng: `backend/` (NestJS 11 + Sequelize + Umzug) và `frontend/` (React + MUI).

> Cập nhật 28/10/2026: lịch học có grant scope riêng từ migration 082; xem [hướng dẫn phân công và phạm vi lịch](docs/group-responsibility.md). Quy tắc phải bao phủ đủ mọi nhóm tiếp tục áp dụng cho tổ chức lớp, điểm và lịch thi theo chính sách tương ứng; thao tác lịch chung đã chuyển đổi chỉ cần một nhóm phụ trách. Các vai trò chưa được đối chiếu scope vẫn ở chế độ tương thích.

---

## 0. Chốt phạm vi (đã thống nhất)

- **Mô hình phân quyền**: RBAC đầy đủ — `roles`, `permissions`, `role_permissions`, `staff_roles`. Tác nhân là nhân sự (`Staff`); `admin` là vai trò mặc định bình thường, không có cơ chế bỏ qua permission. `is_system` chỉ bảo vệ mã vai trò và việc xóa.
- **Nhiều vai trò / một nhân sự**: quyền hiệu lực = **hợp quyền của mọi vai trò** được gán. Vẫn giữ **1 vai trò chính (primary)** để `user.role` phía API đổi sang mã chuỗi như cũ.
- **Đối tượng quản lý**: chỉ tài khoản **cán bộ/nhân sự** (`staff`). Không đụng luồng học viên.
- **Vòng đời tài khoản**: tạo kèm mật khẩu ban đầu (nhập tay hoặc sinh ngẫu nhiên) · luôn `mustChangePassword` · khóa/mở khóa · admin đặt lại mật khẩu · buộc đăng xuất · audit log.
- **Chuyển đổi**: chuyển **toàn bộ 121 chỗ `@Roles`** sang kiểm tra permission trong đợt này; gỡ `@Roles`/`RolesGuard` khi xong.
- **Tương thích**: API `/auth/session` vẫn trả `user.role` = mã vai trò **chính**, để hiển thị/tương thích dữ liệu; không dùng mã vai trò chính để quyết định quyền truy cập.

---

## 1. Thiết kế dữ liệu (migration `062-account-management-rbac.ts`)

Vị trí: `backend/src/database/migrations/062-account-management-rbac.ts` (đặt sau `061-*`).

### 1.1 Bảng `roles`

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | UUID PK | `defaultValue UUIDV4` |
| `code` | STRING UNIQUE NOT NULL | `admin`, `supervisor`, `examiner` + vai trò tùy tạo |
| `name` | STRING NOT NULL | tên hiển thị |
| `description` | TEXT | |
| `is_system` | BOOLEAN default false | không cho xóa/đổi `code` |
| `is_superadmin` | Đã loại bỏ ở migration `064` | Không còn đặc quyền bỏ qua permission |
| `sort_order` | INT default 0 | |
| `active` | BOOLEAN default true | |

Seed 3 vai trò hệ thống trong migration (upsert idempotent theo `code`).

### 1.2 Bảng `permissions`

Catalog **cố định trong code** (`backend/src/auth/permissions.ts`), seed vào DB để UI tick.

| Cột | Kiểu |
| --- | --- |
| `id` | UUID PK |
| `code` | STRING UNIQUE NOT NULL (`account.manage`, `catalog.manage`, ...) |
| `name` | STRING |
| `group` | STRING |
| `description` | TEXT |
| `sort_order` | INT |

### 1.3 Bảng `role_permissions`

`role_id` FK→`roles` ON DELETE CASCADE, `permission_id` FK→`permissions` ON DELETE CASCADE, PK tổng hợp `(role_id, permission_id)`.

### 1.4 Bảng `staff_roles` (n-n, hỗ trợ nhiều vai trò)

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `staff_id` | UUID FK→`staff` ON DELETE CASCADE | PK tổng hợp |
| `role_id` | UUID FK→`roles` ON DELETE RESTRICT | PK tổng hợp |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Vai trò **chính** (đại diện `user.role`) lưu ở cột `staff.role` — xem §1.6. Ràng buộc "≥1 vai trò" được kiểm ở service.

### 1.5 Bảng `auth_audit_logs`

| Cột | Kiểu |
| --- | --- |
| `id` | UUID PK |
| `actor_staff_id` | UUID FK→`staff` ON DELETE SET NULL |
| `target_staff_id` | UUID FK→`staff` ON DELETE SET NULL |
| `action` | STRING NOT NULL |
| `metadata` | JSONB |
| `ip` | STRING(64) |
| `user_agent` | TEXT |
| `created_at` | TIMESTAMPTZ |

Hành động (mã thực tế đã dùng): `account.create`, `account.update`, `account.disable`, `account.enable`, `account.password.reset`, `account.password.change`, `account.sessions.revoke`, `account.login`, `account.logout`, `account.login.failed`, `role.create`, `role.update`, `role.permissions.update`, `role.delete`.
Index theo `created_at`, `target_staff_id`, `action`.

### 1.8 Bảng `db_change_logs` — nhật ký thay đổi dữ liệu (migration `063-db-change-logs.ts`)

Ghi **mọi** thay đổi dữ liệu ở tầng PostgreSQL để truy vết đầy đủ, bất kể luồng code (service, SQL thủ công, seed…).

| Cột | Kiểu |
| --- | --- |
| `id` | BIGSERIAL PK |
| `table_name` | STRING(80) NOT NULL |
| `operation` | STRING(10) — `INSERT`/`UPDATE`/`DELETE` |
| `row_pk` | TEXT — khóa chính dạng JSON |
| `old_data` / `new_data` | JSONB — dòng trước/sau |
| `changed_columns` | TEXT[] — cột đổi (chỉ UPDATE) |
| `actor_staff_id` | UUID (người thực hiện, best-effort) |
| `actor_email` | STRING(150) |
| `request_id` / `ip` / `user_agent` | ngữ cảnh request |
| `changed_at` | TIMESTAMPTZ |

- Hàm trigger `audit_capture()` gắn `AFTER INSERT OR UPDATE OR DELETE` cho `FOR EACH ROW` trên toàn bộ bảng nghiệp vụ.
- Loại trừ: `db_change_logs`, `auth_audit_logs`, `sessions`, `sequelize_meta`.
- Người thực hiện đọc từ biến phiên `app.actor_staff_id`… do tầng ứng dụng set `LOCAL` trong mỗi transaction (xem §2.10). Ngoài transaction (autocommit) vẫn ghi được thay đổi nhưng actor để trống.
- Index theo `changed_at`, `table_name`, `operation`, `actor_staff_id`.

### 1.6 Nâng cấp bảng `staff`

- `status` ENUM(`active`, `disabled`) default `active`.
- `session_version` INT default 0.
- `must_change_password` BOOLEAN default false.
- `last_login_at` TIMESTAMPTZ nullable.
- `password_changed_at` TIMESTAMPTZ nullable.
- **Giữ cột `role` nhưng đổi ENUM → VARCHAR(50)**: đây là **mã vai trò chính**, giữ nguyên giá trị cũ để các chỗ đọc `user.role` không vỡ trong giai đoạn chuyển đổi. Sau khi Phase 3 xong (không còn `@Roles`) mới xem xét bỏ hẳn.
- Backfill `staff_roles` từ `staff.role` hiện có.

### 1.7 Tương thích `user.role`

- `staff.role` tiếp tục là mã vai trò chính cho hiển thị/tương thích; backend và frontend quyết định quyền qua tập permission hiệu lực.
- Quyền hiệu lực đầy đủ được `RbacService` hợp từ các vai trò trong `staff_roles` (fallback về `staff.role` nếu chưa có bản ghi).

---

## 2. Backend

### 2.1 Model mới (`backend/src/database/models/`)

`role.model.ts`, `permission.model.ts`, `role-permission.model.ts`, `staff-role.model.ts`, `auth-audit-log.model.ts`, `db-change-log.model.ts` — đăng ký vào `databaseModels` trong `backend/src/database/database.module.ts`.

### 2.2 Catalog quyền — `backend/src/auth/permissions.ts`

Hằng số + nhóm (dùng chung backend/frontend qua API `/roles/permissions`):

- **Tài khoản**: `account.view`, `account.manage`, `account.password.reset`
- **Phân quyền**: `role.view`, `role.manage`, `audit.view`
- **Danh mục**: `catalog.view`, `catalog.manage`
- **Kế hoạch/CTĐT**: `plan.view`, `plan.manage`
- **Tuyển sinh**: `admission.view`, `admission.manage`
- **Thạc sĩ / Tiến sĩ**: `masters.view`, `masters.manage`, `doctoral.view`, `doctoral.manage`
- **Học vụ**: `scheduling.view`, `scheduling.write`, `scheduling.organize`, `scheduling.assign`, `gradebook.view`, `gradebook.submit`, `gradebook.approve`, `studyleave.manage`
- **Báo cáo**: `reports.view`, `reports.export`
- **Hướng dẫn**: `supervision.review`

Kèm `DEFAULT_ROLE_PERMISSIONS` tái lập **đúng hành vi hiện tại** cho 3 vai trò hệ thống (xem bảng map ở §2.6).

### 2.3 Guard & decorator

- `backend/src/common/permissions.decorator.ts`: `@RequirePermissions("account.manage")` (metadata `PERMISSIONS_KEY`, hỗ trợ nhiều mã = yêu cầu **tất cả**).
- `backend/src/common/permissions.guard.ts`: `PermissionsGuard` — user là `Staff` → **hợp quyền** của tất cả vai trò active rồi so khớp. Mọi vai trò, kể cả `admin`, đi qua cùng cơ chế; không có bypass. Cache theo `staffId` + `sessionVersion`, TTL 30 giây, xóa cache tại instance xử lý khi sửa ma trận/gán vai trò. Nhánh fallback `staff.role` cũng chỉ nhận vai trò active.
- Thay toàn bộ `@Roles` bằng `@RequirePermissions`; xóa `roles.guard.ts`/`auth-user.ts` (`Roles`) khi hoàn tất.
- Chuyển các chỗ đọc `user.role` inline (`course-offering-write.guard.ts`, `exam-gradebook.service.ts`) sang permission tương ứng (`scheduling.organize`, `gradebook.submit`, `gradebook.approve`).
- Cờ `canManageScheduling` **giữ nguyên** (đây là "người phụ trách xếp lịch" dạng chỉ định, không phải `@Roles`) và bổ trợ cho `scheduling.write`.

### 2.4 Module tài khoản & phân quyền

- `backend/src/accounts/`: `accounts.module.ts`, `accounts.controller.ts`, `accounts.service.ts`, `dto/*.dto.ts`.
- `backend/src/roles/`: `roles.module.ts`, `roles.controller.ts`, `roles.service.ts`.
- Kế thừa `StaffService`/`StaffRepository` cho nghiệp vụ tài khoản.

### 2.5 API contract

Tất cả `@UseGuards(AuthenticatedGuard)` + `@RequirePermissions(...)`.

| Method | Path | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/accounts` | `account.view` | Danh sách staff (lọc `status`, `role`, search) |
| POST | `/accounts` | `account.manage` | Tạo staff + mật khẩu ban đầu + `roleIds[]`/`primaryRoleId` |
| GET | `/accounts/:id` | `account.view` | Chi tiết (kèm vai trò) |
| PUT | `/accounts/:id` | `account.manage` | Sửa tên/email; cập nhật vai trò |
| PATCH | `/accounts/:id/status` | `account.manage` | Khóa/mở khóa (bump `session_version` khi khóa) |
| POST | `/accounts/:id/reset-password` | `account.password.reset` | Đặt lại MK, `mustChangePassword=true`, bump version |
| POST | `/accounts/:id/revoke-sessions` | `account.manage` | Buộc đăng xuất |
| GET | `/accounts/audit-logs` | `audit.view` | Nhật ký (lọc actor/action/thời gian, phân trang) |
| GET | `/accounts/me/permissions` | (đăng nhập) | Quyền hiệu lực cho frontend |
| GET | `/roles` | `role.view` | Danh sách vai trò |
| POST | `/roles` | `role.manage` | Tạo vai trò |
| PUT | `/roles/:id` | `role.manage` | Sửa vai trò |
| DELETE | `/roles/:id` | `role.manage` | Xóa (chặn `is_system` / đang được gán) |
| GET | `/roles/permissions` | `role.view` | Catalog quyền theo nhóm |
| PUT | `/roles/:id/permissions` | `role.manage` | Cập nhật ma trận quyền |

Quy tắc nghiệp vụ: mật khẩu ban đầu **nhập tay hoặc sinh ngẫu nhiên** (trả về một lần trong response khi sinh); luôn `mustChangePassword=true`; mọi thao tác ghi đều ghi audit.

### 2.6 Chuyển `@Roles` → permission (toàn bộ 121 chỗ)

Nguyên tắc map (giữ nguyên hành vi bằng `DEFAULT_ROLE_PERMISSIONS`):

| Mẫu `@Roles` hiện tại | Permission thay thế | admin | supervisor | examiner |
| --- | --- | --- | --- | --- |
| `("admin","supervisor","examiner")` lớp (doctora/masters/plan/reports/scheduling/admission-evaluation/study-leave) | `*.view` của module tương ứng | ✓ | ✓ | ✓ |
| `("admin")` (CRUD danh mục, plan, masters admin…) | `*.manage` của module | ✓ | – | – |
| `("admin","examiner")` nhập/gửi điểm và quy chế thi | `gradebook.submit` / `gradebook.policy` | ✓ | – | ✓ |
| `("admin")` duyệt/mở lại điểm | `gradebook.approve` | ✓ | – | – |
| `("supervisor","admin")` (data tobereviewed/submitreview) | `supervision.review` | ✓ | ✓ | – |
| `("supervisor","admin")` room admin-only (profile) | `account.view`/`admission.view` | ✓ | – | – |
| `("admin","supervisor","examiner")` `GET system/rooms` | `catalog.view` | ✓ | ✓ | ✓ |
| `("admin")` reports issue learner-scorecard | `reports.export` | ✓ | – | – |
| `("student")` (user.controller) | giữ nhánh student (không thuộc RBAC staff) | – | – | – |

- Tiến hành **theo module**: `system`, `plan`, `management`, `masters`, `doctoral`, `scheduling`, `reports`, `auth`.
- Sau mỗi module: chạy test, xác nhận 403/200 khớp hành vi cũ, rồi mới sang module kế.
- Kết thúc: xóa `@Roles`, `RolesGuard`, hằng `ROLES_KEY`.

### 2.7 Buộc đăng xuất (thu hồi phiên)

Cơ chế **session version** (không cần đụng bảng `sessions`):

- `SessionSerializer.serializeUser` → key `staff:<id>:<sessionVersion>` (giữ `student:<id>` nguyên).
- `AuthService.deserialize` parse version; nếu staff `status !== 'active'` **hoặc** version khác `staff.sessionVersion` → trả `false` (coi như hết phiên). Vì deserialize đọc DB mỗi request ⇒ hiệu lực tức thì.
- Bump `sessionVersion` khi: khóa tài khoản, đặt lại MK, thay đổi vai trò, hoặc gọi `revoke-sessions`.

### 2.8 Đăng nhập

- `AuthService.validateLocal`: chặn nếu `status !== 'active'` ("Tài khoản đã bị khóa").
- Nếu `mustChangePassword` → cho đăng nhập nhưng frontend buộc đổi MK trước khi dùng tính năng (endpoint đổi MK bắt buộc).
- Cập nhật `lastLoginAt` khi đăng nhập thành công.
- Ghi `auth_audit_logs`: `account.login` (kèm provider local/google), `account.logout`, `account.login.failed` (kèm lý do: `bad_password`/`disabled`/`password_required`, chỉ với tài khoản nhân sự). Ghi best-effort qua `AuthService` + ngữ cảnh request (không chặn đăng nhập nếu ghi lỗi).
- `auth.controller.isStaff` trả `role` code (vai trò chính) như cũ.

### 2.9 Dọn dẹp

- `AddStaffDto` / `POST /admin/addStaff` / `staff/add` → thay bằng `POST /accounts` (route cũ trỏ về service mới trong 1 nhịp rồi bỏ).
- `GET /system/users` (`SystemService.users`) → chuyển sang `AccountsService.list()` và bỏ endpoint cũ khi frontend chuyển xong.

### 2.10 Ngữ cảnh audit & API nhật ký thay đổi

- `audit/audit-context.ts`: `AuditContextService` (AsyncLocalStorage) + `AuditContextMiddleware`. Middleware chạy sau `passport.session()`, gắn `actorStaffId`/`actorEmail` (chỉ khi `request.user instanceof Staff`), `requestId` (header `x-request-id` hoặc UUID), IP, user-agent vào ngữ cảnh request.
- `AuditContextService.onModuleInit()` bọc `sequelize.transaction` để mỗi transaction `SELECT set_config('app.actor_staff_id', …, true)`… → trigger `audit_capture` đọc được người thực hiện.
- `audit/change-log.service.ts`: `list()` (lọc theo bảng/hành động/actor/khoảng ngày + phân trang) và `tables()` (danh sách bảng có vết).
- API: `GET /accounts/change-logs` và `GET /accounts/change-logs/tables` (quyền `audit.view`).

---

## 3. Frontend

### 3.1 Service layer

- `frontend/src/features/accounts/api.js` — tài khoản + audit.
- `frontend/src/features/accounts/rolesApi.js` — vai trò + ma trận quyền.
- Dùng `API_BASE_URL`, `withCredentials`; tách khỏi component.

### 3.2 Trang & component

- **`frontend/src/pages/system/accounts.jsx`** — bảng tài khoản: toolbar tìm kiếm + lọc (trạng thái, vai trò); cột Họ đệm/Tên/Email/Vai trò (chính + phụ)/Trạng thái/Hành động; dialog Thêm (tên, email, mật khẩu ban đầu hoặc "sinh tự động", chọn nhiều vai trò + vai trò chính), Sửa, Khóa/Mở, Đặt lại MK, Buộc đăng xuất; `ConfirmDialog` cho thao tác nguy hiểm. Dùng `FeatureLayout`, `ResizableTable`, `AppDialog`, `ConfirmDialog`.
- **`frontend/src/pages/system/roles.jsx`** — danh sách vai trò + **ma trận quyền** (permission × checkbox, nhóm theo module); tạo/sửa/xóa vai trò tùy chỉnh.
- **`frontend/src/pages/system/auditLogs.jsx`** — nhật ký, lọc + phân trang.
- **Bắt buộc đổi mật khẩu**: khi `mustChangePassword` → chặn điều hướng tới trang đổi mật khẩu đến khi đổi xong (xử lý trong `ProtectedRoute`/`AppLayout`).
- `pages/system/users.jsx` cũ: chuyển chức năng "chuyển quyền xếp lịch" thành một hành động trong trang accounts.

### 3.3 Định tuyến & điều hướng

- `frontend/src/App.js`: thêm `system/accounts`, `system/roles`, `system/audit-logs` (lazyPage + `<Route>`).
- `RibbonHeader.jsx`: các mục chức năng kiểm tra permission từ `me/permissions`; không suy quyền từ tên vai trò hoặc cờ toàn quyền.
- Nạp `/accounts/me/permissions` vào `AuthSessionContext`; thay các kiểm tra `role === "admin"` quyết định quyền bằng permission cụ thể.

---

## 4. Kiểm thử

Tổ chức theo `backend/test/` và `frontend/src/test/`.

- Unit backend: `PermissionsGuard` (union nhiều vai trò active, admin không được bypass, thiếu quyền), session-version invalidation, `AccountsService` (trùng email, khóa, reset MK, sinh MK), ràng buộc 1 vai trò chính, `ChangeLogService` (lọc/phân trang/danh sách bảng).
- Integration backend: `/accounts`, `/roles` (401/403/200, ma trận quyền) — phủ bằng unit test guard + smoke HTTP thực tế, và **spec chạm DB thật** `test/integration/accounts-roles-postgres.spec.ts` (bật bằng `RUN_POSTGRES_ACCOUNT_TESTS=true`) kiểm chứng tạo tài khoản/vai trò, đổi quyền, audit `auth_audit_logs` + trigger `db_change_logs`; **regression toàn bộ API sau khi thay `@Roles`** (ma trận 200/403 theo vai trò).
- Integration frontend: render accounts/roles, ẩn nút khi thiếu quyền, luồng reset MK + xác nhận, cập nhật ma trận quyền, buộc đổi MK, hai tab nhật ký (`AuditLogs.test.jsx`).
- Gỡ `SystemUsers.test.jsx` (trang cũ không còn).

Lệnh: `npm test`, `npm run test:coverage` (từ thư mục gốc).

---

## 5. Lộ trình thực hiện (phases)

### Phase 1 — Nền tảng dữ liệu & RBAC core ✅ (đã xong)
1. ✅ Migration `062` (bảng + cột + seed roles/permissions/role_permissions + backfill `staff_roles`).
2. ✅ Model mới (`role`, `permission`, `role-permission`, `staff-role`, `auth-audit-log`) + đăng ký `database.module.ts`.
3. ✅ `permissions.ts` catalog + `DEFAULT_ROLE_PERMISSIONS`.
4. ✅ `@RequirePermissions` + `PermissionsGuard` + `RbacService` + `RbacModule` (global).
5. ✅ Giữ `staff.role` (VARCHAR, vai trò chính) để tương thích `user.role`.
6. ✅ Seed đồng bộ: `npm run db:seed:auth`.
7. ✅ Unit test: `rbac.service.spec.ts`, `permissions.guard.spec.ts` (590 test pass).

### Phase 2 — Nghiệp vụ tài khoản & phân quyền ✅ (đã xong)
1. ✅ `AccountsModule` + service/controller + DTO (`POST /accounts` sinh MK ban đầu hoặc nhập tay, luôn `mustChangePassword`; đa vai trò + vai trò chính; khóa/mở; reset MK; buộc đăng xuất; `GET /accounts/me/permissions`).
2. ✅ `RolesModule` + service/controller + ma trận quyền (`GET /roles`, `GET /roles/permissions`, tạo/sửa/xóa vai trò tùy tạo, `PUT /roles/:id/permissions`).
3. ✅ Session-version: khóa tài khoản / reset MK / buộc đăng xuất đều tăng `session_version` → phiên cũ bị vô hiệu; chặn đăng nhập khi `status = disabled`; cập nhật `last_login_at`.
4. ✅ `AuditService` (`@Global`) ghi `auth_audit_logs` cho mọi thao tác + `GET /accounts/audit-logs` lọc/phân trang.
5. ✅ Bảo vệ quản trị cuối: chặn tự khóa và chặn mất nhân sự có đủ quyền quản lý tài khoản/vai trò cuối cùng (cập nhật Phase 8); chặn xóa vai trò đang gán / vai trò hệ thống.
6. ✅ Test: `accounts.service.spec.ts`, `roles.service.spec.ts` + kiểm chứng HTTP thực tế (tạo vai trò/tài khoản, 403 khi thiếu quyền, 401 sau khi khóa, 409 các ràng buộc).

### Phase 3 — Chuyển toàn bộ `@Roles` → permission ✅ (đã xong)
1. ✅ Chuyển 118/121 `@Roles` sang `@RequirePermissions` theo module (`system` → `plan` → `management` → `masters` → `doctoral` → `scheduling` → `reports`), dùng quyền `.view` ở cấp class và `.manage`/`.approve`/`.submit`/`.export` cho thao tác ghi.
2. ✅ 3 `@Roles("student")` (đổi MK, nộp bài, ảnh) → `StudentGuard` riêng (nhân sự không thuộc RBAC).
3. ✅ `course-offering-write.guard` → kiểm tra `scheduling.organize` qua `RbacService` (cập nhật Phase 8); `exam-gradebook.service.transition` → `gradebook.submit`/`gradebook.approve`.
4. ✅ Bổ sung quyền `scheduling.assign` (phân công quản lý lịch) và `gradebook.policy` (quy chế chấm điểm); cập nhật `DEFAULT_ROLE_PERMISSIONS` giữ đúng hành vi cũ (examiner nhập/gửi điểm, không duyệt điểm).
5. ✅ Xóa `@Roles`, `ROLES_KEY`, `RolesGuard`; cập nhật guard trong module + test metadata.
6. ✅ Typecheck + build sạch; 654 test pass; smoke HTTP thực tế: admin 200 toàn bộ, tài khoản chỉ có `plan.view` bị 403 đúng chỗ, ghi bị chặn.


### Phase 4 — Frontend ✅ (đã xong)
1. ✅ Service layer: `frontend/src/features/accounts/api.js` (tài khoản + audit + đổi MK), `rolesApi.js` (vai trò + ma trận quyền), `constants.js` (nhãn), `usePermissions.js` (hook quyền từ `AuthSessionContext`).
2. ✅ `pages/system/accounts.jsx`: bảng tài khoản (tìm kiếm + lọc trạng thái/vai trò + phân trang); dialog Thêm/Sửa (đa vai trò + vai trò chính, mật khẩu ban đầu nhập tay hoặc sinh tự động); khóa/mở khóa, đặt lại MK (dialog + hiển thị MK đã sinh), buộc đăng xuất, phân công phụ trách xếp lịch; `ConfirmDialog` cho thao tác nguy hiểm; ẩn/hiện nút theo quyền.
3. ✅ `pages/system/roles.jsx`: danh sách vai trò + ma trận quyền nhóm theo module (tick chọn, chọn cả nhóm); tạo/sửa/xóa vai trò tùy chỉnh, tạm ẩn/kích hoạt; chặn xóa vai trò hệ thống/đang gán; ma trận chỉnh được cho cả admin (cập nhật Phase 8).
4. ✅ `pages/system/auditLogs.jsx`: nhật ký lọc theo hành động + khoảng ngày, phân trang phía máy chủ.
5. ✅ `pages/system/changePassword.jsx`: form đổi MK (kiểm tra hiện tại/mới/xác nhận), gọi `PATCH /accounts/me/password`, làm mới phiên rồi về trang chủ.
6. ✅ Backend bổ sung: `PATCH /accounts/me/password` (`ChangeOwnPasswordDto`, `AccountsService.changeOwnPassword`) để nhân sự tự đổi MK — phục vụ luồng "buộc đổi MK".
7. ✅ `ProtectedRoute.jsx`: nạp `/accounts/me/permissions` vào `AuthSessionContext` (kèm `refresh`), buộc chuyển tới trang đổi MK khi `mustChangePassword`.
8. ✅ `RibbonHeader.jsx`: thêm nhóm "TÀI KHOẢN & PHÂN QUYỀN" (Tài khoản nhân sự / Vai trò & phân quyền / Nhật ký thao tác), ẩn/hiện theo quyền; bỏ mục "QL Người dùng".
9. ✅ `App.js`: route `system/accounts`, `system/roles`, `system/audit-logs`; `/system/users` chuyển hướng về `/system/accounts`.
10. ✅ Kiểm chứng: build backend + frontend sạch; backend 654 test pass; các test frontend liên quan (ProtectedRoute, schedulingNavigation, SystemUsers) pass; lỗi test frontend còn lại là **có sẵn từ trước** (đã xác nhận bằng cách stash thay đổi Phase 4 rồi chạy lại).

### Phase 5 — Dọn dẹp, test, tài liệu ✅ (đã xong)
1. ✅ Bỏ luồng thêm nhân sự cũ: xóa `addStaffPage.js`, `addStaff.jsx`, route `/addStaff`, `AdminController` (`POST /admin/addStaff`), `AddStaffDto` và `StaffService.add` (kèm `NotificationService` không còn dùng).
2. ✅ Bỏ `GET /system/users` (`SystemController.users` + `SystemService.users`) và trang cũ `pages/system/users.jsx`; `/system/users` vẫn chuyển hướng về `/system/accounts`.
3. ✅ Test frontend mới: `Accounts.test.jsx` (liệt kê, ẩn nút theo quyền, tạo tài khoản + MK sinh tự động, đặt lại MK, lọc), `Roles.test.jsx` (render vai trò hệ thống, tick ma trận + lưu, khóa khi thiếu quyền, tạo vai trò), `ChangePassword.test.jsx` (buộc đổi MK + validate); bổ sung case buộc đổi MK vào `ProtectedRoute.test.jsx`. Gỡ `SystemUsers.test.jsx` (trang không còn).
4. ✅ Cập nhật `README.md`: bảng dữ liệu RBAC, mục "Quản lý tài khoản & phân quyền (migration 062)", tính năng chính và mục scheduling.
5. ✅ `npm --prefix backend run db:migrate` + `db:seed:auth` (idempotent, chạy lại an toàn); build backend + frontend sạch; chạy toàn bộ test backend + frontend.
6. ✅ Thay nốt kiểm tra `user.role === "admin"` còn sót ở `GET /system/rooms` (`includeInactive`) bằng quyền `catalog.manage` qua `RbacService`; cập nhật `test/unit/system-room.service.spec.ts`.

### Phase 6 — Nhật ký thay đổi dữ liệu cấp DB ✅ (đã xong)
1. ✅ Migration `063-db-change-logs.ts`: bảng `db_change_logs` + hàm trigger `audit_capture()` + gắn trigger cho mọi bảng nghiệp vụ (loại trừ `db_change_logs`, `auth_audit_logs`, `sessions`, `sequelize_meta`).
2. ✅ Model `db-change-log.model.ts` (chỉ đọc) + đăng ký `databaseModels`.
3. ✅ `audit/audit-context.ts`: `AuditContextService` (AsyncLocalStorage) + `AuditContextMiddleware`; bọc `sequelize.transaction` để set biến phiên PostgreSQL `LOCAL` cho người thực hiện/request id/IP/user-agent; gắn middleware sau `passport.session()` trong `app.module.ts`.
4. ✅ `audit/change-log.service.ts` + API `GET /accounts/change-logs`, `GET /accounts/change-logs/tables` (quyền `audit.view`) qua `AccountsService`.
5. ✅ Frontend: `pages/system/auditLogs.jsx` chuyển thành 2 tab ("Thao tác quản lý" | "Thay đổi dữ liệu"), lọc theo bảng/hành động/khoảng ngày; bổ sung `listChangeLogs`/`listChangeLogTables` + nhãn bảng/hành động trong `features/accounts`.
6. ✅ Test: `backend/test/unit/change-log.service.spec.ts` (3 case), `frontend/src/test/integration/AuditLogs.test.jsx` (2 case).
7. ✅ Kiểm chứng đầu-cuối: cập nhật quyền vai trò (trong transaction) → 23 dòng `role_permissions` kèm đầy đủ actor/request id/IP; đăng nhập (ngoài transaction) → ghi `staff` UPDATE, actor trống. `db:migrate` chạy sạch (063 áp dụng); typecheck/build backend + build frontend sạch; backend 657 test pass.

### Phase 7 — Ghi nhận đăng nhập/đăng xuất & mô tả tab ✅ (đã xong)
1. ✅ `AuthService`: ghi `account.login` (provider `local`/`google`), `account.logout`, `account.login.failed` (lý do `bad_password`/`disabled`/`password_required`; chỉ với nhân sự) vào `auth_audit_logs`, kèm IP/user-agent/request id từ ngữ cảnh; ghi best-effort (không chặn đăng nhập nếu ghi lỗi).
2. ✅ `UserController.logout` gọi `AuthService.recordLogout` cho nhân sự trước khi hủy phiên.
3. ✅ Frontend: thêm nhãn "Đăng nhập"/"Đăng xuất"/"Đăng nhập thất bại" vào bộ lọc tab "Thao tác quản lý"; thêm **dòng mô tả vai trò của từng tab** ngay dưới thanh tab.
4. ✅ Kiểm chứng: đăng nhập sai → `account.login.failed` (401); đăng nhập đúng → `account.login` (200, có actor); đăng xuất → `account.logout` (302, có actor); lọc API `action=account.login.failed` trả đúng kèm `target`. Backend 657 test pass; build frontend + test `AuditLogs.test.jsx` (2 case) pass.

---

### Phase 8 — Thống nhất admin vào RBAC permission ✅ (2026-10-19)
1. ✅ Tác nhân duy nhất của RBAC là `Staff`; admin là vai trò dựng sẵn, có ma trận permission chỉnh được như các vai trò khác. Loại `isSuperadmin` khỏi model/API/frontend và mọi nhánh bypass.
2. ✅ Migration `064-unified-role-permissions.ts`: thêm `scheduling.organize`; chuyển đặc quyền của các vai trò `is_superadmin=true` cũ thành các dòng `role_permissions` tường minh để giữ quyền đang có, rồi bỏ cột `is_superadmin`. Đã áp dụng trên DB đang cấu hình.
3. ✅ `RbacService` chỉ hợp quyền từ vai trò active, kể cả fallback; các guard và nghiệp vụ bảng điểm chỉ kiểm tra permission. Mã `admin` chỉ còn phục vụ bộ quyền khởi tạo/hiển thị.
4. ✅ Bảo vệ người quản trị cuối theo hợp bốn quyền `account.view`, `account.manage`, `role.view`, `role.manage`; khóa transaction chung và kiểm tra trạng thái sau thay đổi. Cho phép chuyển quyền quản trị sang vai trò tùy chỉnh hoặc nhiều vai trò trước khi hạ quyền/tắt admin.
5. ✅ Đổi vai trò nhân sự tăng `session_version` nguyên tử trong cùng transaction. `is_system` bảo vệ khỏi xóa/đổi mã; vẫn cho sửa permission và bật/tắt nếu còn người quản trị hiệu lực.
6. ✅ Frontend bỏ kiểm tra tên vai trò quyết định quyền ở danh mục, kế hoạch, tuyển sinh, học viên, lớp học phần, bảng điểm và ribbon. Trang vai trò hiển thị ma trận cho admin.
7. ✅ `db:seed:auth` chỉ cấp bộ quyền mặc định khi tạo vai trò mới, không tự cấp lại quyền đã bị gỡ khi chạy seed lần sau. Permission bổ sung sau này phải được gán có chủ đích bằng migration hoặc ma trận; không mặc nhiên cấp cho admin.
8. ✅ Kiểm chứng: backend build/typecheck sạch, 667 test mặc định pass; bộ integration PostgreSQL bật riêng có 8 test pass; frontend build sạch. Toàn bộ frontend: 623 pass, 9 fail trong 5 file. Đã tái hiện 8 lỗi trên checkout gốc `53feac6` (`themeTypography`, `AssignClassGroups`, `GradeSettingsDialog`, 2 ca `LecturerUnits`, 3 ca `ScheduleCalendar`); ca lịch tuần còn lại timeout khi chạy chung nhưng pass khi chạy riêng. Các test ma trận admin, hook permission, tài khoản, ProtectedRoute và tạo nhóm đều pass. Không đánh dấu toàn suite frontend là xanh.
9. ✅ Kiểm tra DB sau migration: 28 permission, admin có 28 dòng quyền tường minh, không còn cột `is_superadmin`, vẫn còn nhân sự có đủ quyền quản trị.

---

## 6. Rủi ro & biện pháp

- **Bán kính `@Roles` (121 chỗ)**: chuyển theo từng module + bảng map cố định + regression 200/403 sau mỗi module.
- **Tương thích `user.role`**: giữ `staff.role` (VARCHAR) là mã vai trò chính để hiển thị/tương thích dữ liệu; không dùng để suy ra quyền truy cập.
- **Hiệu năng guard**: cache theo `staffId` + `sessionVersion`, TTL 30 giây, invalidate tại instance xử lý khi sửa matrix/gán vai trò. Khi chạy nhiều instance, việc thu hồi quyền qua ma trận có thể trễ tối đa TTL ở instance khác.
- **Bảo vệ người quản trị cuối**: sau thay đổi phải còn ít nhất một nhân sự active có đủ `account.view`, `account.manage`, `role.view`, `role.manage` qua hợp quyền các vai trò active. Kiểm tra trong cùng transaction, dùng `pg_advisory_xact_lock` chung cho sửa vai trò nhân sự, khóa tài khoản, sửa/tắt/xóa vai trò và sửa ma trận. Chặn tự khóa mình.
- **Xóa vai trò đang gán**: chặn ở service + FK RESTRICT.
- **Ràng buộc "≥1 vai trò"**: không ép được ở DB → validate ở service khi tạo/sửa và khi xóa vai trò.
- **Audit retention**: bảng `auth_audit_logs` và `db_change_logs` tăng theo thời gian → thêm job/`DELETE` theo thời hạn cấu hình (để lại ngoài phạm vi đợt này).
- **Khối lượng nhật ký thay đổi dữ liệu**: bulk operations/seed sinh nhiều dòng → có index theo bảng/thời gian; nên lọc theo khoảng ngày khi xem.
- **Gắn ngữ cảnh actor**: chỉ đáng tin trong transaction (biến phiên `LOCAL`); thao tác autocommit vẫn ghi được thay đổi nhưng actor trống — chấp nhận (best-effort), vì các thao tác tài khoản/vai trò quan trọng đã có `auth_audit_logs` kèm actor.

---

## 7. Quyết định đã chốt

1. Chuyển **toàn bộ 121 `@Roles`** sang permission ngay trong đợt này.
2. Mật khẩu ban đầu: **nhập tay hoặc sinh ngẫu nhiên**, luôn `mustChangePassword`.
3. **Nhiều vai trò / một nhân sự** (bảng `staff_roles`), giữ 1 vai trò chính cho tương thích `user.role`.
4. **Nhật ký thay đổi dữ liệu dùng trigger DB** (không ghi thủ công ở service) để phủ 100% thay đổi; người thực hiện gắn best-effort qua biến phiên trong transaction. Xem ở **tab trong trang "Nhật ký thao tác"** hiện có.

5. **Mọi vai trò dùng permission tường minh**: không còn superadmin hoặc nhánh kiểm tra tên admin để cấp quyền. Bộ quyền mặc định không phải đặc quyền cố định.
6. **Ranh giới đợt sửa 2026-10-19**: xử lý thiết kế admin/RBAC, vai trò active, bảo vệ người quản trị cuối và thu hồi phiên khi gán vai trò. Các phát hiện review khác (lọc trường nhạy cảm trong DB log, buộc đổi mật khẩu ở backend, phiên cũ thiếu version) còn cần xử lý riêng; không coi Phase 8 đã khắc phục các mục đó.
