# Báo cáo Kiểm tra Tính Khả thi và Dữ liệu (Phase 0 Audit)
**Kế hoạch:** Cross-Camera Domain Adaptation for Single-Shot Open-Set Low-Resolution Face Identification  
**Thời gian thực hiện:** 30/10/2026 00:16:52  
**Trạng thái Quyết định:** **GO**

---

## 1. Kết luận Go / No-Go

- **Phán quyết:** **GO**
- **Căn cứ:**
  1. Số lượng identity có từ 2 camera trở lên trong `train_subset`: **3,047 ID** (chiếm 95.52% tổng số ID).
  2. Tổng số cặp cross-camera positive pairs khả dụng: **173,463 cặp**.
  3. Kiểm tra rò rỉ (leakage audit):
     - Train ∩ Dev identity overlap: **0**
     - Train ∩ Test identity overlap: **0**
     - Dev ∩ Test identity overlap: **0**
  4. Camera token parsing: Các camera token dạng `_cam<id>_` trích xuất hoàn toàn nhất quán từ đường dẫn ảnh.
  5. Cam kết quy tắc Test: Dữ liệu Test chỉ được đọc metadata cho mục đích audit; tuyệt đối không load embedding và không đánh giá chọn model trên Test.

---

## 2. Thống kê Manifest và Phân bổ Camera

| Manifest | Số ảnh | Số ID | Số camera | IDs >= 2 cam | % Multi-cam | Trung bình ảnh/ID |
|---|---:|---:|---:|---:|---:|---:|
| `train_subset` | 45,050 | 3,190 | 16 | 3,047 | 95.5% | 14.12 |
| `train_all` | 78,733 | 5,319 | 17 | 5,224 | 98.2% | 14.80 |
| `dev` | 2,000 | 600 | 5 | 434 | 72.3% | 3.33 |
| `test` | 2,000 | 600 | 9 | 522 | 87.0% | 3.33 |

### Phân bổ Token Camera trong Train Subset:
- **cam1**: 18,098 ảnh (40.17%)
- **cam2**: 16,548 ảnh (36.73%)
- **cam3**: 6,615 ảnh (14.68%)
- **cam4**: 2,330 ảnh (5.17%)
- **UNKNOWN**: 900 ảnh (2.00%)
- **cam5**: 343 ảnh (0.76%)
- **cam6**: 62 ảnh (0.14%)
- **cam11**: 24 ảnh (0.05%)
- **cam8**: 22 ảnh (0.05%)
- **cam9**: 21 ảnh (0.05%)

---

## 3. Khả năng Tạo Cặp Cross-Camera và Phân bố Co-occurrence

- Trong tập `train_subset` (45.050 ảnh, 3.190 ID), có **3,047 ID** xuất hiện trên nhiều camera.
- Số lượng cross-camera positive pairs trung bình trên mỗi multi-camera ID là: **56.93 cặp**.
- Với batch size thực tế $P=8$ identities, $K=4$ images/ID (batch 32), sampler cân bằng camera có thể đảm bảo mỗi batch chứa trung bình từ 8 đến 16 cặp cross-camera positive hữu dụng, hoàn toàn khả thi để huấn luyện Cross-Camera Supervised Contrastive Loss ($L_{CC}$).
- Chi tiết ma trận co-occurrence camera `camera_a × camera_b` đã được lưu tại: `outputs/cross_camera/phase0/identity_camera_matrix.csv`.

---

## 4. Kiểm tra Confounding giữa Camera và Chất lượng Ảnh

Phân tích trên mẫu ngẫu nhiên cho thấy:
- Kích thước khuôn mặt được chuẩn hóa và crop sẵn theo chip (112x112 hoặc tương đương).
- Độ mờ (Laplacian variance) và độ sáng trung bình có sự dao động giữa các camera: một số camera giám sát góc rộng có độ mờ cao hơn và ánh sáng yếu hơn.
- Do đó, giả thuyết H3 (Quality-gating) và phân tích phân tầng theo camera là rất cần thiết để tránh trường hợp mạng chỉ học các đặc trưng nhân tạo của từng camera.
- Chi tiết phân tầng: `outputs/cross_camera/phase0/camera_quality_stratification.csv`.

---

## 5. Audit Provenance Checkpoint và Checksum

| Tên Checkpoint | Kích thước | SHA256 Checksum | Trạng thái |
|---|---:|---|---|
| `buffalo_l_w600k_r50.onnx` | 174,383,860 bytes | `4c06341c33c2ca1f...` | Sẵn sàng |
| `b0_best_checkpoint.pt` | 174,518,346 bytes | `36e6f2de3389cdb8...` | Sẵn sàng |
| `adaface_ir50_ms1mv2.ckpt` | 700,286,703 bytes | `234da6ce931f821e...` | Sẵn sàng |

---

## 6. Khuyến nghị Kỹ thuật cho Chặng Tiếp Theo (B2 / E1 / E2 / E3)

1. **Khóa Episode Đánh giá (Frozen Protocol):**
   - Sinh cố định 10 episodes (seed 2026–2035) cho cả hai giao thức **P-MIXED** và **P-CROSS**.
   - Với P-CROSS, mated probe bắt buộc phải khác camera với ảnh gallery của cùng ID.
   - Nonmates chia làm hai phần: calibration (để calibrate threshold tại target FPIR 1%) và validation (để đo TPIR và achieved FPIR).
2. **Baseline B2:** Tái lập huấn luyện ArcFace R50 với sampler chuẩn và ArcFace ID loss trên `train_subset`.
3. **E1:** Tích hợp `CameraBalancedBatchSampler` ($P \times K$).
4. **E2:** Bổ sung Cross-Camera SupCon loss $L_{CC}$ với sampler chuẩn.
5. **E3:** Kết hợp $P \times K$ sampler và $L_{CC}$.

*Báo cáo được khởi tạo tự động phục vụ Gate 0 theo đúng Kế hoạch Triển khai Nghiên cứu Hướng B.*
