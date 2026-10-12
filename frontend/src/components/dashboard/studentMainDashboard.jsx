import React from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Card, CardContent,
  List, ListItem, ListItemText, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const sections = [
  ["Thông tin học viên", ["Thông tin cá nhân và mã học viên", "Chương trình, hình thức và thời gian đào tạo", "Đề tài và giảng viên hướng dẫn"]],
  ["Hội đồng đánh giá", ["Thành viên hội đồng", "Phản biện và giám khảo", "Thời gian tổ chức đánh giá"]],
  ["Tiến độ đào tạo", ["Báo cáo định kỳ", "Kết quả đánh giá tiến độ", "Các yêu cầu cần bổ sung"]],
  ["Luận văn, luận án", ["Tình trạng nộp bản thảo", "Kết quả phản biện", "Ngày hoàn thành chương trình"]],
];

const StudentDashboard = () => (
  <Box sx={{ width: "100%", maxWidth: 1000, mx: "auto" }}>
    <Card variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h6" align="center" sx={{ fontWeight: 700, color: "#173E75", mb: 3 }}>
          Hồ sơ và tiến độ đào tạo
        </Typography>
        {sections.map(([title, items]) => (
          <Accordion key={title} variant="outlined" sx={{ mb: 1, borderColor: "#DFE4E8", "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: "#173E75" }} />}>
              <Typography sx={{ fontWeight: 600, fontSize: 15, color: "#173E75" }}>{title}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ bgcolor: "#FAFBFC", pt: 1, pb: 1 }}>
              <List dense disablePadding>
                {items.map((item) => (
                  <ListItem key={item} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontSize: 13 }}>
                          <strong>{item}:</strong> <span style={{ color: "#607486" }}>Chưa cập nhật</span>
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  </Box>
);

export default StudentDashboard;
