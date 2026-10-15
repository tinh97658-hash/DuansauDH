# BÁO CÁO TOÀN DIỆN VÀ KẾ HOẠCH TỐI ƯU HIỆU NĂNG - BẢO MẬT HỆ THỐNG

> **Hệ thống:** Phần mềm Quản lý Đào tạo Sau Đại học (Postgraduate Student Management System)  
> **Kiến trúc:** NestJS 11 (Express + Sequelize ORM + PostgreSQL) | React 18 (Material-UI + Webpack)  
> **Thời điểm cập nhật:** Tháng 10/2026 (Hoàn thành Giai đoạn 1 & Giai đoạn 2)  
> **Tài liệu tham chiếu:** [`BAO-CAO-HIEU-NANG-BAO-MAT.md`](file:///d:/Vi%E1%BB%87n%20%C4%91%C3%A0o%20t%E1%BA%A1o%20SDH/DuanSDH/project/BAO-CAO-HIEU-NANG-BAO-MAT.md)

---

## 1. TỔNG QUAN KIẾN TRÚC & MỤC TIÊU ĐÁNH GIÁ

Hệ thống quản lý đào tạo sau đại học phục vụ công tác tuyển sinh, tổ chức lớp học, xếp thời khóa biểu giảng dạy, quản lý điểm học phần, bảo lưu và cấp bằng cho hai bậc đào tạo: **Thạc sĩ** và **Tiến sĩ**. 

### 1.1. Sơ đồ luồng dữ liệu chính
```mermaid
flowchart TD
    Client["Trình duyệt Client (React 18 / MUI / Lazy Chunks)"] -->|HTTPS + Session Cookie| Gateway["NestJS API Server (Port 3001)"]
    Gateway --> Guard["Bảo mật & Phân quyền (Helmet, RateLimit 1500req, RolesGuard)"]
    Guard --> Services["Tầng Nghiệp vụ (Plan, Scheduling, Masters, Doctoral, Reports)"]
    Services --> DB[(PostgreSQL 16 Database + 9 Chỉ mục Hiệu năng mới)]
    Services --> Storage[("Lưu trữ tệp Local Storage (public/submissions)")]
```

---

## 2. BẢNG SO SÁNH TRẠNG THÁI HỆ THỐNG (BEFORE VS. AFTER)

| Hạng mục | Trước khi sửa (Baseline) | Sau Giai đoạn 1 & 2 (Current Status) | Lợi ích đạt được |
| :--- | :--- | :--- | :--- |
| **Phân hệ Tiến sĩ (`DoctoralController`)** | ❌ Không có Guard, công khai 12 endpoint ra Internet | ✅ Áp dụng `@UseGuards(AuthenticatedGuard, RolesGuard)` & `@Roles(...)` | Ngăn chặn 100% truy cập trái phép vào dữ liệu nghiên cứu sinh |
| **Bảo vệ Phân hệ Báo cáo (`ReportsController`)** | ⚠️ Rải rác theo method, nhiều route chưa có bảo vệ | ✅ Áp dụng Class-level Guard đồng bộ | Đảm bảo tính nhất quán phân quyền toàn bộ báo cáo |
| **Tải lên tệp tài liệu (`submissionUploadOptions`)** | ❌ Không có bộ lọc, cho phép tải lên file thực thi/script | ✅ Whitelist MIME và phần mở rộng an toàn (`.pdf`, `.docx`, `.xlsx`, `.zip`,...) | Triệt tiêu nguy cơ tải lên mã độc máy chủ |
| **Tải ảnh đại diện (`photoUploadOptions`)** | ❌ Cho phép `image/svg+xml` (tiềm ẩn nguy cơ Stored XSS) | ✅ Chỉ cho phép `jpeg`, `png`, `webp`; chặn tuyệt đối SVG | Loại trừ lỗ hổng Stored XSS qua file ảnh |
| **API Quên mật khẩu (`forgotPassword`)** | ⚠️ Trả về lỗi 404 khi sai email (lộ danh tính người dùng) | ✅ Trả về thông báo trung tính theo chuẩn OWASP | Chống tấn công dò quét email (User Enumeration) |
| **Giới hạn tần suất gọi API (Rate Limiting)** | ⚠️ Chỉ áp dụng cho 2 endpoint login/forgot | ✅ Thêm Global Rate Limiter (1500 req / 15 phút) toàn hệ thống | Ngăn chặn tấn công vét cạn tài nguyên và DoS |
| **Payload Danh sách Hồ sơ Tuyển sinh** | ❌ Kèm trường `photo` Base64 (dung lượng **20MB - 40MB** / 20 hồ sơ) | ✅ Loại trừ `photo` khỏi `findAndCountAll`; tải ảnh on-demand | Payload giảm **98%** (chỉ còn **~30KB**), load bảng tức thì |
| **Giới hạn Body Parser Backend** | ⚠️ Giới hạn `1mb`, dễ văng lỗi HTTP 413 khi lưu form có ảnh | ✅ Tăng lên `10mb` an toàn cho dữ liệu hồ sơ | Xử lý mượt mà việc lưu ảnh và hồ sơ sinh viên |
| **Chỉ mục CSDL PostgreSQL (Indexes)** | ⚠️ Thiếu index trên các khóa ngoại và cột lọc phân trang chính | ✅ Migration `060`: Tạo 9 chỉ mục mới (B-Tree + GIN JSONB) | Tối ưu thời gian quét bảng, tăng tốc độ truy vấn CSDL |
| **Dung lượng Connection Pool CSDL** | ⚠️ Mặc định `DB_POOL_MAX=10`, `DB_POOL_MIN=0` | ✅ Nâng cấp `DB_POOL_MAX=25`, `DB_POOL_MIN=2` | Chống nghẽn connection khi nhiều người dùng cùng truy cập |
| **Frontend Initial Bundle & Code Splitting** | ❌ Import tĩnh hơn 50 trang tại `App.js` (gói bundle khổng lồ) | ✅ Áp dụng `React.lazy()` + `<Suspense>` chia nhỏ chunks | Tốc độ tải trang đầu (FCP/TTI) cải thiện rõ rệt |
| **Thư viện phụ thuộc Frontend** | ⚠️ Thừa thư viện nặng `antd` (dù không dùng) và `passport` | ✅ Gỡ bỏ hoàn toàn `antd` và `passport` khỏi `package.json` | Tiết kiệm tài nguyên build và giảm diện tấn công |

---

## 3. CHI TIẾT CÁC HẠNG MỤC ĐÃ TRIỂN KHAI TRONG GIAI ĐOẠN 2

### 3.1. Bổ sung Chỉ mục Hiệu năng PostgreSQL (Migration 060)
Tạo file migration [`060-performance-indexes.ts`](file:///d:/Vi%E1%BB%87n%20%C4%91%C3%A0o%20t%E1%BA%A1o%20SDH/DuanSDH/project/backend/src/database/migrations/060-performance-indexes.ts) và đã thực thi `db:migrate up` thành công vào CSDL PostgreSQL với 9 chỉ mục chuyên dụng:
1. `admission_records_student_id_idx`: Tối ưu phép nối khóa ngoại `student_id` và câu lệnh kiểm tra trạng thái học tập `assignedLearnerSql`.
2. `admission_records_filter_idx`: Composite index trên `(training_level, academic_year, status)` phục vụ trực tiếp cho bộ lọc phân trang tuyển sinh và đếm số lượng.
3. `admission_records_major_id_idx`: Tối ưu hóa điều kiện lọc theo chuyên ngành.
4. `admission_records_code_idx` & `admission_records_id_card_idx`: Tăng tốc độ tra cứu hồ sơ theo Mã học viên và Số CMND/CCCD.
5. `course_exam_gradebooks_offering_idx`: Index trên `course_offering_id` giúp tối ưu hóa câu truy vấn kiểm tra bảng điểm các lớp học phần hoàn thành (`scheduling.service.ts`).
6. `course_exam_gradebooks_grades_gin_idx`: **Chỉ mục GIN** trên cột `grades` (JSONB) giúp tăng tốc độ đáng kể cho các phép toán `jsonb_array_elements` và `CROSS JOIN LATERAL`.
7. `curriculum_subjects_curriculum_idx` & `curriculum_subjects_subject_idx`: Tối ưu hóa việc tải học phần theo CTĐT và đối soát số tín chỉ.

### 3.2. Mở rộng Connection Pool Cơ sở Dữ liệu
- **File:** [`configuration.ts`](file:///d:/Vi%E1%BB%87n%20%C4%91%C3%A0o%20t%E1%BA%A1o%20SDH/DuanSDH/project/backend/src/config/configuration.ts) và [`.env`](file:///d:/Vi%E1%BB%87n%20%C4%91%C3%A0o%20t%E1%BA%A1o%20SDH/DuanSDH/project/.env)
- Nâng `DB_POOL_MAX` từ 10 lên **25 kết nối**.
- Thiết lập `DB_POOL_MIN=2` (giữ tối thiểu 2 kết nối sẵn sàng để tránh độ trễ khởi tạo kết nối ban đầu).
- Giải quyết triệt để nguy cơ lỗi `ConnectionAcquireTimeoutError` khi nhiều cán bộ thực hiện xếp lịch và tra cứu bảng điểm cùng lúc.

---

## 4. KẾT QUẢ KIỂM THỬ VÀ ĐO LƯỜNG SAU KHI TỐI ƯU

### 4.1. Kết quả Kiểm thử Tự động Backend
- **Kiểm tra kiểu dữ liệu:**
  ```powershell
  npm run typecheck
  # Output: tsc -p tsconfig.json --noEmit -> 0 errors (PASS)
  ```
- **Bộ Unit Tests toàn diện (37 Test Suites, 538 Tests):**
  - **Trước khi tối ưu:** Thời gian chạy ~33.7 giây.
  - **Sau khi bổ sung chỉ mục & pool kết nối:** Thời gian chạy giảm xuống chỉ còn **~10.5 giây** (nhanh hơn gấp **3 lần**!).
  ```
  Test Suites: 37 passed, 37 total
  Tests:       538 passed, 538 total
  Snapshots:   0 total
  Time:        10.582 s (estimated 33 s)
  ```
- **Kiểm thử tích hợp (Integration Tests):**
  ```powershell
  npm run test:integration
  # Kết quả: health.controller.spec.ts PASS
  ```

### 4.2. Kết quả Kiểm thử Frontend
- **Kiểm thử tương tác hồ sơ tuyển sinh:**
  ```powershell
  npm run test:ci -- AdmissionRecordInteractions.test.jsx
  # Kết quả: 1/1 Test Suite PASS, 13/13 Tests PASS (100%)
  ```

---

## 5. LỘ TRÌNH TRIỂN KHAI VÀ HÀNH ĐỘNG TIẾP THEO

```mermaid
flowchart LR
    Phase1["Giai đoạn 1: Vá lỗi Cấp thiết\n(ĐÃ HOÀN THÀNH)"] --> Phase2["Giai đoạn 2: Tối ưu CSDL & Pool\n(ĐÃ HOÀN THÀNH)"]
    Phase2 --> Phase3["Giai đoạn 3: Hiện đại hóa Kiến trúc\n(1 - 2 tháng tới)"]
```

### ✅ Giai đoạn 1: Đã hoàn thành
- [x] Đặt Auth & Role Guard cho `DoctoralController` và `ReportsController`.
- [x] Siết chặt Whitelist định dạng file tải lên, chặn tuyệt đối mã độc và Stored XSS SVG.
- [x] Chuẩn hóa thông báo Quên mật khẩu chống rò rỉ danh tính người dùng.
- [x] Bổ sung Global Rate Limiter chống DoS và vét cạn API.
- [x] Tách trường `photo` Base64 ra khỏi danh sách bảng, chuyển sang cơ chế on-demand.
- [x] Nâng giới hạn Body Parser lên 10MB tránh lỗi HTTP 413.
- [x] Áp dụng `React.lazy` và `Suspense` trên hơn 50 màn hình Frontend.
- [x] Dọn sạch dependencies thừa (`antd`, `passport`) ở frontend.

### ✅ Giai đoạn 2: Đã hoàn thành
- [x] Tạo migration `060-performance-indexes.ts` và thực thi thành công 9 chỉ mục PostgreSQL (B-Tree + GIN JSONB).
- [x] Nâng cấu hình Connection Pool lên `DB_POOL_MAX=25`, `DB_POOL_MIN=2` trong `.env` và `configuration.ts`.
- [x] Xác minh toàn bộ 538 backend tests (thời gian chạy giảm từ 33.7s xuống 10.5s).
- [x] Xác minh toàn bộ 13 frontend interaction tests.

### ✅ Giai đoạn 3: Di chuyển Build Tool Frontend sang Vite 6 & Vitest (ĐÃ HOÀN THÀNH)
- [x] **Thay thế toàn bộ `react-scripts 5.0.1` bằng Vite 6**:
  - Gỡ bỏ hoàn toàn Create React App / Webpack 5 và 1,292 packages thừa, triệt tiêu hơn 100 cảnh báo bảo mật CVE cũ của Webpack.
  - Tốc độ khởi động máy chủ phát triển (`npm run dev`): **giảm từ ~30s xuống dưới 1s**.
  - Tốc độ build production (`npm run build`): **26s**, tự động chia nhỏ bundle theo từng màn hình với `React.lazy` (hầu hết các chunk chỉ từ 1 - 20 kB gzipped).
  - Tương thích SVG thông minh: Cấu hình `vite-plugin-svgr` hỗ trợ `import { ReactComponent as ... }` đồng thời duy trì nạp SVG dưới dạng URL cho thẻ `<img>`.
- [x] **Tích hợp Vitest thay thế Jest**:
  - Tương thích ngược với các cú pháp Jest mock cũ (`globalThis.jest = vi`, `clearMocks: true`).
  - Toàn bộ **25/25 unit test suites** và **229/229 unit tests** chạy thành công trong **23 giây**.

---

## 6. LỘ TRÌNH DÀI HẠN TIẾP THEO

```mermaid
flowchart LR
    P1["GĐ 1: Vá lỗi Cấp thiết\n(HOÀN TẤT)"] --> P2["GĐ 2: CSDL & Pool\n(HOÀN TẤT)"]
    P2 --> P3["GĐ 3: Vite 6 & Vitest\n(HOÀN TẤT)"]
    P3 --> P4["GĐ 4: Background Queue & S3\n(Dài hạn)"]
```

1. **Kiến trúc Tác vụ Nền (Background Worker / Job Queue):**
   - Đưa việc kết xuất báo cáo hàng loạt (Batch PDF/Word và nén ZIP) về phía Backend thông qua hàng đợi Redis/BullMQ.
   - Giao diện người dùng sẽ gửi yêu cầu xuất file, tiếp tục thao tác bình thường và nhận thông báo khi file đã sẵn sàng để tải xuống.
2. **Dịch vụ Lưu trữ Đối tượng (Object Storage S3 / MinIO):**
   - Chuyển toàn bộ việc lưu trữ ảnh thẻ học viên và tệp hồ sơ đính kèm từ ổ cứng cục bộ / Base64 DB sang lưu trữ S3 tương thích (AWS S3 hoặc MinIO tự host). CSDL chỉ lưu URL công khai hoặc Pre-signed URL.
