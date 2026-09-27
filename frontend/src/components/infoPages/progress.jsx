import React from "react";
import { Card, CardContent } from "@mui/material";
const ProgressReview = () => <Card sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: 4 }}>
  <h1>Đánh giá tiến độ học tập và nghiên cứu</h1>
  <p className="mt-4">Học viên và nghiên cứu sinh phải báo cáo tiến độ định kỳ theo kế hoạch đào tạo.</p>
  <ul>
    <li className="mb-3">Nội dung đã hoàn thành so với kế hoạch được duyệt.</li>
    <li className="mb-3">Kết quả nghiên cứu, công bố khoa học và sản phẩm chuyên môn.</li>
    <li className="mb-3">Khó khăn, thay đổi kế hoạch và đề xuất hỗ trợ.</li>
    <li className="mb-3">Nhận xét của giảng viên hướng dẫn và kết luận của đơn vị chuyên môn.</li>
  </ul>
</CardContent></Card>;
export default ProgressReview;
