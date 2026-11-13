# Tài liệu dự án

- [README chính và chạy development](../README.md)
- [Cấu trúc repository, triển khai production và rollback](deployment.md)
- [Phân quyền theo hồ sơ làm việc](working-profiles-permission-tree.md)
- [Nhập điểm từ Excel](gradebook-excel-import.md)
- [Danh sách thi và phân công](exam-arrangements.md)
- [Quyền lịch thi](exam-schedule-permissions.md)
- [Quyền bảng điểm](gradebook-permissions.md)
- [Thanh toán giảng viên](LECTURER-PAYMENTS.md)
- [Chính sách học phí và ghi danh](TUITION-ENROLLMENT-POLICY.md)

Các hướng dẫn nghiệp vụ hiện hành nằm trực tiếp trong `docs/`.

- `imports/`: dữ liệu danh mục phục vụ nhập liệu, cần review trước khi sử dụng.
- [archive/](archive/README.md): tài liệu mẫu website cũ, giữ làm tham khảo.

Backup database, snapshot trước sửa dữ liệu, log và công cụ chẩn đoán local nằm
trong `.local/` ở gốc repository và được Git bỏ qua. Không đưa dữ liệu runtime,
secrets hoặc file người dùng tải lên vào tài liệu công khai.
