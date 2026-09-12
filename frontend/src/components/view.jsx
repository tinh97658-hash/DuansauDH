import { Card, CardContent } from "@mui/material";
import React from "react";
import { BRAND } from "../config/branding";

const View = () => (
  <Card sx={{ width: "100%", maxWidth: 1000, borderRadius: 3, boxShadow: "0 12px 35px rgba(26, 48, 78, .12)" }}>
    <CardContent sx={{ p: { xs: 3, md: 6 }, textAlign: "center" }}>
      <img src={BRAND.logoUrl} alt={`Biểu trưng ${BRAND.university}`} style={{ width: 112, height: 112, objectFit: "contain" }} />
      <h1 style={{ margin: "20px 0 8px", color: "#173E75" }}>{BRAND.institute}</h1>
      <h2 style={{ margin: 0, fontWeight: 400, color: "#4f6074" }}>{BRAND.university}</h2>
      <div style={{ width: 72, height: 4, margin: "28px auto", background: "#c9901a", borderRadius: 4 }} />
      <h3 style={{ marginBottom: 12 }}>{BRAND.systemName}</h3>
      <p style={{ maxWidth: 680, margin: "0 auto", color: "#657386", lineHeight: 1.7 }}>
        Nền tảng nội bộ phục vụ quản lý học viên, nghiên cứu sinh, tiến độ đào tạo và hồ sơ tốt nghiệp.
      </p>
    </CardContent>
  </Card>
);

export default View;
