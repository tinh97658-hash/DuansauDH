# Rà soát hiệu năng ngày 04/11/2026

Áp dụng Superpowers: `systematic-debugging`, `test-driven-development` và
`verification-before-completion`. Các lỗi dưới đây đã được tái hiện bằng kiểm thử
trước khi sửa. Số lượt đọc được kiểm tra tại ranh giới service/repository;
chưa đo độ trễ trên cơ sở dữ liệu triển khai thực tế.

## Các vấn đề đã sửa

| Luồng | Nguyên nhân | Thay đổi và kết quả |
| --- | --- | --- |
| Dashboard tổng hợp | Teaching, grades và approvals gọi riêng `listCourseOfferings` với cùng năm và hệ đào tạo. Mỗi lần gọi tải lại nhóm, liên kết, lớp và metadata. | Dùng chung promise trong một request: 3 lượt tải danh sách xuống 1. Request mới vẫn đọc dữ liệu mới; không dùng cache toàn cục giữa người dùng. |
| Dashboard tự làm mới | Polling 30 giây, focus và visibility có thể đổi revision khi API chưa trả về, hủy yêu cầu đang chạy rồi gửi lại. | Bỏ qua các sự kiện tự làm mới trong khi đang tải. Đổi bộ lọc và cập nhật nghiệp vụ vẫn có thể thay thế request cũ. |
| Import điểm xét tuyển | Mỗi dòng đọc kết quả hai lần và đọc lại đợt đã được khóa bởi transaction ngoài. | Dùng lại đợt đã khóa và đọc kết quả một lần với khóa UPDATE. Giảm 2 lượt đọc mỗi hồ sơ, tức 4.000 lượt cho 2.000 hồ sơ. |

Import vẫn lưu trong cùng transaction, khóa hồ sơ theo ID, kiểm tra phiên bản,
chặn hồ sơ thuộc đợt khác hoặc đã duyệt, giữ các điểm thành phần và minh chứng,
chấp nhận điểm 0, ghi lịch sử cho từng hồ sơ và không đổi trạng thái nghiệp vụ.

## Kiểm chứng

```powershell
npm --prefix backend run test:unit
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix frontend test -- src/test/integration/OperationalDashboard.test.jsx
npm --prefix frontend test -- src/test/integration/AdmissionEvaluation.test.jsx src/test/integration/BulkAdmissionWorkflow.test.jsx src/test/integration/AdmissionThresholds.test.jsx src/test/integration/AdmissionExcel.test.js src/test/integration/DashboardScheduleLinks.test.jsx
npm --prefix frontend run build
```

Bộ dashboard frontend có 3 lỗi sẵn từ trước khi sửa hiệu năng: hai trường hợp
`shows every scoped teaching warning...` và một trường hợp
`counts a class only once across warning groups...`. Chúng kỳ vọng số lần xuất
hiện nhãn tổng số lớp khác với giao diện hiện tại. Khi sửa CI, đã cập nhật các
kiểm thử này để kiểm tra riêng số lớp và số buổi; cả 32 kiểm thử dashboard đã qua.
Kiểm thử mới cho yêu cầu đang chạy đã thất bại trước sửa và thành công sau sửa.

## Giới hạn và phần cần đo tiếp

- Chưa có số liệu p50/p95 hoặc thử tải trên PostgreSQL thực tế; không suy ra mức
  tăng tốc thời gian phản hồi từ số lượt đọc được loại bỏ.
- Import vẫn ghi từng hồ sơ để giữ kiểm tra và lịch sử. Chưa chuyển sang bulk SQL.
- Theo dõi số truy vấn và thời gian `ExamGradebookService.tracking(..., true)`
  với nhiều lớp hoàn thành: luồng này có thể tải bảng điểm riêng cho từng lớp.
- Production build vẫn cảnh báo chunk lớn của ExcelJS/PDFMake; các thư viện này
  đã được import động. Cần đo lúc xuất báo cáo trước khi thay cách chia bundle.
