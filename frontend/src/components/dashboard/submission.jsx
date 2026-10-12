import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, Typography } from "@mui/material";
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

  useEffect(() => {
    axios.get("/user/profile", { withCredentials: true }).then(({ data }) => setProfile(data)).catch(() => setProfile({}));
  }, []);

  if (!profile) return <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress aria-label="Đang tải trạng thái báo cáo" /></Box>;

  return (
    <Box sx={{ width: "100%", maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#173E75", mb: 2.5 }}>
        Nộp báo cáo tiến độ
      </Typography>
      <Grid container spacing={2}>
        {submissions.map(([number, title]) => {
          const submitted = profile[`submission${number}`] && profile[`submission${number}`] !== "NA";
          return (
            <Grid item xs={12} md={6} key={number}>
              <Card variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#173E75", mb: 1 }}>
                    {title}
                  </Typography>
                  <Alert severity={submitted ? "success" : "info"} sx={{ my: 1.5, borderRadius: "4px" }}>
                    {submitted ? "Đã nộp" : "Chưa nộp"}
                  </Alert>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={submitted}
                    onClick={() => navigate("/fileUpload", { state: number })}
                    sx={{ borderRadius: "4px", textTransform: "none", bgcolor: "#0788B8", "&:hover": { bgcolor: "#06729b" } }}
                  >
                    {submitted ? "Đã hoàn thành" : "Chọn tệp để nộp"}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Submission;
