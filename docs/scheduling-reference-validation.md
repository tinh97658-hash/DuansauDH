# Kiểm chứng UI Xếp lịch theo 5 ảnh — 08/09/2026

Phạm vi: 5 vùng UI Xếp lịch trong đặc tả mới. Backend và frontend đang chạy tại localhost:3001 và localhost:3100.

1. Card Lớp HP: tên lớp viết hoa, tên môn thật, số nhóm/HV, Đã diễn ra X buổi, trạng thái tuần đang xem và nút Xếp lịch. Giữ selected màu xanh nhạt.
2. Đã diễn ra: dùng sessionSummary.heldCount, chỉ status held đã được xác nhận. Không lấy totalCount.
3. Chờ xác nhận: status planned, có lịch và đã qua mốc kết thúc buổi theo quy tắc hiện có, múi giờ Asia/Ho_Chi_Minh. Không tự chuyển sang held.
4. Đã xếp sắp tới: futurePlannedCount, các buổi planned chưa qua mốc kết thúc; giữ cách phân loại buổi trong ngày của project. not_held không thuộc ba counter này.
5. Card calendar: tên lớp trước tên môn, GV và phòng, trạng thái màu; không giờ start/end, không lặp Sáng/Chiều trong nội dung card. Cho phép tên GV xuống dòng để vẫn đọc được phòng.
6. SessionComposer.jsx: header ngày/buổi/lớp và held count; cột trái thông tin, cột phải phòng theo tầng; footer phòng chọn và Hủy/Lưu lịch. Ngày/buổi có thể đổi bằng thao tác nhỏ. Model phòng không có tầng riêng: các mã dạng P.101/P101/101 được nhóm theo số tầng, mã khác vào Phòng khác. Không sửa schema.
7. PendingSessionsDrawer.jsx: tiêu đề và thứ tự thông tin theo ảnh 4; mỗi item chỉ có Không diễn ra và ✓ Đã diễn ra. Không có Xem chi tiết.
8. Hai action dùng confirmTeachingSession trong pages/masters/schedule.jsx, gọi PUT /scheduling/teaching-sessions/:id/confirmation hiện có với held hoặc not_held. Reload danh sách lớp, lịch và pending sau thành công. Backend service giữ nguyên.
9. CourseOfferingDrawer.jsx: header lớp/môn/nhóm/HV, ba counter riêng, từng nhóm nguồn và sĩ số thật từ API nhóm hiện có; footer Xếp lịch / Xếp thêm.
10. Không có Xác nhận hoàn thành giảng dạy, Hoàn thành hoặc Hoàn tất trong các vùng UI đã kiểm tra.
11. Không thay backend, schema, enum, API hoặc migration. SHA256 của 141 file đã bảo vệ trước đợt sửa (backend/src cùng UI tạo lớp/phân nhóm/học phần dùng chung) đều giữ nguyên. Giữ các thay đổi có sẵn. Môn đã lưu trữ không hiện ở calendar/pending, đồng nhất danh sách lớp; vẫn dùng toàn bộ lịch cho kiểm tra phòng/giảng viên.
12. Kiểm chứng: 41/41 test trong ScheduleCalendar.test.jsx và schedulingCalendar.test.js pass. Frontend build Compiled successfully. Không chạy backend suite/build vì backend không đổi. git diff --check pass. Build còn cảnh báo công cụ Browserslist cũ và fs.F_OK deprecated.

## Browser thực tế

Chrome desktop 1920×920; composer kiểm tra 1656×807 tương tự ảnh 3. Đã mở và đối chiếu cả 5 vùng với reference.

- A: lớp Phương pháp nghiên cứu khoa học có 2 held + 1 pending + 1 future → UI/API 2/1/1.
- B: bấm ✓ Đã diễn ra → 3/0/1, item biến mất, reload giữ đúng.
- C: tạo pending khác, bấm Không diễn ra → pending giảm, held giữ 3; reload kiểm tra status not_held.
- D: tạo buổi sáng 16/09/2026, chọn GV, P.201, ghi chú Trao đổi đề cương nghiên cứu. Lưu và reload giữ ngày/buổi/phòng/ghi chú. Không input giờ.
- E: P.101 đã có lịch sáng 16/09 nên disabled; buổi chiều cùng ngày vẫn chọn được và footer cập nhật P.101.
- F: chi tiết đúng nhóm (sĩ số 2 và 3, tổng roster duy nhất 4), ba counter, action Xếp lịch / Xếp thêm hoạt động. Mở lại chi tiết buổi đã lưu cũng giữ held count 3.
- Các lượt browser thành công: initial 26, cancel 25, composer 25, final 14 API responses; không lỗi network hoặc console. Log nằm trong backend/coverage/schedule-ref-network-*.json.
- Dữ liệu kiểm chứng tạo thêm trong local, không sửa/xóa lớp có sẵn. Cuối cùng giữ thêm một buổi pending để xem UI: counter lớp kiểm chứng hiện là 3/1/2 và một buổi not_held.

## Mở màn hình

http://localhost:3100/masters/schedule?offeringId=251c06fc-f387-45aa-a2d4-174d7870d7af

Tài khoản admin@example.com, quyền canManageScheduling=true; mật khẩu theo cấu hình local. Tuần 31/08–06/09 xem trạng thái pending/held/not_held; tuần 14–20/09 xem các buổi đã xếp. Bấm card để mở chi tiết, nút chờ xác nhận trên lịch để mở danh sách.

## File sửa trong đợt này

UI:
- frontend/src/pages/masters/schedule.jsx
- frontend/src/components/scheduling/WeeklyCalendar.jsx
- frontend/src/components/scheduling/SessionComposer.jsx
- frontend/src/components/scheduling/PendingSessionsDrawer.jsx
- frontend/src/components/scheduling/CourseOfferingDrawer.jsx
- frontend/src/components/scheduling/schedulingReferences.css (mới)

Test: frontend/src/test/integration/ScheduleCalendar.test.jsx.
Báo cáo: docs/scheduling-reference-validation.md.

Diff UI riêng so với trạng thái trước đợt sửa: backend/coverage/scheduling-reference-ui.diff. Các script/manifest/ảnh/log kiểm chứng ở backend/coverage (được git ignore).

Ảnh:
- Card lớp: ../backend/coverage/real-schedule-ref-1-final.png
- Calendar: ../backend/coverage/real-schedule-ref-2-final.png
- Xếp buổi: ../backend/coverage/real-schedule-ref-3.png
- Chờ xác nhận: ../backend/coverage/real-schedule-ref-4-final.png
- Chi tiết lớp: ../backend/coverage/real-schedule-ref-5-final.png
