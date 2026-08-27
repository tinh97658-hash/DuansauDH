import React from "react";
import { Link } from "react-router-dom";
import { BRAND } from "../config/branding";

const Footer = () => (
  <footer style={{ borderTop: "1px solid #DFE4E8", backgroundColor: "#FFFFFF", padding: "18px 24px 24px", marginTop: "32px" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <nav style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }} aria-label="Liên kết cuối trang">
        <Link to="/" style={{ color: "#68737D", fontSize: 12 }}>Trang chủ</Link>
        <Link to="/procedure" style={{ color: "#68737D", fontSize: 12 }}>Quy trình đào tạo</Link>
        <Link to="/progressReview" style={{ color: "#68737D", fontSize: 12 }}>Theo dõi tiến độ</Link>
      </nav>
      <p style={{ margin: 0, color: "#9EABB7", fontSize: 11, textAlign: "center" }}>
        © {BRAND.university} · {BRAND.institute} · {BRAND.systemName}
      </p>
    </div>
  </footer>
);

export default Footer;
