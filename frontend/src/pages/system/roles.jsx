import { useAuthSession } from "../../context/AuthSession";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import FeatureLayout from "../../components/FeatureLayout";
import AppDialog from "../../components/AppDialog";
import PopupFormField from "../../components/PopupFormField";
import ConfirmDialog from "../../components/ConfirmDialog";
import { notify } from "../../utils/notify";
import { usePermissions } from "../../features/accounts/usePermissions";
import { createRole, deleteRole, listPermissionCatalog, listRoles, setRolePermissions, updateRole } from "../../features/accounts/rolesApi";
import PermissionTree, { buildPermissionModules } from '../../features/accounts/PermissionTree';
import RoutePermissionTree from '../../features/accounts/RoutePermissionTree';
import { useUnsavedChanges } from '../../components/UnsavedChangesGuard';

const emptyRoleForm = () => ({ code: "", name: "", description: "" });

const Roles = () => {
  const session = useAuthSession();
  const { can } = usePermissions();
  const canManage = can("role.manage");

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [loadedRoleId, setLoadedRoleId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [groupScope, setGroupScope] = useState({ restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false });
  const [search, setSearch] = useState(''), [pendingRole, setPendingRole] = useState(null), [suggestion, setSuggestion] = useState(null);

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
      if (!Array.isArray(roleList) || !Array.isArray(permissionGroups) || permissionGroups.some(group => !Array.isArray(group.permissions))) throw new Error('Danh mục phân quyền không hợp lệ.');
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
    setLoadedRoleId(selectedRole?.id || null);
  }, [selectedRole]);

  const allPermissions = useMemo(() => catalog.flatMap((group) => group.permissions), [catalog]);
  const assignable = () => true;
  const modules = useMemo(() => buildPermissionModules(catalog), [catalog]);
  const baselineCodes = (selectedRole?.permissions || []).map(permission => permission.code).sort().join('|');
  const dirty = !!selectedRole && loadedRoleId === selectedRole.id && ([...checked].sort().join('|') !== baselineCodes ||
    ['restrictGroupView', 'restrictGroupEdit', 'groupReadOnly'].some(key => groupScope[key] !== (selectedRole[key] === true)));
  useUnsavedChanges(dirty, 'Bạn có thay đổi phân quyền chưa lưu. Rời trang sẽ bỏ các thay đổi này.');
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const prune = next => {
    let previous = -1;
    while (previous !== next.size) {
      previous = next.size; for (const permission of allPermissions) {
        if (permission.code.startsWith('module.')) continue;
        if (!next.has(`module.${permission.moduleId || permission.code.split('.')[0]}`) || (permission.requires || []).some(code => !next.has(code))) next.delete(permission.code);
      }
    }
    return next;
  };
  const chooseRole = id => { if (saving || id === selectedId) return; if (dirty) setPendingRole(id); else setSelectedId(id); };
  const changeModule = (module, enabled) => {
    if (!module.root) return;
    setChecked(previous => { const next = new Set(previous); if (enabled) next.add(module.root.code); else { next.delete(module.root.code); module.children.forEach(child => next.delete(child.code)); } return prune(next); });
    const reads = module.children.filter(permission => permission.kind === 'read');
    if (enabled && reads.length) setSuggestion({ ...module, reads });
  };
  const applyReadSuggestion = () => {
    setChecked(previous => { const next = new Set(previous); for (const permission of suggestion.reads) { next.add(permission.code); const module = modules.find(value => value.children.some(child => child.code === permission.code)); if (module?.root) next.add(module.root.code); } return next; });
    setSuggestion(null);
  };

  const togglePermission = (code) => setChecked((previous) => {
    const next = new Set(previous);
    if (next.has(code)) next.delete(code); else next.add(code);
    return prune(next);
  });

  const changeRoutePermissions = (codes, enabled) => setChecked(previous => {
    const next = new Set(previous);
    const byCode = new Map(allPermissions.map(permission => [permission.code, permission]));
    const add = code => {
      if (next.has(code)) return;
      const permission = byCode.get(code);
      if (!permission) return;
      next.add(code);
      if (!code.startsWith('module.')) {
        add(`module.${permission.moduleId}`);
        (permission.requires || []).forEach(add);
      }
    };
    codes.forEach(code => enabled ? add(code) : next.delete(code));
    return prune(next);
  });

  const savePermissions = async () => {
    if (saving || !selectedRole || error || !allPermissions.length) return false;
    setSaving(true);
    setError("");
    try {
      const ids = allPermissions.filter((permission) => checked.has(permission.code)).map((permission) => permission.id);
      const result = await setRolePermissions(selectedRole.id, ids, groupScope);
      notify.success(result.message || "Cập nhật quyền cho vai trò thành công.");
      await load();
      await session?.refresh?.();
      return true;
    } catch (failure) {
      notify.error(failure.response?.data?.message || "Không thể cập nhật quyền.");
      return false;
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
        notify.success(result.message || "Cập nhật vai trò thành công.");
      } else {
        const result = await createRole({ code: roleForm.code.trim().toLowerCase(), name: roleForm.name.trim(), description: roleForm.description.trim() });
        notify.success(result.message || "Tạo vai trò thành công.");
        if (result.data?.id) setSelectedId(result.data.id);
      }
      setRoleDialogOpen(false);
      await load();
      await session?.refresh?.();
    } catch (failure) {
      notify.error(failure.response?.data?.message || "Không thể lưu vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    setError("");
    try {
      await deleteRole(deleteTarget.id);
      notify.success("Đã xóa vai trò.");
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      await load();
      await session?.refresh?.();
    } catch (failure) {
      notify.error(failure.response?.data?.message || "Không thể xóa vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (role) => {
    setSaving(true);
    setError("");
    try {
      await updateRole(role.id, { active: role.active === false });
      notify.success(role.active === false ? "Đã kích hoạt vai trò." : "Đã tạm ẩn vai trò.");
      await load();
      await session?.refresh?.();
    } catch (failure) {
      notify.error(failure.response?.data?.message || "Không thể cập nhật trạng thái vai trò.");
    } finally {
      setSaving(false);
    }
  };

  const renderGroupScope = () => (
    <Box sx={{ borderTop: "1px solid #DCE6EF", mt: 2, pt: 2 }}>
      <Typography fontWeight={700} fontSize={13.5} color="#173E75">Phạm vi dữ liệu của hồ sơ</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, fontSize: 12.5 }}>
        Quyền ở cây bên trên quyết định được làm gì; phạm vi bên dưới quyết định được làm trên dữ liệu nào. Mở phạm vi không tự cấp quyền chức năng.
      </Typography>
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, mb: 1.5 }}>
        <Button size="small" variant="outlined" disabled={!canManage || saving || !!error} onClick={() => setGroupScope({ restrictGroupView: false, restrictGroupEdit: false, groupReadOnly: false })} sx={{ textTransform: 'none', fontWeight: 600 }}>Xem và sửa toàn viện</Button>
        <Button size="small" variant="outlined" disabled={!canManage || saving || !!error} onClick={() => setGroupScope({ restrictGroupView: true, restrictGroupEdit: true, groupReadOnly: false })} sx={{ textTransform: 'none', fontWeight: 600 }}>Theo lớp phụ trách</Button>
        <Button size="small" variant="outlined" disabled={!canManage || saving || !!error} onClick={() => setGroupScope({ restrictGroupView: false, restrictGroupEdit: true, groupReadOnly: true })} sx={{ textTransform: 'none', fontWeight: 600 }}>Chỉ đọc toàn viện</Button>
      </Stack>
      <Alert severity="info" sx={{ mb: 1.5, fontSize: 12.5 }}>
        Phạm vi hồ sơ và báo cáo: {groupScope.restrictGroupView ? 'chỉ xem lớp phụ trách' : 'xem toàn viện'}; {groupScope.groupReadOnly ? 'chặn mọi thao tác ghi' : groupScope.restrictGroupEdit ? 'chỉ sửa lớp phụ trách' : 'sửa toàn viện theo quyền được cấp'}.
        {' '}Để quản trị dữ liệu toàn viện, chọn “Xem và sửa toàn viện”, bật đủ quyền chức năng tương ứng rồi lưu.
        {' '}Hệ thống chỉ dùng quyền của hồ sơ đang chọn, không cộng quyền của hồ sơ khác.
      </Alert>
      {[
        ["groupReadOnly", "Chỉ xem — khóa mọi thao tác sửa dữ liệu nhóm", "Bật: chặn mọi thao tác ghi của hồ sơ, kể cả khi đã chọn quyền ghi ở cây bên trên. Tắt: cho phép sửa theo quyền nghiệp vụ và phạm vi."],
        ["restrictGroupView", "Chỉ xem nhóm được phân công phụ trách", "Bật: ẩn dữ liệu ngoài phân công, chặn truy cập trực tiếp. Nhóm chưa phân công không hiển thị. Tắt: xem tất cả nhóm nếu có quyền xem."],
        ["restrictGroupEdit", "Chỉ sửa nhóm được phân công phụ trách", "Bật: chỉ sửa dữ liệu nhóm mình phụ trách. Tắt: được sửa nhóm khác nếu có quyền sửa. Khóa chỉ xem ở trên luôn ưu tiên."],
      ].map(([key, label, description]) => (
        <Box key={key} sx={{ mb: 1.25 }}>
          <FormControlLabel control={<Checkbox size="small" checked={groupScope[key]} onChange={event => setGroupScope(previous => ({ ...previous, [key]: event.target.checked }))} disabled={!canManage || saving} />} label={<Typography fontSize={13} fontWeight={500}>{label}</Typography>} />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 3.75, fontSize: 11.5 }}>{description}</Typography>
        </Box>
      ))}
    </Box>
  );

  const renderPermissionEditor = () => (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: '#fff', py: 1 }}>
        <TextField
          size="small"
          placeholder="Tìm quyền theo tên hoặc mã…"
          inputProps={{ 'aria-label': 'Tìm quyền' }}
          value={search}
          onChange={event => setSearch(event.target.value)}
          sx={{ width: 'min(420px, 65%)' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" sx={{ color: '#8DA2B5' }} />
              </InputAdornment>
            ),
          }}
        />
        {canManage && (
          <Button
            variant="contained"
            startIcon={<SaveRounded />}
            disabled={saving || !dirty || !allPermissions.length}
            onClick={savePermissions}
            sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 600, px: 2 }}
          >
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
        Cây phân quyền theo phân hệ → nhóm menu → trang chức năng → thao tác. Quyền xem mở giao diện trang; các thao tác nghiệp vụ được cấp riêng biệt.
      </Typography>
      {allPermissions.some(permission => permission.navigation)
        ? <RoutePermissionTree permissions={allPermissions} checked={checked} onChange={changeRoutePermissions} assignable={assignable} disabled={!canManage || saving || !!error || loadedRoleId !== selectedRole?.id} search={search} />
        : <PermissionTree modules={modules} checked={checked} onToggle={togglePermission} onModuleChange={changeModule} assignable={assignable} disabled={!canManage || saving || !!error || loadedRoleId !== selectedRole?.id} search={search} />}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, py: 0.25 }}>
        <Typography variant="caption" sx={{ color: dirty ? 'warning.dark' : 'text.secondary', fontWeight: dirty ? 600 : 400, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: dirty ? 'warning.main' : 'success.main', display: 'inline-block' }} />
          {dirty ? 'Có thay đổi chưa lưu.' : 'Quyền đã lưu.'} Đã chọn {checked.size}/{allPermissions.length} quyền.
        </Typography>
      </Stack>
      {groupScope.groupReadOnly && <Alert severity="warning">Hồ sơ này đang Chỉ xem: mọi quyền ghi bị chặn kể cả khi đã chọn bên trên.</Alert>}
      {renderGroupScope()}
    </Stack>
  );

  return (
    <FeatureLayout title="Vai trò & phân quyền" group="Tài khoản & phân quyền" desc="Cấu hình cây Module – Tab, tách quyền xem và quyền ghi theo từng hồ sơ làm việc."
      exportConfig={false}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, alignItems: "start" }}>
          <Paper variant="outlined" sx={{ borderColor: "#C6D5E1", borderRadius: "10px", overflow: "hidden" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, bgcolor: "#F5F9FC", borderBottom: "1px solid #DCE6EF" }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#173E75" }}>DANH SÁCH VAI TRÒ</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {canManage && <Tooltip title="Thêm vai trò"><IconButton size="small" color="primary" aria-label="Thêm vai trò" onClick={openCreateRole} disabled={saving || dirty}><AddRounded fontSize="small" /></IconButton></Tooltip>}
              </Stack>
            </Stack>
            <Stack divider={<Divider flexItem />}>
              {roles.map((role) => (
                <Box
                  key={role.id}
                  component="button"
                  type="button"
                  onClick={() => chooseRole(role.id)} disabled={saving}
                  sx={{
                    display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer", px: 1.5, py: 1.25,
                    bgcolor: role.id === selectedId ? "#EAF4FA" : "#fff",
                    borderLeft: role.id === selectedId ? "3px solid #0788B8" : "3px solid transparent",
                    "&:hover": { bgcolor: role.id === selectedId ? "#EAF4FA" : "#F7FAFC" },
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
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
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" sx={{ gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#173E75" }}>
                      {selectedRole.name} <Typography component="span" sx={{ fontWeight: 400, color: "#607486", fontSize: 13 }}>({selectedRole.code})</Typography>
                    </Typography>
                    {selectedRole.description && <Typography sx={{ fontSize: 12.5, color: "#607486", mt: 0.25 }}>{selectedRole.description}</Typography>}
                  </Box>
                  {canManage && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={openEditRole} disabled={saving || dirty} sx={{ textTransform: "none", fontWeight: 600 }}>Sửa</Button>
                      {selectedRole.active !== false && (
                        <Button size="small" variant="outlined" color="warning" onClick={() => toggleActive(selectedRole)} disabled={saving || dirty} sx={{ textTransform: "none", fontWeight: 600 }}>Tạm ẩn</Button>
                      )}
                      {selectedRole.active === false && (
                        <Button size="small" variant="outlined" color="success" onClick={() => toggleActive(selectedRole)} disabled={saving || dirty} sx={{ textTransform: "none", fontWeight: 600 }}>Kích hoạt</Button>
                      )}
                      {!selectedRole.isSystem && (
                        <Button size="small" variant="outlined" color="error" startIcon={<DeleteRounded />} onClick={() => setDeleteTarget(selectedRole)} disabled={saving || dirty || (selectedRole.staffCount || 0) > 0} sx={{ textTransform: "none", fontWeight: 600 }}>Xóa</Button>
                      )}
                    </Stack>
                  )}
                </Stack>

                <Box sx={{ bgcolor: "#F0F7FC", border: "1px solid #DCE6EF", borderRadius: 1, p: 1.25 }}>
                  <Typography variant="body2">Đang phân quyền cho vai trò <strong>{selectedRole.name}</strong> — áp dụng cho {selectedRole.staffCount || 0} nhân sự mang vai trò này.</Typography>
                  <Typography variant="caption" color="text.secondary">Mỗi vai trò là một hồ sơ làm việc. Quyền xem và quyền ghi được chọn riêng; bật module cha không tự cấp quyền ghi. Thay đổi có hiệu lực sau khi Lưu thay đổi.</Typography>
                </Box>
                {renderPermissionEditor()}
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
      <AppDialog open={pendingRole !== null} onClose={() => setPendingRole(null)} title="CÓ THAY ĐỔI PHÂN QUYỀN CHƯA LƯU" maxWidth="sm" saving={saving}
        actions={<><Button disabled={saving} onClick={() => setPendingRole(null)}>Ở lại</Button>
          <Button disabled={saving} color="warning" onClick={() => { setSelectedId(pendingRole); setPendingRole(null); }}>Bỏ qua thay đổi</Button>
          <Button disabled={saving} variant="contained" onClick={async () => { const target = pendingRole; if (await savePermissions()) { setSelectedId(target); setPendingRole(null); } }}>Lưu &amp; Chuyển</Button></>}>
        <Typography>Bạn có thay đổi phân quyền chưa lưu. Bạn muốn Lưu &amp; Chuyển hay Bỏ qua thay đổi?</Typography>
      </AppDialog>
      <AppDialog open={!!suggestion} onClose={() => setSuggestion(null)} title="GỢI Ý QUYỀN XEM" confirmText="Bật các quyền xem này" cancelText="Tự chọn từng tab" onConfirm={applyReadSuggestion}>
        <Typography>Đã mở module {suggestion?.name}. Có thể bật các quyền xem sau; quyền ghi vẫn cần chọn riêng.</Typography>
        <Box component="ul">{suggestion?.reads.map(permission => <li key={permission.id}>{permission.name}</li>)}</Box>
      </AppDialog>
    </FeatureLayout>
  );
};

export default Roles;
