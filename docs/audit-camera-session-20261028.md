# Audit camera/session và tính phụ thuộc của protocol

Ngày: 28/10/2026. Phạm vi: manifest, tên member trong archive nguồn và episode N=300 đã dùng ở risk–coverage. Không đọc pixel, chạy model, tính score, chọn lại ngưỡng hoặc thay protocol đã đóng băng.

## 1. Kết luận sử dụng cho bài báo

**Có thể** mô tả kết quả theo token camera trong tên file và quan hệ cùng/khác token của true gallery–probe pair. **Chưa đủ cơ sở** gọi đó là kiểm tra trên camera vật lý chưa gặp, generalization giữa camera hoặc phân tích theo session/track.

Session ID trống ở toàn bộ 4.000 ảnh dev/test. Token camera thiếu ở 74 ảnh test. Không được suy session từ chỉ số cuối tên ảnh, coi thiếu camera là một camera mới, hoặc tự ghép mọi `cam1` thành một thiết bị vật lý toàn cục.

Ngoài metadata, cách lấy gallery/probe cũng phải được viết chính xác: episode builder lấy ảnh từ toàn bộ identity pool, không giữ vai trò gallery/mated của archive. Đây là protocol tùy chỉnh đã dùng trong kết quả cũ, không phải thí nghiệm mới áp dụng đúng vai trò official.

## 2. Kiểm tra nguồn và parser

Nguồn local: `data/raw/qmul/qmul_survface.zip`; subset ghi `dev_source=test`. README trong archive mô tả tên ảnh dạng `[PersonID]_[CameraID]_[ImageName].jpg`. Parser local lấy `_cam<number>_`, giữ trống nếu không khớp.

Đã kiểm tra:

- 4.000/4.000 tên ảnh tìm thấy trong đúng thư mục nguồn gallery/mated_probe/unmated_probe của archive, theo vai trò lưu trong manifest.
- Không trùng đường dẫn trong mỗi manifest; dev/test không trùng identity.
- Token lưu trong manifest khớp parser ở mọi dòng.
- 74 tên thiếu token test không theo dạng `_cam<number>_`; không tìm thấy cơ sở bổ sung CameraID từ các tên này.

Kiểm tra membership theo tên không chứng nhận nội dung ảnh đã copy giống từng byte hoặc archive là bản nguồn độc lập đã xác thực; không thực hiện content-duplicate audit trong bước này.

Trang dataset chính thức cho biết ảnh được thu từ nhiều person re-identification datasets, thuộc các chủ sở hữu nguồn khác nhau. Trang này không cung cấp bằng chứng đủ để gộp token `cam1` ở mọi identity thành cùng camera vật lý. Đây là giới hạn xác minh namespace, không phải kết luận các token chắc chắn là cục bộ. [Nguồn QMUL-SurvFace](https://qmul-survface.github.io/)

## 3. Độ đầy đủ metadata

| Thuộc tính | Development | Test |
|---|---:|---:|
| Ảnh / identity | 2.000 / 600 | 2.000 / 600 |
| Token camera đã biết | 2.000 | 1.926 |
| Thiếu token camera | 0 | **74 (3,7%)** |
| Thiếu session ID | **2.000 (100%)** | **2.000 (100%)** |
| Identity có ít nhất hai token đã biết | 434 | 522 |
| Identity không có token đã biết | 0 | 20 |
| Source-role gallery / mated / nonmated | 800 / 800 / 400 | 800 / 800 / 400 |

Thiếu camera ở test: 34 ảnh nguồn gallery, 34 mated, 6 nonmated. Không loại chúng khỏi thống kê toàn bộ để tạo kết quả đẹp hơn; nếu phân tầng phải có nhóm missing riêng.

Các token dev: cam1=1.154, cam2=658, cam3=150, cam4=34, cam10=4. Test: cam1=981, cam2=760, cam3=109, cam4=46, cam5=14, cam10=12, cam11=2, cam14=2, missing=74. Những nhóm chỉ vài ảnh không đủ hỗ trợ kết luận camera-level ổn định; số ảnh cũng không thay số identity độc lập.

Trong `prepare_qmul_subset.py`, nhánh same-domain lấy một tập ID đã sample rồi sắp xếp, chia test/dev bằng vị trí trong danh sách đã sort. Do đó hai phía không phải phép gán ngẫu nhiên đơn giản trong tập được chọn. Metadata camera/thiếu camera khác nhau có thể là confound giữa split; chưa kiểm chứng nguyên nhân. Không đổi split sau khi xem kết quả.

## 4. Gallery/probe thực tế của năm episode N=300

Mỗi split có 1.500 lượt gallery, 3.000 lượt mated probe và 1.500 lượt unknown qua năm seed. Đây là **lượt xuất hiện**, không phải mẫu độc lập.

| Thành phần được sample | Development | Test |
|---|---:|---:|
| Gallery lấy từ source-role gallery | 750 | 720 |
| Gallery lấy từ source-role mated | **750** | **780** |
| Mated probes lấy từ source-role gallery | 1.502 | 1.556 |
| Mated probes lấy từ source-role mated | 1.498 | 1.444 |
| Unknown lấy từ source-role nonmated | 1.000 | 1.000 |
| Unknown lấy từ ảnh của identity không được chọn vào gallery episode | 500 | 500 |

Vì vậy “unknown” trong custom protocol gồm cả official-unmated identities và enrolled-capable identities vắng khỏi gallery của episode. Trong cùng một episode, gallery identity và unknown identity vẫn tách nhau; không coi sự đổi vai trò giữa episode là leakage tự động.

Không được mô tả “gallery luôn lấy từ official gallery, probe luôn lấy từ official mated folder”. Nếu muốn protocol giữ vai trò nguồn, phải làm nhánh development mới, có tên riêng, và không thay thế số cũ.

### Quan hệ token giữa gallery đúng và mated probe

| Quan hệ true pair | Development | Test |
|---|---:|---:|
| Cùng token | 1.001 (33,37%) | 941 (31,37%) |
| Khác token | 1.999 (66,63%) | 1.925 (64,17%) |
| Thiếu ít nhất một token | 0 | 134 (4,47%) |

Đây là quan hệ với **true mate** trong gallery, không phải top-1 predicted identity. So sánh các nhóm này cần báo cả số identity và kích thước ảnh/quality, tránh gán mọi chênh lệch cho camera. Cùng token không chứng minh cùng thời điểm; khác token không chứng minh hai domain độc lập.

## 5. Lặp ảnh giữa episode và ý nghĩa với CI

| Split / episode role | Lượt xuất hiện | Ảnh khác nhau | Identity khác nhau | Ảnh xuất hiện ở nhiều seed |
|---|---:|---:|---:|---:|
| Dev / gallery | 1.500 | 1.044 | 400 | 384 |
| Dev / mated | 3.000 | 1.466 | 400 | 998 |
| Dev / unknown | 1.500 | 817 | 509 | 369 |
| Test / gallery | 1.500 | 1.040 | 400 | 370 |
| Test / mated | 3.000 | **1.448** | **400** | **992** |
| Test / unknown | 1.500 | 825 | 507 | 379 |

Một số probe xuất hiện trong cả năm seeds. Bootstrap identity qua toàn bộ episode, như phân tích AURC vừa làm, giữ được phụ thuộc do lặp ảnh/cùng identity. Nó chưa mô hình hóa shared camera/session effects hoặc việc lấy lại gallery. Không bootstrap theo token camera như một sửa chữa mặc định: namespace vật lý chưa xác minh và chỉ vài token có lượng dữ liệu lớn.

Wilson CI FPIR từng episode chỉ là pointwise có điều kiện trên gallery với giả định binomial. Việc mỗi unknown identity có một probe không loại bỏ phụ thuộc môi trường thu ảnh. Do thiếu session/track, chưa thể xác minh đầy đủ giả định độc lập đó.

## 6. Hành động cho bản thảo

1. Viết rõ dev/test là identity-disjoint subsets lấy từ identification-domain archive; không nói dev của subset hiện tại lấy từ official training partition.
2. Mô tả gallery sampling trên toàn bộ pool ảnh của identity. Nhấn mạnh custom protocol; không dùng official benchmark label cho các số này.
3. Đổi “camera generalization” thành “phân tích theo filename camera-token relation” nếu chưa có xác minh namespace/source-domain.
4. Ghi thiếu session và phụ thuộc qua gallery/camera trong giới hạn CI. Không diễn giải CI hiện tại là uncertainty tổng thể của triển khai.
5. Giữ missing-token group và báo nhỏ/thiếu metadata; không thêm mapping camera hoặc session do suy đoán.

## 7. Bước phân tích tiếp theo có thể làm mà không cần thêm dữ liệu/model

Ưu tiên **fixed-probe nested-gallery trên development**, dùng cached embeddings, giữ true mate và unknown probe pool cố định rồi thêm distractors. Việc này cô lập tác động của N tốt hơn thí nghiệm đang đổi cả probe pool, không phụ thuộc giả định token là camera vật lý toàn cục.

Chốt trước thiết kế: các N không vượt số ID sẵn có; một tập mate probes cố định luôn có mate trong mọi gallery; unknown calibration/validation tách identity và không xuất hiện trong gallery lớn nhất; cutoff chọn riêng trên calibration rồi so trên validation, kèm nhánh cutoff cố định từ N tham chiếu. Báo số người còn đủ cho unknown trước khi quyết định N. Không chạy lại test để chọn thiết kế mới.

Camera-token strata chỉ nên là phân tích mô tả bổ sung, không ưu tiên một thí nghiệm “leave-one-camera-out” với namespace chưa xác minh.

## 8. Artifact và kiểm chứng

- [Audit metadata tổng hợp và hash nguồn](camera-metadata-audit-20261028.json).
- [Count vai trò/token theo episode](camera-episode-counts-20261028.csv).
- [Mức lặp ảnh/identity qua episode](camera-episode-reuse-20261028.csv).
- Runner `scripts/research/audit_camera_metadata.py`; test `scripts/research/test_camera_metadata.py` trong workspace ứng dụng.

Hai test metadata mới kiểm tra parser không bịa camera và giữ missingness; cả bộ sáu test research pass. Output nguồn `.tmp/camera-metadata-20261028/`; không ghi ảnh, embedding hoặc ID người vào các file tổng hợp trong docs.

```powershell
& 'D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr/.venv/Scripts/python.exe' -m pytest scripts/research -q
& 'D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr/.venv/Scripts/python.exe' scripts/research/audit_camera_metadata.py --research-root D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr --out .tmp/camera-metadata-reproduction
```
