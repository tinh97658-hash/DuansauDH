import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, LinearProgress,
  MenuItem, Paper, Stack, TableBody, TableCell, TableContainer,
  TableRow, Tooltip, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import GroupWorkRounded from "@mui/icons-material/GroupWorkRounded";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import { usePermissions } from "../../features/accounts/usePermissions";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import ClassGroupCreateDialog, { initialClassGroupForm as initialForm } from "./ClassGroupCreateDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import ResizableTable from "../../components/ResizableTable";
import { disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline } from "../../utils/disciplineScope";

const CLASS_GROUP_COLUMNS = [
  { key: "index", label: "STT", width: 64, minWidth: 50, align: "center" },
  { key: "code", label: "Mã nhóm", width: 150, minWidth: 100 },
  { key: "major", label: "Ngành học", width: 220, minWidth: 150 },
  { key: "curriculum", label: "Chương trình đào tạo", width: 260, minWidth: 180 },
  { key: "year", label: "Năm học", width: 100, minWidth: 80, align: "center" },
  { key: "students", label: "Sĩ số", width: 160, minWidth: 120 },
  { key: "status", label: "Trạng thái", width: 120, minWidth: 100, align: "center" },
  { key: "actions", label: "Thao tác", width: 160, minWidth: 140, align: "center" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const CreateClassGroups = () => {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quickCreateOpened = useRef(false);
  // Filters
  const [majors, setMajors] = useState([]);
  const quickCreateScope = searchParams.get("quickCreate") === "1"
    && searchParams.get("program") === "masters"
    && /^\d{4}$/.test(searchParams.get("year") || "")
    && majors.some((major) => major.id === searchParams.get("majorId")
      && majorDisciplineId(major) === searchParams.get("disciplineId"));

  const [majorsLoading, setMajorsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMajor, setSelectedMajor] = useState("ALL");
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  // Data & loading
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = can("masters.manage");
  const [error, setError] = useState("");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDisciplineId, setDialogDisciplineId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm(String(currentYear)));
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);

  useEffect(() => {
    if (!quickCreateScope || quickCreateOpened.current) return;
    quickCreateOpened.current = true;
    const year = searchParams.get("year");
    const disciplineId = searchParams.get("disciplineId");
    const majorId = searchParams.get("majorId");
    setSelectedYear(year);
    setSelectedDiscipline(disciplineId);
    setSelectedMajor(majorId);
    setDialogDisciplineId(disciplineId);
    setForm({ ...initialForm(year), majorId });
    setDialogOpen(true);
  }, [quickCreateScope, searchParams]);

  // Load majors
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        setMajors(Array.isArray(data) ? data : data.data || []);
      })
      .catch(() => mounted && setMajors([]))
      .finally(() => mounted && setMajorsLoading(false));

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
  // Actions
  const openAdd = () => {
    const majorId = selectedMajor !== "ALL" ? selectedMajor : (majors[0]?.id || "");
    const major = majors.find((item) => item.id === majorId);
    setDialogDisciplineId(selectedDiscipline || majorDisciplineId(major));
    setEditingId(null);
    setForm({
      ...initialForm(selectedYear),
      majorId,
    });
    setDialogOpen(true);
  };

  const openEdit = (group) => {
    const groupMajor = majors.find((item) => item.id === group.majorId);
    setDialogDisciplineId(majorDisciplineId(groupMajor));
    setEditingId(group.id);
    setForm({
      code: group.code,
      count: 1,
      majorId: group.majorId || "",
      curriculumId: group.curriculumId || "",
      academicYear: group.academicYear || selectedYear,
      intakeRound: group.intakeRound || 1,
      maxStudents: group.maxStudents || 40,
      status: group.status || "open",
      note: group.note || "",
    });
    setDialogOpen(true);
  };

  const handleSaved = (createdGroups) => {
    if (quickCreateScope) {
      // Build a local return URL from validated scope, never navigate to arbitrary returnTo input.
      const params = new URLSearchParams({
        year: searchParams.get("year"),
        disciplineId: searchParams.get("disciplineId"),
        majorId: searchParams.get("majorId"),
      });
      const created = createdGroups.find((group) => group.id && group.status === "open"
        && group.majorId === params.get("majorId")
        && String(group.academicYear) === params.get("year"));
      if (created) params.set("groupId", created.id);
      navigate(`/masters/assign-class-groups?${params}`);
      return;
    }
    setDialogOpen(false);
    loadGroups();
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
            placeholder="Tìm theo mã nhóm, ngành học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: "2 1 360px", minWidth: 280 }}
          />

          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={openAdd}
              disabled={majorsLoading || loading}
              sx={{ height: 40, px: 2, bgcolor: "#0788B8", borderRadius: "4px", boxShadow: "none", textTransform: "none", fontWeight: 700, "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
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
          borderRadius: "6px",
          overflow: "auto",
          boxShadow: "0 2px 8px rgba(23, 62, 117, 0.04)",
        }}
      >
        <ResizableTable
          columns={CLASS_GROUP_COLUMNS}
          storageKey="create-class-groups-table-widths"
          aria-label="Danh sách nhóm học phần"
        >
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
        </ResizableTable>
      </TableContainer>

      {/* Add / Edit Dialog */}
      {dialogOpen && <ClassGroupCreateDialog
        majors={majors}
        initialValues={form}
        initialDisciplineId={dialogDisciplineId}
        editingId={editingId}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />}

      {/* Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deletingGroup)}
        onClose={() => setDeletingGroup(null)}
        onConfirm={handleDelete}
        title="XÁC NHẬN XÓA"
        severity="error"
        confirmText={saving ? "Đang xóa..." : "Xóa"}
        confirmDisabled={saving}
      >
        <Typography sx={{ fontSize: "13.5px", color: "#1c2936" }}>
          Bạn có chắc muốn xóa nhóm <strong>{deletingGroup?.name}</strong> (Mã: <strong>{deletingGroup?.code}</strong>) không?
        </Typography>
        {deletingGroup?.memberCount > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5, borderRadius: "4px" }}>
            Nhóm này đang có <strong>{deletingGroup?.memberCount}</strong> học viên. Các học viên sẽ được đưa về trạng thái chưa phân nhóm.
          </Alert>
        )}
      </ConfirmDialog>
    

  </FeatureLayout>
  );
};

export default CreateClassGroups;
