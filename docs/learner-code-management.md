# Cấu hình và cấp mã học viên

Mở **Đào tạo thạc sĩ → Thủ tục đầu vào → Hồ sơ trúng tuyển → Cấp mã học viên**. Trang này gồm hai thẻ Danh sách hồ sơ và Cấp mã học viên; menu không có mục cấp mã riêng. Hồ sơ thường phải được xác nhận trúng tuyển trước khi cấp mã chính thức; mã được tạo lúc tiếp nhận hồ sơ chỉ là mã tiếp nhận. Chức năng cấp mã theo lô hiện yêu cầu hồ sơ thuộc lớp hành chính. Đường dẫn cũ `/plan/learner-codes` chuyển sang thẻ cấp mã và giữ lựa chọn hồ sơ/lớp. Các quyền cấp mã hiện có được giữ riêng cho thẻ này.

## Chuẩn bị

Chạy migration `102-learner-code-management` trước khi khởi động backend mới. Migration giữ nguyên mã của mọi hồ sơ hiện hữu và đánh dấu `legacy` (chưa đối soát). Không tự suy đoán mã cũ là mã chính thức từ tiền tố. Hồ sơ tạo mới có mã tiếp nhận, chưa phải mã chính thức.

Migration thêm quyền cho hồ sơ có mã `admin`. Vai trò khác không tự nhận quyền cấp/đổi mã từ quyền sửa hồ sơ hay quản lý danh mục. Quản trị có thể cấp quyền riêng tại **Vai trò & phân quyền**. Không cần chạy lại seed để khôi phục toàn bộ quyền của các vai trò đang dùng.

Phân loại hồ sơ cũ dạng chữ được giữ lại để đối chiếu. Nếu chưa gán loại cấp mã và chưa có mã chính thức, hồ sơ có phân loại `Bình thường` hoặc để trống được nhận diện là loại thường, thống nhất với mặc định lúc tiếp nhận. Loại này được lưu khi cấp mã chính thức; xem trước không sửa hồ sơ. Loại đã gán luôn được ưu tiên. Các phân loại đặc biệt (Sinh viên, Cựu SV học trước, Cựu SV Tiền thạc sỹ...) không được tự gán vào dãy thường; cần người có quyền chọn loại cấp mã.

## Cấu hình lần đầu

1. Mở **Hệ thống → Quy tắc mã học viên** với hồ sơ có quyền cấu hình và phạm vi sửa toàn viện.
2. Khai báo viết tắt chuyên ngành, ví dụ `CN`. Viết tắt mã học viên được lưu riêng với mã danh mục chuyên ngành.
3. Hồ sơ bình thường dùng số thuần. Hai loại tiền thạc sĩ và học trước được tạo sẵn nhưng chưa kích hoạt. Cấu hình một chữ cái riêng cho từng loại đặc biệt rồi kích hoạt, ví dụ tiền thạc sĩ dùng `B`; không có chữ cái mặc định cho học trước.
4. Hồ sơ thường bắt buộc đã trúng tuyển. Với loại đặc biệt, quản trị chọn rõ có yêu cầu trúng tuyển hay tiếp nhận qua lớp theo quy trình riêng. Tắt yêu cầu trúng tuyển không thay đổi kết quả xét tuyển của hồ sơ.
5. Kiểm tra mẫu chuẩn: viết tắt + năm 2 số + đợt + thứ tự lớp + đoạn đuôi 3 ký tự. Hồ sơ thường có đuôi `001–999`; loại có chữ `B` có đuôi `01B–99B`. Quá dải thì chặn, không cắt số/quay vòng.

Có thể thêm/đổi thứ tự thành phần, độ dài, năm 4 số, hằng số, dấu phân cách và phần nhập tay. Chọn phạm vi áp dụng theo bậc/chuyên ngành/năm/đợt/lớp/loại; chọn ngày hiệu lực và số bắt đầu. Các bộ đếm luôn tách theo bậc và loại hồ sơ, rồi theo phạm vi đã chọn. Quy tắc giao nhau cùng mức ưu tiên bị chặn.

Số bắt đầu chỉ áp dụng cho bộ đếm chưa có. Sửa mẫu, chữ cái hoặc phiên bản không đặt lại bộ đếm đã dùng. Chuyển phạm vi bộ đếm cần tạo quy tắc mới và ngừng quy tắc cũ phù hợp. Chỉ quyền Tăng số tiếp theo mới được nhảy bộ đếm đã tồn tại về phía trước, kèm lý do. Không được giảm số hay dùng lại mã lịch sử.

Tăng bộ đếm phải nằm trong dải của mẫu đang hiệu lực: đuôi 3 số tối đa 999, đuôi 2 số và một chữ tối đa 99. Giao diện hiển thị giới hạn và backend kiểm tra lại trước khi lưu. Nếu nhiều mẫu dùng chung bộ đếm, giới hạn tăng lấy theo mẫu có dải nhỏ nhất phù hợp; cần thống nhất độ rộng hoặc tách phạm vi nếu muốn dùng dải lớn hơn.

## Cấp mã

Mở **Kế hoạch khóa mới → Cấp mã học viên**, hoặc liên kết tại chi tiết hồ sơ/phân nhóm học viên.

Với hồ sơ chưa phân lớp, liên kết từ chi tiết hồ sơ vẫn cho phép gán loại trong phạm vi được phép; xem trước/cấp mã còn bị khóa cho đến khi có lớp phù hợp. Gán loại không xác nhận trúng tuyển hoặc nhập học thay cho quy trình nghiệp vụ.

1. Chọn lớp hành chính và tối đa 100 hồ sơ.
2. Gán loại cho hồ sơ cũ chưa được phân loại, nếu có quyền gán loại. Gán loại không tự cấp mã.
3. Chọn thứ tự tên A–Z (tên, họ đệm, ID làm khóa phụ) hoặc thứ tự chọn. Nhập phần thủ công nếu mẫu yêu cầu.
4. Bấm **Xem trước** và kiểm tra từng mã/thành phần, rồi **Xác nhận cấp mã**.

Hồ sơ phải thuộc đúng một lớp hành chính phù hợp chuyên ngành/năm/bậc. Hồ sơ thường phải đã trúng tuyển; hồ sơ bảo lưu/thôi học bị chặn. Hồ sơ ở nhiều lớp hành chính phù hợp cần được đối soát trước. Không lấy lớp học phần hoặc lớp học lại để thay thế lớp hành chính.

Bảo lưu đã duyệt bị chặn từ ngày bắt đầu theo ngày Việt Nam, kể cả trạng thái hồ sơ chưa kịp đồng bộ và khi xem trước bằng hồ sơ làm việc Chỉ xem. Bảo lưu bắt đầu trong tương lai không bị chặn trước ngày. Hồ sơ đã phân lớp hoặc có mã chính thức không được mở lại xét tuyển trực tiếp; phải xử lý theo nghiệp vụ học viên/rút hồ sơ phù hợp, giữ nguyên chỗ của mã đã cấp.

Ví dụ với tiền tố `CN2612`, cấp thường hai hồ sơ được `CN2612001`, `CN2612002`; cấp một hồ sơ tiền thạc sĩ được `CN261201B`; cấp tiếp hồ sơ thường được `CN2612003`. Hồ sơ xét bổ sung nhận số tiếp theo của đúng loại, không đổi mã đã phát hành để chèn lại thứ tự A–Z. Danh sách vẫn có thể sắp theo tên bằng STT riêng.

Xem trước không giữ chỗ. Nếu hồ sơ, lớp, quy tắc, loại hoặc bộ đếm thay đổi, phải xem trước lại. Xác nhận kiểm tra lại quyền và phạm vi hiện tại. Cả lô thành công hoặc rollback toàn bộ, gồm mã giữ chỗ, bộ đếm và nhật ký. Gửi lại cùng yêu cầu không cấp lần hai.

## Đổi mã, đổi loại và lịch sử

- Chọn một hồ sơ để xem lịch sử, gán/đổi loại hoặc đổi mã với quyền tương ứng.
- Đổi loại sau khi cấp mã giữ nguyên mã hiện tại, yêu cầu quyền riêng và lý do. Việc chuyển học trước/tiền thạc sĩ sang chương trình chính thức không tự tạo mã mới hoặc thay kết quả xét tuyển.
- Đổi mã chính thức là thao tác ngoại lệ: xem thông tin hiện tại, nhập mã thay thế và lý do, kiểm tra ảnh hưởng tài liệu đã phát hành rồi xác nhận. Mã cũ và mã tiếp nhận gốc được giữ lại; mã cũ không được tái sử dụng, kể cả cho chính hồ sơ đó.
- Trường mã chính thức bị khóa ở biểu mẫu sửa hồ sơ; backend và trigger cũng chặn ghi trực tiếp. Tạo/import hồ sơ theo API hiện có chỉ tạo mã tiếp nhận; cấp mã chính thức dùng chung dịch vụ Cấp mã, không ghép mã bằng Excel hoặc đếm tổng hồ sơ.

## Phân quyền

Các quyền riêng: xem cấu hình, sửa cấu hình, gán loại trước cấp mã, xem trước, cấp mới, đổi mã, đổi loại sau cấp, tăng bộ đếm và xem lịch sử. Quyền đọc mã hiện tại tiếp tục theo quyền đọc hồ sơ/báo cáo.

Quyền chỉ có hiệu lực trên hồ sơ làm việc đang chọn; không cộng quyền các hồ sơ. Cần quyền module, quyền xem trang và hành động tương ứng. Xem trước và lịch sử là thao tác đọc, thể hiện ở cột Xem trong cây quyền; Chỉ xem vẫn chặn mọi thay đổi. Chuyên viên được ủy quyền chỉ cấp mã trong phạm vi sửa lớp/hồ sơ, không sửa cấu hình toàn viện. Xem trước không cấp quyền xem toàn bộ cấu hình, snapshot hoặc bộ đếm ngoài phạm vi.

Nhật ký từng hồ sơ yêu cầu quyền riêng và quyền xem hồ sơ đó. Nhật ký toàn hệ thống vẫn cần `audit.view`. Nhật ký lưu người thực hiện, hồ sơ làm việc, dữ liệu trước/sau và lý do; cấp mã lưu phiên bản/thành phần thực tế để đối soát sau khi cấu hình đổi.

## Kiểm chứng

Chạy `npm --prefix backend test` và `npm --prefix frontend test -- --maxWorkers=2`. Để kiểm tra migration, RLS và giao dịch trên database tạm, build backend rồi chạy `node backend/test/run-dashboard-db.cjs` với kết nối quản trị PostgreSQL kiểm thử. Script tạo database có tên riêng, chạy migration và kiểm thử rồi xóa database đó; không áp dụng migration vào database nghiệp vụ.

Trước triển khai thật, sao lưu database, chạy migration trong quy trình bảo trì, build/phát hành backend và frontend cùng phiên bản. Tính năng chưa tự bật tiền thạc sĩ/học trước hoặc đổi mã hàng loạt cho dữ liệu cũ.
