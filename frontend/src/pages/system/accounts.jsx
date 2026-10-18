import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, FormControlLabel,
  IconButton, MenuItem, Paper, Select, Stack, TableBody, TableCell, TableContainer,
  TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import FeatureLayout from "../../components/FeatureLayout";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import ResizableTable from "../../components/ResizableTable";
import { personNameParts } from "../../utils/personName";
import { usePermissions } from "../../features/accounts/usePermissions";
import {
  assignScheduling, createAccount, listAccounts, resetAccountPassword,
  revokeAccountSessions, updateAccount, updateAccountStatus,
} from "../../features/accounts/api";
import { listRoles } from "../../features/accounts/rolesApi";
import { ACCOUNT_STATUS_LABELS, roleLabel } from "../../features/accounts/constants";

const columns = [
  { key: "lastName", label: "Họ đệm", width: 200, minWidth: 120 },
  { key: "firstName", label: "Tên", width: 110, minWidth: 80 },
  { key: "email", label: "Email", width: 240, minWidth: 160 },
  { key: "roles", label: "Vai trò", width: 260, minWidth: 160 },
  { key: "status", label: "Trạng thái", width: 150, minWidth: 110, align: "center" },
  { key: "actions", label: "Thao tác", width: 260, minWidth: 190, align: "center" },
];

const emptyForm = () => ({ name: "", email: "", roleIds: [], primaryRoleId: "", autoPassword: true, password: "" });

const Accounts = () => {
  const { can } = usePermissions();
  const canManage = can("account.manage");
  const canReset = can("account.password.reset");
  const canAssign = can("scheduling.assign");

  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetForm, setResetForm] = useState({ auto: true, password: "" });
  const [resetError, setResetError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountList, roleList] = await Promise.all([
        listAccounts(),
        listRoles().catch(() => []),
      ]);
      setAccounts(Array.isArray(accountList) ? accountList : []);
      setRoles(Array.isArray(roleList) ? roleList : []);
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể tải danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (statusFilter && account.status !== statusFilter) return false;
      if (roleFilter && !(account.roles || []).some((role) => role.id === roleFilter)) return false;
      if (!keyword) return true;
      return [account.name, account.email].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [accounts, search, statusFilter, roleFilter]);

  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const scheduleHolder = accounts.find((account) => account.canManageScheduling);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormError(""); setEditorOpen(true); };
  const openEdit = (account) => {
    setEditing(account);
    setForm({
      name: account.name || "",
      email: account.email || "",
      roleIds: (account.roles || []).map((role) => role.id),
      primaryRoleId: (account.roles || []).find((role) => role.code === account.role)?.id || (account.roles || [])[0]?.id || "",
      autoPassword: true,
      password: "",
    });
    setFormError("");
    setEditorOpen(true);
  };

  const toggleRole = (roleId) => setForm((previous) => {
    const roleIds = previous.roleIds.includes(roleId)
      ? previous.roleIds.filter((id) => id !== roleId)
      : [...previous.roleIds, roleId];
    const primaryRoleId = roleIds.includes(previous.primaryRoleId) ? previous.primaryRoleId : (roleIds[0] || "");
    return { ...previous, roleIds, primaryRoleId };
  });

  const submitEditor = async () => {
    if (saving) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) return setFormError("Vui lòng nhập họ tên nhân sự.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError("Email không hợp lệ.");
    if (!form.roleIds.length) return setFormError("Phải chọn ít nhất một vai trò.");
    const primaryRoleId = form.primaryRoleId || form.roleIds[0];

    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const result = await updateAccount(editing.id, { name, email, roleIds: form.roleIds, primaryRoleId });
        setNotice({ type: "success", message: result.message || "Cập nhật tài khoản thành công." });
      } else {
        const payload = { name, email, roleIds: form.roleIds, primaryRoleId };
        if (!form.autoPassword) {
          if (form.password.length < 8) { setSaving(false); return setFormError("Mật khẩu ban đầu phải có ít nhất 8 ký tự."); }
          payload.password = form.password;
        }
        const result = await createAccount(payload);
        if (result.generatedPassword) setCredentials({ email, password: result.generatedPassword });
        setNotice({ type: "success", message: result.message || "Tạo tài khoản thành công." });
      }
      setEditorOpen(false);
      await load();
    } catch (failure) {
      setFormError(failure.response?.data?.message || "Không thể lưu tài khoản.");
    } finally {
      setSaving(false);
    }
  };

  const run = async (action, successMessage) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotice({ type: "success", message: successMessage });
      await load();
    } catch (failure) {
      setError(failure.response?.data?.message || "Thao tác không thành công. Vui lòng thử lại.");
    } finally {
      setBusy(false);
      setStatusTarget(null);
      setRevokeTarget(null);
      setAssignTarget(null);
    }
  };

  const submitReset = async () => {
    if (busy) return;
    if (!resetForm.auto && resetForm.password.length < 8) return setResetError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    setBusy(true);
    setResetError("");
    try {
      const result = await resetAccountPassword(resetTarget.id, resetForm.auto ? undefined : resetForm.password);
      if (result.generatedPassword) setCredentials({ email: resetTarget.email, password: result.generatedPassword });
      setNotice({ type: "success", message: result.message || "Đặt lại mật khẩu thành công." });
      setResetTarget(null);
      await load();
    } catch (failure) {
      setResetError(failure.response?.data?.message || "Không thể đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = async () => {
    try { await navigator.clipboard?.writeText(credentials?.password || ""); setNotice({ type: "success", message: "Đã sao chép mật khẩu." }); } catch { /* clipboard may be unavailable */ }
  };

  const editorRoleOptions = roles.filter((role) => role.active !== false);
  const selectedPrimaryOptions = editorRoleOptions.filter((role) => form.roleIds.includes(role.id));

  return (
    <FeatureLayout title="Tài khoản nhân sự" group="Tài khoản & phân quyền" desc="Tạo, khóa/mở, đặt lại mật khẩu và phân vai trò cho tài khoản nội bộ.">
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: "#FFF", borderColor: "#C6D5E1", borderRadius: "10px", boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end">
          <FilterSearchField
            placeholder="Tìm theo họ tên hoặc email..."
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            sx={{ minWidth: { xs: 0, md: 260 }, width: { xs: "100%", md: "auto" }, flexGrow: 1 }}
          />
          <FilterSelectField label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 180 } }}>
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="disabled">Đã khóa</MenuItem>
          </FilterSelectField>
          <FilterSelectField label="Vai trò" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(0); }} sx={{ width: { xs: "100%", md: 220 } }}>
            <MenuItem value="">Tất cả vai trò</MenuItem>
            {roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
          </FilterSelectField>
          {canManage && (
            <Button
              variant="contained" startIcon={<AddRounded />} onClick={openCreate}
              sx={{ height: 38, px: 2, width: { xs: "100%", md: 190 }, flexShrink: 0, bgcolor: "#0788B8", borderRadius: "7px", boxShadow: "none", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
            >
              Thêm tài khoản
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity={notice.type} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.message}</Alert>}
      {canAssign && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Người phụ trách tổ chức lớp và xếp lịch hiện tại: <strong>{scheduleHolder ? scheduleHolder.name : "chưa phân công"}</strong>. Phân công mới sẽ chuyển quyền từ người cũ.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <ResizableTable columns={columns} storageKey="system-accounts-columns" aria-label="Tài khoản nhân sự">
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: "text.secondary" }}>Chưa có tài khoản phù hợp.</TableCell></TableRow>
            ) : visible.map((account) => (
              <TableRow key={account.id} hover>
                <TableCell>{personNameParts(account).familyAndMiddle}</TableCell>
                <TableCell>{personNameParts(account).givenName}</TableCell>
                <TableCell>{account.email}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {(account.roles || []).length ? (account.roles || []).map((role) => (
                      <Chip
                        key={role.id}
                        size="small"
                        label={roleLabel(role.code, role.name)}
                        color={role.code === account.role ? "primary" : "default"}
                        variant={role.code === account.role ? "filled" : "outlined"}
                      />
                    )) : <Chip size="small" label={roleLabel(account.role)} variant="outlined" />}
                  </Stack>
                </TableCell>
                <TableCell align="center">
                  <Chip size="small" label={ACCOUNT_STATUS_LABELS[account.status] || account.status} color={account.status === "active" ? "success" : "default"} />
                </TableCell>
                <TableCell align="center">
                  {canManage && <Tooltip title="Sửa tài khoản"><IconButton size="small" color="primary" aria-label={`Sửa ${account.email}`} onClick={() => openEdit(account)} disabled={busy}><EditRounded fontSize="small" /></IconButton></Tooltip>}
                  {canManage && (account.status === "active"
                    ? <Tooltip title="Khóa tài khoản"><IconButton size="small" color="warning" aria-label={`Khóa ${account.email}`} onClick={() => setStatusTarget(account)} disabled={busy}><LockRounded fontSize="small" /></IconButton></Tooltip>
                    : <Tooltip title="Mở khóa tài khoản"><IconButton size="small" color="success" aria-label={`Mở khóa ${account.email}`} onClick={() => setStatusTarget(account)} disabled={busy}><LockOpenRounded fontSize="small" /></IconButton></Tooltip>)}
                  {canReset && <Tooltip title="Đặt lại mật khẩu"><IconButton size="small" aria-label={`Đặt lại mật khẩu ${account.email}`} onClick={() => { setResetTarget(account); setResetForm({ auto: true, password: "" }); setResetError(""); }} disabled={busy}><KeyRounded fontSize="small" /></IconButton></Tooltip>}
                  {canManage && <Tooltip title="Buộc đăng xuất"><IconButton size="small" color="error" aria-label={`Buộc đăng xuất ${account.email}`} onClick={() => setRevokeTarget(account)} disabled={busy}><LogoutRounded fontSize="small" /></IconButton></Tooltip>}
                  {canAssign && <Tooltip title={account.canManageScheduling ? "Đang phụ trách xếp lịch" : "Phân công phụ trách xếp lịch"}><span><IconButton size="small" color="info" aria-label={`Phân công xếp lịch ${account.email}`} onClick={() => setAssignTarget(account)} disabled={busy || account.canManageScheduling}><EventAvailableRounded fontSize="small" /></IconButton></span></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResizableTable>
      </TableContainer>
      {filtered.length > pageSize && (
        <TablePagination
          component="div" count={filtered.length} page={currentPage} rowsPerPage={pageSize} rowsPerPageOptions={[pageSize]}
          onPageChange={(_, next) => setPage(next)}
          getItemAriaLabel={(type) => (type === "next" ? "Trang sau" : "Trang trước")}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          sx={{ bgcolor: "#fff", border: "1px solid #D7E4EE", borderTop: 0 }}
        />
      )}

      <AppDialog
        open={editorOpen}
        onClose={() => { if (!saving) setEditorOpen(false); }}
        title={editing ? "SỬA TÀI KHOẢN NHÂN SỰ" : "THÊM TÀI KHOẢN NHÂN SỰ"}
        confirmText={saving ? "Đang lưu..." : "Lưu"}
        onConfirm={submitEditor}
        saving={saving}
        maxWidth="sm"
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Họ và tên" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} fullWidth size="small" disabled={saving} />
          <TextField label="Email công vụ" type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} fullWidth size="small" disabled={saving} />
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#435b72", mb: 0.5 }}>Vai trò được gán</Typography>
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflowY: "auto", borderColor: "#D7E4EE" }}>
              {editorRoleOptions.length ? editorRoleOptions.map((role) => (
                <FormControlLabel
                  key={role.id}
                  sx={{ display: "flex", m: 0 }}
                  control={<Checkbox size="small" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} disabled={saving} />}
                  label={<Typography sx={{ fontSize: 13 }}>{role.name}{role.isSystem ? " (hệ thống)" : ""}</Typography>}
                />
              )) : <Typography sx={{ fontSize: 12.5, color: "#607486", p: 0.5 }}>Không tải được danh sách vai trò (cần quyền “Xem vai trò”).</Typography>}
            </Paper>
          </Box>
          <FormControl fullWidth size="small" disabled={saving || !selectedPrimaryOptions.length}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#435b72", mb: 0.5 }}>Vai trò chính (dùng cho mã quyền cũ)</Typography>
            <Select value={form.primaryRoleId} onChange={(event) => setForm((previous) => ({ ...previous, primaryRoleId: event.target.value }))} displayEmpty>
              {selectedPrimaryOptions.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
            </Select>
          </FormControl>
          {!editing && (
            <Stack spacing={1}>
              <FormControlLabel
                control={<Checkbox size="small" checked={form.autoPassword} onChange={(event) => setForm((previous) => ({ ...previous, autoPassword: event.target.checked }))} disabled={saving} />}
                label={<Typography sx={{ fontSize: 13 }}>Sinh mật khẩu ban đầu tự động</Typography>}
              />
              {!form.autoPassword && (
                <TextField label="Mật khẩu ban đầu" value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} fullWidth size="small" disabled={saving} helperText="Tối thiểu 8 ký tự." />
              )}
              <Alert severity="info" sx={{ fontSize: 12.5 }}>Người dùng bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên.</Alert>
            </Stack>
          )}
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(resetTarget)}
        onClose={() => { if (!busy) setResetTarget(null); }}
        title="ĐẶT LẠI MẬT KHẨU"
        confirmText="Đặt lại"
        onConfirm={submitReset}
        saving={busy}
        maxWidth="xs"
      >
        <Stack spacing={1.5}>
          {resetError && <Alert severity="error">{resetError}</Alert>}
          <Typography sx={{ fontSize: 13.5 }}>Đặt lại mật khẩu cho <strong>{resetTarget?.email}</strong>. Người dùng sẽ bị đăng xuất và phải đổi mật khẩu ở lần đăng nhập kế tiếp.</Typography>
          <FormControlLabel
            control={<Checkbox size="small" checked={resetForm.auto} onChange={(event) => setResetForm((previous) => ({ ...previous, auto: event.target.checked }))} disabled={busy} />}
            label={<Typography sx={{ fontSize: 13 }}>Sinh mật khẩu mới tự động</Typography>}
          />
          {!resetForm.auto && <TextField label="Mật khẩu mới" value={resetForm.password} onChange={(event) => setResetForm((previous) => ({ ...previous, password: event.target.value }))} fullWidth size="small" disabled={busy} helperText="Tối thiểu 8 ký tự." />}
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="MẬT KHẨU VỪA TẠO"
        confirmText="Đóng"
        cancelText=""
        onConfirm={() => setCredentials(null)}
        maxWidth="xs"
      >
        <Stack spacing={1.5}>
          <Alert severity="warning">Hãy sao chép và gửi mật khẩu này cho nhân sự. Hệ thống không lưu mật khẩu dạng rõ.</Alert>
          <TextField label="Email" value={credentials?.email || ""} fullWidth size="small" InputProps={{ readOnly: true }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField label="Mật khẩu" value={credentials?.password || ""} fullWidth size="small" InputProps={{ readOnly: true }} />
            <Tooltip title="Sao chép"><IconButton onClick={copyPassword} aria-label="Sao chép mật khẩu"><ContentCopyRounded /></IconButton></Tooltip>
          </Stack>
        </Stack>
      </AppDialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => run(() => updateAccountStatus(statusTarget.id, statusTarget.status === "active" ? "disabled" : "active"),
          statusTarget?.status === "active" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.")}
        title={statusTarget?.status === "active" ? "KHÓA TÀI KHOẢN" : "MỞ KHÓA TÀI KHOẢN"}
        confirmText={statusTarget?.status === "active" ? "Khóa" : "Mở khóa"}
        severity={statusTarget?.status === "active" ? "error" : "primary"}
        loading={busy}
        content={statusTarget?.status === "active"
          ? `Khóa tài khoản ${statusTarget?.email}? Mọi phiên đăng nhập hiện tại sẽ bị vô hiệu.`
          : `Mở khóa tài khoản ${statusTarget?.email}?`}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => run(() => revokeAccountSessions(revokeTarget.id), "Đã buộc đăng xuất tất cả phiên của tài khoản.")}
        title="BUỘC ĐĂNG XUẤT"
        confirmText="Buộc đăng xuất"
        severity="warning"
        loading={busy}
        content={`Buộc đăng xuất tất cả phiên đang hoạt động của ${revokeTarget?.email}?`}
      />

      <ConfirmDialog
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        onConfirm={() => run(() => assignScheduling(assignTarget.id), "Đã phân công phụ trách tổ chức lớp và xếp lịch.")}
        title="PHÂN CÔNG PHỤ TRÁCH XẾP LỊCH"
        confirmText="Xác nhận phân công"
        loading={busy}
        content={`Phân công ${assignTarget?.name || assignTarget?.email} phụ trách tổ chức lớp và xếp lịch?${scheduleHolder ? ` Quyền của ${scheduleHolder.name} sẽ được chuyển sang tài khoản này.` : ""}`}
      />
    </FeatureLayout>
  );
};

export default Accounts;
