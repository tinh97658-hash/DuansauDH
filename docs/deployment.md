# Cấu trúc repository và triển khai production

## Cấu trúc và phạm vi

`compose.yaml` dành cho development. `compose.prod.yaml` là cấu hình độc lập
cho một máy chủ Docker Linux, phía sau reverse proxy HTTPS trên cùng host.
Các lệnh dưới đây chạy từ thư mục gốc bằng PowerShell.

```text
backend/
  src/                  Module nghiệp vụ, cấu hình và database
    database/migrations/ Migration có phiên bản, cần commit cùng bản phát hành
  test/                 Unit, integration, e2e
  database/pgadmin/      Hỗ trợ pgAdmin development
  public/               Upload local; production lưu trong volume uploads
frontend/
  src/                  Features, components và test
  public/               Tài nguyên tĩnh, font và giấy phép cần phát hành
docs/                   Tài liệu nghiệp vụ và hướng dẫn vận hành
  archive/              Website tài liệu mẫu cũ, không tham gia build
scripts/                Công cụ dùng ở gốc repository
security-review/        Script kiểm chứng; báo cáo, JSON và log chỉ lưu local
compose.yaml            Database và pgAdmin development
compose.prod.yaml       Database, API, web và công cụ migration production
.env.example            Mẫu development
.env.production.example Mẫu production
.local/                 Backup, chẩn đoán và dữ liệu local; được Git bỏ qua
```

Giữ cấu trúc module hiện tại; không cần chuyển sang npm workspaces để deploy.
Commit các lockfile. Phát hành từ commit/tag đã kiểm tra hoặc image tương ứng;
không sao chép cả workspace. Build, coverage và dependencies cũ không phải nguồn
phát hành. Lưu backup ngoài checkout, có bản sao độc lập với máy chủ ứng dụng.
Không xóa backup cũ khi chưa xác minh bản thay thế. Các báo cáo kiểm tra và kế
hoạch phát triển được giữ local; xem [mục lục hướng dẫn vận hành](README.md).

## Cấu hình và HTTPS

Yêu cầu Docker Engine/Compose hỗ trợ `up --wait`, DNS và chứng chỉ HTTPS.
Tạo file mới; không ghi đè file production đang dùng:

```powershell
Copy-Item .env.production.example .env.production
```

Điền `POSTGRES_PASSWORD`, `SESSION_SECRET` ngẫu nhiên tối thiểu 32 ký tự,
`FRONTEND_URL=https://<domain>` và `API_PUBLIC_URL=https://<domain>/api`.
Giữ `SESSION_COOKIE_SECURE=true`. OAuth callback là
`https://<domain>/api/auth/google/callback`. SMTP/OAuth có thể để trống khi
không sử dụng. Chỉ cấp quyền đọc file env cho người vận hành/tài khoản triển
khai; không commit hoặc đưa bí mật vào biến frontend.

`APP_ENV_FILE` là đường dẫn file env truyền vào API/migration; mặc định
`.env.production`. Luôn dùng cùng file với `--env-file`. Compose ghi đè
`DB_HOST=db`, `DB_PORT=5432`, `PORT=3001` trong container. Mẫu dùng PostgreSQL
nội bộ nên `DATABASE_SSL=false`; database ngoài cần cấu hình topology/TLS riêng.

Luồng truy cập: trình duyệt HTTPS → ingress host → `127.0.0.1:8080` → Nginx
web → API. Chỉ web publish cổng và bind loopback. API/PostgreSQL không publish
cổng host; production không chạy pgAdmin.

Ví dụ location trong virtual host HTTPS Nginx trên host (domain/chứng chỉ do
người vận hành cấu hình):

```nginx
location / {
    client_max_body_size 25m;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Ingress phải ghi đè forwarded headers, không giữ giá trị do client cung cấp.
Web Nginx giữ thông tin HTTPS và thêm hop vào forwarded-for. `TRUST_PROXY=2`
khớp đúng hai proxy này. Cổng 80 host chuyển hướng sang HTTPS. Nếu đổi số hop
hoặc mạng truy cập web, cần đánh giá lại forwarded headers và `TRUST_PROXY`.
Không mở trực tiếp cổng web container ra internet.

## Phát hành lần đầu

Có thể đặt `API_IMAGE` và `WEB_IMAGE` trong env thành tên image gắn commit/tag.
Mặc định dùng `pgsms-api:local` và `pgsms-web:local`. Giữ image bản trước để
rollback; khi phát hành chính thức không dùng lại tag cũ cho bản build khác.

```powershell
docker compose --env-file .env.production -f compose.prod.yaml config --quiet
docker compose --env-file .env.production -f compose.prod.yaml build api web
docker compose --env-file .env.production -f compose.prod.yaml up -d --wait db
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate
```

Mỗi lệnh phải thành công trước bước tiếp theo. Migration dùng code trong image,
không cần dev dependencies tại runtime. Không chạy nhiều migration đồng thời.
Với database mới, khởi tạo danh mục và admin có chủ đích:

```powershell
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate node dist/database/seed-common.js
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate node dist/database/seed-auth.js
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate node dist/database/seed-admin.js
```

Điền `ADMIN_EMAIL`/`ADMIN_PASSWORD` trước seed admin; sau khi khởi tạo bỏ mật
khẩu bootstrap khỏi env. Không chạy seed demo, bulk hoặc realistic-test trên
production. Dữ liệu từ hệ thống cũ cần restore/đối soát riêng; cấu hình này
không tự chuyển dữ liệu development.

```powershell
docker compose --env-file .env.production -f compose.prod.yaml up -d --force-recreate --wait api web
docker compose --env-file .env.production -f compose.prod.yaml ps
curl.exe --fail https://<domain>/api/health/ready
```

Kiểm tra đăng nhập HTTPS, cookie secure, quyền tài khoản, upload/tải lại file
và luồng nghiệp vụ thực tế. Readiness chỉ xác nhận kết nối DB.

## Sao lưu, cập nhật và rollback

Project mặc định `pgsms-prod` có volume PostgreSQL và uploads (`/app/public`)
riêng, khác development. Không tùy tiện đổi project name vì sẽ dùng volume khác.
Sao lưu cả DB và uploads ra nơi độc lập và kiểm thử restore. Với PowerShell,
tạo dump trong container rồi dùng `docker compose cp`; tránh chuyển dump nhị
phân qua `>` trên Windows PowerShell cũ. Ngừng ghi khi cần backup DB/file cùng
mốc nhất quán. Đổi mật khẩu trong env không tự đổi tài khoản DB đã có.
Không dùng `down -v` hoặc `volume prune` để sửa lỗi production.

Trước cập nhật: chốt commit/tag gồm đủ code, migration, lockfile và test; kiểm
tra CI; ghi lại image cũ và backup đã kiểm chứng. Build image mới trước bảo trì.
Đánh giá tương thích schema với bản cũ. Cấu hình một máy chủ này có thời gian
dừng khi cập nhật:

```powershell
docker compose --env-file .env.production -f compose.prod.yaml stop web api
docker compose --env-file .env.production -f compose.prod.yaml run --rm migrate
docker compose --env-file .env.production -f compose.prod.yaml up -d --force-recreate --wait api web
```

Nếu migration lỗi, giữ bảo trì, xem log và không tự chạy bước tiếp theo. Khi
schema còn tương thích, đặt lại `API_IMAGE`/`WEB_IMAGE` theo tag cũ rồi chạy
`up -d --no-build --force-recreate --wait api web` với cùng file Compose/env. Nếu schema không
tương thích, người vận hành cần restore DB/uploads cùng mốc rồi chạy image cũ.
Không mặc định `migrate down` an toàn: một số migration không hỗ trợ đảo ngược.
Người vận hành chịu trách nhiệm kiểm thử restore và quyết định rollback thực tế.
Khôi phục file cấu hình từ commit trước không tự hoàn nguyên schema/dữ liệu.
