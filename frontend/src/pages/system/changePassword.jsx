import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { CheckCircleRounded, LockRounded, VisibilityOffRounded, VisibilityRounded } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";

const ChangePassword = () => {
  const [form, setForm] = useState({ current: "", password: "", confirm: "" });
  const [show, setShow] = useState({ current: false, password: false, confirm: false });
  const [hasLocalPassword, setHasLocalPassword] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/user/profile`).then(({ data }) => {
      if (typeof data.hasLocalPassword === "boolean") setHasLocalPassword(data.hasLocalPassword);
    }).catch(() => {});
  }, []);

  const strength = Math.min(100, (form.password.length / 12) * 100);
  const toggle = (field) => setShow((value) => ({ ...value, [field]: !value[field] }));
  const fieldAdornment = (field) => <InputAdornment position="end"><IconButton aria-label={show[field] ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => toggle(field)}>{show[field] ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment>;

  const submit = async (event) => {
    event.preventDefault();
    if (form.password.length < 8) return toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (form.password.length > 72) return toast.error("Mật khẩu mới không được vượt quá 72 ký tự.");
    if (form.password !== form.confirm) return toast.error("Xác nhận mật khẩu chưa khớp.");
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/user/updatePassword`, { passwordCurrent: form.current, password: form.password });
      toast.success(data.message || "Đổi mật khẩu thành công.");
      setForm({ current: "", password: "", confirm: "" });
      setHasLocalPassword(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đổi mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureLayout title="Đổi mật khẩu" group="Hệ thống" desc="Cập nhật mật khẩu đăng nhập cho tài khoản của bạn." hideHeader={false} fluid={false} maxWidth={760}>
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />
      <Card variant="outlined" sx={{ maxWidth: 620, mx: "auto" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}><Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, bgcolor: "primary.light", color: "primary.main", borderRadius: 1 }}><LockRounded /></Box><Box><Typography variant="h6">Bảo mật tài khoản</Typography><Typography variant="body2" color="text.secondary">Phiên đăng nhập hiện tại vẫn được giữ sau khi đổi mật khẩu.</Typography></Box></Stack>
          {!hasLocalPassword && <Alert severity="info" sx={{ mb: 2 }}>Tài khoản hiện chỉ đăng nhập bằng Google. Bạn có thể tạo mật khẩu nội bộ mà không cần nhập mật khẩu hiện tại.</Alert>}
          <Box component="form" onSubmit={submit}>
            <Stack spacing={1.8}>
              {hasLocalPassword && <TextField label="Mật khẩu hiện tại" type={show.current ? "text" : "password"} autoComplete="current-password" required value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} InputProps={{ endAdornment: fieldAdornment("current") }} />}
              <TextField label="Mật khẩu mới" type={show.password ? "text" : "password"} autoComplete="new-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} helperText="Từ 8 đến 72 ký tự; nên kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt." InputProps={{ endAdornment: fieldAdornment("password") }} />
              {form.password && <Box><LinearProgress variant="determinate" value={strength} color={strength >= 80 ? "success" : strength >= 50 ? "warning" : "error"} /><Typography variant="caption">Độ dài: {form.password.length}/12 ký tự khuyến nghị</Typography></Box>}
              <TextField label="Xác nhận mật khẩu mới" type={show.confirm ? "text" : "password"} autoComplete="new-password" required value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} error={Boolean(form.confirm && form.confirm !== form.password)} helperText={form.confirm && form.confirm !== form.password ? "Mật khẩu chưa khớp." : " "} InputProps={{ endAdornment: fieldAdornment("confirm") }} />
              <Alert icon={<CheckCircleRounded />} severity="success">Mật khẩu được băm trước khi lưu và không bao giờ hiển thị lại.</Alert>
              <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: "flex-end", minWidth: 145 }}>{saving ? "Đang cập nhật..." : "Đổi mật khẩu"}</Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </FeatureLayout>
  );
};

export default ChangePassword;
