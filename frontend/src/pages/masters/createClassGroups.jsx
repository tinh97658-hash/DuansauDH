import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, DeleteRounded, EditRounded, GroupWorkRounded,
  RefreshRounded, SearchRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import {
  AUTO_ASSIGN_METHODS,
  buildGroupNames,
  calculateDistribution,
  getNextGroupIndex,
  validateNameTemplate,
} from "./createClassGroups.logic";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));

const initialForm = (year = String(currentYear)) => ({
  code: "",
  name: "",
  count: 1,
  majorId: "",
  academicYear: year,
  maxStudents: 40,
  nameTemplate: "",
  status: "open",
  note: "",
});

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

const compactSectionLabelSx = {
  color: "#435b72",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  whiteSpace: "nowrap",
};

const compactChipSx = {
  height: 30,
  borderColor: "#bfd0dd",
  borderRadius: "6px",
  backgroundColor: "#f7fbfd",
  color: "#173d70",
  fontSize: "12px",
  fontWeight: 600,
  "& .MuiChip-label": { px: 1.25 },
};

const compactAlertSx = {
  minHeight: 32,
  px: 1.25,
  py: 0.25,
  borderRadius: "6px",
  fontSize: "11.5px",
  lineHeight: "17px",
  "& .MuiAlert-icon": { mr: 0.75, py: "5px", fontSize: 18 },
  "& .MuiAlert-message": { py: "5px" },
};

const CompactField = ({ label, htmlFor, helper, error = false, children, sx }) => (
  <Box sx={{ minWidth: 0, ...sx }}>
    <Typography component="label" htmlFor={htmlFor} sx={compactFieldLabelSx}>{label}</Typography>
    {children}
    {helper && (
      <Typography sx={{ mt: "4px", color: error ? "error.main" : "#607486", fontSize: "10.5px", fontWeight: 500, lineHeight: "14px" }}>
        {helper}
      </Typography>
    )}
  </Box>
);

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
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm(String(currentYear)));
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [dialogScopeGroups, setDialogScopeGroups] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [dialogScopeLoading, setDialogScopeLoading] = useState(false);
  const [dialogScopeError, setDialogScopeError] = useState("");
  const [eligibleError, setEligibleError] = useState("");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [assignmentMethod, setAssignmentMethod] = useState(AUTO_ASSIGN_METHODS.BALANCED);
  const [customCounts, setCustomCounts] = useState([""]);

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

  const selectedFormMajor = useMemo(
    () => majors.find((item) => item.id === form.majorId),
    [form.majorId, majors],
  );
  const codePrefix = useMemo(() => (
    selectedFormMajor?.code && form.academicYear
      ? `${String(form.academicYear).slice(-2)}${selectedFormMajor.code.toUpperCase()}`
      : ""
  ), [form.academicYear, selectedFormMajor]);
  const nameTemplateError = useMemo(
    () => validateNameTemplate(form.nameTemplate),
    [form.nameTemplate],
  );
  const startIndex = useMemo(
    () => getNextGroupIndex(dialogScopeGroups, form.nameTemplate, codePrefix),
    [codePrefix, dialogScopeGroups, form.nameTemplate],
  );
  const automaticNames = useMemo(
    () => (nameTemplateError ? [] : buildGroupNames(form.nameTemplate, startIndex, form.count)),
    [form.count, form.nameTemplate, nameTemplateError, startIndex],
  );
  const unassignedStudents = useMemo(
    () => eligibleStudents.filter((student) => !student.assignedGroup),
    [eligibleStudents],
  );
  const distribution = useMemo(() => calculateDistribution({
    method: assignmentMethod,
    totalStudents: unassignedStudents.length,
    groupCount: form.count,
    maxStudents: form.maxStudents,
    customValues: customCounts,
    groupNames: automaticNames,
  }), [assignmentMethod, automaticNames, customCounts, form.count, form.maxStudents, unassignedStudents.length]);

  useEffect(() => {
    if (!dialogOpen || editingId || !form.majorId || !form.academicYear) return undefined;
    let active = true;
    setDialogScopeLoading(true);
    setDialogScopeError("");
    axios.get(`${API_BASE_URL}/masters/class-groups?${new URLSearchParams({ majorId: form.majorId, academicYear: form.academicYear })}`, {
      withCredentials: true,
    }).then(({ data }) => {
      if (active) setDialogScopeGroups(Array.isArray(data) ? data : data.data || []);
    }).catch(() => {
      if (active) {
        setDialogScopeGroups([]);
        setDialogScopeError("Không thể kiểm tra các nhóm đã tồn tại trong phạm vi này.");
      }
    }).finally(() => {
      if (active) setDialogScopeLoading(false);
    });
    return () => { active = false; };
  }, [dialogOpen, editingId, form.academicYear, form.majorId]);

  useEffect(() => {
    if (!dialogOpen || editingId || !autoAssignEnabled || !form.majorId || !form.academicYear) {
      setEligibleStudents([]);
      setEligibleError("");
      setEligibleLoading(false);
      return undefined;
    }
    let active = true;
    setEligibleLoading(true);
    setEligibleError("");
    axios.get(`${API_BASE_URL}/masters/class-groups/eligible-students?${new URLSearchParams({ majorId: form.majorId, academicYear: form.academicYear })}`, {
      withCredentials: true,
    }).then(({ data }) => {
      if (active) setEligibleStudents(Array.isArray(data) ? data : data.data || []);
    }).catch(() => {
      if (active) {
        setEligibleStudents([]);
        setEligibleError("Không thể tải danh sách học viên chưa phân nhóm.");
      }
    }).finally(() => {
      if (active) setEligibleLoading(false);
    });
    return () => { active = false; };
  }, [autoAssignEnabled, dialogOpen, editingId, form.academicYear, form.majorId]);

  useEffect(() => {
    const count = Math.min(10, Math.max(1, Number(form.count) || 1));
    setCustomCounts((previous) => Array.from(
      { length: count },
      (_, index) => (index === count - 1 ? "" : previous[index] ?? ""),
    ));
  }, [form.count]);

  const autoValidationError = useMemo(() => {
    if (!autoAssignEnabled) return "";
    if (eligibleLoading) return "Đang tải danh sách học viên...";
    if (eligibleError) return eligibleError;
    if (Number(form.count) < 2) return "Cần ít nhất 2 nhóm để phân học viên tự động.";
    if (form.status !== "open") return "Các nhóm phải ở trạng thái Đang mở để phân học viên tự động.";
    if (unassignedStudents.length === 0) return "Hiện không có học viên chưa phân nhóm.";
    if (assignmentMethod === AUTO_ASSIGN_METHODS.LOCATION) return "Theo địa bàn chưa khả dụng do chưa có quy tắc nghiệp vụ.";
    if (distribution.error) return distribution.error;
    if (!distribution.complete) return `Còn ${distribution.remaining} học viên cần phân.`;
    return "";
  }, [assignmentMethod, autoAssignEnabled, distribution, eligibleError, eligibleLoading, form.count, form.status, unassignedStudents.length]);

  // Actions
  const openAdd = () => {
    const majorId = selectedMajor !== "ALL" ? selectedMajor : (majors[0]?.id || "");
    const major = majors.find((item) => item.id === majorId);
    setEditingId(null);
    setForm({
      ...initialForm(selectedYear),
      majorId,
      nameTemplate: major?.code ? `${major.code.toUpperCase()}${selectedYear}.{n}` : "",
    });
    setAutoAssignEnabled(false);
    setAssignmentMethod(AUTO_ASSIGN_METHODS.BALANCED);
    setCustomCounts([""]);
    setEligibleStudents([]);
    setDialogScopeGroups([]);
    setDialogScopeLoading(false);
    setDialogScopeError("");
    setEligibleError("");
    setDialogOpen(true);
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
      nameTemplate: "",
      status: group.status || "open",
      note: group.note || "",
    });
    setDialogOpen(true);
  };

  const handleCreateMajorChange = (majorId) => {
    const major = majors.find((item) => item.id === majorId);
    setForm((previous) => ({
      ...previous,
      majorId,
      nameTemplate: major?.code ? `${major.code.toUpperCase()}${previous.academicYear}.{n}` : "",
    }));
    setCustomCounts(Array.from({ length: Math.min(10, Math.max(1, Number(form.count) || 1)) }, () => ""));
  };

  const handleCreateYearChange = (academicYear) => {
    const major = majors.find((item) => item.id === form.majorId);
    setForm((previous) => ({
      ...previous,
      academicYear,
      nameTemplate: major?.code ? `${major.code.toUpperCase()}${academicYear}.{n}` : "",
    }));
    setCustomCounts(Array.from({ length: Math.min(10, Math.max(1, Number(form.count) || 1)) }, () => ""));
  };

  const handleSave = async () => {
    if (editingId && !form.code?.trim()) return toast.error("Vui lòng nhập mã nhóm học phần.");
    if (editingId && !form.name?.trim()) return toast.error("Vui lòng nhập tên nhóm học phần.");
    if (!editingId && !form.majorId) return toast.error("Vui lòng chọn chuyên ngành.");
    const count = Number(form.count || 0);
    if (!editingId && (count < 1 || count > 10)) return toast.error("Số lượng nhóm cần tạo từ 1 đến 10.");
    if (!editingId && nameTemplateError) return toast.error(nameTemplateError);
    if (!editingId && automaticNames.some((name) => !name || name.length > 200)) return toast.error("Quy tắc tên nhóm sinh ra tên không hợp lệ.");
    if (!editingId && new Set(automaticNames).size !== automaticNames.length) return toast.error("Quy tắc tên nhóm sinh ra các tên bị trùng nhau.");
    if (!editingId && dialogScopeGroups.some((group) => automaticNames.includes(group.name))) return toast.error("Tên nhóm đã tồn tại trong chuyên ngành và khóa này.");
    if (!editingId && dialogScopeError) return toast.error(dialogScopeError);
    if (!editingId && dialogScopeLoading) return toast.error("Đang kiểm tra các nhóm đã tồn tại.");
    if (!editingId && autoAssignEnabled && autoValidationError) return toast.error(autoValidationError);
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
        await axios.post(`${API_BASE_URL}/masters/class-groups/batch`, {
          codePrefix,
          namePrefix: `${major.code.toUpperCase()}${form.academicYear}.`,
          nameTemplate: form.nameTemplate.trim(),
          count,
          startIndex,
          majorId: form.majorId,
          academicYear: form.academicYear,
          maxStudents: Number(form.maxStudents || 40),
          status: form.status,
          note: form.note?.trim() || undefined,
          autoAssign: autoAssignEnabled,
          ...(autoAssignEnabled ? {
            assignmentMethod,
            admissionRecordIds: unassignedStudents.map((student) => student.id),
            ...(assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM ? { targetCounts: distribution.counts } : {}),
          } : {}),
        }, { withCredentials: true });
        toast.success(autoAssignEnabled
          ? `Đã tạo ${count} nhóm và phân ${unassignedStudents.length} học viên.`
          : `Đã tạo thành công ${count} nhóm học viên.`);
      }
      setDialogOpen(false);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu nhóm học phần.");
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
      title="Tạo nhóm học viên"
      group="Thủ tục đầu vào"
      desc="Quản lý và mở các nhóm học phần cho học viên Thạc sĩ theo từng ngành học và khóa tuyển sinh."
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />

      {/* Filter Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: "#fbfcfd" }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ flex: "1 1 190px", minWidth: 190 }}>
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

          <FormControl size="small" sx={{ flex: "1 1 190px", minWidth: 190 }}>
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

          <FormControl size="small" sx={{ flex: "1 1 190px", minWidth: 190 }}>
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
            sx={{ flex: "2 1 360px", minWidth: 280 }}
          />

          <IconButton color="primary" onClick={loadGroups} title="Tải lại">
            <RefreshRounded />
          </IconButton>

          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={openAdd}
              sx={{ height: 36, bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}
            >
              Thêm nhóm mới
            </Button>
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
                  Chưa có nhóm học phần nào phù hợp. Bấm "Thêm nhóm mới" để bắt đầu.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, index) => {
                const count = row.memberCount || 0;
                const max = row.maxStudents || 40;
                const pct = Math.min(100, Math.round((count / max) * 100));
                const progressColor = pct >= 100 ? "error" : pct >= 80 ? "warning" : "primary";

                return (
                  <TableRow
                    key={row.id}
                    hover
                    onDoubleClick={() => isAdmin && openEdit(row)}
                    title={isAdmin ? "Nhấp đúp để chỉnh sửa" : undefined}
                    sx={isAdmin ? { cursor: "pointer" } : undefined}
                  >
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
                    <TableCell align="right" onDoubleClick={(event) => event.stopPropagation()}>
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
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            width: editingId ? 800 : 640,
            maxWidth: "calc(100vw - 32px)",
            border: editingId ? "1px solid #dbe3eb" : "1px solid #cfdbe4",
            borderRadius: editingId ? "6px" : "8px",
            boxShadow: editingId ? "0 2px 8px rgba(23, 61, 112, 0.1)" : "0 8px 24px rgba(23, 61, 112, 0.14)",
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            "& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiChip-root": {
              fontFamily: '"Inter", "Segoe UI", sans-serif!important',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: editingId ? 2.25 : 2.5, py: editingId ? 1.25 : 1.75, color: "#173d70", fontSize: editingId ? "14px" : "17px", fontWeight: 700, lineHeight: editingId ? "19px" : "23px", borderBottom: editingId ? "none" : "1px solid #e1e8ee" }}>
          <span>{editingId ? "CHỈNH SỬA NHÓM HỌC VIÊN" : "THÊM NHÓM HỌC VIÊN MỚI"}</span>
          <IconButton aria-label="Đóng" size="small" onClick={() => setDialogOpen(false)} sx={{ width: editingId ? 24 : 30, height: editingId ? 24 : 30, color: editingId ? "#637587" : "#526a7d", fontSize: editingId ? 18 : 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: editingId ? 2.25 : 2.5, py: editingId ? 1.1 : 2 }}>
          {editingId ? (
            <Stack spacing={1.5}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 1.25 }}>
                <TextField label="Mã nhóm" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} fullWidth size="small" required />
                <TextField label="Tên nhóm học viên" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} fullWidth size="small" required />
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 1.25 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-major-label">Chuyên ngành</InputLabel>
                  <Select labelId="edit-major-label" label="Chuyên ngành" value={form.majorId} onChange={(e) => setForm((p) => ({ ...p, majorId: e.target.value }))}>
                    {majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name} ({major.code})</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-year-label">Năm / khóa</InputLabel>
                  <Select labelId="edit-year-label" label="Năm / khóa" value={form.academicYear} onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))}>
                    {YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Sĩ số tối đa / nhóm" type="number" value={form.maxStudents} onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 200 }} />
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 1.25 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-status-label">Trạng thái</InputLabel>
                  <Select labelId="edit-status-label" label="Trạng thái" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <MenuItem value="open">Đang mở</MenuItem>
                    <MenuItem value="closed">Đã đóng</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Ghi chú" placeholder="Nhập ghi chú nếu cần..." value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} fullWidth size="small" />
              </Box>
            </Stack>
          ) : (
            <Stack spacing="14px">
              <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                <Stack spacing="13px">
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(120px, 3fr)", gap: 1.5 }}>
                    <CompactField label="CHUYÊN NGÀNH" htmlFor="create-major">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-major" value={form.majorId} inputProps={{ "aria-label": "Chuyên ngành" }} onChange={(e) => handleCreateMajorChange(e.target.value)}>
                          {majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name} ({major.code})</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="NĂM / KHÓA" htmlFor="create-year">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-year" value={form.academicYear} inputProps={{ "aria-label": "Năm / khóa" }} onChange={(e) => handleCreateYearChange(e.target.value)}>
                          {YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.6fr)", gap: 1.5, alignItems: "start" }}>
                    <CompactField label="SỐ NHÓM CẦN TẠO" htmlFor="create-group-count">
                      <TextField id="create-group-count" type="number" value={form.count} onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 10, "aria-label": "Số nhóm cần tạo" }} sx={compactControlSx} />
                    </CompactField>
                    <CompactField label="SĨ SỐ TỐI ĐA / NHÓM" htmlFor="create-group-capacity">
                      <TextField id="create-group-capacity" type="number" value={form.maxStudents} onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 200, "aria-label": "Sĩ số tối đa / nhóm" }} sx={compactControlSx} />
                    </CompactField>
                    <CompactField label="QUY TẮC TÊN NHÓM" htmlFor="create-name-template" helper={nameTemplateError || "{n}: số thứ tự tự tăng"} error={Boolean(nameTemplateError)}>
                      <TextField
                        id="create-name-template"
                        value={form.nameTemplate}
                        onChange={(e) => setForm((p) => ({ ...p, nameTemplate: e.target.value }))}
                        fullWidth
                        size="small"
                        error={Boolean(nameTemplateError)}
                        inputProps={{ "aria-label": "Quy tắc tên nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Typography sx={compactSectionLabelSx}>XEM TRƯỚC</Typography>
                    {automaticNames.map((name) => <Chip key={name} label={name} size="small" variant="outlined" sx={compactChipSx} />)}
                  </Box>
                </Stack>
              </Box>

              {dialogScopeError && <Alert severity="error" sx={compactAlertSx}>{dialogScopeError}</Alert>}

              <Box sx={{ pt: 1.25, borderTop: "1px solid #d7e1e8" }}>
                <FormControlLabel
                  sx={{ m: 0, alignItems: "flex-start" }}
                  control={<Checkbox size="small" checked={autoAssignEnabled} onChange={(event) => setAutoAssignEnabled(event.target.checked)} sx={{ p: 0, mt: "1px", mr: "10px", color: "#7890a4", "& .MuiSvgIcon-root": { fontSize: 20 } }} />}
                  label={(
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <Typography sx={{ color: "#173d70", fontSize: "13px", fontWeight: 700, lineHeight: "18px" }}>Phân học viên tự động vào các nhóm vừa tạo</Typography>
                      <Typography sx={{ color: "#607486", fontSize: "11px", fontWeight: 500, lineHeight: "15px" }}>Không chọn nếu chỉ muốn tạo nhóm trống.</Typography>
                    </Box>
                  )}
                />

                {autoAssignEnabled && (
                  <Box sx={{ mt: 1.25 }}>
                    <Stack spacing="8px">
                  <Typography sx={{ color: "#173d70", fontSize: "13px", fontWeight: 700, lineHeight: "18px" }}>
                    {eligibleLoading ? "Đang tải học viên chưa phân nhóm..." : `${unassignedStudents.length} học viên chưa phân nhóm`}
                  </Typography>

                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) < 2 && (
                    <Alert severity="warning" sx={compactAlertSx}>Cần ít nhất 2 nhóm để phân học viên tự động.</Alert>
                  )}

                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) >= 2 && <Box>
                    <Typography sx={{ ...compactSectionLabelSx, mb: "4px" }}>CÁCH PHÂN</Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={assignmentMethod}
                      onChange={(_, value) => value && setAssignmentMethod(value)}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "6px",
                        "& .MuiToggleButtonGroup-grouped": {
                          minHeight: 36,
                          m: 0,
                          px: "6px",
                          py: "8px",
                          border: "1px solid #c5d1db!important",
                          borderRadius: "6px!important",
                          backgroundColor: "#fff",
                          color: "#1c2936",
                          fontSize: "12px",
                          fontWeight: 600,
                          lineHeight: "17px",
                          textTransform: "none",
                          whiteSpace: "nowrap",
                          justifyContent: "flex-start",
                          "&.Mui-selected": {
                            borderColor: "#0880b8!important",
                            backgroundColor: "#e5f4fa",
                            color: "#173d70",
                            fontWeight: 700,
                          },
                          "&.Mui-disabled": {
                            borderColor: "#e3e9ee!important",
                            backgroundColor: "#f7f9fa",
                            color: "#8a9aaa",
                          },
                        },
                      }}
                    >
                      <ToggleButton value={AUTO_ASSIGN_METHODS.BALANCED}><span aria-hidden="true">{assignmentMethod === AUTO_ASSIGN_METHODS.BALANCED ? "●" : "○"}</span>&nbsp;Cân bằng sĩ số</ToggleButton>
                      <ToggleButton value={AUTO_ASSIGN_METHODS.FILL_FIRST}><span aria-hidden="true">{assignmentMethod === AUTO_ASSIGN_METHODS.FILL_FIRST ? "●" : "○"}</span>&nbsp;Ưu tiên đủ sĩ số</ToggleButton>
                      <ToggleButton value={AUTO_ASSIGN_METHODS.LOCATION} disabled title="Chưa có quy tắc nghiệp vụ authoritative"><span aria-hidden="true">○</span>&nbsp;Theo địa bàn</ToggleButton>
                      <ToggleButton value={AUTO_ASSIGN_METHODS.CUSTOM}><span aria-hidden="true">{assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM ? "●" : "○"}</span>&nbsp;Tùy chỉnh</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>}

                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) >= 2 && assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM && (
                    <Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: "8px 10px" }}>
                        {automaticNames.map((name, index) => {
                          const isAutoField = index === automaticNames.length - 1;
                          const autoValue = distribution.autoIndex === index ? distribution.counts[index] : "";
                          const inputId = `custom-group-count-${index}`;
                          return (
                            <Box key={name} title={isAutoField ? "Tự tính" : undefined} sx={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                              <Typography component="label" htmlFor={inputId} sx={{ minWidth: 0, flex: 1, overflow: "hidden", color: "#435b72", fontSize: "11px", fontWeight: 700, lineHeight: "15px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {name}
                              </Typography>
                              <TextField
                                id={inputId}
                                type="number"
                                size="small"
                                disabled={isAutoField}
                                value={isAutoField ? autoValue : (customCounts[index] ?? "")}
                                onChange={(event) => setCustomCounts((previous) => Array.from(
                                  { length: automaticNames.length },
                                  (_, itemIndex) => (itemIndex === index ? event.target.value : previous[itemIndex] ?? ""),
                                ))}
                                inputProps={{ min: 0, max: Number(form.maxStudents) || 0, "aria-label": name }}
                                sx={{ ...compactControlSx, width: 55, flexShrink: 0 }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                      <Typography sx={{ mt: 1.25, color: "#173d70", fontSize: "12px", fontWeight: 700, lineHeight: "17px", textAlign: "right" }}>
                        {distribution.counts.reduce((sum, value) => sum + (Number(value) || 0), 0)} / {unassignedStudents.length} học viên
                      </Typography>
                    </Box>
                  )}

                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) >= 2 && assignmentMethod !== AUTO_ASSIGN_METHODS.LOCATION && assignmentMethod !== AUTO_ASSIGN_METHODS.CUSTOM && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <Typography sx={compactSectionLabelSx}>DỰ KIẾN</Typography>
                      {automaticNames.map((name, index) => (
                        <Chip key={name} label={`${name} · ${distribution.counts[index] ?? 0} HV`} size="small" variant="outlined" sx={compactChipSx} />
                      ))}
                    </Box>
                  )}

                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) >= 2 && distribution.error && <Alert severity="error" sx={compactAlertSx}>{distribution.error}</Alert>}
                  {!eligibleLoading && !eligibleError && unassignedStudents.length > 0 && Number(form.count) >= 2 && !distribution.error && assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM && !distribution.complete && (
                    <Typography sx={{ color: "#607486", fontSize: "11px", fontWeight: 500, lineHeight: "15px" }}>Còn {distribution.remaining} học viên cần phân.</Typography>
                  )}
                  {eligibleError && (
                    <Alert severity="warning" sx={compactAlertSx}>{eligibleError}</Alert>
                  )}
                  {!eligibleLoading && !eligibleError && unassignedStudents.length === 0 && (
                    <Typography sx={{ color: "#607486", fontSize: "11px", fontWeight: 500, lineHeight: "15px" }}>Hiện không có học viên để phân tự động.</Typography>
                  )}
                  {Number(form.count) >= 2
                    && !eligibleLoading
                    && !eligibleError
                    && unassignedStudents.length > 0
                    && !distribution.error
                    && autoValidationError
                    && !(assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM && !distribution.complete)
                    && <Alert severity="warning" sx={compactAlertSx}>{autoValidationError}</Alert>}
                    </Stack>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="TRẠNG THÁI" htmlFor="create-status">
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select id="create-status" value={form.status} inputProps={{ "aria-label": "Trạng thái" }} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                      <MenuItem value="open">Đang mở</MenuItem>
                      <MenuItem value="closed">Đã đóng</MenuItem>
                    </Select>
                  </FormControl>
                </CompactField>
                <CompactField label="GHI CHÚ" htmlFor="create-note">
                  <TextField id="create-note" placeholder="Nhập ghi chú nếu cần..." value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} inputProps={{ "aria-label": "Ghi chú" }} fullWidth size="small" sx={compactControlSx} />
                </CompactField>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: editingId ? 2.25 : 2.5, py: editingId ? 1.1 : 1.5, gap: editingId ? 1 : 1.25, minHeight: editingId ? 48 : 60, borderTop: editingId ? "none" : "1px solid #e1e8ee" }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" sx={editingId ? { minHeight: 30, px: 1.625, py: 0.75, border: "1px solid #dbe3eb", borderRadius: "4px", fontSize: "11px" } : { minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || (!editingId && (
              !form.majorId
              || Number(form.count) < 1
              || Number(form.count) > 10
              || Boolean(nameTemplateError)
              || Boolean(dialogScopeError)
              || dialogScopeLoading
              || (autoAssignEnabled && Boolean(autoValidationError))
            ))}
            sx={editingId ? { minHeight: 30, px: 1.625, py: 0.75, borderRadius: "4px", boxShadow: "none", fontSize: "11px" } : { minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}
          >
            {saving
              ? "Đang lưu..."
              : editingId
                ? "Lưu nhóm"
                : autoAssignEnabled
                  ? `Tạo ${form.count || 0} nhóm & phân ${unassignedStudents.length} học viên`
                  : `Tạo ${form.count || 0} nhóm`}
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
