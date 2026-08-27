import axios from "axios";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CircularProgress, Grid } from "@mui/material";
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

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!info) return <div className="text-center p-5"><CircularProgress aria-label="Đang tải hồ sơ" /></div>;
  return <Card sx={{ width: "100%", maxWidth: 900, borderRadius: 3 }}>
    <CardContent sx={{ p: { xs: 3, md: 5 } }}>
      <div className="text-center mb-4">
        <img src={info.photo || profilePicture} width="140" height="140" className="rounded-circle" alt="Ảnh đại diện" style={{ objectFit: "cover" }} />
        <h2 className="mt-3 mb-1">{info.fullName || info.name || "Hồ sơ người dùng"}</h2>
        <p className="text-muted">{info.role ? `Vai trò: ${info.role}` : "Học viên sau đại học"}</p>
      </div>
      <Grid container spacing={2}>
        {labels.filter(([key]) => info[key] !== undefined).map(([key, label]) => <Grid item xs={12} md={6} key={key}>
          <div className="border rounded p-3 h-100"><strong>{label}</strong><div className="text-muted mt-1">{displayValue(info[key])}</div></div>
        </Grid>)}
      </Grid>
    </CardContent>
  </Card>;
};
export default ProfileCard;
