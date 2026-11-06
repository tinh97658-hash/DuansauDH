# Rà soát hiệu năng và tải lại dữ liệu

Ngày rà soát: 06/11/2026. Phạm vi: mã frontend React, các luồng xếp lịch / nhập điểm / dashboard / báo cáo, đường truy vấn liên quan ở backend và bản build production.

## Kết luận

Có tải lại dữ liệu quá thường xuyên khi chuyển cửa sổ hoặc quay lại tab. Không tìm thấy lời gọi `location.reload()` hay `navigate(0)` trong mã frontend được rà soát. Phần lớn cảm giác “reload” đến từ gọi lại API và thay nội dung bằng trạng thái loading.

## Các điểm đã sửa

| Vị trí | Nguyên nhân | Thay đổi |
| --- | --- | --- |
| `frontend/src/features/scheduling/shared.jsx` — `useLoad` | Mỗi hook tự nghe focus / visibility; thời gian chặn chỉ 250 ms. Một trang có nhiều hook, mở thêm dialog lại có thêm request. | Giữ dữ liệu khi tải nền; chỉ tải lại qua focus khi lần tải trước cách ít nhất 30 giây; tiếp tục chặn khi request đang chạy. |
| `frontend/src/features/dashboard/OperationalDashboard.jsx` | Timer 30 giây và focus / visibility cùng có thể tăng revision trước khi React cập nhật cờ đang tải. | Gộp các sự kiện bằng một bộ chặn đồng bộ; chỉ tải khi dữ liệu đã đủ 30 giây và không có request đang chạy. |
| `frontend/src/pages/masters/examSchedule.jsx` | Focus luôn kích hoạt tải; timer không kiểm tra request đang chạy; đổi tuần chỉ bỏ qua phản hồi cũ. | Khoảng tối thiểu 60 giây cho tải tự động, chặn request chồng nhau và truyền AbortSignal khi đổi tuần / unmount. |
| `frontend/src/pages/masters/examLists.jsx` | Quay lại cửa sổ là tải lại bảng điểm; focus và visibility có thể đến cùng nhau. | Giới hạn tải qua focus ở 30 giây, chặn khi đang tải. Các thông báo đổi chính sách / hồ sơ vẫn cập nhật ngay. |
| Các loader trong `CourseMatrix`, `CreateOffering`, `OfferingDetails`, `SessionEditor`, `Workspace` | Hook tạo AbortController nhưng nhiều callback không truyền signal xuống Axios, nên request vẫn tiếp tục khi đóng màn hình. | Truyền signal đến các request tương ứng, gồm nhóm request song song của form xếp lịch. |
| `frontend/src/pages/reports/classScoreSummary.jsx` | Request cũ không được hủy; mỗi phím gõ xóa bảng trong lúc chờ debounce dù chưa có request mới. | Hủy request cũ; giữ nguyên bảng đang hiển thị trong khoảng debounce 250 ms; khóa xuất / phân trang trong lúc chờ. |

Các thao tác lưu, đổi bộ lọc, đổi tuần, tải lại chủ động và các sự kiện cập nhật nghiệp vụ vẫn thực hiện ngay, không chịu khoảng chặn focus. Dữ liệu thay đổi từ thiết bị khác có thể cần tối đa khoảng thời gian trên trước khi lần focus tiếp theo được phép tải lại. Hook xếp lịch và trang nhập điểm không được bổ sung polling mới.

## Những điểm còn cần tối ưu

1. **Truy vấn theo từng lớp ở ma trận:** `backend/src/scheduling/scheduling.service.ts`, vòng lặp gọi `this.classScores.get({ classGroupId: group.id }, true)` cho từng lớp có học phần hoàn thành. Đây là truy vấn tuần tự theo số lớp; mỗi báo cáo còn đọc chương trình, danh sách học viên và điểm. Nên đo số câu SQL / thời gian theo số lớp, sau đó gom truy vấn theo tập lớp và giữ nguyên quy tắc chọn lần thi. Không thay bằng Promise.all không giới hạn vì pool DB mặc định chỉ có 10 kết nối.
2. **Dữ liệu danh mục tải lại theo từng hook:** danh mục chuyên ngành, giảng viên, đơn vị và phòng chưa được chia sẻ request giữa các component. Khoảng chặn đã giảm tần suất, nhưng các hook vẫn gửi request riêng. Có thể bổ sung cache ngắn hạn có khóa theo hồ sơ làm việc và cơ chế vô hiệu hóa sau khi sửa danh mục; không cache chung dữ liệu phân quyền giữa các hồ sơ.
3. **Render lịch thi mỗi giây:** `useExamWallTime` cập nhật state mỗi giây ở trang lịch thi và các editor để xác định thời điểm đóng ca. Đây là render phía client, không phải gọi API. Với nhiều ca thi, nên profile chi phí render và tách đồng hồ / trạng thái hết hạn khỏi toàn bộ lịch; phải giữ chính xác mốc đóng ca.
4. **Kích thước tài nguyên:** bản build có ảnh `profile-picture` khoảng 2,268 kB; chunk ExcelJS khoảng 940 kB và pdfmake khoảng 1,011 kB trước gzip. Thư viện xuất tài liệu đã dùng dynamic import ở các đường kiểm tra, nên không thể suy ra tất cả đều tải ngay lúc mở trang. Cần xem waterfall theo trang; ảnh đại diện là ứng viên nén / đổi định dạng. Không sửa ảnh trong đợt này.
5. **Phạm vi Suspense:** `App.js` đặt fallback quanh RouterProvider; khi route lazy chưa tải xong, người dùng có thể thấy màn hình chờ thay vùng ứng dụng. Nên đo chuyển trang với cache lạnh trước khi đổi cấu trúc layout dùng chung.

## Kiểm chứng và giới hạn

- Build production bằng `npm --prefix frontend run build`: thành công ở trạng thái mã cuối.
- Kiểm thử mới cho gộp focus / visibility / timer, bỏ qua tab ẩn và focus vào ô nhập, chặn request đang chạy, cleanup listener, tải lại chủ động và bỏ phản hồi cũ sau khi đổi phạm vi.
- Kiểm thử tích hợp dashboard, bảng tổng hợp điểm, lịch thi, nhập điểm và giữ ghi chú trong dialog khi quay lại tab. Kỳ vọng request được cập nhật để bao gồm AbortSignal; các bài refocus chờ đủ thời gian mới.
- Chạy rộng 6 bộ tích hợp: lần đầu 170/178 bài qua; các lỗi do kỳ vọng tải ngay / cấu hình request cũ và selector nút Đóng được sửa. Các lượt xác nhận sau đó bao phủ **120 bài khác nhau, đều qua**: 52 bài dashboard / báo cáo / hook; 67 bài xếp lịch / lịch thi / bảo vệ route; thêm bài refocus của nhập điểm. Các lượt chạy riêng báo cáo điểm và nhóm lỗi cũ cũng qua; không cộng lại các bài trùng. Chưa chạy toàn bộ test suite của repository.
- Chưa đo latency p50/p95, SQL execution plan, số người dùng đồng thời hoặc React Profiler trên phiên có đăng nhập và dữ liệu thực. Các điểm backend / bundle ở trên là bằng chứng từ mã và build, chưa phải kết quả kiểm thử tải. Không đưa ra tỷ lệ tăng tốc giả định.

Để đo tiếp: ghi network log cho các luồng mở trang → chuyển tab → quay lại ngay → quay lại sau 30/60 giây → lưu → đổi bộ lọc liên tiếp; đối chiếu số request, request bị hủy, dữ liệu cuối và việc giữ bản nháp. Với backend, chạy trên bản sao dữ liệu đại diện và thu số SQL / thời gian của endpoint ma trận theo 1, 10, 50 lớp trước khi chỉnh truy vấn.
