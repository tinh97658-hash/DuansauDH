# Hiệu năng chuyển trang — 16/10/2026

Đã kiểm tra 60 route chức năng trong nhóm Hệ thống, Kế hoạch khóa mới,
Thạc sĩ, Tiến sĩ và Báo cáo trên Vite local, dùng phiên đăng nhập và backend thật.
Các trang hiện chỉ có khung chức năng cũng nằm trong lượt kiểm tra route này;
việc mở được trang không đồng nghĩa nghiệp vụ chưa triển khai đã được bổ sung.

## Nguyên nhân và thay đổi

- Mỗi ô nhập MUI tự chèn/xóa CSS autofill toàn cục khi mount/unmount. Với các
  form lớn và bảng nhập điểm, thao tác này làm việc chuyển trang chậm dần.
  `theme.js` cung cấp một bộ keyframes chung qua `CssBaseline` và tắt việc
  chèn lặp ở `MuiInputBase`, vẫn giữ hỗ trợ autofill.
- Import từ toàn bộ danh mục icon khiến bộ xử lý duyệt hơn 11 nghìn module.
  Các trang và component dùng chung đã chuyển sang import từng icon.
  Vite chuẩn bị sẵn các icon thực sự được dùng để tránh tối ưu dependencies
  lại khi lần đầu mở một trang lazy. Build giảm từ 11.474 xuống khoảng 1.389 module.
- Menu, danh mục và một số trang tự gọi lại API quyền dù route bảo vệ đã xác
  minh phiên. `AuthSessionContext` chia sẻ kết quả trong cây route hiện tại.
  Không lưu danh sách hồ sơ hoặc thông tin đăng nhập vào cache trình duyệt;
  backend vẫn kiểm tra quyền ở từng API. Lượt kiểm tra 60 trang chỉ gọi
  `/auth/session` một lần.
- `lazyPage` tải trước mã JavaScript khi người dùng rê chuột, focus hoặc
  nhấn vào một mục menu. Chỉ tải mã; chưa chạy effect hay API dữ liệu của trang.
  Các liên kết tới chi tiết hồ sơ cũng dùng cơ chế này.
- Hồ sơ chi tiết tải ba API cơ bản trước. Sáu API kết quả học tập/danh mục
  học phần chỉ chạy khi mở tab Học tập, có trạng thái tải/lỗi riêng và hủy
  request khi rời tab. Phản hồi hồ sơ đến muộn không ghi đè hồ sơ đang mở.
- Trang Kế hoạch đào tạo không gọi lại danh mục chỉ vì vừa chọn chuyên ngành
  mặc định. Trang Phân nhóm không gọi lặp danh sách lớp/học viên khi danh mục
  vừa tải xong mà chưa chọn ngành để lọc.
- Bảo lưu chỉ debounce nội dung tìm kiếm; lần mở trang, lọc trạng thái và
  chuyển trang gọi API ngay.
- `CatalogManager` dựng tối đa 25 dòng mỗi trang. Tìm kiếm vẫn áp dụng trên
  toàn danh mục; số thứ tự và điều hướng trang theo kết quả tìm kiếm.

## Kết quả local

| Trang | Trước | Sau |
| --- | ---: | ---: |
| Nhập hồ sơ tuyển sinh, khi quay lại | 4,716 s | 0,663 s |
| Danh sách học viên, khi quay lại | 4,966 s | 0,373 s |
| Danh sách thi/điểm | 4,575 s | 0,687 s |
| Kế hoạch đào tạo | 2,248 s | 0,990 s |
| Giảng viên | 1,427 s | 0,486 s |

Đo bằng Edge headless, màn hình 1440×1000, Vite ở localhost:3100 và database
local hiện có. Thời gian là từ bắt đầu điều hướng đến lúc mạng ổn định,
bao gồm khoảng chờ kiểm tra 200 ms; không phải cam kết cho mọi máy hoặc dữ liệu.
Lượt cuối không chạy test đồng thời. Trang đầu tiên từ một document mới cần
khoảng 1,17 s để tải ứng dụng/kiểm tra phiên; các lần chuyển trang sau đều dưới 1 s.
Không ghi nhận exception JavaScript trong 60 route được kiểm tra.

API local riêng lẻ ở các trang chính trả về khoảng 11–50 ms trong lượt đo
ban đầu. Các thay đổi tập trung vào tải mã, dựng giao diện và giảm request lặp.

## Kiểm tra hồi quy

116 test trong 14 file đã qua, gồm mở/sửa hồ sơ, xác thực route, menu điều hướng,
tải tab học tập, bảng điểm, chuyển ngành, công nhận học phần, kế hoạch đào tạo,
phân nhóm học viên, danh mục, phân trang và bảo lưu.

Các test mới kiểm tra việc chưa gọi API tab chưa mở, hiển thị tiến trình khi
request chậm, chia sẻ phiên giữa các route, tìm kiếm qua nhiều trang danh mục,
prefetch một lần, chọn đúng route tĩnh trước route động và thử lại prefetch lỗi.
Một số mock axios/router kiểu Jest cũ trong các file liên quan đã được cập nhật
để chạy đúng trên Vitest hiện tại.

Lượt đầu chỉ ghi nhận exception JavaScript nên bỏ sót lỗi đã được trang bắt và
hiện thành Alert. Trang Điểm xét tuyển từng có biến phản hồi `session` trùng tên
với phiên dùng chung, gây lỗi trước khi tải xong các request. Đã đổi tên thành
`sessionResponse`, bổ sung test có `AuthSessionContext` và chạy 5 test xét tuyển.
Kiểm tra local xác nhận đợt hiện tại, bảng dữ liệu và nút tạo đợt đều xuất hiện.
Lượt rà lại 60 route kiểm tra cả các Alert lỗi trên giao diện và không ghi nhận lỗi.
