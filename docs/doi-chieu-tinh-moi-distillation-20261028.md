# Đối chiếu tính mới và đề cương phương pháp distillation

Ngày: 28/10/2026. Vòng rà soát 2. Phạm vi: single-shot enrollment, single-image probe, nhận diện mở 1:N trên ảnh mặt nhỏ. Đây là thiết kế nghiên cứu, chưa có kết quả thực nghiệm mới.

## 1. Kết luận và điều chỉnh hướng

Chưa có cơ sở nhận tổ hợp “reliability weighting + open-set loss + gallery size” là thuật toán mới. Từng ý tưởng đã có đối thủ gần. **Chốt hướng kiểm chứng hẹp hơn: khi teacher cung cấp quan hệ danh tính sai, việc chặn riêng tín hiệu distillation sai có cải thiện FNIR ngoài lợi ích của supervised open-set loss không?**

N được giữ như biến kiểm tra khả năng tổng quát. Chưa thêm loss theo N khi chưa chứng minh cơ chế cần thiết. PETALface là đối chứng thích nghi chất lượng; không bắt buộc gắn thêm hai adapter vào phương pháp để tạo tên mới.

Đề cương ở mục 6 thay phần phác thảo `L_tail` của vòng rà soát 1 làm hướng ưu tiên. Phương án cũ được giữ làm lịch sử giả thuyết, không phải đặc tả triển khai.

## 2. Đọc sâu ba đối thủ chính

### 2.1. EKD: thực chất đã chuyển quyết định so với ngưỡng

[EKD, CVPR 2022](https://arxiv.org/pdf/2206.02325), mục 3.1–3.2, Eq. 4–12: teacher/student có ngưỡng riêng từ negative-pair scores, cập nhật EMA; chuyển số ngưỡng mà một similarity vượt qua bằng sigmoid. Positive/negative loss tách riêng, thêm ArcFace. Đây là pairwise FPR/TPR, chưa đồng nhất với FPIR của cực đại một lượt search.

Dạng rút gọn để đối chiếu:

```text
R_m(i,j) = sum_k sigmoid((s_m(i,j) - tau_m,k) / t)
L_EKD ~ mean (R_student - R_teacher)^2
```

[Mã chính thức đã đọc](https://github.com/Tencent/TFace/blob/171ec1434aca0972e111663ac646c9c1e3e44b5b/recognition/tasks/ekd/distillation/ekd.py): `relative_loss` dùng MSE rank-count; negative selection theo score student. Eq. 7 chỉ là bước trung gian, không phải loss cuối. Chi tiết chọn ngưỡng theo index sẽ trùng index khi quá ít negatives; EMA không tạo thêm mẫu đuôi độc lập.

**Hệ quả cho đề xuất:** đổi pair score thành max-gallery score nhưng vẫn chuyển sigmoid-relative-to-threshold là biến thể gần EKD. Phải chứng minh phần mới vượt EKD thích nghi cho episode.

### 2.2. IDL/RTM: đã có episode và giảm score người lạ

[Open-Set Biometrics, ECCV 2024](https://arxiv.org/html/2407.16133v1), mục 3.3–3.4, Eq. 7–13: IDL tối ưu tích detection và identification; RTM giảm softmax-weighted negative similarity. Gallery/probe được tạo trong batch, có mated/nonmated. Không có teacher.

```text
L_IDL = -mean_mated(S_detection * S_identification)
L_RTM = mean_unknown sum_j softmax(s_unknown,j) * s_unknown,j
```

[Mã công bố đã đọc](https://github.com/prevso1088/open-set-biometrics/blob/76ea4290567c2f4fd428e83306c6507ac08056ba/opengait/modeling/losses/open_set.py) là triển khai OpenGait: gallery trung bình nhiều sequence, score `1/(1+d)`, trọng số `softmax(-d)`. Nó không phải bản cosine single-image face loss dùng nguyên xi. Chuyển sang one-image gallery phải ghi là adaptation và kiểm tra parity phần mục tiêu.

**Hệ quả:** “ép unknown score xuống” chưa mới; loss KD mới phải hơn `EKD + IDL/RTM`, không chỉ hơn ArcFace. Không mô tả RTM là một phép `max` chính xác.

### 2.3. AIRD: instance KD không chỉ là MSE embedding

[AIRD](https://arxiv.org/html/2409.02049v1), mục III-B, Eq. 2–7: instance branch dùng target/non-target KL; relation branch dùng quan hệ teacher và quan hệ teacher–student với contrastive objective. Mục III-C thêm FaceBN cập nhật thống kê từ test batches.

**Hệ quả:** baseline “MSE + pair cosine” không phải reproduction đầy đủ AIRD. Chạy ablation KD với BN cố định và AIRD đầy đủ phải báo riêng. Online adaptation có phụ thuộc batch/order/reset, khác protocol inference cố định của nghiên cứu này.

## 3. Mở rộng prior art: độ tin cậy, chọn lọc và gallery

| Nguồn chính | Điều đã có | Ranh giới cần giữ |
|---|---|---|
| [Selective KD, TIP 2019; online 2018](https://imsg.ac.cn/pdfs/2019-TIP-Low-Resolution%20Face%20Recognition%20in%20the%20Wild%20via%20Selective%20Knowledge%20Distillation.pdf) | Chọn đặc trưng thông tin bằng sparse graph cho LRFR | Không gọi “chỉ chuyển kiến thức hữu ích” là đóng góp mới |
| [BEA-KD, CVPR 2023](https://openaccess.thecvf.com/content/CVPR2023/papers/Xu_Probabilistic_Knowledge_Distillation_of_Face_Ensembles_CVPR_2023_paper.pdf) | Distill ensemble xác suất, aleatoric/epistemic uncertainty | OOD faceness không tự chứng minh unknown-person rejection 1:N |
| [AdaDistill, ECCV 2024](https://arxiv.org/html/2407.01332v1) | Class-center KD điều chỉnh theo tiến bộ student | Student capacity/progress khác teacher correctness |
| [Rethinking Feature-Based KD, CVPR 2023](https://openaccess.thecvf.com/content/CVPR2023/html/Li_Rethinking_Feature-Based_Knowledge_Distillation_for_Face_Recognition_CVPR_2023_paper.html) | Reverse distillation và student proxy xử lý intrinsic gap | Teacher tốt chưa chắc tạo target dễ học |
| [LUD, Scientific Reports 2024](https://www.nature.com/articles/s41598-024-82647-6) | Mask uncertainty, correlation loss, adaptive temperature cho KD | Đây là prior art KD tổng quát, không phải bằng chứng hiệu quả single-shot face 1:N |
| [Gallery-size study, Applied Sciences 2022](https://www.mdpi.com/2076-3417/12/21/11144) | Ảnh hưởng gallery size lên rank-1 và ROC | Kết luận về pairwise ROC/EER không thay kết luận về search-level FPIR |
| [Same-Identity Crowd, ICCVW 2025](https://openaccess.thecvf.com/content/ICCV2025W/CV4BIOM/html/Bhatta_Are_you_In_or_Out_of_gallery_Wisdom_from_the_ICCVW_2025_paper.html) | Ranks của ảnh bổ sung cùng identity để dự đoán in/out gallery | Cần nhiều enrolled images; không dùng nguyên protocol trong single-shot |
| [Rank-1 Identity Consensus, preprint 07/2026](https://arxiv.org/html/2607.12903v1) | Đồng thuận rank-1 giữa matcher; kiểm tra biến thiên chất lượng/gallery | Đồng thuận có thể cùng sai; không coi TTA cùng backbone là matcher độc lập |

Mức đọc khác nhau được ghi trong CSV: ba bài mục 2 đã đọc phần phương pháp; một số nguồn mở rộng mới đọc abstract/method overview. Không nhận tất cả 20 bài là đã full-text review.

Kiểm tra thêm mục III-A của bài Rank-1 Consensus: nhánh image-depth có một ảnh/identity tại N=12.926, còn nhánh thay số identity dùng hai ảnh/identity. Vì vậy single-image enrollment cũng có tiền lệ trong công trình này; sự khác biệt cần đối chiếu ở toàn bộ protocol và mục tiêu, không chỉ từ khóa single-shot. Probe suy giảm ở đó được tạo bằng blur/downsample từ ảnh tốt, cần phân biệt với native LR.

**Sửa niên đại:** [Bridge Distillation bản tác giả](https://imsg.ac.cn/pdfs/2020-TIP-Efficient%20Low-Resolution%20Face%20Recognition%20via%20Bridge%20Distillation.pdf) ghi IEEE TIP 29 (2020), DOI `10.1109/TIP.2020.2995049`. Upload arXiv năm 2024 không làm nó thành công nghệ xuất bản 2024.

## 4. Đã có → khác biệt ứng viên → bằng chứng cần có

| Đã có | Khác biệt chỉ được coi là ứng viên | Cách kiểm chứng | Bác bỏ khi |
|---|---|---|---|
| PETALface/NAM: quality-conditioned adaptation | Reliability theo đúng/sai quan hệ teacher tại target đang chuyển | Cùng dữ liệu/adapter; IQA gate vs correctness gate vs random gate | Lợi ích chỉ do loại ảnh mờ hoặc thêm tham số |
| EKD: threshold-relative rank transfer | Chặn target KD sai nhãn nhưng giữ task loss cho chính mẫu đó | EKD vs gated EKD; phân tích teacher/student disagreement | Chỉ tăng rank-1; FNIR không hơn ở risk so sánh được |
| IDL/RTM: supervised open-set objective | Giá trị gia tăng của teacher sau khi đã tối ưu open-set | IDL/RTM vs EKD+IDL/RTM vs gated EKD+IDL/RTM | Supervised open-set loss giải thích toàn bộ lợi ích |
| AIRD: logits + cross-resolution relation KD | Sai target và thiếu thông tin LR là hai nguyên nhân riêng | Ablation target đúng/sai; native LR vs synthetic LR | Gating chỉ che domain mismatch |
| BEA-KD/LUD: uncertainty-aware KD | Kiểm tra correctness của quan hệ danh tính thay vì chỉ confidence | Confident-wrong / uncertain-correct strata; uncertainty gate baseline | Confidence đơn giản đã đủ giải thích |
| Gallery studies/consensus: thay đổi N và chất lượng | Độ ổn định lợi ích của correction theo N giữ lại trước | Gallery lồng nhau; cùng probe pool; N chưa dùng chọn hệ số | Chỉ thắng N dùng để chọn policy |

Khoảng trống còn lại là **bằng chứng cơ chế và giá trị gia tăng trong giao điểm protocol này**. Đây chưa phải chứng minh một công thức mới.

## 5. Các điểm yếu của phác thảo loss vòng 1

### 5.1. Teacher sai trên LR không đủ để loại target HR

Nếu target thực sự là `T(HR)`, việc `T(LR)` sai chính là một lý do dùng cross-resolution KD. Không được bỏ target HR đúng chỉ vì teacher trên LR sai. Reliability phải đánh giá **đúng target/quan hệ được chuyển**.

Nếu native LR không có ảnh HR ghép cặp, target HR cùng mẫu không tồn tại. Phải báo đây là nhánh dữ liệu khác; resize hoặc SR không tạo ground truth HR.

### 5.2. Sigmoid-relative-to-own-threshold không chứng nhận an toàn

Phác thảo cũ dùng `p_m = sigmoid((a_m-tau_m)/T_m)`. Nếu score và cutoff cùng dịch c, p không đổi. Vì thế loss nhỏ có thể đồng tồn tại với drift của score khi triển khai bằng cutoff đã đóng băng. So percentile của hai phân phối đã tự hiệu chỉnh không thay được đo FPIR trên unknown độc lập.

Ví dụ đại số: `(a,tau)=(0.60,0.65)` và `(0.80,0.85)` có cùng hiệu -0.05. Với cutoff triển khai 0.65, hai score dẫn đến quyết định khác nhau. Đây là phản ví dụ cho cách diễn giải loss, không phải số liệu thực nghiệm.

### 5.3. Reliability “top-1 đúng” không áp dụng cho unknown

Unknown không có correct gallery ID. Phải dùng ground-truth quan hệ âm hoặc quyết định từ chối tại cutoff đã xác định. Top-1 consistency đơn độc không kiểm chứng đúng/sai.

### 5.4. Hạ mọi similarity tạo lời giải từ chối tất cả

Task loss có nhãn và FNIR phải tồn tại độc lập với KD gate. Nếu tắt cả task loss của mẫu khó cùng với KD, cải thiện có thể chỉ là curriculum/discard; không chứng minh giảm negative transfer.

### 5.5. Chỉ chuyển quyết định unknown cũng bỏ mất cấu trúc

Một scalar max-score không nói identity nào tạo ra nhầm lẫn. Hai model có cùng max nhưng khác top-1/top-2 và cấu trúc mated. Không bỏ relation/identity supervision rồi kỳ vọng tail loss tự giải quyết nhận diện.

## 6. Đề cương phương pháp tối thiểu, phiên bản 0.2

### 6.1. Giả thuyết và phạm vi

**H:** Giữ loss nhận diện và open-set cho mọi mẫu, nhưng chặn teacher relations sai nhãn trong KD, sẽ giảm negative transfer và giảm FNIR hơn EKD+IDL/RTM ở FPIR quan sát tương đương.

Tạm gọi là *label-checked relational distillation* để mô tả thao tác, chưa đặt tên thuật toán. Không nhận correctness gate là mới; mục tiêu là kiểm tra giả thuyết trước khi đầu tư kiến trúc.

Một ảnh đăng ký/người; một ảnh probe/lượt. Dữ liệu train có thể nhiều ảnh/identity khác; identity train/dev/evaluation tách nhau. Không có online BN update hay thêm probe vào gallery.

### 6.2. Loss để kiểm chứng, chưa phải đặc tả production

Với cặp train `(i,j)`, `y_ij=1` nếu cùng identity, ngược lại `0`:

```text
b_T,ij,k = 1[s_T(i,j) >= tau_T,k]
v_ij,k = stopgrad(1[b_T,ij,k == y_ij])
d_ij,k = sigmoid((s_S(i,j)-tau_S,k)/t)
          - stopgrad(sigmoid((s_T(i,j)-tau_T,k)/t))

L_checked = mean_pairs (sum_k v_ij,k * d_ij,k)^2
L = L_identity + lambda_open * (L_IDL + eta * L_RTM)
               + lambda_KD * L_checked
```

`s_T` được tính trên ảnh thực sự tạo target teacher; `s_S` trên đầu vào student tương ứng. Mỗi model tạo pair similarity trong không gian riêng; không lấy dot product teacher–student trực tiếp. Nếu dùng HR/LR tổng hợp, phép biến đổi phải bảo toàn identity.

tau là train-only anchors với lịch EMA/stop-gradient như baseline đã chốt; chúng không phải ngưỡng triển khai. Ước lượng độ tin cậy và chọn biến thể trên dev phải báo exploratory. Nhãn test không xuất hiện trong gate.

Đây là biến thể gần EKD. Công thức giữ tổng-threshold trước bình phương để khi `v=1` có cấu trúc rank-count như EKD; không âm thầm đổi sang MSE từng ngưỡng rồi nhận mọi chênh lệch là do gate. Các trọng số pos/neg, hard-negative indices và nhiệt độ giữ cùng baseline. Chi tiết adaptation face IDL/RTM phải ghi riêng như mục 2.2.

Chuẩn hóa theo toàn bộ số cặp, không chia riêng số cặp được giữ: gate ít cặp sẽ giảm tổng gradient KD. Vì vậy **đối chứng scale-matched là bắt buộc**. Với từng lớp pos/neg, giảm lambda của ungated baseline theo tỷ lệ được giữ bằng stop-gradient; thêm random gate có cùng số lượng theo lớp/anchor. Nếu không thắng các đối chứng này, chỉ kết luận giảm cường độ KD hữu ích.

Nhiều ngưỡng cho positive/negative có thể làm gate lệch phân phối. Báo tỷ lệ giữ theo nhãn, anchor, chất lượng và camera. Phải kiểm tra mọi-gate-zero trả `L_checked=0` hữu hạn; identity/open-set loss vẫn cập nhật.

### 6.3. Nhóm đối chứng ưu tiên

| Mã | Cấu hình | Câu hỏi |
|---|---|---|
| C0 | Supervised identity loss | Mốc không KD |
| C1 | Identity + IDL/RTM | Open-set supervision tự nó làm được gì? |
| C2 | Identity + EKD | Giá trị của transfer đã có |
| C3 | Identity + EKD + IDL/RTM | Đối thủ chính của H |
| C4 | C3 + random gate/scale-matched KD | Lợi ích có phải chỉ do giảm gradient KD? |
| C5 | C3 với correctness gate như trên | Kiểm tra H |
| C6 | C3 với confidence/IQA gate | Correctness có thêm giá trị so với proxy? |

PETALface, AIRD và BEA-KD là đối chứng mở rộng, báo riêng nếu khác backbone/pretraining hoặc adaptation regime. Không cần ghép mọi phương pháp vào một mô hình.

### 6.4. Phân tích cơ chế

Tạo strata bằng teacher target và nhãn: teacher đúng/student sai; teacher sai/student đúng; cùng đúng; cùng sai. Kết hợp target confidence cao/thấp. Báo số mẫu và số identity mỗi nhóm; dùng strata để giải thích, không chỉ báo nhóm thắng.

Teacher sai/student đúng là nhóm quan trọng: KD có kéo student từ đúng sang sai không? Đề xuất đo hướng cập nhật của gradient KD với gradient task trên cùng mẫu/quan hệ ở một snapshot cố định. Cosine gradient âm là chỉ báo xung đột cục bộ; không tự chứng minh nguyên nhân của lỗi cuối cùng. Can thiệp gate và scale-matched baseline mới cung cấp bằng chứng mạnh hơn.

Kiểm tra target correctness và student outcome trên native LR; synthetic LR chỉ là nhánh cơ chế bổ sung. Không chứng minh tổng quát bằng việc chỉ dùng cặp suy giảm từ ảnh rõ.

## 7. Protocol để lợi ích không đến từ đổi gallery hoặc ngưỡng

- Chọn trước một tập gallery IDs lớn nhất và một nhóm mated/unknown probe cố định. Tạo gallery nhỏ bằng thêm/bớt distractor; giữ identity mate của các mated probes trong mọi gallery. Không để người đang là mate biến thành unknown khi đổi N trong thí nghiệm cô lập N.
- Protocol episode hiện có có thể đổi đồng thời gallery composition và probe pool. Báo nó như thí nghiệm tổng thể khác; không gọi toàn bộ chênh lệch là causal effect của N.
- Tách hai bài đo: cutoff recalibrated riêng mỗi N bằng calibration độc lập; và cutoff chốt tại N tham chiếu rồi chuyển sang N khác. Báo FNIR, FPIR thực tế và số false identifications cho cả hai.
- Chọn policy/hyperparameters trên dev; giữ lại camera hoặc N từ trước nếu đủ dữ liệu. Không gọi N giữ lại là unseen nếu vẫn dùng nó để chọn cấu hình.
- Với pseudo-unknown train, danh tính chỉ vắng trong gallery episode, vẫn có thể là class của classifier train. Unknown evaluation phải là danh tính chưa dùng học phương pháp.
- CI ghép cặp theo identity; seed SD chỉ đo biến thiên episode. Không tăng cỡ mẫu độc lập bằng cách lặp probe qua nhiều gallery.
- Primary outcome: FNIR tại target FPIR 1% từ calibration và validation FPIR quan sát, thêm đường DET chẩn đoán. Chỉ so “cùng risk” khi operating points thực tế đủ tương đương với bất định được báo.

## 8. Tiêu chí quyết định

**Tiếp tục phương pháp** nếu C5 hơn C3 và C4 ở risk so sánh được, ổn định qua episode/điều kiện giữ lại, và giảm sai trong nhóm teacher-wrong/student-correct mà không làm mất quá nhiều teacher-correct/student-wrong corrections.

**Chuyển sang bài phân tích** nếu hiệu quả chủ yếu do KD weight, threshold recalibration, hoặc không tổng quát sang native LR. Có thể có đóng góp thực nghiệm dù công thức gate không mới, nhưng cần độ phủ dữ liệu và phân tích đủ mạnh; không bảo đảm khả năng nhận đăng Q3.

**Chưa triển khai thuật toán “N-aware” mới** chỉ từ phản ứng của max-score khi tăng N. Chỉ mở rộng khi baseline và thí nghiệm giữ probe cố định chỉ ra lỗi mà các phương pháp đã có không xử lý được.

## 9. Nhật ký rà soát và giới hạn

Nguồn truy xuất ngày 28/10/2026. Các truy vấn chính:

```text
face recognition distillation teacher reliability
face recognition distillation confidence-aware
face recognition selective teacher knowledge distillation
face knowledge distillation uncertainty teacher
face identification gallery size threshold calibration
open-set face distillation reliability
```

Đã theo citation/related-work đến SKD, BEA-KD, AdaDistill và Rethinking Feature-Based KD; so công thức EKD PDF trang 4–5 và source `ekd.py`; so IDL/RTM Eq. 7–13 với `open_set.py`; đọc AIRD III-B/III-C.

Snapshot mã được ghim bằng commit trong link; mã chỉ được đọc, không chạy. Mã open-set công bố tập trung OpenGait, không mặc định là face recipe. Nguồn full text bị web chặn được đọc bằng bản arXiv hoặc PDF tác giả khi có; không suy ra cơ chế chưa đọc từ kết quả tìm kiếm.

Ma trận mở rộng có 20 bài với mức đọc minh bạch. Đây vẫn là focused review, chưa có quy trình systematic review, citation coverage đầy đủ hoặc chứng minh sự vắng mặt của nghiên cứu tương đương. Các bài few-shot/open-set mới và reliability KD ngoài miền còn cần citation chaining trước khi claim novelty.
