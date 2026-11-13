# Hệ thống quản lý đào tạo sau đại học

Hệ thống nội bộ của **Viện Đào tạo Sau đại học – Trường Đại học Hàng hải Việt Nam**, phục vụ quản lý hồ sơ, tiến độ và các lần nộp báo cáo của học viên, nghiên cứu sinh. Hệ thống không hỗ trợ đăng ký tài khoản công khai; tài khoản được cấp và quản lý nội bộ. Toàn bộ lớp dữ liệu sử dụng PostgreSQL.

## Cài đặt cỡ chữ giao diện

Vào **Hệ thống → Cài đặt hệ thống → Cài đặt giao diện** để chọn cỡ chữ từ **90% đến 150%**, mỗi mức cách nhau 10%. Thay đổi áp dụng ngay, lưu trên trình duyệt hiện tại và có nút **Khôi phục mặc định**. Cài đặt này dành cho từng trình duyệt, không thay đổi cấu hình của người dùng khác.

Nội dung dài xuống dòng trong ô bảng; các vùng một dòng giữ giới hạn hiển thị. Chỉ điều chỉnh chữ, giữ nguyên độ rộng cột, vị trí cột cố định và điểm neo menu. Các mẫu in và tệp xuất giữ cỡ chữ theo mẫu.

## Quản lý năm đào tạo

Vào **Hệ thống → Danh mục đào tạo → Năm đào tạo** để thêm/sửa năm và ngày bắt đầu, hoặc bật/tắt năm trong danh sách chọn. Combobox năm của hồ sơ tuyển sinh/học viên và chương trình đào tạo lấy dữ liệu từ danh mục này.

Migration `098-training-years` tạo danh mục, giữ các năm đang có trong hồ sơ/lớp và khởi tạo ngày bắt đầu là **01/01** của từng năm. Cần chỉnh lại ngày bắt đầu theo thực tế. Khi cập nhật môi trường khác, chạy `npm run db:migrate` rồi khởi động lại backend.

## Công nghệ

Cấu trúc repository và quy trình production: xem [hướng dẫn triển khai](docs/deployment.md).
Các tài liệu nghiệp vụ, kế hoạch và báo cáo được tổng hợp tại [docs/README.md](docs/README.md).

Phân quyền theo hồ sơ làm việc, cây module và quyền xem/ghi: xem [hướng dẫn phân quyền](docs/working-profiles-permission-tree.md).

Dữ liệu demo nhập điểm, lịch sử giảng dạy và tạo lịch thi: xem [hướng dẫn demo thi](docs/exam-demo.md), chạy riêng bằng `npm --prefix backend run db:seed:exam-demo`.

- Frontend: React 18, React Router 7, Vite, Material UI, Bootstrap và Axios.
- Backend: Node.js 22, NestJS 11, Passport, class-validator, bcrypt, Multer và Nodemailer.
- Database: PostgreSQL 16.
- ORM: Sequelize TypeScript qua `@nestjs/sequelize`, với repository và service được dependency injection quản lý.
- Migration: Umzug, có lịch sử migration trong PostgreSQL.
- Hạ tầng: Docker Compose và Nginx.
- Quản trị database: pgAdmin 4.

## Cấu trúc dữ liệu

Schema chia làm **bảng chung** (danh mục dùng chung + nhân sự/học viên) và
**bảng riêng** theo từng nhóm chức năng trên header (kế hoạch khóa mới, đào tạo
thạc sĩ, đào tạo tiến sĩ, báo cáo). Toàn bộ do migration quản lý (không dùng
`sequelize.sync()`).

### Bảng chung

| Bảng | Mục đích |
| --- | --- |
| `students`, `staff`, `staff_students`, `submissions` | Học viên, nhân sự, quan hệ và nộp hồ sơ |
| `sessions` | Phiên đăng nhập được lưu bền vững |
| `roles`, `permissions`, `role_permissions`, `staff_roles` | Phân quyền RBAC: vai trò, quyền, quyền của vai trò và vai trò của nhân sự |
| `auth_audit_logs` | Nhật ký thao tác tài khoản/vai trò và sự kiện phiên đăng nhập |
| `db_change_logs` | Nhật ký thay đổi dữ liệu cấp DB (mọi INSERT/UPDATE/DELETE) — ghi tự động bằng trigger |
| `ethnicities`, `nationalities` | Danh mục dân tộc, quốc tịch |
| `cities`, `districts`, `wards` | Đơn vị hành chính (thành phố → quận huyện → phường xã) |
| `training_mode_groups`, `training_modes` | Nhóm & hình thức đào tạo |
| `training_levels`, `disciplines`, `majors`, `training_programs` | Trình độ đào tạo, **ngành** (cấp 1), **chuyên ngành** (cấp 2, thuộc một ngành), chương trình đào tạo (metadata) |
| `study_statuses` | Trạng thái học tập |
| `bridge_knowledge_subjects` | Học phần bổ sung kiến thức | 
| `lecturers` | Danh mục giảng viên (liên kết `staff` hoặc nhập tay) |
| `sequelize_meta` | Lịch sử migration đã chạy |

### Bảng riêng — Kế hoạch khóa mới

`training_plans`, `admission_targets`, `annual_fees`, `admission_records`.

### Bảng riêng — Kế hoạch đào tạo & chương trình đào tạo

Danh mục đào tạo hai cấp: **`disciplines`** là ngành (mã ngành BGD&ĐT),
**`majors`** là chuyên ngành thuộc đúng một ngành (`majors.discipline_id`); mã chuyên
ngành chỉ cần duy nhất trong phạm vi một ngành (unique `discipline_id + code`).
Bậc đào tạo (Thạc sĩ / Tiến sĩ) thuộc chuyên ngành nên cùng một ngành có thể có chuyên
ngành Thạc sĩ và Tiến sĩ với mã khác nhau. Chuyên ngành `CHUYEN-NGANH-CHUNG` (thuộc
ngành `DUNG-CHUNG`) là chỗ chứa danh mục học phần kiến thức chung cấp Viện và bị loại
khỏi mọi danh sách lựa chọn chuyên ngành.

`subjects` (danh mục học phần theo ngành + bậc; học phần cùng tên ở các ngành vẫn
có mã riêng, cờ học chung chỉ phục vụ ghép lớp), `curriculums` (CTĐT của một
ngành + bậc + khóa), `curriculum_blocks` (khối kiến thức) và
`curriculum_subjects` (học phần trong CTĐT, loại bắt buộc/tự chọn).
**Một ngành + bậc + khóa có thể có nhiều CTĐT**; **mỗi lớp chọn CTĐT
mà lớp theo học** qua `class_groups.curriculum_id` (bắt buộc chọn khi phạm vi có
nhiều CTĐT, tự gán khi chỉ có một).

Mỗi lớp chọn đúng một CTĐT qua `class_groups.curriculum_id` và học toàn bộ
danh sách môn trong CTĐT đó. Trong CTĐT, người quản lý tự đặt nhãn **Bắt buộc /
Tự chọn** cho từng môn bằng cột **Loại học phần**. Nhãn này không tạo nhóm, không
đặt định mức tín chỉ, không yêu cầu chọn lại môn theo lớp. Cùng một học phần có thể
có loại khác nhau trong các CTĐT khác nhau; thay đổi chỉ lưu trên dòng của CTĐT đang sửa.

Tổng tín chỉ là tổng của tất cả môn trong CTĐT. Tạo lớp học phần, tiến độ và bảng
điểm đều dùng toàn bộ danh sách đó, không lọc theo nhóm hoặc danh sách chọn riêng.
Loại học phần chỉ sửa được khi môn chưa mở lớp học phần và chưa có dữ liệu học tập
trong CTĐT đó. Môn đã sử dụng được khóa cả trên giao diện lẫn API; các môn chưa dùng
trong cùng CTĐT vẫn chỉnh được. Các lớp học chung dùng mã môn khác vẫn được đối chiếu
để giữ lịch sử. Thêm/xóa môn của CTĐT đã có dữ liệu đào tạo vẫn được bảo vệ.

Danh mục học phần không hiển thị cột **Bắt buộc mặc định**. Các giá trị mặc định cũ
chỉ hỗ trợ khởi tạo môn vào CTĐT; không đồng bộ ngược vào các CTĐT đang dùng.
Các bảng/cột nhóm tự chọn và quy tắc riêng của lớp đã lưu được giữ để bảo toàn lịch sử,
nhưng không còn tham gia luồng nghiệp vụ. Migration `100-simple-curriculum-subjects`
tính lại tổng tín chỉ theo danh sách đầy đủ và bỏ ghi chú chia nhóm tạm trước đây.

### Bảng riêng — Nhóm học phần & thi (dùng chung thạc sĩ/tiến sĩ)

`class_groups` (lớp/nhóm học viên), `class_group_members`,
`exam_sessions`, `exam_eligibilities`, `exam_results`.
`class_group_electives` và `curriculum_elective_groups` chỉ lưu dữ liệu cũ, không
còn quyết định môn học hoặc định mức của lớp.

Đào tạo học phần: `course_offerings`, `course_offering_class_groups`,
`course_offering_students`, `teaching_sessions`, `scheduling_retakes`.

### Bảng riêng — Đào tạo Thạc sĩ

`masters_admission_scores`, `english_exam_sessions`, `english_exam_scores`,
`english_certifications`, `graduation_defenses`, `graduation_records`.

### Bảng riêng — Đào tạo Tiến sĩ

`doctoral_admission_scores`, `doctoral_thesis_topics`, `doctoral_workshops`,
`doctoral_defenses`, `doctoral_reviews`.

### Bảng riêng — Báo cáo (view)

`v_class_lists`, `v_temp_score_masters`, `v_temp_score_doctoral`,
`v_graduation_summary`.

Các bảng có khóa ngoại, unique index, check constraint, UUID mặc định và cascade
delete phù hợp. Sau khi migration, chạy seed danh mục chung (idempotent, upsert
theo `code`):

```powershell
npm run db:seed:common
```

## Cấu hình môi trường

### Thống kê tiến độ lớp chính và học lại (migration 076)

Chạy `npm --prefix backend run db:migrate` rồi khởi động lại backend khi cập nhật chức năng này.
Migration 076 lưu vai trò lớp chính/học lại theo từng lớp hành chính tham gia; lớp chính đã chốt danh sách không bị coi là lớp học lại chỉ vì có danh sách học viên cố định.
Thống kê lấy lịch học của lớp chính, giữ cảnh báo vàng khi thiếu điểm và cảnh báo cam cho học viên đang học lại hoặc chưa được bố trí học lại. Bấm trạng thái để chọn lớp học phần liên quan; kết quả học lại được xét riêng theo học viên của từng lớp hành chính.

### Cập nhật vòng đời học viên (migration 061)

Sao lưu database trước khi cập nhật, chạy từ thư mục gốc:

```powershell
npm --prefix backend run db:migrate
```

Khởi động lại backend/frontend sau migration. Migration 061 thêm lịch sử thành viên lớp, trạng thái duyệt điểm, nhật ký thay đổi và bản kết quả học tập đã chốt; đối soát trạng thái học theo phân lớp hiện tại. Điểm cũ giữ trạng thái nháp và phải được gửi/duyệt để tính vào hoàn thành học phần. Migration không hỗ trợ tự động xóa lịch sử bằng `down`; rollback dùng bản sao lưu đã kiểm chứng.

Sau khi hoàn thành giảng dạy: lưu đủ điểm → gửi duyệt → admin duyệt và khóa. Admin muốn sửa phải mở lại với lý do. Bảng điểm cá nhân hiển thị điều kiện học phần còn thiếu và cho admin lưu bản kết quả khi đủ điều kiện; các bản cũ vẫn mở lại được sau điều chỉnh. Hoàn thành học phần được tách riêng với xét tốt nghiệp/GPA.

### Quản lý tài khoản & phân quyền (migration 062)

Sao lưu database trước khi cập nhật, chạy từ thư mục gốc:

```powershell
npm --prefix backend run db:migrate
npm --prefix backend run db:seed:auth
```

Migration 062 tạo mô hình **RBAC đầy đủ** cho tài khoản nhân sự: các bảng
`roles`, `permissions`, `role_permissions`, `staff_roles` và `auth_audit_logs`;
thêm vào `staff` các cột `status`, `session_version`, `must_change_password`,
`last_login_at`, `password_changed_at`; đổi `staff.role` từ ENUM sang
VARCHAR(50) để giữ tương thích mã vai trò chính (`admin`/`supervisor`/`examiner`)
mà API `/auth/session` vẫn trả về. Migration seed sẵn ba vai trò hệ thống cùng
ma trận quyền mặc định và backfill `staff_roles` từ cột `staff.role`.

Quyền hiệu lực của một nhân sự là **hợp quyền của mọi vai trò** được gán; nhân sự
vẫn có **một vai trò chính** (`staff.role`) để tương thích ngược. Backend thay
toàn bộ `@Roles`/`RolesGuard` cũ bằng `@RequirePermissions` + `PermissionsGuard`
(ví dụ `account.manage`, `role.manage`, `gradebook.approve`, `scheduling.write`).
Luồng học viên nằm ngoài RBAC và dùng `StudentGuard`.

API quản trị (trả envelope `{ message, data }` cho thao tác ghi):

| Nhóm | Endpoint |
| --- | --- |
| Tài khoản | `GET /accounts`, `POST /accounts`, `GET|PUT /accounts/:id`, `PATCH /accounts/:id/status`, `POST /accounts/:id/reset-password`, `POST /accounts/:id/revoke-sessions`, `GET /accounts/audit-logs` |
| Nhật ký thay đổi | `GET /accounts/change-logs`, `GET /accounts/change-logs/tables` |
| Tự phục vụ | `GET /accounts/me/permissions`, `PATCH /accounts/me/password` |
| Vai trò | `GET /roles`, `GET /roles/permissions`, `POST /roles`, `GET|PUT /roles/:id`, `PUT /roles/:id/permissions`, `DELETE /roles/:id` |

Vòng đời tài khoản: tạo kèm mật khẩu ban đầu (nhập tay hoặc sinh ngẫu nhiên), luôn
bật `mustChangePassword` cho lần đăng nhập đầu; khóa/mở khóa; admin đặt lại mật
khẩu (buộc đăng xuất và đổi mật khẩu lần kế tiếp); buộc đăng xuất mọi phiên bằng
cách tăng `staff.session_version`. Giao diện nằm trong nhóm **Tài khoản & phân
quyền** trên thanh điều hướng: `/system/accounts`, `/system/roles`,
`/system/audit-logs` và `/system/change-password` (bắt buộc đổi mật khẩu khi còn
mật khẩu khởi tạo).

### Nhật ký thay đổi dữ liệu (migration 063)

Migration 063 thêm bảng `db_change_logs` và **trigger PostgreSQL** `audit_capture`
gắn trên **mọi bảng nghiệp vụ** để ghi lại tất cả thao tác `INSERT`/`UPDATE`/`DELETE`
(dữ liệu trước/sau dạng JSONB, khóa bản ghi, danh sách cột đổi, thời gian) — bất kể
luồng code nào thực hiện, kể cả SQL thủ công hay seed. Bảng `db_change_logs`,
`auth_audit_logs`, `sessions` và `sequelize_meta` được loại trừ.

Người thực hiện được gắn **best-effort**: tầng ứng dụng set biến phiên PostgreSQL
`app.actor_staff_id`… trong mỗi transaction (`audit/audit-context.ts`), trigger đọc
lại kèm `request_id`, IP, user-agent. Thao tác ngoài transaction vẫn ghi được thay
đổi nhưng cột người thực hiện để trống.

Xem nhật ký trong **Nhật ký thao tác** (`/system/audit-logs`) → tab **Thay đổi dữ
liệu** (lọc theo bảng, hành động, khoảng ngày; quyền `audit.view`). Tab **Thao tác
quản lý** giữ nguyên nhật ký tài khoản/vai trò (`auth_audit_logs`) và bổ sung các
lần **đăng nhập / đăng xuất / đăng nhập thất bại** của nhân sự. Ngay dưới thanh tab
có một dòng mô tả vai trò của từng tab để người dùng phân biệt rõ hai loại nhật ký.

Toàn bộ cấu hình local nằm trong **`.env` ở thư mục gốc**, được Git bỏ qua.
Docker Compose, backend, migration, seed và frontend đều đọc file này.
Backend không còn tìm `config.env` hoặc `.env` riêng trong thư mục con.
Môi trường mới chạy `Copy-Item .env.example .env`, rồi điền mật khẩu riêng và `SESSION_SECRET` trước khi khởi động. Không commit `.env`.

Clone repository bằng `git clone <repository-url>`. Ứng dụng không cần submodule.

Git giữ mã nguồn, migration, test, lockfile, tài nguyên giao diện/font/giấy phép, cấu hình mẫu, hướng dẫn vận hành và script kiểm chứng. Báo cáo nội bộ, log, build, coverage, backup, upload người dùng và snapshot sinh tự động chỉ lưu local. Tạo lại các kết quả kiểm chứng khi cần; không dùng `.gitignore` để thay thế cơ chế backup riêng.

Các biến chính:

| Biến | Giá trị local hiện tại | Ý nghĩa |
| --- | --- | --- |
| `WEB_PORT` | `3100` | Cổng web trên máy host |
| `PORT` | `3001` | Cổng backend |
| `DB_HOST` | `127.0.0.1` | Host PostgreSQL cho backend chạy ngoài Docker |
| `DB_PORT` | `15432` | Cổng PostgreSQL local, chỉ bind vào `127.0.0.1` |
| `DB_ADMIN_PORT` | `5051` | Cổng pgAdmin trên máy host |
| `POSTGRES_DB` | `pgsms` | Tên database |
| `POSTGRES_USER` | `pgsms` | Tài khoản PostgreSQL |
| `POSTGRES_PASSWORD` | Đặt trong `.env` | Mật khẩu PostgreSQL, dùng cả khi kết nối từ pgAdmin |
| `PGADMIN_EMAIL` | Đặt trong `.env` | Email khởi tạo pgAdmin |
| `PGADMIN_PASSWORD` | Đặt trong `.env` | Mật khẩu khởi tạo pgAdmin, khác tài khoản PostgreSQL |
| `SESSION_SECRET` | được đặt trong `.env` | Khóa ký session, tối thiểu 32 ký tự |
| `SESSION_COOKIE_SECURE` | `false` | Dùng `true` khi production chạy HTTPS |
| `DATABASE_SSL` | `false` | Bật TLS cho kết nối PostgreSQL production |
| `FRONTEND_URL` | `http://localhost:${WEB_PORT}` | Origin frontend được CORS cho phép |
| `API_PUBLIC_URL` | `http://localhost:${PORT}` | URL công khai dùng cho OAuth callback |
| `REACT_APP_API_URL` | `${API_PUBLIC_URL}` | URL API cho frontend; đặt `/api` khi triển khai qua reverse proxy |
| `GOOGLE_CLIENT_ID` | trống | Google OAuth, không bắt buộc khi chạy DB |
| `GOOGLE_CLIENT_SECRET` | trống | Google OAuth, không bắt buộc khi chạy DB |

Backend tự tạo `DATABASE_URL` từ `DB_HOST`, `DB_PORT` và `POSTGRES_*`, có mã hóa
ký tự đặc biệt trong thông tin đăng nhập. Không khai báo lại `DATABASE_URL` trong
`.env`; biến này chỉ dùng để ghi đè khi cần kết nối ngoài cấu hình local.
Compose báo lỗi khi thiếu cấu hình bắt buộc, không tự chọn mật khẩu dự phòng.

## Chuẩn bị lần đầu

Yêu cầu cài đặt:

- Docker Desktop có Docker Compose.
- Node.js 22 và npm nếu muốn chạy frontend/backend trực tiếp trên máy.
- PowerShell cho các ví dụ lệnh bên dưới.

Mở PowerShell và đi vào thư mục gốc của repository:

```powershell
Set-Location F:\DuanSDH\project
```

Nếu clone dự án ở vị trí khác, thay đường dẫn trên bằng đường dẫn thực tế. Kiểm
tra đang đứng đúng thư mục bằng lệnh:

```powershell
Get-ChildItem
```

Kết quả phải thấy `compose.yaml`, `backend`, `frontend` và `README.md`.

Nếu chưa có `.env`, tạo tại thư mục gốc theo mục cấu hình môi trường phía trên.

Không cần chạy `npm install` ở thư mục gốc. Backend và frontend có package riêng.

## Chạy PostgreSQL và pgAdmin

Đây là chế độ mặc định. Lệnh sau chỉ khởi động database và trang quản trị:

```powershell
docker compose up -d
docker compose ps
```

Mở pgAdmin tại:

```text
http://localhost:5051
```

pgAdmin chạy ở desktop mode nên không có màn hình đăng nhập pgAdmin. Server
`Postgraduate Student Management` đã được đăng ký sẵn và tự lấy mật khẩu từ
`POSTGRES_PASSWORD` trong `.env`, không cần nhập hoặc lưu mật khẩu bằng tay.
Mỗi lần khởi động, container tạo lại file mật khẩu nội bộ với quyền `0600` và
cấu hình server từ cùng bộ biến `POSTGRES_*`. Thông tin kết nối:

```text
Host: db
Port: 5432
Database: giá trị POSTGRES_DB trong .env
Username: giá trị POSTGRES_USER trong .env
Password: giá trị POSTGRES_PASSWORD trong .env
```

pgAdmin kết nối database bằng hostname `db` trên Docker network. PostgreSQL cũng
được bind riêng vào `127.0.0.1:15432` để backend development trên máy có thể kết
nối; cổng này không mở ra mạng LAN.

## Chạy toàn bộ ứng dụng (thủ công)

`compose.yaml` chỉ quản lý `db` và `pgadmin` cho development; backend và frontend
chạy trực tiếp bằng npm (xem hướng dẫn ba terminal bên dưới).
Production dùng riêng `compose.prod.yaml`, gồm `db`, `api`, `web` và công cụ
`migrate`: xem [quy trình production](docs/deployment.md). Hai cấu hình dùng
volume database riêng; không tự động chuyển dữ liệu development sang production.

Sau khi khởi động xong:

- Web: `http://localhost:3100`
- API liveness: `http://localhost:3001/health/live`
- API readiness: `http://localhost:3001/health/ready`
- pgAdmin: `http://localhost:5051`

## Chạy development từ thư mục gốc

Mở PowerShell tại thư mục chứa `package.json`, `backend` và `frontend`:

```powershell
npm run install:all
docker compose up -d db pgadmin
npm run db:migrate
npm run dev
```

`install:all` cài dependency cho cả thư mục gốc, backend và frontend; chỉ cần chạy
khi mới lấy dự án hoặc dependency thay đổi. `dev` chạy cả backend và frontend
trong cùng terminal. Nhấn `Ctrl+C` để dừng cả hai. Nếu một dịch vụ dừng, bộ chạy
cũng dừng dịch vụ còn lại. Dừng các phiên development cũ trước khi chạy lệnh này
để tránh trùng cổng.

Các lệnh sau đều chạy được từ thư mục gốc:

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` / `npm run start:dev` | Chạy backend và frontend ở chế độ development |
| `npm run dev:backend` | Chỉ chạy backend ở watch mode |
| `npm run dev:frontend` | Chỉ chạy frontend Vite |
| `npm run build` | Build backend và frontend |
| `npm run build:backend` / `npm run build:frontend` | Build riêng từng phần |
| `npm start` | Chạy backend bằng Nest CLI |
| `npm run start:prod` | Chạy backend đã build |
| `npm run preview` | Xem thử frontend đã build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript của backend |
| `npm run db:migrate` | Áp dụng migration còn thiếu |
| `npm run db:migrate:status` | Xem trạng thái migration |
| `npm run db:migrate:undo` | Rollback migration gần nhất; cần backup trước |
| `npm run db:seed:common` / `npm run db:seed:auth` | Seed danh mục chung / phân quyền |
| `npm test` | Chạy test backend và frontend |

Tất cả script `db:*` trong `backend/package.json` đều có lệnh tương ứng ở thư
mục gốc, bao gồm các lệnh seed và preview. Các đối số bổ sung được chuyển tiếp
tới backend, ví dụ `npm run db:seed:bulk -- --preview`. Chạy `npm run` để xem
danh sách đầy đủ. Seed demo hoặc dữ liệu thử nghiệm chỉ chạy khi có nhu cầu.
`dev` không tự chạy migration hoặc seed.

## Chạy development tách backend và frontend

Chế độ này dùng PostgreSQL/pgAdmin trong Docker, còn backend và frontend chạy
trực tiếp bằng npm để có tự động reload. Mở ba cửa sổ PowerShell riêng.

### Terminal 1 - PostgreSQL và pgAdmin

```powershell
Set-Location F:\DuanSDH\project
docker compose up -d db pgadmin
docker compose ps
```

PostgreSQL local sẽ nhận kết nối tại `127.0.0.1:15432`.

Nếu Docker báo `ports are not available` hoặc `bind: An attempt was made to
access a socket in a way forbidden by its access permissions`, kiểm tra các
dải cổng Windows đang giữ bằng `netsh interface ipv4 show excludedportrange protocol=tcp`.
Đặt `DB_PORT` trong `.env` thành một cổng trống ngoài các dải đó, chạy lại
`docker compose up -d db` rồi khởi động lại backend để nạp cổng mới.

### Terminal 2 - Backend

```powershell
Set-Location F:\DuanSDH\project\backend
npm install
npm run db:migrate
npm run dev
```

Backend đọc cấu hình từ `.env` ở thư mục gốc và chạy tại:

```text
http://localhost:3001
http://localhost:3001/health/ready
```

`npm run db:migrate` cần được chạy sau khi có migration mới. Lệnh `npm run dev`
chạy NestJS ở watch mode, dùng `tsc` để biên dịch lại và tự khởi động lại backend
khi source thay đổi. Với chế độ production, chạy `npm run build` rồi
`npm run start:prod`.

Lưu ý: `nest` là CLI cài cục bộ trong `backend/node_modules`, không phải lệnh
toàn cục. Không gõ trực tiếp `nest start --watch` trong PowerShell (sẽ báo
`The term 'nest' is not recognized`). Luôn chạy qua npm script, hoặc dùng
`npx nest start --watch` nếu cần gọi trực tiếp.

Mã bootstrap và lớp HTTP NestJS nằm trong `backend/src`. Các controller giữ nguyên URL
API cũ để frontend React không phải thay đổi; Sequelize repository/service và Umzug migration
tiếp tục dùng schema PostgreSQL hiện tại.

### Terminal 3 - Frontend

```powershell
Set-Location F:\DuanSDH\project\frontend
npm install
npm run dev
```

`npm run dev` và `npm run build` đọc `.env` gốc. Frontend lấy cổng từ `WEB_PORT`
và địa chỉ API từ `REACT_APP_API_URL`. Truy cập với cấu hình local hiện tại:

```text
http://localhost:3100
```

Khi kết thúc development, nhấn `Ctrl+C` tại terminal frontend/backend, sau đó:

```powershell
Set-Location F:\DuanSDH\project
docker compose stop db pgadmin
```

## Migration PostgreSQL

Migration được áp dụng thủ công bằng npm script (backend chạy ngoài Docker):

Kiểm tra trạng thái migration:

```powershell
Set-Location F:\DuanSDH\project\backend
npm run db:migrate:status
```

Áp dụng migration còn thiếu:

```powershell
npm run db:migrate
```

Rollback migration gần nhất chỉ nên thực hiện sau khi đã backup:

```powershell
npm run db:migrate:undo
```

Migration nằm tại `backend/src/database/migrations`, được biên dịch cùng ứng dụng NestJS, và hiện gồm:

1. Schema ban đầu cho học viên, nhân sự, quan hệ giám sát và submission.
2. PostgreSQL session store.
3. UUID/database defaults và các check constraint.

## Postgraduate Course Offering & Scheduling

Chức năng Tạo lớp học phần và Xếp lịch sau đại học sử dụng migrations **021–024**.
Môi trường mới cần cấu hình database và chạy migration còn thiếu từ thư mục `backend`
bằng npm script hiện có:

```powershell
npm run db:migrate
```

Dữ liệu PostgreSQL LOCAL không đi theo Git; mỗi môi trường có database riêng.

Backend **phân quyền scheduling** bằng RBAC: `scheduling.organize` cho phép tổ chức
lớp học phần; `scheduling.write` cho phép xếp, sửa và xác nhận lịch học.
`SchedulingWriteGuard` yêu cầu tài khoản `Staff` có quyền `scheduling.write` và
chặn thao tác ghi khi hồ sơ làm việc ở chế độ chỉ xem. Chức năng chỉ định một người
phụ trách xếp lịch đã được gỡ; phân công chuyên viên phụ trách nhóm vẫn được giữ.

Unit/integration tests của feature được commit cùng source. PostgreSQL integration
tests có tạo/xóa dữ liệu nên chỉ chạy sau khi cấu hình isolated test database,
không dùng database LOCAL đang phục vụ công việc.

## Tạo quản trị viên đầu tiên

Sau khi cấu hình `ADMIN_EMAIL`, `ADMIN_NAME` và `ADMIN_PASSWORD` trong `.env`, chạy trong thư mục `backend`:

```powershell
npm run db:seed:admin
```

Quản trị viên có thể đăng nhập bằng email/mật khẩu tại `/login`. Mật khẩu được
băm bằng bcrypt trước khi lưu. Google OAuth vẫn có thể dùng khi đã cấu hình
`GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.

## Dừng và dọn môi trường

Dừng container nhưng giữ nguyên dữ liệu:

```powershell
docker compose stop
```

Gỡ container/network nhưng vẫn giữ volume PostgreSQL:

```powershell
docker compose down
```

Lệnh dưới đây xóa toàn bộ volume và dữ liệu database, chỉ dùng khi chắc chắn:

```powershell
docker compose down -v
```

## Xử lý lỗi thường gặp

### Cổng đang bị chiếm

Đổi cổng tương ứng trong `.env`: `WEB_PORT` cho frontend, `PORT` cho backend,
`DB_ADMIN_PORT` cho pgAdmin hoặc `DB_PORT` cho PostgreSQL. Khởi động lại thành phần đó.

### Docker báo `parent snapshot ... does not exist`

Đây là cache BuildKit bị lỗi. Rebuild riêng backend không dùng cache:

```powershell
docker compose --env-file .env.production -f compose.prod.yaml build --no-cache api
```

Không cần xóa PostgreSQL volume.

### API chưa sẵn sàng

Kiểm tra trạng thái và log:

```powershell
docker compose --env-file .env.production -f compose.prod.yaml ps
docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 api
```

### pgAdmin không kết nối được

Mật khẩu kết nối database là `POSTGRES_PASSWORD`, không phải `PGADMIN_PASSWORD`.
Tên database và username của server đăng ký sẵn được lấy từ `.env` khi chạy Compose.
PostgreSQL và pgAdmin lưu tài khoản trong volume: đổi mật khẩu trong `.env` không
tự đổi mật khẩu tài khoản đã tồn tại. Cần đổi mật khẩu tài khoản đó tương ứng;
không xóa volume để sửa lỗi mật khẩu vì sẽ mất dữ liệu.

Kiểm tra database healthy và dùng hostname `db`, không dùng `localhost`, trong
cấu hình server của pgAdmin:

```powershell
docker compose ps
docker compose logs --tail=100 db pgadmin
```

## Kiểm thử

Test được tổ chức theo phạm vi tại `backend/test/` và `frontend/src/test/`. Chạy toàn bộ test từ thư mục gốc:

```powershell
npm test
```

Chạy test kèm coverage dùng cho CI:

```powershell
npm run test:coverage
```

Các lệnh chi tiết cho backend được mô tả trong `backend/Testing.md`.

## Checklist production

Thực hiện theo [hướng dẫn triển khai và rollback](docs/deployment.md). Không dùng
`npm run dev` hoặc `vite preview` làm server production.

- Thay toàn bộ password và `SESSION_SECRET` trong `.env`.
- Bật HTTPS và đặt `SESSION_COOKIE_SECURE=true`.
- Không publish pgAdmin ra internet; dùng VPN hoặc SSH tunnel nếu cần.
- Đóng cổng PostgreSQL host nếu production chỉ chạy các service trong Docker.
- Cấu hình `DATABASE_SSL=true` khi database yêu cầu TLS.
- Backup PostgreSQL định kỳ và kiểm thử quy trình restore.
- Cấu hình Google OAuth callback theo `API_PUBLIC_URL` thực tế.
- Dùng SMTP credentials từ secret manager, không commit vào Git.

## Tính năng chính

1. Đăng ký và xét duyệt học viên.
2. Quản lý tài khoản nhân sự và phân quyền RBAC: vai trò tùy chỉnh, ma trận quyền, khóa/mở tài khoản, đặt lại mật khẩu, buộc đăng xuất, nhật ký thao tác (kèm đăng nhập/đăng xuất) và nhật ký thay đổi dữ liệu (trigger DB) trong cùng trang Nhật ký thao tác.
3. Theo dõi hồ sơ học viên tiềm năng và học viên đã đăng ký.
4. Theo dõi tiến độ học tập, nghiên cứu và các lần nộp báo cáo.
5. Email/thông báo cho các mốc quan trọng.
6. Quản lý luận văn, công bố và tài liệu liên quan.

### Cập nhật RBAC thống nhất (migration 064, 2026-10-19)

Nhân sự (`Staff`) là tác nhân; `admin` là vai trò mặc định và chỉ có những permission được gán trong `role_permissions`. Không còn `is_superadmin` hoặc nhánh bỏ qua kiểm tra quyền. Có thể chỉnh ma trận và tắt vai trò admin sau khi chuyển quyền quản trị sang nhân sự khác.

Migration 064 chuyển đặc quyền cũ thành permission tường minh trước khi bỏ cột. Quyền hiệu lực là hợp quyền của các vai trò đang active. `scheduling.organize` cho phép tổ chức lớp học phần; `scheduling.write` cho phép sửa lịch học. Chức năng chỉ định một người phụ trách xếp lịch đã được gỡ; phân công chuyên viên phụ trách nhóm vẫn được giữ.

Hệ thống chặn thay đổi làm mất nhân sự active cuối cùng có đủ `account.view`, `account.manage`, `role.view`, `role.manage`, kể cả khi các quyền đến từ nhiều vai trò. Đổi vai trò nhân sự thu hồi phiên đăng nhập. Cache quyền trên instance khác có TTL tối đa 30 giây.

`npm --prefix backend run db:seed:auth` đồng bộ catalog và cấp quyền mặc định cho vai trò mới; chạy lại không khôi phục quyền đã gỡ khỏi vai trò hiện hữu. Quyền mới phải được gán có chủ đích bằng ma trận hoặc migration.
