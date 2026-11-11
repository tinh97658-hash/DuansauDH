# Kế hoạch cấu hình và cấp mã học viên

Ngày: 10/11/2026. Trạng thái: đã triển khai chức năng cốt lõi trong mã nguồn và kiểm chứng trên database tạm; chưa áp dụng migration vào database nghiệp vụ. Hướng dẫn sử dụng và các quy tắc thực tế: [Cấu hình và cấp mã học viên](../learner-code-management.md). Các lựa chọn chưa chốt bên dưới được xử lý bằng cấu hình hoặc giữ nguyên dữ liệu, không tự suy đoán.

## 1. Yêu cầu và cách hiểu ảnh ghi chú

- Mẫu mặc định 9 ký tự: 2 chữ viết tắt chuyên ngành + 2 số năm + 1 số đợt + 1 số thứ tự lớp + đoạn thứ tự 3 ký tự theo loại hồ sơ.
- Ví dụ minh họa: `CN2611001` = `CN` + `26` + `1` + `1` + `001`. `CN` chỉ là ví dụ, người quản trị tự định nghĩa.
- Cho phép cấu hình độ dài, thứ tự thành phần, ký tự phân cách, phạm vi bộ đếm và số bắt đầu; không cố định mọi chuyên ngành vào mẫu 9 ký tự.
- Ghi chú đỏ về thêm một số và ba chữ số tự nhập chưa đủ rõ để chốt công thức. Kế hoạch hỗ trợ cả thành phần hằng số một chữ số và thành phần ba chữ số nhập tay, tùy chọn vị trí; không mặc định áp dụng cho mọi mã.
- Các thao tác cấu hình, phân loại, cấp/đổi mã được tách thành quyền riêng trong hồ sơ làm việc. Mặc định đề xuất chỉ cấp các quyền ghi mới cho hồ sơ Quản trị hệ thống; việc ủy quyền cho vai trò khác phải thực hiện tường minh qua cây phân quyền, không dựa vào tên hiển thị vai trò. Xem ma trận tại mục 6.1. Việc hiển thị mã trên hồ sơ vẫn theo quyền xem hồ sơ hiện có.
- Yêu cầu bổ sung của người dùng: phân biệt hồ sơ bình thường, hồ sơ sinh viên đã học tiền thạc sĩ và hồ sơ học viên học trước. Hồ sơ thường dùng đuôi `001`, `002`...; hồ sơ đặc biệt dùng đuôi số kèm chữ cái cấu hình theo loại, ví dụ `01B`. Các loại có bộ đếm độc lập, không làm ngắt dãy của hồ sơ thường. Chữ `B` là ví dụ, không được viết cố định trong chương trình.

## 2. Hiện trạng đã đối chiếu mã nguồn

- Migration `081-unique-learner-codes.ts` tự cấp mã tại trigger PostgreSQL theo `HV` + năm 2 số + sequence chung; không dùng chuyên ngành, đợt hoặc lớp.
- `learner_code_reservations` giữ mã đã dùng, kể cả khi đổi mã hoặc xóa hồ sơ; unique index so sánh mã sau khi bỏ khoảng trắng đầu/cuối và không phân biệt hoa thường.
- Hồ sơ tuyển sinh dùng `admission_records.code`, hiện còn được hiển thị chung là mã học viên / số báo danh. Cột này bị ràng buộc không rỗng ở database.
- Chuyên ngành có `majors.code`; cần thêm tên viết tắt dùng riêng cho mã học viên, tránh thay đổi ý nghĩa mã danh mục.
- Lớp có `academicYear`, `intakeRound`, `groupNumber`, `majorId`, `program`. Hồ sơ có thể chưa có chuyên ngành hoặc lớp khi tiếp nhận.
- Đã có kiểm thử PostgreSQL về trùng mã, cấp đồng thời, giữ mã lịch sử và rollback. Cần mở rộng các kiểm thử này khi triển khai.

## 3. Các cấu hình cần có

### 3.1. Viết tắt chuyên ngành

- Trường riêng trong danh mục chuyên ngành: ví dụ `CN`, `KT`, `QL`, `CNTT`; admin tự nhập và xem trước mã.
- Mặc định 2 ký tự, cho phép dài hơn khi chọn mẫu linh hoạt. Chuẩn hóa chữ hoa, bỏ khoảng trắng đầu/cuối; kiểm tra tập ký tự được phép.
- Có thể đặt giá trị ghi đè theo bậc/năm/đợt trong quy tắc. Đổi tên viết tắt chỉ ảnh hưởng mã cấp mới.
- Hai chuyên ngành dùng cùng viết tắt phải được cảnh báo. Khi mẫu có nguy cơ tạo cùng mã, yêu cầu thành phần phân biệt hoặc dùng chung bộ đếm; vẫn kiểm tra trùng toàn hệ thống khi cấp.

### 3.2. Bộ ghép mã

Giao diện thêm, bớt và đổi thứ tự các thành phần từ danh sách có sẵn:

| Thành phần | Cấu hình |
| --- | --- |
| Viết tắt chuyên ngành | Lấy danh mục hoặc giá trị ghi đè |
| Năm | Năm tuyển sinh/đào tạo đã chọn; hiển thị 2 hoặc 4 số |
| Đợt | Nguồn dữ liệu đợt đã xác định; độ dài và số 0 đầu |
| Thứ tự lớp | `groupNumber` của lớp hành chính chính; độ dài tùy chọn |
| Số tự tăng | Độ dài, số bắt đầu, phạm vi, hành vi khi vượt giới hạn |
| Ký hiệu loại hồ sơ đặc biệt | Một chữ cái do admin cấu hình theo loại; để trống với hồ sơ bình thường |
| Giá trị cố định | Chữ hoặc số, kể cả một chữ số như ghi chú đỏ |
| Giá trị nhập tay | Độ dài, bắt buộc hay tùy chọn, chỉ số hay chữ/số |
| Phân cách | Không có, dấu gạch ngang, dấu chấm... theo lựa chọn hợp lệ |

Không cho nhập biểu thức hay mã thực thi. Mẫu được lưu dưới dạng danh sách thành phần có kiểu và được kiểm tra ở backend. Tổng chiều dài không vượt giới hạn cột mã hiện tại là 50 ký tự; nếu cần dài hơn phải có migration và rà soát toàn bộ nơi hiển thị/xuất.

Mẫu chuẩn kiểm tra đúng 9 ký tự. Mẫu linh hoạt hiển thị rõ tổng độ dài và cảnh báo khi khác mẫu chuẩn.

### 3.3. Số bắt đầu và phạm vi tự tăng

- Admin chọn số bắt đầu, ví dụ `1` → `001`, `37` → `037`, `125` → `125`; bước tăng mặc định là 1.
- Mặc định đề xuất: bộ đếm riêng theo **bậc + chuyên ngành + năm + đợt + lớp hành chính chính + loại hồ sơ**. Lớp mới bắt đầu lại từ số đã cấu hình. Phân tách bộ đếm theo loại hồ sơ là yêu cầu đã được người dùng xác nhận; các chiều phạm vi còn lại vẫn là đề xuất.
- Cho phép chọn bộ đếm toàn hệ thống, theo năm, theo chuyên ngành/năm, theo chuyên ngành/năm/đợt hoặc theo lớp. Khóa bộ đếm dùng ID và giá trị năm đầy đủ, không chỉ dùng chuỗi tiền tố hiển thị.
- Hiển thị riêng: số bắt đầu, số đã cấp gần nhất, số tiếp theo dự kiến và số còn lại trong dải.
- Có tùy chọn bỏ qua mã đã được giữ chỗ và tiếp tục tìm số hợp lệ. Mã nhập tay bị trùng phải báo lỗi, không tự sửa đầu vào của admin.
- Bộ đếm đã dùng không được đặt lùi để tái sử dụng mã. Muốn nhảy tới một số lớn hơn cần nhập lý do và ghi lịch sử.
- Với đoạn đuôi dài 3 ký tự: hồ sơ thường chặn ở `999`; hồ sơ đặc biệt dùng 2 chữ số và 1 chữ cái, chặn ở `99` (ví dụ `99B`). Có thể cấu hình tăng độ dài nhưng phải xem trước và xác nhận thay đổi quy tắc. Không cắt số, tự đổi chữ cái hoặc quay về đầu.
- Không cam kết số liên tục không có khoảng trống; ưu tiên duy nhất, giữ lịch sử và an toàn khi cấp đồng thời.

### 3.4. Áp dụng và ưu tiên quy tắc

- Một quy tắc mặc định cấp Viện; cho phép quy tắc cụ thể hơn theo bậc, chuyên ngành, năm, đợt và lớp.
- Quy tắc lớp được ưu tiên trước, tiếp đến chuyên ngành/năm/đợt, chuyên ngành/năm, chuyên ngành, bậc và mặc định Viện. Kiểm tra và chặn hai quy tắc cùng mức ưu tiên cùng có hiệu lực cho một hồ sơ.
- Có ngày hiệu lực, trạng thái nháp/đang dùng/ngừng dùng và phiên bản. Mỗi lần cấp lưu phiên bản và các thành phần thực tế được sử dụng.
- Thay phiên bản quy tắc không tự tạo bộ đếm mới hoặc đưa số về đầu. Việc mở bộ đếm mới phải là lựa chọn rõ ràng, có kiểm tra xung đột mã lịch sử.

### 3.5. Loại hồ sơ và chữ cái cấu hình

Yêu cầu đã xác nhận: cho phép cấu hình chữ cái cho các loại hồ sơ đặc biệt, không gán cứng `B` cho mọi trường hợp.

| Loại hồ sơ | Đoạn đuôi khi giữ độ dài 3 ký tự | Bộ đếm |
| --- | --- | --- |
| Bình thường | `001`, `002`, `003`... | Riêng cho hồ sơ thường |
| Sinh viên đã học tiền thạc sĩ | `01B`, `02B`... nếu cấu hình chữ `B` | Riêng cho loại tiền thạc sĩ |
| Học viên học trước | `01` + chữ cấu hình, `02` + chữ cấu hình... | Riêng cho loại học trước |

- Hồ sơ có trường loại riêng, bắt buộc xác định trước khi xem trước/cấp mã. Không suy đoán loại chỉ từ đuôi mã, không nhầm loại hồ sơ với trạng thái xét tuyển hoặc bậc đào tạo.
- Admin cấu hình tên loại và chữ cái trên danh mục/quy tắc mã; chữ cái được chuẩn hóa in hoa, đề xuất chỉ nhận một ký tự `A–Z`. Hồ sơ thường không có chữ cái. Hồ sơ đặc biệt chưa có chữ cấu hình thì chặn cấp mã, không tự gán mặc định.
- Trong cùng phạm vi có thể tạo cùng tiền tố, chặn hai loại đặc biệt có cùng chữ cái để tránh hai bộ đếm độc lập tạo cùng mã. Kiểm tra cả các quy tắc ghi đè và mã đã giữ chỗ; unique constraint vẫn là lớp bảo vệ cuối cùng.
- Khóa bộ đếm dùng ID loại hồ sơ ổn định, không dùng tên loại hoặc chữ cái làm danh tính. Sửa tên/chữ cấu hình không tự đặt lại bộ đếm, không đổi mã đã cấp; thay chữ áp dụng cho lần cấp mới qua phiên bản quy tắc.
- Giữ nguyên các thành phần chuyên ngành/năm/đợt/lớp khi cấp xen kẽ các loại trong cùng phạm vi. Chỉ cách dựng đoạn đuôi và bộ đếm tương ứng thay đổi.

Ví dụ bắt buộc khi cấp xen kẽ, với tiền tố `CN2612` và chữ tiền thạc sĩ cấu hình là `B`:

| Thứ tự thao tác | Loại hồ sơ | Mã được cấp |
| --- | --- | --- |
| 1 | Bình thường | `CN2612001` |
| 2 | Bình thường | `CN2612002` |
| 3 | Tiền thạc sĩ | `CN261201B` |
| 4 | Bình thường | `CN2612003` |
| 5 | Tiền thạc sĩ | `CN261202B` |

Nếu có nhiều loại hồ sơ trong một lô, từng loại chỉ tiêu thụ số của chính bộ đếm đó. Đổi loại sau khi đã cấp mã phải đi qua thao tác riêng có lý do và lịch sử, không tự đổi mã qua màn hình sửa hồ sơ thông thường. Quy trình xử lý học viên từ học trước/tiền thạc sĩ sang chương trình chính thức cần chốt riêng, không mặc định cấp lại mã hoặc đổi loại tự động.

## 4. Thời điểm cấp mã và bảo toàn lịch sử

Đối với hồ sơ bình thường, người dùng đã xác định chỉ cấp mã học viên sau khi xét tuyển xong và xác nhận trúng tuyển. Đề xuất tách thao tác xác nhận trúng tuyển khỏi thao tác chốt danh sách cấp mã: chờ xác nhận nhập học và phân lớp hành chính nếu mẫu chứa thành phần lớp, sau đó admin xem trước và cấp mã cho những hồ sơ đủ điều kiện. Điều kiện cấp mã cho hồ sơ học trước/tiền thạc sĩ cần xác định theo quy trình riêng của từng loại, không tự coi các hồ sơ này đã trúng tuyển chương trình chính thức.

- Tách số báo danh/mã tiếp nhận khỏi mã học viên chính thức. Trong giai đoạn chuyển tiếp, giữ mã hiện có và đánh dấu trạng thái `legacy`, `provisional` hoặc `official` theo kết quả đối soát; không suy đoán chỉ từ tiền tố `HV`.
- Hồ sơ mới chưa đủ dữ liệu vẫn có mã tiếp nhận theo cơ chế tương thích hiện tại. Không tự lấy năm hiện tại, lớp học lại hoặc đợt xét tuyển bất kỳ để lấp phần thiếu của mã chính thức.
- Đề xuất cấp theo thứ tự tên khi chốt danh sách; học viên xét bổ sung sau khi đã cấp nhận số tiếp theo của đúng loại hồ sơ. Mã đã cấp giữ nguyên, danh sách/bảng điểm có STT riêng theo A–Z. Không cam kết thứ tự mã luôn trùng thứ tự tên khi tiếp nhận bổ sung.
- Nếu quy tắc không chứa thành phần lớp, có thể cấu hình cấp sớm sau khi đã đủ các thành phần bắt buộc.
- Chuyển lớp, chuyển chuyên ngành, bảo lưu, nhập học lại hoặc thay quy tắc đều giữ mã chính thức đã cấp. Ngoại lệ đổi mã là thao tác riêng cần quyền đổi mã, bắt buộc lý do và xem trước ảnh hưởng.
- Mã cũ luôn được giữ chỗ; rà lại liên kết tài khoản, tra cứu, bảng điểm, file nhập/xuất và báo cáo để xác định phần nào dùng ID, phần nào đang phụ thuộc chuỗi mã trước khi cho phép đổi mã.

## 5. Giao diện dự kiến

1. **Danh mục chuyên ngành:** trường viết tắt mã học viên và cảnh báo trùng.
2. **Hệ thống → Quy tắc mã học viên:** phạm vi áp dụng, loại hồ sơ và chữ cái cấu hình cho từng loại đặc biệt, bộ ghép mã, số bắt đầu, phạm vi bộ đếm, xử lý vượt dải và ngày hiệu lực. Hiển thị bộ đếm riêng cho từng loại.
3. **Xem trước:** chọn loại hồ sơ/chuyên ngành/năm/đợt/lớp, nhập phần thủ công; hiển thị tách từng thành phần và 5 mã dự kiến theo đúng loại. Xem trước không tiêu thụ số hoặc giữ chỗ mã.
4. **Danh sách lớp/học viên:** chọn một hoặc nhiều hồ sơ → xem trước → cấp mã. Hiển thị hồ sơ thiếu dữ liệu, đã có mã và mã nhập tay bị trùng.
5. **Thứ tự cấp theo lô:** chọn theo danh sách đã sắp xếp, họ tên hoặc mã tiếp nhận; có khóa phụ ổn định bằng ID và hiển thị thứ tự trước khi cấp.
6. **Hồ sơ chi tiết:** mã chính thức, mã tiếp nhận, nguồn cấp, quy tắc/phiên bản, ngày cấp, người cấp và lịch sử đổi mã.

Kết quả xem trước là dự kiến. Lúc xác nhận, backend kiểm tra lại phiên bản quy tắc, dữ liệu lớp và bộ đếm. Nếu đã thay đổi, trả thông báo để tải lại bản xem trước, không âm thầm cấp một dải khác với bản admin đang duyệt.

## 6. Thiết kế triển khai

- Thêm trường viết tắt chuyên ngành; danh mục loại hồ sơ với chữ cái cấu hình và liên kết loại trên hồ sơ; bảng quy tắc và phiên bản; bảng bộ đếm theo phạm vi có ID loại hồ sơ; bảng lịch sử cấp/đổi mã gắn hồ sơ, người thực hiện, lý do và khóa chống gửi lặp. Snapshot lúc cấp bao gồm loại, chữ cái và giá trị bộ đếm thực tế.
- Giữ `learner_code_reservations` và unique constraint làm lớp bảo vệ cuối cùng. Thiết kế migration mới, không sửa migration 081 đã chạy.
- Tạo dịch vụ cấp mã dùng chung cho tạo đơn, cấp theo lô và import; không có nhánh import tự ghép mã riêng.
- Với mỗi lần cấp: khóa bộ đếm trong transaction, kiểm tra dữ liệu đầu vào, dựng mã, giữ chỗ, cập nhật hồ sơ và ghi lịch sử. Xử lý cả trường hợp hai giao dịch cùng khởi tạo một bộ đếm mới.
- Cấp theo lô mặc định toàn bộ thành công hoặc rollback toàn bộ; khóa bộ đếm theo thứ tự cố định để giảm deadlock. Giới hạn kích thước lô và hiển thị lỗi theo từng hồ sơ khi xem trước.
- Khóa chống gửi lặp phải trả lại kết quả đã cấp, tránh tiêu thụ thêm số khi người dùng bấm hai lần hoặc client retry.
- Trigger hiện tại chỉ tiếp tục cấp mã tiếp nhận tương thích cho hồ sơ chưa có mã; mã chính thức do dịch vụ gửi rõ ràng và trigger kiểm tra giữ chỗ. Xác định thứ tự ghi mã tiếp nhận, mã chính thức và trạng thái trong cùng transaction.
- Chặn cấp/đổi mã chính thức qua API sửa hồ sơ thông thường; kiểm tra quyền hành động và phạm vi tại backend cho từng đường ghi, kể cả import. Dùng cơ chế quyền hiện hữu của dự án, không chỉ ẩn nút giao diện. Quyền sửa hồ sơ hoặc quản lý danh mục chung không thay thế các quyền mã học viên.
- Rà soát trigger, quyền database và tác vụ seed để không có hai cơ chế đồng thời tự cấp mã chính thức. Ghi snapshot thành phần để giải thích mã sau khi danh mục thay đổi.

### 6.1. Phân quyền cấu hình, phân loại và cấp mã

Đây là thiết kế quyền cho tính năng sắp triển khai, chưa phải các quyền đã có trong mã nguồn hoặc đã được gán vào database. Tích hợp với cơ chế [hồ sơ làm việc và cây phân quyền](../working-profiles-permission-tree.md) hiện có; không tạo hệ thống phân quyền song song.

#### Ma trận hành động đề xuất

| Hành động | Quyền nghiệp vụ dự kiến | Điều kiện và giới hạn |
| --- | --- | --- |
| Xem mã hiện tại, loại hồ sơ trên danh sách/chi tiết/bảng điểm | Giữ quyền đọc hồ sơ/báo cáo hiện có | Trong phạm vi dữ liệu và trang được phép; không bắt buộc quyền cấu hình chỉ để đọc mã |
| Xem cấu hình loại hồ sơ, chữ cái, viết tắt, quy tắc và bộ đếm | `learnercode.config.view` | Cần quyền xem trang cấu hình; dữ liệu cá nhân không được trả kèm |
| Tạo/sửa/ngừng dùng loại hồ sơ; sửa chữ cái, viết tắt dùng cấp mã; lưu/kích hoạt/ngừng quy tắc | `learnercode.config.manage` | Cần `learnercode.config.view`; cấu hình dùng chung toàn viện chỉ cho hồ sơ có phạm vi sửa toàn viện, không ở chế độ Chỉ xem; không tự cấp hay đổi mã |
| Gán/đổi loại hồ sơ trước khi cấp mã chính thức | `learnercode.type.assign` | Cần quyền xem và sửa hồ sơ hiện hữu, quyền trang tương ứng và phạm vi sửa hồ sơ đó; không được đổi chữ cấu hình của cả loại |
| Xem trước mã cho hồ sơ hoặc lô hồ sơ | `learnercode.preview` | Cần quyền xem hồ sơ/trang tương ứng; chỉ xem hồ sơ thuộc phạm vi đọc, không tiêu thụ số, không giữ chỗ; không tự cấp quyền đọc cấu hình toàn viện |
| Cấp mã mới, cấp bổ sung hoặc cấp theo lô | `learnercode.issue` | Cần `learnercode.preview`, quyền xem hồ sơ/trang và phạm vi sửa từng hồ sơ; đủ điều kiện xét tuyển/nhập học/phân lớp theo loại; không bao gồm quyền đổi mã đã cấp |
| Đổi mã chính thức đã cấp, kể cả nhập mã thay thế thủ công | `learnercode.reissue` | Cần quyền xem trước, quyền xem hồ sơ/trang, phạm vi sửa; bắt buộc lý do, xem trước ảnh hưởng, giữ chỗ mã cũ và ghi lịch sử; không dùng để đặt lùi bộ đếm |
| Đổi loại hồ sơ sau khi đã có mã chính thức | `learnercode.type.change` | Cần quyền xem hồ sơ/trang và phạm vi sửa; bắt buộc lý do, lưu loại trước/sau. Nếu nghiệp vụ cần cấp mã mới thì đồng thời cần `learnercode.reissue` và xem trước; không tự động cấp lại mã |
| Nhảy bộ đếm đã dùng tới số lớn hơn | `learnercode.counter.advance` | Cần `learnercode.config.view`, quyền trang và phạm vi sửa toàn viện; lý do bắt buộc; không bao giờ đặt lùi hoặc tái dùng mã đã giữ chỗ. Quyền sửa cấu hình thông thường không thay thế quyền này |
| Xem lịch sử cấp/đổi mã, đổi loại của một hồ sơ | `learnercode.history.view` | Đồng thời có quyền xem chính hồ sơ đó; lọc theo phạm vi đọc, không trả dữ liệu hồ sơ ngoài phạm vi |

Các quyền nghiệp vụ trên độc lập: cấu hình không bao hàm cấp mã; cấp mới không bao hàm đổi mã; phân loại không bao hàm sửa chữ cái hay quy tắc. Quyền quản lý vai trò/tài khoản tiếp tục dùng cơ chế hiện có, không gộp vào nhóm mã học viên.

#### Cây phân quyền và cấp quyền mặc định

- Thêm trang dự kiến **Hệ thống → Quy tắc mã học viên**, có quyền Xem và các hành động Ghi riêng: cấu hình, nhảy bộ đếm. Các tên/mã trang phải được khai báo trong cơ chế `routeViewCode`/`routeActionCode` hiện có khi triển khai.
- Trên các trang tiếp nhận hồ sơ, hồ sơ trúng tuyển, phân lớp và chi tiết hồ sơ có thao tác mã, bổ sung các hành động tương ứng: gán loại, xem trước, cấp mã, đổi mã, đổi loại sau cấp và xem lịch sử. Chỉ khai báo ở trang thực sự hỗ trợ hành động; bật quyền ở một trang không tự bật ở mọi trang khác.
- Khai báo đầy đủ quyền module cha, quyền đọc phụ thuộc và mapping API–trang cho từng hành động; API ghi không có mapping phải bị từ chối. Không dùng một quyền Ghi tổng để gom tất cả hành động nhạy cảm.
- Mặc định đề xuất gán quyền mới đầy đủ cho hồ sơ quản trị hợp lệ theo quy trình migration/seed hiện có. Các vai trò khác không được tự nhận quyền mới chỉ vì đang có `admission.manage`, `masters.manage`, `catalog.manage` hoặc `role.manage`. Việc gán mới phải được ghi nhận rõ trong migration và kiểm thử.
- Khi cần ủy quyền, có thể chỉ cấp xem trước/cấp mã cho chuyên viên trong phạm vi phụ trách, còn cấu hình, đổi mã và nhảy bộ đếm giữ ở quản trị. Đây là phương án phân công đề xuất, không phải thay đổi vai trò đã được người dùng xác nhận.

#### Kiểm tra backend và phạm vi dữ liệu

- Chỉ dùng quyền của hồ sơ làm việc đang chọn; không cộng quyền từ hồ sơ khác, không dùng trường `staff.role` hoặc tên vai trò hiển thị để bỏ qua kiểm tra. Thiếu hồ sơ hợp lệ thì từ chối.
- Áp dụng `PermissionsGuard`, điều kiện quyền trang và phạm vi RLS hiện có cho từng API. Chế độ Chỉ xem chặn mọi thao tác ghi kể cả cấp mã, phân loại, đổi loại và chỉnh bộ đếm; xem trước vẫn là thao tác đọc nếu đủ quyền đọc.
- Cấp/đổi mã yêu cầu quyền ghi mã riêng và phạm vi sửa bản ghi, không bắt buộc cấp thêm toàn bộ quyền sửa hồ sơ thông thường. Riêng thao tác gán loại qua API sửa hồ sơ hiện hữu phải có đồng thời quyền sửa hồ sơ và quyền gán loại.
- Lô chứa bất kỳ hồ sơ nào ngoài phạm vi đọc/sửa hoặc thiếu quyền thì từ chối toàn bộ; không cấp một phần và không tăng bộ đếm. Thông báo không tiết lộ tên/mã của hồ sơ người dùng không được xem.
- Xem trước kiểm tra quyền hiện tại; lúc xác nhận cấp phải kiểm tra lại quyền, phạm vi, trạng thái loại và phiên bản quy tắc trong transaction trước khi giữ chỗ mã. Preview hoặc khóa chống gửi lặp không được dùng để vượt quyền sau khi quyền bị thu hồi.
- Dùng chung các kiểm tra cho API cấp đơn, cấp lô, nhập Excel và các tác vụ gọi dịch vụ nghiệp vụ. API sửa hồ sơ/import không được lách quyền bằng cách gửi trực tiếp `code`, trạng thái `official`, loại sau cấp hoặc giá trị bộ đếm.
- Nếu thiếu điều kiện đọc, không trả toàn bộ số đếm/khóa phạm vi toàn viện qua preview. Xem trước dựa trên hồ sơ chỉ trả quy tắc/thành phần tối thiểu cần giải thích mã cho phạm vi được phép.
- Đổi chữ cái, viết tắt hoặc phiên bản quy tắc không được ngầm nhảy/reset bộ đếm. Sửa loại sau cấp không được ngầm đổi mã, kể cả người gọi có quyền sửa hồ sơ thông thường.

#### Nhật ký và kiểm chứng

- Ghi người thực hiện, ID hồ sơ làm việc, hành động, phạm vi/loại hồ sơ, mã cũ/mới, phiên bản quy tắc, lý do, ID lô và khóa chống gửi lặp. Thay đổi cấu hình, chữ cái, loại và bộ đếm lưu giá trị trước/sau.
- Nhật ký nghiệp vụ và cập nhật mã/cấu hình phải commit trong cùng transaction; ghi nhật ký lỗi thì rollback. Quyền xem lịch sử của một hồ sơ không thay thế `audit.view` để đọc nhật ký toàn hệ thống; nhật ký toàn hệ thống vẫn giữ giới hạn hiện có.
- Kiểm thử từng quyền độc lập, thiếu quyền module/trang, thiếu hồ sơ làm việc, hồ sơ Chỉ xem, đổi hồ sơ giữa preview và xác nhận, thu hồi quyền sau preview và retry sau thu hồi quyền.
- Kiểm thử chuyên viên không cấp/đổi mã ngoài lớp phụ trách; cấu hình toàn viện bị chặn khi chỉ có phạm vi sửa theo lớp; lô trộn hồ sơ được phép/không được phép rollback toàn bộ; mã và các bộ đếm thường/đặc biệt không bị thay đổi khi bị từ chối.
- Kiểm thử API trực tiếp, đường dẫn khác hoa/thường hoặc có dấu `/` cuối, sửa hồ sơ/import gửi kèm trường mã trái phép và truy cập lịch sử hồ sơ khác. Giao diện ẩn/vô hiệu hóa nút đúng quyền nhưng backend luôn tự kiểm tra.

## 7. Trình tự thực hiện và đầu ra

| Giai đoạn | Công việc và đầu ra |
| --- | --- |
| 1. Chốt nghiệp vụ | Chốt ý nghĩa phần ghi đỏ, nguồn năm/đợt, thời điểm cấp; lập ví dụ cho Thạc sĩ/Tiến sĩ và hồ sơ cũ |
| 2. Dữ liệu và migration | Bổ sung viết tắt, quy tắc, bộ đếm, lịch sử và trạng thái; báo cáo đối soát mã cũ; giữ nguyên mã đang có |
| 3. Backend | Bộ dựng mã, chọn quy tắc, xem trước, cấp/đổi mã, cấp theo lô, chống gửi lặp; phối hợp với trigger hiện có; migration quyền, điều kiện phụ thuộc, mapping API–trang và RLS theo mục 6.1 |
| 4. Giao diện | Danh mục viết tắt, cấu hình trực quan, xem trước, cấp mã trong lớp/hồ sơ và lịch sử; bổ sung hành động vào cây phân quyền và hiển thị theo hồ sơ đang chọn |
| 5. Tích hợp | Tạo hồ sơ, phân lớp, import Excel, chuyển ngành/lớp, tài khoản, tìm kiếm, bảng điểm và xuất tài liệu |
| 6. Kiểm chứng và đưa vào dùng | Kiểm thử PostgreSQL cô lập; thử dữ liệu đại diện trên môi trường kiểm thử; cập nhật README và hướng dẫn vận hành |

Trước khi chạy migration môi trường thật cần sao lưu và kiểm chứng phương án khôi phục. Bật tính năng theo giai đoạn: nhập viết tắt → tạo quy tắc nháp → xem trước một lớp → kích hoạt cho mã mới. Không tự chuyển toàn bộ mã cũ sang công thức mới.

## 8. Tiêu chí nghiệm thu

- Định nghĩa được viết tắt 2 ký tự hoặc dài hơn; mẫu chuẩn tạo đúng `CN2611001` với dữ liệu minh họa.
- Chọn bắt đầu tại `037` thì mã đầu kết thúc bằng `037`; bộ đếm lớp khác hoạt động theo phạm vi đã chọn.
- Cấp xen kẽ đúng chuỗi `CN2612001`, `CN2612002`, `CN261201B`, `CN2612003`, `CN261202B`; không tăng bộ đếm thường khi cấp mã đặc biệt và ngược lại.
- Cấu hình chữ khác `B` cho loại đặc biệt thì mã mới dùng đúng chữ đã cấu hình; loại học trước và tiền thạc sĩ có bộ đếm độc lập. Chặn thiếu chữ và trùng chữ trong phạm vi có cùng tiền tố.
- Đổi chữ cấu hình không làm đổi mã cũ hoặc đưa bộ đếm về đầu; chặn vượt `99B` khi đuôi cố định 3 ký tự. Lô có nhiều loại, cấp đồng thời, retry và rollback vẫn bảo toàn từng bộ đếm.
- Ghép được hằng số 1 chữ số và phần nhập tay 3 chữ số ở vị trí lựa chọn; phần nhập tay giữ được số 0 đầu.
- Hai admin cấp cùng lúc không nhận cùng mã hoặc cùng số trong một bộ đếm; retry không cấp lại lần hai.
- Preview không tăng bộ đếm; preview cũ được phát hiện khi xác nhận; lỗi giữa lô không để lại hồ sơ cấp dở.
- Chặn trùng không phân biệt hoa thường/khoảng trắng đầu cuối, kể cả mã lịch sử hoặc của hồ sơ đã xóa.
- Chặn thiếu chuyên ngành/năm/đợt/lớp mà quy tắc yêu cầu; xử lý đúng hồ sơ chưa phân lớp, nhiều lớp và lớp học lại.
- Xử lý rõ `999` → số tiếp theo, viết tắt trùng, năm có hai số cuối giống nhau và quy tắc có phạm vi bộ đếm khác với tiền tố hiển thị.
- Đổi quy tắc hoặc chuyển lớp/ngành không đổi mã đã cấp; tài khoản, bảng điểm, nhập/xuất và tra cứu vẫn hoạt động.
- Người không có đủ quyền hành động, quyền module/trang và phạm vi sửa không cấp/đổi được mã qua bất kỳ API ghi nào. Mặc định quyền ghi mới chỉ gán cho quản trị; vai trò khác chỉ thao tác khi được ủy quyền tường minh và vẫn chịu giới hạn hồ sơ làm việc/RLS theo mục 6.1.
- Tách biệt quyền cấu hình chữ cái/quy tắc, gán loại, xem trước, cấp mới, đổi mã, đổi loại sau cấp, nhảy bộ đếm và xem lịch sử. Chế độ Chỉ xem, thu hồi quyền sau preview, retry, lô ngoài phạm vi và import trái phép đều bị kiểm tra ở backend, không làm thay đổi mã/bộ đếm khi bị từ chối.
- Migration không thay mã hiện hữu; toàn bộ kiểm thử giữ mã vĩnh viễn hiện có vẫn được bảo toàn hoặc được chuyển sang kiểm thử tương đương cho cơ chế mới.

## 9. Những điểm cần xác nhận trước khi lập trình

1. Phần đỏ là thêm một chữ số cố định và ba số nhập tay, hay là thay đoạn tự tăng bằng đoạn nhập tay trong một trường hợp đặc biệt? Ba số này có ý nghĩa nghiệp vụ gì?
2. “Năm” lấy từ năm tuyển sinh hay năm đào tạo; “đợt” lấy từ đợt tuyển sinh hay `intakeRound` của lớp? Đề xuất dùng năm và đợt của lớp hành chính khi cấp chính thức, báo lệch với hồ sơ thay vì tự chọn.
3. Có bắt buộc đúng 9 ký tự cho mọi chuyên ngành không? Đề xuất mẫu chuẩn 9 ký tự và chế độ linh hoạt có cảnh báo độ dài.
4. Có yêu cầu cấp mã chính thức trước khi phân lớp không? Đề xuất cấp khi đủ dữ liệu và giữ mã tiếp nhận riêng trước thời điểm đó.
5. Điều kiện/thời điểm cấp mã cho hồ sơ tiền thạc sĩ và học trước là gì? Khi chuyển sang chương trình chính thức, giữ loại/mã cũ hay có thao tác chuyển đổi được phê duyệt? Yêu cầu chữ cái cấu hình và bộ đếm độc lập đã được xác nhận, không cần hỏi lại.

Các lựa chọn mặc định ở trên là đề xuất để lập kế hoạch, chưa phải xác nhận nghiệp vụ của người dùng.
