import React from "react";
import { BRAND } from "../config/branding";
import homeCampusBanner from "../assets/home-campus-banner.png";
import "./view.css";

const View = () => (
  <section className="home-hero" aria-labelledby="home-hero-title">
    <div className="home-hero-copy">
      <h1 id="home-hero-title">Hệ thống quản lý<br />đào tạo sau đại học</h1>
      <h2>{BRAND.university}</h2>
    </div>
    <img className="home-hero-banner" src={homeCampusBanner} alt="" />
  </section>
);

export default View;
