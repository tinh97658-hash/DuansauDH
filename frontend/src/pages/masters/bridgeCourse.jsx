import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { AddRounded, DeleteRounded, EditRounded, RefreshRounded, SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";

const now = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => String(now - 5 + i));
const STATES = {
  assigned: ["Đã phân công", "default"], studying: ["Đang học", "info"],
  completed: ["Đã hoàn thành", "success"], exempt: ["Được miễn", "secondary"],
};
const RESULTS = {
  pending: ["Chưa có kết quả", "default"], passed: ["Đạt", "success"],
  failed: ["Không đạt", "error"], exempt: ["Miễn học", "secondary"],
};
const blank = (year) => ({ admissionRecordId: "", subjectId: "", academicYear: year, status: "assigned", score: "", decisionNo: "", completedAt: "", note: "" });


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

export default function BridgeCourse() {
  const [rows, setRows] = useState([]), [subjects, setSubjects] = useState([]), [majors, setMajors] = useState([]), [candidates, setCandidates] = useState([]);
  const [summary, setSummary] = useState({}), [year, setYear] = useState(String(now)), [status, setStatus] = useState("ALL"), [major, setMajor] = useState("ALL"), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState(null), [form, setForm] = useState(blank(String(now))), [saving, setSaving] = useState(false), [deleting, setDeleting] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE_URL}/system/bridge-knowledge`), axios.get(`${API_BASE_URL}/system/majors?program=masters`), axios.get(`${API_BASE_URL}/auth/isStaff`),
    ]).then(([s, m, a]) => {
      setSubjects((Array.isArray(s.data) ? s.data : s.data?.data || []).filter((x) => x.active !== false));
      setMajors((Array.isArray(m.data) ? m.data : m.data?.data || []).filter((x) => x.active !== false));
      setAdmin(a.data?.message === "admin");
    }).catch(() => setError("Không thể tải danh mục học bổ sung kiến thức."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ academicYear: year });
      if (status !== "ALL") p.set("status", status); if (major !== "ALL") p.set("majorId", major);
      const { data } = await axios.get(`${API_BASE_URL}/masters/bridge-course?${p}`);
      setRows(data.items || []); setSummary(data.summary || {}); setError("");
    } catch (e) { setError(e.response?.data?.message || "Không thể tải danh sách học bổ sung kiến thức."); }
    finally { setLoading(false); }
  }, [year, status, major]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const key = search.trim().toLocaleLowerCase("vi");
    return key ? rows.filter((r) => [r.admissionRecord?.code, r.admissionRecord?.fullName, r.subject?.code, r.subject?.name].some((v) => String(v || "").toLocaleLowerCase("vi").includes(key))) : rows;
  }, [rows, search]);

  const create = async () => {
    try {
      const p = new URLSearchParams(); if (major !== "ALL") p.set("majorId", major);
      const { data } = await axios.get(`${API_BASE_URL}/masters/bridge-course/candidates?${p}`);
      setCandidates(Array.isArray(data) ? data : []);
    } catch { setCandidates([]); }
    setEditing(null); setForm(blank(year)); setOpen(true);
  };
  const edit = (r) => {
    setEditing(r.id); setForm({ admissionRecordId: r.admissionRecordId, subjectId: r.subjectId, academicYear: r.academicYear, status: r.status, score: r.score ?? "", decisionNo: r.decisionNo || "", completedAt: r.completedAt || "", note: r.note || "" }); setOpen(true);
  };
  const save = async () => {
    if (!editing && !form.admissionRecordId) return toast.error("Vui lòng chọn học viên.");
    if (!form.subjectId) return toast.error("Vui lòng chọn học phần.");
    if (form.status === "completed" && form.score === "") return toast.error("Vui lòng nhập điểm hoàn thành.");
    setSaving(true);
    const payload = { ...form, score: form.score === "" ? null : Number(form.score), decisionNo: form.decisionNo || null, completedAt: form.completedAt || null, note: form.note || null };
    if (editing) delete payload.admissionRecordId;
    try {
      if (editing) await axios.put(`${API_BASE_URL}/masters/bridge-course/${editing}`, payload); else await axios.post(`${API_BASE_URL}/masters/bridge-course`, payload);
      toast.success(editing ? "Đã cập nhật kết quả học bổ sung." : "Đã đăng ký học phần bổ sung."); setOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.message || "Không thể lưu đăng ký."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await axios.delete(`${API_BASE_URL}/masters/bridge-course/${deleting.id}`); toast.success("Đã xóa đăng ký."); setDeleting(null); load(); }
    catch (e) { toast.error(e.response?.data?.message || "Không thể xóa đăng ký."); }
    finally { setSaving(false); }
  };

  return <FeatureLayout title="Học bổ sung kiến thức" group="Thủ tục đầu vào" desc="Đăng ký, theo dõi tiến độ và kết quả học phần bổ sung kiến thức của học viên Thạc sĩ.">
    <ToastContainer position="top-center" newestOnTop limit={3} />
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
      {[["Tổng đăng ký", summary.total, "#087da5"], ["Đã phân công", summary.assigned, "#667085"], ["Đang học", summary.studying, "#168bc2"], ["Đạt / miễn", summary.passed, "#168b63"], ["Không đạt", summary.failed, "#c0392b"]].map(([label, value, color]) => <Paper key={label} variant="outlined" sx={{ px: 2, py: 1.25, flex: 1 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700} sx={{ color }}>{value || 0}</Typography></Paper>)}
    </Stack>
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}><Stack direction="row" spacing={1.2} flexWrap="wrap" alignItems="center">
      <FormControl size="small" sx={{ minWidth: 110 }}><InputLabel>Năm học</InputLabel><Select label="Năm học" value={year} onChange={(e) => setYear(e.target.value)}>{YEARS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 155 }}><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}><MenuItem value="ALL">Tất cả</MenuItem>{Object.entries(STATES).map(([k, v]) => <MenuItem key={k} value={k}>{v[0]}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 210 }}><InputLabel>Chuyên ngành</InputLabel><Select label="Chuyên ngành" value={major} onChange={(e) => setMajor(e.target.value)}><MenuItem value="ALL">Tất cả chuyên ngành</MenuItem>{majors.map((m) => <MenuItem key={m.id} value={m.id}>{m.code} - {m.name}</MenuItem>)}</Select></FormControl>
      <TextField size="small" placeholder="Tìm học viên, học phần..." value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <SearchRounded fontSize="small" sx={{ mr: 1 }} /> }} sx={{ minWidth: 220, flex: 1 }} />
      <Tooltip title="Tải lại"><IconButton onClick={load}><RefreshRounded /></IconButton></Tooltip>{admin && <Button variant="contained" startIcon={<AddRounded />} onClick={create}>Đăng ký học phần</Button>}
    </Stack></Paper>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow sx={{ bgcolor: "#f5f8fa" }}><TableCell>Mã HV</TableCell><TableCell>Họ và tên</TableCell><TableCell>Chuyên ngành</TableCell><TableCell>Học phần bổ sung</TableCell><TableCell align="center">TC</TableCell><TableCell>Thời gian</TableCell><TableCell>Trạng thái</TableCell><TableCell align="center">Điểm</TableCell><TableCell>Kết quả</TableCell>{admin && <TableCell align="right">Thao tác</TableCell>}</TableRow></TableHead><TableBody>
      {loading ? <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}><CircularProgress size={30} /></TableCell></TableRow> : !visible.length ? <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}>Chưa có đăng ký phù hợp bộ lọc.</TableCell></TableRow> : visible.map((r) => <TableRow key={r.id} hover><TableCell>{r.admissionRecord?.code || "—"}</TableCell><TableCell><strong>{r.admissionRecord?.fullName}</strong></TableCell><TableCell>{r.admissionRecord?.major?.name || r.admissionRecord?.majorName || "—"}</TableCell><TableCell><strong>{r.subject?.code}</strong> - {r.subject?.name}</TableCell><TableCell align="center">{r.subject?.credits || 0}</TableCell><TableCell>{r.academicYear}</TableCell><TableCell><Chip size="small" label={(STATES[r.status] || STATES.assigned)[0]} color={(STATES[r.status] || STATES.assigned)[1]} /></TableCell><TableCell align="center">{r.score ?? "—"}</TableCell><TableCell><Chip size="small" variant="outlined" label={(RESULTS[r.result] || RESULTS.pending)[0]} color={(RESULTS[r.result] || RESULTS.pending)[1]} /></TableCell>{admin && <TableCell align="right"><IconButton size="small" onClick={() => edit(r)}><EditRounded fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => setDeleting(r)}><DeleteRounded fontSize="small" /></IconButton></TableCell>}</TableRow>)}
    </TableBody></Table></TableContainer>
    <Dialog
      open={open}
      onClose={() => !saving && setOpen(false)}
      fullWidth
      maxWidth="sm"
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
        <span>{editing ? "CẬP NHẬT HỌC BỔ SUNG KIẾN THỨC" : "ĐĂNG KÝ HỌC BỔ SUNG KIẾN THỨC"}</span>
        <IconButton aria-label="Đóng" size="small" onClick={() => !saving && setOpen(false)} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Stack spacing="14px">
          <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
            <Stack spacing="13px">
              {!editing && (
                <CompactField
                  label="HỌC VIÊN THẠC SĨ"
                  htmlFor="bridge-student"
                  helper={!candidates.length ? "Không có học viên đủ điều kiện theo bộ lọc." : undefined}
                >
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select
                      id="bridge-student"
                      value={form.admissionRecordId}
                      inputProps={{ "aria-label": "Học viên Thạc sĩ" }}
                      onChange={(e) => setForm({ ...form, admissionRecordId: e.target.value })}
                    >
                      {candidates.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.code || "Chưa có mã"} - {c.fullName} ({c.major?.name || c.majorName || "Chưa xếp ngành"})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CompactField>
              )}

              <CompactField label="HỌC PHẦN BỔ SUNG" htmlFor="bridge-subject">
                <FormControl fullWidth size="small" sx={compactControlSx}>
                  <Select
                    id="bridge-subject"
                    value={form.subjectId}
                    inputProps={{ "aria-label": "Học phần bổ sung" }}
                    onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  >
                    {subjects.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.code} - {s.name} ({s.credits} TC)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CompactField>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="NĂM HỌC" htmlFor="bridge-year">
                  <TextField id="bridge-year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} fullWidth size="small" inputProps={{ "aria-label": "Năm học" }} sx={compactControlSx} />
                </CompactField>
                <CompactField label="TRẠNG THÁI" htmlFor="bridge-status">
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select
                      id="bridge-status"
                      value={form.status}
                      inputProps={{ "aria-label": "Trạng thái" }}
                      onChange={(e) => setForm({ ...form, status: e.target.value, score: e.target.value === "exempt" ? "" : form.score })}
                    >
                      {Object.entries(STATES).map(([k, v]) => (
                        <MenuItem key={k} value={k}>{v[0]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </CompactField>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="ĐIỂM (0–10)" htmlFor="bridge-score">
                  <TextField
                    id="bridge-score"
                    type="number"
                    value={form.score}
                    disabled={form.status === "exempt"}
                    inputProps={{ min: 0, max: 10, step: 0.01, "aria-label": "Điểm" }}
                    onChange={(e) => setForm({ ...form, score: e.target.value })}
                    fullWidth
                    size="small"
                    sx={compactControlSx}
                  />
                </CompactField>
                <CompactField label="NGÀY HOÀN THÀNH" htmlFor="bridge-completed-at">
                  <TextField
                    id="bridge-completed-at"
                    type="date"
                    value={form.completedAt}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
                    fullWidth
                    size="small"
                    inputProps={{ "aria-label": "Ngày hoàn thành" }}
                    sx={compactControlSx}
                  />
                </CompactField>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <CompactField label="SỐ QUYẾT ĐỊNH / BIÊN BẢN" htmlFor="bridge-decision">
              <TextField id="bridge-decision" placeholder="Nhập số quyết định..." value={form.decisionNo} onChange={(e) => setForm({ ...form, decisionNo: e.target.value })} fullWidth size="small" inputProps={{ "aria-label": "Số quyết định" }} sx={compactControlSx} />
            </CompactField>
            <CompactField label="GHI CHÚ" htmlFor="bridge-note">
              <TextField id="bridge-note" placeholder="Nhập ghi chú..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} fullWidth size="small" inputProps={{ "aria-label": "Ghi chú" }} sx={compactControlSx} />
            </CompactField>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
        <Button onClick={() => setOpen(false)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
        <Button variant="contained" disabled={saving} onClick={save} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}>
          {saving ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Lưu"}
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
        <span>Xác nhận xóa đăng ký</span>
        <IconButton aria-label="Đóng" size="small" onClick={() => setDeleting(null)} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, py: 2 }}>
        <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>
          Bạn có chắc muốn xóa học phần <strong>{deleting?.subject?.name}</strong> của <strong>{deleting?.admissionRecord?.fullName}</strong> không?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
        <Button onClick={() => setDeleting(null)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
        <Button color="error" variant="contained" onClick={remove} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", boxShadow: "none", fontSize: "12.5px", fontWeight: 700 }}>Xóa</Button>
      </DialogActions>
    </Dialog>
  
  </FeatureLayout>;
}
