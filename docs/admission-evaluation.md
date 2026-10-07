# Xét tuyển thạc sĩ theo điểm ngưỡng

1. Vào **Đào tạo thạc sĩ → Điểm xét tuyển thạc sĩ**. Bấm **Tạo đợt xét tuyển**, nhập tên đợt và năm tuyển sinh. Mỗi đợt dùng chung cho toàn viện, có bảng **Điểm ngưỡng từng ngành**. Nhập điểm ngưỡng (0–20) vào các dòng ngành và bấm **Lưu điểm ngưỡng các ngành**. Ngành chưa có ngưỡng chờ xét tuyển, không dùng ngưỡng của ngành khác.
2. Bảng tự liệt kê hồ sơ thạc sĩ của tất cả ngành trong năm chưa thuộc đợt khác. Bấm **Tải file Excel mẫu** để tải file `.xlsx` chứa đúng danh sách đang hiển thị theo bộ lọc: **Mã hồ sơ**, **Họ tên**, **Năm sinh**, **Giới tính**, **Chuyên ngành**, **Số điện thoại**, **Email**, **Tổng điểm (0–20)** và **Trạng thái**. Mẫu giữ điểm hiện có; chỉ cần điền hoặc sửa cột Tổng điểm, lưu file và bấm **Import từ file Excel** để chọn file. Import hợp lệ tự lưu điểm hàng loạt, không cần bấm lưu thêm. Có thể nhập nhiều ngành cùng lúc, dùng dấu phẩy thập phân và bỏ trống điểm của các dòng chưa nhập. Điểm 0 vẫn được nhập.
3. Nếu nhập trực tiếp trên bảng, bấm **Lưu điểm hàng loạt**. Mẫu Excel giữ thông tin nhận diện và phiên bản hồ sơ ở các cột ẩn để ghép đúng hồ sơ, kể cả hồ sơ chưa có mã. Import kiểm tra đúng đợt, cấu trúc mẫu, thông tin nhận diện, dòng trùng, phiên bản và điểm trước khi ghi. Hồ sơ đã duyệt giữ nguyên điểm được bỏ qua; sửa điểm đã duyệt bị chặn. Mỗi lần import tối đa 2.000 hồ sơ, file tối đa 10 MB. Các dòng điểm được lưu trong cùng transaction, kèm lịch sử; một dòng lỗi hủy lần lưu. Import/lưu điểm không thay đổi trạng thái nghiệp vụ của hồ sơ.
4. Dùng **Lọc ngành** và **Lọc hồ sơ** để xem từng ngành, hồ sơ đạt ngưỡng, dưới ngưỡng hoặc chưa nhập điểm. Mỗi hồ sơ được so với ngưỡng ngành đăng ký của chính hồ sơ trong đợt đã chọn. Điểm bằng ngưỡng cũng đạt. Điểm chưa nhập không được coi là 0.
5. Bấm **Xét tuyển** để mở danh sách đạt ngưỡng chưa duyệt của toàn đợt, độc lập với bộ lọc đang xem. Danh sách hiển thị ngành và ngưỡng riêng của mỗi hồ sơ. Tất cả hồ sơ được chọn sẵn. Quản lý có thể bỏ chọn và bấm **Đồng ý duyệt** để chuyển các hồ sơ được chọn sang **Đã trúng tuyển** (`status=approved`). Bấm Hủy không cập nhật trạng thái.

Luồng này không dùng chỉ tiêu, giới hạn số lượng hay xếp hạng để loại hồ sơ đạt ngưỡng. Không phải nhập văn bản hoặc số/ngày quyết định để thiết lập ngưỡng, lọc danh sách và xác nhận duyệt.

Tổng điểm nhập tay được lưu tại `inputs.manualTotal`. Backend so sánh trực tiếp với ngưỡng ngành. Hồ sơ từng được tính điểm thành phần vẫn giữ dữ liệu cũ; nhập tổng điểm sẽ dùng tổng điểm đã chốt, không tự đánh dấu đã xác minh các minh chứng.

Backend khóa dữ liệu và kiểm tra lại danh sách, ngưỡng, phiên bản trước khi duyệt. Nếu điểm hoặc hồ sơ thay đổi sau khi mở danh sách, cần xét lại. Kết quả đã duyệt cần mở lại trước khi sửa; hồ sơ đã đang học cần xử lý nghiệp vụ học viên trước. Lịch sử lưu điểm, thao tác duyệt và người thực hiện.

Tab **Xét tuyển** trong chi tiết hồ sơ chỉ hiển thị **Kết quả xét tuyển** và **Lịch sử xét tuyển**, không có nhập liệu hay duyệt riêng. Nhập điểm và duyệt danh sách tại **Điểm xét tuyển thạc sĩ**. Kết quả đã duyệt hiển thị theo snapshot của quyết định; lịch sử ghi năm, đợt, tên ngành, điểm và ngưỡng tại thời điểm thao tác. Lịch sử cũ chưa lưu tên ngành được đối chiếu bằng mã ngành đã lưu.

Mỗi hồ sơ có một kết quả hiện tại. Nếu cùng một người đăng ký ngành khác trong năm sau, tạo hồ sơ tuyển sinh mới cho năm/ngành mới và đợt mới; giữ hồ sơ năm trước để tra cứu kết quả. Không sửa năm/ngành của hồ sơ cũ để thay cho lần đăng ký mới. Hệ thống chưa có màn hình gộp nhiều hồ sơ của cùng một người; lịch sử trong tab thuộc hồ sơ đang xem.

Migration `045-admission-evaluation` tạo đợt, điểm và lịch sử. Migration `046-admission-threshold-only` bỏ cột chỉ tiêu. Migration `047-institute-admission-rounds` chuyển điểm ngưỡng ngành cũ sang danh sách `majorThresholds` trong đợt chung, giữ nguyên ID đợt, điểm hồ sơ và lịch sử; không tự gộp các đợt cũ khác nhau khi chưa biết chúng có cùng đợt tuyển sinh thực tế hay không. Môi trường mới áp dụng cả ba migration theo thứ tự.

```powershell
npm --prefix backend run db:migrate
npm --prefix backend run test:unit
npm --prefix frontend run test:ci -- --runTestsByPath src/test/integration/AdmissionEvaluation.test.jsx src/test/integration/BulkAdmissionWorkflow.test.jsx src/test/integration/AdmissionThresholds.test.jsx
npm --prefix frontend run test:ci -- --runTestsByPath src/test/integration/AdmissionExcel.test.js
npm --prefix frontend run build
```

Bảng hồ sơ xét tuyển hiển thị năm sinh, giới tính và liên hệ để đối chiếu với mẫu Excel. Mẫu mới có các thông tin này; file mẫu phiên bản cũ vẫn import được. Chỉ sửa cột điểm, giữ nguyên các thông tin nhận diện.

Tạo 30 hồ sơ mẫu năm 2026 bằng `npm --prefix backend run db:seed:admissions`. Mã từ `XT26-MAU-001` đến `XT26-MAU-030`, phân bổ đều vào các ngành thạc sĩ đang hoạt động. Hồ sơ có ngày sinh, giới tính và liên hệ mẫu, chưa nhập điểm, trạng thái chờ xử lý. Chạy lại không tạo trùng hay ghi đè hồ sơ; dữ liệu mẫu được đánh dấu trong ghi chú và `extraData.seed`.
