# Rà soát logic đào tạo — 06/11/2026

## Phạm vi

Rà soát luồng danh mục học phần → CTĐT → lớp → mở lớp học phần → kết quả học tập/báo cáo → khóa sửa. Đây là rà soát luồng nghiệp vụ đang chỉnh sửa, không phải chứng nhận toàn bộ hệ thống không còn lỗi.

Quy tắc đang áp dụng: mỗi lớp gắn một CTĐT và học danh sách môn của CTĐT đó. Bắt buộc/tự chọn là thuộc tính của môn trong CTĐT; không có gói chọn môn, hạn mức nhóm hoặc cấu hình ghi đè theo lớp. Môn đã có sử dụng thực tế được khóa sửa loại học phần. Hai lớp muốn cấu hình khác nhau dùng hai CTĐT riêng, có thể cùng tham chiếu một học phần trong danh mục.

## Lỗi xác nhận và đã sửa trong đợt rà soát này

| Mức độ nghiệp vụ | Tình huống trước sửa | Hậu quả | Cách sửa |
| --- | --- | --- | --- |
| Cao | Đổi ngành/bậc của CTĐT chưa được sử dụng nhưng đã có môn | CTĐT chứa môn ngoài ngành/bậc mới | Kiểm tra phạm vi tất cả môn trước khi đổi trong `curriculum.service.ts` |
| Vừa | Gửi tổng tín chỉ tùy ý qua API cập nhật CTĐT | Tổng lưu không bằng danh sách môn | Đối chiếu tổng với tín chỉ thực tế, từ chối tổng sai |
| Cao | Đổi ngành/bậc môn danh mục đang có trong CTĐT chưa sử dụng | Môn bị chuyển khỏi phạm vi CTĐT | Chặn chuyển phạm vi khi còn tham chiếu trong `plan.service.ts` |
| Cao | Xóa lớp kiểm tra dữ liệu rồi xóa ngoài transaction | Có khoảng trống cạnh tranh với việc thêm học viên/mở học phần | Dùng transaction, khóa nghiệp vụ cùng thứ tự và khóa dòng lớp trong `class-group.service.ts` |
| Vừa | Chuyển CTĐT A → B trong khi tải/lưu A còn chờ | Phản hồi A về muộn ghi đè màn hình B | Kiểm tra phạm vi, CTĐT hiện tại và thứ tự yêu cầu; bỏ phản hồi cũ trong `trainingPlan.jsx` |

Các trường hợp đổi phạm vi, tổng tín chỉ sai và phản hồi UI về muộn có kiểm thử tái hiện thất bại trước khi sửa. Kiểm thử xóa lớp kiểm tra cùng transaction, khóa dòng và thứ tự khóa nghiệp vụ. Kiểm thử PostgreSQL bổ sung xác nhận hai kết nối không thể đồng thời lấy khóa cấu trúc; chưa mô phỏng toàn bộ cuộc đua xóa lớp với thêm học viên bằng hai API.

## Kiểm tra bảo mật tĩnh bổ sung

Áp dụng skill `secure-code-review` cho việc đọc mã API; phần này không thay đổi mô hình quyền hay RLS. Ranh giới xem xét: trình duyệt → controller NestJS → service Sequelize/PostgreSQL.

| Nhóm kiểm tra | Bằng chứng tĩnh | Giới hạn |
| --- | --- | --- |
| ASVS V4 — Kiểm soát truy cập | Controller có `AuthenticatedGuard`, `PermissionsGuard`; các API sửa CTĐT yêu cầu `plan.manage`; entry được kiểm tra thuộc CTĐT | Chưa xác minh đầy đủ mọi tài khoản/vai trò và RLS bằng phiên đăng nhập thực |
| ASVS V5 — Kiểm tra đầu vào | DTO kiểm tra boolean cho loại học phần; service kiểm tra phạm vi và tổng tín chỉ; tham số truy vấn được truyền bằng binding | Không kiểm thử xâm nhập toàn bộ API |
| ASVS V11 — Logic nghiệp vụ | Kiểm tra sử dụng thực tế ở backend; các thao tác cấu trúc dùng khóa/transaction | Chưa xác minh mọi đường chạy đồng thời trên DB thực |

Chưa xác nhận lỗ hổng bảo mật trong phần kiểm tra tĩnh này; kết luận đó không tương đương đã kiểm thử đầy đủ quyền truy cập hoặc toàn bộ hệ thống.

## Kiểm chứng

- Bộ kiểm thử giao diện `TrainingPlanSubjectIdentity.test.jsx`: 46/46 đạt, gồm hai tình huống phản hồi về muộn.
- Ba bộ unit test backend trực tiếp cho các thay đổi: 78/78 đạt.
- Build backend và frontend thành công. Frontend còn cảnh báo kích thước bundle và cảnh báo Tooltip trong test; không làm test/build thất bại.
- Lần chạy toàn bộ backend: 88 suite đạt, 24 suite bỏ qua; 1.363 test đạt, 327 test bỏ qua. Không tính các test bị bỏ qua là đã xác minh.
- PostgreSQL đã kết nối lại. Đã bổ sung chạy sáu bộ tích hợp liên quan trên cơ sở dữ liệu thử riêng: cấu hình CTĐT, khóa từng môn, CTĐT đơn giản, báo cáo điểm, bảo vệ cấu trúc và thứ tự lần học. Kết quả: **6/6 suite, 59/59 test đạt**, không bỏ qua test nào trong sáu bộ này. Cơ sở dữ liệu thử được xóa sau chạy.
- Đã sửa dữ liệu mẫu của bộ báo cáo: ID học viên/sinh viên dùng UUID đúng kiểu sản xuất, bổ sung trường học phí còn thiếu, cập nhật kỳ vọng cờ miễn thi và cô lập từng test bằng savepoint. Bổ sung trường `is_required` còn thiếu trong fixture thứ tự lần học. Không sửa logic điểm/quyền để làm test đạt.
- Đối chiếu dữ liệu thật: 29/29 lớp hành chính có CTĐT. Không phát hiện sai ngành/bậc/khóa giữa lớp và CTĐT, sai phạm vi môn, sai khối kiến thức, sai tổng tín chỉ, lệch tín chỉ môn hoặc môn trùng trong CTĐT.
- Đọc báo cáo, danh sách học viên và dữ liệu bảng điểm theo lô cho cả 29 lớp: 417 dòng học viên, 417 hồ sơ bảng điểm, không lỗi truy vấn hoặc thiếu hồ sơ. Số lượng học viên giữa báo cáo và danh sách lớp khớp nhau; tổng tín chỉ báo cáo khớp CTĐT.
- Hàm xác định khóa môn chạy được cho cả 28 CTĐT đang gắn với các lớp: 102 mục khóa, 481 mục còn sửa được. Đây là số mục môn trong CTĐT, không phải số môn danh mục duy nhất.

## Giới hạn còn lại

Đối chiếu dữ liệu thật là thao tác đọc bằng kết nối DB của ứng dụng, chưa xác minh từng vai trò qua phiên đăng nhập/RLS. Chưa mở lại toàn bộ các bộ tích hợp ngoài luồng đào tạo đang rà soát; chưa kiểm thử tải đồng thời toàn hệ thống. Các số liệu là tại thời điểm rà soát, không phải cam kết mọi dữ liệu phát sinh sau đó đều đúng.

Không chạy migration hoặc sửa dữ liệu đào tạo thật trong đợt rà soát này. Nếu cần hoàn tác các sửa đổi của đợt này, chỉ hoàn tác các hunk tương ứng trong bốn service/UI và các kiểm thử đi kèm; workspace có nhiều thay đổi từ trước, không reset toàn bộ.
