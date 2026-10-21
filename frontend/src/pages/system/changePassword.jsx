import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, Dialog, Paper, TextField } from "@mui/material";
import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import "./changePassword.css";
import FeatureLayout from "../../components/FeatureLayout";
import { useAuthSession } from "../../context/AuthSession";
import { changeOwnPassword } from "../../features/accounts/api";

const ChangePassword = () => {
  const navigate = useNavigate();
  const session = useAuthSession();
  const forced = Boolean(session?.user?.mustChangePassword);
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await axios.post(`${API_BASE_URL}/user/logout`, {}, { withCredentials: true });
      navigate("/login", { replace: true });
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally { setLoggingOut(false); }
  };

  const setField = (key) => (event) => {
    setValues((previous) => ({ ...previous, [key]: event.target.value }));
    setError("");
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (saving) return;
    if (!values.currentPassword) return setError("Vui lòng nhập mật khẩu hiện tại.");
    if (values.newPassword.length < 8) return setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (values.newPassword === values.currentPassword) return setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
    if (values.newPassword !== values.confirmPassword) return setError("Xác nhận mật khẩu không khớp.");

    setSaving(true);
    setError("");
    try {
      await changeOwnPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Đổi mật khẩu thành công.");
      if (typeof session?.refresh === "function") await session.refresh();
      navigate("/", { replace: true });
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const panel = (
      <Paper component="form" variant="outlined" onSubmit={submit} className="password-settings" aria-labelledby="password-settings-title">
        <header className="password-settings-head">
          <h1 id="password-settings-title">ĐỔI MẬT KHẨU</h1>
          <p>Cập nhật mật khẩu cho tài khoản hiện tại</p>
        </header>
        <div className="password-settings-body">
          {forced && <Alert severity="warning">Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được đặt lại). Vui lòng đổi mật khẩu trước khi sử dụng các chức năng khác.</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <div className="password-settings-field">
            <label htmlFor="current-password">Mật khẩu hiện tại</label>
            <TextField id="current-password" type="password" value={values.currentPassword} onChange={setField("currentPassword")} fullWidth size="small" autoComplete="current-password" autoFocus={forced} disabled={saving || loggingOut} />
          </div>
          <div className="password-settings-field">
            <label htmlFor="new-password">Mật khẩu mới</label>
            <TextField id="new-password" type="password" value={values.newPassword} onChange={setField("newPassword")} fullWidth size="small" autoComplete="new-password" helperText="Tối thiểu 8 ký tự." disabled={saving} />
          </div>
          <div className="password-settings-field">
            <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
            <TextField id="confirm-password" type="password" value={values.confirmPassword} onChange={setField("confirmPassword")} fullWidth size="small" autoComplete="new-password" disabled={saving} />
          </div>
          <div className="password-settings-actions">
            <Button type="submit" variant="contained" disabled={saving}>{saving && <CircularProgress size={16} sx={{ color: "inherit", mr: 1 }} />}Đổi mật khẩu</Button>
            <Button type="button" variant="outlined" disabled={saving} onClick={() => { setValues({ currentPassword: "", newPassword: "", confirmPassword: "" }); setError(""); }}>Nhập lại</Button>
            {forced && <Button type="button" variant="text" onClick={logout} disabled={saving || loggingOut}>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</Button>}
          </div>
        </div>
        <p className="password-settings-note">Sau khi đổi mật khẩu thành công, hệ thống chuyển về trang chủ với phiên đăng nhập hiện tại.</p>
      </Paper>
  );
  return (
    <FeatureLayout title="Đổi mật khẩu" group="Tài khoản & phân quyền" desc="Cập nhật mật khẩu đăng nhập cho tài khoản của bạn.">
      {forced ? <Dialog open disableEscapeKeyDown aria-labelledby="password-settings-title" maxWidth={false}
        className="password-required-overlay" PaperProps={{ className: "password-required-dialog", "aria-modal": true }}>
        {panel}
      </Dialog> : <div className="password-settings-page">{panel}</div>}
    </FeatureLayout>
  );
};

export default ChangePassword;
