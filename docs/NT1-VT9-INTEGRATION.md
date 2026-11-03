# Tích hợp chọn lọc NT1 + VT9

## Phiên bản và phạm vi

- Worktree: `D:\SauDH\DuansauDH-integration-nt1-vt9`.
- Branch local: `integration/nt1-vt9-selective`.
- Nền NT: `2ac7f6c195c551c43117dc4aeffde3b8e9d5507d`.
- Nhận VT: `cdee161204ff85d84e3466deff7915dac910b9fb`.
- Không push, không merge ngược; giữ nguyên ref và working tree của hai phiên bản gốc.

## Quyết định tích hợp

| Phần | Kết quả |
|---|---|
| Xếp lịch | Giữ VT. `SessionEditor.jsx`, `Schedule.jsx`, `workspace.css` giống commit VT; chọn phòng mặc định theo buổi sớm nhất và vẫn cho đổi phòng. |
| Nút xuất | Giữ nền trắng, icon tải xuống, thứ tự Excel/Word/PDF, nhãn và hover VT. |
| Dropdown | Tái sử dụng helper NT; portal có chiều rộng bằng nút, cập nhật vị trí trong lúc mở, giới hạn chiều cao và lật lên khi thiếu chỗ. Nhãn dài xuống dòng. |
| Toolbar bảng điểm | Giữ NT; thêm menu phiếu ký VT vào nhóm thao tác, giữ xuất bảng điểm riêng. |
| Đầu ra | Giữ mẫu, helper, Word/Excel/PDF, phiếu ký, tiến độ và ZIP nhiều lớp của VT. |
| Tổng điểm cả lớp | Giữ Excel VT; menu cá nhân và Excel cả lớp dùng chung component dropdown. |
| Thanh toán giảng viên | Giữ nguyên backend, quyền, migration, route/menu và giao diện NT; kiểm tra Excel với engine VT. |
| Select dùng chung | Giữ `DropdownPopper`, `AppSelect`, theme và CSS NT. Tham số mới của helper có mặc định giữ hành vi select hiện tại. |

Bốn conflict được giải quyết theo từng phần: `DocumentExportMenu.jsx`, `documentExportMenu.css`, `SessionEditor.jsx`, `examLists.jsx`.

Loại bỏ trong nhánh tích hợp các file không còn dependency: `previousRoom.js`, `previousRoom.css` và hai test tương ứng. Bản gốc NT vẫn giữ chúng.

Các file ghép thủ công/chỉnh tương thích chính:

- `frontend/src/components/DocumentExportMenu.jsx`
- `frontend/src/components/documentExportMenu.css`
- `frontend/src/utils/dropdownGeometry.js`
- `frontend/src/pages/masters/examLists.jsx`
- `frontend/src/features/exams/gradebook.css`
- `frontend/src/pages/reports/classScoreSummary.jsx`
- `frontend/src/features/scheduling/SessionEditor.jsx`
- `frontend/src/test/integration/ExamLists.test.jsx`
- `frontend/src/test/integration/DocumentExportAlignment.test.jsx`
- `frontend/src/test/unit/dropdownGeometry.test.js`
- `frontend/src/test/unit/lecturerPaymentExport.test.js`

Danh sách đầy đủ, gồm các file nhận từ VT: [NT1-VT9-CHANGED-FILES.txt](NT1-VT9-CHANGED-FILES.txt). Không sửa backend so với NT. Không thêm package hay thay lockfile.

## Xác minh

| Nhóm | Kết quả |
|---|---|
| Build backend | PASS |
| Build frontend cuối | PASS; còn cảnh báo bundle lớn của ExcelJS/pdfmake |
| Helper và định dạng xuất | PASS, 62 test / 8 file |
| Quyền backend | PASS, 19 test / 2 suite |
| PostgreSQL thanh toán | PASS, 7 test; chạy toàn bộ migration trên DB tạm rồi xóa DB tạm |
| Popup/chọn phòng VT | PASS, 8 test liên quan |
| Giao diện báo cáo/quyền/route/menu | PASS, 116 test / 8 file |
| Geometry và tương thích Excel thanh toán | PASS, 6 test / 3 file |
| Luồng bảng điểm liên quan tích hợp | PASS, 7 test; phiếu ký toàn lớp, Excel danh sách thi, PDF toàn bộ/lọc, khóa xuất, quyền gửi kết quả và trạng thái chưa chọn lớp |
| Edge thực tế | PASS; viewport 1280×800 và 390×700; portal, căn cạnh/rộng bằng nút, lật lên, dịch bố cục, resize, chọn Excel và click outside |
| Kiểm tra bản in bằng Microsoft Office/máy in thật | NOT TESTED |
| Toàn bộ test repository | NOT TESTED |

Các lượt kiểm tra toàn file `ExamLists.test.jsx` chưa đạt trọn bộ: hai assertion cũ đòi `.exam-view-toolbar` chứa nút cài đặt và nhãn `Tư cách nháp` không khớp toolbar/trạng thái NT hiện tại. Đã tái hiện đúng hai lỗi này khi thay component bằng nguyên bản lấy từ `2ac7f6c`; không sửa nghiệp vụ để đáp ứng assertion cũ. Các lượt toàn file đã dừng; không tính là PASS. Những selector được cập nhật trong test chính chỉ theo nhãn tab NT và cách trình bày đã chọn; giữ kiểm tra nội dung file theo VT.

Log nằm trong `%TEMP%`, tiền tố `duansaudh-integration-`. Có cảnh báo JSDOM không phân tích được CSS in `@page`; không đổi CSS đầu ra để né cảnh báo môi trường test.

Không chạy migration, seed hay cập nhật thanh toán trên database thật. Browser dùng component và callback fixture; kiểm tra DB dùng database tạm riêng.

## Chạy để kiểm tra thủ công

Dependency hiện tại được dùng lại qua junction `node_modules` sang workspace gốc. Nếu di chuyển worktree, cài lại bằng lockfile của từng package.

Tạo `.env` tại gốc worktree từ `.env.example`, điền cấu hình database **thử nghiệm** và session theo môi trường của bạn. Dùng cổng riêng, bảo đảm database đã có schema và dữ liệu thử:

```dotenv
PORT=3002
WEB_PORT=3102
FRONTEND_URL=http://localhost:3102
API_PUBLIC_URL=http://localhost:3002
REACT_APP_API_URL=http://localhost:3002
```

Không sao chép `DATABASE_URL` trỏ database thật vào môi trường chạy thử. Các biến DB/session bắt buộc khác xem `.env.example`. Nếu DB thử mới hoàn toàn, chạy migration/seed hiện có chỉ sau khi cấu hình đúng DB thử.

Mở hai terminal PowerShell:

```powershell
Set-Location D:\SauDH\DuansauDH-integration-nt1-vt9\backend
npm run dev
```

```powershell
Set-Location D:\SauDH\DuansauDH-integration-nt1-vt9\frontend
npm run dev -- --port 3102 --strictPort
```

Truy cập `http://localhost:3102`. Kiểm tra cổng 3002/3102 trước khi chạy. Server dùng kiểm tra geometry không phải phiên đăng nhập đầy đủ với backend tích hợp; không tính nó là kiểm thử end-to-end thật.
