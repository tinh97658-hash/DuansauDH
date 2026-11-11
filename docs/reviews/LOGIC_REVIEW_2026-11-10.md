# Rà soát logic xét tuyển, phân lớp và mã học viên

Ngày: 10/11/2026. Phạm vi: luồng xét tuyển → phân lớp → cấp mã; bảo lưu đến hạn; thay đổi bộ đếm và làm mới giao diện phân loại. Đây là rà soát có trọng tâm, không phải kết luận đã kiểm chứng mọi nghiệp vụ của hệ thống.

Đã tái hiện và sửa cả 4 vấn đề bên dưới. Các mô tả lỗi và kiểm chứng ban đầu được giữ để đối chiếu; phần xử lý ghi nhận hành vi sau sửa. Không thay đổi database nghiệp vụ.

## 1. P1 — Mở lại xét tuyển bỏ qua trạng thái đã phân lớp/cấp mã

**Đã sửa:** Chặn mở lại nếu đã có mã chính thức hoặc thành viên lớp, kể cả liên kết qua `student_id`. Kiểm tra trong giao dịch, dùng cùng khóa điều phối với phân lớp/cấp mã để tránh chạy đồng thời làm sai trạng thái. Giữ nguyên mã, thành viên lớp và quyết định khi bị từ chối. Luồng chuyển ngành riêng vẫn lưu trữ đánh giá theo bằng chứng cũ, không cần mở lại hồ sơ đã phân lớp.

Vị trí: `backend/src/plan/admission-evaluation.service.ts`, phương thức `decide`.

Điều kiện: học viên đã trúng tuyển (`approved`), chưa nộp học phí nên trạng thái là `Đã trúng tuyển`, đã có thành viên lớp, có thể đã nhận mã chính thức. Hệ thống cho phân lớp và cấp mã trước khi đóng học phí, nên tổ hợp này có thể phát sinh qua luồng bình thường.

`decide(..., decision='reopen')` chỉ chặn học viên `Đang học` hoặc bảo lưu/thôi học. Không kiểm tra việc đã cấp mã hay thành viên lớp; sau đó đổi hồ sơ về `pending`/`Nộp hồ sơ đầu vào`. Không tháo thành viên lớp hoặc xử lý các quan hệ đào tạo đã tạo. Nếu tiếp tục duyệt không trúng tuyển, các quan hệ này vẫn không được xử lý tại phương thức đó.

Tác động: kết quả xét tuyển và dữ liệu đào tạo có thể mâu thuẫn. Đã có luồng `returnUnpaidToApplication` xử lý rút hồ sơ, kiểm tra danh sách thi và lưu lịch sử, nhưng mở lại xét tuyển không đi qua luồng đó.

Kiểm chứng: test bổ sung dựng hồ sơ đã cấp mã, đã phân lớp và chưa nộp học phí; kỳ vọng chặn mở lại nhưng lời gọi thành công, quyết định chuyển về `pending`.

Đề xuất: chặn mở lại trực tiếp khi đã có liên kết đào tạo/mã chính thức và yêu cầu quy trình xử lý học viên/rút hồ sơ. Nếu nghiệp vụ cho phép mở lại, phải thiết kế một giao dịch xử lý rõ các liên kết và lịch sử liên quan; không chỉ đổi cờ trạng thái. Giữ chỗ mã cũ trong mọi trường hợp.

## 2. P2 — API mã học viên không đồng bộ bảo lưu đến hạn

**Đã sửa:** Đồng bộ trước xem trước/cấp mã với đường dẫn đã chuẩn hóa. Đồng thời truy vấn bảo lưu đã duyệt có ngày bắt đầu đến hạn ngay trong giao dịch mã học viên, theo ngày Việt Nam. Kiểm tra này áp dụng cả hồ sơ làm việc Chỉ xem, không cần ghi trạng thái để bảo đảm tính đúng đắn; bảo lưu bắt đầu trong tương lai không bị chặn sớm.

Vị trí: `backend/src/plan/study-leave.interceptor.ts`, kết hợp `LearnerCodeService.build` trong `backend/src/learner-codes/code.service.ts`.

Đồng bộ bảo lưu tự động hiện chỉ chạy trước các đường dẫn `/plan`, `/masters`, `/scheduling`, `/reports`. Các đường dẫn `/learner-codes` mới không thuộc danh sách này. Trong khi đó, phần cấp mã kiểm tra `admission_records.study_status`, không tự kiểm tra khoảng bảo lưu đã duyệt trong bảng `study_leaves`.

Điều kiện: bảo lưu đã được duyệt với ngày bắt đầu trong tương lai; sau khi qua ngày bắt đầu, người dùng gọi trực tiếp API cấp mã trước khi có request thuộc nhóm đường dẫn được đồng bộ. Trạng thái lưu trên hồ sơ có thể còn giá trị trước bảo lưu.

Tác động: quy tắc chặn cấp mã cho người đang bảo lưu không được bảo đảm ở thời điểm chuyển ngày. Không khẳng định mọi trường hợp bảo lưu đều gặp lỗi; vấn đề phụ thuộc thời điểm đồng bộ.

Kiểm chứng: test interceptor với URL `/learner-codes/issue` xác nhận `synchronize()` không được gọi, trong khi kiểm thử yêu cầu gọi một lần.

Đề xuất: đưa các API mã học viên vào phạm vi đồng bộ phù hợp và/hoặc kiểm tra trạng thái bảo lưu hiệu lực ngay trong giao dịch cấp mã. Kiểm tra cả chế độ Chỉ xem, vì không nên dựa vào một thao tác đọc có quyền ghi để cập nhật trạng thái phục vụ tính đúng đắn.

## 3. P2 — Có thể tăng bộ đếm vượt dải rồi không cấp mã tiếp được

**Đã sửa:** Đối chiếu loại hồ sơ, quy tắc đang hiệu lực, phạm vi bộ đếm và số ký tự dành cho phần số trước khi tăng. Bộ đếm dùng chung nhiều mẫu lấy giới hạn nhỏ nhất của các mẫu phù hợp để tránh làm hỏng một dãy dùng chung. Giao diện hiển thị giới hạn; backend từ chối vượt dải và giữ nguyên bộ đếm/nhật ký. Đã kiểm tra cả giá trị vượt dải và cấp mã tại giá trị cuối hợp lệ.

Vị trí: `backend/src/learner-codes/code.service.ts`, phương thức `advance`; `CodeAdvanceDto` và `formatLearnerCode`.

`advance` chỉ kiểm tra số mới lớn hơn số hiện tại. DTO cho phép tới `999999999`, nhưng không đối chiếu độ rộng của phần số theo quy tắc và loại hồ sơ. Ví dụ mẫu thường có 3 số chỉ chứa `001–999`; mẫu đặc biệt với đuôi 3 ký tự chỉ chứa `01B–99B`.

Tác động: nhập `1000` cho dãy thường 3 số vẫn nhận thông báo thành công; lần cấp sau bị lỗi vượt độ dài. Không thể khôi phục bằng cách đặt lại bộ đếm về số thấp hơn qua giao diện, vì thao tác đó bị cấm. Muốn tiếp tục phải thay quy tắc/độ dài hoặc có quy trình khắc phục riêng.

Kiểm chứng: test phương thức `advance` với bộ đếm hiện tại 3, quy tắc 3 số và giá trị yêu cầu 1000; kỳ vọng từ chối nhưng lời gọi thành công.

Đề xuất: kiểm tra dải theo quy tắc/loại đang áp dụng, hoặc có quy trình riêng kèm cảnh báo rõ khi chủ động chuyển bộ đếm sang trạng thái hết dải. Không âm thầm chấp nhận như một bước tăng bình thường.

## 4. P3 — Đổi loại hồ sơ chưa phân lớp xong nhưng giao diện vẫn hiển thị loại cũ

**Đã sửa:** Sau khi lưu, nạp hồ sơ theo ID và cập nhật cả dòng hiển thị lẫn `requestedRecord`. Chuyển sang lớp khác rồi quay về hồ sơ chưa phân lớp vẫn giữ loại mới. Nếu tải lại thất bại, xóa dữ liệu cũ và hiển thị lỗi để người dùng tải lại.

Vị trí: `frontend/src/features/learnerCodes/LearnerCodeIssue.jsx`, `load` và `saveAction`.

Hồ sơ chưa phân lớp được nạp từ `options.requestedRecord`. Sau khi gán loại thành công, `saveAction` gọi `load()`, nhưng hàm này trả về ngay nếu chưa có `group`. Dữ liệu trong bảng và `options.requestedRecord` không được cập nhật.

Tác động: người dùng nhận thông báo thành công nhưng bảng vẫn hiển thị loại cũ; thao tác chuyển lớp rồi quay về cũng có thể lấy lại bản `requestedRecord` cũ. Đây là lỗi đồng bộ giao diện; kiểm thử không cho thấy API đã lưu sai loại.

Kiểm chứng: test React mở hồ sơ chưa phân lớp, đổi Bình thường sang Tiền thạc sĩ và xác nhận API thành công. Bảng vẫn chứa Bình thường, không có Tiền thạc sĩ.

Đề xuất: nạp lại bản ghi theo ID sau khi lưu và cập nhật cả bảng lẫn `requestedRecord`; không dùng riêng hàm tải danh sách lớp cho hồ sơ chưa phân lớp.

## Bằng chứng kiểm thử và giới hạn

- Các test thăm dò ban đầu tái hiện đủ bốn lỗi; bản sửa đã thêm kiểm thử hồi quy vào bộ test chính thức.
- Backend: 94 suite đạt, 1.439 test đạt; 29 suite/382 test được bỏ qua theo cấu hình hoặc yêu cầu môi trường riêng. Không còn test thất bại trong lượt chạy toàn bộ backend.
- PostgreSQL: 28/28 test đạt trên database tạm, gồm migration, RLS, mã học viên, dashboard và lưu trữ upload. Các trường hợp mới kiểm tra từ chối mở lại mà không đổi quyết định/mã/thành viên lớp; bảo lưu đã hiệu lực với trạng thái chưa đồng bộ và hồ sơ Chỉ xem; bảo lưu tương lai; tăng vượt dải; cấp tại số cuối hợp lệ.
- Frontend: 6/6 test giao diện mã học viên đạt, gồm lưu loại hồ sơ chưa phân lớp và chuyển lớp rồi quay lại vẫn thấy loại mới.
- Build backend, frontend và typecheck backend đạt. Frontend còn cảnh báo dung lượng một số chunk lớn.
- Log xác nhận: `.local/logic-fixes-backend-full.log`, `.local/logic-fixes-postgres.log`, `.local/logic-fixes-frontend-tests.log`, `.local/logic-fixes-frontend-build.log`.
- Không cần migration mới cho bốn bản sửa này. Tính năng mã học viên vẫn cần migration 102 theo hướng dẫn triển khai; không chạy migration vào database nghiệp vụ trong lượt sửa này.
