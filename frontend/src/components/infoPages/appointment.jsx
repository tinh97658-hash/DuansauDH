import React from "react";
import { Card, CardContent } from "@mui/material";
const Appointment = () => <Card sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: 4 }}>
  <h1>Thành lập hội đồng đánh giá</h1>
  <p className="mt-4">Việc đề xuất và thành lập hội đồng đánh giá luận văn, luận án được thực hiện theo quy chế của Trường Đại học Hàng hải Việt Nam.</p>
  <ul>
    <li className="mb-3">Thành viên đáp ứng yêu cầu về chuyên môn, học vị và tính độc lập.</li>
    <li className="mb-3">Hồ sơ đề nghị phải đầy đủ và được đơn vị chuyên môn xác nhận.</li>
    <li className="mb-3">Lịch đánh giá chỉ được công bố sau khi có quyết định chính thức.</li>
  </ul>
</CardContent></Card>;
export default Appointment;
