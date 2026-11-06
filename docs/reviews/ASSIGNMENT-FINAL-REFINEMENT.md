# Phân nhóm học viên Thạc sĩ — UX và visual refinement

## Thay đổi

- `frontend/src/pages/masters/assignClassGroups.jsx`: auto-target, toolbar gọn, summary work queue, cảnh báo/no-group/full state, thuật ngữ.
- `frontend/src/pages/masters/assignClassGroups.css`: lưới summary 2/1 cột, thẻ ngành trắng 8px, accent teal, count và arrow liền nhau, focus/hover 160ms, alert amber, capacity trung tính.
- `frontend/src/components/ResizableSplit.jsx`: chỉ cập nhật hai nhãn accessibility sang “nhóm”; giữ nguyên hành vi resize.
- `frontend/src/test/integration/AssignClassGroups.test.jsx`: kiểm thử auto-target, trạng thái inline và checkbox, cập nhật copy.
- Tài liệu này. Không sửa create flow, backend, admission/studyStatus/tuition rules; không commit/push/reset.

## Auto-target và state safety

Đã đọc service hiện tại: API masters trả model ClassGroup (bao gồm status, code, maxStudents, timestamps) và members/memberCount, sắp xếp academicYear DESC + code ASC. Trong scope năm/chuyên ngành cụ thể, target chỉ nhận masters/open đúng scope như trước. Dùng code ASC và id ASC làm tie-breaker để thứ tự quyết định không phụ thuộc thứ tự dữ liệu trả về.

Khi tải scope xong, không lỗi và target trống/không hợp lệ, chọn nhóm đầu tiên còn chỗ. Capacity dùng cùng phép tính hiện tại: max(memberCount, members.length) < maxStudents. Không tự chọn nhóm đầy; không đổi target còn hợp lệ dù đã đầy. URL explicit, nhóm vừa tạo và lựa chọn thủ công được ưu tiên. Auto-target dùng replace URL, không phụ thuộc reloadData nên không tạo vòng reload.

Giữ nguyên lựa chọn học viên qua tìm kiếm/đổi target; không cắt ID khi thiếu chỗ; scope thay đổi vẫn xóa selection; request race protection, xác nhận bỏ thành viên và reconciliation HTTP 400/404/409 giữ nguyên. Quick-create vẫn dùng route và prefill/return hiện tại.

## Presentation

- Summary chỉ gồm ngành/chuyên ngành có outstanding learners, tổng ngành bằng tổng major đang hiển thị. Header có tổng học viên nhỏ; các thẻ ngành trên canvas lạnh, header navy, không còn parent row xanh hay grid bảng. Major là button thật, min-height 44px, arrow phản hồi hover/focus. Empty state có check nhỏ và hai dòng copy gọn.
- Toolbar chỉ còn số đã chọn/capacity và Gán. Không còn “Xem đã chọn”/“Bỏ chọn tất cả”. Overflow thể hiện inline “Vượt N học viên”, không có alert riêng và không cắt selection; nút disabled liên kết `aria-describedby` tới lý do. Header checkbox chỉ thêm/bỏ các hàng visible, indeterminate theo visible; count luôn là global.
- Không có nhóm mở: “Chưa có nhóm đang mở” + mô tả + “Tạo nhanh nhóm mới”; selector disabled và không có lời nhắc chọn mục không tồn tại.
- Tất cả nhóm đầy: “Các nhóm hiện tại đã đủ sĩ số” + quick-create. Nhóm hiện tại đầy nhưng có nhóm khác còn chỗ: hướng dẫn đổi nhóm, không ưu tiên tạo mới.
- Alert nền amber nhạt, border và icon rõ; capacity có số/text số chỗ và progress, đỏ chỉ khi đủ sĩ số. Không đổi cách tính capacity.
- Dùng “nhóm” thống nhất với màn “Tạo nhóm học viên”, không đổi backend entity hoặc route.

## Visual review

Ảnh local nằm trong `.tmp/assignment-refinement-browser/`: summary desktop/mobile/empty, assignment auto-target, full với nhóm thay thế và inline overflow, all-full quick-create, no-group quick-create. Đây là fixture chỉ trong browser, không ghi DB.

Đã xem summary desktop 1440×900 và assignment: summary là hai cột thẻ, count gần arrow; toolbar một dòng khi đủ rộng, cảnh báo dễ thấy, bảng được đưa lên sát toolbar. Giữ nguyên ResizableSplit và scroll ngang nội bộ của bảng nhiều cột. Màn 390×844 summary một cột; không đổi mobile navigation.

## Kiểm thử

- 43/43 targeted tests phân nhóm + tạo nhóm qua (32 + 11). Sau chỉnh separator accessible cuối cùng, chạy lại riêng phân nhóm: 32/32 qua.
- Bao phủ auto-target trống/một nhóm/nhiều nhóm/nhóm đầu đầy/target invalid, giữ target explicit và thủ công, no-group/all-full, toolbar/inline overflow, visible checkbox và indeterminate, summary scope/tổng/empty, quick-create, URL Back/Forward, request race, remove confirmation và conflict reconciliation.
- Edge: 7 screenshot fixture, Enter vào assignment đúng scope, tự chọn g2 khi g1 đầy, không đổi nhóm đầy tường minh; overflow disabled, quick-create đúng state; không tràn trang hoặc runtime exception. Kết quả JSON trong `.tmp/assignment-refinement-browser/result.json`.
- `git diff --check` qua; Git có thông báo chuẩn hóa LF/CRLF của `ResizableSplit.jsx`, không có lỗi whitespace.
- Frontend production build bản cuối qua (`vite build`, exit 0); còn cảnh báo chunk lớn hơn 500kB, không có lỗi compile.
