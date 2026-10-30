# PETALface, distillation và khoảng trống cho single-shot open-set face identification

Ngày rà soát: 28/10/2026. Trạng thái: phân tích tài liệu và thiết kế giả thuyết; chưa có thuật toán được kiểm chứng hoặc kết quả thực nghiệm mới.

**Cập nhật vòng 2:** [Đối chiếu công thức và đề cương v0.2](doi-chieu-tinh-moi-distillation-20261028.md) thu hẹp giả thuyết về teacher relations sai; đề cương mới thay phần `L_tail` ở mục 6 làm hướng ưu tiên. Ma trận đã mở rộng từ 12 lên 20 công trình. Chưa xác nhận tính mới của tổ hợp phương pháp.

**Kế hoạch bài báo hiện tại:** [Đề cương thực nghiệm và tiêu chí đủ bằng chứng](de-cuong-bai-bao-thuc-nghiem-20261028.md), kèm [bảng bằng chứng](bang-bang-chung-bai-bao-20261028.csv). Hướng bài chính là phân tích ranking/rejection/quality; teacher distillation giữ vai trò giả thuyết cho nghiên cứu riêng. Các số headline cũ đã được đối chiếu 49/49 kiểm tra; tiến độ phân rã lỗi và đối chứng thống kê được cập nhật dưới đây.

**Kết quả bổ sung:** [Phân rã FNIR và CI quality–score](ket-qua-phan-ra-fnir-aurc-20261028.md) đã hoàn tất hậu kiểm N=300 trên cached embeddings. Bảng bằng chứng hiện có 17 hàng; FNIR test/base phân rã thành 0,6360 sai ranking + 0,2113 đúng ranking nhưng reject. Paired AURC CI hỗ trợ score mạnh hơn hai quality proxy, với điều kiện gallery/model cố định.

**Audit metadata tiếp theo:** [Camera/session và vai trò nguồn](audit-camera-session-20261028.md) đã hoàn tất; bảng bằng chứng tăng lên 20 hàng. Chưa đủ metadata để claim physical-camera generalization; ưu tiên fixed-probe nested-gallery trên development thay cho global camera holdout.

## 1. Quyết định nghiên cứu đề xuất

Ưu tiên câu hỏi: **Khi ảnh rất nhỏ, distillation cải thiện thứ hạng danh tính có đồng thời giảm nhận nhầm người ngoài gallery không, và tác động này thay đổi thế nào theo số người trong gallery?**

PETALface là đối chứng cho thích nghi đặc trưng. Distillation là cơ chế chuyển kiến thức cần khảo sát. Đóng góp tiềm năng phải thể hiện ở cách kiểm soát rủi ro nhận nhầm trong single-shot 1:N, cùng bằng chứng tách biệt tác dụng của từng thành phần.

Đây là khoảng trống ứng viên trong phạm vi tài liệu đã xem, chưa phải kết luận chưa có ai giải quyết. Không sử dụng “first”, “novel” hoặc “state of the art” trong bản thảo từ tài liệu này.

Phân tích này độc lập với job cloud hiện có. Không truy cập tài khoản, thay đổi recipe, tải checkpoint hay chạy thực nghiệm.

## 2. PETALface giải quyết gì?

[PETALface, WACV 2025](https://arxiv.org/html/2412.07771v1), mục 3.2, dùng backbone cố định và hai LoRA được phối hợp theo CNN-IQA; có thích nghi ở attention và tầng chiếu cuối. Mục 4.2 đã đánh giá open-set TPIR@FPIR trên IJB-S, gồm surveillance-to-single ở phụ lục. Mục 7 thừa nhận hạn chế của IQA và quy tắc phối hợp thủ công. Vì vậy, quality gating và thêm open-set đều đã có tiền lệ.

[Repo chính thức](https://github.com/kartik-3004/PETALface) cung cấp mã nguồn. Cần kiểm tra phiên bản mã và checkpoint trước khi tái lập.

Nhận định áp dụng cho dự án:

- Một ảnh gallery/người không ngăn việc dùng nhiều ảnh của các danh tính khác trong tập phát triển phương pháp. Phải phân biệt single-shot enrollment với one-shot training.
- Hai nhánh cho chất lượng khác nhau chỉ có ích nếu chúng tạo đặc trưng tương thích để so khớp. Không được tự ghép embedding từ hai mô hình huấn luyện độc lập.
- Adapter ít tham số cần cập nhật vẫn phải chạy backbone. Phải đo toàn bộ bộ nhớ và thời gian, kể cả IQA.
- IQA dự đoán độ đẹp/nét chưa chắc dự đoán khả năng phân biệt danh tính. Cần đối chứng với feature norm, kích thước mặt và một nhánh cố định.
- Chuyển ý tưởng sang CNN R50 là một biến thể triển khai; chưa tự tạo thành đóng góp khoa học.

## 3. Các loại distillation và đối thủ phải xem xét

| Phương pháp | Kiến thức được chuyển | Điều phải đối chứng |
|---|---|---|
| [Bridge Distillation, IEEE TIP 2020](https://imsg.ac.cn/pdfs/2020-TIP-Efficient%20Low-Resolution%20Face%20Recognition%20via%20Bridge%20Distillation.pdf) | Hai bước: chuyển miền HR, rồi thích nghi LR tổng hợp | So với KD một bước và cùng nguồn dữ liệu; upload arXiv năm 2024 không phải năm xuất bản |
| [CCFace, IJCB 2023](https://arxiv.org/abs/2308.09230) | Classifier consistency, angular penalty và học bất đối xứng giữa độ phân giải | Không nhận classifier sharing hoặc cross-resolution consistency là mới |
| [AIRD, arXiv 2024](https://arxiv.org/html/2409.02049v1) | Instance + relation KD; FaceBN thích nghi bằng thống kê khi inference | Tách KD khỏi online adaptation; FaceBN cần protocol dòng dữ liệu riêng |
| [Generative–Discriminative KD, ICASSP 2025](https://arxiv.org/abs/2409.06371) | Teacher sinh từ encoder diffusion SR; teacher phân biệt từ recognizer | Không đánh đồng dùng encoder generative lúc học với phục hồi ảnh bằng diffusion lúc chạy |
| [EKD, CVPR 2022](https://openaccess.thecvf.com/content/CVPR2022/html/Huang_Evaluation-Oriented_Knowledge_Distillation_for_Deep_Face_Recognition_CVPR_2022_paper.html) | Ưu tiên quan hệ mẫu ảnh gây khác biệt TPR/FPR giữa teacher và student | Đối thủ bắt buộc của mọi ý tưởng “KD theo chỉ số đánh giá” |
| [Grouped KD, AAAI 2023](https://ojs.aaai.org/index.php/AAAI/article/view/25472) | Nhóm logits để chọn kiến thức phân loại cần chuyển | Đuôi logits nhỏ của classifier khác đuôi cosine cao của impostor trong gallery |

Các câu hỏi phân tích của dự án:

1. Teacher có thực sự phân biệt tốt hơn trên các mức suy giảm đang xét không?
2. Khớp embedding chính xác có ép student học lỗi của teacher không?
3. Bảo toàn quan hệ giữa các danh tính có hiệu quả hơn khớp từng embedding không?
4. Tăng rank-1 có đồng thời kéo score cực đại của người lạ lên không?
5. Suy giảm tổng hợp mô phỏng được camera nào, và thất bại ở camera nào?

Ảnh LR có sẵn không trở thành HR bằng resize. Nếu dùng HR→LR tổng hợp, phải ghi rõ ảnh nguồn và phép suy giảm; không gọi đó là cặp HR/LR camera thật. Nếu chỉ có native LR, cần thiết kế mục tiêu teacher phù hợp thay vì mặc định có supervision HR.

## 4. Các công trình chặn tuyên bố tính mới

### 4.1. Tối ưu trực tiếp open-set đã có

[Open-Set Biometrics, ECCV 2024](https://arxiv.org/html/2407.16133v1) mô phỏng gallery/probe trong minibatch, đề xuất Identification–Detection Loss và Relative Threshold Minimization. Công trình tối ưu cả định danh và score âm cực đại, dùng FNIR@FPIR. Đây là đối thủ trực tiếp của loss nhằm giảm false identification.

Hệ quả: phương pháp đề xuất phải thắng đối chứng open-set loss với cùng backbone và dữ liệu, không chỉ thắng cosine threshold.

### 4.2. Adapter + quality gating tiếp tục được nghiên cứu

[Center Aligned Representations and Local Margin Constraints, preprint 09/2026](https://arxiv.org/html/2609.01014v1) có LPM, NAM và QGP. Mục 3.4 dùng chất lượng để điều tiết adapter; mục 4.2 có open-set SurvFace tại FPIR 10%, 20%, 30%. QGP được áp dụng cho mixed/HQ, tắt trên các benchmark đồng nhất LQ trong thiết lập bài báo.

Hệ quả: “adapter thích ứng chất lượng cho ảnh mặt nhỏ” là vùng cạnh tranh cao. Không diễn giải việc QGP tắt trên một benchmark thành bằng chứng quality gating luôn vô ích.

### 4.3. Suy giảm phức tạp chưa chắc hữu ích

[Synthetic LR study, preprint 08/2026](https://arxiv.org/html/2608.06580v1) so sánh interpolation, KD, PDT, suy giảm kiểu Real-ESRGAN và SR front-end. Công trình ghi nhận khoảng cách synthetic–real; trong thiết lập của họ, SR học được không vượt direct-feed backbone mạnh.

Hệ quả: luôn giữ direct-feed và interpolation đơn giản làm đối chứng. Kết quả này chưa chứng minh SR hoặc KD thất bại trên mọi dataset.

## 5. Ba khoảng trống ứng viên

| Hướng | Câu hỏi có thể bác bỏ | Đối thủ gần nhất | Nhận định |
|---|---|---|---|
| A. Độ tin cậy teacher trong distillation 1:N | KD có trọng số theo khả năng phân biệt danh tính của teacher giảm lỗi ở FPIR cố định hơn KD không trọng số? | EKD, AIRD, CCFace; cần mở rộng tìm kiếm reliability-aware KD | Khả thi, nhưng trọng số confidence nói chung không mới |
| B. Rủi ro người lạ theo gallery size | Chuyển quan hệ score cực đại theo episode giảm độ lệch FPIR khi đổi N hơn pairwise EKD và open-set loss? | EKD, IDL/RTM | Có liên hệ rõ với mục tiêu ứng dụng; rủi ro trùng ý tưởng cao |
| C. Nghiên cứu thực nghiệm về chất lượng | Adapter/KD cải thiện rank-1 nhưng không cải thiện FNIR trong điều kiện nào? | PETALface, NAM, synthetic LR study | Phù hợp một bài phân tích nếu protocol, độ phủ và thống kê đủ mạnh |

Khuyến nghị vòng 1 là A+B; **vòng 2 thu hẹp A thành kiểm tra teacher relations sai và giữ N làm biến đánh giá**, theo đề cương liên kết ở đầu tài liệu. Giữ C là đầu ra phân tích bắt buộc. Không ghép thêm SR, transformer, uncertainty và calibration cùng lúc; sẽ không xác định được thành phần nào tạo lợi ích.

## 6. Phác thảo cơ chế để kiểm chứng A+B

Đây là thiết kế của dự án, chưa phải mô tả phương pháp từ các nguồn trên và chưa có bảo đảm tính mới.

### 6.1. Episode single-shot

Mỗi episode có một ảnh/gallery identity, mated probes và pseudo-nonmated probes có identity vắng khỏi gallery của episode. Các danh tính này chỉ thuộc tập học phương pháp; vai trò pseudo-nonmated không làm chúng trở thành người hoàn toàn chưa thấy trong quá trình học.

Teacher và student tạo gallery/probe riêng trong không gian embedding của chính mình. Chuẩn hóa từng embedding rồi so cosine; không so trực tiếp vector teacher với vector student nếu chưa có ánh xạ tương thích.

### 6.2. Chỉ chuyển tín hiệu teacher đáng tin

Với mẫu học i, xây trọng số r_i trong [0,1] từ:

- Teacher định danh đúng trong episode leave-one-image-out bằng nhãn train.
- Margin đúng-sai của teacher trên các ảnh khác cùng danh tính.
- Độ ổn định trước phép biến đổi nhẹ, bảo toàn danh tính.

Độ ổn định đơn độc không chứng minh teacher đúng. Với probe người lạ, cần đánh giá độ tin cậy của quyết định từ chối hoặc tập quan hệ liên quan; không dùng điều kiện “đúng top-1” vốn chỉ có nghĩa với mated probes. Các hệ số trọng số chọn trên development; không dùng nhãn test.

Đối chứng bắt buộc: r=1; IQA-only; confidence-only; reliability từ train labels. Cần giữ loss nhận diện có nhãn cho mọi mẫu, tránh loại hết mẫu khó khỏi việc học.

### 6.3. So sánh rủi ro cực đại trong từng gallery

Với model m, unknown probe u và gallery G_N:

```text
a_m(u, G_N) = max_j cosine(f_m(u), f_m(g_j))
p_m(u, G_N) = sigmoid((a_m(u, G_N) - tau_m(N)) / T_m)
L_tail = mean_u r_u * max(0, p_student - stopgrad(p_teacher))^2
L = L_identity + lambda * L_relation + beta * L_tail
```

tau_m(N) được ước lượng từ các episode calibration thuộc tập học, không dùng minibatch đang tính loss hoặc test. T_m > 0; p_m là surrogate trơn, chưa phải xác suất đã calibration. Khi cập nhật student cần lịch cập nhật cutoff được chốt trước, vì phân phối score thay đổi. Teacher cố định.

Loss bất đối xứng thử hạn chế student tự tin nhận người lạ hơn teacher. Nó không tự ép teacher sai thành đúng. Nếu teacher nhận nhầm quá nhiều, mục tiêu này có thể quá lỏng; open-set loss không KD là đối chứng quyết định.

Đối với mated probes, L_identity/L_relation phải giữ khả năng nhận đúng. Phạt score âm mà bỏ score dương có thể tạo một mô hình từ chối gần như tất cả.

Khác biệt cần kiểm chứng so với EKD/IDL/RTM là **tương tác giữa reliability, chuyển quan hệ teacher–student và cực đại theo gallery**, không phải sigmoid, hard negatives hay việc mô phỏng episode. Nếu ablation không chứng minh tương tác này, không nhận là thuật toán mới.

### 6.4. Vì sao N cần được xem riêng?

Với score so từng identity S_j và ngưỡng tau:

```text
FPIR(N, tau) = P(max_j S_j >= tau | nonmated)
```

Nếu giả định các S_j độc lập và cùng pairwise false-match probability p, biểu thức là 1-(1-p)^N. Gallery thật không bảo đảm độc lập hay đồng phân phối. Đây chỉ là trực giác, không phải công thức chọn ngưỡng triển khai. Union bound tổng các xác suất từng cặp không cần độc lập nhưng có thể rất lỏng.

Không suy rộng kết quả gallery 32 người thành 1.000 người. Nếu dùng memory bank để tạo N lớn hơn, phải ghi nhận embedding cũ và kiểm tra độ lệch do staleness.

## 7. Thiết kế đối chứng tối thiểu cho một nghiên cứu mới

Đây là thiết kế trên giấy, không phải yêu cầu chạy thêm tác vụ hiện tại.

| Mã | Thành phần | Mục đích |
|---|---|---|
| B0 | Backbone fixed, direct-feed | Mốc không thích nghi |
| B1 | Cùng backbone, supervised adaptation + cùng degradation | Cô lập lợi ích KD |
| B2 | Một LoRA + cùng dữ liệu/augmentation | Cô lập lợi ích hai nhánh |
| B3 | PETALface hoặc reproduction được mô tả rõ | Đối chứng quality-dependent adapters |
| B4 | Instance KD | Mốc chuyển từng mẫu |
| B5 | Instance + relation KD | Mốc chuyển cấu trúc |
| B6 | EKD | Đối chứng KD theo chỉ số đánh giá |
| B7 | IDL/RTM không KD | Đối chứng open-set objective |
| B8 | KD + IDL/RTM đơn giản | Loại khả năng lợi ích chỉ do cộng hai loss có sẵn |
| P | Cơ chế A+B | Đo phần lợi ích còn lại |

Ablation chính: reliability on/off × gallery-tail term on/off; random weighting có cùng phân phối trọng số; thay tail term bằng EKD; IQA so với teacher reliability. Giữ backbone, pretraining, nguồn ảnh, crop và số bước cập nhật tương đương. B3 dùng kiến trúc khác phải báo là đối chứng hệ thống, không cô lập tác dụng thuật toán.

Thước đo chính là FNIR ở ngưỡng được chọn với target FPIR trên calibration, kèm **FPIR quan sát thực tế** trên validation/evaluation. Không gọi hai hệ thống được so ở “cùng FPIR” nếu tỷ lệ quan sát khác rõ rệt. Đường cong oracle chỉ làm chẩn đoán, không thay ngưỡng triển khai.

Thêm rank-1, risk–coverage, tỷ lệ từ chối, phân tầng kích thước mặt/camera, latency và bộ nhớ. Đếm từ chối trên mated probes vào FNIR; không chỉ báo accuracy của mẫu được nhận.

Các episode khác seed dùng lại danh tính không phải các thí nghiệm độc lập hoàn toàn. Báo seed SD và CI ghép cặp theo identity; nếu dữ liệu phụ thuộc theo camera/track cần phân tích nhạy cảm với đơn vị cluster tương ứng.

Tại FPIR 1%, 200 unknown probes chỉ tương ứng khoảng hai false identifications ở mức kỳ vọng. Báo số probe, số identity và khoảng bất định; không diễn giải 0 lỗi quan sát là rủi ro bằng 0. N=1.000 chỉ đưa vào khi có đủ gallery identities và unknown độc lập.

## 8. Tiêu chí tiếp tục hoặc bác bỏ

1. Tiếp tục hướng phương pháp khi P cải thiện FNIR so với B6/B7/B8 ở operating point so sánh được và không đánh đổi bằng việc tăng FPIR hoặc từ chối gần hết.
2. Chưa nhận A đúng nếu reliability chỉ giúp trên ảnh tổng hợp hoặc chỉ hơn random weighting ở một seed.
3. Chưa nhận B đúng nếu chỉ cải thiện N đã dùng để chọn hệ số; cần kiểm tra N hoặc camera giữ lại từ trước.
4. Nếu không thắng tổ hợp KD+IDL/RTM, chuyển trọng tâm sang giải thích cơ chế/failure analysis; không đổi metric sau khi thấy kết quả.
5. Kết quả trên một protocol QMUL tùy chỉnh chưa đủ claim tổng quát giữa dataset. Phân biệt độ phân giải tổng hợp với native LR trong mọi bảng.

## 9. Định vị bài báo và việc nghiên cứu tiếp theo

Tên làm việc: **Teacher Reliability and Gallery-Size Effects in Distillation for Single-Shot Open-Set Face Identification**.

Câu hỏi chính: “Under native low-resolution degradation, when does distillation improve identification without increasing false identification as the gallery grows?”

Đóng góp dự kiến, chỉ dùng khi có bằng chứng: protocol kiểm tra riêng recognition/risk; phân tích độ tin cậy teacher; cơ chế chuyển quan hệ theo gallery và ablation; failure analysis giữa native/synthetic LR.

Rà soát hiện có là focused review, không phải systematic review hoặc literature matrix 20–30 bài hoàn chỉnh. Bước tiếp theo về tài liệu:

- Mở rộng citation chaining của EKD, IDL/RTM, PETALface, AIRD và NAM; tìm cả reliability-aware KD, risk distillation, watchlist identification, score-tail matching, gallery-size calibration.
- Đối chiếu bản hội nghị PETALface với preprint v1; kiểm tra exact one-image enrollment và cách aggregate probe của từng protocol trước khi đưa số vào bảng so sánh.
- Đọc sâu CCFace, Grouped KD và bài 2026 về SR-ViT; hiện các hàng này chỉ dựa trên abstract/metadata nguồn chính.
- Đọc bổ sung [Beyond Error-vs-Discard Characteristic, IJCB 2026, trang phòng lab tác giả](https://lmi.fe.uni-lj.si/en/vitomir-struc/publications/) trước khi claim mới về đánh giá quality/risk–coverage.
- Với mỗi bài bổ sung, ghi nguồn, mức độ đã đọc và tiêu chí trùng đóng góp; chỉ chốt novelty sau vòng rà soát này.

Ma trận nguồn đi kèm: [literature-petalface-distillation-20261028.csv](literature-petalface-distillation-20261028.csv). Không dùng số của tài liệu khác để dự báo accuracy cho dự án.
