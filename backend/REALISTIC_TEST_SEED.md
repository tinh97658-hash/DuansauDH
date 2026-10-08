# Seed catalog có căn cứ và tình huống TEST

Chỉ chạy local với `NODE_ENV=development`, database loopback. Không thay schema, không xóa, không cập nhật dữ liệu đã tồn tại. Không có lệnh reset. Chạy lại chỉ thêm dòng thiếu; giữ thao tác đã làm trên dữ liệu TEST. Nếu ID, khóa tự nhiên hoặc quan hệ mâu thuẫn, script dừng và rollback.

## A. Database trước seed

Đã kết nối PostgreSQL `pgsms` tại `127.0.0.1`. `npm run db:migrate:status`: 53 migration đã chạy, `pending: []`. Số lượng thực tế đầy đủ ở bảng cuối tài liệu, được lấy trước khi sửa code/insert. Các snapshot của runner chứa hash từng dòng để kiểm tra dữ liệu cũ không đổi; không ghi thông tin cá nhân vào báo cáo.

## B. Seed cũ đã đối chiếu

- Đã đọc `seed-admin`, `seed-common`, `seed-demo`, `seed-masters-cntt-qtkd`, `seed-admission-records`, `seed-lecturers-by-major`, `seed-scheduling-test`, `scheduling-test-fixture`, `seed-bulk`, `bulk-fixtures`, `seed-local-cntt-2026-unassigned`.
- `seed-demo` và `seed-masters-cntt-qtkd` còn truy vấn `Major.code`. Migration 046 đã bỏ cột đó; không chạy các seed này.
- `seed-masters` xóa hồ sơ/thành viên theo mã sinh sẵn và tự chọn của lớp khi chạy lại, không có transaction bao toàn bộ. Danh mục môn QTKD cũ không khớp danh sách 2026 trong yêu cầu. Nhãn “thực tế/chuẩn 60 TC” trong script không phải chứng cứ cho catalog.
- `seed-demo` xóa dữ liệu theo prefix lớp/hồ sơ và xóa kế hoạch `KH2026`; không phù hợp yêu cầu giữ dữ liệu hiện tại.
- `seed-common` cập nhật bản ghi đã có theo code, nên không gọi từ seed mới.
- `seed-lecturers-by-major` cập nhật giảng viên và lịch đã có, xóa giảng viên legacy; dữ liệu giả dùng email trường. Không tái sử dụng dữ liệu người.
- `scheduling-test-fixture` còn truyền `Major.code`; seed mới không truyền field này. Tái sử dụng `requireDevelopment` và cách dựng fixture có UUID ổn định.
- Tái sử dụng ý tưởng preview/transaction/count/FK của bulk seed, không dùng các catalog “Ngành kiểm thử” của bulk để thay catalog có nguồn.
- Giữ nguyên các seed cũ vì sửa đồng loạt không cần thiết cho entrypoint mới và có thể đổi workflow khác.

## C. File của thay đổi này

- `package.json`: hai script seed/preview; không thêm dependency.
- `src/database/seeds/realistic-test-catalog.ts`: catalog và giới hạn nguồn.
- `src/database/seeds/realistic-test-fixture.ts`: các tình huống TEST, ngày gốc mặc định 2026-10-07.
- `src/database/seeds/realistic-test-audit.ts`: counts, hash bảo toàn, audit FK và quan hệ.
- `src/database/seeds/seed-realistic-test.ts`: runner có transaction, guard, remap ID, kiểm tra và service probes.
- `test/unit/realistic-test-seed.spec.ts`: các invariant có ý nghĩa của fixture và bảo toàn dữ liệu.
- Tài liệu này: hướng dẫn và kết quả kiểm tra trước đây. `realistic-test-verification.json` là báo cáo local, được ignore và không đưa lên Git.

Các thay đổi frontend Export và file seed CNTT local đã có từ trước không thuộc thay đổi seed này.

## D. Reference

Nguồn chính là bản chép trong file yêu cầu của người dùng, mục 4, 6, 7. Không tuyên bố đây là catalog đầy đủ. Giữ các ngành cũ dù code khác danh sách mới.

- Bổ sung 10 ngành: 8520116, 8840106, 8580201, 8520203, 8520320, 8310110, 9520116, 9310110, 8340101, 8520103. Tên Việt/Anh chỉ nhập khi bản chép cung cấp; hai ngành tiến sĩ không tự suy ra chuyên ngành/khóa tiến sĩ.
- 13 chuyên ngành thạc sĩ, gắn đúng ngành. Không có `Major.code`.
- QTKD: 15 môn bắt buộc có mã/tên/tín chỉ đầy đủ, tổng 44 TC. Không có tên bịa cho môn tự chọn.
- Robot: 25 Subject duy nhất (17 bắt buộc + 8 tự chọn). `CKHM515`, `CKHN517` chỉ có một Subject mỗi môn; tái dùng trong hai phương án CTĐT.
- Triết học/Tiếng Anh giữ mã theo từng chuyên ngành và dùng `canonicalSubjectId`, `allowCrossMajor`, `sharedMajorIds` để chia sẻ theo domain hiện có.

Nghiên cứu web bổ sung: [trang ngành Cơ khí thông minh và Robot của trường](https://tuyensinh.vimaru.edu.vn/chuongtrinhdaotao/co-khi-thong-minh-va-robot.vmu) xác nhận lĩnh vực đào tạo, không đủ để xác nhận mã môn QTKD/Bảng 7.2. Không lấy CTĐT 2020 trên web thay CTĐT 2026. Chưa có PDF gốc 2026 trong workspace/file yêu cầu.

## E. TEST scenarios

Tất cả người giả mang tên TEST, email `example.invalid`, không CCCD/điện thoại người thật. Marker `SEED_TEST_2026` ở code/name/note/extraData; bảng liên kết không có note được xác định bằng UUID ổn định và cha thuộc batch. Manifest ID trong báo cáo runner phục vụ nhận diện, không có cơ chế xóa tự động.

- 6 đợt (2 mỗi năm 2024/2025/2026), ngưỡng giả định 15, quy tắc dùng `DEFAULT_ADMISSION_RULES` hiện tại. Hồ sơ rejected 14, pending 15/18, admitted đúng/trên ngưỡng; paid/unpaid. Dùng `admissionRecordSnapshot`/`scoreAdmission`, quyết định evaluation là `admitted`, status hồ sơ là `approved`; có history lưu/duyệt/học phí tương ứng.
- 5 CTĐT TEST: MBA24/25/26 là tập con có căn cứ 44 TC, ghi rõ không đầy đủ; Robot26A/26B mỗi phương án 60 TC. Robot2026 có 2 CTĐT để thử bắt buộc chọn, QTKD2026 có 1 CTĐT để thử auto-select. Phương án Robot là cách biểu diễn TEST do giới hạn schema, không phải hai quyết định chính thức.
- 7 lớp: EMPTY 0/20 (`QLTC 2026.1.901`, tên/note TEST); SMALL 3/20; NEAR 19/20; FULL 20/20; LONG 30/30; OLD24/OLD25 mỗi lớp 2/20. Lớp QTKD/Robot dùng code TEST vì chưa có prefix chính thức trong nguồn.
- FULL chọn 5 môn nhóm 3.2a (10 TC); LONG chọn 5 môn nhóm 3.2b (10 TC); không trùng Subject trong cùng CTĐT.
- Lớp học phần chưa có lịch, đã có lịch, ghép SMALL+NEAR, học phần chung ghép FULL+NEAR khác chuyên ngành, học viên individual ngoài lớp, học lại OLD24-01 ở lớp thạc sĩ 2026. Bảng `scheduling_retakes` dùng đúng schema SQL-only hiện tại, có nguồn offering đã completed và kết quả failed.
- 10 buổi qua nhiều tuần: past planned chờ xác nhận, future planned, held, not_held. Completed chỉ có held và không còn planned. Tiến độ lấy từ service, không lưu field progress tự nghĩ.
- 4 giảng viên TEST gắn discipline/major; COMMON dạy Triết học ghép hai chuyên ngành có khai báo chia sẻ. UI hiện gợi ý theo major/discipline và cho phép chọn giảng viên khác, không có bảng bằng cấp/chứng chỉ giảng dạy riêng.
- 1 Staff TEST role examiner, password NULL, không cấp quyền scheduling; chỉ làm FK người xác nhận held/not_held/completed theo CHECK hiện có. Không gán lịch giả cho tài khoản admin thật.
- 5 phòng: LARGE 60, EXACT 22, SHORT 21, TINY 2, ONLINE 60. Lớp ghép 22 người có phòng vừa đủ và thiếu 1; service hiện cho phép thiếu dưới 10, chặn thiếu từ 10 trở lên. ONLINE chỉ là nhãn địa điểm giả định, không tạo cuộc họp thật/field online mới.
- Bảng điểm LONG 30 người, phân trang 15: eligible, ineligible, exempt, thấp 3, mức 5, cao 9, chưa có điểm thi. Không có field absent: trường hợp chưa thi/vắng chưa được phân biệt bằng trạng thái riêng.
- Chuyển chuyên ngành pending cho TRANSFER: giữ ngành hiện tại. RECOGNITION có registered/studying/completed passed/completed failed; chỉ kết quả passed Triết học được công nhận 3 TC.

### Thử conflict qua UI

Ngày gốc + 7 = **14/10/2026**, buổi sáng 07:00–11:00 đã có MERGED, giảng viên MBA, phòng SHORT, nhóm SMALL+NEAR.

| Tình huống | Thao tác thử ở cùng ngày/buổi |
|---|---|
| Trùng phòng | ROBOT-A, GV ROBOT, phòng SHORT |
| Trùng giảng viên | FUTURE, GV MBA, phòng EXACT |
| Trùng lớp | NOSESSIONS, GV MBA2, phòng LARGE |
| Thiếu sức chứa | MERGED, GV MBA, phòng TINY |

Runner kiểm tra các request này bị từ chối bởi service hiện tại, không chèn bản ghi conflict. Khi ngày future đã qua, script bỏ probe phụ thuộc thời gian và ghi lý do; các UUID/data cũ giữ nguyên khi rerun.

## F. Verification

Kết quả lần kiểm tra seed trước đây được lưu local trong `realistic-test-verification.json` (không đi kèm repository). Bảng dưới là ghi nhận của lần chạy đó, không phải kết quả chạy lại khi đóng gói phiên bản:

| Kiểm tra | Kết quả |
|---|---|
| `npm run db:migrate:status` | 53 executed, pending rỗng |
| `npm run build` (qua entrypoint seed) | PASS |
| `npm run typecheck` | PASS |
| `npm test -- --runInBand test/unit/realistic-test-seed.spec.ts` | 5/5 PASS |
| `node dist/database/seeds/seed-realistic-test.js --preview` | PASS; rollback toàn bộ, counts/hash dữ liệu cũ giữ nguyên |
| `npm run db:seed:realistic-test:preview` sau apply | PASS; thêm 0 dòng, 1046 dòng giữ nguyên; entrypoint có build chạy thành công |
| `npm run db:seed:realistic-test` | PASS; thêm 756 dòng, giữ nguyên 290 dòng cũ |
| Chạy lại `node dist/database/seeds/seed-realistic-test.js` | PASS; thêm 0 dòng, bỏ qua 759 dòng đã có; 1046 dòng giữ nguyên hash |
| FK và quan hệ | 98 FK, 0 orphan; không trùng lịch/sai scope/tự chọn/sĩ số/completion/capacity |
| Service GET | 14 candidate subjects; đủ 4 trạng thái tiến độ; bảng điểm 30 dòng, trang đầu 15; 1/2 CTĐT trong hai scope; 3 TC công nhận |
| Service validator | ROOM_CONFLICT, LECTURER_CONFLICT, CLASS_GROUP_CONFLICT, ROOM_CAPACITY_EXCEEDED đều bị từ chối |

Preview thực hiện insert+validate trong transaction rồi rollback, so hash/count trước/sau. Apply kiểm tra hash tất cả dòng đã có trước khi commit và kiểm tra lại sau commit. Có warning deprecation của `pg` về query cùng client trong service; các lệnh vẫn exit 0. Không sửa service ngoài phạm vi seed.

Service checks gọi code tương ứng các GET scheduling candidates/progress, curriculum, gradebook, admission detail, transfer và learning results/recognition. Không sửa quyền tài khoản hay tạo session đăng nhập để vượt authentication. Không đồng nghĩa đã kiểm tra thủ công UI mọi module.

## G. Chưa seed / giới hạn

- **Không đủ dữ liệu**: 15 tên môn tự chọn QTKD, phần chữ mã 551 trong Bảng 7.2 và xung đột với các bảng khác. Chưa tạo CTĐT QTKD chính thức 60 TC hoặc hai lớp chọn 2.2a+3.2a / 2.2b+3.2b. Cần PDF/link gốc để bổ sung, không đoán mã/tên.

| Nhóm QTKD đang thiếu nguồn đầy đủ | Mã trong bản chép (chưa insert) |
|---|---|
| 2.2a | QTĐP552, QTPT542, QTTM543, QTVH544 |
| 2.2b | QLCT512, QTTC545, QTMS546, QLKQ519 |
| 3.2a | QTDA550, QLQĐ530, QLTC513, 551 Hành vi người tiêu dùng (phần chữ chưa xác minh) |
| 3.2b | QTCL553, QTLĐ554, QTNM555, QTTH556 |

- Robot hai nhóm giao nhau không biểu diễn nguyên dạng trong một CTĐT vì unique `(curriculum_id,subject_id)` và một `elective_group_id`. Dùng hai phương án TEST 60 TC, giữ Subject duy nhất, không sửa schema.
- Chưa có căn cứ prefix quản lý năng lượng/QTKD/Robot, không gán lại thành `Major.code`.
- Không seed thêm nội dung tiến sĩ/tiếng Anh/bảo vệ tốt nghiệp không liên quan. `MastersService` và `DoctoralService` có các action `not_implemented`; sự tồn tại của bảng không chứng minh workflow đã hoàn chỉnh.
- Không có status vắng thi riêng trong CourseExamGrade; không tự thêm.
- Ngày lịch là fixture cố định để rerun giữ nguyên dữ liệu. `--anchor-date` chỉ ảnh hưởng dòng chưa tồn tại, không dịch lịch đã thao tác. Muốn bộ ngày mới sau khi đã apply phải xây dựng batch/version riêng, không reset dữ liệu năm 2026.

## H. Chạy lại

```powershell
cd D:\SauDH\DuansauDH\backend
npm run db:migrate:status
npm run typecheck
npm test -- --runInBand test/unit/realistic-test-seed.spec.ts
npm run db:seed:realistic-test:preview
npm run db:seed:realistic-test
```

Ngày gốc khác trên database chưa có batch này:

```powershell
npm run db:seed:realistic-test:preview -- --anchor-date=2026-10-07
npm run db:seed:realistic-test -- --anchor-date=2026-10-07
```

Hai lệnh đều build backend. Báo cáo mỗi lần chạy ở `%TEMP%\codex-realistic-test-preview.json` hoặc `%TEMP%\codex-realistic-test-applied.json`. Không chạy seed legacy để “dọn” trước.

## Counts thực tế trước thay đổi

| Table | Row count |
|---|---:|
| admission_evaluation_history | 15 |
| admission_evaluations | 0 |
| admission_records | 129 |
| admission_rounds | 0 |
| admission_targets | 0 |
| annual_fees | 0 |
| bridge_knowledge_subjects | 4 |
| cities | 18 |
| class_group_electives | 0 |
| class_group_members | 0 |
| class_groups | 0 |
| course_exam_gradebooks | 0 |
| course_offering_class_groups | 0 |
| course_offering_students | 0 |
| course_offerings | 0 |
| curriculum_blocks | 0 |
| curriculum_elective_groups | 0 |
| curriculum_subjects | 0 |
| curriculums | 0 |
| disciplines | 12 |
| districts | 0 |
| doctoral_admission_scores | 0 |
| doctoral_defenses | 0 |
| doctoral_reviews | 0 |
| doctoral_thesis_topics | 0 |
| doctoral_workshops | 0 |
| english_certifications | 0 |
| english_exam_scores | 0 |
| english_exam_sessions | 0 |
| ethnicities | 15 |
| exam_eligibilities | 0 |
| exam_results | 0 |
| exam_sessions | 0 |
| graduation_defenses | 0 |
| graduation_records | 0 |
| learner_subject_results | 0 |
| lecturers | 6 |
| major_transfers | 0 |
| majors | 1 |
| masters_admission_scores | 0 |
| nationalities | 12 |
| rooms | 7 |
| scheduling_retakes | 0 |
| sequelize_meta | 53 |
| sessions | 1 |
| staff | 1 |
| staff_students | 0 |
| students | 0 |
| study_statuses | 6 |
| subject_recognitions | 0 |
| subjects | 0 |
| submissions | 0 |
| teaching_sessions | 0 |
| training_levels | 2 |
| training_mode_groups | 4 |
| training_modes | 4 |
| training_plans | 0 |
| training_programs | 0 |
| wards | 0 |

## Counts sau apply và chạy lại (thực tế)

| Table | BEFORE | AFTER |
|---|---:|---:|
| admission_evaluation_history | 15 | 258 |
| admission_evaluations | 0 | 83 |
| admission_records | 129 | 212 |
| admission_rounds | 0 | 6 |
| admission_targets | 0 | 6 |
| annual_fees | 0 | 3 |
| class_group_electives | 0 | 10 |
| class_group_members | 0 | 76 |
| class_groups | 0 | 7 |
| course_exam_gradebooks | 0 | 1 |
| course_offering_class_groups | 0 | 11 |
| course_offering_students | 0 | 2 |
| course_offerings | 0 | 9 |
| curriculum_blocks | 0 | 25 |
| curriculum_elective_groups | 0 | 2 |
| curriculum_subjects | 0 | 89 |
| curriculums | 0 | 5 |
| disciplines | 12 | 22 |
| learner_subject_results | 0 | 5 |
| lecturers | 6 | 10 |
| major_transfers | 0 | 1 |
| majors | 1 | 14 |
| rooms | 7 | 12 |
| scheduling_retakes | 0 | 1 |
| staff | 1 | 2 |
| subject_recognitions | 0 | 1 |
| subjects | 0 | 40 |
| teaching_sessions | 0 | 10 |
| training_plans | 0 | 3 |
| training_programs | 0 | 1 |

Lần đầu thêm 756 dòng, giữ nguyên 290 dòng cũ. Chạy lại thêm 0 dòng, giữ nguyên toàn bộ 1046 dòng. Kiểm tra 98 FK, không có orphan. Cả 4 request thử conflict/capacity bị từ chối đúng lỗi.
