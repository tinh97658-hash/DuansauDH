# Phân rã FNIR và so sánh quality–score có khoảng tin cậy

Ngày: 28/10/2026. Trạng thái: phân tích post-hoc trên embedding đã lưu, N=300, năm episode seed 2026–2030. Không model inference, học mô hình, chọn lại ngưỡng hay truy cập job cloud. Không thay số trong bản thảo cũ.

## 1. Nguồn và kiểm tra tương thích

Chỉ dùng family `outputs/risk_coverage_qmul/` trong research repo để khôi phục episode từ cached embeddings `all_flip.npz`. Dùng nguyên cutoff trong `openset_curves.csv`, không ước lượng lại. Các hàm tạo episode và score được đọc từ source hiện có.

- 30 AURC checks khớp artifact cũ: hai split × năm seed × ba cách sắp thứ tự.
- 30 operating-point rows khớp FNIR/FPIR cũ: hai split × năm seed × ba policy; tổng cộng 60 scalar comparisons cho FNIR và FPIR.
- Ba policy được phân rã: base; gap coverage-target=0,6; min-side coverage-target=0,6. Target này chọn quality cutoff trước đó, không phải coverage test thực tế.
- Mỗi episode N=300 có 600 mated và 300 unknown probes. Một unknown probe/identity trong family này; không trộn với family development mới chia unknown calibration/validation.

Provenance và SHA-256 đầu vào: `.tmp/research-evidence-20261028/provenance.json`. Hash được tính lúc phân tích; không thay thế provenance của lần chạy gốc. Chương trình dừng nếu kết quả cached-score không tái hiện được aggregate cũ trong tolerance 5e-7.

## 2. Phân rã FNIR

Trên cùng probe và ranking cố định:

```text
FNIR = tỷ lệ xếp sai top-1 + tỷ lệ xếp đúng top-1 nhưng reject
```

Hạng đầu bao gồm cả wrong-ID accepted và wrong-ID rejected. Hai nhóm này tách riêng trong CSV để không nhầm chúng với false identifications trên người ngoài gallery. Hạng thứ hai có thể do score threshold hoặc quality gate.

| Split/policy | Sai rank-1 | Đúng rank-1 nhưng reject | FNIR | FPIR quan sát |
|---|---:|---:|---:|---:|
| Dev/base | 0,6807 | 0,1873 | 0,8680 | 0,0100 |
| Dev/gap | 0,6807 | 0,2277 | 0,9083 | 0,0093 |
| Dev/min-side | 0,6807 | 0,2133 | 0,8940 | 0,0067 |
| Test/base | **0,6360** | **0,2113** | **0,8473** | **0,0067** |
| Test/gap | 0,6360 | 0,2300 | 0,8660 | 0,0027 |
| Test/min-side | 0,6360 | 0,3080 | 0,9440 | 0,0040 |

Các giá trị là trung bình tỷ lệ qua năm episode. Ở test/base, khoảng **75,1% tổng lỗi FNIR** thuộc nhóm sai ranking, 24,9% thuộc nhóm đúng ranking nhưng reject. Đây là tỷ số tổng hai hạng lỗi qua các episode có cùng số probe, không phải tỷ lệ mẫu độc lập mới. Cả năm test seeds của base đều có hạng ranking lớn hơn hạng rejection.

Kết luận được hỗ trợ: ranking chiếm phần lỗi lớn hơn trong các operating points được kiểm tra. Không kết luận rejection không đáng kể: nó vẫn đóng góp 21,13 điểm phần trăm ở test/base. Không suy ra nguyên nhân riêng là architecture, alignment hay mất thông tin; chưa có can thiệp cô lập các yếu tố đó.

Thêm quality gate làm tăng đúng-rank-bị-reject khi score threshold giữ nguyên. Điều này phù hợp tính chất tập con của accept set, không phải một phát hiện bất ngờ về thuật toán.

## 3. Khoảng tin cậy AURC ghép cặp

Bootstrap 2.000 lần, seed 2026. Có 400 mated identities khác nhau khi lấy hợp năm gallery. Mỗi lần lấy mẫu danh tính một lần, giữ cùng multiplicity của identity qua mọi seed/policy, tính lại AURC rồi lấy trung bình đều qua năm episode. Không coi 3.000 lần xuất hiện probe là 3.000 quan sát độc lập.

Đây là CI percentile 95% **điều kiện trên gallery, model, cutoff và năm episode hiện có**, không bao gồm bất định học model, lấy lại gallery hoặc refit cutoff. Các CI là pointwise, chưa hiệu chỉnh nhiều so sánh. Random reference là kỳ vọng AURC của thứ tự probe ngẫu nhiên đều, bằng full-coverage error; không phải baseline random theo block identity.

Quy ước: `difference = AURC trái − AURC phải`; âm là bên trái tốt hơn. Bảng sau dùng thứ tự stable như artifact cũ:

| Split | So sánh | Chênh lệch | CI 95% |
|---|---|---:|---:|
| Dev | gap − score | +0,2595 | [+0,2348; +0,2834] |
| Dev | min-side − score | +0,2605 | [+0,2312; +0,2904] |
| Dev | gap − random reference | −0,0318 | [−0,0546; −0,0094] |
| Dev | min-side − random reference | −0,0308 | [−0,0550; −0,0049] |
| Test | gap − score | **+0,2454** | **[+0,2207; +0,2672]** |
| Test | min-side − score | +0,2592 | [+0,2277; +0,2898] |
| Test | gap − random reference | −0,0412 | [−0,0632; −0,0205] |
| Test | min-side − random reference | −0,0274 | [−0,0513; −0,0014] |

Score − random reference trên test là −0,2866, CI [−0,2971; −0,2738]. Như vậy quality proxy có tín hiệu selective hơn random reference trong phân tích pointwise này, nhưng score có tín hiệu mạnh hơn nhiều. Không viết “quality vô ích”.

### Độ nhạy với điểm trùng nhau

Đã tính thêm kỳ vọng AURC khi hoán vị đều các mẫu cùng giá trị key. Điều này bỏ phụ thuộc thứ tự đầu vào trong các nhóm cùng kích thước hoặc gap bằng nhau. Không thay score hoặc chọn cutoff mới.

- Test gap − score: +0,2468, CI [+0,2227; +0,2673].
- Test min-side − score: +0,2603, CI [+0,2292; +0,2902].
- Test min-side − random reference: −0,0263, CI [−0,0506; −0,0009].

Hai cách xử lý ties giữ kết luận score tốt hơn hai proxy trong điều kiện phân tích. So sánh min-side với random ở sát 0, nhạy với nhiều so sánh và protocol; chưa nhận là kết luận confirmatory. Bootstrap thay đổi trọng số probe theo identity nhưng không tái tính feature gap hoặc gallery neighbor.

## 4. FPIR thấp cần báo bất định

Test/base có số false identifications theo seed là 0, 6, 2, 1, 1 trên 300 unknown probes/episode. Không gộp chúng thành một thử nghiệm với 1.500 unknown độc lập vì identities/probes có thể xuất hiện lại giữa seeds.

Tại seed 2026, 0/300 có Wilson CI 95% xấp xỉ [0; 1,264%], thay vì bootstrap suy biến [0;0]. Tại seed 2027, 6/300=2,0%, Wilson CI xấp xỉ [0,920%; 4,294%]. Đây là khoảng pointwise theo episode, có điều kiện trên gallery; mô hình binomial giả định probes có thể xem là độc lập. Nếu có phụ thuộc camera/session, khoảng này vẫn có thể lạc quan và cần phân tích cluster thích hợp.

Việc cutoff đạt target dev 1% không chứng minh test FPIR luôn dưới 1%. Các policy gap/min-side có FPIR quan sát khác base nên bảng FNIR không phải so sánh matched-risk.

## 5. Cập nhật kết luận bài báo

Có thể viết: “Trong protocol N=300 đã khảo sát, sai ranking chiếm phần lớn FNIR; tuy vậy rejection còn đóng góp đáng kể. Quality discrepancy và kích thước có thông tin selective hạn chế so với score; kết luận này giữ trong phân tích bootstrap theo identity và hai cách xử lý ties, có điều kiện trên các gallery cố định.”

Chưa được viết: quality-aware methods nói chung không hiệu quả; score tốt hơn mọi FIQA; calibration không còn vai trò; teacher reliability đã được kiểm chứng; hay kết quả tổng quát giữa camera/dataset.

Phần còn thiếu trước kết luận rộng: camera/session metadata và dependence audit; fixed-probe nested-gallery protocol; các đối chứng ở operating risk tương đương chọn trên development; kiểm tra ngoài surveillance domain hiện tại. Không dùng test hậu kiểm để chọn lại policy.

Cập nhật: [audit camera/session](audit-camera-session-20261028.md) đã hoàn tất. Nó xác nhận lặp ảnh giữa seeds, thiếu session và namespace camera chưa được xác minh; vì vậy CI hiện tại vẫn chỉ được diễn giải có điều kiện trên gallery. Các giới hạn fixed-probe/matched-risk/external domain còn nguyên.

## 6. Artifact và tái lập

- [30 hàng phân rã FNIR và count FPIR](fnir-decomposition-20261028.csv).
- [20 hàng paired AURC CI, gồm hai cách xử lý ties](paired-aurc-ci-20261028.csv).
- Runner: `scripts/research/analyze_frozen_evidence.py` trong workspace ứng dụng.
- Kiểm tra: `scripts/research/test_frozen_evidence.py`, bốn test pass; kiểm tra phân hoạch lỗi, phép tính ties với hoán vị đầy đủ, bootstrap giữ identity qua seeds và zero-event uncertainty.

Chạy tại workspace ứng dụng với Python environment nghiên cứu đã có numpy/pytest và dependencies đọc artifact:

```powershell
& 'D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr/.venv/Scripts/python.exe' -m pytest scripts/research/test_frozen_evidence.py -q
& 'D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr/.venv/Scripts/python.exe' scripts/research/analyze_frozen_evidence.py --research-root D:/Thigiacmaytinh/face-attendance/single-shot-open-set-fr --out .tmp/research-evidence-reproduction --replicates 2000
```

Output phải là thư mục mới; script không ghi đè artifact nguồn. CSV công khai trong docs chỉ chứa số tổng hợp/seed, không chứa ảnh, embedding, ID người hay đường dẫn từng probe.
