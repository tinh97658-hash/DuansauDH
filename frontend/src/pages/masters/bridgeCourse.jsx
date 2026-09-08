import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
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
    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? "Cập nhật học bổ sung kiến thức" : "Đăng ký học bổ sung kiến thức"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {!editing && <FormControl fullWidth><InputLabel>Học viên Thạc sĩ</InputLabel><Select label="Học viên Thạc sĩ" value={form.admissionRecordId} onChange={(e) => setForm({ ...form, admissionRecordId: e.target.value })}>{candidates.map((c) => <MenuItem key={c.id} value={c.id}>{c.code || "Chưa có mã"} - {c.fullName} ({c.major?.name || c.majorName || "Chưa xếp ngành"})</MenuItem>)}</Select>{!candidates.length && <Typography variant="caption" color="text.secondary">Không có học viên đủ điều kiện theo bộ lọc.</Typography>}</FormControl>}
      <FormControl fullWidth><InputLabel>Học phần bổ sung</InputLabel><Select label="Học phần bổ sung" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>{subjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.code} - {s.name} ({s.credits} TC)</MenuItem>)}</Select></FormControl>
      <TextField fullWidth label="Năm học" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
      <FormControl fullWidth><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, score: e.target.value === "exempt" ? "" : form.score })}>{Object.entries(STATES).map(([k, v]) => <MenuItem key={k} value={k}>{v[0]}</MenuItem>)}</Select></FormControl>
      <Stack direction="row" spacing={2}><TextField fullWidth type="number" label="Điểm (0–10)" value={form.score} disabled={form.status === "exempt"} inputProps={{ min: 0, max: 10, step: 0.01 }} onChange={(e) => setForm({ ...form, score: e.target.value })} /><TextField fullWidth type="date" label="Ngày hoàn thành" value={form.completedAt} InputLabelProps={{ shrink: true }} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} /></Stack>
      <TextField label="Số quyết định / biên bản" value={form.decisionNo} onChange={(e) => setForm({ ...form, decisionNo: e.target.value })} /><TextField multiline minRows={2} label="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Hủy</Button><Button variant="contained" disabled={saving} onClick={save}>{saving ? <CircularProgress size={22} /> : "Lưu"}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}><DialogTitle>Xóa đăng ký?</DialogTitle><DialogContent><Typography>Xóa học phần <strong>{deleting?.subject?.name}</strong> của <strong>{deleting?.admissionRecord?.fullName}</strong>?</Typography></DialogContent><DialogActions><Button onClick={() => setDeleting(null)}>Hủy</Button><Button color="error" variant="contained" onClick={remove}>Xóa</Button></DialogActions></Dialog>
  </FeatureLayout>;
}
