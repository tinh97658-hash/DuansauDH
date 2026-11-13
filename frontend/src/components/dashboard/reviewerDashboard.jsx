import React from "react";
import { Alert, Button, Card, CardContent } from "@mui/material";

const ReviewerDashboard = () => {
  return <Card variant="outlined" sx={{ width: "100%", maxWidth: 1000 }}><CardContent sx={{ p: { xs: 3, md: 4 } }}>
    <h1 style={{ fontWeight: 400 }}>Đánh giá học viên</h1>
    <Alert severity="info">Chức năng lưu nhận xét chưa được triển khai. Hiện chưa thể gửi nhận xét trên hệ thống.</Alert>
    <Button variant="contained" color="success" disabled sx={{ mt: 3 }}>Gửi nhận xét</Button>
  </CardContent></Card>;
};
export default ReviewerDashboard;
