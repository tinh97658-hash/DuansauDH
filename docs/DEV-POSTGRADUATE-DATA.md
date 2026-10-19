# DEV reset và reseed dữ liệu Sau đại học

Công cụ phục vụ DB phát triển trên máy cá nhân. Không dùng cho production, staging hoặc DB dùng chung. Không migrate, synchronize schema, sửa nghiệp vụ hoặc tạo master data.

## Lệnh

Chạy PowerShell trong `backend`:

```powershell
npm run dev:data:preview

$env:CONFIRM_DEV_DATA_RESET = 'YES'
$env:SEED_RANDOM = '20261018'

# Diễn tập toàn bộ reset + seed + kiểm chứng, sau đó ROLLBACK.
npm run dev:data:reseed -- --rollback --report=../.tmp/dev-postgraduate-rehearsal.json

# Xóa nghiệp vụ và tạo lại hồ sơ trong CÙNG một transaction.
npm run dev:data:reseed -- --report=../.tmp/dev-postgraduate-applied.json

# Có thể dùng riêng: reset chỉ xóa; seed chỉ chạy nếu lifecycle đã rỗng.
npm run dev:data:reset
npm run dev:data:seed

Remove-Item Env:CONFIRM_DEV_DATA_RESET
Remove-Item Env:SEED_RANDOM
```

`reset`, `seed`, `reseed` hỗ trợ `--preview` chỉ đọc. `preview` không cần flag xác nhận nhưng vẫn kiểm tra môi trường và DB. `--rollback` thực sự diễn tập thao tác trong transaction nên vẫn cần flag xác nhận.

## Chốt phạm vi audit

Đã đọc models, migrations 001–060, các seed hiện tại, workflow xét tuyển/học phí, FK trên PostgreSQL thật và cấu hình Docker Compose của repository.

- Giữ toàn bộ danh mục: ngành/chuyên ngành, giảng viên/đơn vị/phòng, địa phương/dân tộc/quốc tịch, trình độ/hình thức đào tạo, trạng thái, chương trình, môn học, BSKT, CTĐT và các cấu phần CTĐT.
- Giữ `course_grading_policies`, `shared_grading_rules`: cấu hình phiên bản chấm điểm; xóa bảng điểm thực tế `course_exam_gradebooks`.
- Giữ `training_plans`, `admission_targets`, `annual_fees`, `admission_rounds`: định nghĩa kế hoạch tuyển sinh, chỉ tiêu, mức phí và đợt/điểm chuẩn; không phải giao dịch đóng phí hay kết quả xét tuyển. Các kết quả/hồ sơ liên quan bị xóa.
- Giữ `staff`, `sessions`, `sequelize_meta` và tài khoản `students` có role khác `student`. Tài khoản học viên `students.role = 'student'` là dữ liệu lifecycle và bị xóa. DB được audit hiện không có dòng trong `students`.
- `ClassGroup` là nhóm hành chính; `CourseOffering` là lần mở lớp học phần; cả hai bị xóa. `subjects`, `training_programs`, `curriculums` là danh mục và được giữ.
- Các bảng chỉ dùng SQL được xử lý rõ ràng: `masters_bridge_courses`, `scheduling_retakes`, `study_leaves`, `course_offering_withdrawals`, cấu hình điểm và metadata. Không bỏ sót chỉ vì không có Sequelize model.
- Schema không có bảng tôn giáo riêng, bảng attendance riêng, workflow/task riêng hoặc materialized view. Điểm thành phần/tổng kết/history liên quan nằm trong bảng điểm/JSON nghiệp vụ bị xóa cùng dòng. Bốn report view là view thường; giữ định nghĩa, dữ liệu tự phản ánh bảng nguồn đã reset.

## Guard và tính nguyên tử

- Chỉ `NODE_ENV` sau validate cấu hình là `development` hoặc `test`; kiểm tra trước kết nối DB. Không tự ghi đè biến môi trường production.
- Chỉ PostgreSQL loopback. Tên DB phải chứa token `dev`, `development`, `local`, `test`; ngoại lệ duy nhất là DB local của repository `pgsms` tại cổng `55432`. Tên chứa `prod`, `stag`, `shared`, SSL hoặc URL query overrides đều bị từ chối.
- Mọi thao tác ghi cần `CONFIRM_DEV_DATA_RESET=YES`.
- Không dùng TRUNCATE/CASCADE, không tắt FK, không xóa schema hoặc reset sequence.
- Mỗi lần chạy đọc lại FK từ `pg_constraint`, dựng thứ tự con trước cha; từ chối bảng chưa phân loại, FK từ bảng giữ lại/schema khác vào bảng sẽ xóa, chu kỳ FK, trigger tự viết, RLS, table rules, partition/foreign table/materialized view.
- Advisory lock chặn hai lượt công cụ đồng thời; table locks chặn cập nhật xen giữa. Có timeout để abort thay vì treo. Audit lại sau khi lấy lock.
- Reset và seed chạy chung một transaction. Critical failure rollback cả hai. Không tạo DB trung gian nửa reset/nửa seed.
- So sánh count và fingerprint của **toàn bộ nội dung dòng** trong bảng giữ lại và tài khoản hệ thống trước/sau, ngay trong transaction. Không log password hay nội dung session.
- Xác nhận mọi bảng lifecycle rỗng sau reset, đối chiếu chính xác số dòng bị xóa; sau seed chỉ `admission_records` có dữ liệu mới. Kiểm tra unique ID/email/phone/name và join hồ sơ → chuyên ngành → ngành không mất/trùng dòng.

Host loopback không tự chứng minh DB an toàn nếu người vận hành cố tình dùng tunnel. Trước khi apply trong phiên làm việc này đã kiểm tra container `duansaudh-db-1`, image `postgres:16-alpine`, Docker Compose project `duansaudh`, file `compose.yaml` trong repository và port publish `127.0.0.1:55432 → 5432`.

## Dataset mặc định

- 210 hồ sơ: 2024 = 50, 2025 = 70, 2026 = 90.
- Dùng các major active có discipline active và `is_common=false`, ở cả bậc thạc sĩ/tiến sĩ. Không thêm hoặc đổi tên ngành/chuyên ngành. Mỗi major hiện có đều có hồ sơ trong từng năm; phân bổ trọng số tạo các cohort lớn hơn ở hai major thạc sĩ xác định theo ID.
- PRNG seed mặc định `20261018`; UUID, tên, liên hệ, ngày sinh, năm, major và timestamp đều deterministic với cùng seed và master data. Seed thay đổi thì dataset thay đổi; master data thay đổi thì phân bổ có thể thay đổi.
- Tên Việt Nam tự nhiên, không trùng trong dataset; email dùng `example.invalid`, số liên hệ giả bắt đầu `000`, địa chỉ đánh dấu giả lập. CCCD để trống vì schema không bắt buộc.
- Không có generator mã hồ sơ tại service hiện tại: UI cho nhập thủ công, field `code` nullable. Vì vậy để `code=null` cho cán bộ nhập theo quy định, không tự đặt một định dạng mã học viên chính thức.
- Tất cả bắt đầu `pending` / `Nộp hồ sơ đầu vào`, không có kết quả xét tuyển giả, tài khoản learner tự sinh hay xác nhận học phí trước trúng tuyển. Cán bộ thực hiện xét tuyển qua luồng hiện tại, sau đó xác nhận học phí ở bước riêng. Việc phân nhóm không phụ thuộc học phí.
- Không tạo `ClassGroup`, membership, offering, session, lịch, gradebook hay điểm. Summary phân nhóm ban đầu rỗng là đúng: hồ sơ chưa trúng tuyển. Sau khi duyệt, hồ sơ mới xuất hiện trong hàng đợi phân nhóm.
- Chưa thêm chế độ tự duyệt trúng tuyển hoặc helper cho bước sau; mặc định luôn bắt đầu từ hồ sơ. Nghiệp vụ duyệt/học phí không bị sửa.

## Kiểm thử

```powershell
npm test -- test/unit/dev-postgraduate-data.spec.ts
npm run build
```

Unit tests kiểm tra guard, FK order, dependency nguy hiểm, catalog không bị xóa, tính deterministic, phân bổ nhiều năm/major, unique và trạng thái đầu vào. Diễn tập `--rollback` kiểm tra toàn bộ SQL, constraint, bulk insert, fingerprint và invariant trên DB thực tế mà không commit.

Các JSON report cung cấp danh sách bảng giữ/xóa, FK thật, delete order, count trước/sau, seed từng năm/từng major và 10 tên ví dụ. Số liệu apply thực tế được ghi trong báo cáo kèm theo ở `DEV-POSTGRADUATE-DATA-RESULT.md`.
