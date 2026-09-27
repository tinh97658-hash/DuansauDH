import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, Paper, Stack, Switch, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { AddRounded, EditRounded, SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";
import { getRoomFloor } from "../../utils/schedulingCalendar";

const rowsFrom = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
const emptyForm = { code: "", name: "", capacity: "", isActive: true };


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

const Rooms = () => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomResponse, sessionResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/system/rooms?includeInactive=true`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/auth/session`, { withCredentials: true }),
      ]);
      setRows(rowsFrom(roomResponse.data));
      setIsAdmin(sessionResponse.data?.user?.role === "admin");
      setError("");
    } catch (requestFailure) {
      setError(requestFailure?.response?.data?.message || "Không thể tải danh mục phòng học.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return rows;
    return rows.filter((room) => `${room.code} ${room.name}`.toLocaleLowerCase("vi").includes(keyword));
  }, [rows, search]);

  const openCreate = () => { setForm(emptyForm); setDialog({ id: null }); setError(""); };
  const openEdit = (room) => { setForm({ code: room.code, name: room.name, capacity: room.capacity ?? "", isActive: room.isActive }); setDialog({ id: room.id }); setError(""); };
  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || !/^\d/.test(form.code.trim())) {
      setError("Vui lòng nhập đủ tên phòng; mã phòng phải bắt đầu bằng số tầng.");
      return;
    }
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) <= 0) {
      setError("Sức chứa phải là số nguyên lớn hơn 0.");
      return;
    }
    setSaving(true);
    try {
      const body = { code: form.code.trim(), name: form.name.trim(), capacity: Number(form.capacity), isActive: Boolean(form.isActive) };
      if (dialog.id) await axios.put(`${API_BASE_URL}/system/rooms/${dialog.id}`, body, { withCredentials: true });
      else await axios.post(`${API_BASE_URL}/system/rooms`, body, { withCredentials: true });
      setDialog(null);
      setFeedback(dialog.id ? "Phòng học đã được cập nhật." : "Phòng học đã được thêm.");
      await load();
    } catch (requestFailure) {
      setError(requestFailure?.response?.data?.message || "Không thể lưu phòng học.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (room) => {
    setSaving(true);
    setError("");
    try {
      await axios.put(`${API_BASE_URL}/system/rooms/${room.id}`, { isActive: !room.isActive }, { withCredentials: true });
      setFeedback(`Phòng ${room.code} đã được ${room.isActive ? "vô hiệu hóa" : "kích hoạt"}.`);
      await load();
    } catch (requestFailure) {
      setError(requestFailure?.response?.data?.message || "Không thể cập nhật trạng thái phòng học.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureLayout title="Phòng học" group="Danh mục đào tạo" desc="Quản lý danh mục phòng dùng chung cho xếp lịch." hideHeader={false}>
      <Stack spacing={1.25}>
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {feedback && <Alert severity="success" onClose={() => setFeedback("")}>{feedback}</Alert>}
        {!loading && !isAdmin && <Alert severity="info">Chỉ quản trị viên được thêm, sửa hoặc thay đổi trạng thái phòng học.</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small" placeholder="Tìm theo mã hoặc tên phòng" value={search} onChange={(event) => setSearch(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ flexGrow: 1 }}
          />
          {isAdmin && <Button variant="contained" startIcon={<AddRounded />} onClick={openCreate}>Thêm phòng</Button>}
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ width: 60 }}>#</TableCell><TableCell>Mã phòng</TableCell><TableCell>Tên phòng</TableCell><TableCell align="center">Tầng</TableCell><TableCell align="center">Sức chứa</TableCell><TableCell align="center">Trạng thái</TableCell>{isAdmin && <TableCell align="right">Thao tác</TableCell>}</TableRow></TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 4, color: "text.secondary" }}>Chưa có phòng học.</TableCell></TableRow>
              ) : filtered.map((room, index) => (
                <TableRow key={room.id} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: "inherit", fontWeight: 700 }}>{room.code}</Typography></TableCell>
                  <TableCell>{room.name}</TableCell>
                  <TableCell align="center">{getRoomFloor(room.code) ?? "—"}</TableCell>
                  <TableCell align="center">{room.capacity ?? "Chưa khai báo"}</TableCell>
                  <TableCell align="center"><Chip size="small" color={room.isActive ? "success" : "default"} label={room.isActive ? "Đang sử dụng" : "Ngừng sử dụng"} /></TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <Tooltip title="Sửa phòng"><IconButton aria-label={`Sửa phòng ${room.code}`} size="small" onClick={() => openEdit(room)}><EditRounded fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title={room.isActive ? "Vô hiệu hóa" : "Kích hoạt"}>
                        <Switch checked={room.isActive} onChange={() => toggleActive(room)} disabled={saving} inputProps={{ "aria-label": `${room.isActive ? "Vô hiệu hóa" : "Kích hoạt"} phòng ${room.code}` }} />
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Dialog
        open={Boolean(dialog)}
        onClose={saving ? undefined : () => setDialog(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            width: 520,
            maxWidth: "calc(100vw - 32px)",
            border: "1px solid #cfdbe4",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(23, 61, 112, 0.14)",
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            "& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root": {
              fontFamily: '"Inter", "Segoe UI", sans-serif!important',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, color: "#173d70", fontSize: "17px", fontWeight: 700, lineHeight: "23px", borderBottom: "1px solid #e1e8ee", textTransform: "uppercase" }}>
          <span>{dialog?.id ? "SỬA PHÒNG HỌC" : "THÊM PHÒNG HỌC MỚI"}</span>
          <IconButton aria-label="Đóng" size="small" onClick={() => setDialog(null)} disabled={saving} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2 }}>
          <Stack spacing="14px">
            {error && <Alert severity="error" sx={{ borderRadius: "6px" }}>{error}</Alert>}
            <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
              <Stack spacing="13px">
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                  <CompactField label="MÃ PHÒNG" htmlFor="room-code">
                    <TextField id="room-code" autoFocus value={form.code} onChange={setField("code")} inputProps={{ maxLength: 30, "aria-label": "Mã phòng" }} fullWidth size="small" sx={compactControlSx} />
                  </CompactField>
                  <CompactField label="TÊN PHÒNG" htmlFor="room-name">
                    <TextField id="room-name" value={form.name} onChange={setField("name")} inputProps={{ maxLength: 200, "aria-label": "Tên phòng" }} fullWidth size="small" sx={compactControlSx} />
                  </CompactField>
                </Box>
                <CompactField label="SỨC CHỨA" htmlFor="room-capacity">
                  <TextField id="room-capacity" type="number" value={form.capacity} onChange={setField("capacity")} inputProps={{ min: 1, step: 1, "aria-label": "Sức chứa" }} fullWidth size="small" sx={compactControlSx} />
                </CompactField>
              </Stack>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5 }}>
              <Typography sx={{ color: "#435b72", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>Trạng thái hoạt động</Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                <Typography sx={{ fontSize: "13px", fontWeight: 500, color: "#223548" }}>{form.isActive ? "Đang sử dụng" : "Ngừng sử dụng"}</Typography>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
          <Button onClick={() => setDialog(null)} disabled={saving} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button variant="contained" onClick={submit} disabled={saving} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    
  </FeatureLayout>
  );
};

export default Rooms;
