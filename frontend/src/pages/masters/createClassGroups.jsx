import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, DeleteRounded, EditRounded, GroupWorkRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import { disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline } from "../../utils/disciplineScope";
import { buildGroupNames, getNextGroupIndex, validateNameTemplate } from "./createClassGroups.logic";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const majorShortName = (major) => String(major?.name || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
  .split(/\s+/).filter(Boolean).map((word) => word[0]).join("").toUpperCase().slice(0, 8);

const initialForm = (year = String(currentYear)) => ({
  code: "",
  name: "",
  count: 1,
  majorId: "",
  curriculumId: "",
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
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  // Data & loading
  const [groups, setGroups] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [curriculumsLoading, setCurriculumsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDisciplineId, setDialogDisciplineId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm(String(currentYear)));
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [dialogScopeGroups, setDialogScopeGroups] = useState([]);
  const [dialogScopeLoading, setDialogScopeLoading] = useState(false);
  const [dialogScopeError, setDialogScopeError] = useState("");

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
    const allowedMajorIds = new Set(majorsForDiscipline(majors, selectedDiscipline).map((major) => major.id));
    return groups.filter((g) => {
      if (selectedDiscipline && !allowedMajorIds.has(g.majorId || g.major?.id)) return false;
      return !kw
        || (g.code || "").toLowerCase().includes(kw)
        || (g.name || "").toLowerCase().includes(kw)
        || (g.major?.name || "").toLowerCase().includes(kw)
        || (g.note || "").toLowerCase().includes(kw);
    });
  }, [groups, majors, search, selectedDiscipline]);
  const disciplines = useMemo(() => disciplinesFromMajors(majors), [majors]);
  const visibleMajors = useMemo(() => majorsForDiscipline(majors, selectedDiscipline), [majors, selectedDiscipline]);
  const dialogMajors = useMemo(() => majorsForDiscipline(majors, dialogDisciplineId), [majors, dialogDisciplineId]);

  const selectedFormMajor = useMemo(
    () => majors.find((item) => item.id === form.majorId),
    [form.majorId, majors],
  );
  const codePrefix = useMemo(() => (
    selectedFormMajor && form.academicYear
      ? `NH${String(form.academicYear).slice(-2)}`
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
    if (!dialogOpen || !form.majorId || !form.academicYear) {
      setCurriculums([]);
      return undefined;
    }
    let active = true;
    setCurriculumsLoading(true);
    axios.get(`${API_BASE_URL}/plan/curriculums?majorId=${form.majorId}&program=masters`, { withCredentials: true })
      .then(({ data }) => {
        if (!active) return;
        const rows = (Array.isArray(data) ? data : data.data || [])
          .filter((item) => String(item.applicableFromYear) === String(form.academicYear) && item.active !== false);
        setCurriculums(rows);
        setForm((previous) => {
          if (rows.some((item) => item.id === previous.curriculumId)) return previous;
          return { ...previous, curriculumId: rows.length === 1 ? rows[0].id : "" };
        });
      })
      .catch(() => active && setCurriculums([]))
      .finally(() => active && setCurriculumsLoading(false));
    return () => { active = false; };
  }, [dialogOpen, form.academicYear, form.majorId]);

  // Actions
  const openAdd = () => {
    const majorId = selectedMajor !== "ALL" ? selectedMajor : (majors[0]?.id || "");
    const major = majors.find((item) => item.id === majorId);
    setDialogDisciplineId(selectedDiscipline || majorDisciplineId(major));
    setEditingId(null);
    setForm({
      ...initialForm(selectedYear),
      majorId,
      nameTemplate: majorShortName(major) ? `${majorShortName(major)}${selectedYear}.{n}` : "",
    });
    setDialogScopeGroups([]);
    setDialogScopeLoading(false);
    setDialogScopeError("");
    setDialogOpen(true);
  };

  const openEdit = (group) => {
    const groupMajor = majors.find((item) => item.id === group.majorId);
    setDialogDisciplineId(majorDisciplineId(groupMajor));
    setEditingId(group.id);
    setForm({
      code: group.code,
      name: group.name,
      count: 1,
      majorId: group.majorId || "",
      curriculumId: group.curriculumId || "",
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
      curriculumId: "",
      nameTemplate: majorShortName(major) ? `${majorShortName(major)}${previous.academicYear}.{n}` : "",
    }));
  };

  const handleDialogDisciplineChange = (disciplineId) => {
    setDialogDisciplineId(disciplineId);
    const currentMajor = majors.find((item) => item.id === form.majorId);
    if (!disciplineId || majorDisciplineId(currentMajor) === disciplineId) return;
    setForm((previous) => ({ ...previous, majorId: "", curriculumId: "", nameTemplate: "" }));
  };

  const handleCreateYearChange = (academicYear) => {
    const major = majors.find((item) => item.id === form.majorId);
    setForm((previous) => ({
      ...previous,
      academicYear,
      curriculumId: "",
      nameTemplate: majorShortName(major) ? `${majorShortName(major)}${academicYear}.{n}` : "",
    }));
  };

  const handleSave = async () => {
    if (editingId && !form.code?.trim()) return toast.error("Vui lòng nhập mã nhóm học phần.");
    if (editingId && !form.name?.trim()) return toast.error("Vui lòng nhập tên nhóm học phần.");
    if (!editingId && !form.majorId) return toast.error("Vui lòng chọn chuyên ngành.");
    if (!form.curriculumId) return toast.error("Vui lòng chọn chương trình đào tạo cho lớp.");
    const count = Number(form.count || 0);
    if (!editingId && (count < 1 || count > 10)) return toast.error("Số lượng nhóm cần tạo từ 1 đến 10.");
    if (!editingId && nameTemplateError) return toast.error(nameTemplateError);
    if (!editingId && automaticNames.some((name) => !name || name.length > 200)) return toast.error("Quy tắc tên nhóm sinh ra tên không hợp lệ.");
    if (!editingId && new Set(automaticNames).size !== automaticNames.length) return toast.error("Quy tắc tên nhóm sinh ra các tên bị trùng nhau.");
    if (!editingId && dialogScopeGroups.some((group) => automaticNames.includes(group.name))) return toast.error("Tên nhóm đã tồn tại trong chuyên ngành và khóa này.");
    if (!editingId && dialogScopeError) return toast.error(dialogScopeError);
    if (!editingId && dialogScopeLoading) return toast.error("Đang kiểm tra các nhóm đã tồn tại.");
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        majorId: form.majorId || null,
        curriculumId: form.curriculumId,
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
        const shortName = majorShortName(major);
        if (!shortName) throw new Error("Chuyên ngành chưa có tên.");
        await axios.post(`${API_BASE_URL}/masters/class-groups/batch`, {
          codePrefix,
          namePrefix: `${shortName}${form.academicYear}.`,
          nameTemplate: form.nameTemplate.trim(),
          count,
          startIndex,
          majorId: form.majorId,
          curriculumId: form.curriculumId,
          academicYear: form.academicYear,
          maxStudents: Number(form.maxStudents || 40),
          status: form.status,
          note: form.note?.trim() || undefined,
        }, { withCredentials: true });
        toast.success(`Đã tạo thành công ${count} nhóm học viên.`);
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
      maxWidth={1880}
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />

      {/* Filter Bar */}
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
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Năm học" sx={{ flex: "1 1 190px", minWidth: 190 }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
          </FilterSelectField>

          <FilterSelectField label="Ngành" sx={{ flex: "1 1 210px", minWidth: 210 }} value={selectedDiscipline} onChange={(e) => { setSelectedDiscipline(e.target.value); setSelectedMajor("ALL"); }}>
              <MenuItem value="">Tất cả ngành</MenuItem>
              {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
          </FilterSelectField>

          <FilterSelectField label="Chuyên ngành" sx={{ flex: "1 1 210px", minWidth: 210 }}
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
            >
              <MenuItem value="ALL">Tất cả chuyên ngành</MenuItem>
              {visibleMajors.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
              ))}
          </FilterSelectField>

          <FilterSelectField label="Trạng thái" sx={{ flex: "1 1 190px", minWidth: 190 }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="ALL">Tất cả</MenuItem>
              <MenuItem value="open">Đang mở</MenuItem>
              <MenuItem value="closed">Đã đóng</MenuItem>
          </FilterSelectField>

          <FilterSearchField
            placeholder="Tìm theo mã nhóm, tên nhóm, ngành học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: "2 1 360px", minWidth: 280 }}
          />

          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={openAdd}
              sx={{ height: 40, px: 2, bgcolor: "#0788B8", borderRadius: "8px", boxShadow: "none", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
            >
              Thêm nhóm mới
            </Button>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Class Groups Table */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderColor: "#D7E4EE",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 5px 18px rgba(23, 62, 117, 0.06)",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#EDF4FA", "& th": { color: "#111111", py: 1.25, borderColor: "#D7E4EE" } }}>
              <TableCell align="center" sx={{ width: 64, fontWeight: 700 }}>STT</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 140 }}>Mã nhóm</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tên nhóm học phần</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Ngành học</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Chương trình đào tạo</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 90 }}>Năm học</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 150 }}>Sĩ số</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 110 }}>Trạng thái</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 170 }}>Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5, color: "text.secondary" }}>
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
                    sx={{
                      ...(isAdmin ? { cursor: "pointer" } : {}),
                      "&:hover": { bgcolor: "#F5FAFE!important" },
                      "& td": { color: "#111111", py: 1.05, borderColor: "#E2EBF2" },
                    }}
                  >
                    <TableCell align="center">{index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "inherit", fontWeight: 700, color: "#0788B8" }}>
                        {row.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#111111" }}>{row.name}</Typography>
                      {row.note && <Typography variant="caption" sx={{ color: "#111111" }}>{row.note}</Typography>}
                    </TableCell>
                    <TableCell>{row.major?.name || "-"}</TableCell>
                    <TableCell>{row.curriculum ? `${row.curriculum.code} — ${row.curriculum.name}` : "Chưa chọn"}</TableCell>
                    <TableCell align="center">{row.academicYear || "-"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <LinearProgress variant="determinate" value={pct} color={progressColor} sx={{ height: 6, borderRadius: 3 }} />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 42, color: "#111111" }}>
                          {count}/{max}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.status === "open" ? "Đang mở" : "Đã đóng"}
                        color={row.status === "open" ? "success" : "default"}
                        variant="filled"
                        sx={{
                          height: 24,
                          borderRadius: "999px",
                          bgcolor: row.status === "open" ? "#E5F7EC" : "#F0F2F4",
                          color: "#111111",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center" onDoubleClick={(event) => event.stopPropagation()}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.25 }}>
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
                      </Box>
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
            width: 640,
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
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, color: "#173d70", fontSize: "17px", fontWeight: 700, lineHeight: "23px", borderBottom: "1px solid #e1e8ee" }}>
          <span>{editingId ? "CHỈNH SỬA NHÓM HỌC VIÊN" : "THÊM NHÓM HỌC VIÊN MỚI"}</span>
          <IconButton aria-label="Đóng" size="small" onClick={() => setDialogOpen(false)} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2 }}>
          {editingId ? (
            <Stack spacing="14px">
              <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                <Stack spacing="13px">
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(120px, .7fr)", gap: 1.5 }}>
                    <CompactField label="NGÀNH" htmlFor="edit-discipline">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="edit-discipline" value={dialogDisciplineId} inputProps={{ "aria-label": "Ngành" }} onChange={(e) => handleDialogDisciplineChange(e.target.value)}>
                          <MenuItem value="">Tất cả ngành</MenuItem>
                          {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="CHUYÊN NGÀNH" htmlFor="edit-major">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select
                          id="edit-major"
                          value={form.majorId}
                          inputProps={{ "aria-label": "Chuyên ngành" }}
                          onChange={(e) => setForm((p) => ({ ...p, majorId: e.target.value, curriculumId: "" }))}
                        >
                          {dialogMajors.map((major) => (
                            <MenuItem key={major.id} value={major.id}>
                              {major.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="NĂM / KHÓA" htmlFor="edit-year">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select
                          id="edit-year"
                          value={form.academicYear}
                          inputProps={{ "aria-label": "Năm / khóa" }}
                          onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value, curriculumId: "" }))}
                        >
                          {YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                  </Box>

                  <CompactField
                    label="CHƯƠNG TRÌNH ĐÀO TẠO ÁP DỤNG"
                    htmlFor="edit-curriculum"
                    helper={!curriculumsLoading && curriculums.length === 0 ? "Chưa có CTĐT cho chuyên ngành và khóa này. Hãy lập CTĐT trước." : undefined}
                    error={!curriculumsLoading && curriculums.length === 0}
                  >
                    <FormControl fullWidth size="small" sx={compactControlSx} required>
                      <Select
                        id="edit-curriculum"
                        value={form.curriculumId}
                        inputProps={{ "aria-label": "Chương trình đào tạo" }}
                        onChange={(e) => setForm((p) => ({ ...p, curriculumId: e.target.value }))}
                        disabled={curriculumsLoading || curriculums.length === 0}
                      >
                        {curriculums.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.code} — {item.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </CompactField>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1.1fr) minmax(0, 1.9fr) minmax(0, 1.2fr)" }, gap: 1.5, alignItems: "start" }}>
                    <CompactField label="MÃ NHÓM" htmlFor="edit-code">
                      <TextField
                        id="edit-code"
                        value={form.code}
                        onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                        fullWidth
                        size="small"
                        required
                        inputProps={{ "aria-label": "Mã nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>

                    <CompactField label="TÊN NHÓM HỌC VIÊN" htmlFor="edit-name">
                      <TextField
                        id="edit-name"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        fullWidth
                        size="small"
                        required
                        inputProps={{ "aria-label": "Tên nhóm học viên" }}
                        sx={compactControlSx}
                      />
                    </CompactField>

                    <CompactField label="SĨ SỐ TỐI ĐA / NHÓM" htmlFor="edit-max-students">
                      <TextField
                        id="edit-max-students"
                        type="number"
                        value={form.maxStudents}
                        onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))}
                        fullWidth
                        size="small"
                        inputProps={{ min: 1, max: 200, "aria-label": "Sĩ số tối đa / nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="TRẠNG THÁI" htmlFor="edit-status">
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select
                      id="edit-status"
                      value={form.status}
                      inputProps={{ "aria-label": "Trạng thái" }}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <MenuItem value="open">Đang mở</MenuItem>
                      <MenuItem value="closed">Đã đóng</MenuItem>
                    </Select>
                  </FormControl>
                </CompactField>
                <CompactField label="GHI CHÚ" htmlFor="edit-note">
                  <TextField
                    id="edit-note"
                    placeholder="Nhập ghi chú nếu cần..."
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                    inputProps={{ "aria-label": "Ghi chú" }}
                    fullWidth
                    size="small"
                    sx={compactControlSx}
                  />
                </CompactField>
              </Box>
            </Stack>
          ) : (
            <Stack spacing="14px">
              <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                <Stack spacing="13px">
                  <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(120px, .7fr)", gap: 1.5 }}>
                    <CompactField label="NGÀNH" htmlFor="create-discipline">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-discipline" value={dialogDisciplineId} inputProps={{ "aria-label": "Ngành" }} onChange={(e) => handleDialogDisciplineChange(e.target.value)}>
                          <MenuItem value="">Tất cả ngành</MenuItem>
                          {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="CHUYÊN NGÀNH" htmlFor="create-major">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-major" value={form.majorId} inputProps={{ "aria-label": "Chuyên ngành" }} onChange={(e) => handleCreateMajorChange(e.target.value)}>
                          {dialogMajors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
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

                  <CompactField
                    label="CHƯƠNG TRÌNH ĐÀO TẠO ÁP DỤNG"
                    htmlFor="create-curriculum"
                    helper={!curriculumsLoading && curriculums.length === 0 ? "Chưa có CTĐT cho chuyên ngành và khóa này. Hãy lập CTĐT trước." : undefined}
                    error={!curriculumsLoading && curriculums.length === 0}
                  >
                    <FormControl fullWidth size="small" sx={compactControlSx} required>
                      <Select id="create-curriculum" value={form.curriculumId} inputProps={{ "aria-label": "Chương trình đào tạo" }} onChange={(e) => setForm((p) => ({ ...p, curriculumId: e.target.value }))} disabled={curriculumsLoading || curriculums.length === 0}>
                        {curriculums.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CompactField>

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

              {/* Automatic assignment was removed from group creation. Students are added manually
                  from the dedicated "Phân nhóm học viên" screen. */}
              {/*
              <Box sx={{ pt: 1.25, borderTop: "1px solid #d7e1e8" }}>
                <FormControlLabel
                  sx={{ m: 0, alignItems: "flex-start" }}
                  control={<Checkbox size="small" checked={autoAssignEnabled} onChange={(event) => setAutoAssignEnabled(event.target.checked)} sx={{ p: 0, mt: "1px", mr: "10px", color: "#7890a4", "& .MuiSvgIcon-root": { fontSize: 20 } }} />}
                  label={(
                    <Box>
                      <Typography sx={{ color: "#173d70", fontSize: "13px", fontWeight: 700, lineHeight: "18px" }}>
                        Phân học viên tự động vào các nhóm vừa tạo
                      </Typography>
                      <Typography sx={{ color: "#607486", fontSize: "11px", fontWeight: 500, lineHeight: "15px" }}>
                        Không chọn nếu chỉ muốn tạo nhóm trống.
                      </Typography>
                    </Box>
                  )}
                />

                {autoAssignEnabled && (
                  <Box sx={{ mt: 1.5, p: 1.5, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                    <Stack spacing="12px">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                        <Typography sx={compactSectionLabelSx}>
                          PHƯƠNG THỨC PHÂN BỔ ({eligibleLoading ? "Đang tải..." : `${unassignedStudents.length} học viên khả dụng`})
                        </Typography>
                        {eligibleLoading && <CircularProgress size={16} sx={{ color: "#087eae" }} />}
                      </Box>

                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={assignmentMethod}
                        onChange={(_, value) => value && handleMethodChange(value)}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                          gap: "6px",
                          "& .MuiToggleButtonGroup-grouped": {
                            border: "1px solid #c5d1db!important",
                            borderRadius: "6px!important",
                            backgroundColor: "#fff",
                            color: "#435b72",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            textTransform: "none",
                            lineHeight: "16px",
                            py: "6px",
                            "&.Mui-selected": {
                              backgroundColor: "#e8f4f9!important",
                              borderColor: "#087eae!important",
                              color: "#087eae",
                              fontWeight: 700,
                            },
                            "&.Mui-disabled": {
                              opacity: 0.6,
                              backgroundColor: "#f4f7f9",
                            },
                          },
                        }}
                      >
                        <ToggleButton value={AUTO_ASSIGN_METHODS.BALANCED}>Cân bằng sĩ số</ToggleButton>
                        <ToggleButton value={AUTO_ASSIGN_METHODS.LOCATION} disabled>Theo địa bàn</ToggleButton>
                        <ToggleButton value={AUTO_ASSIGN_METHODS.CUSTOM}>Tùy chỉnh số lượng</ToggleButton>
                      </ToggleButtonGroup>

                      {assignmentMethod === AUTO_ASSIGN_METHODS.CUSTOM && (
                        <Box sx={{ p: 1.25, border: "1px solid #d7e1e8", borderRadius: "6px", backgroundColor: "#fff" }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1 }}>
                            {automaticNames.map((name, index) => {
                              const inputId = `custom-count-${index}`;
                              const isAutoField = index === automaticNames.length - 1;
                              const autoValue = distribution.counts[index] ?? 0;
                              return (
                                <Box key={name} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: "6px 8px", border: "1px solid #e1e8ee", borderRadius: "6px", backgroundColor: isAutoField ? "#f7fbfd" : "#fff" }}>
                                  <Typography component="label" htmlFor={inputId} sx={{ color: "#223548", fontSize: "11.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                            <Chip key={name} label={`${name} • ${distribution.counts[index] ?? 0} HV`} size="small" variant="outlined" sx={compactChipSx} />
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
              */}

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
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || (editingId ? (!form.code?.trim() || !form.name?.trim() || !form.curriculumId) : (
              !form.majorId
              || !form.curriculumId
              || Number(form.count) < 1
              || Number(form.count) > 10
              || Boolean(nameTemplateError)
              || Boolean(dialogScopeError)
              || dialogScopeLoading
            ))}
            sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", backgroundColor: "#087eae", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { backgroundColor: "#066e99", boxShadow: "none" } }}
          >
            {saving ? "Đang lưu..." : editingId ? "Lưu nhóm" : `Tạo ${form.count || 0} nhóm`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deletingGroup)}
        onClose={() => setDeletingGroup(null)}
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
          <IconButton aria-label="Đóng" size="small" onClick={() => setDeletingGroup(null)} sx={{ width: 30, height: 30, color: "#526a7d", fontSize: 20 }}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, py: 2 }}>
          <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>
            Bạn có chắc muốn xóa nhóm <strong>{deletingGroup?.name}</strong> (Mã: <strong>{deletingGroup?.code}</strong>) không?
          </Typography>
          {deletingGroup?.memberCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5, borderRadius: "6px" }}>
              Nhóm này đang có <strong>{deletingGroup?.memberCount}</strong> học viên. Các học viên sẽ được đưa về trạng thái chưa phân nhóm.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1.25, minHeight: 60, borderTop: "1px solid #e1e8ee" }}>
          <Button onClick={() => setDeletingGroup(null)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "6px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "6px", boxShadow: "none", fontSize: "12.5px", fontWeight: 700 }}>
            {saving ? "Đang xóa..." : "Xóa"}
          </Button>
        </DialogActions>
      </Dialog>
    

  </FeatureLayout>
  );
};

export default CreateClassGroups;
