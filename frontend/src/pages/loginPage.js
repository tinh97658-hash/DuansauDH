import React from "react";
import Login from "../components/login";
import { BRAND } from "../config/branding";
import "../styles/login-page.css";

const LoginPage = () => (
  <div className="login-page">
    <main className="login-main"><Login /></main>
    <footer className="login-footer">© {BRAND.university} · {BRAND.institute}</footer>
  </div>
);

export default LoginPage;
