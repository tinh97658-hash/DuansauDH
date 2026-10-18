# KẾ HOẠCH: MODULE QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (RBAC)

> Trạng thái: **Kế hoạch** — chưa triển khai.
> Ngày lập: 2026-10-18
> Phạm vi áp dụng: `backend/` (NestJS 11 + Sequelize + Umzug) và `frontend/` (React + MUI).

---

## 0. Chốt phạm vi

- **Mô hình phân quyền**: RBAC đầy đủ — bảng `roles`, `permissions`, `role_permissions`; admin tự tạo vai trò và tick quyền.
- **Đối tượng quản lý**: chỉ tài khoản **cán bộ/nhân sự** (`staff`). Không đụng luồng học viên.
- **Vòng đời tài khoản**: tạo kèm mật khẩu ban đầu · khóa/mở khóa · admin đặt lại mật khẩu · buộc đăng xuất · audit log.
- **Giữ tương thích**: API vẫn trả `role` dạng **mã chuỗi** (`admin`/`supervisor`/`examiner`) để các chỗ frontend `session.user.role === "admin"` không vỡ.

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
| `is_system` | BOOLEAN default false | vai trò hệ thống, không cho xóa/đổi code |
| `is_superadmin` | BOOLEAN default false | bỏ qua mọi kiểm tra quyền (gán cho `admin`) |
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

### 1.4 Bảng `auth_audit_logs`

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

Hành động ghi log: `staff.create`, `staff.update`, `staff.disable`, `staff.enable`, `staff.password.reset`, `staff.session.revoke`, `role.create`, `role.update`, `role.delete`, `role.permissions.update`.

Index theo `created_at`, `target_staff_id`.

### 1.5 Nâng cấp bảng `staff`

- `role_id` UUID FK→`roles` ON DELETE RESTRICT (nullable trong lúc migrate).
- `status` ENUM(`active`, `disabled`) default `active`.
- `session_version` INT default 0.
- `must_change_password` BOOLEAN default false.
- `last_login_at` TIMESTAMPTZ nullable.
- `password_changed_at` TIMESTAMPTZ nullable.
- **Backfill**: với mỗi staff, tìm role theo cột `role` hiện tại → gán `role_id`.
- Sau backfill có thể drop cột enum `role` (xem 1.6).
- `down`: khôi phục cột enum `role` + xóa các bảng mới.

### 1.6 Chiến lược tương thích `staff.role`

- Thêm association `belongsTo(Role, { as: "roleRef" })` và **virtual** `role` trên model trả `roleRef.code`.
- Repository luôn eager-load `roleRef` (`include` trong `findById`, `findByEmail`, default scope).
- ⇒ `request.user.role`, `@Roles`, `user.role === "admin"` (frontend) **không đổi**. Sau đó mới xóa cột enum.

---

## 2. Backend

### 2.1 Model mới (`backend/src/database/models/`)

`role.model.ts`, `permission.model.ts`, `role-permission.model.ts`, `auth-audit-log.model.ts` — đăng ký vào mảng `databaseModels` trong `backend/src/database/database.module.ts`.

### 2.2 Catalog quyền — `backend/src/auth/permissions.ts`

Hằng số + nhóm:

- Tài khoản: `account.view`, `account.manage`, `account.password.reset`
- Phân quyền: `role.view`, `role.manage`, `audit.view`
- Danh mục: `catalog.view`, `catalog.manage`
- Kế hoạch/CTĐT: `plan.view`, `plan.manage`
- Tuyển sinh: `admission.view`, `admission.manage`
- Thạc sĩ / Tiến sĩ: `masters.view`, `masters.manage`, `doctoral.view`, `doctoral.manage`
- Học vụ: `scheduling.view`, `scheduling.write`, `gradebook.view`, `gradebook.submit`, `gradebook.approve`, `studyleave.manage`
- Báo cáo: `reports.view`, `reports.export`

Kèm `DEFAULT_ROLE_PERMISSIONS` tái lập hành vi hiện tại (admin = superadmin; supervisor/examiner theo các `@Roles` đang có).

### 2.3 Guard & decorator

- `backend/src/common/permissions.decorator.ts`: `@RequirePermissions("account.manage")` (metadata `PERMISSIONS_KEY`).
- `backend/src/common/permissions.guard.ts`: `PermissionsGuard` — lấy `request.user` (Staff), resolve role → permission codes, cache ngắn hạn (Map + TTL ~30s, invalidate khi sửa matrix); superadmin bypass.
- Giữ `RolesGuard` cho `@Roles` cũ; chuyển dần từng controller sang `@RequirePermissions` (Phase 3).

### 2.4 Module tài khoản — `backend/src/accounts/`

- `accounts.module.ts`, `accounts.controller.ts`, `accounts.service.ts`, `dto/*.dto.ts`.
- Mở rộng `StaffService`/`StaffRepository` cho nghiệp vụ tài khoản.

### 2.5 API contract

Tất cả đều `@UseGuards(AuthenticatedGuard)` + kiểm tra quyền.

| Method | Path | Quyền | Chức năng |
| --- | --- | --- | --- |
| GET | `/accounts` | `account.view` | Danh sách staff (lọc `status`, `role`, search) |
| POST | `/accounts` | `account.manage` | Tạo staff + mật khẩu ban đầu (bcrypt cost 12) |
| GET | `/accounts/:id` | `account.view` | Chi tiết |
| PUT | `/accounts/:id` | `account.manage` | Sửa tên/email/vai trò |
| PATCH | `/accounts/:id/status` | `account.manage` | Khóa/mở khóa (bump `session_version` khi khóa) |
| POST | `/accounts/:id/reset-password` | `account.password.reset` | Đặt lại MK, `must_change_password=true`, bump version |
| POST | `/accounts/:id/revoke-sessions` | `account.manage` | Buộc đăng xuất |
| GET | `/accounts/audit-logs` | `audit.view` | Nhật ký (lọc actor/action/thời gian, phân trang) |
| GET | `/roles` | `role.view` | Danh sách vai trò |
| POST | `/roles` | `role.manage` | Tạo vai trò |
| PUT | `/roles/:id` | `role.manage` | Sửa vai trò |
| DELETE | `/roles/:id` | `role.manage` | Xóa (chặn `is_system` / đang được gán) |
| GET | `/roles/permissions` | `role.view` | Catalog quyền theo nhóm |
| PUT | `/roles/:id/permissions` | `role.manage` | Cập nhật ma trận quyền |
| GET | `/accounts/me/permissions` | (đăng nhập) | Quyền hiệu lực cho frontend |

Ghi audit cho mọi thao tác ghi, lấy `actor` từ `@CurrentUser()`.

### 2.6 Buộc đăng xuất (thu hồi phiên)

Dùng cơ chế **session version** (không cần đụng bảng `sessions`):

- `SessionSerializer.serializeUser` → key `staff:<id>:<sessionVersion>` (giữ `student:<id>` nguyên).
- `AuthService.deserialize` parse version; nếu staff `status !== 'active'` **hoặc** version khác `staff.sessionVersion` → trả `false` (coi như hết phiên). Vì deserialize đọc DB mỗi request ⇒ hiệu lực tức thì.
- Bump `sessionVersion` khi: khóa tài khoản, đặt lại MK, đổi vai trò, hoặc gọi `revoke-sessions`.

### 2.7 Đăng nhập

- `AuthService.validateLocal`: chặn nếu `status !== 'active'` ("Tài khoản đã bị khóa").
- Cập nhật `lastLoginAt` khi đăng nhập thành công.
- `auth.controller.isStaff` trả `role` code (giữ nguyên).

### 2.8 Dọn dẹp

- `AddStaffDto`/`POST /admin/addStaff` và `staff/add` → thay bằng `POST /accounts` (giữ route cũ trỏ về service mới trong 1 nhịp để không vỡ, sau đó bỏ).
- `GET /system/users` (`SystemService.users`) → để nguyên hoặc trỏ sang `AccountsService.list()`.

---

## 3. Frontend

### 3.1 Service layer

`frontend/src/features/accounts/api.js` (axios, dùng `API_BASE_URL`, `withCredentials`) — tách khỏi component.

### 3.2 Trang & component

- **`frontend/src/pages/system/accounts.jsx`** — bảng tài khoản: toolbar tìm kiếm + lọc (trạng thái, vai trò); cột Họ đệm/Tên/Email/Vai trò/Trạng thái/Hành động; dialog Thêm (tên, email, vai trò, mật khẩu ban đầu), Sửa, Khóa/Mở, Đặt lại MK, Buộc đăng xuất; `ConfirmDialog` cho thao tác nguy hiểm. Dùng `FeatureLayout`, `ResizableTable`, `AppDialog`, `ConfirmDialog`.
- **`frontend/src/pages/system/roles.jsx`** — danh sách vai trò + **ma trận quyền** (bảng permission × checkbox, nhóm theo module); tạo/sửa/xóa vai trò tùy chỉnh.
- **`frontend/src/pages/system/auditLogs.jsx`** — nhật ký, lọc + phân trang.
- Trang `pages/system/users.jsx` cũ: giữ chức năng "chuyển quyền xếp lịch" như một hành động trong trang accounts (hoặc giữ riêng).

### 3.3 Định tuyến & điều hướng

- `frontend/src/App.js`: thêm `system/accounts`, `system/roles`, `system/audit-logs` (lazyPage + `<Route>`).
- `frontend/src/components/AppLayout.jsx` (nhóm "DANH MỤC & HỆ THỐNG") và `RibbonHeader.jsx`: thêm mục với `roles: ["admin"]`.
- Nạp `/accounts/me/permissions` vào `AuthSessionContext` để ẩn/hiện nút theo quyền (thay dần `role === "admin"`).

---

## 4. Kiểm thử

Tổ chức theo `backend/test/` và `frontend/src/test/`.

- Unit backend: `PermissionsGuard` (role thường, superadmin, thiếu quyền), session-version invalidation, `AccountsService` (tạo trùng email, khóa, reset MK).
- Integration backend: endpoints `/accounts`, `/roles`, `/roles/:id/permissions` (401/403/200, audit được ghi).
- Integration frontend: render trang accounts, ẩn nút khi thiếu quyền, luồng đặt lại MK + xác nhận (mock axios), cập nhật ma trận quyền.
- Cập nhật `frontend/src/test/integration/SystemUsers.test.jsx` nếu thay trang users.

Lệnh: `npm test`, `npm run test:coverage` (từ thư mục gốc).

---

## 5. Thứ tự thực hiện (phases)

### Phase 1 — Nền tảng dữ liệu & RBAC core
1. Migration `062` (bảng + cột + backfill).
2. Model mới + đăng ký `database.module.ts`.
3. `permissions.ts` catalog + seed.
4. `@RequirePermissions` + `PermissionsGuard`.
5. Virtual `role` + eager-load `roleRef` (đảm bảo `user.role` không đổi).

### Phase 2 — Nghiệp vụ tài khoản (module `accounts`)
6. `AccountsModule` + service/controller + DTO.
7. Session-version (serializer/deserialize) + chặn đăng nhập khi khóa + `lastLoginAt`.
8. Audit service ghi log.
9. Roles/permissions API.

### Phase 3 — Migration `@Roles` → quyền
10. Chuyển từng controller (`system`, `plan`, `masters`, `doctoral`, `scheduling`, `reports`, `management`, `auth`) sang `@RequirePermissions`, theo `DEFAULT_ROLE_PERMISSIONS` để giữ nguyên hành vi.
11. Bỏ `@Roles`/`RolesGuard` khi đã chuyển hết (hoặc giữ cho vài endpoint cố định).

### Phase 4 — Frontend
12. Service + 3 trang + routing + nav + `me/permissions`.

### Phase 5 — Dọn dẹp, test, tài liệu
13. Bỏ `addStaffPage`/`addStaff.jsx` cũ sau khi thay thế.
14. Test + cập nhật `README.md` (mục tính năng + migration).
15. `npm --prefix backend run db:migrate` + seed; chạy build/lint.

---

## 6. Rủi ro & quyết định

- **Bán kính `staff.role`**: ~121 `@Roles` + nhiều chỗ đọc `user.role`. Giảm rủi ro bằng virtual `role` + eager-load (giữ API trả code như cũ).
- **Hiệu năng guard**: mỗi request tra role→permissions; dùng cache TTL + invalidate khi sửa matrix.
- **Bảo vệ admin cuối**: chặn khóa/hạ quyền admin cuối cùng và tự khóa mình.
- **Xóa role đang gán**: chặn ở service + FK RESTRICT.
- **Audit retention**: nên có job/`DELETE` theo thời hạn (cấu hình), hoặc bỏ qua ở phạm vi này.

---

## 7. Câu hỏi mở cần chốt

1. Chuyển toàn bộ 121 `@Roles` sang permission ngay trong đợt này, hay chỉ Phase 1–2 trước rồi Phase 3 sau?
2. Mật khẩu ban đầu: admin **tự nhập**, hay hệ thống **sinh ngẫu nhiên** + bắt đổi lần đầu? (đề xuất: cho nhập tay hoặc sinh, luôn `mustChangePassword`).
3. Có cần **nhiều vai trò / một nhân sự** không? (mặc định 1 vai trò chính để giữ tương thích).
