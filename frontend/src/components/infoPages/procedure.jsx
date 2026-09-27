import React from "react";
import { Card, CardContent } from "@mui/material";
const Procedure = () => <Card sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: 4 }}>
  <h1>Quy trình đào tạo sau đại học</h1>
  <ol className="mt-4">
    <li className="mb-3">Học viên, nghiên cứu sinh thực hiện kế hoạch học tập và nghiên cứu đã được phê duyệt.</li>
    <li className="mb-3">Báo cáo tiến độ đúng kỳ hạn, có xác nhận của giảng viên hướng dẫn và đơn vị chuyên môn.</li>
    <li className="mb-3">Hoàn thành học phần, chuẩn đầu ra và các nghĩa vụ theo quy chế đào tạo hiện hành.</li>
    <li className="mb-3">Nộp hồ sơ luận văn hoặc luận án để tổ chức đánh giá, bảo vệ và xét công nhận tốt nghiệp.</li>
  </ol>
  <p className="text-muted mb-0">Biểu mẫu và mốc thời gian cụ thể được Viện Đào tạo Sau đại học thông báo theo từng khóa.</p>
</CardContent></Card>;
export default Procedure;
