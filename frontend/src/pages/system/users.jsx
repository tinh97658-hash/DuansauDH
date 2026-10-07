import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, IconButton, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/system/users`, { withCredentials: true });
      if (!Array.isArray(data)) throw new Error("Invalid users");
      setUsers(data);
    } catch (failure) {
      setError(failure.response?.status === 403 ? "Chỉ quản trị viên được xem và phân công quyền người dùng." : "Không thể tải danh sách người dùng.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  const assign = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await axios.put(`${API_BASE_URL}/scheduling/assignee`, { staffId: selected.id }, { withCredentials: true });
      setSuccess(`Đã phân công ${selected.name || selected.email} phụ trách tổ chức lớp và xếp lịch. Tải lại trang nghiệp vụ để cập nhật quyền.`);
      setSelected(null);
      await loadUsers();
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể phân công quyền. Vui lòng thử lại.");
    } finally { setSaving(false); }
  };
  const current = users.filter((user) => user.canManageScheduling);
  return <FeatureLayout title="Quản lý người dùng" group="Thông tin" desc="Phân công người phụ trách tổ chức lớp học phần và xếp lịch.">
    <Stack spacing={2}>
      <Alert severity="info">Quản trị viên được tạo lớp học phần. Người được phân công được tạo lớp, xếp và sửa lịch, xác nhận buổi học, hoàn thành lớp. Hệ thống hiện phân công một người phụ trách; phân công mới sẽ chuyển quyền từ người cũ.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      <Button onClick={loadUsers} disabled={loading || saving} sx={{ alignSelf: "flex-start" }}>Tải lại danh sách</Button>
      {loading ? <CircularProgress aria-label="Đang tải người dùng" /> : !error && <TableContainer><Table aria-label="Phân quyền người dùng">
        <TableHead><TableRow>{["Họ đệm", "Tên", "Email", "Vai trò", "Quyền tổ chức lớp và xếp lịch"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{users.map((user) => <TableRow key={user.id}>
          <TableCell>{personNameParts(user).familyAndMiddle}</TableCell><TableCell>{personNameParts(user).givenName}</TableCell><TableCell>{user.email}</TableCell>
          <TableCell>{{ admin: "Quản trị viên", supervisor: "Chuyên viên", examiner: "Khảo thí" }[user.role] || user.role}</TableCell>
          <TableCell>{user.canManageScheduling ? "Đang phụ trách" : <Button variant="outlined" disabled={saving} onClick={() => { setSelected(user); setSuccess(""); }}>Phân công phụ trách</Button>}</TableCell>
        </TableRow>)}{!users.length && <TableRow><TableCell colSpan={5}>Chưa có tài khoản nội bộ.</TableCell></TableRow>}</TableBody>
      </Table></TableContainer>}
    </Stack>
    <Dialog
      open={Boolean(selected)}
      onClose={() => { if (!saving) setSelected(null); }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          width: 520,
          maxWidth: "calc(100vw - 32px)",
          border: "1px solid #cfdbe4",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(23, 61, 112, 0.14)",
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          "& .MuiTypography-root, & .MuiButton-root": {
            fontFamily: '"Inter", "Segoe UI", sans-serif!important',
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, color: "#173d70", fontSize: "16px", fontWeight: 700, lineHeight: "22px", borderBottom: "1px solid #e1e8ee", textTransform: "uppercase" }}>
        <span>Phân công phụ trách tổ chức lớp và xếp lịch</span>
        <IconButton aria-label="Đóng" size="small" onClick={() => { if (!saving) setSelected(null); }} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>Phân công cho <strong>{selected?.name}</strong> ({selected?.email}).</Typography>
          {current.length > 0 && (
            <Alert severity="info" sx={{ borderRadius: "6px", fontSize: "12.5px" }}>
              Quyền phụ trách của {current.map((user) => user.name || user.email).join(", ")} sẽ được chuyển cho tài khoản này.
            </Alert>
          )}
          {error && <Alert severity="error" sx={{ borderRadius: "6px" }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
        <Button disabled={saving} onClick={() => setSelected(null)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
        <Button variant="contained" disabled={saving} onClick={assign} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}>
          {saving ? "Đang lưu..." : "Xác nhận phân công"}
        </Button>
      </DialogActions>
    </Dialog>

  </FeatureLayout>;
};
export default Users;
