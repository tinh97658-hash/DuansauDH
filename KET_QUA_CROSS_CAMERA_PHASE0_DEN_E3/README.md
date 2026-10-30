# TỔNG HỢP KẾT QUẢ THỰC NGHIỆM CROSS-CAMERA DOMAIN ADAPTATION (PHASE 0 - E3)

Thư mục này chứa toàn bộ dữ liệu, mã nguồn đánh giá, báo cáo, nhật ký huấn luyện, các mô hình và phân tích thống kê theo đúng kế hoạch `KE_HOACH_TRIEN_KHAI_CROSS_CAMERA_DOMAIN_ADAPTATION.md`.

---

## Cấu trúc Thư mục

```text
KET_QUA_CROSS_CAMERA_PHASE0_DEN_E3/
├── README.md                                    # File hướng dẫn tổng quan này
├── BAO_CAO_TONG_KET_CROSS_CAMERA_PHASE0_E3.md   # Báo cáo khoa học tổng hợp chi tiết
├── phase0/                                      # Kết quả kiểm tra dữ liệu và khả thi (Gate 0)
│   ├── phase0_camera_feasibility.md             # Báo cáo chi tiết Phase 0 (Go / No-Go)
│   ├── audit.json                               # Toàn bộ thống kê và kết quả rà soát rò rỉ
│   ├── camera_stats.csv                         # Phân bổ camera theo từng split
│   ├── camera_quality_stratification.csv        # Phân tầng kích thước, độ mờ (Laplacian), độ sáng
│   ├── identity_camera_matrix.csv               # Ma trận co-occurrence camera_a x camera_b
│   └── manifest_provenance.json                 # Checksum và nguồn gốc của dữ liệu & checkpoint
├── frozen_episodes/                             # Bộ 30 episode đánh giá cố định (Locked Protocol)
│   ├── frozen_episodes_index.csv                # Chỉ mục 30 episode (N=100, 300, 400; seeds 2026-2035)
│   └── frozen_episodes_metadata.json            # Metadata và checksum bộ episode
├── models_and_logs/                             # Nhật ký huấn luyện và cấu hình của các mô hình
│   ├── B2/                                      # Baseline ArcFace R50 chuẩn hóa (Standard Sampler)
│   │   ├── config_resolved.yaml
│   │   ├── train_log.csv
│   │   ├── dev_metrics.json
│   │   └── reproducibility.json
│   ├── E1/                                      # Thử nghiệm E1 (Camera-Balanced Sampler PxK)
│   ├── E2/                                      # Thử nghiệm E2 (Cross-Camera SupCon Loss)
│   └── E3/                                      # Thử nghiệm E3 (Kết hợp Sampler PxK + SupCon Loss)
├── evaluations/                                 # Kết quả đánh giá chi tiết trên 10 seeds
│   ├── B0/                                      # Baseline ArcFace Fine-tuned lịch sử
│   ├── B1/                                      # Baseline AdaFace Fine-tuned
│   ├── B2/                                      # Baseline B2 tái lập chuẩn hóa
│   ├── E1/                                      # E1 (Camera-aware Sampler)
│   ├── E2/                                      # E2 (Cross-camera SupCon)
│   └── E3/                                      # E3 (Combined Sampler + SupCon)
└── statistical_comparison/                      # Bảng so sánh thống kê, kiểm định giả thuyết và biểu đồ
    ├── model_comparison_N300.csv                # Bảng tổng hợp các metric chính tại N=300
    ├── paired_deltas_N300.csv                   # Chênh lệch paired (Δ so với B2) và Bootstrap 95% CI
    ├── hypothesis_testing_summary.csv           # Kết quả kiểm định các giả thuyết H1, H2, H4
    ├── inter_vs_intra_rank1_comparison.png      # Biểu đồ so sánh Rank-1 Intra vs Inter vs Mixed
    └── tpir_fpir_operational_comparison.png     # Biểu đồ đánh giá năng lực tác nghiệp TPIR@FPIR 1%
```

---

## Các Giả thuyết Nghiên cứu Được Kiểm Định

1. **H1 — Camera-aware sampling:** Liệu sampler cân bằng camera có cải thiện được Rank-1 khác camera so với pipeline chuẩn B2?
2. **H2 — Cross-camera SupCon:** Liệu hàm mất mát tương phản có kiểm soát cặp dương khác camera giúp phân biệt ID trong điều kiện khác camera?
3. **E3 — Hiệu ứng kết hợp:** Liệu việc kết hợp cả sampler cân bằng camera và cross-camera contrastive loss có mang lại sức mạnh cộng hưởng?
4. **H4 — Chuyển dịch Open-Set:** Sự cải thiện Rank-1 có thực sự chuyển dịch thành sự gia tăng của TPIR tại ngưỡng cố định FPIR = 1% hay có sự đánh đổi (trade-off)?
