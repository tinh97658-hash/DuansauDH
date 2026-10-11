import React from "react";
import "../overviewPages.css";

export default function ProgressReview() {
  return <section className="overview-info overview-progress" aria-labelledby="overview-progress-title">
    <h1 id="overview-progress-title">Đánh giá tiến độ học tập và nghiên cứu</h1>
    <p className="overview-info-subtitle">Học viên và nghiên cứu sinh phải báo cáo tiến độ định kỳ theo kế hoạch đào tạo.</p>
    <ol className="overview-steps">
      <li><span className="overview-step-number">01</span><div><h2>Nội dung đã hoàn thành</h2><p>Đánh giá mức độ hoàn thành so với kế hoạch đã được duyệt.</p><span className="overview-card-accent" aria-hidden="true" /></div></li>
      <li><span className="overview-step-number">02</span><div><h2>Kết quả nghiên cứu</h2><p>Công bố khoa học, sản phẩm chuyên môn và các kết quả nghiên cứu nổi bật.</p><span className="overview-card-accent" aria-hidden="true" /></div></li>
      <li><span className="overview-step-number">03</span><div><h2>Khó khăn & thay đổi</h2><p>Ghi nhận trở ngại, thay đổi kế hoạch và đề xuất hỗ trợ.</p><span className="overview-card-accent" aria-hidden="true" /></div></li>
      <li><span className="overview-step-number">04</span><div><h2>Nhận xét & kết luận</h2><p>Nhận xét của giảng viên hướng dẫn và kết luận của đơn vị chuyên môn.</p><span className="overview-card-accent" aria-hidden="true" /></div></li>
    </ol>

  </section>;
}
