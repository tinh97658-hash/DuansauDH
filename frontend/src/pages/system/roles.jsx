import { useAuthSession } from "../../context/AuthSession";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import FeatureLayout from "../../components/FeatureLayout";
import AppDialog from "../../components/AppDialog";
import PopupFormField from "../../components/PopupFormField";
import ConfirmDialog from "../../components/ConfirmDialog";
import { usePermissions } from "../../features/accounts/usePermissions";
import { createRole, deleteRole, listPermissionCatalog, listRoles, setRolePermissions, updateRole } from "../../features/accounts/rolesApi";

const emptyRoleForm = () => ({ code: "", name: "", description: "" });

const Roles = () => {
  const session = useAuthSession();
  const { can } = usePermissions();
  const canManage = can("role.manage");

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [groupScope, setGroupScope] = useState({ restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false });

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm());
  const [roleFormError, setRoleFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [roleList, permissionGroups] = await Promise.all([listRoles(), listPermissionCatalog()]);
      const nextRoles = Array.isArray(roleList) ? roleList : [];
      setRoles(nextRoles);
      setCatalog(Array.isArray(permissionGroups) ? permissionGroups : []);
      setSelectedId((previous) => previous && nextRoles.some((role) => role.id === previous) ? previous : (nextRoles[0]?.id || null));
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể tải danh sách vai trò.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedId) || null, [roles, selectedId]);

  useEffect(() => {
    setChecked(new Set((selectedRole?.permissions || []).map((permission) => permission.code)));
    setGroupScope({ restrictGroupView: selectedRole?.restrictGroupView === true, restrictGroupEdit: selectedRole?.restrictGroupEdit === true, groupReadOnly: selectedRole?.groupReadOnly === true });
  }, [selectedRole]);

  const allPermissions = useMemo(() => catalog.flatMap((group) => group.permissions), [catalog]);

  const togglePermission = (code) => setChecked((previous) => {
    const next = new Set(previous);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });

  const toggleGroup = (group) => setChecked((previous) => {
    const next = new Set(previous);
    const codes = group.permissions.map((permission) => permission.code);
    const allChecked = codes.every((code) => next.has(code));
    codes.forEach((code) => (allChecked ? next.delete(code) : next.add(code)));
    return next;
  });

  const savePermissions = async () => {
    if (saving || !selectedRole) return;
    setSaving(true);
    setError("");
    try {
      const ids = allPermissions.filter((permission) => checked.has(permission.code)).map((permission) => permission.id);
      const result = await setRolePermissions(selectedRole.id, ids, groupScope);
      setNotice({ type: "success", message: result.message || "Cập nhật quyền cho vai trò thành công." });
      await load();
      await session?.refresh?.();
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể cập nhật quyền.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateRole = () => { setEditingRole(null); setRoleForm(emptyRoleForm()); setRoleFormError(""); setRoleDialogOpen(true); };
  const openEditRole = () => {
    if (!selectedRole) return;
    setEditingRole(selectedRole);
    setRoleForm({ code: selectedRole.code, name: selectedRole.name, description: selectedRole.description || "" });
    setRoleFormError("");
    setRoleDialogOpen(true);
  };

  const submitRole = async () => {
    if (saving) return;
    if (!roleForm.name.trim()) return setRoleFormError("Vui lòng nhập tên vai trò.");
    if (!editingRole && !/^[a-z0-9_.-]{2,50}$/.test(roleForm.code.trim().toLowerCase())) {
      return setRoleFormError("Mã vai trò gồm chữ thường, số và các ký tự . _ -, dài 2–50 ký tự.");
    }
    setSaving(true);
    setRoleFormError("");
    try {
      if (editingRole) {
        const payload = { name: roleForm.name.trim(), description: roleForm.description.trim() };
        if (!editingRole.isSystem) payload.active = editingRole.active !== false;
        const result = await updateRole(editingRole.id, payload);
        setNotice({ type: "success", message: result.message || "Cập nhật vai trò thành công." });
      } else {
        const result = await createRole({ code: roleForm.code.trim().toLowerCase(), name: roleForm.name.trim(), description: roleForm.description.trim() });
        setNotice({ type: "success", message: result.message || "Tạo vai trò thành công." });
        if (result.data?.id) setSelectedId(result.data.id);
      }
      setRoleDialogOpen(false);
      await load();
      await session?.refresh?.();
    } catch (failure) {
      setRoleFormError(failure.response?.data?.message || "Không thể lưu vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    setError("");
    try {
      await deleteRole(deleteTarget.id);
      setNotice({ type: "success", message: "Đã xóa vai trò." });
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      await load();
      await session?.refresh?.();
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể xóa vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (role) => {
    setSaving(true);
    setError("");
    try {
      await updateRole(role.id, { active: role.active === false });
      await load();
      await session?.refresh?.();
    } catch (failure) {
      setError(failure.response?.data?.message || "Không thể cập nhật trạng thái vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const permissionGroups = catalog.some(group => group.group === "Nhóm học viên")
    ? catalog : [...catalog, { group: "Nhóm học viên", permissions: [] }];
  const renderGroupScope = () => (
<Box sx={{ borderTop: "1px solid #DCE6EF", mt: 1, pt: 1 }}>
                      <Typography fontWeight={700}>Khóa quyền theo nhóm học viên</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Mặc định tắt các khóa. Quyền xem, sửa vẫn cần được cấp ở các mục nghiệp vụ tương ứng. Khóa áp dụng cả hồ sơ học viên, điểm và báo cáo liên quan. Khi một người có nhiều vai trò, khóa bật ở bất kỳ vai trò đang hoạt động nào đều có hiệu lực.</Typography>
                      {[
                        ["groupReadOnly", "Chỉ xem — khóa mọi thao tác sửa dữ liệu nhóm", "Bật: không tạo, sửa, xóa nhóm, phân công, thay đổi thành viên hoặc dữ liệu học viên liên quan. Tắt: cho phép sửa theo quyền nghiệp vụ."],
                        ["restrictGroupView", "Chỉ xem nhóm được phân công phụ trách", "Bật: ẩn dữ liệu ngoài phân công, chặn truy cập trực tiếp. Nhóm chưa phân công không hiển thị. Tắt: xem tất cả nhóm nếu có quyền xem."],
                        ["restrictGroupEdit", "Chỉ sửa nhóm được phân công phụ trách", "Bật: chỉ sửa dữ liệu nhóm mình phụ trách. Tắt: được sửa nhóm khác nếu có quyền sửa. Khóa chỉ xem ở trên luôn ưu tiên."],
                      ].map(([key, label, description]) => <Box key={key} sx={{ mb: 1 }}>
                        <FormControlLabel control={<Checkbox checked={groupScope[key]} onChange={event => setGroupScope(previous => ({ ...previous, [key]: event.target.checked }))} disabled={!canManage || saving} />} label={label} />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>{description}</Typography>
                      </Box>)}
                    </Box>
  );

  return (
    <FeatureLayout title="Vai trò & phân quyền" group="Tài khoản & phân quyền" desc="Tạo vai trò tùy chỉnh và tick chọn quyền theo từng nhóm nghiệp vụ.">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity={notice.type} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.message}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, alignItems: "start" }}>
          <Paper variant="outlined" sx={{ borderColor: "#C6D5E1", borderRadius: "10px", overflow: "hidden" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, bgcolor: "#F5F9FC", borderBottom: "1px solid #DCE6EF" }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#173E75" }}>DANH SÁCH VAI TRÒ</Typography>
              {canManage && <Tooltip title="Thêm vai trò"><IconButton size="small" color="primary" aria-label="Thêm vai trò" onClick={openCreateRole} disabled={saving}><AddRounded fontSize="small" /></IconButton></Tooltip>}
            </Stack>
            <Stack divider={<Divider flexItem />}>
              {roles.map((role) => (
                <Box
                  key={role.id}
                  component="button"
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  sx={{
                    display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer", px: 1.5, py: 1.25,
                    bgcolor: role.id === selectedId ? "#EAF4FA" : "#fff",
                    borderLeft: role.id === selectedId ? "3px solid #0788B8" : "3px solid transparent",
                    "&:hover": { bgcolor: role.id === selectedId ? "#EAF4FA" : "#F7FAFC" },
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontWeight: 600, fontSize: 13.5, color: "#1c2936" }}>{role.name}</Typography>
                    {role.isSystem && <Chip size="small" label="Hệ thống" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10.5 }} />}
                    {role.active === false && <Chip size="small" label="Tạm ẩn" sx={{ height: 18, fontSize: 10.5 }} />}
                  </Stack>
                  <Typography sx={{ fontSize: 11.5, color: "#607486", mt: 0.25 }}>
                    Mã: {role.code} · {(role.permissions || []).length} quyền · {role.staffCount || 0} nhân sự
                  </Typography>
                </Box>
              ))}
              {!roles.length && <Typography sx={{ fontSize: 12.5, color: "#607486", p: 1.5 }}>Chưa có vai trò.</Typography>}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ borderColor: "#C6D5E1", borderRadius: "10px", p: 2 }}>
            {selectedRole ? (
              <Stack spacing={2}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#173E75" }}>
                      {selectedRole.name} <Typography component="span" sx={{ fontWeight: 400, color: "#607486", fontSize: 13 }}>({selectedRole.code})</Typography>
                    </Typography>
                    {selectedRole.description && <Typography sx={{ fontSize: 12.5, color: "#607486", mt: 0.25 }}>{selectedRole.description}</Typography>}
                  </Box>
                  {canManage && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={openEditRole} disabled={saving} sx={{ textTransform: "none", fontWeight: 600 }}>Sửa</Button>
                      {selectedRole.active !== false && (
                        <Button size="small" variant="outlined" color="warning" onClick={() => toggleActive(selectedRole)} disabled={saving} sx={{ textTransform: "none", fontWeight: 600 }}>Tạm ẩn</Button>
                      )}
                      {selectedRole.active === false && (
                        <Button size="small" variant="outlined" color="success" onClick={() => toggleActive(selectedRole)} disabled={saving} sx={{ textTransform: "none", fontWeight: 600 }}>Kích hoạt</Button>
                      )}
                      {!selectedRole.isSystem && (
                        <Button size="small" variant="outlined" color="error" startIcon={<DeleteRounded />} onClick={() => setDeleteTarget(selectedRole)} disabled={saving || (selectedRole.staffCount || 0) > 0} sx={{ textTransform: "none", fontWeight: 600 }}>Xóa</Button>
                      )}
                    </Stack>
                  )}
                </Stack>

                <Box sx={{ bgcolor: "#F0F7FC", border: "1px solid #DCE6EF", borderRadius: 1, p: 1.25 }}>
                  <Typography variant="body2">Đang phân quyền cho vai trò <strong>{selectedRole.name}</strong> — áp dụng cho {selectedRole.staffCount || 0} nhân sự mang vai trò này.</Typography>
                  <Typography variant="caption" color="text.secondary">Hãy kiểm tra vai trò được gán trong Tài khoản nhân sự trước khi cấu hình. Quyền xem, quyền sửa và các khóa theo nhóm là các lựa chọn độc lập. Nút “Tất cả” chỉ chọn quyền nghiệp vụ; các khóa theo nhóm cần bật riêng. Thay đổi chỉ được áp dụng sau khi bấm Lưu quyền.</Typography>
                </Box>
                {(
                  <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5 }}>
                      {permissionGroups.map((group) => {
                        const codes = group.permissions.map((permission) => permission.code);
                        const allChecked = codes.every((code) => checked.has(code));
                        return (
                          <Paper key={group.group} variant="outlined" sx={{ borderColor: "#DCE6EF", borderRadius: "8px", overflow: "hidden" }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, py: 0.75, bgcolor: "#F7FAFC", borderBottom: "1px solid #E4EEF6" }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#3B5166" }}>{group.group}</Typography>
                              {codes.length > 0 && <FormControlLabel
                                sx={{ m: 0 }}
                                control={<Checkbox size="small" checked={allChecked} onChange={() => toggleGroup(group)} disabled={!canManage || saving} inputProps={{ "aria-label": `Chọn tất cả ${group.group}` }} />}
                                label={<Typography sx={{ fontSize: 12 }}>Tất cả</Typography>}
                              />}
                            </Stack>
                            <Box sx={{ p: 1 }}>
                              {group.permissions.map((permission) => (
                                <Box key={permission.code} sx={{ mb: permission.description ? 1 : 0 }}>
                                <FormControlLabel
                                  sx={{ display: "flex", m: 0, px: 0.5 }}
                                  control={<Checkbox size="small" checked={checked.has(permission.code)} onChange={() => togglePermission(permission.code)} disabled={!canManage || saving} inputProps={{ "aria-label": permission.name }} />}
                                  label={<Typography sx={{ fontSize: 12.5 }}>{permission.name}</Typography>}
                                />
                                {permission.description && <Typography variant="caption" component="p" color="text.secondary" sx={{ ml: 4, mr: 0.5, my: 0, lineHeight: 1.5 }}>{permission.description}</Typography>}
                                </Box>
                              ))}
                              {group.group === "Nhóm học viên" && renderGroupScope()}
                            </Box>
                          </Paper>
                        );
                      })}
                    </Box>
                    {canManage && (
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Button variant="contained" startIcon={<SaveRounded />} onClick={savePermissions} disabled={saving} sx={{ bgcolor: "#0788B8", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#056A8F" } }}>
                          {saving ? <CircularProgress size={18} sx={{ color: "inherit", mr: 1 }} /> : null}Lưu quyền
                        </Button>
                        <Typography sx={{ fontSize: 12.5, color: "#607486" }}>Đã chọn {checked.size}/{allPermissions.length} quyền. Thay đổi có hiệu lực trong ~30 giây.</Typography>
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 13, color: "#607486" }}>Chọn một vai trò để xem và cấu hình quyền.</Typography>
            )}
          </Paper>
        </Box>
      )}

      <AppDialog
        open={roleDialogOpen}
        onClose={() => { if (!saving) setRoleDialogOpen(false); }}
        title={editingRole ? "SỬA VAI TRÒ" : "THÊM VAI TRÒ"}
        confirmText={saving ? "Đang lưu..." : "Lưu"}
        onConfirm={submitRole}
        saving={saving}
        maxWidth="sm"
        sx={{
          "&& input:focus-visible, && textarea:focus-visible": { outline: "none" },
        }}
      >
        <Stack spacing={2}>
          {roleFormError && <Alert severity="error">{roleFormError}</Alert>}
          <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "6px", bgcolor: "#fbfcfd" }}>
            <Stack spacing={1.75}>
              <PopupFormField label="Mã vai trò" htmlFor="role-code">
                <TextField id="role-code" autoComplete="off" inputProps={{ "aria-label": "Mã vai trò" }} value={roleForm.code} onChange={(event) => setRoleForm((previous) => ({ ...previous, code: event.target.value }))} fullWidth size="small" disabled={saving || Boolean(editingRole)} helperText={editingRole ? "Không thể đổi mã vai trò." : "Ví dụ: thu_ky_khoa"} />
              </PopupFormField>
              <PopupFormField label="Tên vai trò" htmlFor="role-name">
                <TextField id="role-name" autoComplete="off" inputProps={{ "aria-label": "Tên vai trò" }} value={roleForm.name} onChange={(event) => setRoleForm((previous) => ({ ...previous, name: event.target.value }))} fullWidth size="small" disabled={saving} />
              </PopupFormField>
              <PopupFormField label="Mô tả" htmlFor="role-description">
                <TextField id="role-description" autoComplete="off" inputProps={{ "aria-label": "Mô tả" }} value={roleForm.description} onChange={(event) => setRoleForm((previous) => ({ ...previous, description: event.target.value }))} fullWidth size="small" multiline minRows={2} disabled={saving} />
              </PopupFormField>
            </Stack>
          </Box>
          {editingRole?.isSystem && <Alert severity="info" sx={{ fontSize: 12.5 }}>Đây là vai trò hệ thống; có thể đổi tên/mô tả và ma trận quyền nhưng không thể xóa hay đổi mã. Tên vai trò chính hiển thị trong hệ thống vẫn dùng nhãn mặc định nếu chưa đổi.</Alert>}
          {!editingRole && <Alert severity="info" sx={{ fontSize: 12.5 }}>Sau khi tạo, chọn vai trò vừa tạo và tick quyền ở ma trận bên phải.</Alert>}
        </Stack>
      </AppDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="XÓA VAI TRÒ"
        confirmText="Xóa"
        severity="error"
        loading={saving}
        content={`Xóa vai trò ${deleteTarget?.name}? Chỉ xóa được khi vai trò chưa được gán cho nhân sự.`}
      />
    </FeatureLayout>
  );
};

export default Roles;
