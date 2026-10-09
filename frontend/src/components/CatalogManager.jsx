import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, FormControlLabel, IconButton, MenuItem, Paper, Select, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography, ListSubheader,
} from "@mui/material";
import { AddRounded, DeleteRounded, EditRounded } from "@mui/icons-material";
import { API_BASE_URL } from "../config/http";
import FeatureLayout from "./FeatureLayout";
import { personNameParts } from "../utils/personName";
import FilterSearchField from "./FilterSearchField";
import { alphabeticalOptionGroups } from "../utils/optionGroups";

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


const compactFieldLabelSx = {
  display: "block",
  mb: "5px",
  color: "#435b72",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};

const compactControlSx = {
  "& .MuiOutlinedInput-root": {
    height: 40,
    borderRadius: "6px",
    backgroundColor: "#fff",
    color: "#1c2936",
    fontSize: "13px",
    fontWeight: 500,
    "& fieldset": { borderColor: "#c5d1db" },
    "&:hover fieldset": { borderColor: "#8fa6b9" },
    "&.Mui-focused fieldset": { borderColor: "#087eae", borderWidth: "1.5px" },
  },
  "& .MuiOutlinedInput-input": {
    height: "auto",
    padding: "9px 11px",
    lineHeight: "20px",
  },
  "& .MuiSelect-select": {
    minHeight: "0!important",
    padding: "9px 32px 9px 11px!important",
    lineHeight: "20px",
  },
};

const CompactField = ({ label, htmlFor, helper, error = false, children, sx }) => (
  <Box sx={{ minWidth: 0, ...sx }}>
    {label && <Typography component="label" htmlFor={htmlFor} sx={compactFieldLabelSx}>{label}</Typography>}
    {children}
    {helper && (
      <Typography sx={{ mt: "4px", color: error ? "error.main" : "#607486", fontSize: "10.5px", fontWeight: 500, lineHeight: "14px" }}>
        {helper}
      </Typography>
    )}
  </Box>
);

// MUI 5.8 Select injects role="option" into every child. Keep group headings
// presentational and skip them in MenuList keyboard focus.
const AlphabeticalHeader = ({ children }) => (
  <ListSubheader role="presentation" sx={{ color: "#173b5d", fontWeight: 700, lineHeight: "32px", bgcolor: "#f5f8fb" }}>{children}</ListSubheader>
);

const EMPTY_FIELDS = [];

const CatalogManager = ({
  title, group, desc, endpoint, itemName, nameLabel = "Tên", codeLabel = "Mã",
  sortable = true, parent = null, parentBeforeName = false, fields = EMPTY_FIELDS, editOnDoubleClick = false,
  showEditAction = true, showDeleteAction = true, showSortColumn = sortable,
  showCode = true, showIndex = true, splitPersonName = false,
  inlineEdit = false,
}) => {
  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState([]);
  const [fieldOptions, setFieldOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildEmptyForm(parent, fields, sortable));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [inlineCell, setInlineCell] = useState(null);
  const inlineRef = useRef(null);
  const [inlineSaving, setInlineSaving] = useState(false);

  const startInlineEdit = (row, key) => {
    if (!isAdmin || inlineRef.current || saving) return;
    const cell = { id: row.id, key, value: row[key] || "", original: row[key] || "", error: "" };
    inlineRef.current = cell;
    setInlineCell(cell);
  };
  const cancelInlineEdit = () => {
    if (inlineRef.current?.pending) return;
    inlineRef.current = null;
    setInlineCell(null);
  };
  const saveInlineEdit = async () => {
    const cell = inlineRef.current;
    if (!cell || cell.pending) return;
    const value = cell.value.trim();
    if (!value) {
      const next = { ...cell, error: `Vui lòng nhập ${cell.key === "code" ? codeLabel.toLowerCase() : nameLabel.toLowerCase()}.` };
      inlineRef.current = next; setInlineCell(next); return;
    }
    if (value === cell.original) { cancelInlineEdit(); return; }
    inlineRef.current = { ...cell, pending: true };
    setInlineSaving(true);
    try {
      const { data } = await axios.put(`${API_BASE_URL}${endpoint}/${cell.id}`, { [cell.key]: value }, { withCredentials: true });
      setRows((previous) => previous.map((row) => row.id === cell.id ? { ...row, [cell.key]: data?.[cell.key] ?? value } : row));
      inlineRef.current = null; setInlineCell(null);
    } catch (failure) {
      const next = { ...cell, error: failure.response?.data?.message || `Không thể lưu ${itemName}.` };
      inlineRef.current = next; setInlineCell(next);
    } finally { setInlineSaving(false); }
  };
  const renderEditableCell = (row, key, label, content) => {
    if (!inlineEdit || !isAdmin) return content;
    if (inlineCell?.id === row.id && inlineCell.key === key) return <TextField
      autoFocus fullWidth size="small" value={inlineCell.value} disabled={inlineSaving}
      inputProps={{ "aria-label": label }} error={!!inlineCell.error} helperText={inlineCell.error || ""}
      onChange={(event) => { const next = { ...inlineRef.current, value: event.target.value, error: "" }; inlineRef.current = next; setInlineCell(next); }}
      onBlur={saveInlineEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); saveInlineEdit(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelInlineEdit(); }
      }}
    />;
    return <Box component="button" type="button" aria-label={`Sửa ${label.toLowerCase()} ${row.code || row.name}`}
      onDoubleClick={() => startInlineEdit(row, key)} disabled={inlineSaving}
      title="Nhấp đúp để sửa"
      sx={{ display: "block", width: "100%", border: 0, p: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "text" }}>
      {content}
    </Box>;
  };

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
        setOptions(list.map((item) => ({
          value: item.id,
          label: parent.optionLabel ? parent.optionLabel(item) : item.name,
          raw: item,
        })));
      })
      .catch(() => mounted && setOptions([]));
    return () => { mounted = false; };
  }, [parent]);

  useEffect(() => {
    const dynamicFields = fields.filter((f) => f.type === "select" && f.optionsEndpoint);
    if (dynamicFields.length === 0) { setFieldOptions({}); return; }
    let mounted = true;
    Promise.all(dynamicFields.map(async (f) => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}${f.optionsEndpoint}`, { withCredentials: true });
        const list = Array.isArray(data) ? data : data.data || [];
        return [f.key, list.map((item) => (
          typeof item === "string" ? { value: item, label: item, raw: item } : { value: item.id, label: (f.optionLabel ? f.optionLabel(item) : item.name), raw: item }
        ))];
      } catch {
        return [f.key, []];
      }
    })).then((entries) => mounted && setFieldOptions(Object.fromEntries(entries)))
      .catch(() => mounted && setFieldOptions({}));
    return () => { mounted = false; };
  }, [fields]);

  const tableFields = fields.filter((f) => f.showInTable !== false);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    const haystacks = (row) => [
      showCode ? row.code : "", row.name,
      ...tableFields.map((f) => f.searchValue ? f.searchValue(row, fieldOptions[f.key]) : row[f.key]),
      parent ? (parent.display ? parent.display(row) : row[parent.field]) : "",
    ];
    return rows.filter((row) => haystacks(row).some((v) => String(v ?? "").toLowerCase().includes(keyword)));
  }, [rows, search, parent, tableFields, showCode, fieldOptions]);

  const showActions = isAdmin && (showEditAction || showDeleteAction);
  const colSpan = (showIndex ? 1 : 0) + (showCode ? 1 : 0) + (splitPersonName ? 2 : 1) + (parent ? 1 : 0) + tableFields.length + (showSortColumn ? 1 : 0) + 1 + (showActions ? 1 : 0);

  const openAdd = () => { setEditingId(null); setForm(buildEmptyForm(parent, fields, sortable)); setDialogOpen(true); };
  const openEdit = (row) => {
    if (inlineEdit) { startInlineEdit(row, "name"); return; }
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
  const setParentField = (event) => setForm((prev) => ({
    ...prev,
    [parent.field]: event.target.value,
    ...(parent.resetFields || []).reduce((values, key) => ({ ...values, [key]: "" }), {}),
  }));

  const submit = async () => {
    if (showCode && !form.code?.trim()) return toast.error(`Vui lòng nhập ${codeLabel.toLowerCase()}`);
    if (!form.name?.trim()) return toast.error(`Vui lòng nhập ${nameLabel.toLowerCase()}`);
    const body = { name: form.name.trim(), active: Boolean(form.active) };
    if (showCode) body.code = form.code.trim();
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
        if ((f.required || (f.requiredOnCreate && !editingId)) && !value) return toast.error(`Vui lòng ${f.type === "select" ? "chọn" : "nhập"} ${f.label}`);
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
    if (f.display) return f.display(row, fieldOptions[f.key]);
    if (f.type === "checkbox" || f.type === "boolean") {
      return row[f.key] ? (
        <Chip size="small" label="Có" color="primary" variant="outlined" />
      ) : (
        <Chip size="small" label="Không" variant="outlined" />
      );
    }
    if (f.type === "select" && (fieldOptions[f.key] || Array.isArray(f.options))) {
      const selectOptions = fieldOptions[f.key] || f.options;
      const opt = selectOptions.find((o) => (typeof o === "object" ? o.value === row[f.key] : o === row[f.key]));
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
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 1.5,
          bgcolor: "#FFF",
          borderColor: "#C6D5E1",
          borderRadius: "10px",
          boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
          <FilterSearchField
            placeholder={showCode ? `Tìm theo ${codeLabel.toLowerCase()} hoặc tên...` : "Tìm theo tên..."}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: { xs: 0, sm: 280 }, width: { xs: "100%", sm: "auto" }, flexGrow: 1 }}
          />
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={openAdd}
              sx={{
                height: 40,
                px: 2,
                width: { xs: "100%", sm: 190 },
                flexShrink: 0,
                bgcolor: "#0788B8",
                borderRadius: "8px",
                boxShadow: "none",
                textTransform: "none",
                fontWeight: 700,
                "&:hover": { bgcolor: "#056A8F", boxShadow: "none" },
              }}
            >
              Thêm mới
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f0f4fa" }}>
              {showIndex && <TableCell sx={{ width: 60, fontWeight: 700 }}>STT</TableCell>}
              {showCode && <TableCell sx={{ fontWeight: 700 }}>{codeLabel}</TableCell>}
              {parent && parentBeforeName && <TableCell sx={{ fontWeight: 700 }}>{parent.columnLabel || parent.label}</TableCell>}
              {splitPersonName ? <><TableCell sx={{ fontWeight: 700 }}>Họ đệm</TableCell><TableCell sx={{ fontWeight: 700 }}>Tên</TableCell></> : <TableCell sx={{ fontWeight: 700 }}>{nameLabel}</TableCell>}
              {parent && !parentBeforeName && <TableCell sx={{ fontWeight: 700 }}>{parent.columnLabel || parent.label}</TableCell>}
              {tableFields.map((f) => <TableCell key={f.key} sx={{ fontWeight: 700 }}>{f.label}</TableCell>)}
              {showSortColumn && <TableCell align="center" sx={{ fontWeight: 700, width: 90 }}>Thứ tự</TableCell>}
              <TableCell align="center" sx={{ fontWeight: 700, width: 110 }}>Trạng thái</TableCell>
              {showActions && <TableCell align="right" sx={{ fontWeight: 700, width: 110 }}>Thao tác</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 4, color: "text.secondary" }}>Chưa có dữ liệu.</TableCell></TableRow>
            ) : filtered.map((row, index) => (
              <TableRow key={row.id} hover onDoubleClick={isAdmin && editOnDoubleClick && !inlineEdit ? () => openEdit(row) : undefined}
                title={isAdmin && editOnDoubleClick ? "Nhấp đúp để sửa" : undefined}
                sx={isAdmin && editOnDoubleClick ? { cursor: "pointer" } : undefined}>
                {showIndex && <TableCell>{index + 1}</TableCell>}
                {showCode && <TableCell>{renderEditableCell(row, "code", codeLabel, <Typography variant="body2" sx={{ fontFamily: "inherit" }}>{row.code}</Typography>)}</TableCell>}
                {parent && parentBeforeName && <TableCell>{parent.display ? parent.display(row) : row[parent.field]}</TableCell>}
                {splitPersonName ? <><TableCell>{personNameParts(row).familyAndMiddle}</TableCell><TableCell>{personNameParts(row).givenName}</TableCell></> : <TableCell>{renderEditableCell(row, "name", nameLabel, row.name)}</TableCell>}
                {parent && !parentBeforeName && <TableCell>{parent.display ? parent.display(row) : row[parent.field]}</TableCell>}
                {tableFields.map((f) => <TableCell key={f.key}>{renderFieldValue(row, f)}</TableCell>)}
                {showSortColumn && <TableCell align="center">{row.sortOrder}</TableCell>}
                <TableCell align="center" onDoubleClick={(event) => event.stopPropagation()}>
                  {isAdmin ? (
                    <Tooltip title={row.active ? "Đang hoạt động" : "Đã ẩn"}>
                      <Switch size="small" checked={Boolean(row.active)} onChange={() => toggleActive(row)} />
                    </Tooltip>
                  ) : (
                    <Chip size="small" label={row.active ? "Hoạt động" : "Ẩn"} color={row.active ? "success" : "default"} variant="outlined" />
                  )}
                </TableCell>
                {showActions && (
                  <TableCell align="right" onDoubleClick={(event) => event.stopPropagation()}>
                    {showEditAction && <Tooltip title={inlineEdit ? "Nhấp đúp để sửa" : "Sửa"}><IconButton aria-label="Sửa" size="small" color="primary" onClick={inlineEdit ? undefined : () => openEdit(row)} onDoubleClick={inlineEdit ? () => openEdit(row) : undefined}><EditRounded fontSize="small" /></IconButton></Tooltip>}
                    {showDeleteAction && <Tooltip title="Xóa"><IconButton size="small" color="error" onClick={() => setDeleting(row)}><DeleteRounded fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            width: 580,
            maxWidth: "calc(100vw - 32px)",
            border: "1px solid #cfdbe4",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(23, 61, 112, 0.14)",
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            "& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiChip-root": {
              fontFamily: '"Inter", "Segoe UI", sans-serif!important',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, color: "#173d70", fontSize: "17px", fontWeight: 700, lineHeight: "23px", borderBottom: "1px solid #e1e8ee", textTransform: "uppercase" }}>
          <span>{editingId ? `Sửa ${itemName}` : `Thêm ${itemName} mới`}</span>
          <IconButton aria-label="Đóng" size="small" onClick={closeDialog} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2 }}>
          <Stack spacing="14px">
            <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
              <Stack spacing="13px">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: showCode ? "160px 1fr" : "1fr" }, gap: 1.5 }}>
                  {showCode && <CompactField label={codeLabel.toUpperCase()} htmlFor="catalog-code">
                    <TextField id="catalog-code" value={form.code} onChange={setField("code")} inputProps={{ "aria-label": codeLabel }} fullWidth size="small" sx={compactControlSx} />
                  </CompactField>}
                  <CompactField label={nameLabel.toUpperCase()} htmlFor="catalog-name">
                    <TextField id="catalog-name" value={form.name} onChange={setField("name")} inputProps={{ "aria-label": nameLabel }} fullWidth size="small" sx={compactControlSx} />
                  </CompactField>
                </Box>
                {parent && (
                  <CompactField label={parent.label.toUpperCase()} htmlFor="catalog-parent">
                    <FormControl fullWidth size="small" sx={compactControlSx}>
                      <Select id="catalog-parent" value={form[parent.field]} inputProps={{ "aria-label": parent.label }} onChange={setParentField}>
                        {parent.optional && <MenuItem value="">(Không)</MenuItem>}
                        {options.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CompactField>
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
                            size="small"
                          />
                        }
                        label={<Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#223548" }}>{f.label}</Typography>}
                      />
                    );
                  }
                  if (f.type === "number") {
                    return (
                      <CompactField key={f.key} label={f.label.toUpperCase()} htmlFor={`catalog-${f.key}`}>
                        <TextField key={f.key} id={`catalog-${f.key}`} type="number" value={form[f.key]} onChange={setField(f.key)} fullWidth size="small"
                          inputProps={{ min: f.min ?? 0, step: f.step ?? 1, "aria-label": f.label }} sx={compactControlSx} />
                      </CompactField>
                    );
                  }
                  if (f.type === "multiline") {
                    return (
                      <CompactField key={f.key} label={f.label.toUpperCase()} htmlFor={`catalog-${f.key}`}>
                        <TextField key={f.key} id={`catalog-${f.key}`} value={form[f.key]} onChange={setField(f.key)} fullWidth size="small" multiline minRows={3} inputProps={{ "aria-label": f.label }}
                          sx={{
                            ...compactControlSx,
                            "& .MuiOutlinedInput-root": {
                              ...compactControlSx["& .MuiOutlinedInput-root"],
                              height: "auto",
                              minHeight: 80,
                            },
                          }} />
                      </CompactField>
                    );
                  }
                  if (f.type === "select" && (f.optionsEndpoint || Array.isArray(f.options))) {
                    const selectOptions = (fieldOptions[f.key] || f.options || [])
                      .filter((option) => !f.filterOption || f.filterOption(option?.raw ?? option, form));
                    const groupedOptions = f.alphabeticalGroups ? alphabeticalOptionGroups([
                      ...selectOptions.map((option) => typeof option === "object" ? option : { value: option, label: option }),
                      ...(f.allowEmpty !== false ? [{ value: "", label: "(Không có)" }] : []),
                    ]) : null;
                    return (
                      <CompactField key={f.key} label={f.label.toUpperCase()} htmlFor={`catalog-${f.key}`}
                        helper={typeof f.helper === "function" ? f.helper(form, rows.find((row) => row.id === editingId)) : f.helper}>
                        <FormControl key={f.key} fullWidth size="small" sx={compactControlSx}>
                          <Select
                            id={`catalog-${f.key}`}
                            value={form[f.key] ?? ""}
                            onChange={setField(f.key)}
                            inputProps={{ "aria-label": f.label }}
                          >
                            {groupedOptions ? groupedOptions.flatMap((group) => [
                              <AlphabeticalHeader key={`heading:${group.label}`} disabled>{group.label}</AlphabeticalHeader>,
                              ...group.items.map((option) => <MenuItem key={`option:${option.value}`} value={option.value} sx={{ pl: 3.5, fontWeight: 400 }}>{option.label}</MenuItem>),
                            ]) : [
                            f.allowEmpty !== false && <MenuItem key="empty" value=""><em>(Không có)</em></MenuItem>,
                            ...selectOptions.map((opt) => {
                              const val = typeof opt === "object" ? opt.value : opt;
                              const lbl = typeof opt === "object" ? opt.label : opt;
                              return <MenuItem key={val} value={val}>{lbl}</MenuItem>;
                            })]}
                          </Select>
                        </FormControl>
                      </CompactField>
                    );
                  }
                  return (
                    <CompactField key={f.key} label={f.label.toUpperCase()} htmlFor={`catalog-${f.key}`}>
                      <TextField key={f.key} id={`catalog-${f.key}`} type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} value={form[f.key]} onChange={setField(f.key)} fullWidth size="small" inputProps={{ "aria-label": f.label }} sx={compactControlSx} />
                    </CompactField>
                  );
                })}
                {sortable && (
                  <CompactField label="THỨ TỰ HIỂN THỊ" htmlFor="catalog-sort">
                    <TextField id="catalog-sort" type="number" value={form.sortOrder} onChange={setField("sortOrder")} fullWidth size="small" inputProps={{ min: 0, "aria-label": "Thứ tự hiển thị" }} sx={compactControlSx} />
                  </CompactField>
                )}
              </Stack>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5 }}>
              <Typography sx={{ color: "#435b72", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Trạng thái hoạt động</Typography>
              <Switch checked={Boolean(form.active)} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
          <Button onClick={closeDialog} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button variant="contained" onClick={submit} disabled={saving} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
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
        <DialogTitle sx={{ px: 2.5, py: 1.75, color: "#173d70", fontSize: "16px", fontWeight: 700, borderBottom: "1px solid #e1e8ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Xác nhận xóa</span>
          <IconButton aria-label="Đóng" size="small" onClick={() => setDeleting(null)} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2 }}>
          <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>
            Bạn có chắc muốn xóa {itemName} <strong>{deleting?.name}</strong>{showCode && <> (mã <strong>{deleting?.code}</strong>)</>} không?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
          <Button onClick={() => setDeleting(null)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={saving} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", boxShadow: "none", fontSize: "12.5px", fontWeight: 700 }}>
            {saving ? "Đang xóa..." : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    
  </FeatureLayout>
  );
};

export default CatalogManager;
