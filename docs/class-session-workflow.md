# Tạo Lớp HP và lịch học mở — kết quả 08/09/2026

Đã kiểm chứng nghiệp vụ bằng trình duyệt và PostgreSQL. Đã nhận và đối chiếu đủ 5 mockup ở desktop 1920 × 920; kết quả bổ sung UI, phân nhóm và quyền ghép khác ngành tại [ui-assignment-merge-validation.md](ui-assignment-merge-validation.md). Không đổi framework, ORM, CRA, authentication hoặc dependencies.

1. **Nguyên nhân regression:** frontend chặn mở composer khi CourseOffering.plannedUnits có giá trị; backend từ chối tạo buổi mới cho offering này. Đã tái hiện bằng Chrome và POST thực: HTTP 409 với thông báo phải chọn buổi từ danh sách phân buổi.
2. **File gây regression:** frontend/src/pages/masters/schedule.jsx (openSlot), backend/src/scheduling/scheduling.service.ts (createTeachingSession). CourseOfferingSessions.jsx và API sinh buổi khiến người dùng phụ thuộc vào tổng tiết/giờ định trước.
3. **Gỡ phần hiểu nhầm:** không còn trang/route/menu/entity riêng cho kế hoạch khai môn; gỡ generateTeachingSessions, DTO và POST sinh trước các buổi, nút Phân buổi, state unitsPerSession và logic chia tổng tiết. Giữ migration 025/026 và dữ liệu cũ; không đổi lịch sử migration đã áp dụng.
4. **Navigation:** Đào tạo Thạc sĩ → Quá trình học tập → Tạo lớp học phần → /masters/course-offerings. Route này mở trực tiếp flow tạo Lớp HP, không có bước kế hoạch trung gian.
5. **Flow ba bước:** chọn ngành/năm/môn, nhập tên, chọn nhiều lớp/nhóm và xem roster từng nguồn độc lập; tiếp tục tới xác nhận 4 cột/ghi chú; chỉ ghi DB khi xác nhận; thành công cho tạo lớp khác hoặc sang Xếp lịch. Quay lại giữ selection/tên/ghi chú; Làm lại không ghi/xóa DB.
6. **Tên lớp:** CourseOffering.name / course_offerings.name, bắt buộc, trim, tối đa 200 ký tự; sửa qua PUT /scheduling/course-offerings/:id/name. Tên người dùng đặt hiển thị trên danh sách lịch và chi tiết; tên môn vẫn hiển thị riêng.
7. **Membership:** CourseOfferingParticipant / course_offering_participants lưu snapshot roster khi xác nhận. CourseOfferingClassGroup vẫn nối các lớp/nhóm nguồn; không xóa/merge vật lý hoặc sửa memberships nguồn.
8. **Ghi chú:** course_offering_participants.note, riêng mỗi học viên trong Lớp HP; không sửa Student hoặc ghi chú nhóm nguồn. Có thể cập nhật sau tạo.
9. **Deduplicate:** identity = student:<UUID>; nếu chỉ có hồ sơ thì admission:<UUID>. Resolve Student từ membership hoặc AdmissionRecord.studentId trước khi khử trùng. Unique index (course_offering_id, identity) và check constraint bảo vệ DB. Tạo lớp/links/roster/notes trong cùng transaction; đã thử lỗi ghi roster sau tạo lớp và xác nhận rollback.
10. **Môn dùng browser:** QTHH — Quản trị khai thác đội tàu (3 tín chỉ); KTHT — Kỹ thuật khai thác tàu (3 tín chỉ), ngành Khai thác hàng hải, khóa/năm 2026. Danh sách còn có An toàn hàng hải, Bảo vệ môi trường biển, Phương pháp nghiên cứu khoa học… đúng danh mục repository.
11. **Nguồn môn:** backend/src/database/seed-demo.ts, subjectDefs dòng 241–270 (30 môn). Mã ngành/tên lấy từ seed-common.ts:68, năm từ seed-demo.ts. Không lấy các tên ví dụ của prompt để tự đặt môn. Đây là dữ liệu danh mục có sẵn của project, không phải xác minh chương trình chính thức từ nguồn bên ngoài.
12. **Cleanup runtime:** local trước đó chỉ có 21 môn QA772626HP0…QA772626HP20 với tên “Học phần kiểm thử QA772626 …”; đã đặt active=false cho đúng các record còn nguyên mã/tên này. Không có TST-CKTB hoặc [TEST] Học phần 10/11/12 khác trong DB được kiểm tra. Không xóa lớp/nhóm, tên/gói người dùng đã sửa, lịch cũ hoặc memberships. Các record cũ vẫn được bảo tồn trong DB và có thể tra cứu ở quản trị dữ liệu lịch sử; không xuất hiện trong candidates tổ chức môn mới. Script idempotent: backend/scripts/seed-local-curriculum.cjs; chạy từ backend bằng node scripts/seed-local-curriculum.cjs. Không chạy seed-demo nguyên bản vì nó có bước xóa dữ liệu demo cũ.
13. **Có thể ghép lớp:** SubjectPackage.canMerge / subject_packages.can_merge, checkbox tại Kế hoạch khóa mới → Kế hoạch đào tạo → tab 2 Lớp học & Gói học phần. Dùng gói chính thức đang hoạt động, kế thừa Nhóm HP cha theo quan hệ hiện có.
14. **Ý nghĩa canMerge:** chỉ chặn chọn/tạo nhiều nguồn không cho ghép. Một nguồn false vẫn tạo Lớp HP và xếp riêng; thay đổi flag sau đó không chặn việc thêm buổi của offering đã tạo. Backend vẫn xác minh gói chính thức, môn/canonical identity, ngành/năm và trùng tổ chức theo logic sẵn có.
15. **Học kỳ:** không có trên tạo/xác nhận/thành công, lịch hay composer; không phải điều kiện tạo offering hoặc buổi. Các trường/module kế hoạch khác ngoài luồng được giữ.
16. **Hoàn thành:** không có nút/filter/chip trong lịch; đã bỏ endpoint completion khỏi SchedulingController và method completeCourseOffering. Enum/dữ liệu completed cũ được giữ, scheduling không phụ thuộc trạng thái này để thêm buổi.
17. **Giờ:** SessionComposer không có input start/end, TimePicker hoặc payload giờ. Calendar/drawers hiển thị Ngày + Sáng/Chiều, không hiển thị giờ kỹ thuật thành giờ lên lớp. Backend dùng ranh giới buổi đã có: Sáng 00:00–12:00, Chiều 12:00–23:59:59, theo ngày nghiệp vụ Việt Nam; đây là mapping kỹ thuật của schema, không phải quy định giờ lên lớp mới.
18. **Bỏ chia tiết:** không còn generate/split từ số tín chỉ, giờ hoặc tiết. Giữ các cột định lượng lịch sử và dữ liệu nháp cũ để không mất dữ liệu; luồng hiện tại không dùng chúng, không hiện buổi nháp cũ như “còn phải xếp”.
19. **Tạo một buổi:** POST teaching-sessions nhận courseOfferingId, sessionDate, period, lecturerId, roomId, note; ghi đúng một TeachingSession. Giữ khóa transaction, kiểm tra trùng phòng/giảng viên/lớp/học viên, sức chứa và quyền. Không giới hạn tổng số buổi.
20. **Nhiều tuần:** danh sách offering độc lập tuần và số buổi; calendar chỉ đổi phạm vi đọc session. Lưu ngày ngoài tuần hiện tại chuyển calendar đến tuần vừa lưu. Hiển thị “Đã xếp: X buổi”, không có mẫu X/N hoặc “còn X tiết”.
21. **API Lớp HP:** POST /scheduling/course-offerings/participant-preview chỉ đọc roster; POST /scheduling/course-offerings tạo nguyên tử {name,subjectId,classGroupIds,participantNotes}; GET /scheduling/course-offerings/:id trả roster snapshot; PUT /:id/name đổi tên; PUT /:id/participants/:participantId/note sửa ghi chú. RolesGuard và SchedulingWriteGuard vẫn bảo vệ đúng các thao tác ghi.
22. **API buổi:** GET /scheduling/teaching-sessions?from=&to=; POST /scheduling/teaching-sessions; GET/PUT/DELETE /scheduling/teaching-sessions/:id; GET /scheduling/course-offerings/:id/sessions chỉ đọc buổi đã xếp. Sửa ngày/buổi và xóa không cần Hoàn thành; giữ xác nhận từng buổi đã/không diễn ra vốn có, không suy ra hoàn thành môn.
23. **Migration:** 027-course-offering-participants đã chạy thành công bằng npm run db:migrate. Tạo bảng/junction, unique/check/FK, backfill roster các offering cũ trong transaction. Không sửa hoặc rollback 025/026, không reset DB. Đã chạy toàn bộ migrations trên DB kiểm thử tạm.
24. **Frontend files:** danh sách đầy đủ ở cuối tài liệu; tập trung courseOfferings, CourseOfferingRoster, schedule, SessionComposer, CourseOfferingSessions, CourseOfferingDrawer, WeeklyCalendar và các drawer hiển thị buổi.
25. **Backend files:** danh sách đầy đủ ở cuối; model/junction mới, migration027, đăng ký model, scheduling DTO/controller/service, test metadata và script seed danh mục thật.
26. **Browser:** tạo lớp QTHH từ 2 nguồn (3+2 memberships → 4 người); xem nguồn không đổi checkbox; quay lại giữ ghi chú; confirm/reload/sang lịch; xếp 14/09 Sáng, 17/09 Chiều, 22/09 Sáng; reload rồi thêm 25/09 Chiều. Thêm buổi 5, chuyển ngày/buổi, xóa, vẫn còn 4 buổi gốc. Đổi tên thành “Quản trị khai thác đội tàu - Khóa 32”, sửa note và reload. KTHT với canMerge=false xếp 01/10 Sáng và 02/10 Chiều; dừng ở 2 không cảnh báo thiếu. Checkbox gói đã lưu false/true và reload ở đúng tab2. Console/network các stage cuối sạch.
27. **Automated:** backend 160 passed, 5 skipped ở lệnh mặc định (2 suites PostgreSQL opt-in); PostgreSQL runner 3 suites / 7 passed, gồm các tests bị skip, dùng DB pgsms_test_<UUID> riêng và tự dọn; frontend 13 suites / 80 passed. Integration kiểm chứng cả rollback sau khi lớp đã insert và roster snapshot độc lập thay đổi nguồn.
28. **Build:** backend npm run build và frontend npm run build thành công. Còn cảnh báo công cụ có sẵn: caniuse-lite cũ, fs.F_OK và VM modules. Không cài dependency, không thay lockfiles.
29. **Đối chiếu mockup đã hoàn tất:** kiểm tra trực tiếp 5 trạng thái tham chiếu tại desktop 1920 × 920 và thêm desktop 1440. Chi tiết tại [báo cáo bổ sung UI/phân nhóm/quyền ghép](ui-assignment-merge-validation.md).

## Truy cập local và dữ liệu kiểm tra

- Backend: http://localhost:3001 — giữ tiến trình chạy.
- [Tạo lớp học phần](http://localhost:3100/masters/course-offerings)
- [Lớp QTHH đã tạo, roster và ghi chú](http://localhost:3100/masters/course-offerings?offeringId=9cbbf840-cc77-46d5-b489-fd8451b863a7)
- [Lịch lớp QTHH](http://localhost:3100/masters/schedule?offeringId=9cbbf840-cc77-46d5-b489-fd8451b863a7) — chuyển tuần 14/09 và 21/09/2026.
- [Lớp KTHT học riêng](http://localhost:3100/masters/course-offerings?offeringId=5a5643b6-b4bb-4b50-8cae-3a7659995233)
- [Kế hoạch đào tạo](http://localhost:3100/plan/training-plan) — chọn Khai thác hàng hải, năm 2026, tab2.
- Tài khoản admin@example.com, mật khẩu ADMIN_PASSWORD trong .env local. Có role admin và canManageScheduling=true; admin chỉnh gói, canManageScheduling ghi lớp/lịch.

Các lớp nguồn minh họa: THS-K32-N01, THS-K32-N02, THS-K32-RIENG; 6 học viên minh họa có mã K32-HV001…006. Các môn là 30 mục lấy nguyên mã/tên/tín chỉ từ subjectDefs của repository; không tạo môn giả cho runtime.

## Bằng chứng kiểm tra

Trong backend/coverage (gitignore):
- real-demo.json: IDs dữ liệu local và danh sách 21 môn đã ngừng hoạt động.
- local-network-regression.json và local-sept8-regression.png: lỗi 409 trước sửa.
- real-network-wizard.json, real-network-sessions.json, real-network-single.json, real-network-single-sessions.json, real-network-edit-delete.json, real-network-audit.json: các luồng thực tế sau sửa, không lỗi bất thường.
- real-step1.png, real-step2.png, real-success.png, real-renamed-roster.png, real-week1-two-sessions.png, real-week2-four-sessions.png, real-single-two-sessions.png, real-merge-permission.png, real-final-schedule.png.
- final-task.diff: diff tổng hợp so với HEAD, gồm file mới chưa tracked, loại trừ 3 lockfile có sẵn.
- final-git-status.txt: trạng thái Git cuối; không stage/commit/revert.
- sept8-baseline.json: hash mốc đầu phiên; hash ba lockfile không đổi.

## Danh sách file của thay đổi tích lũy so với HEAD

- backend/scripts/seed-local-curriculum.cjs
- backend/src/database/database.module.ts
- backend/src/database/migrations/025-opening-plan-and-class-hierarchy.ts
- backend/src/database/migrations/026-package-merge-permission.ts
- backend/src/database/migrations/027-course-offering-participants.ts
- backend/src/database/models/plan/subject-package.model.ts
- backend/src/database/models/plan/subject.model.ts
- backend/src/database/models/training/class-group.model.ts
- backend/src/database/models/training/course-offering-participant.model.ts
- backend/src/database/models/training/course-offering.model.ts
- backend/src/database/models/training/teaching-session.model.ts
- backend/src/masters/dto/masters-class-group.dto.ts
- backend/src/masters/masters.controller.ts
- backend/src/masters/masters.service.ts
- backend/src/plan/class-group.service.ts
- backend/src/plan/dto/plan.dto.ts
- backend/src/plan/plan.service.ts
- backend/src/scheduling/dto/scheduling.dto.ts
- backend/src/scheduling/scheduling-time.ts
- backend/src/scheduling/scheduling.controller.ts
- backend/src/scheduling/scheduling.module.ts
- backend/src/scheduling/scheduling.service.ts
- backend/test/integration/class-session-postgres.spec.ts
- backend/test/integration/scheduling-postgres.spec.ts
- backend/test/jest.config.cjs
- backend/test/run-postgres.cjs
- backend/test/unit/class-session.service.spec.ts
- backend/test/unit/scheduling-session.service.spec.ts
- backend/test/unit/scheduling-write.guard.spec.ts
- backend/test/unit/scheduling.service.spec.ts
- docs/class-session-workflow.md
- frontend/src/components/ClassRoster.jsx
- frontend/src/components/ClassRosterDialog.jsx
- frontend/src/components/CourseOfferingRoster.jsx
- frontend/src/components/CreateClassFromStudentsDialog.jsx
- frontend/src/components/TeachingLoadFields.jsx
- frontend/src/components/scheduling/CourseOfferingDrawer.jsx
- frontend/src/components/scheduling/CourseOfferingSessions.jsx
- frontend/src/components/scheduling/PendingSessionsDrawer.jsx
- frontend/src/components/scheduling/SessionComposer.jsx
- frontend/src/components/scheduling/UnresolvedSessionsDrawer.jsx
- frontend/src/components/scheduling/WeeklyCalendar.jsx
- frontend/src/config/http.js
- frontend/src/pages/masters/assignClassGroups.jsx
- frontend/src/pages/masters/courseOfferings.jsx
- frontend/src/pages/masters/createClassGroups.jsx
- frontend/src/pages/masters/schedule.jsx
- frontend/src/pages/plan/trainingPlan.jsx
- frontend/src/test/integration/ClassWorkflow.test.jsx
- frontend/src/test/integration/RoomsPage.test.jsx
- frontend/src/test/integration/ScheduleCalendar.test.jsx
- frontend/src/test/integration/SchedulingPages.test.jsx
- frontend/src/test/integration/TrainingPlanSubjectIdentity.test.jsx
- frontend/src/test/unit/http.test.js
