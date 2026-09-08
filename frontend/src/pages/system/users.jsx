import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";

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
        <TableHead><TableRow>{["Họ tên", "Email", "Vai trò", "Quyền tổ chức lớp và xếp lịch"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{users.map((user) => <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell><TableCell>{user.email}</TableCell>
          <TableCell>{{ admin: "Quản trị viên", supervisor: "Chuyên viên", examiner: "Khảo thí" }[user.role] || user.role}</TableCell>
          <TableCell>{user.canManageScheduling ? "Đang phụ trách" : <Button variant="outlined" disabled={saving} onClick={() => { setSelected(user); setSuccess(""); }}>Phân công phụ trách</Button>}</TableCell>
        </TableRow>)}{!users.length && <TableRow><TableCell colSpan={4}>Chưa có tài khoản nội bộ.</TableCell></TableRow>}</TableBody>
      </Table></TableContainer>}
    </Stack>
    <Dialog open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }}>
      <DialogTitle>Phân công phụ trách tổ chức lớp và xếp lịch</DialogTitle>
      <DialogContent><Typography>Phân công cho {selected?.name} ({selected?.email}).</Typography>
        {current.length > 0 && <Typography sx={{ mt: 1 }}>Quyền phụ trách của {current.map((user) => user.name || user.email).join(", ")} sẽ được chuyển cho tài khoản này.</Typography>}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setSelected(null)}>Hủy</Button><Button variant="contained" disabled={saving} onClick={assign}>{saving ? "Đang lưu..." : "Xác nhận phân công"}</Button></DialogActions>
    </Dialog>
  </FeatureLayout>;
};
export default Users;
