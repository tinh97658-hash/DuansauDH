# Kiểm tra hiệu năng ngày 27/10/2026

## Phạm vi đo

Kiểm tra luồng **Tạo lớp học phần → Học viên tham gia** theo tình trạng tải lâu được phản ánh. Đo trên PostgreSQL cục bộ của dự án, với nhóm có 16 học viên và tài khoản có bật giới hạn xem theo nhóm. Các phép đo truy vấn dùng `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` và chỉ đọc dữ liệu.

Số đo backend bên dưới không bao gồm độ trễ mạng, tải JavaScript hoặc thời gian render trình duyệt; chưa phải kiểm thử tải đồng thời. Các bộ kiểm thử tạo fixture chạy trên database sao chép riêng, không chạy trên database đang sử dụng.

## Điểm nghẽn và thay đổi

1. **Tra cứu học viên bằng cách nối chuỗi trên cột UUID.** Các biểu thức như `'admission:' || record.id::text` khiến truy vấn kiểm tra miễn thi và trạng thái học viên phải xét nhiều bản ghi, kéo theo đánh giá quyền theo dòng lặp lại. Đã chuyển sang tách UUID từ mã người tham gia và so sánh trực tiếp với cột có index. Mã không hợp lệ trả về NULL, không gây lỗi ép kiểu. Giữ nguyên thứ tự ưu tiên hồ sơ, khóa học và thời điểm tạo khi xét miễn thi.
2. **Kiểm tra quyền lồng nhau cho từng quan hệ thành viên.** Các hàm kiểm tra hồ sơ và học viên gọi tiếp hàm kiểm tra nhóm cho nhiều dòng. Migration `079-group-scope-lookup-performance` thay bằng phép join tới nhóm và chuyên viên đang hoạt động ngay trong hàm. Giữ nguyên các cờ giới hạn xem/sửa và khóa chỉ xem; không tắt RLS. Migration có hàm rollback.
3. **Đọc thành viên hai lần khi xem trước danh sách.** Luồng xem trước gọi bước đếm thành viên rồi tải lại danh sách đầy đủ. Đã giữ bước xác nhận nhóm tồn tại/thuộc phạm vi và tính số lượng từ chính danh sách được trả về.
4. **Tải cả hồ sơ thành viên chỉ để lấy lựa chọn năm/khóa.** Bổ sung `GET /masters/class-groups/options` chỉ trả thông tin nhóm cần thiết cho bộ lọc. Endpoint vẫn yêu cầu quyền xem nghiệp vụ Thạc sĩ và chịu cùng RLS.
5. **Yêu cầu cũ và tải lại trùng khi đổi lựa chọn/chuyển tab.** Hook tải dữ liệu cung cấp AbortSignal; luồng tạo lớp truyền signal tới Axios cho lựa chọn nhóm, gợi ý học phần và xem trước danh sách. Hủy yêu cầu cũ khi đổi phạm vi/rời màn hình, bỏ qua phản hồi cũ, và không tự phát thêm yêu cầu refresh khi yêu cầu trước chưa xong. Việc hủy HTTP không được coi là bảo đảm hủy câu SQL đã bắt đầu trên server.

## Số đo

| Phép đo | Trước | Sau |
| --- | ---: | ---: |
| Truy vấn miễn thi của 16 học viên, bật giới hạn xem theo nhóm | 13.273,866 ms | 7,451 / 3,254 / 2,995 ms trong 3 lần đo |
| Lượt truy cập trang dữ liệu đã có trong shared buffers của truy vấn trên | 1.152.037 | 597 / 158 / 158 |
| Service xem trước danh sách, sau bước tối ưu tra cứu ban đầu | 1.802,44 ms | 101,53 / 80,66 / 79,62 ms sau toàn bộ thay đổi |
| Service gợi ý học phần trong cùng phạm vi, 23 học phần | 996,31 ms | 126,76 ms |
| JSON phục vụ lựa chọn nhóm/năm của một chuyên ngành trong mẫu đo | 13.410 byte khi tải kèm hồ sơ | 164 byte với endpoint options |

Không dùng số 13,3 giây làm thời gian của toàn bộ HTTP request: đó là thời gian riêng của truy vấn đã xác định gây nghẽn. Số 1,8 giây là phép đo trung gian sau bước sửa tra cứu đầu tiên, không phải phép đo toàn bộ service trước khi bắt đầu công việc.

## Kiểm chứng

- 1.118 kiểm thử unit/API và kiểm thử phân quyền PostgreSQL đạt trong lượt kiểm tra chính.
- 19 kiểm thử giao diện lập lớp và hook tải dữ liệu đạt.
- Sau migration 079, 10 kiểm thử phân quyền PostgreSQL đạt, gồm trường hợp truy cập ID ngoài phạm vi, khóa sửa, chỉ xem, lớp ghép, options và miễn thi.
- Đối chiếu kết quả hàm kiểm tra quyền cũ/mới trên database thử nghiệm: 8 tổ hợp tài khoản/cờ khóa, mỗi tổ hợp 284 hồ sơ; kết quả quyền đọc/ghi khớp nhau.
- Backend typecheck và frontend production build đạt. Backend health trả `ready` sau khi áp dụng migration.
- Bản sao trước migration: `pgsms-before-performance-20261027.dump` ở thư mục gốc dự án.

Lượt chạy mở rộng thêm 131 kiểm thử tích hợp có 57 đạt và 74 chưa đạt. Trong đó 73 lỗi thuộc bộ `exam-workflow-postgres`, bị dừng ở bước setup vì tự chạy migration 066 lên database đã có `course_exam_eligibility_snapshots`. Một lỗi ở `retake-groups-postgres` kỳ vọng trạng thái `Đã trúng tuyển` nhưng nhận `Nộp hồ sơ đầu vào` sau khi bỏ thành viên. Vì vậy không khẳng định toàn bộ bộ kiểm thử tích hợp của repo đã đạt; hai vấn đề trên chưa được thay đổi trong công việc tối ưu này.

## Những phần cần đo thêm khi mở rộng sử dụng

- Độ trễ HTTP và render thực tế trên máy người dùng, nhất là lần tải đầu trong Vite development.
- Tải đồng thời nhiều chuyên viên và dữ liệu lớn hơn mẫu hiện tại.
- Chi phí đối soát bảo lưu trước các request học vụ và số round-trip của transaction kiểm tra quyền khi tăng tải. Chưa bỏ đối soát hoặc thêm cache vì cần giữ đúng cập nhật trạng thái và phạm vi phân quyền.
