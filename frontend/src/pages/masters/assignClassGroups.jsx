import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress,
  FormControl,
  Grid, IconButton, InputAdornment, InputLabel, LinearProgress, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded,
  DeleteOutlineRounded, GroupWorkRounded, PersonRounded,
  SearchRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import { disciplineOptionLabel, disciplinesFromMajors, majorsForDiscipline } from "../../utils/disciplineScope";

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
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Data
  const [groups, setGroups] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState(initialGroupId);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

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
  const disciplines = useMemo(() => disciplinesFromMajors(majors), [majors]);
  const visibleMajors = useMemo(() => majorsForDiscipline(majors, selectedDiscipline), [majors, selectedDiscipline]);
  const visibleMajorIds = useMemo(() => new Set(visibleMajors.map((major) => major.id)), [visibleMajors]);

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
      const allRows = Array.isArray(data) ? data : data.data || [];
      const list = selectedDiscipline && selectedMajor === "ALL"
        ? allRows.filter((group) => visibleMajorIds.has(group.majorId || group.major?.id))
        : allRows;
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
  }, [selectedYear, selectedDiscipline, selectedMajor, targetGroupId, visibleMajorIds]);

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
      const allRows = Array.isArray(data) ? data : data.data || [];
      setStudents(selectedDiscipline && selectedMajor === "ALL"
        ? allRows.filter((student) => visibleMajorIds.has(student.majorId || student.major?.id))
        : allRows);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách học viên.");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedDiscipline, selectedMajor, visibleMajorIds]);

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
  const maximumStudents = Number(currentTargetGroup?.maxStudents || 40);
  const currentMemberCount = Math.max(groupMembers.length, Number(currentTargetGroup?.memberCount || 0));
  const remainingCapacity = currentTargetGroup
    ? Math.max(0, maximumStudents - currentMemberCount)
    : 0;

  const unassignedStudents = useMemo(
    () => students.filter((student) => !student.assignedGroup),
    [students],
  );

  // Filtered left student list
  const filteredStudents = useMemo(() => {
    const kw = studentSearch.trim().toLowerCase();
    return unassignedStudents.filter((s) => {
      if (currentTargetGroup?.majorId && s.majorId !== currentTargetGroup.majorId) return false;
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
  }, [unassignedStudents, studentSearch, currentTargetGroup]);

  const assignableStudents = filteredStudents;

  useEffect(() => {
    const assignableIds = new Set(assignableStudents.map((student) => student.id));
    setSelectedStudentIds((previous) => previous
      .filter((id) => assignableIds.has(id))
      .slice(0, remainingCapacity));
  }, [assignableStudents, remainingCapacity]);

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudentIds(assignableStudents.slice(0, remainingCapacity).map((s) => s.id));
      if (assignableStudents.length > remainingCapacity) {
        toast.warning(`Nhóm chỉ còn ${remainingCapacity} chỗ trống.`);
      }
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleSelectStudent = (id) => {
    const student = unassignedStudents.find((item) => item.id === id);
    if (!student) return;
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds((previous) => previous.filter((item) => item !== id));
      return;
    }
    if (selectedStudentIds.length >= remainingCapacity) {
      toast.warning(remainingCapacity > 0
        ? `Chỉ được chọn tối đa ${remainingCapacity} học viên cho số chỗ còn lại của nhóm.`
        : "Nhóm đã đủ sĩ số.");
      return;
    }
    setSelectedStudentIds((previous) => [...previous, id]);
  };

  // Assign selected to target group
  const handleAssignSelected = async () => {
    if (!targetGroupId) return toast.error("Vui lòng chọn nhóm học phần mục tiêu.");
    if (selectedStudentIds.length === 0) return toast.error("Vui lòng chọn ít nhất một học viên.");
    if (selectedStudentIds.length > remainingCapacity) {
      return toast.error(`Nhóm chỉ còn ${remainingCapacity} chỗ trống.`);
    }

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

  return (
    <FeatureLayout
      title="Phân nhóm học viên Thạc sĩ"
      group="Thủ tục đầu vào"
      desc="Phân bổ và sắp xếp học viên Thạc sĩ vào các nhóm học phần theo chuyên ngành."
      maxWidth={1880}
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />

      {/* Top Filter Bar */}
      <Paper variant="outlined" sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: "#FBFDFF",
        borderColor: "#D8E5EF",
        borderRadius: "12px",
        boxShadow: "0 4px 14px rgba(23, 62, 117, 0.05)",
        "& .MuiInputLabel-root": { color: "#52677A" },
        "& .MuiOutlinedInput-root": {
          height: 40,
          bgcolor: "#F7FAFD",
          borderRadius: "8px",
          "& fieldset": { borderColor: "#D5E2EC" },
        },
      }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 135 }}>
            <InputLabel id="year-select-label" shrink>Năm tuyển sinh</InputLabel>
            <Select
              labelId="year-select-label"
              label="Năm tuyển sinh"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              displayEmpty
            >
              {YEARS.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="discipline-select-label" shrink>Ngành</InputLabel>
            <Select labelId="discipline-select-label" label="Ngành" value={selectedDiscipline} displayEmpty onChange={(e) => { setSelectedDiscipline(e.target.value); setSelectedMajor("ALL"); }}>
              <MenuItem value="">Tất cả ngành</MenuItem>
              {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="major-select-label" shrink>Chuyên ngành</InputLabel>
            <Select
              labelId="major-select-label"
              label="Chuyên ngành"
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
              displayEmpty
            >
              <MenuItem value="ALL">Tất cả chuyên ngành</MenuItem>
              {visibleMajors.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name} ({m.code})</MenuItem>
              ))}
            </Select>
          </FormControl>

        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Dual Panel Layout */}
      <Grid container spacing={1.5} alignItems="stretch">
        {/* Left Panel: Student Candidate List */}
        <Grid item xs={12} md={6.5}>
          <Paper variant="outlined" sx={{
            p: 1.5,
            minHeight: 650,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderColor: "#D8E5EF",
            borderRadius: "12px",
            bgcolor: "#FFFFFF",
            boxShadow: "0 5px 18px rgba(23, 62, 117, 0.05)",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, color: "#111827" }}>
                <PersonRounded sx={{ color: "#1685B5", fontSize: 19 }} />
                Danh sách học viên
                <Chip size="small" label={`${unassignedStudents.length} HV`} sx={{ ml: 0.25, height: 22, bgcolor: "#EAF6FC", color: "#0788B8", fontWeight: 700 }} />
              </Typography>

              <Chip size="small" label="Chưa phân nhóm" sx={{ height: 22, bgcolor: "#FFF3E2", color: "#C56A00", fontWeight: 700 }} />
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
                      <SearchRounded fontSize="small" sx={{ color: "#8A9AAA" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": { height: 40, bgcolor: "#F7FAFD", borderRadius: "8px" },
                  "& fieldset": { borderColor: "#D8E5EF" },
                }}
              />
            </Stack>

            {/* Selection Status & Action Bar */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Đã chọn: <strong>{selectedStudentIds.length}</strong> / {remainingCapacity} chỗ còn lại
                {` · ${assignableStudents.length} học viên chưa có lớp`}
              </Typography>

              <Button
                variant="contained"
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={handleAssignSelected}
                disabled={selectedStudentIds.length === 0 || !targetGroupId || actionLoading}
                sx={{ borderRadius: "8px", boxShadow: "none", bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
              >
                {actionLoading ? "Đang chuyển..." : "Gán vào nhóm"}
              </Button>
            </Box>

            {/* Student Table */}
            <TableContainer sx={{ flexGrow: 1, maxHeight: 520, border: "1px solid #D8E5EF", borderRadius: "10px", overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#EDF4FA", color: "#111827", borderColor: "#D8E5EF", fontWeight: 700 } }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        indeterminate={selectedStudentIds.length > 0 && selectedStudentIds.length < Math.min(assignableStudents.length, remainingCapacity)}
                        checked={Math.min(assignableStudents.length, remainingCapacity) > 0 && selectedStudentIds.length === Math.min(assignableStudents.length, remainingCapacity)}
                        onChange={handleToggleSelectAll}
                        disabled={assignableStudents.length === 0 || remainingCapacity === 0}
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
                        {studentSearch.trim()
                          ? "Không tìm thấy học viên chưa được phân nhóm."
                          : "Không còn học viên chưa được phân nhóm."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      const selectionLimitReached = !isSelected && selectedStudentIds.length >= remainingCapacity;
                      return (
                        <TableRow
                          key={s.id}
                          hover
                          selected={isSelected}
                          onClick={() => handleToggleSelectStudent(s.id)}
                          sx={{
                            cursor: selectionLimitReached ? "not-allowed" : "pointer",
                            opacity: selectionLimitReached ? 0.72 : 1,
                            "&:hover": { bgcolor: "#F5FAFE!important" },
                            "& td": { borderColor: "#E2EBF2", color: "#111827" },
                          }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(s.id)}
                              disabled={selectionLimitReached}
                              inputProps={{ "aria-label": `Chọn ${s.fullName}` }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: "inherit", fontWeight: 600 }}>
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
                            <Chip size="small" label="Chưa phân nhóm" color="warning" variant="outlined" />
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
          <Paper variant="outlined" sx={{
            p: 1.5,
            minHeight: 650,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderColor: "#D8E5EF",
            borderRadius: "12px",
            bgcolor: "#FFFFFF",
            boxShadow: "0 5px 18px rgba(23, 62, 117, 0.05)",
          }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75, color: "#111827" }}>
                <GroupWorkRounded sx={{ color: "#168B7C", fontSize: 19 }} />
                Nhóm học phần mục tiêu
              </Typography>
            </Box>

            {/* Target Group Selector */}
            <FormControl fullWidth size="small" sx={{
              mb: 1.5,
              "& .MuiOutlinedInput-root": { height: 40, bgcolor: "#F7FAFD", borderRadius: "8px" },
              "& fieldset": { borderColor: "#D8E5EF" },
            }}>
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
              <Box sx={{ mb: 2, p: 1.25, bgcolor: "#EAF7FB", borderRadius: "9px", border: "1px solid #D4EAF2" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#087F8C" }}>
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
                  sx={{ height: 7, borderRadius: 4, bgcolor: "#CBE7F0" }}
                />
              </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                Vui lòng chọn hoặc tạo một nhóm học viên ở trang "Tạo nhóm học viên" để bắt đầu phân học viên.
              </Alert>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827" }}>
                Danh sách học viên trong nhóm ({groupMembers.length}):
              </Typography>
              <Chip size="small" label={`${groupMembers.length} học viên`} sx={{ height: 22, bgcolor: "#F0F4F8", color: "#52677A", fontWeight: 600 }} />
            </Box>

            {/* Target Group Members Table */}
            <TableContainer sx={{ flexGrow: 1, maxHeight: 460, border: "1px solid #D8E5EF", borderRadius: "10px", overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#EDF4FA", color: "#111827", borderColor: "#D8E5EF", fontWeight: 700 } }}>
                    <TableCell align="center" sx={{ width: 48, fontWeight: 700 }}>STT</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mã HV</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Họ và tên</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ngày sinh</TableCell>
                    <TableCell align="center" sx={{ width: 70, fontWeight: 700 }}>Bỏ</TableCell>
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
                      <TableRow key={m.id} hover sx={{ "&:hover": { bgcolor: "#F5FAFE!important" }, "& td": { borderColor: "#E2EBF2", color: "#111827" } }}>
                        <TableCell align="center">{idx + 1}</TableCell>
                        <TableCell sx={{ fontFamily: "inherit", fontWeight: 600 }}>{m.code || "-"}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{m.fullName}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{m.dob || "-"}</TableCell>
                        <TableCell align="center">
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
    </FeatureLayout>
  );
};

export default AssignClassGroups;
