# KẾ HOẠCH TRIỂN KHAI NGHIÊN CỨU HƯỚNG B
## Cross-Camera Domain Adaptation for Single-Shot Open-Set Low-Resolution Face Identification

> **Phiên bản:** 1.0 — 30/10/2026  
> **Trạng thái:** Kế hoạch thực nghiệm, các cải thiện chưa được chứng minh  
> **Phần cứng ưu tiên:** RTX 3060 Laptop 6 GB (phát triển/pilot), Kaggle Tesla T4 (huấn luyện)  
> **Bài toán:** One-shot enrollment, open-set 1:N, khuôn mặt giám sát độ phân giải rất thấp  
> **Tập dữ liệu:** QMUL-SurvFace, các manifest và giao thức tùy biến hiện tại  
> **Nguyên tắc bắt buộc:** Không dùng Test để chọn model/threshold; không đổi gallery/probe giữa các model trong cùng so sánh.

---

## 1. Bối cảnh và các kết quả đã có

Theo các báo cáo nghiên cứu do nhóm cung cấp:

| Điều kiện | Rank-1 trên Dev, N=300, seed 2026 | Số probe |
|---|---:|---:|
| Intra-camera | **58,65%** | 208 |
| Inter-camera | **19,13%** | 392 |
| Mixed | **32,83%** | 600 |

- Chênh lệch intra–inter là **39,52 điểm phần trăm**.
- Khi chạy hai đường code trên cùng một episode, score matrix, prediction và Rank-1 trùng nhau (theo báo cáo diagnostic).
- Thí nghiệm resampling *mixed* sau điều chỉnh: gallery fixed-probe **31,27% ± 1,42%**, probe fixed-gallery **32,33% ± 2,21%**; chế độ *cross_camera* lần lượt **19,69% ± 1,01%** và **18,40% ± 1,45%**.
- Trong kiểm chứng trước đó, ArcFace FT subset đạt khoảng **31,93%** Rank-1 mixed; full-data khoảng **33,20%**, nhưng FNIR@FPIR mục tiêu 1% suy giảm mạnh. Các con số này thuộc thí nghiệm trước, **không được coi là hiệu năng của phương pháp mới**.
- Báo cáo audit hiện tại ghi nhận train manifest **45.050 ảnh / 3.190 ID**; các thí nghiệm lịch sử sử dụng subset/full-data khác. **Phải xác minh chính xác provenance**, không trộn kết quả từ các manifest khác nhau.

**Giới hạn diễn giải:** Chênh lệch theo camera có thể đồng biến với pose, blur, độ phân giải hoặc ánh sáng. Chưa đủ bằng chứng khẳng định camera ID là nguyên nhân nhân quả duy nhất. Các protocol tùy biến không được gọi là leaderboard chính thức QMUL-SurvFace.

## 2. Mục tiêu, giả thuyết và đóng góp kỳ vọng

### 2.1. Câu hỏi nghiên cứu

> Liệu học biểu diễn bất biến với điều kiện camera, đồng thời kiểm soát độ tin cậy của các cặp ảnh chất lượng thấp, có nâng **inter-camera Rank-1** và **TPIR@FPIR** trong nhận diện khuôn mặt one-shot open-set hay không?

### 2.2. Giả thuyết có thể bác bỏ

- **H1 — Camera-aware sampling:** Sampler ưu tiên nhiều camera trong một ID cải thiện inter-camera Rank-1 so với cùng pipeline huấn luyện dùng sampler chuẩn.
- **H2 — Cross-camera contrastive:** SupCon với cross-camera positive pairs giúp phân biệt ID trong điều kiện khác camera.
- **H3 — Quality-gating:** Cân trọng số positive theo chất lượng cải thiện so với SupCon không trọng số, *không* bỏ qua toàn bộ mẫu khó.
- **H4 — Open-set transfer:** Cải thiện Rank-1 có thể cải thiện TPIR@FPIR cố định; đây là giả thuyết cần kiểm định, không phải kết luận mặc định.

### 2.3. Đóng góp dự kiến (chỉ tuyên bố nếu có số liệu)

1. Phân tích phân tầng intra-/inter-camera trên single-shot low-resolution open-set protocol.
2. Phương pháp **Quality-Gated Cross-Camera Contrastive Adaptation (QG-CCCA)** có ablation tách sampler / SupCon / quality weighting.
3. Đánh giá paired và khoảng tin cậy, chỉ ra lợi ích hoặc trade-off giữa closed-set Rank-1 và open-set TPIR.

> **Tính mới:** Camera-balanced sampling và supervised contrastive learning tự thân không mới. Đóng góp Q2–Q3 chỉ có cơ sở nếu thiết kế quality-gating/cross-camera mang lại kết quả khác biệt, có giải thích và có đối chứng đủ mạnh.

---

## 3. Gate 0 — Kiểm tra khả thi của dữ liệu (bắt buộc, chưa train)

### 3.1. Đầu vào cần truy vết

- `data/processed/qmul_train/manifest_train.csv` và mọi manifest đã dùng trong ArcFace subset/full-data.
- Dev: `data/processed/qmul_subset_samedomain/manifest_dev.csv`.
- Test: chỉ đọc metadata để audit; **không load embeddings và không evaluate**.
- Các trường cần có: `person_id`, `image_path`, `camera_id`, `session_id`, `quality` (nếu có). Nếu không có kích thước mặt hoặc blur, xây extractor metadata trên **Train/Dev**.

### 3.2. Checklist audit

- [ ] Xác minh số ảnh, số ID, camera, ảnh/ID và camera/ID cho từng manifest.
- [ ] Kiểm tra Train ∩ Dev ∩ Test identity/path; hash nội dung khi khả thi, tách rõ kiểm tra toàn bộ và kiểm tra theo mẫu.
- [ ] Tính số ID có >=2 camera; số cross-camera positive pairs (theo ID và theo cặp camera).
- [ ] Tạo ma trận `camera_a × camera_b` đếm ID có ảnh cả hai camera.
- [ ] Phân tầng face width, blur, illumination (nếu đo được), pose (nếu nhãn đáng tin), theo camera.
- [ ] Đánh giá có sự confounding giữa camera với độ phân giải/góc nhìn không.
- [ ] Xác minh các checkpoint và embedding cache thuộc manifest, preprocess, weights nào; lưu checksum.
- [ ] Kiểm tra không có ảnh/ID Test từng được dùng để chọn epoch, model, preprocessing hoặc threshold.

### 3.3. Quy tắc Go / No-Go

**GO:** Có ID đa camera đủ đa dạng để sinh positive pairs ở quy mô batch thực tế; ít nhất vài trăm ID đa camera là mục tiêu pilot gợi ý, **không phải tiêu chuẩn thống kê cứng**. Xác minh bằng thống kê số positive hữu dụng/batch.

**NO-GO:** Không có hoặc quá ít ID đa camera; camera ID lỗi; phần lớn positive pairs có nhãn không đáng tin. Khi đó chuyển sang *augmentation consistency*, cross-domain feature consistency hoặc domain-generalization không cần supervised cross-camera positive, **không gượng ép H2/H3**.

**Đầu ra:** `reports/phase0_camera_feasibility.md`, `outputs/phase0/camera_stats.csv`, `identity_camera_matrix.csv`, `manifest_provenance.json`, `audit.json`.

---

## 4. Giao thức đánh giá cố định

### 4.1. Hai protocol song song

**P-MIXED** — Tái lập benchmark tùy biến đang dùng, gồm mated probes cùng và khác camera. Mục tiêu giữ đối chiếu với lịch sử thực nghiệm.

**P-CROSS** — Mated probe phải khác camera với ảnh gallery của cùng ID. Giữ 1 gallery image/ID, gallery/probe không overlap. Không đơn giản tự động lấy `gallery/` và `mated/` nếu quy tắc camera không được xác minh.

**Nonmate:** Với open-set, nonmate là ảnh thuộc ID không enroll. Ghi rõ cách lấy nonmate và phân phối camera cho từng protocol. Đảm bảo số lượng nonmate đủ để đánh giá FPIR; đừng xem FPIR mục tiêu là FPIR thực tế.

### 4.2. Episode manifests

- Gallery N = 100, 300, 400; N=300 là cấu hình chính lịch sử.
- Mười episode seeds cố định: 2026–2035.
- Xuất `episode_id`, danh sách gallery/probe, camera, ID, đường dẫn và hash nguồn.
- Dùng **chính xác episode files đó** cho B0–E7 và mọi model.
- Tách riêng selection/validation và calibration trong Dev theo identity; báo cáo số nonmate thực tế của từng phần.
- Giữ Test đóng kín đến lúc chọn model và threshold xong; sau đó đánh giá Test theo quy trình đã khóa, không quay lại tuning.

### 4.3. Metrics

| Metric | Vai trò | Ghi chú |
|---|---|---|
| **Inter-camera Rank-1** | **Primary representation metric** | Tỷ lệ đúng Top-1 trên mated probes khác camera |
| **TPIR@FPIR target 1%** | **Primary operational metric** | Threshold chọn từ calibration, báo cáo achieved FPIR và CI trên validation |
| FNIR@FPIR 1% | Complement của TPIR | Ghi đúng quy tắc nhận đúng ID và đủ threshold |
| Mixed và intra-camera Rank-1 | Guardrail | Kiểm tra tác động phụ |
| Rank-5 | Secondary | Không thay primary |
| Achieved FPIR và Wilson CI | Calibration quality | Dùng k lỗi **quan sát**, không dùng expected k |
| DET/ROC, genuine/impostor score | Cơ chế | Cần stratify theo camera và quality |
| Latency/VRAM/throughput | Triển khai | Đo trên RTX 3060 6GB/T4 nếu thực chạy |

**Thống kê:** Paired comparison trên cùng probe, bootstrap gom cụm theo ID; đánh giá uncertainty do seed, gallery image draw, calibration threshold. Không coi 10 episode lặp ID là 10 mẫu độc lập tuyệt đối. Báo cáo mean ± SD, hiệu số paired, CI và size effect; chú ý multiple comparisons.

---

## 5. Kiến trúc nghiên cứu

```text
TRAIN IMAGES + (identity, camera, quality)
                  |
          Camera-aware P×K sampler
                  |
          Face chip 112×112 (nhất quán)
                  |
          ArcFace R50 backbone
                  |
       L2-normalized embedding (512-D)
             /              \
       ArcFace ID loss     Cross-camera SupCon
                                  |
                          Quality-gated weights
             \              /
                Joint loss
                  |
       Frozen embeddings on DEV episodes
                  |
        P-MIXED / P-CROSS evaluation
                  |
             Model selection
                  |
       One locked final TEST evaluation
```

### 5.1. Camera-aware P×K sampling

- Khởi điểm: P=8 ID, K=4 ảnh/ID, batch 32 (nếu VRAM cho phép).
- Với ID đủ điều kiện: ưu tiên >=2 camera; ví dụ 2 ảnh mỗi camera.
- Batch thiếu positive hợp lệ: log `cross_camera_positive_pairs_per_batch`; không tự gán ảnh khác ID làm positive.
- So sánh **cùng số optimizer updates, cùng effective batch, cùng training split**, không để sampler vô tình kéo dài train.

### 5.2. Cross-camera supervised contrastive loss

Với anchor i có danh tính `y_i`, camera `c_i`, positive set:

\[
P_{cross}(i)=\{p:y_p=y_i,\ c_p\ne c_i\}.
\]

Loss thử nghiệm:

\[
L_{CC}=-\frac{1}{|A|}\sum_{i\in A}\frac{1}{|P_{cross}(i)|}
\sum_{p\in P_{cross}(i)}\log
\frac{\exp(z_i^\top z_p/\tau)}{\sum_{a\ne i}\exp(z_i^\top z_a/\tau)}.
\]

- `A` chỉ chứa anchor có positive khác camera.
- `z_i` chuẩn hóa L2; denominator gồm negative và positive khác trừ chính anchor.
- Nếu batch không có `A`, loss contrastive = 0 và ghi log; tránh NaN.
- Khởi điểm `tau=0.07`; ablate `0.05, 0.07, 0.10`.

### 5.3. Quality-gated positive weighting (phương pháp thử nghiệm)

Dùng quality score q thuộc [0,1] học/chuẩn hóa **chỉ trên Train**; thử resolution, blur, resolution+blur.

\[
w_{ip}=\mathrm{clip}(\sqrt{q_iq_p},w_{min},1).
\]

Thay trung bình positive trong `L_CC` bằng trung bình có trọng số được chuẩn hóa theo tổng `w_ip`. So sánh với SupCon không trọng số và random quality weights.

**Rủi ro:** Nếu down-weight ảnh khó quá mức, model có thể cải thiện trung bình nhưng tệ hơn với tiny faces. Luôn báo cáo theo quality bins và `w_min`.

### 5.4. Hàm mục tiêu

\[
L=L_{ArcFace}+\lambda L_{QGCC}.
\]

Khởi điểm `lambda ∈ {0.02,0.05,0.10}`. Đừng đồng thời thêm nhiều regularizer khi chưa biết giá trị từng thành phần.

---

## 6. Ma trận thực nghiệm và ablation

### 6.1. Vòng 1 — Tái lập và kiểm định ý tưởng

| ID | Pipeline | Câu hỏi |
|---|---|---|
| B0 | ArcFace FT hiện tại (frozen baseline) | Baseline lịch sử |
| B1 | AdaFace FT hiện tại | Baseline mô hình khác |
| B2 | ArcFace R50 train lại bằng pipeline chuẩn hóa | Pipeline có tái lập baseline? |
| E1 | B2 + camera-balanced sampler | H1: sampling có giúp? |
| E2 | B2 + cross-camera SupCon, sampler chuẩn | H2: loss có giúp? |
| E3 | B2 + camera-balanced + cross-camera SupCon | Có hiệu ứng kết hợp? |

**Điều kiện:** B2/E1/E2/E3 cùng initial checkpoint, train IDs, augmentation, optimizer budget và dev episodes. Nếu B2 không tái lập hợp lý, dừng điều tra pipeline trước.

### 6.2. Vòng 2 — Quality gating và negative controls

| ID | Pipeline | Đối chứng |
|---|---|---|
| E4 | E3 + quality-gated SupCon | Method đề xuất |
| E5 | E3 + random pair quality weights | Kiểm tra hiệu ứng do trọng số ngẫu nhiên |
| E6 | E3 + quality gating nhưng không phân biệt camera trong positive loss | Tách camera signal khỏi quality |
| E7 | E4 + hard-negative mining | Kiểm tra discrimination, có rủi ro false hard negatives |

**Ablation E4:** resolution-only, blur-only, resolution+blur; `w_min ∈ {0.25,0.50}`; `tau` và `lambda` chỉ quét trên Dev có kiểm soát. Không cần chạy full grid nếu pilot không có tín hiệu cải thiện.

### 6.3. Vòng 3 — Robustness

- 3 training seeds cho B2, E1, E2, E3 và ứng viên tốt nhất của E4 (nếu tài nguyên cho phép).
- Paired same-episode comparisons, bootstrap theo ID.
- Intra/mixed/cross camera, phân tầng face size, blur, camera pair.
- Genuine/impostor distributions, d-prime hoặc separation metrics, calibration curves.
- Nếu data đủ, thử leave-one-camera-out **trong Train/Dev** (không giả định mọi ID có mặt ở mọi camera).
- Đánh giá computational footprint và khả năng inference với gallery N=100–1.000.

---

## 7. Huấn luyện và tài nguyên

### 7.1. Cấu hình pilot (không xem là tối ưu)

| Hạng mục | Khởi điểm |
|---|---|
| Backbone | ArcFace ResNet-50 pretrained, face chip 112×112 |
| Embedding | 512-D, L2 normalized |
| RTX 3060 6GB | Batch 16 trước, kiểm tra memory; pilot ngắn |
| Kaggle T4 | Batch 32, cân nhắc 64 nếu đủ VRAM |
| P×K | 8×4, thay đổi nếu positive quá ít hoặc VRAM không đủ |
| AMP | FP16 autocast + GradScaler |
| Optimizer | Theo B2 để giữ so sánh công bằng (SGD hoặc AdamW) |
| Learning rate pilot | 1e-4 đến 1e-3 tùy optimizer/layers, không dùng chung cứng nhắc |
| Epoch | Pilot tối đa 3; full tối đa 15 |
| Temperature tau | 0.05 / 0.07 / 0.10 |
| Loss lambda | 0.02 / 0.05 / 0.10 |
| Weight floor | 0.25 / 0.50 |
| Reproducibility | Seed Python, NumPy, PyTorch, dataloader; log deterministic setting |

**VRAM:** Gradient accumulation không tạo thêm SupCon positives trong cùng một forward batch. Nếu cần nhiều positive, dùng batch thực lớn trên T4, microbatch accumulation of embeddings có thiết kế phù hợp, hoặc memory queue (khi có đối chứng rõ).

### 7.2. Quản lý checkpoint

- Lưu `last.ckpt`, `best_dev.ckpt`, optimizer/scheduler/scaler state.
- Ghi manifest checksum, seed, config, git commit, GPU, CUDA/cuDNN, package versions.
- Không chọn epoch từ Test.
- Chỉ giữ mô hình tốt nhất theo primary Dev metric, đi kèm guardrail TPIR/FPIR; ghi trước tiêu chí chọn.

---

## 8. Gates, mục tiêu nội bộ và tiêu chí dừng

| Gate | GO khi | NO-GO / Hành động |
|---|---|---|
| **G0: Data** | Có positive khác camera và metadata đáng tin | Không đủ → chuyển augmentation consistency/domain generalization |
| **G1: Baseline** | B2 tái lập baseline, loss/metrics hợp lý | Sai mapping/protocol → sửa trước khi train E1+ |
| **G2: Pilot (≤3 epochs)** | Loss ổn định và inter-camera Rank-1 có tín hiệu không suy giảm | NaN/không positive/giảm rõ → sửa thiết kế hoặc loại nhánh |
| **G3: Full (≤15 epochs)** | Mục tiêu sàng lọc **+3 điểm % inter-camera Rank-1** so B2, TPIR không suy giảm lớn | Chênh lệch không bền qua seeds hoặc TPIR xấu đi → không quảng bá phương pháp |
| **G4: Statistical** | Paired effect/CI ủng hộ cải thiện; mixed/intra guardrails chấp nhận được | Không ổn định → báo cáo negative result / chuyển calibration |
| **G5: Locked Test** | Chốt toàn bộ config/threshold, chạy test cuối | Không tổng quát hóa → báo cáo giới hạn; không tuning lại theo Test |

**Quan trọng:** +3 điểm % chỉ là *engineering screening gate*, **không phải** ngưỡng ý nghĩa thống kê. FPIR 1% là *target*, phải báo cáo *achieved FPIR* và uncertainty. Nếu Rank-1 cải thiện mà TPIR vẫn rất thấp, chuyển hướng quality-aware open-set calibration hoặc representation improvement khác.

### Tiêu chí dừng sớm khi train

1. Loss NaN/Inf hoặc embedding collapse (cosine gần như đồng nhất, Rank-1 tiệm cận random).
2. Tỷ lệ anchor có positive hợp lệ quá thấp dù đã điều chỉnh sampler.
3. Không cải thiện primary Dev metric trong 3 lượt evaluation liên tiếp sau warmup; lưu best checkpoint, không tùy tiện thay tiêu chí hậu nghiệm.
4. GPU OOM kéo dài sau tối đa hai cấu hình batch/memory được định trước.
5. Cost/accuracy ratio không hợp lý: training tăng chi phí đáng kể nhưng không vượt B2 trong pilot.

---

## 9. Thiết kế thống kê và chống leakage

1. **Fixed episodes** cho mọi model; paired deltas trên cùng probes.
2. **Identity-disjoint Train–Dev–Test** và kiểm tra trùng path/hash; nêu mức độ bao phủ kiểm tra hash.
3. **Model selection vs calibration vs evaluation:** Tách rõ phần dữ liệu và tránh chọn hyperparameter trên cùng partition đang dùng để báo cáo performance độc lập.
4. **Threshold fitting:** Fit trên nonmate calibration, áp lên nonmate validation/test cùng mated probes tương ứng. Ghi `n_cal`, `n_val`, observed false accepts, Wilson CI.
5. **Clustered uncertainty:** bootstrap theo identity và lặp gallery draw; không suy ra CIs độc lập từ seed có overlap dữ liệu.
6. **Multiple comparisons:** Xác định primary comparison E4 vs B2 và E4 vs E3; các đối chứng khác mang tính thăm dò hoặc áp dụng điều chỉnh phù hợp.
7. **No official benchmark inflation:** Không diễn giải mixed protocol custom là official SurvFace split; không biến ảnh LR phóng bicubic thành ảnh đăng ký HR thật.
8. **Ethics:** Dữ liệu khuôn mặt cần được dùng đúng quyền truy cập/chấp thuận, hạn chế giữ ảnh định danh và tuân thủ yêu cầu bảo vệ dữ liệu; không triển khai điểm danh tự động khi false identification còn cao.

---

## 10. Cấu trúc repository đề nghị

```text
single-shot-open-set-fr/
├── configs/
│   └── cross_camera/
│       ├── phase0.yaml
│       ├── baseline_b2.yaml
│       ├── e1_balanced.yaml
│       ├── e2_supcon.yaml
│       ├── e3_balanced_supcon.yaml
│       ├── e4_quality_gated.yaml
│       └── evaluation.yaml
├── src/
│   ├── data/
│   │   ├── camera_statistics.py
│   │   ├── camera_balanced_sampler.py
│   │   └── frozen_episodes.py
│   ├── losses/
│   │   ├── cross_camera_supcon.py
│   │   └── quality_gated_supcon.py
│   ├── training/
│   │   └── train_cross_camera.py
│   └── evaluation/
│       └── camera_stratified_metrics.py
├── scripts/
│   ├── audit_cross_camera_feasibility.py
│   ├── freeze_cross_camera_episodes.py
│   ├── run_cross_camera_experiment.py
│   ├── evaluate_cross_camera.py
│   └── compare_paired_models.py
├── tests/
│   ├── test_camera_sampler.py
│   ├── test_cross_camera_loss.py
│   ├── test_frozen_episodes.py
│   └── test_open_set_metrics.py
├── outputs/
│   └── cross_camera/<experiment_id>/
│       ├── config_resolved.yaml
│       ├── train_log.csv
│       ├── best.ckpt
│       ├── dev_metrics.json
│       ├── per_probe_predictions.csv
│       └── reproducibility.json
└── reports/
    ├── phase0_camera_feasibility.md
    ├── cross_camera_ablation.md
    └── final_protocol_and_results.md
```

**Chú ý:** Đây là cấu trúc đề nghị. Khi triển khai, ưu tiên tái sử dụng module có sẵn thay vì tạo mã trùng lặp.

---

## 11. Lộ trình thực hiện 6 chặng

| Chặng | Việc thực hiện | Sản phẩm bàn giao |
|---|---|---|
| **1. Data audit** | Thống kê camera và nguồn manifest, leak audit | Phase 0 report + Go/No-Go |
| **2. Freeze protocol + B2** | Fixed episodes, tái lập ArcFace | Baseline metrics, manifests, checksums |
| **3. E1–E3** | Sampling/SupCon pilot, train full nếu đạt gate | Bảng paired Rank-1/TPIR |
| **4. E4–E7** | Quality-gating/negative controls | Ablation + sensitivity |
| **5. Robustness** | Multi-seed, quality bins, open-set, CI | Statistical report + visualizations |
| **6. Final Test & paper** | Khóa model, test duy nhất, tổng hợp | Manuscript-ready tables và limitations |

Không cố gắn hạn cứng: thời lượng phụ thuộc khả năng tạo positive pairs và số cấu hình đạt gate.

---

## 12. Prompt Codex theo từng phase

### Prompt 1 — Phase 0: kiểm tra dữ liệu, KHÔNG train

```text
Implement Phase 0 of a Cross-Camera Domain Adaptation study in my existing
single-shot open-set low-resolution face identification repository.
Inspect existing source modules before creating new files.
1. Verify train/dev/test manifest provenance and checkpoint/cache provenance.
2. Compute per-camera sample counts; IDs with >=2 cameras; all valid cross-camera
   positive pairs; camera-pair matrices; image size/blur distributions by camera.
3. Verify camera_id quality and possible camera/quality confounding.
4. Audit train/dev/test ID/path overlap; report coverage of content-hash checks.
5. Freeze 10 seed-based mixed and cross-camera development episodes for
   gallery N=100,300,400; keep one image per enrolled ID.
6. Reproduce B0/B1 with existing frozen embeddings if available.
7. Output Markdown/CSV/JSON reports, configs and pytest checks.
8. Do NOT train any model. Do NOT access held-out Test embeddings or tune on Test.
If data or metadata is missing, report exact blockers and do not fabricate results.
```

### Prompt 2 — Giai đoạn B2/E1: sampler và tái lập baseline

```text
Using the Phase 0 frozen protocol, implement reproducible ArcFace R50
fine-tuning baseline B2 and experiment E1 (camera-balanced P x K sampling).
Keep initial weights, training manifest, preprocessing, optimizer updates,
augmentation, evaluation episodes, and checkpoint-selection rules identical.
Log actual valid cross-camera positive pairs per batch and all seeds.
Implement unit tests for sampler invariants, no label confusion, and
image-path/embedding alignment. Run a <=3 epoch pilot, then only continue
if the predefined Go/No-Go criteria are met. Do not evaluate Test.
```

### Prompt 3 — E2/E3: cross-camera SupCon

```text
Implement numerically stable supervised cross-camera contrastive loss:
positive = same identity AND different camera; anchors without positives
must not create NaNs. Add E2 (SupCon with standard sampler), E3
(camera-balanced sampler + SupCon). Add toy tests with known positives,
negatives, loss gradients, zero-positive batches, AMP stability and
reproducibility. Match B2 budget; evaluate fixed mixed/cross-camera Dev
episodes and TPIR at calibrated target FPIR 1%, reporting achieved FPIR.
Never tune on Test.
```

### Prompt 4 — E4/ablation: quality-gating

```text
Add Quality-Gated Cross-Camera Contrastive Adaptation to E3.
Use Train-only normalization of face quality scores. Test resolution,
blur, and combined resolution+blur; compare no weighting, quality
weighting, randomized-quality negative control, and no-camera quality
weighting. Implement bounded weights and log behavior for tiny/blurred
faces. Run a resource-limited pilot before full training. Compare with
B2 and E3 on exactly identical frozen Dev episodes and paired CIs.
Do not optimize on held-out Test.
```

### Prompt 5 — Phân tích cuối

```text
Generate a reproducible statistical report for all cross-camera experiments.
Include per-episode/per-probe predictions, intra/inter/mixed Rank-1,
TPIR/FNIR @ FPIR target 1%, achieved FPIR, Wilson CI, paired identity-
clustered bootstrap, training-seed variability, quality strata,
score distributions, compute/VRAM. Clearly mark exploratory vs primary
comparisons and caveats. Freeze model, hyperparameters and calibration
threshold BEFORE the single final Test evaluation. Do not claim novelty
or statistical significance without supporting results.
```

---

## 13. Tiêu chuẩn chốt bài báo

Trước khi viết abstract khẳng định phương pháp hiệu quả, kiểm tra:

- [ ] B2 tái lập và các protocol mixed/cross được khóa.
- [ ] E4 thực sự vượt B2 và E3 trên primary cross-camera Rank-1 (không chỉ một seed).
- [ ] TPIR@FPIR và achieved FPIR được báo cáo đầy đủ; không đánh đổi open-set quá lớn.
- [ ] Có paired uncertainty, quality/camera strata, negative controls.
- [ ] Có đối chiếu những công trình domain adaptation, SupCon và LRFR liên quan.
- [ ] Có Test độc lập và giới hạn rõ về custom protocol, native LR và HR→LR.
- [ ] Reproducibility package có config, code, seed, hashes, version, logs.
- [ ] Quyền sử dụng dữ liệu khuôn mặt và phân tích rủi ro được trình bày.

## 14. Quyết định triển khai ngay

**Bước đầu tiên:** Thực hiện **Phase 0** bằng Prompt 1. Nếu kiểm tra train cho thấy đủ cặp cùng ID từ nhiều camera, triển khai B2 → E1 → E2 → E3. **Không** bắt đầu E4 hoặc huấn luyện hàng loạt trước khi B2 tái lập và E1–E3 cho tín hiệu tích cực.

**Nếu thất bại:** Không cố đẩy loss weight; phân tích camera/pose/quality confounding và chuyển sang domain generalization hoặc quality-aware open-set calibration trên embedding hiện có.

---

*Lưu ý về nguồn:* Các số liệu baseline ở Mục 1 được ghi lại từ báo cáo người dùng cung cấp; các kiến trúc, công thức, gates và đề xuất ở phần còn lại là **thiết kế nghiên cứu mới**, chưa được chứng minh thực nghiệm.
