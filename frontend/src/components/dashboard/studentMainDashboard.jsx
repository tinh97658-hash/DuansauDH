import React from "react";
import { Accordion, AccordionDetails, AccordionSummary, Card, CardContent } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const sections = [
  ["Thông tin học viên", ["Thông tin cá nhân và mã học viên", "Chương trình, hình thức và thời gian đào tạo", "Đề tài và giảng viên hướng dẫn"]],
  ["Hội đồng đánh giá", ["Thành viên hội đồng", "Phản biện và giám khảo", "Thời gian tổ chức đánh giá"]],
  ["Tiến độ đào tạo", ["Báo cáo định kỳ", "Kết quả đánh giá tiến độ", "Các yêu cầu cần bổ sung"]],
  ["Luận văn, luận án", ["Tình trạng nộp bản thảo", "Kết quả phản biện", "Ngày hoàn thành chương trình"]],
];
const StudentDashboard = () => <div className="container">
  <Card><CardContent sx={{ p: { xs: 2, md: 4 } }}>
    <h1 className="text-center mb-4" style={{ fontWeight: 400 }}>Hồ sơ và tiến độ đào tạo</h1>
    {sections.map(([title, items]) => <Accordion key={title}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}><h3 className="mb-0" style={{ fontSize: 20 }}>{title}</h3></AccordionSummary>
      <AccordionDetails><ul className="mb-0">{items.map((item) => <li key={item} className="mb-2">{item}: <span className="text-muted">Chưa cập nhật</span></li>)}</ul></AccordionDetails>
    </Accordion>)}
  </CardContent></Card>
</div>;
export default StudentDashboard;
