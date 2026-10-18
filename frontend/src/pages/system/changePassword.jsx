import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
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

  return (
    <FeatureLayout title="Đổi mật khẩu" group="Tài khoản & phân quyền" desc="Cập nhật mật khẩu đăng nhập cho tài khoản của bạn.">
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {forced && (
          <Alert severity="warning">
            Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được đặt lại). Vui lòng đổi mật khẩu trước khi sử dụng các chức năng khác.
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Paper component="form" variant="outlined" onSubmit={submit} sx={{ p: 2.5, borderRadius: "10px", borderColor: "#C6D5E1" }}>
          <Stack spacing={2}>
            <TextField
              label="Mật khẩu hiện tại"
              type="password"
              value={values.currentPassword}
              onChange={setField("currentPassword")}
              fullWidth
              size="small"
              autoComplete="current-password"
              disabled={saving}
            />
            <TextField
              label="Mật khẩu mới"
              type="password"
              value={values.newPassword}
              onChange={setField("newPassword")}
              fullWidth
              size="small"
              autoComplete="new-password"
              helperText="Tối thiểu 8 ký tự."
              disabled={saving}
            />
            <TextField
              label="Xác nhận mật khẩu mới"
              type="password"
              value={values.confirmPassword}
              onChange={setField("confirmPassword")}
              fullWidth
              size="small"
              autoComplete="new-password"
              disabled={saving}
            />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button type="submit" variant="contained" disabled={saving} sx={{ bgcolor: "#0788B8", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#056A8F" } }}>
                {saving ? <CircularProgress size={18} sx={{ color: "inherit", mr: 1 }} /> : null}
                Đổi mật khẩu
              </Button>
              <Button type="button" color="inherit" disabled={saving} onClick={() => { setValues({ currentPassword: "", newPassword: "", confirmPassword: "" }); setError(""); }}>
                Nhập lại
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Typography sx={{ fontSize: 12.5, color: "#607486" }}>
          Sau khi đổi mật khẩu thành công, hệ thống chuyển về trang chủ với phiên đăng nhập hiện tại.
        </Typography>
      </Stack>
    </FeatureLayout>
  );
};

export default ChangePassword;
