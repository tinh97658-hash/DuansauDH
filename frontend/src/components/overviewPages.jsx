import React from "react";
import { NavLink } from "react-router-dom";
import { HomeRounded, AccountTreeRounded, FactCheckRounded } from "@mui/icons-material";
import { BRAND } from "../config/branding";
import illustration from "../assets/vmu-campus-illustration.png";
import referenceArtwork from "../assets/vmu-home-reference-artwork.png";
import "./overviewPages.css";

export function OverviewFooter() {
  return <footer className="overview-footer">
    <nav aria-label="Liên kết cuối trang">
      <NavLink to="/" end><HomeRounded aria-hidden="true" />Trang chủ</NavLink>
      <NavLink to="/procedure"><AccountTreeRounded aria-hidden="true" />Quy trình đào tạo</NavLink>
      <NavLink to="/progressReview"><FactCheckRounded aria-hidden="true" />Theo dõi tiến độ</NavLink>
    </nav>
  </footer>;
}

export function HomeHero() {
  return <section className="overview-hero" aria-labelledby="overview-home-title">
    <div className="overview-hero-left" aria-hidden="true" />
    <div className="overview-hero-art" aria-hidden="true"><picture><source media="(min-width: 761px)" srcSet={referenceArtwork} /><img src={illustration} alt="" fetchpriority="high" /></picture></div>
    <div className="overview-diagonals" aria-hidden="true"><i /><i /><i /></div>
    <svg className="overview-waves" viewBox="0 0 1000 230" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 95 Q130 170 260 105 T520 105 T780 95 T1000 95 V230 H0Z" fill="#9edced" opacity=".34" />
      <path d="M0 150 Q170 210 340 140 T680 140 T1000 135 V230 H0Z" fill="#61c5e4" opacity=".24" />
      <path d="M0 205 Q160 145 320 190 T640 180 T1000 195 V230 H0Z" fill="#49b9dd" opacity=".23" />
    </svg>
    <div className="overview-hero-copy">
      <p className="overview-eyebrow">VIỆN ĐÀO TẠO SAU ĐẠI HỌC</p>
      <h1 id="overview-home-title"><span>HỆ THỐNG QUẢN LÝ</span><span>ĐÀO TẠO SAU ĐẠI HỌC</span></h1>
      <p className="overview-university">{BRAND.university}</p>
      <span className="overview-accent" aria-hidden="true" />
    </div>
  </section>;
}
