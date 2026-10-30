# TỔNG HỢP TOÀN DIỆN: HÀNH TRÌNH NGHIÊN CỨU NHẬN DIỆN KHUÔN MẶT GIÁM SÁT CỰC THẤP
## (Single-Shot Open-Set Surveillance Face Identification)

> **Thời điểm cập nhật:** 29/10/2026  
> **Mục tiêu công bố:** Tạp chí Scopus/WoS Q2–Q3, **hoàn toàn không mất phí xuất bản (No APC)**  
> **Đơn vị / Dự án:** Viện Đào tạo Sau đại học & Dự án Điểm danh tự động (PG SMS)  
> **Môi trường thực nghiệm:** RTX 3060 Laptop 6GB (Local) & Kaggle Tesla T4 (Cloud Training)  

---

## MỤC LỤC
1. [Bối cảnh nghiệp vụ & Bài toán khoa học](#1-bối-cảnh-nghiệp-vụ--bài-toán-khoa-học)
2. [Hồi 1: Cú sốc thực tế & Sự sụp đổ của Baseline](#2-hồi-1-cú-sốc-thực-tế--sự-sụp-đổ-của-baseline)
3. [Hồi 2: Cuộc giải cứu đặc trưng (Representation Rescue)](#3-hồi-2-cuộc-giải-cứu-đặc-trưng-representation-rescue)
4. [Hồi 3: Nghịch lý của quy mô dữ liệu (The Data Scale Paradox)](#4-hồi-3-nghịch-lý-của-quy-mô-dữ-liệu-the-data-scale-paradox)
5. [Hồi 4: Ảo vọng của các "Phép màu" Phục hồi khuôn mặt (Super-Resolution & Alignment)](#5-hồi-4-ảo-vọng-của-các-phép-màu-phục-hồi-khuôn-mặt-super-resolution--alignment)
6. [Bảng tổng hợp kết quả toàn diện](#6-bảng-tổng-hợp-kết-quả-toàn-diện)
7. [Định vị bài báo khoa học & Chiến lược xuất bản Không APC](#7-định-vị-bài-báo-khoa-học--chiến-lược-xuất-bản-không-apc)

---

## 1. BỐI CẢNH NGHIỆP VỤ & BÀI TOÁN KHOA HỌC

### 1.1. Xuất phát điểm từ thực tế
Hệ thống điểm danh tự động của Viện Đào tạo Sau đại học đặt ra các ràng buộc thực tế khắc nghiệt:
1. **Single-shot enrollment (Đúng 1 ảnh đăng ký):** Mỗi học viên/giảng viên chỉ cung cấp đúng 1 ảnh thẻ chất lượng cao khi nhập học. Không có dữ liệu nhiều góc chụp hay video đăng ký.
2. **Open-set 1:N (Nhận diện tập mở):** Trong giảng đường và hành lang có cả người đã đăng ký lẫn người ngoài (khách, học viên lớp khác). Hệ thống bắt buộc phải có cơ chế trả về `UNKNOWN`. Nhận nhầm người lạ thành người quen (**False Accept**) gây sai lệch điểm danh và vi phạm quy chế.
3. **Domain Shift & Extreme Low-Resolution:** Ảnh đăng ký là ảnh tĩnh, rõ nét ($112\times 112$ hoặc lớn hơn), trong khi ảnh nhận diện cắt từ camera an ninh/giám sát có kích thước cực nhỏ, nhòe chuyển động và sai khác góc nhìn.

### 1.2. Chuẩn mực thực nghiệm (Benchmark)
* **Dataset chính:** **QMUL-SurvFace** (463.507 ảnh / 15.573 danh tính). Khuôn mặt thực tế cắt từ camera chỉ đạt kích thước **$9\times 10$ đến $28\times 31$ pixel**.
* **Protocol chống rò rỉ (Strict Anti-Leakage):**
  * Chia tách danh tính độc lập hoàn toàn (Identity-Disjoint) giữa Train, Development và Test.
  * Chỉ dùng đúng 1 ảnh/ID cho Gallery.
  * Mọi tham số, ngưỡng, lựa chọn mô hình chỉ thực hiện trên tập **Development** (2.000 ảnh). Tập **Test đóng kín** và chỉ chạy 1 lần duy nhất để báo cáo.
* **Thước đo cốt lõi:** 
  * Closed-set: **Rank-1 Identification Accuracy** ($N=100, 300, 400$).
  * Open-set: **FNIR @ FPIR mục tiêu** (False Negative Identification Rate tại mức False Positive ấn định trước, ví dụ $1\%$).

---

## 2. HỒI 1: CÚ SỐC THỰC TẾ & SỰ SỤP ĐỔ CỦA BASELINE

### 2.1. Giả thuyết ban đầu
Ban đầu, nghiên cứu đặt giả thuyết rằng vấn đề cốt lõi nằm ở **Confidence Calibration** (Hiệu chỉnh độ tin cậy) do độ lệch chất lượng (Quality Gap) giữa ảnh thẻ và camera. Nếu mô hình hóa khoảng cách chất lượng và điểm số khoảng cách Top-1 / Top-2, hệ thống sẽ kiểm soát được ngưỡng Accept/Reject.

Đề ra **Gate nội bộ:** Rank-1 dev ($N=300$) phải đạt tối thiểu **$\ge 40\%$** thì calibration mới có ý nghĩa triển khai.

### 2.2. Sự sụp đổ của công nghệ chuẩn
* **SCRFD Detector thất bại 100%:** Khi đưa các mẫu ảnh QMUL $9 - 28\text{ px}$ vào bộ phát hiện SCRFD (det_10g), detector không phát hiện được bất kỳ khuôn mặt nào. 
* **Landmark 1k3d68 thất bại:** Các điểm mốc dồn cục vào tâm, không thể căn chỉnh (alignment) 5 điểm.
* **Bắt buộc dùng Chip Mode:** Cắt trực tiếp vùng mặt và dùng phép nội suy Bicubic phóng đại gấp 4–12 lần lên chuẩn $112\times 112\text{ px}$.
* **ArcFace Pretrained sụp đổ:** Mô hình InsightFace ArcFace ResNet-50 (vốn đạt trên $96\%$ ở LFW) khi đưa vào QMUL custom one-shot chỉ đạt **10,40% Rank-1** ($N=300$).

> **Bài học rút ra 1:** Calibration không thể cứu vãn một không gian đặc trưng (representation) mà ở đó vector của người đúng thậm chí không lọt nổi vào Top-1. Nút thắt đầu tiên là **Representation**.

---

## 3. HỒI 2: CUỘC GIẢI CỨU ĐẶC TRƯNG (REPRESENTATION RESCUE)

Để giải quyết bài toán biểu diễn, một loạt thí nghiệm thích ứng miền (Domain Adaptation) đã được tiến hành:

1. **Fine-tuning ArcFace R50 trên QMUL Train Subset (78.733 ảnh / 5.319 ID):**
   * Huấn luyện 15 epoch với hàm mất mát ArcFace (scale 64, margin 0.5), chip mode $112\times 112$.
   * Thêm kỹ thuật **Test-Time Augmentation (Flip)**: Trích xuất embedding ảnh gốc và ảnh lật ngang, chuẩn hóa rồi lấy trung bình.
   * **Kết quả:** Rank-1 dev $N=300$ tăng từ **10,40% lên 31,93%** (tăng gấp hơn 3 lần).
2. **Khảo sát AdaFace (CVPR 2022 - Mô hình chuyên trị ảnh chất lượng thấp):**
   * Checkpoint pretrained chính thức trên MS1MV2 chỉ đạt **4,27%** trên QMUL.
   * Tiến hành fine-tune 15 epoch trên Kaggle Tesla T4: Rank-1 vọt lên **31,80%**.
3. **Khảo sát LVFace-B (Glint360K):**
   * Checkpoint pretrained chỉ đạt **10,37%**.
4. **Fusion đa mô hình (ArcFace FT + AdaFace FT):**
   * Kết hợp điểm số $50/50$ giúp Rank-1 dev $N=300$ nhích lên **33,83%** (và đạt **35,60%** trong bài toán nested gallery).

> **Bức tường vô hình:** Mọi nỗ lực kiến trúc và hàm mất mát đều chạm trần tại ngưỡng **32% – 34%**. Gate $40\%$ vẫn không thể vượt qua bằng các phương pháp fine-tune thông thường.

---

## 4. HỒI 3: NGHỊCH LÝ CỦA QUY MÔ DỮ LIỆU (THE DATA SCALE PARADOX)

### 4.1. Thí nghiệm Full-Data (220.888 ảnh)
Do tập train QMUL gốc có 220k ảnh nhưng manifest cũ bị giới hạn 40 ảnh/ID (chỉ dùng 78k ảnh), giả thuyết đặt ra là: *"Mở rộng toàn bộ 220k ảnh sẽ cung cấp đủ biến thiên để vượt qua trần 32%."*

Đã triển khai huấn luyện 15 epoch trên Kaggle T4 với 2 bộ lấy mẫu:
* **Natural Sampler:** Lấy mẫu tự nhiên theo phân phối gốc.
* **Sqrt Sampler:** Cân bằng lớp với trọng số $1/\sqrt{n_i}$.

### 4.2. Phát hiện khoa học quan trọng: Sự phân ly giữa Rank-1 và FNIR
* **Về Rank-1 đóng:** Checkpoint Natural Best đạt **33,20%** (tăng nhẹ $+1,27\%$ so với subset).
* **Về Open-Set Security:** Khi đo FNIR tại FPIR $1\%$, kết quả của Natural Best **sụp đổ hoàn toàn: FNIR vọt lên 99,67%!** (Hệ thống từ chối nhận diện gần như toàn bộ người quen hợp lệ).
* **Bản chất cơ chế:** Dữ liệu lớn không cân bằng làm phồng phương sai điểm số mated, giảm chỉ số phân tách phân phối $d'$ từ $0,720$ xuống $0,531$, buộc ngưỡng calibrated threshold phải đẩy lên tận $0,87$. Hậu quả là **hệ thống loại oan 32,8% những trường hợp vốn đã được xếp đúng Top-1**.

> **Đóng góp khoa học cốt lõi:** **Closed-set Rank-1 và Open-set FNIR@FPIR không đồng biến.** Tối ưu hóa đơn thuần theo Rank-1 có thể tạo ra một mô hình hoàn toàn phế thải và nguy hiểm trong bài toán kiểm soát an ninh mở.

---

## 5. HỒI 4: ẢO VỌNG CỦA CÁC "PHÉP MÀU" PHỤC HỒI KHUÔN MẶT (SUPER-RESOLUTION & ALIGNMENT)

Để trả lời phản biện kinh điển của các Reviewer: *"Tại sao không phục hồi (Restoration) hoặc căn chỉnh (Alignment) khuôn mặt trước khi nhận diện?"*, toàn bộ các phương pháp tiền xử lý tiên tiến nhất đã được đưa vào kiểm chứng thực nghiệm trực tiếp trên cùng tập Development $N=300$:

| Nhánh kỹ thuật | Rank-1 ↑ | FNIR @ FPIR 1% ↓ | FPIR thực tế | Đánh giá |
|---|---:|---:|---:|---|
| **Baseline (ArcFace FT + Flip)** | **31,93%** | **87,03%** | 1,13% | **Tốt nhất hiện tại** |
| **Resize hai bước (Two-step)** | 31,80% | 86,93% | 1,07% | Không cải thiện |
| **Alignment đơn thuần** | 27,70% | 90,13% | 0,87% | Tụt $-4,23\%$ do trôi landmark |
| **GFPGAN v1.4** | **22,33%** | **96,27%** | 1,00% | **Sụp đổ hoàn toàn ($-9,60\%$)** |
| **CodeFormer ($w=1$)** | **22,97%** | **95,87%** | 1,07% | **Sụp đổ hoàn toàn ($-8,96\%$)** |

### Bản chất hiện tượng "Ảo giác danh tính" (Identity Hallucination)
1. **Tại sao Alignment thất bại (27,70%)?** Trên ảnh $9 - 28\text{ px}$, các điểm mốc giải phẫu (mắt, mũi, khóe miệng) bị nhòe thành các cụm pixel mờ. Thuật toán landmark bị trôi (jitter), dẫn đến phép xoay nắn affine làm biến dạng hình học khuôn mặt nghiêm trọng hơn là để nguyên chip vuông.
2. **Tại sao GFPGAN & CodeFormer làm hỏng nhận diện (22%)?**
   * Các mô hình Generative Prior sử dụng mạng nơ-ron sinh để bù đắp chi tiết bị mất dựa trên phân phối người mẫu sắc nét (FFHQ).
   * Ở độ phân giải cực thấp, tín hiệu danh tính thực sự không còn đủ để neo giữ bộ sinh. Mô hình **tự "bịa" ra các đường nét giả** (mí mắt, sống mũi, vân môi của một người khác).
   * Mắt người nhìn vào thấy ảnh "rõ và đẹp", nhưng dưới con mắt sinh trắc học của ArcFace, **vector đặc trưng đã biến thành một người hoàn toàn xa lạ**.

---

## 6. BẢNG TỔNG HỢP KẾT QUẢ TOÀN DIỆN

### 6.1. Ma trận tiến hóa mô hình (Dev $N=300$)
```
[Pretrained ArcFace]  ──► 10,40% Rank-1
         │
[Fine-tune QMUL Subset] ──► 31,93% Rank-1  (Cải thiện x3 lần)
         │
         ├───► [+ AdaFace Fusion]       ──► 33,83% Rank-1
         ├───► [+ Full-Data 220k]       ──► 33,20% Rank-1 (FNIR nát 99,7%)
         ├───► [+ Naive Alignment]      ──► 27,70% Rank-1 (Méo hình do trôi landmark)
         └───► [+ GFPGAN / CodeFormer]  ──► 22,33% Rank-1 (Phá hủy danh tính do Hallucination)
```

### 6.2. Phân tầng kích thước khuôn mặt (Strata Analysis)
Bảng phân tích trên tập dev cho thấy ranh giới vật lý không thể vượt qua nếu không có cảm biến tốt hơn:
* **Nhóm cực nhỏ ($7 - 15\text{ px}$):** Rank-1 chỉ đạt **28,0%**.
* **Nhóm trung bình ($16 - 21\text{ px}$):** Rank-1 đạt **36,0%**.
* **Nhóm lớn hơn ($22 - 35\text{ px}$):** Rank-1 đạt **34,5%**.

---

## 7. ĐỊNH VỊ BÀI BÁO KHOA HỌC & CHIẾN LƯỢC XUẤT BẢN KHÔNG APC

### 7.1. Chuyển dịch định vị: Từ "Thuật toán cải tiến" sang "Nghiên cứu thực nghiệm sắc bén"
Thay vì cố che giấu kết quả âm để gượng ép tuyên bố "thuật toán mới vượt trội", bài báo được tái định vị thành một **Empirical / Benchmark Paper** có giá trị cảnh báo và định hướng cao cho cộng đồng:

* **Tên bài báo đề xuất:**  
  * *"Empirical Limits of Single-Shot Open-Set Surveillance Face Identification: From Domain Adaptation Bottlenecks to the Pitfalls of Generative Restoration"*  
  *(Giới hạn thực nghiệm của nhận diện khuôn mặt giám sát tập mở một ảnh: Từ nút thắt thích ứng miền đến cạm bẫy của phục hồi tạo sinh)*
* **5 Đóng góp khoa học cốt lõi (Contributions):**
  1. Xây dựng một benchmark kiểm chứng nghiêm ngặt, minh bạch, hoàn toàn identity-disjoint cho bài toán Single-Shot Open-Set trên dữ liệu giám sát cực thấp ($<30\text{ px}$).
  2. Chứng minh thực nghiệm rằng **Generative Face Restoration (GFPGAN, CodeFormer) gây tổn hại sinh trắc học nghiêm trọng (Identity Distortion)**, làm sụt giảm gần $10\%$ Rank-1.
  3. Bác bỏ ngộ nhận về căn chỉnh landmark trên ảnh siêu nhỏ: Alignment không chuẩn xác làm giảm hiệu năng so với nội suy trực tiếp.
  4. Phát hiện hiện tượng **phân ly Rank-1 vs FNIR**: Tăng quy mô dữ liệu huấn luyện không kiểm soát có thể cải thiện nhẹ Rank-1 đóng nhưng phá hủy hoàn toàn khả năng hiệu chỉnh ngưỡng tập mở.
  5. Cung cấp gói thực nghiệm tái lập đầy đủ (Reproducibility Package) phục vụ cộng đồng nghiên cứu biometrics.

### 7.2. Danh sách Tạp chí mục tiêu: Uy tín Scopus Q2–Q3, Hoàn toàn Miễn phí (No APC)

| Tạp chí | Nhà xuất bản | Phân hạng | Chính sách APC | Điểm phù hợp |
|---|---|---|---|---|
| **IET Biometrics** | Wiley / IET | Scopus Q2, WoS | **Miễn phí** (chọn mô hình Subscription truyền thống) | Chuyên sâu về sinh trắc học, rất chuộng các bài empirical vạch ra điểm yếu thực tế |
| **Pattern Recognition Letters** | Elsevier | Scopus Q1–Q2 | **Miễn phí** (Subscription) | Định dạng Short Paper, đánh giá rất cao các phát hiện phản trực giác sắc bén |
| **Signal, Image and Video Processing (SIVP)** | Springer | Scopus Q2–Q3 | **Miễn phí** (Hybrid - chọn Subscription) | Phạm vi xử lý video/giám sát, tốc độ phản biện ổn định |
| **Machine Vision and Applications** | Springer | Scopus Q2–Q3 | **Miễn phí** (Hybrid - chọn Subscription) | Hướng ứng dụng công nghiệp và thị giác máy tính thực tế |
| **Journal of Visual Communication and Image Representation** | Elsevier | Scopus Q2–Q3 | **Miễn phí** (Subscription) | Phù hợp bài báo phân tích chất lượng ảnh và biểu diễn thị giác |

---

## TỔNG KẾT

Dự án không dừng lại ở một "thất bại vượt gate", mà đã đi đến tận cùng bản chất vật lý của bài toán thị giác máy tính trong điều kiện giám sát thực tế. Toàn bộ chuỗi thực nghiệm — từ ArcFace, AdaFace, Full-data 220k, đến GFPGAN, CodeFormer và Alignment — tạo thành một hệ thống luận cứ vững chắc, trung thực và đầy đủ sức nặng khoa học để tự tin công bố quốc tế.
