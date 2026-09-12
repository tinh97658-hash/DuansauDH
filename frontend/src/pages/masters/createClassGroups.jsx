import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, AutoAwesomeRounded, DeleteRounded, EditRounded,
  GroupWorkRounded, RefreshRounded, SearchRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));

const initialForm = (year = String(currentYear)) => ({
  code: "",
  name: "",
  count: 1,
  majorId: "",
  academicYear: year,
  maxStudents: 40,
  status: "open",
  note: "",
});

const initialBatchForm = (year = String(currentYear)) => ({
  codePrefix: "THS-N",
  namePrefix: "Nhóm học phần",
  count: 2,
  startIndex: 1,
  majorId: "",
  academicYear: year,
  maxStudents: 40,
});

const CreateClassGroups = () => {
  const navigate = useNavigate();

  // Filters
  const [majors, setMajors] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMajor, setSelectedMajor] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  // Data & loading
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm(String(currentYear)));
  const [batchForm, setBatchForm] = useState(initialBatchForm(String(currentYear)));
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);

  // Load majors
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        setMajors(Array.isArray(data) ? data : data.data || []);
      })
      .catch(() => mounted && setMajors([]));

    axios.get(`${API_BASE_URL}/auth/isStaff`, { withCredentials: true })
      .then(({ data }) => mounted && setIsAdmin(data.message === "admin"))
      .catch(() => mounted && setIsAdmin(false));

    return () => { mounted = false; };
  }, []);

  // Load groups
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("academicYear", selectedYear);
      if (selectedMajor !== "ALL") params.append("majorId", selectedMajor);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);

      const { data } = await axios.get(`${API_BASE_URL}/masters/class-groups?${params.toString()}`, {
        withCredentials: true,
      });
      setGroups(Array.isArray(data) ? data : data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách nhóm học phần.");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMajor, selectedStatus]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Filtered rows
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return groups;
    return groups.filter((g) =>
      (g.code || "").toLowerCase().includes(kw) ||
      (g.name || "").toLowerCase().includes(kw) ||
      (g.major?.name || "").toLowerCase().includes(kw) ||
      (g.note || "").toLowerCase().includes(kw)
    );
  }, [groups, search]);

  const automaticNames = useMemo(() => {
    const major = majors.find((item) => item.id === form.majorId);
    if (!major?.code || !form.academicYear) return [];
    const prefix = `${major.code.toUpperCase()}${form.academicYear}.`;
    const usedIndexes = groups
      .filter((group) => group.majorId === form.majorId && group.academicYear === form.academicYear)
      .map((group) => String(group.name || ""))
      .filter((name) => name.startsWith(prefix))
      .map((name) => Number(name.slice(prefix.length)))
      .filter(Number.isInteger);
    const startIndex = Math.max(0, ...usedIndexes) + 1;
    return Array.from({ length: Math.min(10, Math.max(0, Number(form.count) || 0)) }, (_, offset) => `${prefix}${String(startIndex + offset).padStart(2, "0")}`);
  }, [form.academicYear, form.count, form.majorId, groups, majors]);

  // Actions
  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...initialForm(selectedYear),
      majorId: selectedMajor !== "ALL" ? selectedMajor : (majors[0]?.id || ""),
    });
    setDialogOpen(true);
  };

  const openBatchAdd = () => {
    setBatchForm({
      ...initialBatchForm(selectedYear),
      majorId: selectedMajor !== "ALL" ? selectedMajor : (majors[0]?.id || ""),
    });
    setBatchDialogOpen(true);
  };

  const openEdit = (group) => {
    setEditingId(group.id);
    setForm({
      code: group.code,
      name: group.name,
      count: 1,
      majorId: group.majorId || "",
      academicYear: group.academicYear || selectedYear,
      maxStudents: group.maxStudents || 40,
      status: group.status || "open",
      note: group.note || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId && !form.code?.trim()) return toast.error("Vui lòng nhập mã nhóm học phần.");
    if (editingId && !form.name?.trim()) return toast.error("Vui lòng nhập tên nhóm học phần.");
    if (!editingId && !form.majorId) return toast.error("Vui lòng chọn chuyên ngành.");
    const count = Number(form.count || 0);
    if (!editingId && (count < 1 || count > 10)) return toast.error("Số lượng nhóm cần tạo từ 1 đến 10.");
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        majorId: form.majorId || null,
        academicYear: form.academicYear,
        maxStudents: Number(form.maxStudents || 40),
        status: form.status,
        note: form.note?.trim() || null,
      };

      if (editingId) {
        await axios.put(`${API_BASE_URL}/masters/class-groups/${editingId}`, payload, { withCredentials: true });
        toast.success("Cập nhật nhóm học phần thành công.");
      } else {
        const major = majors.find((item) => item.id === form.majorId);
        if (!major?.code) throw new Error("Chuyên ngành chưa có tên viết tắt.");
        const { data: currentGroupsData } = await axios.get(`${API_BASE_URL}/masters/class-groups?${new URLSearchParams({ majorId: form.majorId, academicYear: form.academicYear })}`, { withCredentials: true });
        const currentGroups = Array.isArray(currentGroupsData) ? currentGroupsData : currentGroupsData.data || [];
        const namePrefix = `${major.code.toUpperCase()}${form.academicYear}.`;
        const codePrefix = `${String(form.academicYear).slice(-2)}${major.code.toUpperCase()}`;
        const usedIndexes = currentGroups.flatMap((group) => {
          const values = [];
          if (String(group.name || "").startsWith(namePrefix)) values.push(Number(String(group.name).slice(namePrefix.length)));
          if (String(group.code || "").startsWith(codePrefix)) values.push(Number(String(group.code).slice(codePrefix.length)));
          return values.filter(Number.isInteger);
        });
        const startIndex = Math.max(0, ...usedIndexes) + 1;
        await axios.post(`${API_BASE_URL}/masters/class-groups/batch`, {
          codePrefix,
          namePrefix,
          count,
          startIndex,
          majorId: form.majorId,
          academicYear: form.academicYear,
          maxStudents: Number(form.maxStudents || 40),
          status: form.status,
          note: form.note?.trim() || undefined,
        }, { withCredentials: true });
        toast.success(`Đã tạo thành công ${count} nhóm học phần.`);
      }
      setDialogOpen(false);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu nhóm học phần.");
    } finally {
      setSaving(false);
    }
  };

  const handleBatchCreate = async () => {
    const count = Number(batchForm.count || 0);
    if (count < 1 || count > 10) return toast.error("Số lượng nhóm cần tạo từ 1 đến 10.");
    if (!batchForm.codePrefix?.trim()) return toast.error("Vui lòng nhập tiền tố mã nhóm.");

    setSaving(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/masters/class-groups/batch`, {
        codePrefix: batchForm.codePrefix.trim().toUpperCase(),
        namePrefix: batchForm.namePrefix.trim(),
        count,
        startIndex: Number(batchForm.startIndex || 1),
        majorId: batchForm.majorId || undefined,
        academicYear: batchForm.academicYear,
        maxStudents: Number(batchForm.maxStudents || 40),
      }, { withCredentials: true });
      toast.success(`Đã tạo thành công ${data.count} nhóm học phần.`);
      setBatchDialogOpen(false);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tạo hàng loạt nhóm học phần.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setSaving(true);
    try {
      await axios.delete(`${API_BASE_URL}/masters/class-groups/${deletingGroup.id}`, { withCredentials: true });
      toast.success(`Đã xóa nhóm "${deletingGroup.name}".`);
      setDeletingGroup(null);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa nhóm học phần.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureLayout
      title="Tạo nhóm học phần"
      group="Thủ tục đầu vào"
      desc="Quản lý và mở các nhóm học phần cho học viên Thạc sĩ theo từng ngành học và khóa tuyển sinh."
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />

      {/* Filter Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: "#fbfcfd" }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="year-filter-label">Năm học</InputLabel>
            <Select
              labelId="year-filter-label"
              label="Năm học"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="major-filter-label">Ngành học</InputLabel>
            <Select
              labelId="major-filter-label"
              label="Ngành học"
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
            >
              <MenuItem value="ALL">-- Tất cả ngành --</MenuItem>
              {majors.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name} ({m.code})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="status-filter-label">Trạng thái</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Trạng thái"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="ALL">-- Tất cả --</MenuItem>
              <MenuItem value="open">Đang mở</MenuItem>
              <MenuItem value="closed">Đã đóng</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder="Tìm theo mã nhóm, tên nhóm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" sx={{ color: "#8A9AAA" }} />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />

          <IconButton color="primary" onClick={loadGroups} title="Tải lại">
            <RefreshRounded />
          </IconButton>

          {isAdmin && (
            <>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeRounded />}
                onClick={openBatchAdd}
                sx={{ height: 36, borderColor: "#0788B8", color: "#0788B8", "&:hover": { borderColor: "#056A8F", bgcolor: "#f0f7fb" } }}
              >
                Tạo nhanh nhiều nhóm
              </Button>
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={openAdd}
                sx={{ height: 36, bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}
              >
                Thêm nhóm mới
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Class Groups Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f0f4fa" }}>
              <TableCell sx={{ width: 48, fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Mã nhóm</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tên nhóm học phần</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Ngành học</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 90 }}>Năm học</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 150 }}>Sĩ số</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 110 }}>Trạng thái</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 170 }}>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                  Chưa có nhóm học phần nào phù hợp. Bấm "Thêm nhóm mới" hoặc "Tạo nhanh nhiều nhóm" để bắt đầu.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, index) => {
                const count = row.memberCount || 0;
                const max = row.maxStudents || 40;
                const pct = Math.min(100, Math.round((count / max) * 100));
                const progressColor = pct >= 100 ? "error" : pct >= 80 ? "warning" : "primary";

                return (
                  <TableRow key={row.id} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "inherit", fontWeight: 700, color: "#0788B8" }}>
                        {row.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.name}</Typography>
                      {row.note && <Typography variant="caption" color="text.secondary">{row.note}</Typography>}
                    </TableCell>
                    <TableCell>{row.major?.name || "-"}</TableCell>
                    <TableCell align="center">{row.academicYear || "-"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <LinearProgress variant="determinate" value={pct} color={progressColor} sx={{ height: 6, borderRadius: 3 }} />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 42 }}>
                          {count}/{max}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.status === "open" ? "Đang mở" : "Đã đóng"}
                        color={row.status === "open" ? "success" : "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Phân học viên vào nhóm">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => navigate(`/masters/assign-class-groups?groupId=${row.id}&majorId=${row.majorId || ""}&year=${row.academicYear || ""}`)}
                        >
                          <GroupWorkRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {isAdmin && (
                        <>
                          <Tooltip title="Chỉnh sửa">
                            <IconButton size="small" color="primary" onClick={() => openEdit(row)}>
                              <EditRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xóa">
                            <IconButton size="small" color="error" onClick={() => setDeletingGroup(row)}>
                              <DeleteRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { width: 720 } }}>
        <DialogTitle sx={{ px: 3, py: 2 }}>
          {editingId ? "Chỉnh sửa nhóm học phần" : "Thêm nhóm học phần mới"}
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Stack spacing={2.25}>
            {editingId && <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 2 }}>
              <Box>
                <Typography component="label" htmlFor="class-group-code" variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>MÃ NHÓM</Typography>
                <TextField id="class-group-code" placeholder="VD: 26CNT01" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} fullWidth size="small" required />
              </Box>
              <Box>
                <Typography component="label" htmlFor="class-group-name" variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>TÊN NHÓM HỌC PHẦN</Typography>
                <TextField id="class-group-name" placeholder="VD: CNT2026.01" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} fullWidth size="small" required />
              </Box>
            </Box>}

            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>CHUYÊN NGÀNH</Typography>
              <FormControl fullWidth size="small">
                <Select value={form.majorId} inputProps={{ "aria-label": "Chuyên ngành" }} onChange={(e) => setForm((p) => ({ ...p, majorId: e.target.value }))}>
                  <MenuItem value=""><em>(Không phân ngành / Dùng chung)</em></MenuItem>
                  {majors.map((m) => <MenuItem key={m.id} value={m.id}>{m.name} ({m.code})</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: editingId ? "1fr 1fr" : "1fr 1fr 1fr", gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>NĂM HỌC / KHÓA</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.academicYear} inputProps={{ "aria-label": "Năm học / Khóa" }} onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))}>
                    {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              {!editingId && <Box>
                <Typography component="label" htmlFor="class-group-count" variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>SỐ NHÓM CẦN TẠO</Typography>
                <TextField id="class-group-count" type="number" value={form.count} onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 10 }} />
              </Box>}
              <Box>
                <Typography component="label" htmlFor="class-group-capacity" variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>SĨ SỐ TỐI ĐA / NHÓM</Typography>
                <TextField id="class-group-capacity" type="number" value={form.maxStudents} onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 200 }} />
              </Box>
            </Box>

            {!editingId && automaticNames.length > 0 && <Box sx={{ p: 2, border: "1px solid #B9DCEE", borderRadius: 1.5, bgcolor: "#F2F9FD" }}>
              <Typography variant="caption" sx={{ display: "block", mb: 0.75, color: "#0788B8", fontWeight: 700 }}>TÊN NHÓM ĐƯỢC TẠO TỰ ĐỘNG</Typography>
              <Typography sx={{ color: "#173E75", fontSize: 14, fontWeight: 700, lineHeight: 1.6 }}>{automaticNames.join("  •  ")}</Typography>
            </Box>}

            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>TRẠNG THÁI NHÓM</Typography>
              <FormControl fullWidth size="small">
                <Select value={form.status} inputProps={{ "aria-label": "Trạng thái nhóm" }} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  <MenuItem value="open">Đang mở (Cho phép phân học viên)</MenuItem>
                  <MenuItem value="closed">Đã đóng (Khóa nhóm)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography component="label" htmlFor="class-group-note" variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 700, color: "text.secondary" }}>GHI CHÚ</Typography>
              <TextField id="class-group-note" placeholder="Nhập ghi chú nếu cần..." multiline rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} fullWidth size="small" />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Hủy</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : editingId ? "Lưu nhóm" : `Tạo ${form.count || 0} nhóm`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Create Dialog */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo nhanh nhiều nhóm học phần</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Hệ thống sẽ tự động sinh mã và tên nhóm theo số lượng bạn chỉ định (ví dụ: N01, N02, N03...).
          </Typography>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Tiền tố mã nhóm"
                placeholder="VD: THS-K32-N"
                value={batchForm.codePrefix}
                onChange={(e) => setBatchForm((p) => ({ ...p, codePrefix: e.target.value.toUpperCase() }))}
                fullWidth
                size="small"
                required
              />
              <TextField
                label="Tiền tố tên nhóm"
                placeholder="VD: Nhóm"
                value={batchForm.namePrefix}
                onChange={(e) => setBatchForm((p) => ({ ...p, namePrefix: e.target.value }))}
                fullWidth
                size="small"
                required
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Số lượng nhóm cần tạo"
                type="number"
                value={batchForm.count}
                onChange={(e) => setBatchForm((p) => ({ ...p, count: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 1, max: 10 }}
              />
              <TextField
                label="Bắt đầu từ số"
                type="number"
                value={batchForm.startIndex}
                onChange={(e) => setBatchForm((p) => ({ ...p, startIndex: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
            </Stack>

            <FormControl fullWidth size="small">
              <InputLabel id="batch-major-label">Ngành học</InputLabel>
              <Select
                labelId="batch-major-label"
                label="Ngành học"
                value={batchForm.majorId}
                onChange={(e) => setBatchForm((p) => ({ ...p, majorId: e.target.value }))}
              >
                <MenuItem value=""><em>(Không phân ngành / Dùng chung)</em></MenuItem>
                {majors.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name} ({m.code})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="batch-year-label">Năm học</InputLabel>
                <Select
                  labelId="batch-year-label"
                  label="Năm học"
                  value={batchForm.academicYear}
                  onChange={(e) => setBatchForm((p) => ({ ...p, academicYear: e.target.value }))}
                >
                  {YEARS.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Sĩ số tối đa/nhóm"
                type="number"
                value={batchForm.maxStudents}
                onChange={(e) => setBatchForm((p) => ({ ...p, maxStudents: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 1, max: 200 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBatchDialogOpen(false)} color="inherit">Hủy</Button>
          <Button variant="contained" onClick={handleBatchCreate} disabled={saving}>
            {saving ? "Đang tạo..." : `Tạo ${batchForm.count} nhóm`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={Boolean(deletingGroup)} onClose={() => setDeletingGroup(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa nhóm <strong>{deletingGroup?.name}</strong> (Mã: <strong>{deletingGroup?.code}</strong>) không?
          </Typography>
          {deletingGroup?.memberCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              Nhóm này đang có <strong>{deletingGroup?.memberCount}</strong> học viên. Các học viên sẽ được đưa về trạng thái chưa phân nhóm.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeletingGroup(null)} color="inherit">Hủy</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>
            {saving ? "Đang xóa..." : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default CreateClassGroups;
