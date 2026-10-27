import React, { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Container, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";

export default function ResetPassword() {
  // Fragments are not sent to HTTP servers or in Referer headers.
  const [token] = useState(() => {
    const value = window.location.hash.slice(1);
    return /^[a-f0-9]{64}$/.test(value) ? value : "";
  });
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname); }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (busy || !token) return;
    if (password !== confirm) return setError("Xác nhận mật khẩu không khớp.");
    setBusy(true); setError("");
    try {
      await axios.patch(`/user/resetPassword/${token}`, { password });
      setPassword(""); setConfirm(""); setDone(true);
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally { setBusy(false); }
  };
  return <Container maxWidth="sm"><Box component="form" onSubmit={submit} sx={{ mt: 8, display: "grid", gap: 2 }}>
    <Typography variant="h5">Đặt lại mật khẩu</Typography>
    {!token && <Alert severity="error">Liên kết không hợp lệ. Vui lòng yêu cầu email đặt lại mật khẩu mới.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {done ? <Alert severity="success">Đã đặt lại mật khẩu và đăng xuất các phiên cũ.</Alert> : <>
      <TextField label="Mật khẩu mới" type="password" autoComplete="new-password" required inputProps={{ minLength: 8, maxLength: 72 }} value={password} onChange={e => setPassword(e.target.value)} />
      <TextField label="Xác nhận mật khẩu" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
      <Button type="submit" variant="contained" disabled={busy || !token}>Đặt lại mật khẩu</Button>
    </>}
    <Button component={Link} to="/login">Về trang đăng nhập</Button>
  </Box></Container>;
}
