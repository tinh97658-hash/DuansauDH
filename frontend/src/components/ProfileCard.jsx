import axios from "axios";
import React, { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, CircularProgress, Grid, Paper, Typography } from "@mui/material";
import profilePicture from "../images/profile-picture.jpg";

const labels = [
  ["regNo", "Mã học viên"], ["postalAddress", "Địa chỉ"], ["email", "Địa chỉ email"],
  ["telNo", "Số điện thoại"], ["researchArea", "Hướng nghiên cứu"], ["degree", "Chương trình đào tạo"],
  ["studyMode", "Hình thức đào tạo"], ["supervisors", "Giảng viên hướng dẫn"],
];

const displayValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => item.name || item.fullName || item.email || String(item)).join(", ") || "Chưa cập nhật";
  return value || "Chưa cập nhật";
};

const ProfileCard = ({ endpoint }) => {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    axios.get(endpoint, { withCredentials: true })
      .then(({ data }) => mounted && setInfo(data))
      .catch((requestError) => mounted && setError(requestError.response?.data?.message || "Không thể tải hồ sơ"));
    return () => { mounted = false; };
  }, [endpoint]);

  if (error) return <Alert severity="error" sx={{ my: 2, borderRadius: "4px" }}>{error}</Alert>;
  if (!info) return <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}><CircularProgress aria-label="Đang tải hồ sơ" /></Box>;

  return (
    <Box sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      <Card variant="outlined" sx={{ borderRadius: "6px", borderColor: "#DFE4E8" }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              component="img"
              src={info.photo || profilePicture}
              alt="Ảnh đại diện"
              sx={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "2px solid #DFE4E8" }}
            />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#173E75", mt: 2, mb: 0.5 }}>
              {info.fullName || info.name || "Hồ sơ người dùng"}
            </Typography>
            <Typography variant="body2" sx={{ color: "#607486" }}>
              {info.role ? `Vai trò: ${info.role}` : "Học viên sau đại học"}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {labels.filter(([key]) => info[key] !== undefined).map(([key, label]) => (
              <Grid item xs={12} md={6} key={key}>
                <Paper variant="outlined" sx={{ p: 2, height: "100%", borderRadius: "4px", borderColor: "#DFE4E8" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block" }}>
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#243B53", mt: 0.5 }}>
                    {displayValue(info[key])}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProfileCard;
