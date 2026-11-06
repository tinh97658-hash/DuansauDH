# Nhập điểm thành phần từ phiếu Excel

1. Chọn lớp học phần trong **Danh sách thi, điểm thi → Bảng điểm** và dùng **Xuất báo cáo → Excel** để lấy phiếu giao giảng viên. Có thể xuất khi lớp còn đang học, sau khi đã có danh sách học viên.
2. Giảng viên điền **Điểm KT** và **Điểm TL/BTL**, lưu lại định dạng `.xlsx`. Giữ nguyên tiêu đề, danh sách và cấu trúc cột. Không dùng công thức trong hai cột điểm.
3. Sau khi xác nhận **hoàn thành giảng dạy**, người có quyền nhập điểm chọn **Nhập điểm từ Excel**, chọn file và kiểm tra điểm cũ → điểm mới.
4. Chọn **Xác nhận cập nhật điểm** để lưu. Hệ thống tính lại tư cách thi và ghi lịch sử cập nhật như luồng lưu bảng điểm.

Chỉ nhận hai cột KT và TL/BTL, thang điểm 0–10; hỗ trợ dấu chấm hoặc dấu phẩy thập phân và điểm 0. Ô trống không xóa điểm cũ. Không nhập điểm thực hành, thi hết môn, kết quả xử lý, ghi chú hay miễn thi từ file.

Import bị chặn khi lớp học phần đã có bất kỳ ca thi nào, kể cả ca đã hủy. Kiểm tra được thực hiện lại trên máy chủ trong cùng giao dịch, dưới khóa lớp học phần dùng chung với thao tác tạo lịch thi. Nếu điểm đã thay đổi sau bước xem trước, cần chọn lại file để đối chiếu phiên bản mới.

File mới có mã định danh học viên ở cột ẩn ngoài vùng in và trang dữ liệu nhận diện ẩn. Không đổi các thông tin này. Hệ thống kiểm tra mã định danh cùng họ tên, không ghép theo số thứ tự hoặc chỉ theo tên; trường hợp danh sách đã đổi cần xuất lại mẫu. File xuất trước khi có tính năng này không đủ thông tin để import.

Giới hạn: file `.xlsx` tối đa 5 MB, tối đa 1000 học viên mỗi lần. Việc mở file Excel ở thiết bị người dùng có thể thay đổi chế độ xem hoặc mức zoom, không ảnh hưởng khổ in A4 ngang.

Kiểm tra bảo vệ dữ liệu áp dụng theo skill `secure-code-review`: nhận file và kiểm tra cấu trúc ở frontend (JavaScript/ExcelJS), chỉ gửi danh sách điểm tối thiểu qua API; xác thực DTO, quyền và phạm vi lớp, danh sách học viên, phiên bản và trạng thái lịch thi ở backend (TypeScript/NestJS/Sequelize). Phạm vi rà soát: ASVS V4 (quyền truy cập), V5 (kiểm tra đầu vào), V7 (lịch sử cập nhật). Metadata trong Excel chỉ dùng nhận diện, không cấp quyền hay thay thế dữ liệu có thẩm quyền trên máy chủ.
