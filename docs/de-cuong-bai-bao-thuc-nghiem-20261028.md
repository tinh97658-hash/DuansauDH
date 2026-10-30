# Đề cương bài báo thực nghiệm — phiên bản 1

**Bổ sung development 29/10/2026:** đã hoàn tất [fusion và fixed-probe nested gallery](arcface-adaface-dev-20261029/README.md). Fusion 50/50 tăng frozen N300 rank-1 31,93% → 33,83%, nhưng FNIR delta CI chứa 0 và attained FPIR khác nhau. Nested giữ nguyên probe cho thấy giảm ranking và tăng FPIR khi thêm distractor ở fixed cutoff. Đây là khối exploratory mới; không thay số test/paper đã đóng băng, không xác lập physical-camera transfer.

Ngày kiểm kê: 28/10/2026. Chỉ đối chiếu báo cáo, CSV/JSON và mã phân tích đã lưu; không inference, chọn model/ngưỡng hoặc chạy lại thí nghiệm. Tài liệu này là kế hoạch biên tập, chưa thay bản thảo đã đóng băng.

**Tiến độ bổ sung:** đã hoàn tất [phân rã FNIR và paired AURC CI](ket-qua-phan-ra-fnir-aurc-20261028.md) từ cached embeddings, dùng nguyên cutoff cũ. Phân tích này là hậu kiểm mới, không phải kết quả confirmatory hoặc thí nghiệm mô hình mới.

**Audit metadata:** [camera/session và thành phần episode](audit-camera-session-20261028.md) đã kiểm tra xong. Session trống toàn bộ; test thiếu token camera 3,7%; chưa xác minh namespace camera vật lý. Gallery hiện tại được sample trên toàn bộ ảnh của identity, có trộn source-role gallery/mated; phải viết rõ custom protocol. Fixed-probe nested-gallery development đã bổ sung ngày 29/10; source-role-preserving protocol và dữ liệu camera ứng dụng còn thiếu.

## 1. Câu hỏi và thông điệp chính

**Câu hỏi:** Trong single-shot open-set 1:N trên ảnh mặt rất nhỏ, cải thiện đặc trưng, thông tin chất lượng và chuyển ngưỡng ảnh hưởng khác nhau thế nào đến lỗi định danh và lỗi từ chối?

**Tên làm việc:** *Recognition, Rejection, and Quality: An Empirical Study of Single-Shot Open-Set Face Identification on Native Low-Resolution Images*.

Thông điệp hiện được hỗ trợ: ở protocol QMUL tùy chỉnh đã khảo sát, domain adaptation tăng rank-1; quality proxy cung cấp tín hiệu selective yếu hơn score; các policy đã thử chưa cho thấy lợi ích FNIR ở operating points được báo cáo. Chưa suy rộng thành “calibration vô ích”, “AdaFace kém” hoặc “quality không có tác dụng”.

## 2. Phạm vi và đóng góp dự kiến

Một ảnh nguồn/gallery identity; single-image probe; N=100/300/400; QMUL-SurvFace native LR là bối cảnh chính, LFW là sanity check. Đây không phải official QMUL benchmark. Giữ riêng ba khối bằng chứng: kết quả paper cũ; risk–coverage post-hoc; đối chứng development ngày 28/10 với protocol unknown calibration/validation mới.

Đóng góp dự kiến:

1. Định lượng phần lỗi do sai rank-1 và phần do reject một probe đã xếp đúng, trong cùng episode và policy.
2. Đánh giá giá trị gia tăng của quality proxy so với score bằng paired comparisons và risk–coverage; phân biệt correlation với lợi ích quyết định.
3. Phân biệt hiệu quả khi chọn cutoff trên calibration với khả năng chuyển cutoff sang validation/camera/gallery khác.

Đóng góp 1 hiện có phân rã trực tiếp tại N=300 cho base và hai quality gates; đóng góp 2 đã có paired CI có điều kiện trên gallery cố định. Đóng góp 3 có thêm thí nghiệm development giữ cutoff N100 khi tăng distractor, chưa có physical-camera transfer. Teacher reliability/distillation là nhánh nghiên cứu sau; chưa có thực nghiệm để đưa vào kết luận bài này.

## 3. Kết quả đã có thể sử dụng, với giới hạn

| Khối | Số liệu đối chiếu artifact | Cách dùng trong bài |
|---|---|---|
| Paper cũ, test rank-1 N=300 | Pretrained 0,132; adapted+flip 0,364, SD seed 0,017 | Bằng chứng cải thiện ranking trong recipe đã thử; không cô lập riêng loss hoặc TTA |
| Paper cũ, calibration N=300 seed 2026 | B0 FNIR 0,880; P1 0,8867; cả hai test FPIR quan sát 0/300 | Mô tả chưa thấy cải thiện; không coi 0/300 là rủi ro bằng 0 hoặc bằng target 1% |
| Risk–coverage, test N=300, 5 seed | AURC gap 0,5948; score 0,3494; random reference 0,6360 | Post-hoc; paired CI gap−score [+0,2207;+0,2672], có điều kiện trên gallery cố định |
| Policy open-set cũ, test N=300 | Base FNIR/FPIR 0,8473/0,00667; gap 0,8660/0,00267 | Hai trade-off khác nhau; không phải so FNIR tại cùng FPIR thực tế |
| Dev mới, adapted ArcFace none→flip N=300 | Rank-1 0,3040→0,3193; chênh +1,53 điểm, CI identity [+0,60;+2,50] | Phát hiện exploratory về TTA |
| Cùng khối dev mới | FNIR 0,8783→0,8703; FPIR 0,00867→0,01133 | Không kết luận TTA tốt hơn tại cùng risk |
| Sanity dev LFW | AdaFace 96,0%; ArcFace 95,5%; wrapper parity đã ghi | Hỗ trợ tính đúng kỹ thuật, không xác nhận native-LR generalization |

Không trộn rank-1 0,364 trung bình nhiều seed với rank-1 0,370 của episode calibration seed 2026 để phân rã lỗi. SD theo episode seed không phải CI giữa các danh tính độc lập. Gate rank-1 40% là quyết định nội bộ, không phải tiêu chuẩn xuất bản hoặc ngưỡng có ý nghĩa phổ quát.

## 4. Hai điểm phải sửa trong câu chuyện của bản thảo

**Abstention thuần túy không tăng số nhận đúng:** với correctness C và mask giữ K, `mean(C & K) <= mean(C)`. Thêm K vào accept set cố định cũng không thể làm FNIR giảm. Đây là tính chất của thiết kế; không dùng riêng nó làm negative finding. Câu hỏi hữu ích là cùng mức risk/coverage thì quality chọn mẫu có tốt hơn score/random không, hoặc policy được calibration lại trên dev có tạo trade-off tốt hơn không.

**Rank-1 đặt trần recall nhưng chưa đủ chứng minh bottleneck duy nhất.** Trên đúng cùng mated probes, ranking cố định và quyết định accept A:

```text
FNIR = P(top1 sai) + P(top1 đúng và reject)
     = 1 - rank1 + P(top1 đúng và reject)
DIR  = P(top1 đúng và accept) <= rank1
```

Hai hạng lỗi phải được đếm riêng theo seed. Không gọi hạng thứ hai là “lỗi ngưỡng thuần túy” nếu reject còn do quality/detection gate. Giới hạn cosine fixed-ranking cũng không áp dụng nguyên xi cho phương pháp reranking.

## 5. Bố cục bài và bảng/hình

1. **Introduction:** single-shot 1:N; phân biệt ranking, rejection và selective quality; nêu câu hỏi thực nghiệm.
2. **Related work:** FIQA, open-set calibration, selective prediction; PETALface/EKD/IDL-RTM để định vị phạm vi, không đưa vào bảng benchmark như đã tái lập.
3. **Protocol và metrics:** đơn vị gallery/probe, split, preprocessing chip-mode, cutoff selection, định nghĩa FNIR/FPIR và công thức phân rã.
4. **Results:** representation comparison; phân rã lỗi; quality vs score; cutoff transfer. Tách exploratory development khỏi post-hoc test.
5. **Discussion:** điều gì có thể kết luận trong protocol này; native/synthetic LR; giới hạn proxy, backbone và sample size.

Bảng 1: protocol ledger cho từng khối kết quả. Bảng 2: rank-1/FNIR/FPIR với cùng episode và sample counts. Bảng 3: hai hạng FNIR và paired uncertainty. Hình 1: score distributions/DET. Hình 2: risk–coverage score/quality/random. Hình 3: camera hoặc N transfer chỉ khi có protocol so sánh hợp lệ.

## 6. Bằng chứng bổ sung tối thiểu trước khi viết lại kết luận

| Ưu tiên | Phân tích cần có | Điều kiện hoàn thành |
|---|---|---|
| P0 | Chuẩn hóa protocol ledger và từ ngữ | Mọi số có run/split/seed/policy; bỏ diễn giải “cùng FPIR” sai và claim từ bất đẳng thức hiển nhiên |
| P1, đã làm tại N=300 | Phân rã FNIR từ cached embeddings/cutoff | 30 policy rows khớp FNIR/FPIR cũ; count phân hoạch đúng; base/test 0,6360 + 0,2113 = 0,8473 |
| P1, đã làm có điều kiện | Paired CI quality vs score/random | Bootstrap 400 identities qua cả năm seeds; 2.000 replicates; kiểm tra ties; chưa bao gồm gallery/model variability |
| P1, đã bổ sung pointwise | Đánh giá ngưỡng với unknown sample counts | Báo FP từng episode; Wilson CI; camera/session dependence chưa audit |
| P2, metadata đã audit | Strata camera/kích thước đã định nghĩa trước | Chỉ có filename-camera tokens; session trống và thiếu token ở 74 ảnh test; chỉ làm mô tả token, chưa claim physical-camera transfer |
| P2, đã làm trên dev 29/10 | Fixed-probe nested-gallery study | Giữ cùng mated/unknown photos và gallery photo cho ID chung; N100/300/400 chỉ thêm distractor; 360 invariant checks PASS. Giới hạn nguồn-role/camera vẫn còn |

Các phần chưa hoàn tất của P0/P2 và giới hạn còn lại ở P1 là backlog. Phân tích mới trên test đã xem được báo post-hoc; không đổi checkpoint hoặc policy theo test rồi tiếp tục gọi confirmatory. Audit camera/session và fixed-probe nested development đã hoàn tất; ưu tiên tiếp theo là source-role-preserving development protocol và dữ liệu camera ứng dụng.

## 7. Khi nào đủ để chuyển sang hoàn thiện bản thảo?

Hoàn tất P0/P1, truy được từng bảng về artifact, có ít nhất một kết quả không hiển nhiên vượt ngoài việc đổi mẫu số/giảm coverage, và đặt kết luận đúng độ phủ dữ liệu. Nếu chưa có camera/N study hợp lệ, thu hẹp câu hỏi và bỏ claim tương ứng thay vì mở thêm nhánh model.

Chưa có external native-LR evaluation nên không claim cross-dataset. Chưa có causal control cùng recipe/pretraining nên không gán chênh lệch checkpoint cho riêng ArcFace/AdaFace loss. Chưa có bằng chứng teacher transfer nên không đặt teacher reliability trong tiêu đề chính.

Số liệu headline đã qua script audit hiện có: **49/49 checks pass**. Audit kiểm tra nhất quán số với artifact, không chứng nhận tính hợp lệ của thiết kế hoặc khả năng được nhận đăng. Không chọn tạp chí hay xác nhận quartile trong tài liệu này.

Liên kết: [bảng bằng chứng](bang-bang-chung-bai-bao-20261028.csv), [biên bản đối chiếu artifact](kiem-ke-bang-chung-20261028.json), [định vị thuật toán v0.2](doi-chieu-tinh-moi-distillation-20261028.md).
