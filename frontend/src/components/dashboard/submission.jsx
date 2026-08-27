import React, { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, CircularProgress, Grid } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const submissions = [
  [1, "Báo cáo 3 tháng"], [2, "Báo cáo 6 tháng năm thứ nhất"], [3, "Báo cáo năm thứ nhất"],
  [4, "Báo cáo 6 tháng năm thứ hai"], [5, "Báo cáo năm thứ hai"],
  [6, "Báo cáo 6 tháng năm thứ ba"], [7, "Báo cáo năm thứ ba"],
];
const Submission = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => { axios.get("/user/profile", { withCredentials: true }).then(({ data }) => setProfile(data)).catch(() => setProfile({})); }, []);
  if (!profile) return <div className="text-center p-5"><CircularProgress aria-label="Đang tải trạng thái báo cáo" /></div>;
  return <div className="container">
    <h1 className="mb-4" style={{ fontWeight: 400 }}>Nộp báo cáo tiến độ</h1>
    <Grid container spacing={2}>{submissions.map(([number, title]) => {
      const submitted = profile[`submission${number}`] && profile[`submission${number}`] !== "NA";
      return <Grid item xs={12} md={6} key={number}><Card variant="outlined"><CardContent>
        <h3 style={{ fontSize: 20 }}>{title}</h3>
        <Alert severity={submitted ? "success" : "info"} sx={{ my: 2 }}>{submitted ? "Đã nộp" : "Chưa nộp"}</Alert>
        <Button variant="contained" disabled={submitted} onClick={() => navigate("/fileUpload", { state: number })}>{submitted ? "Đã hoàn thành" : "Chọn tệp để nộp"}</Button>
      </CardContent></Card></Grid>;
    })}</Grid>
  </div>;
};
export default Submission;
