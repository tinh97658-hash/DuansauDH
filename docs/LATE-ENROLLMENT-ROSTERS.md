# Học viên vào lớp sau khi học phần bắt đầu

- Danh sách lớp học phần thông thường theo thành viên lớp học viên khi mọi buổi học còn ở tương lai.
- Mốc chốt là giờ bắt đầu sớm nhất đã tới của lịch học, tính theo múi giờ Việt Nam. Buổi chờ xác nhận, đã diễn ra và không diễn ra đều tính vào mốc này.
- Học viên vào lớp sau mốc chốt không được thêm vào danh sách học phần hay danh sách nhập điểm cũ; xuất hiện ở nhóm chờ học lần đầu để bố trí cùng lớp khác, kể cả lớp học phần cũ vẫn đang hoạt động.
- Xét riêng từng lớp học phần: một học viên có thể vào học phần còn ở tương lai nhưng chờ học phần đã bắt đầu.
- Chuyển lịch đã qua sang tương lai không mở lại danh sách cũ. Danh sách học lại đã chọn cụ thể vẫn giữ nguyên.

Migration `073-started-offering-rosters` lưu mốc chốt ở `course_offerings.roster_started_at` và danh sách ở `course_offering_class_groups.participant_ids`. Trigger chốt trước thay đổi thành viên hoặc lịch học, dùng chung cho phân lớp thủ công, phân lớp tự động, danh sách học phần, sĩ số và bảng điểm. Các mốc đã qua được đối chiếu khi chạy migration; giữ các danh tính có điểm đã lưu để bảo toàn dữ liệu cũ nhập muộn.

Kiểm thử: `RUN_POSTGRES_SCHEDULING_TESTS=true npm test -- test/integration/retake-groups-postgres.spec.ts test/unit/scheduling.service.spec.ts` (PowerShell đặt biến môi trường riêng). Dữ liệu tích hợp được rollback sau mỗi ca kiểm thử.
