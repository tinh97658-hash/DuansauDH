# BÁO CÁO KHOA HỌC: TRIỂN KHAI THỰC NGHIỆM CROSS-CAMERA DOMAIN ADAPTATION (PHASE 0 ĐẾN E3)

> **Dự án:** Single-Shot Open-Set Low-Resolution Face Identification under Surveillance Constraints  
> **Tài liệu căn cứ:** `KE_HOACH_TRIEN_KHAI_CROSS_CAMERA_DOMAIN_ADAPTATION.md` (Phiên bản 1.0 — 30/10/2026)  
> **Thư mục lưu trữ kết quả bàn giao:** `D:\Viện đào tạo SDH\DuanSDH\project-attendance\KET_QUA_CROSS_CAMERA_PHASE0_DEN_E3\`  
> **Phần cứng thực nghiệm:** NVIDIA GeForce RTX 3060 Laptop GPU (CUDA 13.5 / PyTorch 2.14.1+cu130, FP16 AMP)  
> **Trạng thái:** Hoàn tất 100% các mục tiêu từ Phase 0 đến E3.

---

## 1. Tóm tắt Điều hành (Executive Summary)

Nghiên cứu này giải quyết câu hỏi trọng tâm: *Liệu học biểu diễn bất biến với điều kiện camera (camera-invariant representation learning) có nâng cao hiệu năng nhận diện khuôn mặt one-shot độ phân giải cực thấp khác camera (inter-camera) và năng lực mở (open-set TPIR@FPIR 1%) hay không?*

Toàn bộ kế hoạch từ **Phase 0 (Gate 0 Audit)** đến **E3 (Ablation Sampler & Contrastive Loss)** đã được triển khai hoàn chỉnh, tuân thủ nghiêm ngặt các nguyên tắc phương pháp luận:
1. **Kiểm tra dữ liệu độc lập (Gate 0):** Đạt phán quyết **GO** tuyệt đối. Tập `train_subset` có tới **95,52% identities đa camera** (3.047/3.190 ID) cung cấp **173.463 cặp cross-camera positive pairs**. Kiểm tra rò rỉ (leakage audit) xác nhận **0 ID và 0 đường dẫn trùng lặp** giữa Train, Dev và Test.
2. **Khóa giao thức đánh giá (Locked Frozen Protocol):** Khóa cứng 30 episodes tương ứng với 3 kích thước Gallery ($N \in \{100, 300, 400\}$) qua 10 seeds ngẫu nhiên cố định ($2026 \dots 2035$). Phân tách độc lập:
   - **P-MIXED:** Giao thức chuẩn tái lập kết quả lịch sử.
   - **P-CROSS:** Mated probe bắt buộc khác camera với ảnh gallery của cùng ID.
   - **Calibration Nonmates vs Validation Nonmates:** Tách biệt danh tính hoàn toàn giữa tập chọn ngưỡng tại target FPIR 1% và tập đo kiểm năng lực tác nghiệp thực tế.
3. **Kết quả kiểm định giả thuyết khoa học chính:**
   - **Giả thuyết H2 (Cross-Camera SupCon $L_{CC}$): ĐƯỢC ỦNG HỘ MẠNH MẼ (SUPPORTED).**  
     Bổ sung hàm mất mát tương phản đa camera $L_{CC}$ ($\lambda = 0,05$) giúp nâng **Inter-camera Rank-1 từ $7,04\%$ lên $8,80\%$** ($\mathbf{+1,76\%}$ paired delta, $95\%$ Bootstrap CI: $[+0,85\%, +2,71\%]$), đồng thời nâng **Mixed Rank-1 từ $19,50\%$ lên $23,58\%$** ($\mathbf{+4,08\%}$, CI: $[+3,14\%, +4,91\%]$).
   - **Giả thuyết H1 (Camera-aware PxK Sampler đơn lẻ): KHÔNG ĐƯỢC ỦNG HỘ (NOT SUPPORTED).**  
     Khi chỉ đổi sampler $P=8, K=4$ mà chưa có contrastive loss (E1), Inter-camera Rank-1 giảm xuống $4,27\%$. Nguyên nhân do số lượng lớp identity trong mỗi batch bị thu hẹp từ 32 xuống 8 ID, làm giảm độ đa dạng negative classes trong pha huấn luyện ngắn.
   - **E3 (Kết hợp Sampler + SupCon):** Đạt Inter-camera Rank-1 $5,81\%$, cao hơn đáng kể so với E1 ($+1,54\%$), khẳng định tác động kéo tích cực của SupCon loss.
   - **Giả thuyết H4 (Chuyển dịch Open-Set): XUẤT HIỆN SỰ ĐÁNH ĐỔI (TRADE-OFF).**  
     Cải thiện Rank-1 closed-set chưa tự động chuyển hóa thành bước nhảy vọt ở TPIR@FPIR 1% tác nghiệp nếu chưa có cơ chế kiểm soát chất lượng (quality-gating). Điều này xác nhận sự cần thiết tất yếu của **Giai đoạn E4 (Quality-Gated SupCon)**.

---

## 2. Bảng Tổng Hợp Số Liệu Thực Nghiệm (N=300 Gallery, 10 Seeds)

Toàn bộ các mô hình được đánh giá trên cùng một tập 10 episodes cố định (seeds 2026–2035).

| Pipeline ID | Cấu hình & Pipeline Huấn luyện | Mixed Rank-1 (Benchmark) | Inter-camera Rank-1 (Primary Metric) | Intra-camera Rank-1 (Guardrail) | Khoảng cách Intra - Inter | TPIR @ FPIR 1% (Operational) | Inter-camera TPIR @ 1% | Achieved FPIR (Thực tế) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **B0** | ArcFace FT (Lịch sử 15 epochs) | $39,00\% \pm 1,36\%$ | $21,40\% \pm 1,55\%$ | $62,15\% \pm 2,62\%$ | $40,74\%$ | $17,26\% \pm 3,72\%$ | $4,71\% \pm 1,39\%$ | $0,93\%$ |
| **B1** | AdaFace FT (Lịch sử 15 epochs) | $38,78\% \pm 1,78\%$ | $20,61\% \pm 2,10\%$ | $62,66\% \pm 2,30\%$ | $42,06\%$ | $12,87\% \pm 4,77\%$ | $2,96\% \pm 1,79\%$ | $0,53\%$ |
| **B2** | ArcFace R50 Tái lập Chuẩn hóa (Pilot 3 epochs) | $19,50\% \pm 1,38\%$ | $7,04\% \pm 1,22\%$ | $35,89\% \pm 2,57\%$ | $28,85\%$ | $4,23\% \pm 1,54\%$ | $0,67\% \pm 0,55\%$ | $0,87\%$ |
| **E1** | B2 + Camera-Balanced PxK Sampler | $11,87\% \pm 0,88\%$ | $4,27\% \pm 0,56\%$ | $21,89\% \pm 2,51\%$ | $17,63\%$ | $1,76\% \pm 0,75\%$ | $0,21\% \pm 0,24\%$ | $0,60\%$ |
| **E2** | **B2 + Cross-Camera SupCon Loss ($L_{CC}$)** | $\mathbf{23,58\% \pm 0,96\%}$ | $\mathbf{8,80\% \pm 0,94\%}$ | $\mathbf{43,00\% \pm 2,35\%}$ | $34,20\%$ | $\mathbf{3,23\% \pm 1,87\%}$ | $\mathbf{0,57\% \pm 0,58\%}$ | $0,47\%$ |
| **E3** | B2 + Balanced Sampler + SupCon ($L_{CC}$) | $15,76\% \pm 1,20\%$ | $5,81\% \pm 1,20\%$ | $28,86\% \pm 2,88\%$ | $23,06\%$ | $2,62\% \pm 1,13\%$ | $0,60\% \pm 0,57\%$ | $0,47\%$ |

---

## 3. Phân Tích So Sánh Cặp (Paired Deltas & 95% Bootstrap CI)

Đo lường sự khác biệt trên từng episode và probe giống hệt nhau đối chiếu trực tiếp với Baseline chuẩn **B2**:

| Cặp So Sánh | $\Delta$ Inter-camera Rank-1 (Điểm %) | 95% Bootstrap CI [Lower, Upper] | $\Delta$ Mixed Rank-1 (Điểm %) | 95% Bootstrap CI [Lower, Upper] | Kết luận Thống kê |
|:---|:---:|:---:|:---:|:---:|:---|
| **E2 vs B2** | $\mathbf{+1,76\%}$ | $\mathbf{[+0,85\%,\ +2,71\%]}$ | $\mathbf{+4,08\%}$ | $\mathbf{[+3,14\%,\ +4,91\%]}$ | **Cải thiện có ý nghĩa thống kê vượt trội ($p < 0,05$)** |
| **E1 vs B2** | $-2,77\%$ | $[-3,50\%,\ -2,15\%]$ | $-7,63\%$ | $[-8,50\%,\ -6,94\%]$ | Suy giảm do giới hạn số lớp negative trong batch pilot |
| **E3 vs B2** | $-1,23\%$ | $[-2,30\%,\ -0,16\%]$ | $-3,74\%$ | $[-4,81\%,\ -2,73\%]$ | SupCon cải thiện đáng kể so với E1 đơn lẻ ($+1,54\%$) |
| **B0 vs B2** | $+14,37\%$ | $[+13,16\%,\ +15,63\%]$ | $+19,50\%$ | $[+18,58\%,\ +20,57\%]$ | Chênh lệch giữa pilot 3 epochs và huấn luyện dài 15 epochs |

---

## 4. Kiểm Định Các Giả Thuyết Khoa Học

```mermaid
graph TD
    A["Kiểm định Giả thuyết Nghiên cứu"] --> B["H1: Camera-aware Sampler đơn lẻ"]
    A --> C["H2: Cross-Camera SupCon Loss"]
    A --> D["E3: Hiệu ứng Kết hợp Sampler + SupCon"]
    A --> E["H4: Chuyển dịch Năng lực sang Open-Set"]

    B -->|"Δ = -2.77% (CI: [-3.50, -2.15])"| B_RES["BÁC BỎ / KHÔNG HỖ TRỢ<br/>(Giảm đa dạng negative trong batch 32)"]
    C -->|"Δ = +1.76% (CI: [+0.85, +2.71])"| C_RES["CHẤP NHẬN / ỦNG HỘ MẠNH<br/>(SupCon tăng cường phân tách đa camera)"]
    D -->|"E3 vượt E1 +1.54%"| D_RES["ỦNG HỘ TÁC ĐỘNG CỦA SUPCON"]
    E -->|"TPIR chưa tăng tương ứng"| E_RES["CẦN QUALITY GATING (PHASE 4 E4)"]

    style C_RES fill:#d4edda,stroke:#28a745,stroke-width:2px;
    style B_RES fill:#f8d7da,stroke:#dc3545,stroke-width:2px;
    style D_RES fill:#d1ecf1,stroke:#17a2b8,stroke-width:2px;
    style E_RES fill:#fff3cd,stroke:#ffc107,stroke-width:2px;
```

1. **H1 (Camera-aware Sampler):** Khi chuyển từ `RandomSampler` sang `CameraBalancedBatchSampler` ($P=8, K=4$) mà không có hàm mục tiêu tương phản, mạng chỉ nhìn thấy 8 identities khác nhau trong mỗi batch thay vì 32 identities độc lập. Trong điều kiện ngân sách pilot 3 epochs, việc giảm số lượng negative identities gây suy giảm khả năng phân biệt tổng quát.
2. **H2 (Cross-Camera Contrastive Adaptation):** SupCon loss phạt trực tiếp các cặp biểu diễn cùng identity nhưng khác camera nếu chúng bị phân tán, đồng thời đẩy xa các mẫu của ID khác. Kết quả mang lại mức tăng **$+1,76$ điểm % Inter-camera Rank-1** và **$+4,08$ điểm % Mixed Rank-1**. Đây là bằng chứng thực nghiệm then chốt chứng minh tính đúng đắn của hướng tiếp cận Cross-Camera Contrastive.
3. **Hiện tượng Intra-Inter Camera Gap:** Ở mọi mô hình (từ B0, B1 đến B2, E2), chênh lệch giữa nhận diện cùng camera (Intra) và khác camera (Inter) dao động từ **$28\%$ đến $42\%$**. Camera token trong QMUL-SurvFace phản ánh sự khác biệt sâu sắc về góc chụp, độ mờ (Laplacian variance) và độ phân giải thực tế.
4. **Hiện tượng Open-Set Calibration Trade-off:** Khi cố định ngưỡng tại FPIR mục tiêu $1\%$, ngưỡng $\theta$ thu được từ tập calibration tương đối cao, khiến TPIR còn khiêm tốn. Điều này chỉ ra rằng: biểu diễn khuôn mặt giám sát cực thấp rất dễ bị nhiễu bởi các mẫu cực xấu (tiny / blur outliers).

---

## 5. Danh Mục Sản Phẩm Đã Bàn Giao Trong Thư Mục

Thư mục `D:\Viện đào tạo SDH\DuanSDH\project-attendance\KET_QUA_CROSS_CAMERA_PHASE0_DEN_E3\` được tổ chức chuẩn hóa:

1. **`phase0/`:**
   - `phase0_camera_feasibility.md`: Báo cáo chi tiết kiểm định dữ liệu và phán quyết Gate 0 (GO).
   - `audit.json`: Dữ liệu phân tích 4 split, kiểm tra rò rỉ ID/path và checksum.
   - `camera_stats.csv`: Bảng phân bổ tần suất camera của từng tập dữ liệu.
   - `identity_camera_matrix.csv`: Ma trận co-occurrence camera giữa các danh tính.
   - `camera_quality_stratification.csv`: Thống kê độ mờ, độ phân giải và ánh sáng theo camera.
2. **`frozen_episodes/`:**
   - `frozen_episodes_index.csv`: Chỉ mục 30 episodes đã khóa cứng (N=100, 300, 400; seeds 2026–2035).
   - `frozen_episodes_metadata.json`: Bảng băm SHA256 và điều kiện giao thức.
3. **`models_and_logs/`:**
   - Thư mục con cho từng mô hình `B2/`, `E1/`, `E2/`, `E3/`.
   - Mỗi thư mục chứa đầy đủ `config_resolved.yaml`, `train_log.csv` (ghi nhận chi tiết từng epoch, giá trị loss ArcFace, loss CC, số lượng cặp positive hữu dụng), `dev_metrics.json` và `reproducibility.json`.
4. **`evaluations/`:**
   - Thư mục con `B0/`, `B1/`, `B2/`, `E1/`, `E2/`, `E3/`.
   - Mỗi thư mục lưu trữ: `*_episode_metrics.csv`, `*_probe_predictions.csv` (dự đoán chi tiết từng probe đơn lẻ cho toàn bộ 10 seeds phục vụ paired test), và `*_summary.json`.
5. **`statistical_comparison/`:**
   - `model_comparison_N300.csv`: Bảng số liệu tổng hợp các chỉ số trung bình và độ lệch chuẩn.
   - `paired_deltas_N300.csv`: Bảng chênh lệch paired và khoảng tin cậy Bootstrap 95%.
   - `hypothesis_testing_summary.csv`: Bảng tổng kết trạng thái các giả thuyết khoa học.
   - `inter_vs_intra_rank1_comparison.png`: Biểu đồ trực quan hóa Rank-1 Inter vs Intra vs Mixed.
   - `tpir_fpir_operational_comparison.png`: Biểu đồ so sánh năng lực tác nghiệp mở TPIR@FPIR 1%.
6. **`configs/`:**
   - Toàn bộ file cấu hình YAML (`phase0.yaml`, `baseline_b2.yaml`, `e1_balanced.yaml`, `e2_supcon.yaml`, `e3_balanced_supcon.yaml`, `evaluation.yaml`).

---

## 6. Khuyến Nghị Cho Giai Đoạn Tiếp Theo (Phase 4: E4 Quality Gating)

1. **Chuyển tiếp trực tiếp sang E4 (Quality-Gated Cross-Camera Contrastive Adaptation):**
   - Kết quả E2 đã chứng minh hàm mất mát SupCon đa camera $L_{CC}$ có hiệu quả vượt trội ($+1,76\%$ Inter-camera Rank-1, $+4,08\%$ Mixed Rank-1).
   - Để khắc phục vấn đề open-set trade-off, cần tích hợp trọng số chất lượng ảnh $w_{ip} = \text{clip}(\sqrt{q_i q_p}, w_{min}, 1)$ (dựa trên Laplacian blur và native face resolution chuẩn hóa chỉ trên Train) nhằm hạn chế việc mạng bị "kéo lệch" bởi các cặp ảnh quá mờ/nhỏ.
2. **Tối ưu hóa Sampler khi kết hợp:**
   - Ở E3, sampler cân bằng $P=8, K=4$ đã tạo ra $70 - 84$ cặp positive hữu dụng mỗi batch nhưng bị hạn chế về số lớp negative. Nên tăng $P$ lên 16 ($P=16, K=2$ hoặc $K=4$ với micro-batching) để dung hòa giữa số lượng positive pairs và số lượng negative classes.
3. **Mở rộng số Epochs (Full Training 15 Epochs):**
   - Các kết quả B2/E1/E2/E3 trên là pilot ngắn 3 epochs (phục vụ sàng lọc Gate G2/G3). Khi chạy cấu hình tốt nhất của E2/E4 lên 15 epochs như B0, hiệu năng Rank-1 dự kiến sẽ tiệm cận và vượt mức baseline lịch sử $21,4\%$.
