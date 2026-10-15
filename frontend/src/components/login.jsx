import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowForwardRounded,
  CloseRounded,
  EmailRounded,
  HelpOutlineRounded,
  LockRounded,
  VisibilityOffRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BRAND } from "../config/branding";
import { API_BASE_URL } from "../config/http";
import "../styles/login-page.css";

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
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Quản lý ô Status chuẩn xác theo chu trình đăng nhập
  const [statusState, setStatusState] = useState({
    message: "Hệ thống xác thực sẵn sàng tiếp nhận thông tin quản trị",
    code: "READY",
    type: "standby", // standby | loading | success | error
  });

  // Đồng hồ thực tế GMT+7 theo múi giờ Việt Nam
  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const timeStr = new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now);
        setCurrentTime(`${timeStr} GMT+7`);
      } catch {
        setCurrentTime(new Date().toLocaleTimeString("vi-VN") + " GMT+7");
      }
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Kiểm tra khả năng đăng nhập Google của backend
  useEffect(() => {
    let mounted = true;
    axios
      .get("/auth/capabilities")
      .then(({ data }) => mounted && setGoogleAuthEnabled(Boolean(data.googleAuthEnabled)))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = ({ target }) => {
    setValues((current) => ({ ...current, [target.name]: target.value }));
    // Khi người dùng gõ lại, nếu đang có lỗi thì đưa status về trạng thái chờ
    if (statusState.type === "error") {
      setStatusState({
        message: "Hệ thống xác thực sẵn sàng tiếp nhận thông tin quản trị",
        code: "READY",
        type: "standby",
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!values.email || !values.password) {
      setStatusState({
        message: "Vui lòng nhập đầy đủ email công vụ và mật khẩu quản trị.",
        code: "400_BAD_INPUT",
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    setStatusState({
      message: "Đang gửi yêu cầu & xác thực tài khoản công vụ...",
      code: "AUTH_WAIT",
      type: "loading",
    });

    try {
      await axios.post("/user/login", values, { withCredentials: true });
      setStatusState({
        message: "Xác thực thành công. Đang chuyển hướng vào Viện SĐH Portal...",
        code: "200_OK",
        type: "success",
      });
      toast.success("Đăng nhập thành công", { position: "top-center", autoClose: 900 });
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 700);
    } catch (error) {
      const errStatus = error?.response?.status;
      const codeLabel = errStatus
        ? `${errStatus}_ERR`
        : error?.code === "ERR_NETWORK"
        ? "NET_ERROR"
        : "AUTH_ERR";
      const message = loginErrorMessage(error);

      setStatusState({
        message: message,
        code: codeLabel,
        type: "error",
      });
      toast.error(message, { position: "top-center", autoClose: 2500 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vmu-login-root">
      {/* CỘT TRÁI: FORM ĐĂNG NHẬP */}
      <aside className="vmu-login-left">
        {/* Header thương hiệu */}
        <div className="vmu-login-brand-header">
          <img
            className="vmu-login-brand-logo"
            src={BRAND.logoUrl}
            alt={`Biểu trưng ${BRAND.university}`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="vmu-login-brand-titles">
            <h1 className="vmu-login-brand-title">{BRAND.institute}</h1>
            <p className="vmu-login-brand-sub">{BRAND.university} · VMU</p>
          </div>
          <div className="vmu-login-badge-online">
            <span className="vmu-login-badge-dot" />
            ONLINE
          </div>
        </div>

        {/* Khung Form đăng nhập */}
        <div className="vmu-login-body">
          <h2 className="vmu-login-title">Đăng nhập quản trị</h2>

          {/* Ô BÁO STATUS ĐỘNG: Phản ánh trung thực trạng thái hệ thống */}
          <div
            className={`vmu-login-status-box status-${statusState.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="vmu-login-status-text">{statusState.message}</span>
            <span className="vmu-login-status-code">{statusState.code}</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Trường Email */}
            <div className="vmu-login-field">
              <div className="vmu-login-field-header">
                <label className="vmu-login-label" htmlFor="vmu-email">
                  Địa chỉ email công vụ
                </label>
                <span className="vmu-login-field-hint">@vimaru.edu.vn</span>
              </div>
              <div className="vmu-login-input-wrap">
                <input
                  id="vmu-email"
                  name="email"
                  type="email"
                  className="vmu-login-input"
                  value={values.email}
                  onChange={handleChange}
                  placeholder="vien.truong.sdh@vimaru.edu.vn"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="vmu-login-field">
              <div className="vmu-login-field-header">
                <label className="vmu-login-label" htmlFor="vmu-password">
                  Mật khẩu quản trị
                </label>
                <button
                  type="button"
                  className="vmu-login-forgot-btn"
                  onClick={() => setShowForgotModal(true)}
                >
                  Quên mật khẩu
                </button>
              </div>
              <div className="vmu-login-input-wrap">
                <input
                  id="vmu-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="vmu-login-input"
                  value={values.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  className="vmu-login-input-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                </button>
              </div>
            </div>

            {/* Nút Đăng nhập */}
            <button
              className="vmu-login-submit"
              type="submit"
              disabled={submitting}
            >
              <span>{submitting ? "Đang xác thực hệ thống..." : "Đăng nhập hệ thống"}</span>
              <div className="vmu-login-submit-arrow">
                {submitting ? (
                  <span className="vmu-login-spinner" aria-hidden="true" />
                ) : (
                  <ArrowForwardRounded fontSize="small" />
                )}
              </div>
            </button>

            {/* Đăng nhập Google (nếu backend hỗ trợ) */}
            {googleAuthEnabled && (
              <button
                className="vmu-login-google"
                type="button"
                onClick={() => window.location.assign(`${API_BASE_URL}/auth/google`)}
              >
                <span>G</span> Đăng nhập qua Google Workspace công vụ
              </button>
            )}
          </form>
        </div>

        {/* Footer cột trái */}
        <footer className="vmu-login-left-footer">
          <span>Nhà A6, 484 Lạch Tray, Hải Phòng</span>
          <a href="https://sdh.vimaru.edu.vn" target="_blank" rel="noreferrer">
            sdh.vimaru.edu.vn
          </a>
        </footer>
      </aside>

      {/* CỘT PHẢI: BANNER HÌNH ẢNH THỰC TẾ TRƯỜNG & VIỆN */}
      <section
        className="vmu-login-right"
        style={{
          backgroundImage: "url('/images/vmu-campus.jpg')",
        }}
        aria-label="Không gian trường Đại học Hàng hải Việt Nam"
      >
        {/* Thanh Header nổi ở trên cùng bên phải */}
        <div className="vmu-login-right-top">
          <div className="vmu-pill">
            <span className="vmu-pill-dot-amber" />
            <span>Phòng 203, Nhà A6, 484 Lạch Tray, Hải Phòng</span>
          </div>
          <div className="vmu-pill">
            <span>HOTLINE: 0225.3.735.879</span>
            <span>·</span>
            <span className="vmu-pill-clock">{currentTime || "GMT+7"}</span>
          </div>
        </div>

        {/* Khối thông tin giới thiệu và liên hệ ở chân ảnh */}
        <div className="vmu-login-right-bottom">
          <div className="vmu-hero-text">
            <p className="vmu-hero-eyebrow">
              VIỆN ĐÀO TẠO SAU ĐẠI HỌC // TRƯỜNG ĐH HÀNG HẢI VIỆT NAM
            </p>
            <h2 className="vmu-hero-title">
              Cổng Thông Tin &amp; Quản Trị Đào Tạo Chuyên Sâu
            </h2>
            <p className="vmu-hero-desc">
              Đơn vị quản lý đào tạo trình độ Thạc sĩ, Tiến sĩ và bồi dưỡng sau đại học.
              Điều hành hệ thống khảo thí, học vụ và bảo vệ luận án toàn trường.
            </p>
          </div>

          <div className="vmu-contact-card">
            <div className="vmu-contact-label">EMAIL CÔNG VỤ VIỆN SĐH</div>
            <a className="vmu-contact-email" href="mailto:sdh@vimaru.edu.vn">
              sdh@vimaru.edu.vn
            </a>
          </div>
        </div>
      </section>

      {/* MODAL HỖ TRỢ / QUÊN MẬT KHẨU */}
      {showForgotModal && (
        <div
          className="vmu-modal-backdrop"
          onClick={() => setShowForgotModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="vmu-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vmu-modal-title">
              <HelpOutlineRounded sx={{ color: "#f59e0b" }} />
              Cấp lại mật khẩu quản trị
            </div>
            <p className="vmu-modal-desc">
              Tài khoản quản trị Cổng Viện Sau Đại học được cấp tập trung cho Cán bộ, Giảng viên
              và Quản trị viên thuộc Viện. Để đảm bảo an toàn dữ liệu, hệ thống không cấp lại mật
              khẩu tự động qua email cá nhân.
            </p>
            <div className="vmu-modal-info-box">
              <div>• <strong>Địa điểm tiếp nhận:</strong> Phòng 203 - Nhà A6, 484 Lạch Tray, Hải Phòng</div>
              <div>• <strong>Hotline hỗ trợ:</strong> 0225.3.735.879 (Giờ hành chính)</div>
              <div>• <strong>Email công vụ:</strong> sdh@vimaru.edu.vn</div>
            </div>
            <div className="vmu-modal-actions">
              <button
                type="button"
                className="vmu-modal-close-btn"
                onClick={() => setShowForgotModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer newestOnTop limit={2} theme="dark" />
    </div>
  );
};

export default Login;
