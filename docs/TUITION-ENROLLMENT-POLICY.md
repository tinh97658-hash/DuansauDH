# Học phí, nhập học và nghỉ trước nhập học

Quy tắc cập nhật ngày 25/10/2026 cho đào tạo thạc sĩ:

| Điều kiện | Trạng thái / xử lý |
|---|---|
| Đã trúng tuyển, chưa xác nhận học phí | Đã trúng tuyển, chưa nhập học; phân lớp chưa làm thành Đang học. |
| Xác nhận đã nộp học phí | Đang học, kể cả chưa phân lớp; được yêu cầu bảo lưu. |
| Chưa đóng tiền và muốn nghỉ | Xác nhận **Rút hồ sơ chưa nhập học** trong tab Bảo lưu, hoặc bỏ khỏi nhóm học viên. Rút lớp và trở về Nộp hồ sơ đầu vào, status=pending. |
| Đã đóng tiền và muốn nghỉ | Qua yêu cầu/duyệt bảo lưu, tiếp nhận hoặc quyết định thôi học hiện có. |

Rút hồ sơ chưa nhập học không tạo đợt bảo lưu hoặc đánh trượt học phần. Giữ thông tin hồ sơ, lịch sử xét tuyển, lịch sử thành viên và kết quả hoàn thành cũ để tra cứu. Xét tuyển hiện tại trở về pending, tăng phiên bản; giữ điểm xét tuyển để làm hồ sơ lại. Các lượt học phần đang mở và danh sách đã chốt của lớp đang mở được bỏ danh tính đã rút, không ảnh hưởng người khác.

Thao tác có lý do và kiểm tra `updatedAt`, chạy trong một transaction. Không dùng nhánh này cho người đã nộp tiền hoặc người có bảo lưu/chuyển ngành đang mở. Nếu còn danh sách thi đã gửi/duyệt chưa kết thúc thì cần xử lý/mở lại danh sách đó trước, không sửa hoặc xóa snapshot thi bất biến.

Bỏ tích học phí là sửa xác nhận nhầm, đưa về Đã trúng tuyển/chưa nhập học; không tự coi là xin nghỉ. Không cho hủy học phí trong khi có yêu cầu/đợt bảo lưu đang mở. Khi người chưa đóng tiền thực sự muốn nghỉ, dùng thao tác rút hồ sơ có xác nhận ở trên.

Đợt bảo lưu cũ của người **chưa nộp học phí** là không hợp lệ. Migration `075-repair-unpaid-study-leaves` hủy hiệu lực quyết định, đóng gia hạn chờ, rút lớp và đưa về hồ sơ đầu vào. Dấu Không đạt do chính đợt bảo lưu sai tạo ra được bỏ; ảnh chụp cũ và lịch sử quyết định vẫn lưu để tra cứu. Giữ nguyên điểm gốc và các đợt bảo lưu hợp lệ của người đã đóng tiền. Đồng bộ ngày không được kích hoạt lại bảo lưu cho người chưa nộp học phí.

Migration `074-tuition-based-study-status` đối soát trạng thái Đã trúng tuyển/Đang học cũ theo học phí. Không chuyển các quyết định bảo lưu/thôi học và không tự xóa lớp của tất cả người chưa đóng tiền. Rút lớp chỉ xảy ra khi xác nhận nghỉ/rút hồ sơ.

Các báo cáo QA/phát hành trước ngày 25/10/2026 mô tả quy tắc cũ (phân lớp quyết định Đang học); quy tắc trong tài liệu này thay thế phần đó.
