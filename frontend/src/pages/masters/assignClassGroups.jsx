import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  Grid, IconButton, InputAdornment, InputLabel, LinearProgress, MenuItem, Paper,
  Radio, RadioGroup, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded, AutoAwesomeRounded,
  DeleteOutlineRounded, GroupWorkRounded, PersonRounded,
  RefreshRounded, SearchRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));

const normalizeClassGroupMember = (member, group) => {
  const admissionRecord = member?.admissionRecord || null;
  const student = member?.student || null;

  return {
    id: admissionRecord?.id || student?.id || `member:${member.id}`,
    memberId: member.id,
    code: admissionRecord?.code || student?.regNo || "",
    fullName: admissionRecord?.fullName || student?.fullName || "Chưa có thông tin",
    dob: admissionRecord?.dob || "",
    gender: admissionRecord?.gender || "",
    email: admissionRecord?.email || student?.email || "",
    phone: admissionRecord?.phone || student?.telNo || "",
    majorId: admissionRecord?.majorId || group.majorId || null,
    majorName: admissionRecord?.majorName || admissionRecord?.major?.name || group.major?.name || "",
    academicYear: admissionRecord?.academicYear || group.academicYear || "",
    assignedGroup: { id: group.id, code: group.code, name: group.name },
  };
};

const AssignClassGroups = () => {
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get("groupId") || "";
  const initialMajorId = searchParams.get("majorId") || "ALL";
  const initialYear = searchParams.get("year") || String(currentYear);

  // Filters
  const [majors, setMajors] = useState([]);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMajor, setSelectedMajor] = useState(initialMajorId);
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL, UNASSIGNED, ASSIGNED
  const [studentSearch, setStudentSearch] = useState("");

  // Data
  const [groups, setGroups] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState(initialGroupId);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto assign dialog
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoTargetGroupIds, setAutoTargetGroupIds] = useState([]);
  const [autoMethod, setAutoMethod] = useState("alphabetical");

  // Load majors
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true })
      .then(({ data }) => {
        if (!mounted) return;
        setMajors(Array.isArray(data) ? data : data.data || []);
      })
      .catch(() => mounted && setMajors([]));
    return () => { mounted = false; };
  }, []);

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("academicYear", selectedYear);
      if (selectedMajor !== "ALL") params.append("majorId", selectedMajor);
      params.append("status", "open");

      const { data } = await axios.get(`${API_BASE_URL}/masters/class-groups?${params.toString()}`, {
        withCredentials: true,
      });
      const list = Array.isArray(data) ? data : data.data || [];
      setGroups(list);

      // Auto pick first group if none selected or current not in list
      if (list.length > 0) {
        if (!targetGroupId || !list.some((g) => g.id === targetGroupId)) {
          setTargetGroupId(list[0].id);
        }
      } else {
        setTargetGroupId("");
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedYear, selectedMajor, targetGroupId]);

  // Load students
  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("academicYear", selectedYear);
      if (selectedMajor !== "ALL") params.append("majorId", selectedMajor);

      const { data } = await axios.get(`${API_BASE_URL}/masters/class-groups/eligible-students?${params.toString()}`, {
        withCredentials: true,
      });
      setStudents(Array.isArray(data) ? data : data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách học viên.");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMajor]);

  const refreshAll = useCallback(() => {
    loadGroups();
    loadStudents();
    setSelectedStudentIds([]);
  }, [loadGroups, loadStudents]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Selected target group object
  const currentTargetGroup = useMemo(() => {
    return groups.find((g) => g.id === targetGroupId) || null;
  }, [groups, targetGroupId]);

  // Thành viên đã thuộc lớp phải lấy trực tiếp từ lớp. Danh sách hồ sơ đủ điều kiện
  // có thể rỗng khi dữ liệu cũ dùng năm tuyển sinh khác với năm của lớp.
  const classGroupMembers = useMemo(() => groups.flatMap((group) => (
    (Array.isArray(group.members) ? group.members : []).map((member) => (
      normalizeClassGroupMember(member, group)
    ))
  )), [groups]);

  const groupMembers = useMemo(() => {
    if (!targetGroupId) return [];
    return classGroupMembers.filter((student) => student.assignedGroup.id === targetGroupId);
  }, [classGroupMembers, targetGroupId]);

  // Giữ học viên chưa phân lớp từ API hiện tại và bổ sung thành viên của các lớp
  // đang hiển thị, tránh mất thông tin chỉ vì năm trên hồ sơ lịch sử không trùng khớp.
  const visibleStudents = useMemo(() => {
    const rows = new Map(students.map((student) => [student.id, student]));
    classGroupMembers.forEach((student) => rows.set(student.id, student));
    return [...rows.values()];
  }, [classGroupMembers, students]);

  // Filtered left student list
  const filteredStudents = useMemo(() => {
    const kw = studentSearch.trim().toLowerCase();
    return visibleStudents.filter((s) => {
      if (currentTargetGroup?.majorId && s.majorId !== currentTargetGroup.majorId) return false;
      // Filter status
      if (filterStatus === "UNASSIGNED" && s.assignedGroup) return false;
      if (filterStatus === "ASSIGNED" && !s.assignedGroup) return false;
      // Search
      if (kw) {
        const matches = (s.fullName || "").toLowerCase().includes(kw) ||
          (s.code || "").toLowerCase().includes(kw) ||
          (s.phone || "").toLowerCase().includes(kw) ||
          (s.majorName || "").toLowerCase().includes(kw);
        if (!matches) return false;
      }
      return true;
    });
  }, [visibleStudents, filterStatus, studentSearch, currentTargetGroup]);

  const assignableStudents = useMemo(
    () => filteredStudents.filter((student) => !student.assignedGroup),
    [filteredStudents],
  );

  useEffect(() => {
    const assignableIds = new Set(assignableStudents.map((student) => student.id));
    setSelectedStudentIds((previous) => previous.filter((id) => assignableIds.has(id)));
  }, [assignableStudents]);

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudentIds(assignableStudents.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleSelectStudent = (id) => {
    const student = visibleStudents.find((item) => item.id === id);
    if (!student || student.assignedGroup) return;
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Assign selected to target group
  const handleAssignSelected = async () => {
    if (!targetGroupId) return toast.error("Vui lòng chọn nhóm học phần mục tiêu.");
    if (selectedStudentIds.length === 0) return toast.error("Vui lòng chọn ít nhất một học viên.");

    setActionLoading(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/masters/class-groups/${targetGroupId}/members`,
        { admissionRecordIds: selectedStudentIds },
        { withCredentials: true }
      );
      toast.success(data.message || "Phân nhóm học viên thành công.");
      setSelectedStudentIds([]);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể phân nhóm học viên.");
    } finally {
      setActionLoading(false);
    }
  };

  // Remove single member from group
  const handleRemoveMember = async (memberId, studentName) => {
    if (!targetGroupId || !memberId) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/masters/class-groups/${targetGroupId}/members/${memberId}`, {
        withCredentials: true,
      });
      toast.success(`Đã xóa học viên ${studentName} khỏi nhóm.`);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa học viên khỏi nhóm.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Auto Assign Dialog
  const openAutoAssignModal = () => {
    if (groups.length < 2) {
      return toast.warning("Cần có ít nhất 2 nhóm học phần đang mở để thực hiện chia đều tự động.");
    }
    setAutoTargetGroupIds(groups.map((g) => g.id));
    setAutoDialogOpen(true);
  };

  // Execute Auto Assign
  const handleExecuteAutoAssign = async () => {
    if (autoTargetGroupIds.length < 2) {
      return toast.error("Vui lòng chọn ít nhất 2 nhóm học phần để chia đều.");
    }

    // Determine students to distribute: either currently checked, or all unassigned in filtered view, or all in view
    let targetStudentIds = selectedStudentIds;
    if (targetStudentIds.length === 0) {
      targetStudentIds = assignableStudents.map((s) => s.id);
    }

    if (targetStudentIds.length === 0) {
      return toast.error("Không có học viên nào để chia đều.");
    }

    setActionLoading(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/masters/class-groups/auto-assign`,
        {
          classGroupIds: autoTargetGroupIds,
          admissionRecordIds: targetStudentIds,
          method: autoMethod,
        },
        { withCredentials: true }
      );
      toast.success(data.message || "Đã phân chia tự động thành công.");
      setAutoDialogOpen(false);
      setSelectedStudentIds([]);
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể thực hiện chia đều tự động.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <FeatureLayout
      title="Phân nhóm học phần Thạc sĩ"
      group="Thủ tục đầu vào"
      desc="Phân bổ và sắp xếp học viên Thạc sĩ vào các nhóm học phần theo chuyên ngành, hỗ trợ phân thủ công và chia đều tự động."
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />

      {/* Top Filter Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: "#fbfcfd" }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="year-select-label">Năm tuyển sinh</InputLabel>
            <Select
              labelId="year-select-label"
              label="Năm tuyển sinh"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="major-select-label">Ngành học</InputLabel>
            <Select
              labelId="major-select-label"
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

          <Button
            variant="outlined"
            startIcon={<RefreshRounded />}
            onClick={refreshAll}
            sx={{ height: 36 }}
          >
            Làm mới
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="outlined"
            startIcon={<AutoAwesomeRounded />}
            onClick={openAutoAssignModal}
            sx={{
              height: 36,
              borderColor: "#168b7c",
              color: "#168b7c",
              "&:hover": { borderColor: "#0e6056", bgcolor: "#f0f8f7" },
            }}
          >
            Chia đều tự động
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Dual Panel Layout */}
      <Grid container spacing={2.5}>
        {/* Left Panel: Student Candidate List */}
        <Grid item xs={12} md={6.5}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <PersonRounded sx={{ color: "#0788B8" }} />
                Danh sách học viên
                <Chip size="small" label={`${visibleStudents.length} HV`} color="primary" variant="outlined" sx={{ ml: 0.5, fontWeight: 700 }} />
              </Typography>

              {/* Status Filter Chips */}
              <Stack direction="row" spacing={0.5}>
                <Chip
                  size="small"
                  label="Tất cả"
                  clickable
                  color={filterStatus === "ALL" ? "primary" : "default"}
                  onClick={() => setFilterStatus("ALL")}
                />
                <Chip
                  size="small"
                  label="Chưa phân nhóm"
                  clickable
                  color={filterStatus === "UNASSIGNED" ? "warning" : "default"}
                  onClick={() => setFilterStatus("UNASSIGNED")}
                />
                <Chip
                  size="small"
                  label="Đã phân nhóm"
                  clickable
                  color={filterStatus === "ASSIGNED" ? "success" : "default"}
                  onClick={() => setFilterStatus("ASSIGNED")}
                />
              </Stack>
            </Box>

            {/* Left Search Bar */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center">
              <TextField
                size="small"
                fullWidth
                placeholder="Tìm học viên theo mã, họ tên, số điện thoại..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" sx={{ color: "#8A94A3" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            {/* Selection Status & Action Bar */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Đã chọn: <strong>{selectedStudentIds.length}</strong> / {assignableStudents.length} học viên chưa có lớp
              </Typography>

              <Button
                variant="contained"
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={handleAssignSelected}
                disabled={selectedStudentIds.length === 0 || !targetGroupId || actionLoading}
                sx={{ bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}
              >
                {actionLoading ? "Đang chuyển..." : "Gán vào nhóm"}
              </Button>
            </Box>

            {/* Student Table */}
            <TableContainer sx={{ flexGrow: 1, maxHeight: 520, border: "1px solid #e2e8f0", borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        indeterminate={selectedStudentIds.length > 0 && selectedStudentIds.length < assignableStudents.length}
                        checked={assignableStudents.length > 0 && selectedStudentIds.length === assignableStudents.length}
                        onChange={handleToggleSelectAll}
                        disabled={assignableStudents.length === 0}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mã HV / SBD</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Họ và tên</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ngành</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nhóm hiện tại</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        Không có học viên nào phù hợp với bộ lọc.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      const isAssigned = Boolean(s.assignedGroup);
                      return (
                        <TableRow
                          key={s.id}
                          hover
                          selected={isSelected}
                          onClick={() => handleToggleSelectStudent(s.id)}
                          sx={{ cursor: isAssigned ? "not-allowed" : "pointer", opacity: isAssigned ? 0.72 : 1 }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(s.id)}
                              disabled={isAssigned}
                              inputProps={{ "aria-label": isAssigned ? `${s.fullName} đã được phân lớp` : `Chọn ${s.fullName}` }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                              {s.code || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.fullName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {s.dob || ""} {s.gender ? `• ${s.gender}` : ""}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                            {s.majorName || "-"}
                          </TableCell>
                          <TableCell>
                            {s.assignedGroup ? (
                              <Chip
                                size="small"
                                label={s.assignedGroup.name || s.assignedGroup.code}
                                color={s.assignedGroup.id === targetGroupId ? "success" : "default"}
                                variant={s.assignedGroup.id === targetGroupId ? "filled" : "outlined"}
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              <Chip size="small" label="Chưa phân nhóm" color="warning" variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Right Panel: Target Class Group & Members */}
        <Grid item xs={12} md={5.5}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <GroupWorkRounded sx={{ color: "#168b7c" }} />
                Nhóm học phần mục tiêu
              </Typography>
            </Box>

            {/* Target Group Selector */}
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="target-group-label">Chọn nhóm học phần</InputLabel>
              <Select
                labelId="target-group-label"
                label="Chọn nhóm học phần"
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
              >
                {groups.length === 0 ? (
                  <MenuItem value="" disabled><em>(Chưa có nhóm học phần nào đang mở)</em></MenuItem>
                ) : (
                  groups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {g.code} — {g.name} ({g.memberCount || 0}/{g.maxStudents || 40} HV)
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Target Group Info & Progress */}
            {currentTargetGroup ? (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: "#f8fafc", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#168b7c" }}>
                    {currentTargetGroup.name} ({currentTargetGroup.code})
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Sĩ số: {groupMembers.length} / {currentTargetGroup.maxStudents || 40} học viên
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.round((groupMembers.length / (currentTargetGroup.maxStudents || 40)) * 100))}
                  color={groupMembers.length >= (currentTargetGroup.maxStudents || 40) ? "error" : "primary"}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                Vui lòng chọn hoặc tạo một nhóm học phần ở trang "Tạo nhóm học phần" để bắt đầu phân học viên.
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Danh sách học viên trong nhóm ({groupMembers.length}):
            </Typography>

            {/* Target Group Members Table */}
            <TableContainer sx={{ flexGrow: 1, maxHeight: 460, border: "1px solid #e2e8f0", borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ width: 40, fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mã HV</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Họ và tên</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ngày sinh</TableCell>
                    <TableCell align="right" sx={{ width: 60, fontWeight: 700 }}>Bỏ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        Nhóm này hiện chưa có học viên nào. Chọn học viên từ cột bên trái và bấm "Gán vào nhóm".
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupMembers.map((m, idx) => (
                      <TableRow key={m.id} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{m.code || "-"}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{m.fullName}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{m.dob || "-"}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Bỏ khỏi nhóm">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveMember(m.memberId, m.fullName)}
                              disabled={actionLoading}
                            >
                              <DeleteOutlineRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Auto Assign Dialog */}
      <Dialog open={autoDialogOpen} onClose={() => setAutoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeRounded sx={{ color: "#168b7c" }} />
          Chia đều học viên vào các nhóm học phần
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Hệ thống sẽ tự động phân bổ đều số lượng học viên được chọn vào các nhóm học phần đã tick dưới đây.
          </Typography>

          <Box sx={{ mb: 2, p: 1.5, bgcolor: "#f8fafc", borderRadius: 1 }}>
            <Typography variant="body2">
              Số lượng học viên sẽ chia: <strong>{selectedStudentIds.length > 0 ? selectedStudentIds.length : assignableStudents.length}</strong> học viên
              {selectedStudentIds.length > 0 ? " (đang chọn từ bảng)" : " (toàn bộ học viên chưa có lớp đang hiển thị)"}
            </Typography>
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Chọn các nhóm nhận học viên:
          </Typography>

          <Stack spacing={0.5} sx={{ maxHeight: 200, overflowY: "auto", mb: 2, p: 1, border: "1px solid #e2e8f0", borderRadius: 1 }}>
            {groups.map((g) => {
              const checked = autoTargetGroupIds.includes(g.id);
              return (
                <FormControlLabel
                  key={g.id}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAutoTargetGroupIds((p) => [...p, g.id]);
                        } else {
                          setAutoTargetGroupIds((p) => p.filter((id) => id !== g.id));
                        }
                      }}
                      color="primary"
                    />
                  }
                  label={`${g.code} — ${g.name} (hiện có ${g.memberCount || 0}/${g.maxStudents || 40} HV)`}
                />
              );
            })}
          </Stack>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Phương thức chia:
          </Typography>
          <RadioGroup
            value={autoMethod}
            onChange={(e) => setAutoMethod(e.target.value)}
          >
            <FormControlLabel
              value="alphabetical"
              control={<Radio color="primary" />}
              label="Chia theo thứ tự vần tên A-Z (học viên được xếp theo bảng chữ cái trước khi chia đều)"
            />
            <FormControlLabel
              value="round_robin"
              control={<Radio color="primary" />}
              label="Chia lần lượt theo danh sách hiện tại (Round-Robin)"
            />
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAutoDialogOpen(false)} color="inherit">Hủy</Button>
          <Button
            variant="contained"
            onClick={handleExecuteAutoAssign}
            disabled={actionLoading || autoTargetGroupIds.length < 2}
            sx={{ bgcolor: "#168b7c", "&:hover": { bgcolor: "#0e6056" } }}
          >
            {actionLoading ? "Đang chia đều..." : "Thực hiện chia đều"}
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default AssignClassGroups;
