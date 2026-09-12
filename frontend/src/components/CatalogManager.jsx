import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import { AddRounded, DeleteRounded, EditRounded, SearchRounded } from "@mui/icons-material";
import { API_BASE_URL } from "../config/http";
import FeatureLayout from "./FeatureLayout";

const buildEmptyForm = (parent, fields, sortable) => {
  const form = { code: "", name: "", active: true };
  if (sortable) form.sortOrder = 0;
  if (parent) form[parent.field] = "";
  for (const f of fields) {
    if (f.type === "number") form[f.key] = f.defaultValue ?? 0;
    else if (f.type === "checkbox" || f.type === "boolean") form[f.key] = Boolean(f.defaultValue ?? false);
    else form[f.key] = f.defaultValue ?? "";
  }
  return form;
};

const CatalogManager = ({
  title, group, desc, endpoint, itemName, nameLabel = "Tên", codeLabel = "Mã",
  sortable = true, parent = null, fields = [],
}) => {
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildEmptyForm(parent, fields, sortable));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}${endpoint}`, { withCredentials: true });
      setRows(Array.isArray(data) ? data : data.data || []);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tải dữ liệu danh mục");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/auth/isStaff`, { withCredentials: true })
      .then(({ data }) => mounted && setIsAdmin(data.message === "admin"))
      .catch(() => mounted && setIsAdmin(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!parent) { setOptions([]); return; }
    let mounted = true;
    axios.get(`${API_BASE_URL}${parent.endpoint}`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        const list = Array.isArray(data) ? data : data.data || [];
        setOptions(list.map((item) => ({ value: item.id, label: item.name })));
      })
      .catch(() => mounted && setOptions([]));
    return () => { mounted = false; };
  }, [parent]);

  const tableFields = fields.filter((f) => f.showInTable !== false);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    const haystacks = (row) => [
      row.code, row.name,
      ...tableFields.map((f) => row[f.key]),
      parent ? (parent.display ? parent.display(row) : row[parent.field]) : "",
    ];
    return rows.filter((row) => haystacks(row).some((v) => String(v ?? "").toLowerCase().includes(keyword)));
  }, [rows, search, parent, tableFields]);

  const colSpan = 3 + (parent ? 1 : 0) + tableFields.length + (sortable ? 1 : 0) + 1 + (isAdmin ? 1 : 0);

  const openAdd = () => { setEditingId(null); setForm(buildEmptyForm(parent, fields, sortable)); setDialogOpen(true); };
  const openEdit = (row) => {
    const next = { code: row.code, name: row.name, active: row.active };
    if (sortable) next.sortOrder = row.sortOrder ?? 0;
    if (parent) next[parent.field] = row[parent.field] || "";
    for (const f of fields) {
      if (f.type === "number") next[f.key] = row[f.key] ?? (f.defaultValue ?? 0);
      else if (f.type === "checkbox" || f.type === "boolean") next[f.key] = Boolean(row[f.key]);
      else next[f.key] = row[f.key] ?? (f.defaultValue ?? "");
    }
    setEditingId(row.id);
    setForm(next);
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setSaving(false); };

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    if (!form.code?.trim()) return toast.error(`Vui lòng nhập ${codeLabel.toLowerCase()}`);
    if (!form.name?.trim()) return toast.error(`Vui lòng nhập ${nameLabel.toLowerCase()}`);
    const body = { code: form.code.trim(), name: form.name.trim(), active: Boolean(form.active) };
    if (sortable) body.sortOrder = Number(form.sortOrder || 0);
    if (parent) {
      const value = form[parent.field];
      if (parent.optional) {
        body[parent.field] = value || null;
      } else {
        if (!value) return toast.error(`Vui lòng chọn ${parent.label}`);
        body[parent.field] = value;
      }
    }
    for (const f of fields) {
      const raw = form[f.key];
      if (f.type === "checkbox" || f.type === "boolean") {
        body[f.key] = Boolean(raw);
      } else if (f.type === "number") {
        const num = raw === "" || raw === null || raw === undefined ? (f.allowNull ? null : (f.defaultValue ?? 0)) : Number(raw);
        body[f.key] = num;
      } else {
        const value = String(raw ?? "").trim();
        if (f.required && !value) return toast.error(`Vui lòng nhập ${f.label}`);
        if (f.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return toast.error(`${f.label} không hợp lệ`);
        body[f.key] = value || null;
      }
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}${endpoint}/${editingId}`, body, { withCredentials: true });
        toast.success(`Cập nhật ${itemName} thành công`);
      } else {
        await axios.post(`${API_BASE_URL}${endpoint}`, body, { withCredentials: true });
        toast.success(`Thêm ${itemName} thành công`);
      }
      closeDialog();
      load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || `Không thể lưu ${itemName}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await axios.put(`${API_BASE_URL}${endpoint}/${row.id}`, { active: !row.active }, { withCredentials: true });
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, active: !row.active } : item)));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Không thể cập nhật trạng thái");
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API_BASE_URL}${endpoint}/${deleting.id}`, { withCredentials: true });
      toast.success(`Xóa ${itemName} thành công`);
      setDeleting(null);
      load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || `Không thể xóa ${itemName}`);
    } finally {
      setSaving(false);
    }
  };

  const renderFieldValue = (row, f) => {
    if (f.display) return f.display(row);
    if (f.type === "checkbox" || f.type === "boolean") {
      return row[f.key] ? (
        <Chip size="small" label="Có" color="primary" variant="outlined" />
      ) : (
        <Chip size="small" label="Không" variant="outlined" />
      );
    }
    if (f.type === "select" && Array.isArray(f.options)) {
      const opt = f.options.find((o) => (typeof o === "object" ? o.value === row[f.key] : o === row[f.key]));
      if (opt) return typeof opt === "object" ? opt.label : opt;
    }
    if (f.type === "multiline") {
      const text = String(row[f.key] ?? "");
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
    return row[f.key] ?? "-";
  };

  return (
    <FeatureLayout title={title} group={group} desc={desc}>
      <ToastContainer position="top-center" newestOnTop limit={3} />
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          placeholder={`Tìm theo ${codeLabel.toLowerCase()} hoặc tên...`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" sx={{ color: "#8A9AAA" }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 280, flexGrow: 1 }}
        />
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openAdd}
            sx={{ height: 36, bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}
          >
            Thêm mới
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f0f4fa" }}>
              <TableCell sx={{ width: 48, fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{codeLabel}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{nameLabel}</TableCell>
              {parent && <TableCell sx={{ fontWeight: 700 }}>{parent.columnLabel || parent.label}</TableCell>}
              {tableFields.map((f) => <TableCell key={f.key} sx={{ fontWeight: 700 }}>{f.label}</TableCell>)}
              {sortable && <TableCell align="center" sx={{ fontWeight: 700, width: 90 }}>Thứ tự</TableCell>}
              <TableCell align="center" sx={{ fontWeight: 700, width: 110 }}>Trạng thái</TableCell>
              {isAdmin && <TableCell align="right" sx={{ fontWeight: 700, width: 110 }}>Thao tác</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 4, color: "text.secondary" }}>Chưa có dữ liệu.</TableCell></TableRow>
            ) : filtered.map((row, index) => (
              <TableRow key={row.id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell><Typography variant="body2" sx={{ fontFamily: "inherit" }}>{row.code}</Typography></TableCell>
                <TableCell>{row.name}</TableCell>
                {parent && <TableCell>{parent.display ? parent.display(row) : row[parent.field]}</TableCell>}
                {tableFields.map((f) => <TableCell key={f.key}>{renderFieldValue(row, f)}</TableCell>)}
                {sortable && <TableCell align="center">{row.sortOrder}</TableCell>}
                <TableCell align="center">
                  {isAdmin ? (
                    <Tooltip title={row.active ? "Đang hoạt động" : "Đã ẩn"}>
                      <Switch size="small" checked={Boolean(row.active)} onChange={() => toggleActive(row)} />
                    </Tooltip>
                  ) : (
                    <Chip size="small" label={row.active ? "Hoạt động" : "Ẩn"} color={row.active ? "success" : "default"} variant="outlined" />
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell align="right">
                    <Tooltip title="Sửa"><IconButton size="small" color="primary" onClick={() => openEdit(row)}><EditRounded fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Xóa"><IconButton size="small" color="error" onClick={() => setDeleting(row)}><DeleteRounded fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? `Sửa ${itemName}` : `Thêm ${itemName}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={codeLabel} value={form.code} onChange={setField("code")} fullWidth size="small" />
            <TextField label={nameLabel} value={form.name} onChange={setField("name")} fullWidth size="small" />
            {parent && (
              <FormControl fullWidth size="small">
                <InputLabel id={`${parent.field}-label`}>{parent.label}</InputLabel>
                <Select labelId={`${parent.field}-label`} label={parent.label} value={form[parent.field]} onChange={setField(parent.field)}>
                  {parent.optional && <MenuItem value="">(Không)</MenuItem>}
                  {options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {fields.map((f) => {
              if (f.type === "checkbox" || f.type === "boolean") {
                return (
                  <FormControlLabel
                    key={f.key}
                    control={
                      <Checkbox
                        checked={Boolean(form[f.key])}
                        onChange={(event) => setForm((prev) => ({ ...prev, [f.key]: event.target.checked }))}
                        color="primary"
                      />
                    }
                    label={f.label}
                  />
                );
              }
              if (f.type === "number") {
                return (
                  <TextField key={f.key} label={f.label} type="number" value={form[f.key]} onChange={setField(f.key)} fullWidth size="small"
                    inputProps={{ min: f.min ?? 0, step: f.step ?? 1 }} />
                );
              }
              if (f.type === "multiline") {
                return <TextField key={f.key} label={f.label} value={form[f.key]} onChange={setField(f.key)} fullWidth size="small" multiline minRows={3} />;
              }
              if (f.type === "select" && Array.isArray(f.options)) {
                return (
                  <FormControl key={f.key} fullWidth size="small">
                    <InputLabel id={`${f.key}-label`}>{f.label}</InputLabel>
                    <Select
                      labelId={`${f.key}-label`}
                      label={f.label}
                      value={form[f.key] ?? ""}
                      onChange={setField(f.key)}
                    >
                      {f.allowEmpty !== false && <MenuItem value=""><em>(Không có)</em></MenuItem>}
                      {f.options.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const lbl = typeof opt === "object" ? opt.label : opt;
                        return <MenuItem key={val} value={val}>{lbl}</MenuItem>;
                      })}
                    </Select>
                  </FormControl>
                );
              }
              return (
                <TextField key={f.key} label={f.label} type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} value={form[f.key]} onChange={setField(f.key)} fullWidth size="small" />
              );
            })}
            {sortable && <TextField label="Thứ tự hiển thị" type="number" value={form.sortOrder} onChange={setField("sortOrder")} fullWidth size="small" inputProps={{ min: 0 }} />}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">Trạng thái hoạt động</Typography>
              <Switch checked={Boolean(form.active)} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} color="inherit">Hủy</Button>
          <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa {itemName} <strong>{deleting?.name}</strong> (mã <strong>{deleting?.code}</strong>) không?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)} color="inherit">Hủy</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={saving}>{saving ? "Đang xóa..." : "Xóa"}</Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default CatalogManager;
