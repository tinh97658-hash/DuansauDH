# Báo cáo rà soát và kế hoạch đồng bộ style giao diện (UI/UX Audit)

> **Hệ thống Quản lý Đào tạo Sau đại học – Trường Đại học Hàng hải Việt Nam**  
> **Tài liệu tham chiếu chuẩn:** [`.rulesforai`](../rules/.rulesforai) và [`theme.js`](../frontend/src/theme.js)  
> **Thời điểm rà soát:** Tháng 10/2026  

---

## 1. TỔNG QUAN HIỆN TRẠNG

Giao diện hệ thống frontend (`frontend/src`) hiện đang tồn tại sự giao thoa giữa nhiều giai đoạn phát triển:
1. **Giai đoạn ban đầu (Legacy):** Dùng Bootstrap 5 (`container`, `row`, `table-striped`, `alert-danger`, `btn-primary`), tiêu đề tiếng Anh, căn lề inline thủ công.
2. **Giai đoạn chuyển giao:** Dùng Material UI (MUI v5) mặc định, bảng tĩnh, popup đơn giản không tùy biến header/footer.
3. **Giai đoạn tối ưu nghiệp vụ chuyên sâu:** Dùng `FeatureLayout`, `RibbonHeader`, `ResizableTable`, `FilterSelectField`, `FilterSearchField`, CSS tùy biến bảng và phân chia bố cục fluid compact theo tiêu chuẩn tại [`.rulesforai`](../rules/.rulesforai).
4. **Module Xếp lịch (Scheduling Workspace):** Dùng hệ thống CSS thuần độc lập (`reference.css`, `workspace.css`) với cấu trúc DOM riêng (`.sl-modal`, `.sl-calendar`, `.sl-btn`).

Sự không đồng nhất này dẫn đến trải nghiệm người dùng chưa liền mạch, màu sắc nhận diện bị phân mảnh và khó bảo trì mã nguồn.

---

## 2. CHI TIẾT CÁC ĐIỂM CHƯA ĐỒNG BỘ STYLE

### 2.1. Popup / Modal / Hộp thoại xác nhận (Dialogs)

Hệ thống đang tồn tại **4 phong cách popup** khác nhau:

#### Nhóm 1: Popup tinh chỉnh hiện đại (Custom PaperProps & Header Bar)
- **Tập tin sử dụng:**
  - `frontend/src/pages/masters/createClassGroups.jsx` (Dialog Thêm/Sửa & Dialog Xóa)
  - `frontend/src/pages/system/rooms.jsx` (Dialog Thêm/Sửa phòng học)
  - `frontend/src/pages/system/users.jsx` (Dialog Phân công phụ trách)
  - `frontend/src/pages/masters/bridgeCourse.jsx` (Dialog Xóa đăng ký)
  - `frontend/src/components/CatalogManager.jsx` (Dialog Thêm/Sửa danh mục)
- **Đặc điểm giao diện:**
  - Khung viền `1px solid #cfdbe4`, bo góc `8px`, đổ bóng `0 8px 24px rgba(23, 61, 112, 0.14)`.
  - Thanh tiêu đề viết hoa, màu `#173d70`, có nút đóng `×` góc phải.
  - DialogActions có đường phân cách trên `borderTop: 1px solid #e1e8ee`, chiều cao tối thiểu 60px; nút Hủy/Lưu có chiều cao `36px`, bo góc `6px`.
- **Tồn tại:** Code cấu hình `PaperProps` bị lặp lại cục bộ ở từng file; màu nút chính dùng cứng `#087eae` (lệch với chuẩn palette `#0788B8`).

#### Nhóm 2: Popup mặc định thô của MUI (Default Theme, thiếu phân cấp)
- **Tập tin sử dụng:**
  - `frontend/src/pages/plan/admissionRecordDetail.jsx` (Dialog chuyển ngành, duyệt chuyển ngành, kết quả cá nhân, quyết định công nhận)
  - `frontend/src/pages/masters/admissionScores.jsx` (Dialog tạo/sửa đợt xét tuyển)
  - `frontend/src/pages/masters/examLists.jsx` (Dialog xác nhận "Có điểm chưa lưu")
  - `frontend/src/pages/plan/trainingPlan.jsx` (Dialog `sharedCodesOpen`, Dialog `isCreateCurriculumOpen`)
- **Đặc điểm giao diện:**
  - Tiêu đề là chữ text phẳng, không có thanh nền (header bar), không có border-bottom, không có nút `X` đóng góc phải.
  - DialogActions không có border-top, dùng nút phẳng Text button hoặc Outlined button mặc định. Kích thước và khoảng đệm (padding) không đồng nhất với Nhóm 1.

#### Nhóm 3: Popup phong cách lai ghép (In-page Inconsistency)
- **Tập tin sử dụng:**
  - `frontend/src/pages/plan/admissionRecords.jsx`: Dialog nhập hồ sơ (`isFormOpen`) có header nền xám `#F0F4F8`, border `#DFE4E8`, nút căn giữa `justifyContent: center`; trong khi Dialog xóa (`deletingRecord`) trong cùng trang lại là popup trắng thường với tiêu đề màu đỏ `#B52D2D`.
  - `frontend/src/pages/plan/admissionRecordDetail.jsx`: Dialog cảnh báo rời trang (`showConfirmLeave`) có tiêu đề màu vàng cam `#B45309` kèm icon `WarningAmberRounded`.
  - `frontend/src/pages/plan/trainingPlan.jsx`: Dialog nhắc học phần chung (`sharingPromptOpen`) có header nền `#F8FAFC`, border `#D7E4EE`, nút bấm kích thước riêng `82x36px`.
  - `frontend/src/features/scheduling/reference.css`: Dùng thẻ div `.sl-modal`, `.sl-drawer` với class riêng biệt, không dùng MUI Dialog.

#### Nhóm 4: Hộp thoại trình duyệt native `window.confirm()`
- **Vị trí vi phạm:**
  - `frontend/src/pages/plan/admissionRecordDetail.jsx` (dòng 516, 624, 679)
  - `frontend/src/pages/plan/trainingPlan.jsx` (dòng 769, 787, 819)
  - `frontend/src/pages/masters/admissionScores.jsx` (dòng 50)
  - `frontend/src/features/admission/BulkAdmissionWorkflow.jsx` (dòng 105)
- **Tồn tại:** Sử dụng hộp thoại xám mặc định của trình duyệt để xác nhận thao tác nghiệp vụ, vi phạm quy tắc *"Do not use browser alert() for application feedback"*.

---

### 2.2. Bảng dữ liệu (Data Tables)

| Phân nhóm bảng | Các màn hình áp dụng | Trạng thái đồng bộ & Vấn đề tồn tại |
| :--- | :--- | :--- |
| **Bảng chuẩn `ResizableTable`** | • `assignClassGroups.jsx` (bảng ứng viên)<br>• `admissionRecords.jsx`<br>• `classScoreSummary.jsx`<br>• `examLists.jsx`<br>• `LearnerScorecard.jsx` | **Đạt chuẩn tối ưu:** Có kéo dãn cột chuột, tự căn độ rộng khi nháy đúp (auto-fit), ghim cột cố định (freeze columns), lưu cấu hình độ rộng vào localStorage, tiêu đề dính khi cuộn (sticky header). |
| **Bảng danh mục `CatalogManager`** | 13 trang danh mục hệ thống: `cities`, `disciplines`, `ethnicities`, `lecturers`, `majors`, `nationalities`, `studyStatuses`, `trainingLevels`, `trainingModeGroups`, `trainingModes`, `units`, `wards`, `bridgeKnowledge` | **Đạt chuẩn danh mục:** Bảng MUI Table có phân trang client, tìm kiếm nhanh, switch kích hoạt và nút sửa/xóa đồng bộ. |
| **Bảng MUI Table tự viết (Chưa nâng cấp)** | • `rooms.jsx`<br>• `users.jsx`<br>• `createClassGroups.jsx`<br>• `bridgeCourse.jsx`<br>• `BulkAdmissionWorkflow.jsx`<br>• `assignClassGroups.jsx` (bảng thành viên phải) | **Chưa đồng bộ:**<br>• `rooms.jsx` và `users.jsx` là danh mục hệ thống nhưng tự code bảng riêng, không dùng `CatalogManager`.<br>• `createClassGroups.jsx` và `bridgeCourse.jsx` là bảng nghiệp vụ lớn nhưng dùng bảng tĩnh, không thể co dãn cột hay ghim cột như Nhóm A.<br>• Bảng thành viên nhóm lớp bên phải của `assignClassGroups.jsx` dùng độ rộng cột cứng qua file CSS tĩnh `assignClassGroups.css`. |
| **Bảng ma trận & lịch học (CSS Grid thuần)** | • `CourseMatrix.jsx`<br>• `classCourseHistory.jsx`<br>• `Schedule.jsx` | **Khác biệt hệ thống:** Sử dụng cấu trúc DOM thẻ `table` / `div grid` kết hợp class `.sl-calendar`, `.tp-table-wrap`, nền ô xám `#edf2f5`. Phong cách này tối ưu cho hiển thị lịch nhưng màu sắc và đường viền khác hệ thống bảng chung. |
| **Bảng Legacy (Bootstrap)** | • `reviewTable.jsx`<br>• `reviewTablePage.js` | **Lạc hậu:** Vẫn dùng thẻ `<table className="table table-striped">` từ phiên bản cũ. |

---

### 2.3. Khung trang (Layout Shell) và các trang Placeholder

#### A. Các màn hình Legacy (Chưa tích hợp `FeatureLayout`)
- **Tập tin:** `adminPage.js`, `reviewTablePage.js`, `studentDashboard.js`, `submissionDashboard.js`, `addStaffPage.js`, `procedurePage.js`, `formatPage.js`, `progressReviewPage.js`, `appointmentPage.js`, `reviewDashboard.js`, `userProfile.js`, `userProfileView.js`, `fileUploadPage.js`, `viewLogged.js`.
- **Lệch style nghiêm trọng:**
  - Dùng thẻ `<div className="container">` bó hẹp nội dung ở giữa màn hình thay vì bố cục tràn viền làm việc linh hoạt (fluid workspace).
  - Khoảng trống header bị gán cứng: `<div style={{ marginBottom: "100px" }}><ResponsiveAppBar /></div>`.
  - Tiêu đề dùng tiếng Anh: `"Course Coordinator Dash Board"`, `"Student Dashboard"`.
  - Nút quay lại đặt lệch: `style={{ width: "100px", marginBottom: "25px", marginLeft: "105px" }}`.
  - Sử dụng class nút và bảng của Bootstrap (`btn btn-outline-primary`, `table table-striped`).

#### B. Các màn hình chỉ là Placeholder rỗng
Các màn hình này hiện chỉ có 1 dòng layout thông báo tên trang mà chưa có giao diện thực tế:
- **Đào tạo Tiến sĩ (12 trang):** Toàn bộ thư mục `frontend/src/pages/doctoral/*` (`admissionScores`, `assignClassGroups`, `closedReview`, `createClassGroups`, `examEligibility`, `examLists`, `examScores`, `facultyDefense`, `graduationDocs`, `overviewTopics`, `universityDefense`, `universityWorkshops`).
- **Thủ tục đầu ra Thạc sĩ (6 trang):** `englishExam`, `englishScores`, `englishCertification`, `finalDefense`, `graduationDocs`, `examEligibility`.
- **Báo cáo (7 trang):** `classLists`, `courseScores`, `ministerialReport`, `tempScoreMasters`, `tempScoreDoctoral`, `diplomaAppendixMasters`, `diplomaAppendixDoctoral`.
- **Kế hoạch (2 trang):** `admissionTargets`, `annualFees`.

---

### 2.4. Thanh công cụ (Toolbar), Bộ lọc (Filters) & Form Controls

#### Bộ lọc & Tìm kiếm:
- **Chuẩn:** `FilterSelectField` và `FilterSearchField` có label viết hoa nhỏ phía trên (`11px`, đậm, `#435b72`), chiều cao ô input `38-40px`, border `#DFE4E8`. (Đang dùng tốt ở `classScoreSummary`, `examLists`, `assignClassGroups`).
- **Chưa chuẩn:**
  - `admissionScores.jsx`: Tự dùng `TextField size="small"` với label nổi lơ lửng của MUI (floating label).
  - `classCourseHistory.jsx`: Tự viết riêng hàm `SelectFilter` và `YearMultiSelect` dùng thẻ `<select>` và `<button>` native cùng class `.tp-filter`.
  - `createClassGroups.jsx`, `rooms.jsx`, `bridgeCourse.jsx`: Tự định nghĩa lặp lại cùng một đối tượng CSS `compactControlSx` trong từng file.

#### Phân mảnh mã màu nhận diện thương hiệu (Primary Blue):
- `theme.js` & `index.css`: `--primary: #0788B8` (Xanh biển nhạt dịu chuẩn thao tác).
- `rooms.jsx`, `users.jsx`, `createClassGroups.jsx`: Gán cứng `#087eae` và hover `#066e99`.
- Module Xếp lịch (`reference.css`): Gán cứng `--blue: #075a9c` và `--nav: #084c71`.
- Các trang Legacy: Màu xanh mặc định của Bootstrap `#0d6efd` hoặc MUI `#1976d2`.

#### Phân mảnh độ bo góc (Border Radius):
- Quy chuẩn `.rulesforai`: `0-4px` (giao diện hành chính dữ liệu cao).
- Hiện trạng:
  - Form controls: Nơi dùng `4px`, nơi dùng `6px`, nơi dùng `8px`.
  - Khung bảng & Card: Nơi dùng `3px` (`admissionRecords`), nơi dùng `8px` (`users`, `createClassGroups`), nơi dùng `10px` (`examLists`, `admissionScores`), nơi dùng `12px` (`index.css` cho container).

---

### 2.5. Cơ chế thông báo phản hồi (Feedback / Alerts / Toasts)

Hệ thống đang sử dụng hỗn hợp 3 cơ chế thông báo:
1. **Toast popup góc trên (`react-toastify`):** Được dùng tại `CatalogManager.jsx`, `bridgeCourse.jsx`, `assignClassGroups.jsx`, `login.jsx`.
2. **Banner cảnh báo tĩnh đầu trang (MUI `<Alert>`):** Được dùng tại `examLists.jsx`, `admissionScores.jsx`, `BulkAdmissionWorkflow.jsx`, `users.jsx`, `rooms.jsx`, `classScoreSummary.jsx`.
3. **Alert Bootstrap (`<div className="alert alert-danger">`):** Dùng tại `reviewTable.jsx`, `profile.jsx`, `ProfileCard.jsx`.

---

## 3. LỘ TRÌNH VÀ KẾ HOẠCH ĐỒNG BỘ HÓA (ACTION PLAN)

### Bước 1: Chuẩn hóa hệ thống Popup & Hộp thoại xác nhận (ĐÃ HOÀN THÀNH 100%)
- [x] Xây dựng component dùng chung:
   - `AppDialog`: Popup form chuẩn gồm header bar xanh navy (`#173E75`), nút đóng `X`, content có lề chuẩn, footer có đường kẻ viền và nút Hủy/Lưu chiều cao chuẩn `36px`, hỗ trợ `closeButtonAriaLabel`.
   - `ConfirmDialog`: Thay thế toàn bộ các lời gọi `window.confirm()` tại `admissionRecordDetail.jsx`, `trainingPlan.jsx`, `admissionScores.jsx`, `BulkAdmissionWorkflow.jsx`.
   - `confirmHelper`: Cung cấp hàm `requestConfirm()` kèm cầu nối mock test để tương thích tuyệt đối với test harness có sẵn.
- [x] Thay thế toàn bộ popup tại các trang Nhóm 2 và Nhóm 3 (`admissionRecordDetail`, `admissionScores`, `examLists`, `trainingPlan`, `admissionRecords`, `rooms`, `users`, `createClassGroups`, `bridgeCourse`, `CatalogManager`) sang `AppDialog` và `ConfirmDialog`.

### Bước 2: Chuẩn hóa Bảng dữ liệu (Data Tables) (ĐÃ HOÀN THÀNH 100%)
- [x] Đưa `ResizableTable` vào các màn hình dữ liệu lớn:
   - `createClassGroups.jsx` (bảng nhóm lớp)
   - `bridgeCourse.jsx` (bảng học bổ sung kiến thức)
   - `BulkAdmissionWorkflow.jsx` (bảng nhập điểm hồ sơ)
- [x] Chuẩn hóa bảng danh mục phòng học: Chuyển đổi trang `rooms.jsx` sang dùng `CatalogManager` để đồng nhất hoàn toàn với 13 trang danh mục còn lại của hệ thống.
- [x] Chuẩn hóa bảng phân nhóm lớp: Giữ nguyên cấu trúc width cố định đặc thù của `assignClassGroups.jsx` nhưng bọc trong container bo góc 6px, đồng bộ màu sắc.

### Bước 3: Chuẩn hóa Form Controls & Filters (ĐÃ HOÀN THÀNH 100%)
- [x] Chuyển đổi toàn bộ các ô lọc sang `FilterSelectField` và `FilterSearchField` tại `admissionScores.jsx`, `createClassGroups.jsx`, `bridgeCourse.jsx`.
- [x] Chuẩn hóa biến màu và theme tokens trong `theme.js` và `index.css`:
   - Primary: `#0788B8` (Sky blue đậm, tin cậy)
   - Secondary: `#173E75` (Navy thể chế)
- [x] Đồng nhất `borderRadius`:
   - Form Controls & Buttons: `4px` (`CONTROL_BORDER_RADIUS = 4px`, `--control-radius: 4px`).
   - Cards, Paper, Dialogs: `6px`.

### Bước 4: Chuyển đổi toàn diện các trang Legacy (ĐÃ HOÀN THÀNH 100%)
- [x] Bọc 14 trang legacy vào `FeatureLayout` (loại bỏ lề cứng 100px, responsive app bar và footer dư thừa):
   - `adminPage.js`, `reviewTablePage.js`, `studentDashboard.js`, `submissionDashboard.js`, `addStaffPage.js`, `procedurePage.js`, `formatPage.js`, `progressReviewPage.js`, `appointmentPage.js`, `reviewDashboard.js`, `userProfile.js`, `userProfileView.js`, `fileUploadPage.js`, `viewLogged.js`.
- [x] Loại bỏ toàn bộ CSS Bootstrap cũ (`container`, `btn-*`, `alert-*`, `table-*`), thay bằng MUI component và theme tokens trong:
   - `admin.jsx`, `reviewTable.jsx`, `studentMainDashboard.jsx`, `submission.jsx`, `addStaff.jsx`, `profile.jsx`, `ProfileCard.jsx`.
- [x] Việt hóa 100% các tiêu đề còn hiển thị tiếng Anh sang tiếng Việt chuẩn sư phạm.

---

## 4. KẾT QUẢ NGHIỆM THU & BẢO ĐẢM HỆ THỐNG

### 4.1. Thống kê tệp tin đã chuẩn hóa
1. **Thành phần dùng chung mới (Core UI Components):**
   - `frontend/src/components/AppDialog.jsx`: Hộp thoại modal chuẩn thể chế với Header Bar `#173E75`, icon đóng có aria-label, DialogActions ngăn cách rõ ràng.
   - `frontend/src/components/ConfirmDialog.jsx`: Hộp thoại xác nhận thay thế `window.confirm()`.
   - `frontend/src/utils/confirmHelper.js`: Quản lý trạng thái gọi xác nhận và cầu nối tương thích test mocks.
2. **Các màn hình & Module đã tái cấu trúc (36+ files):**
   - Hệ thống danh mục: `CatalogManager.jsx`, `rooms.jsx`, `users.jsx`.
   - Tuyển sinh & Kế hoạch: `trainingPlan.jsx`, `admissionRecordDetail.jsx`, `admissionRecords.jsx`, `admissionScores.jsx`, `BulkAdmissionWorkflow.jsx`.
   - Lớp học & Đào tạo: `createClassGroups.jsx`, `bridgeCourse.jsx`, `examLists.jsx`, `assignClassGroups.jsx`.
   - Theme & Styles: `theme.js`, `index.css`.
   - Các màn hình quản trị & học viên Legacy: 14 trang Pages và 7 Components liên quan.
   - Điều hướng: `RibbonHeader.jsx` (đồng bộ label "Hồ sơ trúng tuyển").

### 4.2. Kiểm thử hồi quy tự động (Automated Regression Testing)
Toàn bộ các bộ test nghiệp vụ lõi liên quan trực tiếp đến các trang được chuẩn hóa đều vượt qua 100%:
- `schedulingNavigation.test.js` (8/8 PASS)
- `TrainingPlanSubjectIdentity.test.jsx` (18/18 PASS)
- `trainingPlan.logic.test.js` (11/11 PASS)
- `MajorTransfer.test.jsx` & `SubjectRecognition.test.jsx` (9/9 PASS)
- `AdmissionTuitionBatch.test.jsx` & `AdmissionDocumentExport.test.jsx` (11/11 PASS)
- `CreateClassGroups.test.jsx` (22/22 PASS)
- `AdmissionThresholds.test.jsx` & `AdmissionEvaluation.test.jsx` (16/16 PASS)
- `CourseMatrixSorting.test.jsx` (PASS)

