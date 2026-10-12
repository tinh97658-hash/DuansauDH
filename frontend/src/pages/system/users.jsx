import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, CircularProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import FeatureLayout from "../../components/FeatureLayout";
import AppDialog from "../../components/AppDialog";
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

  return (
    <FeatureLayout title="Quản lý người dùng" group="Thông tin" desc="Phân công người phụ trách tổ chức lớp học phần và xếp lịch.">
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

      <AppDialog
        open={Boolean(selected)}
        onClose={() => { if (!saving) setSelected(null); }}
        maxWidth="xs"
        PaperProps={{ sx: { width: 480, maxWidth: "calc(100vw - 32px)" } }}
        title="PHÂN CÔNG PHỤ TRÁCH TỔ CHỨC LỚP VÀ XẾP LỊCH"
        confirmText="Xác nhận phân công"
        onConfirm={assign}
        saving={saving}
      >
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>Phân công cho <strong>{selected?.name}</strong> ({selected?.email}).</Typography>
          {current.length > 0 && (
            <Alert severity="info" sx={{ borderRadius: "6px", fontSize: "12.5px" }}>
              Quyền phụ trách của {current.map((user) => user.name || user.email).join(", ")} sẽ được chuyển cho tài khoản này.
            </Alert>
          )}
          {error && <Alert severity="error" sx={{ borderRadius: "6px" }}>{error}</Alert>}
        </Stack>
      </AppDialog>
    </FeatureLayout>
  );
};

export default Users;
