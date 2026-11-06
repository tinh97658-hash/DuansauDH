# Rà soát web local sau merge — 05/11/2026

## Rà soát mở rộng toàn bộ các trang

Quét 66 đường dẫn tĩnh, sau đó quét lại với 4 trường hợp có dữ liệu cụ thể:
chi tiết hồ sơ tuyển sinh, hồ sơ học viên, lớp điểm có đông thành viên và tiến độ
của chuyên ngành có nhiều lớp nhất. Tổng cộng **70 lượt điều hướng** bằng Edge
headless, dùng backend và guards/RLS thật trên bản sao database riêng.

**Kết quả cuối:** không có timeout, pageerror, HTTP >=400 hoặc trạng thái
“Đang tải” còn lại sau khi mạng ổn định ở 70 trường hợp đã quét. Các đường dẫn
bao gồm cả trang khung/chức năng chưa triển khai; kết quả này không biến chúng
thành chức năng hoàn chỉnh. Không truy cập preview cần payload xuất tài liệu.

| Điểm đo | Trước đợt rà soát mở rộng | Sau sửa |
| --- | --- | --- |
| API tiến độ, chuyên ngành 8 lớp, đối chiếu cùng dữ liệu | 24.265 giây | **1.874 giây** |
| Tra kết quả học lại ở lần đo chậm nhất | 40.483 giây | 0.464 giây |
| Tổng hợp điểm thiếu, cùng mẫu nhiều lớp | 6.752 giây | 0.243 giây |
| API phiên đăng nhập, trung vị các lượt điều hướng | 126 ms | **77 ms** |
| API quyền, trung vị các lượt điều hướng | 201 ms | **88 ms** |
| Trang tiến độ, chuyên ngành mặc định, gồm tải giao diện | 4.863 giây | **1.722 giây** |

Thời gian là số đo local development, có cache và tải hệ thống khác nhau giữa
các lần chạy; không phải cam kết SLA hoặc kiểm thử nhiều người dùng đồng thời.
Hai truy vấn riêng và tổng API được đo ở các lượt khác nhau, không cộng các số
trên để suy ra tổng thời gian.

Các điểm đã xử lý thêm:

1. `readRetakeResults` ghép chuỗi lên cột UUID trong hai phép tra hồ sơ. EXPLAIN
   ghi nhận 816 và 736 lần quét tuần tự `admission_records`. Đổi sang helper
   kiểm tra định dạng/tách UUID rồi so sánh trực tiếp trên cột có chỉ mục; giữ
   thứ tự ưu tiên hồ sơ và lần học. Mã sai hoặc không tồn tại không gây lỗi cast.
2. Query tiến độ bị inline và tính lại tập `saved_grades` hàng trăm lần (802
   vòng ở mẫu chậm). Materialize tập điểm và tập điểm hoàn tất đã giới hạn bởi
   lớp học phần của request, để dùng chung trong phép tổng hợp.
3. `examOutcomesSql` cũng bỏ ghép chuỗi trên khóa hồ sơ ở phép join, giúp các
   reader kết quả học tập/bảng điểm dùng chung được tra theo UUID.
4. Danh sách hồ sơ làm việc chỉ tải thông tin vai trò; không tải kèm toàn bộ
   permission graph chỉ để lấy nhãn hiển thị. Việc tính quyền thực tế vẫn tải
   đầy đủ grant và scope như trước.
5. Các guard/service trong cùng HTTP GET/HEAD/OPTIONS dùng chung một lookup
   quyền mới. Cache thuộc request qua WeakMap, khóa theo nhân sự/phiên/hồ sơ;
   không dùng lại giữa request. Đổi hồ sơ hoặc invalidate buộc tính lại. Các
   lượt ghi luôn đọc quyền mới; lỗi lookup không được giữ lại làm cache.
6. Trang tiến độ hủy HTTP request cũ khi đổi phạm vi hoặc rời trang.

Đã so sánh toàn bộ response tiến độ của chuyên ngành 8 lớp với service từ HEAD:
**kết quả giống nhau**, không chỉ so sánh số lượng. Unit test bổ sung kiểm tra
chia sẻ lookup trong request, đổi hồ sơ, invalidate, quyền ghi mới và profile
picker không tải nhầm permission graph. Integration bổ sung mã học viên hỏng/
không tồn tại; các fixture cũ được cập nhật theo quy trình tư cách thi tự động,
phiên bản quy tắc điểm, học phí và quyền tường minh hiện có của dự án. Không đổi
cơ chế cấp quyền trong sản phẩm để làm các bài test cũ đạt.

Kiểm tra luồng giao diện còn cho thấy trang kế hoạch có một long task 332 ms ở
development; các trang điểm/lịch/tiến độ không có long task trên 250 ms trong
lượt cuối. Không thấy tải ExcelJS/pdfmake/docx/JSZip khi chỉ mở các trang này.
Các thư viện xuất file hiện được tải khi cần; không tách/chuyển thư viện chỉ vì
cảnh báo kích thước bundle. Chưa benchmark thao tác nhập/xuất file hàng loạt.

Kiểm chứng cuối đợt mở rộng:

- **1.016/1.016 unit test backend**, 75 suite, đạt.
- **50 integration test PostgreSQL**: 23 bài về hồ sơ/quyền/RLS và 27 bài về học
  lại, điểm, quy trình thi và bảng điểm được lưu trữ, đều đạt trên bản sao riêng.
- **34/34 test frontend tiến độ học phần** đạt, gồm thay đổi chuyên ngành/năm
  và xuất báo cáo. Những assertion HTTP liên quan đã kiểm tra thêm AbortSignal.
- Build backend và frontend thành công; `git diff --check` không có lỗi.
- Backend development đã khởi động lại sau build; frontend 3100 và readiness
  backend 3001 trả HTTP 200. Server/browser kiểm thử 3196/3197 đã dừng.
- Đợt mở rộng không đổi `.env`, cấp lại quyền hoặc ghi vào điểm/lịch đang dùng.

Artifact chẩn đoán local (trong `.tmp`, không commit dữ liệu cá nhân):
`all-pages-performance-before.json`, `all-pages-performance-after.json`,
`progress-comparison-final.json`, `progress-plan-2.json`, `progress-plan-3.json`,
`backend-unit-final.log`, `retake-regression-final.log`.

## Bổ sung: các trang sau đăng nhập

Đã sửa điểm nghẽn đọc dữ liệu dùng chung, không chỉ trang login. Database local
hiện có 93 lớp học phần, 74 lớp đã hoàn thành, khoảng 600 buổi học.

| Luồng, hồ sơ quản trị | Trước sửa | Đo cuối trên database local |
| --- | --- | --- |
| Dashboard | 414 câu SQL, khoảng 2.5 giây | 35 câu SQL, 1.292 giây |
| Danh mục bảng điểm | 127 câu SQL, khoảng 3.4 giây | 10 câu SQL, 0.847 giây |
| Danh sách lớp/lịch kèm xung đột | khoảng 2.9 giây | 1.370 giây |

Các số trên đo service trong ngữ cảnh hồ sơ và RLS thật, không gồm thời gian tải
JavaScript/render. Không phải benchmark tải đồng thời; số liệu có thể dao động.

Thay đổi:

- Gom kiểm tra trạng thái điểm cho nhiều lớp, dùng chung SQL roster với bảng điểm
  phân trang để giữ nguyên quy tắc rút học, bảo lưu, công nhận và miễn ngoại ngữ.
  Hồ sơ có tối đa hai lớp cần đánh giá vẫn dùng cách đọc trực tiếp để tránh tăng
  chi phí lập kế hoạch batch cho phạm vi nhỏ.
- Đọc trọng số theo môn/năm theo lô, dùng chung cấu hình quy tắc hiện hành trong
  lần đọc đó; không lưu cache xuyên người dùng hoặc request.
- Dashboard chia sẻ một kết quả tracking cho hai nhóm nhập/duyệt điểm, và gom
  các truy vấn liên quan vào transaction đọc có ngữ cảnh quyền giống trước.
- Migration `097-read-policy-initplans` đưa các quyết định quyền không phụ thuộc
  bản ghi vào scalar subquery để PostgreSQL đánh giá một lần mỗi statement.
  Giữ các nhánh kiểm tra sở hữu theo dòng, hồ sơ làm việc và các policy ghi.
  Migration đã được áp dụng trên local và có rollback được kiểm chứng.
- Request lịch và bảng điểm truyền AbortSignal, hủy request không còn dùng khi
  rời trang/đổi bộ lọc. Đây không phải bảo đảm mọi SQL đang chạy sẽ bị hủy ngay.

Kiểm chứng:

- Bản sao database riêng: 7 hồ sơ × 4 ngữ cảnh × 5 bảng = 140 phép đối chiếu
  danh sách ID trước/sau. Tất cả giống nhau; rollback cũng giống baseline.
- So sánh trực tiếp service bảng điểm cũ từ HEAD và service mới: toàn bộ danh mục
  và trạng thái quy trình khớp cho hồ sơ quản trị và chuyên viên. Dữ liệu lịch,
  số học viên và khả năng thao tác cũng khớp cách đọc cũ.
- 142 unit test backend và 23 integration test PostgreSQL/RLS đạt. Các fixture
  HTTP cũ được bổ sung route grants theo cơ chế hiện hành; mã môn fixture được
  cấp phần số/chữ riêng theo unique index hiện hành.
- Frontend: lần chạy ba suite có 134 test đạt, 6 test lỗi. Đã cập nhật 5 test
  so khớp HTTP config để kiểm tra AbortSignal, và một kỳ vọng cũ về nút hoàn tất
  tư cách thi tự động cho roster miễn thi. Chạy lại cả 6 test liên quan đều đạt.
  jsdom vẫn cảnh báo không hiểu margin box trong CSS in; không ghi nhận lỗi này
  trong trình duyệt thật. Backend và frontend build thành công.
- Rà soát theo skill secure-code-review, phạm vi ASVS V4/V5: dữ liệu SQL dùng
  replacements; phần thay biểu thức chỉ là SQL cố định; không mở quyền gọi các
  hàm roster nội bộ. Kiểm thử gồm đổi hồ sơ, thu hồi quyền và chế độ chỉ xem.

Kiểm tra Edge headless với frontend và backend thật trên bản sao riêng, có
identity kiểm thử và giữ guards/RLS thật. Đo mở lại toàn trang, gồm tải module,
session, permissions, API và chờ network idle:

| Trang | Toàn trang ổn định | API chính |
| --- | --- | --- |
| Dashboard, lần đầu/cache Vite mới | 5.219 giây | 1.568 giây |
| Bảng điểm | 2.966 giây | Options 1.189 giây; bảng 15 dòng 0.362 giây |
| Lịch học | 3.657 giây | Danh sách/xung đột 2.245 giây khi tải song song các API khác |
| Lịch thi | 1.812 giây | 0.545 giây |

Cả bốn trang trả HTTP 200, không có pageerror và hết trạng thái đang tải.
Server/browser kiểm thử đã dừng. Kết quả này xác nhận bốn luồng trên; chưa thể
khẳng định mọi màn hình nghiệp vụ đều đã tối ưu. Lịch học vẫn còn chi phí tính
xung đột/roster; permissions/session cũng tạo round-trip trước khi tải dữ liệu.

Phần dưới lưu lại kết quả kiểm tra frontend ban đầu trước lần bổ sung này.

## Kết quả

Đã tái hiện tải chậm ở frontend development. Backend hoạt động không đồng nghĩa
với giao diện đã tải xong. Kiểm tra `/health/ready` ở lượt xử lý trước chưa đủ
để xác nhận toàn bộ website hoạt động.

| Phép đo trên máy local | Trước điều chỉnh Vite | Sau điều chỉnh Vite |
| --- | --- | --- |
| Hiện ô email đăng nhập, 3 browser context mới | 12.761 / 9.936 / 7.281 giây | 0.420 / 0.295 / 0.292 giây |
| Chờ network idle, cùng 3 lượt | 22.161 / 24.948 / 15.874 giây | 0.934 / 0.808 / 0.797 giây |
| HTTP HTML, đo trực tiếp | Có lượt 4–11 giây | 79 / 8 / 5 ms |
| HTTP ảnh nền, đo trực tiếp | Có lượt vượt timeout 7 giây | 422 / 10 / 20 ms |

Browser: Edge headless, Playwright; truy cập `/` và đợi `#vmu-email` hiện sau
chuyển hướng `/login`. Các lượt trước/sau đều tạo page với context mới.
Network idle là tín hiệu các request đã yên, không phải chỉ số tương tác.
Không có lỗi JavaScript hoặc HTTP >=400 trong 3 lượt browser sau sửa.
Đây là đo tuần tự trên một máy, không phải kiểm thử tải đồng thời hoặc A/B
kiểm soát đầy đủ; cache và tải hệ thống có thể ảnh hưởng kết quả.

Một lần kiểm tra riêng dùng cache Vite mới hoàn toàn, server cổng 3193:
ô đăng nhập hiện sau **4.761 giây**, không có lỗi JavaScript. Server kiểm tra
này đã dừng. Kết quả cache ấm không đại diện cho lần khởi động đầu tiên.

## Thay đổi frontend

`frontend/vite.config.js` trước đó không khai báo `optimizeDeps.entries`.
Mã Vite đang cài mặc định tìm `**/*.html`; workspace còn HTML của CRA trong
`build/` và `public/`. Cấu hình mới chỉ định `index.html`, đồng thời bỏ theo dõi
`build/` và `node_modules-before-*`. Không xóa các thư mục cũ hoặc dependency.

Khởi động lại Vite đơn thuần trước khi sửa vẫn cho thời gian hiện form 7–13
giây. Sau điều chỉnh phạm vi quét, 3 lượt đều dưới 0.5 giây. Đây là bằng chứng
ủng hộ vấn đề nằm ở dev server/công việc quét, chưa phải CPU profile chứng minh
riêng từng thư mục là nguyên nhân. Chưa đủ dữ liệu để quy toàn bộ lỗi cho merge.

`npm --prefix frontend run build` thành công: 1.569 module, 18.14 giây.
Vẫn có cảnh báo chunk lớn và import báo cáo vừa static vừa dynamic.

## Cấu hình database và merge

- Merge `440fc4d` đổi **file mẫu** `.env.example`: `DB_PORT=55432` thành `15432`.
- `.env` local bị gitignore; thao tác merge thông thường không theo dõi file này.
- Trong lượt khắc phục trước, trợ lý sửa **hai giá trị local** `DB_PORT` và
  cổng trong `DATABASE_URL` từ `55432` sang `15432`.
- Windows hiện dành riêng dải TCP `55402–55501` cho cả IPv4 và IPv6.
  Docker thực sự báo lỗi bind khi thử dùng `55432`; việc dành cổng của Windows
  không được chứng minh là do merge.
- Database dùng lại volume `duansaudh_postgres_data`, hiện healthy và publish
  `127.0.0.1:15432 -> 5432`. Kết nối bằng thông tin trong `.env` thành công;
  đã áp dụng 102 migration, không có file migration còn thiếu tại lúc kiểm tra.
- Rà soát hiệu năng này không sửa thêm `.env`, tài khoản hay dữ liệu nghiệp vụ.
  Cổng cũ được ghi lại ở đây để đối chiếu; dùng lại cổng đó cần giải quyết việc
  Windows đang dành riêng cổng trước.

## Các điểm còn cần theo dõi

1. `frontend/src/config/http.js` chưa đặt timeout mặc định. Khi request treo,
   kiểm tra phiên hoặc thao tác nghiệp vụ có thể chờ rất lâu. Cần thiết kế
   timeout theo loại request; không áp một hạn ngắn chung cho import/export.
2. Ảnh nền login PNG khoảng 2.07 MB; ảnh profile được build khoảng 2.27 MB.
   Có thể tối ưu định dạng/kích thước sau khi đối chiếu chất lượng hình ảnh.
3. Bundle chính khoảng 566 kB (gzip 180 kB); ExcelJS khoảng 940 kB, pdfmake
   khoảng 1.01 MB. Kích thước bundle chưa chứng minh chúng được tải ở mọi trang;
   cần xem waterfall của từng màn hình trước khi chia bundle thêm.
4. Chưa đo tài khoản đã đăng nhập, dashboard có dữ liệu, truy vấn nghiệp vụ,
   hoặc tải nhiều người dùng. API session ẩn danh và readiness được đo khoảng
   5–8 ms ở đầu phiên; không thể suy ra mọi API đều nhanh từ hai endpoint này.

## Chạy local

Frontend: `http://localhost:3100`; backend: `http://localhost:3001`.
Hai tiến trình development đang chạy sau kiểm tra. Không mở thêm phiên trùng
cổng. Nếu tự chạy lại, dừng các phiên đang chạy rồi dùng `npm run dev` ở root.
