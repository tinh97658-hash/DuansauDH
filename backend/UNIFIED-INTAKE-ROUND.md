Đợt tuyển sinh được định danh bằng **năm nhập học + số đợt (1–99)**. Ví dụ lớp `CNTT 2026.2.1` và hồ sơ năm 2026, đợt 2 cùng thuộc đợt số 2 trong Quản lý năm / đợt.

Trước khi khởi động backend mới, chạy migration theo quy trình triển khai hiện có:

```sh
npm --prefix backend run db:migrate
```

Migration `103-unified-intake-round` thêm số đợt vào danh mục xét tuyển và hồ sơ. Chỉ tên đợt có số rõ ràng, không trùng trong năm mới được nhận diện tự động. Hồ sơ được đối chiếu từ kết quả xét tuyển; hồ sơ chưa có kết quả có thể được đối chiếu từ lớp cùng năm. Dữ liệu không đủ căn cứ giữ giá trị trống và có thể lọc bằng “Chưa xác định đợt”.

Vào **Quản lý năm / đợt**, sửa các đợt cũ có cảnh báo để khai báo số đợt. Hệ thống giữ nguyên quyết định xét tuyển khi chỉ bổ sung số cho đợt cũ; hồ sơ liên quan được cập nhật trong cùng giao dịch. Nếu hồ sơ hoặc lớp đang mâu thuẫn với số đợt, cần đối soát trước. Không đổi năm/số đợt đã có dữ liệu sử dụng.

API danh sách hồ sơ và lớp nhận `intakeRound=1..99`, `intakeRound=unassigned`, hoặc bỏ tham số để lấy tất cả. Thống kê và xuất hồ sơ dùng cùng điều kiện. Phân lớp chỉ nhận học viên cùng chuyên ngành, năm và đợt; hồ sơ chưa xác định đợt cần được đối soát trước khi phân lớp.

Các bộ lọc áp dụng tại nhập hồ sơ, hồ sơ trúng tuyển/học viên, hồ sơ bảo lưu, tạo và phân lớp, bảng điểm, tổng hợp điểm, theo dõi tiến độ, tạo lớp học phần, ma trận, lịch học và lịch thi. Các chức năng đang là stub không bổ sung bộ lọc giả.
