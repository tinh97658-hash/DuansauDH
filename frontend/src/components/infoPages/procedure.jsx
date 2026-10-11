import React from "react";
import "../overviewPages.css";

export default function Procedure() {
  return <section className="overview-info overview-procedure" aria-labelledby="overview-procedure-title">
    <h1 id="overview-procedure-title">Quy trình đào tạo sau đại học</h1>
    <p className="overview-info-subtitle">Trình bày theo luồng để nhìn một lần là hiểu thứ tự xử lý.</p>
    <ol className="overview-steps">
      <li><span className="overview-step-number">01</span><div><h2>Thực hiện kế hoạch học tập & nghiên cứu</h2><p>Học viên, nghiên cứu sinh thực hiện kế hoạch học tập và nghiên cứu đã được phê duyệt.</p></div></li>
      <li><span className="overview-step-number">02</span><div><h2>Báo cáo tiến độ đúng kỳ hạn</h2><p>Có xác nhận của giảng viên hướng dẫn và đơn vị chuyên môn theo yêu cầu từng giai đoạn.</p></div></li>
      <li><span className="overview-step-number">03</span><div><h2>Hoàn thành học phần & chuẩn đầu ra</h2><p>Đảm bảo các nghĩa vụ theo quy chế đào tạo hiện hành trước khi chuyển sang giai đoạn đánh giá.</p></div></li>
      <li><span className="overview-step-number">04</span><div><h2>Nộp hồ sơ, đánh giá, bảo vệ & xét tốt nghiệp</h2><p>Nộp hồ sơ luận văn hoặc luận án để tổ chức đánh giá, bảo vệ và xét công nhận tốt nghiệp.</p></div></li>
    </ol>
    <p className="overview-info-note">Biểu mẫu và mốc thời gian cụ thể được Viện Đào tạo Sau đại học thông báo theo từng khóa.</p>
  </section>;
}
