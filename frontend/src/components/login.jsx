import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
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
            src="/images/vmu-logo.png"
            alt={`Biểu trưng ${BRAND.university}`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="vmu-login-brand-titles">
            <h1 className="vmu-login-brand-title">{BRAND.university}</h1>
            <p className="vmu-login-brand-sub">{BRAND.institute}</p>
          </div>
        </div>

        {/* Khung Form đăng nhập */}
        <div className="vmu-login-body">
          <h2 className="vmu-login-title">Đăng nhập quản trị</h2>

          {statusState.type !== "standby" && (
            <div
              className={`vmu-login-status-box status-${statusState.type}`}
              role="status"
              aria-live="polite"
            >
              <span className="vmu-login-status-text">{statusState.message}</span>
              <span className="vmu-login-status-code">{statusState.code}</span>
            </div>
          )}

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
                <EmailOutlined className="vmu-login-input-icon" aria-hidden="true" />
                <input
                  id="vmu-email"
                  name="email"
                  type="email"
                  className="vmu-login-input"
                  value={values.email}
                  onChange={handleChange}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="vmu-login-field">
              <div className="vmu-login-field-header">
                <label className="vmu-login-label" htmlFor="vmu-password">
                  Mật khẩu quản trị
                </label>
              </div>
              <div className="vmu-login-input-wrap">
                <LockOutlined className="vmu-login-input-icon" aria-hidden="true" />
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
                  {showPassword ? <VisibilityRounded /> : <VisibilityOffRounded />}
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

      </aside>

      {/* CỘT PHẢI: BANNER HÌNH ẢNH THỰC TẾ TRƯỜNG & VIỆN */}
      <img
        className="vmu-login-art"
        src="/images/vmu-login-banner-clean.png"
        alt=""
        aria-hidden="true"
      />
      <section
        className="vmu-login-right"
        aria-label="Không gian trường Đại học Hàng hải Việt Nam"
      >
        {/* Thanh Header nổi ở trên cùng bên phải */}
        <div className="vmu-login-right-top">
          <a
            className="vmu-pill vmu-pill-location"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Nhà A6, Trường Đại học Hàng hải Việt Nam, 484 Lạch Tray, Hải Phòng")}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Xem địa chỉ Nhà A6, Trường Đại học Hàng hải Việt Nam trên Google Maps (mở tab mới)"
            title="Xem địa chỉ trên Google Maps"
          >
            <LocationOnOutlined aria-hidden="true" />
            <span>Phòng 203, Nhà A6, 484 Lạch Tray, Hải Phòng</span>
          </a>
          <div className="vmu-pill">
            <PhoneRounded aria-hidden="true" />
            <span>HOTLINE: 0225.3.735.879</span>
            <span className="vmu-pill-divider">|</span>
            <span className="vmu-pill-clock">{currentTime || "GMT+7"}</span>
          </div>
        </div>

        {/* Thẻ liên hệ ở chân ảnh */}
        <div className="vmu-login-right-bottom">
          <div className="vmu-contact-card">
            <EmailOutlined aria-hidden="true" />
            <div>
              <div className="vmu-contact-label">EMAIL CÔNG VỤ VIỆN SĐH</div>
              <a className="vmu-contact-email" href="mailto:sdh@vimaru.edu.vn">
                sdh@vimaru.edu.vn
              </a>
            </div>
          </div>
        </div>
      </section>
      <footer className="vmu-login-copyright">
        © {BRAND.university} · {BRAND.institute}
      </footer>

    </div>
  );
};

export default Login;
