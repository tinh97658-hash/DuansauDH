# Dữ liệu demo nhập điểm và tạo lịch thi

Chạy riêng seed này khi cần thêm dữ liệu mẫu vào database development trên máy local:

```powershell
npm --prefix backend run db:seed:exam-demo
```

Seed không chạy cùng migration. Dữ liệu có tiền tố `DEMO-THI`, UUID cố định; chạy lại không tạo bản sao hoặc đặt lại lớp đã khởi tạo. Ngày lịch được tính theo ngày chạy đầu tiên, múi giờ Việt Nam. Không có chế độ xóa/reset.

Trong **Nhập điểm**, chọn chuyên ngành **DEMO-THI Công nghệ thông tin**, năm **2026**. Bộ demo có **49 lớp học phần, 8 lớp hành chính, 132 học viên và 441 buổi giảng dạy**. Hai lớp hành chính đầu có 12 học viên/lớp, sáu lớp sau có 18 học viên/lớp. Lớp học phần số 06 ghép hai lớp đầu; các lớp học phần còn lại học riêng. Tên học viên và hồ sơ là dữ liệu giả.

| Lớp học phần | Trạng thái ban đầu | Có thể demo |
| --- | --- | --- |
| 01 – Triết học | Đang giảng dạy | Xem 4 buổi đã dạy, 5 buổi sắp tới |
| 02 – Tiếng Anh | Hoàn thành giảng dạy, chưa nhập điểm | Nhập điểm thành phần |
| 03 – Phương pháp nghiên cứu khoa học | Nhập dở 5/12 học viên | Tiếp tục nhập điểm, điều hướng bằng phím mũi tên |
| 04 – Toán ứng dụng | Đã đủ điểm thành phần | Xếp lịch thi, sửa điểm thành phần |
| 05 – Cơ sở dữ liệu nâng cao | Tư cách thi được tính tự động | Xếp lịch thi |
| 06 – Trí tuệ nhân tạo | Đủ tư cách thi, 23 thí sinh | Tạo lịch thi cho lớp ghép |
| 07 – Mạng máy tính nâng cao | Đủ tư cách thi, 11 thí sinh | Tạo lịch thi cho lớp riêng |
| 08 – An toàn thông tin | Đã xếp lịch thi sắp tới | Xem/sửa lịch, phân phòng và giám thị |
| 09 – Công nghệ phần mềm | Đã thi, chưa nhập điểm thi | Nhập điểm thi |
| 10 – Phân tích dữ liệu | Đã thi, nhập dở điểm thi | Hoàn thành bảng điểm |
| 11 – Hệ thống thông tin | Đủ điểm thi, chưa gửi duyệt | Gửi duyệt kết quả |
| 12 – Điện toán đám mây | Kết quả chờ duyệt | Duyệt kết quả |
| 13 – Học máy nâng cao | Kết quả đã duyệt | Xem điểm khóa, lịch sử và mở lại |

Các lớp **14–43** bổ sung năm bộ dữ liệu, mỗi bộ có sáu trạng thái liên tiếp:

| Trạng thái | Các lớp học phần |
| --- | --- |
| Chờ xếp lịch thi, tư cách tính tự động | 14, 20, 26, 32, 38 |
| Sắp thi, chưa thể nhập điểm thi | 15, 21, 27, 33, 39 |
| Thi xong, chưa nhập điểm thi | 16, 22, 28, 34, 40 |
| Thi xong, nhập dở điểm thi | 17, 23, 29, 35, 41 |
| Đủ điểm thi, chưa gửi duyệt | 18, 24, 30, 36, 42 |
| Kết quả chờ duyệt | 19, 25, 31, 37, 43 |

Lịch sắp thi của các lớp mới nằm trong **2–6 ngày sau ngày chạy seed lần đầu**; lịch thi đã diễn ra nằm trong tuần trước đó. Mỗi lớp có phòng và giảng viên mẫu. Các lớp **44–49** minh họa đang dạy, chưa nhập điểm thành phần, nhập dở, đủ điểm để xếp thi và đã duyệt kết quả.

Ở trạng thái sắp thi, các ô điểm thi vẫn khóa theo nghiệp vụ. Sau khi ca thi kết thúc và được xác nhận đã diễn ra, mới nhập được điểm thi. Các lớp đã thi chưa nhập điểm đã có xác nhận này, có thể dùng ngay để demo nhập điểm.

Trong **Tạo lịch thi**, lọc cùng chuyên ngành/năm, chọn lớp học phần **06** hoặc **07** đang chờ xếp lịch. Phòng `DEMO-THI-P1` có 40 chỗ, `P2` có 20 chỗ, `P3` có 10 chỗ; có ba giảng viên mẫu để chọn coi thi và thử kiểm tra sức chứa/trùng lịch. Hai lớp này có học viên chung nên không thể xếp thi đồng thời.

Mỗi lớp đã hoàn thành giảng dạy có đủ 9 buổi đã xác nhận, mỗi buổi 5 tiết, tổng 45 tiết cho môn 3 tín chỉ; có ngày, giờ, phòng, giảng viên và người xác nhận. Lịch sử thi mẫu có xác nhận đã diễn ra và lịch sử lưu/gửi duyệt/duyệt điểm bằng service nghiệp vụ. Trong các lớp nhập đủ điểm, có một học viên không đủ tư cách để minh họa việc loại khỏi danh sách thi; lớp đã có kết quả bao gồm điểm đạt và không đạt.

Luồng nhập điểm: hoàn thành giảng dạy → nhập và lưu điểm thành phần → tự tính tư cách thi → xếp lịch và xác nhận đã thi → nhập điểm thi → gửi duyệt kết quả → duyệt và khóa điểm. Không còn bước gửi/duyệt hoặc mở khóa tư cách trước thi. Điểm thành phần được sửa đến khi gửi duyệt kết quả cuối; lịch thi giữ danh sách tại thời điểm xếp. Gửi duyệt và duyệt kết quả chỉ cần xác nhận; mở lại kết quả cần lý do và được ghi lịch sử.

Migration `091-automatic-exam-eligibility` chuyển các danh sách đang chờ duyệt tư cách sang tư cách tự động. Bảng điểm cuối đã gửi duyệt hoặc đã khóa được giữ nguyên.

Phạm vi hiển thị và nhập điểm theo người phụ trách lớp được mô tả tại [Quyền nhập điểm](gradebook-permissions.md). Người phụ trách một lớp thành viên được xem và sửa toàn bộ lớp ghép; admin xem và xử lý toàn bộ.
