# Hệ thống quản lý đào tạo sau đại học

Hệ thống nội bộ của **Viện Đào tạo Sau đại học – Trường Đại học Hàng hải Việt Nam**, phục vụ quản lý hồ sơ, tiến độ và các lần nộp báo cáo của học viên, nghiên cứu sinh. Hệ thống không hỗ trợ đăng ký tài khoản công khai; tài khoản được cấp và quản lý nội bộ. Toàn bộ lớp dữ liệu sử dụng PostgreSQL.

## Công nghệ

- Frontend: React 18, React Router 6, Material UI, Ant Design, Bootstrap và Axios.
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
| `ethnicities`, `nationalities` | Danh mục dân tộc, quốc tịch |
| `cities`, `districts`, `wards` | Đơn vị hành chính (thành phố → quận huyện → phường xã) |
| `training_mode_groups`, `training_modes` | Nhóm & hình thức đào tạo |
| `training_levels`, `majors`, `training_programs` | Trình độ, ngành, chương trình đào tạo (metadata) |
| `study_statuses` | Trạng thái học tập |
| `bridge_knowledge_subjects` | Học phần bổ sung kiến thức |
| `lecturers` | Danh mục giảng viên (liên kết `staff` hoặc nhập tay) |
| `sequelize_meta` | Lịch sử migration đã chạy |

### Bảng riêng — Kế hoạch khóa mới

`training_plans`, `admission_targets`, `annual_fees`, `admission_records`.

### Bảng riêng — Kế hoạch đào tạo & chương trình đào tạo

`subjects` (danh mục học phần theo ngành + bậc), `curriculums` (CTĐT của một
ngành + bậc + khóa), `curriculum_blocks` (khối kiến thức),
`curriculum_elective_groups` (nhóm tự chọn kèm số tín chỉ tối thiểu/tối đa) và
`curriculum_subjects` (học phần trong CTĐT: bắt buộc/tự chọn, thuộc khối, nhóm
tự chọn). **Mỗi ngành + bậc + khóa có đúng một CTĐT**; lớp/nhóm học viên kế thừa
CTĐT của ngành và khóa mình.

### Bảng riêng — Nhóm học phần & thi (dùng chung thạc sĩ/tiến sĩ)

`class_groups` (lớp/nhóm học viên), `class_group_members`,
`class_group_electives` (học phần tự chọn mà Viện chỉ định cho cả lớp),
`exam_sessions`, `exam_eligibilities`, `exam_results`.

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

Toàn bộ cấu hình local nằm trong **`.env` ở thư mục gốc**, được Git bỏ qua.
Docker Compose, backend, migration, seed và frontend đều đọc file này.
Backend không còn tìm `config.env` hoặc `.env` riêng trong thư mục con.
Môi trường mới cần tạo `.env` với các biến bên dưới và mật khẩu riêng.

Các biến chính:

| Biến | Giá trị local hiện tại | Ý nghĩa |
| --- | --- | --- |
| `WEB_PORT` | `3100` | Cổng web trên máy host |
| `PORT` | `3001` | Cổng backend |
| `DB_HOST` | `127.0.0.1` | Host PostgreSQL cho backend chạy ngoài Docker |
| `DB_PORT` | `55432` | Cổng PostgreSQL local, chỉ bind vào `127.0.0.1` |
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
| `GENERATE_SOURCEMAP` | `false` | Cấu hình build frontend |
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
được bind riêng vào `127.0.0.1:55432` để backend development trên máy có thể kết
nối; cổng này không mở ra mạng LAN.

## Chạy toàn bộ ứng dụng (thủ công)

Docker Compose chỉ quản lý `db` và `pgadmin`. Các service `migrate`, `api`, `web`
đã được bỏ khỏi `compose.yaml` — backend và frontend chạy trực tiếp bằng npm để
dễ phát triển (xem hướng dẫn ba terminal bên dưới).

Sau khi khởi động xong:

- Web: `http://localhost:3100`
- API liveness: `http://localhost:3001/health/live`
- API readiness: `http://localhost:3001/health/ready`
- pgAdmin: `http://localhost:5051`

## Chạy development tách backend và frontend

Chế độ này dùng PostgreSQL/pgAdmin trong Docker, còn backend và frontend chạy
trực tiếp bằng npm để có tự động reload. Mở ba cửa sổ PowerShell riêng.

### Terminal 1 - PostgreSQL và pgAdmin

```powershell
Set-Location F:\DuanSDH\project
docker compose up -d db pgadmin
docker compose ps
```

PostgreSQL local sẽ nhận kết nối tại `127.0.0.1:55432`.

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
chạy NestJS bằng TSX watch để tự khởi động lại backend khi source thay đổi. Với chế độ
production, chạy `npm run build` rồi `npm start`.

Mã bootstrap và lớp HTTP NestJS nằm trong `backend/src`. Các controller giữ nguyên URL
API cũ để frontend React không phải thay đổi; Sequelize repository/service và Umzug migration
tiếp tục dùng schema PostgreSQL hiện tại.

### Terminal 3 - Frontend

```powershell
Set-Location F:\DuanSDH\project\frontend
npm install
npm start
```

`npm start` và `npm run build` đọc `.env` gốc. Frontend lấy cổng từ `WEB_PORT`
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

Backend **đã có phân quyền scheduling** qua `Staff.canManageScheduling` và
`SchedulingWriteGuard`, không phải trạng thái “chưa làm phân quyền”. Hiện chỉ chưa
có UI quản trị để chọn/gán người phụ trách scheduling. Admin có operation
`PUT /scheduling/assignee`; body JSON chứa `staffId` của Staff thuộc chính database
của môi trường triển khai. Không hard-code UUID/Staff ID từ database của máy khác.

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
docker compose --profile app build --no-cache api migrate
docker compose --profile app up -d
```

Không cần xóa PostgreSQL volume.

### API chưa sẵn sàng

Kiểm tra trạng thái và log:

```powershell
docker compose --profile app ps
docker compose --profile app logs --tail=100 migrate api
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
2. Phân quyền quản trị viên, giảng viên hướng dẫn và giám khảo.
3. Theo dõi hồ sơ học viên tiềm năng và học viên đã đăng ký.
4. Theo dõi tiến độ học tập, nghiên cứu và các lần nộp báo cáo.
5. Email/thông báo cho các mốc quan trọng.
6. Quản lý luận văn, công bố và tài liệu liên quan.
