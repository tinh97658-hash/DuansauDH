import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { EmailRounded, LockRounded, VisibilityOffRounded, VisibilityRounded } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LoginIllustration from "../images/loginSide.webp";
import { BRAND } from "../config/branding";
import { API_BASE_URL } from "../config/http";

const Login = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    axios.get("/auth/capabilities")
      .then(({ data }) => mounted && setGoogleAuthEnabled(Boolean(data.googleAuthEnabled)))
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleChange = ({ target }) => setValues((current) => ({ ...current, [target.name]: target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await axios.post("/user/login", values, { withCredentials: true });
      toast.success("Đăng nhập thành công", { position: "top-center", autoClose: 900 });
      navigate("/", { replace: true });
    } catch (error) {
      const payload = error.response?.data;
      const message = typeof payload === "string" ? payload : payload?.message;
      toast.error(message || "Email hoặc mật khẩu không chính xác", { position: "top-center", autoClose: 2500 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="login-shell" aria-labelledby="login-title">
      <aside className="login-visual">
        <div className="login-visual-copy">
          <p className="login-eyebrow">{BRAND.university}</p>
          <h1>{BRAND.institute}</h1>
          <p>Quản lý hồ sơ, tiến độ học tập, báo cáo và quy trình đào tạo sau đại học trên một hệ thống thống nhất.</p>
        </div>
        <img className="login-visual-image" src={LoginIllustration} alt="Minh họa hệ thống quản lý đào tạo sau đại học" />
        <div className="login-visual-note"><span />Hệ thống nội bộ dành cho tài khoản đã được cấp</div>
      </aside>

      <div className="login-panel">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <img className="login-form-logo" src={BRAND.logoUrl} alt={`Biểu trưng ${BRAND.university}`} />
          <div className="login-form-header">
            <p className="login-institute">{BRAND.institute}</p>
            <h2 id="login-title">Đăng nhập hệ thống</h2>
            <p>Sử dụng tài khoản nội bộ đã được quản trị viên cấp.</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-email">Địa chỉ email</label>
            <div className="login-input-wrap">
              <EmailRounded className="login-input-icon" />
              <input id="login-email" name="email" type="email" value={values.email} onChange={handleChange}
                placeholder="ten.nguoidung@vimaru.edu.vn" autoComplete="email" inputMode="email" required autoFocus />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="login-input-wrap">
              <LockRounded className="login-input-icon" />
              <input id="login-password" name="password" type={showPassword ? "text" : "password"}
                value={values.password} onChange={handleChange} placeholder="Nhập mật khẩu"
                autoComplete="current-password" minLength="8" required />
              <button className="login-password-toggle" type="button" onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword}>
                {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
              </button>
            </div>
          </div>

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting && <span className="login-spinner" aria-hidden="true" />}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          {googleAuthEnabled && (
            <>
              <div className="login-divider"><span>hoặc đăng nhập dành cho cán bộ</span></div>
              <button className="login-google" type="button" onClick={() => window.location.assign(`${API_BASE_URL}/auth/google`)}>
                <span className="login-google-mark">G</span>Đăng nhập bằng Google
              </button>
            </>
          )}

          <p className="login-internal-note">Không hỗ trợ đăng ký công khai. Vui lòng liên hệ quản trị viên nếu cần cấp tài khoản.</p>
          <ToastContainer newestOnTop limit={2} />
        </form>
      </div>
    </section>
  );
};

export default Login;
