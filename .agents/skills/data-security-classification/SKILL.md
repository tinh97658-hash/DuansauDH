---
name: data-security-classification
description: >-
  Classifies database tables, columns, API payloads, exports, and logs in this
  postgraduate training management system (Viện Đào tạo SDH) into Security
  Levels 1–5 and enforces mandatory technical controls per level. Use whenever
  creating or modifying database models, migrations, DTOs, controllers,
  serializers, reports/exports, or audit logging.
---

# Phân loại Bảo mật Dữ liệu (Cấp độ 1–5)

Mọi thay đổi liên quan đến dữ liệu (model, migration, DTO, API endpoint, serializer, báo cáo/export, nhật ký) **bắt buộc** phân loại trường dữ liệu theo thang 5 cấp độ dưới đây và áp dụng đầy đủ biện pháp bảo vệ tương ứng trước khi hoàn tất.

---

## 1. Thang phân loại 5 cấp độ & Biện pháp kỹ thuật bắt buộc

| Cấp độ | Phân loại | Nguyên tắc truy cập & Biện pháp bắt buộc trong mã nguồn |
| :--- | :--- | :--- |
| **Cấp 1** | **Public** (Công khai) | Chỉ áp dụng cho danh mục tham chiếu tĩnh, không gắn với cá nhân hay tiến độ nội bộ. Hiện tại các API danh mục vẫn đi qua xác thực; chỉ được mở public khi có yêu cầu nghiệp vụ tường minh. |
| **Cấp 2** | **Internal** (Nội bộ) | Bắt buộc có `AuthenticatedGuard` và `PermissionsGuard` (không public). Không trả qua endpoint chưa đăng nhập. |
| **Cấp 3** | **Confidential** (Mật nghiệp vụ) | Bắt buộc kiểm tra quyền chức năng (RBAC) + phạm vi lớp phụ trách (`groupScope` / RLS). Hồ sơ chỉ đọc (`groupReadOnly`) bị chặn ghi ở backend. |
| **Cấp 4** | **Restricted / PII** (Định danh cá nhân nhạy cảm) | Áp dụng đầy đủ bảo vệ của Cấp 3. Chỉ trả về đúng các trường cần thiết cho màn hình/báo cáo (tránh `SELECT *` hoặc trả thừa PII trong API danh sách). Không ghi raw PII vào log ứng dụng thông thường; kiểm soát chặt quyền `reports.export`. |
| **Cấp 5** | **Top Secret / Credentials** (Tối mật / Bí mật xác thực) | **Tuyệt đối không trả về qua API** (loại bỏ tại serializer/scope). Bắt buộc băm/mã hóa an toàn khi lưu trữ. Bắt buộc đưa vào danh sách che giấu tại `backend/src/audit/credential-redaction.ts` và đồng bộ chính sách SQL audit (như migration `065`). |

---

## 2. Ma trận phân loại các bảng & trường hiện có

### Cấp 1 — Public (Danh mục tham chiếu tĩnh)
* `disciplines` (ngành đào tạo), `majors` (chuyên ngành), `training_levels` (trình độ), `training_modes` / `training_mode_groups` (hình thức đào tạo), `subjects` (danh mục học phần chung), `cities`, `districts`, `wards`, `ethnicities`, `nationalities`.

### Cấp 2 — Internal (Vận hành nội bộ tối thiểu)
* **`class_groups`**: `code`, `name`, `program`, `intake_round`, `group_number`, `max_students`, `status`, `note`, `allowed_weekdays`, `group_type`, `responsible_staff_id`.
* **`course_offerings`**: `name`, `status`, `completed_at`, `completed_by_staff_id`, `note`, `participant_notes`, `retake_weekdays`.
* **`lecturers`**: `code`, `name`, `staff_id`, `academic_rank`, `academic_degree`, `teaching_type`, `title`, `faculty`, `department`, `unit_id`, `active`.
* **`staff`**: `name`, `role`, `status`, `last_login_at`, `must_change_password`.
* **`admission_records`** *(nhóm nghiệp vụ)*: `code`, `intake_code`, `learner_code_state`, `training_level`, `training_mode_name`, `major_name`, `study_status`, `academic_year`, `intake_round`, `receipt_type`, `profile_category`, `admission_date`, `is_exempt_foreign_language`, `supplement_subjects_count`, `status`, `note`.
* **`students`** *(nhóm nghiệp vụ)*: `reg_no`, `account_type`, `approval_state`, `registered_date`, `date_of_registration`, `degree`, `study_mode`, `research_area`, `research_program`, `completion_year`, `progress_level`, `date_of_last_submission`.
* **Kế hoạch & lịch trình**: `teaching_sessions`, `exam_sessions`, `training_plans`, `curriculums`, `admission_targets`, `rooms`, cấu hình quy tắc mã học viên (`learner_codes`).

### Cấp 3 — Confidential (Nghiệp vụ mật)
* **Điểm số & kết quả học tập**: `course_offerings.gradebook_snapshot`, `exam_results`, `course_exam_gradebooks`, `learner_subject_results`, `masters_admission_scores`, `doctoral_admission_scores`, `english_exam_scores`, `admission_records.gpa`.
* **Phản biện & bảo vệ**: `doctoral_reviews` (phản biện kín), `doctoral_defenses`, `graduation_defenses`, `graduation_records`.
* **Tài chính**: dữ liệu thanh toán/thù lao giảng viên (`lecturer-payment`), `annual_fees`.
* **Nhật ký & phân quyền**: `auth_audit_logs`, `db_change_logs`, `roles`, `permissions`, `role_permissions`, `role_permission_scopes`.

### Cấp 4 — Restricted / PII (Định danh cá nhân nhạy cảm)
* **Các cột đã mã hóa tầng ứng dụng (`AES-256-GCM` tại `backend/src/common/pii-encryption.ts`, khóa `DATA_ENCRYPTION_KEY`):**
  * `admission_records`: `id_card` (kèm blind index `id_card_hash`), `phone` (kèm blind index `phone_hash`), `ward`, `diploma_number`, `registry_book_number`.
  * `students`: `postal_address`, `tel_no` (kèm blind index `tel_no_hash`).
  * `lecturers`: `phone` (kèm blind index `phone_hash`).
  * *(Lưu ý: Các cột `*_hash` dùng HMAC-SHA256 chỉ phục vụ tra cứu nội bộ, không trả về qua API.)*
* **Các cột Cấp 4 khác (bảo vệ bằng TLS + mã hóa ổ đĩa/backup + RBAC/RLS + hạn chế trả thừa):**
  * `admission_records`: `dob` (ngày sinh), `pob` (nơi sinh), `email`, `city`, `photo`, `ethnicity`, `religion`, `priority_object`, `workplace`, `job`, `documents`, `extra_data`.
  * `students`: `email`, `photo`, `document_path`.
  * `lecturers` & `staff`: `email`.

### Cấp 5 — Top Secret / Credentials (Tối mật)
* `staff.password`, `students.password`, `students.password_reset_token`.
* `DATA_ENCRYPTION_KEY`, `session_version`, cookie phiên `pgsms.sid`, mọi loại token, API key, secret, private key, mã khôi phục (`CREDENTIAL_KEYS`).

---

## 3. Quy tắc phân loại trường dữ liệu mới

Khi thêm cột/bảng mới chưa có trong ma trận trên, áp dụng nguyên tắc **mặc định an toàn (fail-safe)**:

1. Liên quan đến xác thực, mật khẩu, token, khóa bí mật → **Cấp 5**.
2. Có thể định danh hoặc liên hệ trực tiếp một cá nhân (CCCD, ngày sinh, SĐT, email, địa chỉ, ảnh chân dung, số văn bằng, tài khoản ngân hàng, hồ sơ đính kèm) → **Cấp 4**.
3. Liên quan đến điểm số, đánh giá, phản biện kín, tài chính, quyết định hành chính, nhật ký hệ thống, phân quyền → **Cấp 3**.
4. Dữ liệu vận hành đào tạo, lớp học, lịch học/thi, nhân sự/giảng viên nội bộ → **Cấp 2**.
5. Chỉ gán **Cấp 1** khi chắc chắn là danh mục tham chiếu tĩnh công khai. Nếu còn phân vân giữa hai cấp, **luôn chọn cấp cao hơn**.

---

## 4. Checklist kiểm tra trước khi hoàn thành thay đổi dữ liệu

- [ ] Đã xác định cấp độ (1–5) cho mọi trường dữ liệu mới hoặc vừa sửa.
- [ ] Endpoint liên quan có đầy đủ `AuthenticatedGuard`, `PermissionsGuard` (và guard phạm vi/ghi như `GroupScope`, `GradebookWorkflowGuard`, `SchedulingWriteGuard` nếu từ Cấp 3 trở lên).
- [ ] Trường **Cấp 5** đã được loại khỏi serializer (`backend/src/staff/staff.serializer.ts`, `backend/src/students/student.serializer.ts`, hoặc serializer tương ứng) và đã khai báo trong `CREDENTIAL_KEYS` tại `backend/src/audit/credential-redaction.ts`.
- [ ] Trường **Cấp 4** không bị lộ thừa trong API danh sách chung, không ghi raw vào `console.log`/logger, và tuân thủ quyền `reports.export` khi xuất file.
- [ ] Không hạ cấp bảo mật của bất kỳ trường nào đã phân loại mà chưa có xác nhận rõ ràng của người dùng.
