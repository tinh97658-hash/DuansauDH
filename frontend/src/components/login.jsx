import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { MailOutlineRounded, LockOutlined, VisibilityOffRounded, VisibilityRounded, ArrowForwardRounded, InfoOutlined } from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LoginIllustration from "../images/login-campus-reference.png";
import LoginLogo from "../images/login-vmu-logo.png";
import { BRAND } from "../config/branding";
import { API_BASE_URL } from "../config/http";

export const loginErrorMessage = (error) => {
  const payload = error?.response?.data;
  const message = typeof payload === "string" ? payload : payload?.message;
  if (message) return message;
  return error?.response
    ? "Không thể đăng nhập. Vui lòng thử lại."
    : "Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend và thử lại.";
};

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
      toast.error(loginErrorMessage(error), { position: "top-center", autoClose: 2500 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="login-shell" aria-labelledby="login-title">
      <aside className="login-visual" aria-hidden="true">
        <img className="login-visual-image" src={LoginIllustration} alt="" fetchpriority="high" />
      </aside>

      <div className="login-panel">
        <header className="login-brand">
          <img className="login-form-logo" src={LoginLogo} alt={`Biểu trưng ${BRAND.university}`} />
          <div className="login-brand-text"><strong>{BRAND.university}</strong><span>{BRAND.institute}</span></div>
        </header>
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form-header">
            <p className="login-institute">CỔNG QUẢN LÝ ĐÀO TẠO</p>
            <h2 id="login-title">Đăng nhập hệ thống</h2>
            <span className="login-title-rule" aria-hidden="true" />
            <p className="login-description">Sử dụng tài khoản nội bộ đã được cấp để<br className="login-description-break" /> truy cập hệ thống quản lý đào tạo sau đại học.</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-email">Địa chỉ email</label>
            <div className="login-input-wrap">
              <MailOutlineRounded className="login-input-icon" aria-hidden="true" />
              <input id="login-email" name="email" type="email" value={values.email} onChange={handleChange}
                placeholder="Nhập địa chỉ email của bạn" autoComplete="email" inputMode="email" required autoFocus />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="login-input-wrap">
              <LockOutlined className="login-input-icon" aria-hidden="true" />
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
            <ArrowForwardRounded className="login-submit-arrow" aria-hidden="true" />
          </button>

          {googleAuthEnabled && (
            <>
              <div className="login-divider"><span>hoặc đăng nhập dành cho cán bộ</span></div>
              <button className="login-google" type="button" onClick={() => window.location.assign(`${API_BASE_URL}/auth/google`)}>
                <span className="login-google-mark">G</span>Đăng nhập bằng Google
              </button>
            </>
          )}

          <p className="login-internal-note"><InfoOutlined aria-hidden="true" /><span>Liên hệ quản trị viên nếu cần cấp tài khoản.</span></p>
          <ToastContainer newestOnTop limit={2} />
        </form>
      </div>
    </section>
  );
};

export default Login;
