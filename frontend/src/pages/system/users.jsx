import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import {
  AddRounded, EditRounded, LockOpenRounded, LockResetRounded, LockRounded,
  SearchRounded, VisibilityOffRounded, VisibilityRounded,
} from "@mui/icons-material";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputAdornment, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";

const ROLES = {
  admin: "Quản trị viên",
  supervisor: "Giảng viên hướng dẫn",
  examiner: "Giám khảo",
};
const emptyForm = { name: "", email: "", role: "supervisor", password: "" };

const Users = () => {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (role !== "ALL") params.set("role", role);
      const { data } = await axios.get(`${API_BASE_URL}/admin/users?${params.toString()}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE_URL}/auth/session`).then(({ data }) => setCurrentUserId(data.user?.id || "")).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadUsers, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role]);

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.active).length,
    locked: users.filter((user) => !user.active).length,
  }), [users]);

  const openCreate = () => {
    setEditor(null);
    setForm(emptyForm);
    setShowPassword(false);
    setEditorOpen(true);
  };

  const openEdit = (user) => {
    setEditor(user);
    setForm({ name: user.name || "", email: user.email || "", role: user.role || "supervisor", password: "" });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditor(null);
    setForm(emptyForm);
  };

  const saveUser = async () => {
    if (!form.name.trim()) return toast.error("Vui lòng nhập họ tên.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast.error("Email không hợp lệ.");
    if (!editor && form.password && form.password.length < 8) return toast.error("Mật khẩu phải có ít nhất 8 ký tự.");
    setSaving(true);
    try {
      if (editor) {
        await axios.patch(`${API_BASE_URL}/admin/users/${editor._id}`, {
          name: form.name.trim(), email: form.email.trim(), role: form.role,
        });
        toast.success("Đã cập nhật tài khoản.");
      } else {
        const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role };
        if (form.password) payload.password = form.password;
        await axios.post(`${API_BASE_URL}/admin/users`, payload);
        toast.success("Đã tạo tài khoản.");
      }
      closeEditor();
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu tài khoản.");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (user) => {
    try {
      await axios.patch(`${API_BASE_URL}/admin/users/${user._id}`, { active: !user.active });
      toast.success(user.active ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể thay đổi trạng thái tài khoản.");
    }
  };

  const submitResetPassword = async () => {
    if (resetPassword.length < 8) return toast.error("Mật khẩu phải có ít nhất 8 ký tự.");
    setSaving(true);
    try {
      await axios.patch(`${API_BASE_URL}/admin/users/${resetUser._id}/password`, { password: resetPassword });
      toast.success("Đã đặt lại mật khẩu.");
      setResetUser(null);
      setResetPassword("");
      await loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đặt lại mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureLayout title="Quản lý người dùng" group="Hệ thống" desc="Quản lý tài khoản cán bộ, vai trò và quyền đăng nhập." hideHeader={false}>
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1.2 }}>
        <Paper variant="outlined" sx={{ px: 1.5, py: 1, minWidth: 135 }}><Typography variant="caption">Tổng tài khoản</Typography><Typography variant="h6">{summary.total}</Typography></Paper>
        <Paper variant="outlined" sx={{ px: 1.5, py: 1, minWidth: 135 }}><Typography variant="caption">Đang hoạt động</Typography><Typography variant="h6" color="success.main">{summary.active}</Typography></Paper>
        <Paper variant="outlined" sx={{ px: 1.5, py: 1, minWidth: 135 }}><Typography variant="caption">Đã khóa</Typography><Typography variant="h6" color="error.main">{summary.locked}</Typography></Paper>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddRounded />} onClick={openCreate}>Thêm người dùng</Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.2, mb: 1.2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo họ tên hoặc email..." sx={{ flex: 1 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              <MenuItem value="ALL">Tất cả vai trò</MenuItem>
              {Object.entries(ROLES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead><TableRow><TableCell>Họ tên</TableCell><TableCell>Email</TableCell><TableCell>Vai trò</TableCell><TableCell>Đăng nhập</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress size={26} /></TableCell></TableRow> : users.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>Không có tài khoản phù hợp.</TableCell></TableRow> : users.map((user) => (
              <TableRow key={user._id} hover>
                <TableCell><strong>{user.name}</strong>{user._id === currentUserId && <Chip label="Bạn" size="small" color="info" sx={{ ml: 1 }} />}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{ROLES[user.role] || user.role}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={user.hasLocalPassword ? "Mật khẩu / Google" : "Chỉ Google"} /></TableCell>
                <TableCell><Chip size="small" color={user.active ? "success" : "error"} label={user.active ? "Hoạt động" : "Đã khóa"} /></TableCell>
                <TableCell align="right">
                  <Tooltip title="Chỉnh sửa"><IconButton size="small" onClick={() => openEdit(user)}><EditRounded fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Đặt lại mật khẩu"><IconButton size="small" onClick={() => { setResetUser(user); setResetPassword(""); setShowPassword(false); }}><LockResetRounded fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title={user._id === currentUserId ? "Không thể tự khóa" : user.active ? "Khóa tài khoản" : "Mở khóa tài khoản"}>
                    <span><IconButton size="small" disabled={user._id === currentUserId} color={user.active ? "error" : "success"} onClick={() => toggleUser(user)}>{user.active ? <LockRounded fontSize="small" /> : <LockOpenRounded fontSize="small" />}</IconButton></span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editorOpen} onClose={closeEditor} maxWidth="sm" fullWidth>
        <DialogTitle>{editor ? "Chỉnh sửa người dùng" : "Thêm người dùng"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField label="Họ và tên" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required fullWidth />
            <FormControl fullWidth><Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{Object.entries(ROLES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
            {!editor && <TextField label="Mật khẩu ban đầu (không bắt buộc)" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} helperText="Để trống nếu tài khoản chỉ đăng nhập bằng Google." InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((value) => !value)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> }} />}
          </Stack>
        </DialogContent>
        <DialogActions><Button color="inherit" onClick={closeEditor}>Hủy</Button><Button variant="contained" disabled={saving} onClick={saveUser}>{saving ? "Đang lưu..." : "Lưu"}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(resetUser)} onClose={() => setResetUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Đặt lại mật khẩu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>Tài khoản: <strong>{resetUser?.name}</strong></Typography>
          <TextField autoFocus fullWidth label="Mật khẩu mới" type={showPassword ? "text" : "password"} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} helperText="Từ 8 đến 72 ký tự." InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((value) => !value)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> }} />
        </DialogContent>
        <DialogActions><Button color="inherit" onClick={() => setResetUser(null)}>Hủy</Button><Button variant="contained" disabled={saving} onClick={submitResetPassword}>Đặt lại</Button></DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default Users;
