import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress,
  FormControl,
  IconButton, LinearProgress, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import GroupWorkRounded from "@mui/icons-material/GroupWorkRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import ConfirmDialog from "../../components/ConfirmDialog";
import ClassGroupCreateDialog from "./ClassGroupCreateDialog";
import ResizableSplit from "../../components/ResizableSplit";
import ResizableTable from "../../components/ResizableTable";
import { disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline } from "../../utils/disciplineScope";
import { personNameParts } from "../../utils/personName";
import "./assignClassGroups.css";
import { groupingMajorLabels } from "./groupingMajorLabels";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const groupHasSpace = (group) => Math.max((group.members || []).length, Number(group.memberCount || 0)) < Number(group.maxStudents ?? 40);
// Match the existing API's code ASC order, with an ID tie-breaker for duplicate codes.
const compareGroupValue = (a, b) => a < b ? -1 : a > b ? 1 : 0;

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
    tuitionPaid: admissionRecord ? admissionRecord.extraData?.tuitionPayment?.paid === true : null,
    assignedGroup: { id: group.id, code: group.code, name: group.name },
  };
};

const TuitionStatus = ({ paid }) => (
  <Chip size="small" className="assignment-status"
    label={paid === true ? "Đã nộp" : paid === false ? "Chưa nộp" : "Chưa có dữ liệu"}
    color={paid === true ? "success" : paid === false ? "warning" : "default"}
    variant="outlined" />
);

const AssignClassGroups = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createScope, setCreateScope] = useState(null);
  const [createFeedback, setCreateFeedback] = useState("");
  const [pendingCreatedReload, setPendingCreatedReload] = useState(null);
  const [postCreateLoading, setPostCreateLoading] = useState(false);
  const [suppressAutoTarget, setSuppressAutoTarget] = useState(false);
  const createSession = useRef(null);
  useEffect(() => () => { createSession.current = null; }, []);
  const [majors, setMajors] = useState([]);
  const [majorsLoading, setMajorsLoading] = useState(true);
  const [majorsError, setMajorsError] = useState("");
  const disciplines = useMemo(() => disciplinesFromMajors(majors), [majors]);
  const rawYear = searchParams.get("year");
  const selectedYear = /^\d{4}$/.test(rawYear || "") ? rawYear : String(currentYear);
  const requestedMajor = majors.find((m) => m.id === searchParams.get("majorId"));
  // Existing links from the class list provide majorId + groupId, without disciplineId.
  const rawDiscipline = searchParams.get("disciplineId")
    || (searchParams.has("groupId") ? majorDisciplineId(requestedMajor) : "");
  const selectedDiscipline = disciplines.some((d) => d.id === rawDiscipline) ? rawDiscipline : "";
  const visibleMajors = useMemo(() => majorsForDiscipline(majors, selectedDiscipline), [majors, selectedDiscipline]);
  const majorLabels = useMemo(() => groupingMajorLabels(visibleMajors), [visibleMajors]);
  const selectedMajor = selectedDiscipline && majorDisciplineId(requestedMajor) === selectedDiscipline
    ? requestedMajor.id : "ALL";
  const assignmentMode = !!selectedDiscipline && selectedMajor !== "ALL";
  const scopeKey = `${selectedYear}:${selectedDiscipline}:${selectedMajor}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const [dataScope, setDataScope] = useState("");
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const requestId = useRef(0);
  const actionInFlight = useRef(false);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true })
      .then(({ data }) => { if (mounted) setMajors(Array.isArray(data) ? data : data.data || []); })
      .catch(() => { if (mounted) setMajorsError("Không thể tải danh sách chuyên ngành. Vui lòng tải lại trang."); })
      .finally(() => { if (mounted) setMajorsLoading(false); });
    return () => { mounted = false; };
  }, []);

  // URL is the filter source of truth, including browser Back/Forward.
  useEffect(() => {
    if (majorsLoading || majorsError) return;
    const next = new URLSearchParams(searchParams);
    next.set("year", selectedYear);
    if (selectedDiscipline) next.set("disciplineId", selectedDiscipline);
    else next.delete("disciplineId");
    if (selectedMajor !== "ALL") next.set("majorId", selectedMajor);
    else { next.delete("majorId"); next.delete("groupId"); }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [searchParams, selectedYear, selectedDiscipline, selectedMajor, majorsLoading, majorsError, setSearchParams]);

  const navigateScope = (year, discipline, major = "ALL") => {
    const next = new URLSearchParams(searchParams);
    next.set("year", year);
    if (discipline) next.set("disciplineId", discipline); else next.delete("disciplineId");
    if (major !== "ALL") next.set("majorId", major); else next.delete("majorId");
    next.delete("groupId");
    setSearchParams(next);
  };

  const unassignedInScope = useCallback((rows) => rows.filter((student) =>
    (!student.academicYear || String(student.academicYear) === selectedYear)
    && visibleMajors.some((major) => major.id === student.majorId)
    && (selectedMajor === "ALL" || student.majorId === selectedMajor)
    && !student.assignedGroup
    && !["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học", "Đã thôi học"].includes(student.studyStatus)
    && (student.status === "approved" || ["Đã trúng tuyển", "Đang học"].includes(student.studyStatus))
  ), [selectedYear, selectedMajor, visibleMajors]);

  // Reload and reconcile independently from explicit selection clearing.
  const reloadData = useCallback(async () => {
    if (majorsLoading || majorsError) return;
    const request = ++requestId.current;
    const scope = scopeKey;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ academicYear: selectedYear });
    if (selectedMajor !== "ALL") params.set("majorId", selectedMajor);
    try {
      const [groupResponse, studentResponse] = await Promise.all([
        // All statuses are needed for summary counts, including closed classes.
        axios.get(`${API_BASE_URL}/masters/class-groups?${params}`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/masters/class-groups/eligible-students?${params}`, { withCredentials: true }),
      ]);
      if (request !== requestId.current || scope !== scopeRef.current) return;
      const rows = (data) => Array.isArray(data) ? data : data.data || [];
      setGroups(rows(groupResponse.data).filter((g) => String(g.academicYear) === selectedYear
        && (!g.program || g.program === "masters")
        && visibleMajors.some((m) => m.id === (g.majorId || g.major?.id))
        && (selectedMajor === "ALL" || (g.majorId || g.major?.id) === selectedMajor)));
      const candidates = unassignedInScope(rows(studentResponse.data));
      setStudents(candidates);
      const validIds = new Set(candidates.map((s) => s.id));
      setSelectedStudentIds((previous) => previous.filter((id) => validIds.has(id)));
      setDataScope(scope);
    } catch (err) {
      if (request === requestId.current && scope === scopeRef.current) {
        setError(err.response?.data?.message || "Không thể tải dữ liệu phân nhóm. Vui lòng thử lại.");
      }
    } finally {
      if (request === requestId.current && scope === scopeRef.current) setLoading(false);
    }
  }, [scopeKey, selectedYear, selectedMajor, visibleMajors, unassignedInScope, majorsLoading, majorsError]);

  useEffect(() => {
    setSelectedStudentIds([]);
    setStudentSearch("");
    setPendingRemoval(null);
    reloadData();
    setCreateScope(null);
    createSession.current = null;
    setCreateFeedback("");
    setSuppressAutoTarget(false);
    setPendingCreatedReload(null);
    setPostCreateLoading(false);
    return () => { requestId.current += 1; };
  }, [reloadData]);

  const dataReady = dataScope === scopeKey && !majorsLoading;
  const groupsLoading = loading || !dataReady;
  const targetGroups = useMemo(() => assignmentMode && dataReady
    ? groups.filter((g) => g.status === "open" && (g.majorId || g.major?.id) === selectedMajor)
      .sort((a, b) => compareGroupValue(a.code || "", b.code || "") || compareGroupValue(String(a.id), String(b.id))) : [],
  [assignmentMode, dataReady, groups, selectedMajor]);
  const targetGroupId = targetGroups.some((g) => g.id === searchParams.get("groupId")) ? searchParams.get("groupId") : "";
  const setTargetGroupId = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("groupId", id); else next.delete("groupId");
    setSearchParams(next);
  };
  useEffect(() => {
    if (assignmentMode && dataReady && !loading && !error && !targetGroupId && !postCreateLoading && !suppressAutoTarget) {
      const next = new URLSearchParams(searchParams);
      const available = targetGroups.find(groupHasSpace);
      if (available) next.set("groupId", available.id);
      else next.delete("groupId");
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }
  }, [assignmentMode, dataReady, loading, error, searchParams, targetGroupId, targetGroups, setSearchParams, postCreateLoading, suppressAutoTarget]);

  const currentTargetGroup = targetGroups.find((g) => g.id === targetGroupId) || null;
  const groupMembers = useMemo(() => (currentTargetGroup?.members || []).map((m) => normalizeClassGroupMember(m, currentTargetGroup)), [currentTargetGroup]);
  const maximumStudents = Number(currentTargetGroup?.maxStudents ?? 40);
  const currentMemberCount = Math.max(groupMembers.length, Number(currentTargetGroup?.memberCount || 0));
  const remainingCapacity = currentTargetGroup ? Math.max(0, maximumStudents - currentMemberCount) : 0;
  const overCapacity = !!currentTargetGroup && selectedStudentIds.length > remainingCapacity;
  const unassignedStudents = dataReady ? students : [];
  const filteredStudents = unassignedStudents.filter((s) => {
    const kw = studentSearch.trim().toLowerCase();
    return !kw || [s.fullName, s.code, s.phone, s.majorName].some((value) => (value || "").toLowerCase().includes(kw));
  });
  const majorById = useMemo(() => new Map(majors.map((m) => [m.id, m])), [majors]);
  const visibleSelectedCount = filteredStudents.filter((s) => selectedStudentIds.includes(s.id)).length;
  const handleToggleSelectAll = (e) => {
    if (loading || groupsLoading || actionInFlight.current) return;
    const visibleIds = new Set(filteredStudents.map((s) => s.id));
    setSelectedStudentIds((previous) => e.target.checked
      ? [...new Set([...previous, ...visibleIds])]
      : previous.filter((id) => !visibleIds.has(id)));
  };
  const handleToggleSelectStudent = (id) => {
    if (loading || groupsLoading || actionInFlight.current || !unassignedStudents.some((s) => s.id === id)) return;
    setSelectedStudentIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  };

  const handleAssignSelected = async () => {
    if (actionInFlight.current || loading || groupsLoading || error || !currentTargetGroup || !selectedStudentIds.length || overCapacity) return;
    const scope = scopeKey;
    actionInFlight.current = true;
    setActionLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/masters/class-groups/${targetGroupId}/members`,
        { admissionRecordIds: selectedStudentIds }, { withCredentials: true });
      toast.success(data.message || "Đã phân học viên vào nhóm.");
      if (scope === scopeRef.current) { setSelectedStudentIds([]); await reloadData(); }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể phân học viên vào nhóm. Vui lòng kiểm tra lại dữ liệu.");
      // Capacity uses HTTP 400, closed targets 404, membership conflicts 409.
      if ([400, 404, 409].includes(err.response?.status) && scope === scopeRef.current) await reloadData();
    } finally {
      actionInFlight.current = false;
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (actionInFlight.current || !pendingRemoval || pendingRemoval.groupId !== targetGroupId) return;
    actionInFlight.current = true;
    setActionLoading(true);
    const scope = scopeKey;
    try {
      await axios.delete(`${API_BASE_URL}/masters/class-groups/${pendingRemoval.groupId}/members/${pendingRemoval.memberId}`, { withCredentials: true });
      toast.success(`Đã bỏ học viên ${pendingRemoval.fullName} khỏi nhóm.`);
      setPendingRemoval(null);
      if (scope === scopeRef.current) await reloadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể bỏ học viên khỏi nhóm.");
    } finally {
      actionInFlight.current = false;
      setActionLoading(false);
    }
  };

  // Summary is a queue of outstanding work, using the same eligible learners as assignment.
  const summary = useMemo(() => visibleMajors.map((major) => ({
    major, unassigned: students.filter((student) => student.majorId === major.id).length,
  })).filter((row) => row.unassigned > 0), [visibleMajors, students]);
  const summaryDisciplines = disciplines.filter((discipline) =>
    summary.some((row) => majorDisciplineId(row.major) === discipline.id));
  const totalUnassigned = summary.reduce((sum, row) => sum + row.unassigned, 0);
  const hasAvailableAlternative = targetGroups.some((group) => group.id !== targetGroupId && groupHasSpace(group));
  const allGroupsFull = targetGroups.length > 0 && !targetGroups.some(groupHasSpace);
  const targetIsFull = !!currentTargetGroup && remainingCapacity === 0;
  const quickCreate = () => {
    setCreateFeedback("");
    const scope = { key: scopeKey, year: selectedYear, disciplineId: selectedDiscipline, majorId: selectedMajor };
    createSession.current = scope;
    setCreateScope(scope);
  };
  const handleGroupsCreated = async (createdGroups, scope = createScope) => {
    if (!scope || scope !== createSession.current || scope.key !== scopeRef.current) return;
    setPostCreateLoading(true);
    try {
      // Refresh only targets: candidates, hidden selection, search and pane scroll stay mounted.
      const params = new URLSearchParams({ academicYear: scope.year, majorId: scope.majorId });
      const { data } = await axios.get(`${API_BASE_URL}/masters/class-groups?${params}`, { withCredentials: true });
      if (scope !== createSession.current || scope.key !== scopeRef.current) return;
      const rows = (Array.isArray(data) ? data : data.data || []).filter((group) =>
        String(group.academicYear) === scope.year
        && (!group.program || group.program === "masters")
        && (group.majorId || group.major?.id) === scope.majorId);
      // Server creation order is primary; never infer new IDs from list position/name.
      const created = createdGroups.filter((result) => result?.id).map((result) => rows.find((group) => group.id && group.id === result.id
        && (!result.program || result.program === "masters")
        && (!result.majorId || result.majorId === scope.majorId)
        && (!result.academicYear || String(result.academicYear) === scope.year)
        && (!result.status || result.status === "open")
        && group.status === "open" && groupHasSpace(group))).find(Boolean);
      setGroups(rows);
      setPendingCreatedReload(null);
      setSuppressAutoTarget(!created);
      // Router 6.3 accepts URLSearchParams here, not the functional updater API.
      const next = new URLSearchParams(searchParams);
      if (created) next.set("groupId", created.id);
      else if (!rows.some((group) => group.id === next.get("groupId") && group.status === "open")) next.delete("groupId");
      setSearchParams(next, { replace: true });
      setCreateFeedback(created ? "" : "Đã tạo nhóm, nhưng chưa có nhóm mới khả dụng để phân học viên. Hãy kiểm tra trạng thái, phạm vi và sĩ số hoặc chọn nhóm khác.");
    } catch {
      if (scope === createSession.current && scope.key === scopeRef.current) {
        setPendingCreatedReload({ scope, createdGroups });
        setCreateFeedback("Đã tạo nhóm nhưng chưa tải lại được danh sách nhóm. Vui lòng tải lại danh sách trước khi chọn nhóm mới.");
      }
    } finally {
      if (scope === createSession.current && scope.key === scopeRef.current) {
        setCreateScope(null);
        setPostCreateLoading(false);
      }
    }
  };

  const candidateColumns = [
    { key: "select", label: "Chọn học viên", width: 44, minWidth: 44, padding: "checkbox", header: <Checkbox
      size="small"
      indeterminate={visibleSelectedCount > 0 && visibleSelectedCount < filteredStudents.length}
      checked={filteredStudents.length > 0 && visibleSelectedCount === filteredStudents.length}
      onChange={handleToggleSelectAll}
      disabled={filteredStudents.length === 0 || loading || groupsLoading || actionLoading}
      inputProps={{ "aria-label": "Chọn tất cả học viên" }}
    /> },
    { key: "code", label: "Mã học viên", width: 115, minWidth: 110 },
    { key: "learner", label: "Họ tên", width: 210, minWidth: 190 },
    { key: "dob", label: "Ngày sinh", width: 110, minWidth: 100 },
    { key: "tuition", label: "Học phí nhập học", width: 145, minWidth: 130 },
    // Assignment fixes one major and unassignedInScope excludes every assigned learner.
    // The scope filters and pane title convey those invariants without repeating them in each row.
  ];

  return (
    <FeatureLayout
      title="Phân nhóm học viên Thạc sĩ"
      group="Thủ tục đầu vào"
      desc="Phân bổ và sắp xếp học viên Thạc sĩ vào nhóm theo chuyên ngành."
      maxWidth={1880}
    >
      <ToastContainer position="top-center" newestOnTop limit={3} />
      {createScope && createScope.key === scopeKey && <ClassGroupCreateDialog
        majors={majors}
        initialValues={{ academicYear: createScope.year, majorId: createScope.majorId }}
        initialDisciplineId={createScope.disciplineId}
        lockedScope
        isScopeCurrent={() => createScope === createSession.current && createScope.key === scopeRef.current}
        onClose={() => { createSession.current = null; setCreateScope(null); }}
        onSaved={handleGroupsCreated}
      />}
      <Box className="assignment-page">

      {/* Top Filter Bar */}
      <Paper variant="outlined" className="assignment-filters" sx={{
        p: 1.5,
        mb: 1.5,
        bgcolor: "#FFF",
        borderColor: "#C6D5E1",
        borderRadius: "6px",
        boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)",
      }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Năm tuyển sinh" sx={{ flex: "1 1 150px", minWidth: 150 }}
              value={selectedYear}
              disabled={actionLoading}
              onChange={(e) => navigateScope(e.target.value, selectedDiscipline, selectedMajor)}
            >
              {[...new Set([...YEARS, selectedYear])].sort().map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
          </FilterSelectField>

          <FilterSelectField label="Ngành" sx={{ flex: "1 1 260px", minWidth: 260 }} value={selectedDiscipline} disabled={majorsLoading || actionLoading} onChange={(e) => navigateScope(selectedYear, e.target.value)}>
              <MenuItem value="">Tất cả ngành</MenuItem>
              {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
          </FilterSelectField>

          <FilterSelectField label="Chuyên ngành" sx={{ flex: "1 1 280px", minWidth: 280 }}
              value={selectedMajor}
              disabled={majorsLoading || actionLoading}
              onChange={(e) => { const major = majorById.get(e.target.value); navigateScope(selectedYear, major ? majorDisciplineId(major) : selectedDiscipline, e.target.value); }}
            >
              <MenuItem value="ALL">Tất cả chuyên ngành</MenuItem>
              {visibleMajors.map((m) => (
                <MenuItem key={m.id} value={m.id}>{majorLabels.labels.get(m.id)}</MenuItem>
              ))}
          </FilterSelectField>

        </Stack>
      </Paper>

      {majorsError && <Alert severity="error" sx={{ mb: 1 }}>{majorsError}</Alert>}
      {majorLabels.unresolved && <Alert severity="warning" sx={{ mb: 1 }}>Danh mục có chuyên ngành trùng tên chưa có mã phân biệt. Vui lòng kiểm tra danh mục trước khi chọn.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" size="small" onClick={reloadData} disabled={loading}>Thử lại</Button>}>{error}</Alert>}
      {!assignmentMode && <Paper variant="outlined" className="assignment-summary">
        <Box className="assignment-summary-heading">
          <Box><Typography component="h2" variant="subtitle2">Học viên chờ phân nhóm</Typography>
            <Typography variant="caption" color="text.secondary">Chọn chuyên ngành để bắt đầu phân nhóm</Typography></Box>
          {dataReady && !loading && !error && <span className="assignment-summary-total">{totalUnassigned} học viên</span>}
        </Box>
        {!majorsError && (loading || majorsLoading || !dataReady && !error) ? <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} aria-label="Đang tải tổng quan" /></Box>
          : !error && !majorsError && (summary.length === 0 ? <Box className="assignment-summary-empty">
            <CheckCircleOutlineRounded aria-hidden="true" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Không còn học viên chờ phân nhóm</Typography>
            <Typography variant="caption" color="text.secondary">Tất cả học viên trong phạm vi hiện tại đã được phân nhóm.</Typography>
          </Box> : <Box component="ul" aria-label="Tổng quan phân nhóm" className="assignment-summary-list">
            {summaryDisciplines.map((discipline) => {
              const rows = summary.filter((row) => majorDisciplineId(row.major) === discipline.id);
              return <li key={discipline.id} className="assignment-discipline-card">
                <div className="assignment-summary-discipline">
                  <span>{discipline.name}</span>
                  {rows.length > 1 && <span className="assignment-discipline-total">{rows.reduce((sum, row) => sum + row.unassigned, 0)} HV</span>}
                </div>
                <ul className="assignment-summary-list">
                  {rows.map((row) => <li key={row.major.id}>
                    <button type="button" className="assignment-summary-major" aria-label={majorLabels.labels.get(row.major.id)}
                      onClick={() => navigateScope(selectedYear, discipline.id, row.major.id)}>
                      <span className="assignment-summary-name">{majorLabels.labels.get(row.major.id)}</span>
                      <span className="assignment-summary-action"><span className="assignment-summary-count">{row.unassigned} HV</span>
                        <ArrowForwardRounded fontSize="small" aria-hidden="true" /></span>
                    </button>
                  </li>)}
                </ul>
              </li>;
            })}
          </Box>)}
      </Paper>}

      {/* Dual Panel Layout */}
      {assignmentMode && <ResizableSplit left={<>
        {/* Left Panel: Student Candidate List */}
          <Paper variant="outlined" className="assignment-panel" sx={{
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
                Học viên chưa phân nhóm
                <Chip size="small" label={`${filteredStudents.length} HV`} sx={{ ml: 0.25, height: 22, bgcolor: "#EAF6FC", color: "#0788B8", fontWeight: 700 }} />
              </Typography>

              <Button size="small" startIcon={<ArrowBackRounded />} disabled={actionLoading}
                aria-label="Quay lại tổng quan" className="assignment-overview-action"
                onClick={() => setSearchParams(new URLSearchParams({ year: selectedYear }))}>Tổng quan</Button>
            </Box>

            {/* Left Search Bar */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center">
              <FilterSearchField
                placeholder="Tìm học viên theo mã, họ tên, số điện thoại..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                sx={{ width: "100%" }}
              />
            </Stack>

            {/* Selection Status & Action Bar */}
            <Box className="assignment-selection-bar">
              <Typography id="assignment-selection-status" variant="body2" color="text.secondary" aria-live="polite">
                {selectedStudentIds.length ? <>Đã chọn <strong>{selectedStudentIds.length}</strong> học viên</> : "Chưa chọn học viên"}
                {currentTargetGroup ? ` · Nhóm còn ${remainingCapacity} chỗ` : " · Chưa có nhóm để phân"}
                {overCapacity && <span className="assignment-overflow"> · <WarningAmberRounded aria-hidden="true" />Vượt {selectedStudentIds.length - remainingCapacity} học viên</span>}
              </Typography>
              <Button
                variant="contained"
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={handleAssignSelected}
                aria-describedby="assignment-selection-status"
                disabled={selectedStudentIds.length === 0 || !currentTargetGroup || loading || groupsLoading || !!error || actionLoading || overCapacity}
                sx={{ borderRadius: "8px", boxShadow: "none", bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
              >
                {actionLoading ? "Đang xử lý..." : selectedStudentIds.length ? `Gán ${selectedStudentIds.length}` : "Gán"}
              </Button>
            </Box>

            {/* Student Table */}
            <TableContainer className="assignment-scroll" sx={{ flexGrow: 1, maxHeight: 520, border: "1px solid #D8E5EF", borderRadius: "10px", overflow: "auto" }}>
              <ResizableTable columns={candidateColumns} storageKey="masters-assignment-candidate-compact-v2-column-widths"
                freezeThrough="learner"
                aria-label="Học viên chưa phân nhóm" className="assignment-table assignment-candidates assignment-resizable"
                sx={{
                  "& td, & th": { whiteSpace: "normal", overflow: "hidden", textOverflow: "ellipsis" },
                  "& td .MuiTypography-root": { whiteSpace: "normal", overflow: "hidden", textOverflow: "ellipsis" },
                  "& th": { bgcolor: "#EDF4FA", color: "#111827", borderColor: "#D8E5EF", fontWeight: 700 },
                }}>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={candidateColumns.length} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={candidateColumns.length} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        {studentSearch.trim()
                          ? "Không tìm thấy học viên chưa có nhóm."
                          : "Không còn học viên chưa có nhóm."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      const selectionLimitReached = loading || groupsLoading || actionLoading;
                      const name = personNameParts(s);
                      const displayName = [name.familyAndMiddle, name.givenName].filter((part) => part && part !== "—").join(" ") || "Chưa có thông tin";
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
                              disabled={selectionLimitReached || loading || groupsLoading || actionLoading}
                              inputProps={{ "aria-label": `Chọn ${s.fullName}` }}
                            />
                          </TableCell>
                          <TableCell className="assignment-learner-code-cell">
                            <Typography variant="body2" className="assignment-learner-code" title={s.code || undefined}>{s.code || "Chưa có"}</Typography>
                          </TableCell>
                          <TableCell className="assignment-learner-cell">
                            <Typography variant="body2" className="assignment-learner-name" title={displayName}>{displayName}</Typography>
                          </TableCell>
                          <TableCell className="assignment-nowrap">{s.dob || "-"}</TableCell>
                          <TableCell><TuitionStatus paid={s.tuitionPaid} /></TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </ResizableTable>
            </TableContainer>
          </Paper>
        </>} right={<>

        {/* Right Panel: Target Class Group & Members */}
          <Paper variant="outlined" className="assignment-panel" sx={{
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
                Nhóm mục tiêu
              </Typography>
            </Box>

            {/* Target Group Selector */}
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <Typography
                component="label"
                htmlFor="target-group-select"
                sx={{
                  mb: 0.75,
                  color: "#526A82",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  letterSpacing: ".025em",
                  lineHeight: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Chọn nhóm mục tiêu
              </Typography>
              <Select
                id="target-group-select"
                value={targetGroupId}
                disabled={groupsLoading || actionLoading || targetGroups.length === 0}
                inputProps={{ "aria-label": "Nhóm mục tiêu" }}
                onChange={(e) => setTargetGroupId(e.target.value)}
                displayEmpty
                MenuProps={{
                  PaperProps: {
                    sx: { maxHeight: 320, mt: 0.5, borderRadius: "8px" },
                  },
                  MenuListProps: { dense: true },
                }}
                sx={{
                  height: 40,
                  bgcolor: "#F7FAFD",
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#D8E5EF" },
                }}
              >
                <MenuItem value=""><em>{groupsLoading ? "Đang tải nhóm..." : targetGroups.length === 0 ? "Chưa có nhóm đang mở" : "Chọn nhóm mục tiêu"}</em></MenuItem>
                {targetGroups.map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      {g.code} ({g.memberCount || 0}/{g.maxStudents || 40} HV)
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {!groupsLoading && !error && (targetGroups.length === 0 || allGroupsFull || targetIsFull) && <Alert severity="warning" icon={<WarningAmberRounded />} className="assignment-operational-alert">
              <Typography variant="body2" className="assignment-alert-title">{targetGroups.length === 0 ? "Chưa có nhóm đang mở"
                : allGroupsFull ? "Các nhóm hiện tại đã đủ sĩ số" : "Nhóm hiện tại đã đủ sĩ số."}</Typography>
              <Typography variant="body2">{targetGroups.length === 0 ? "Chuyên ngành này hiện chưa có nhóm có thể tiếp nhận học viên."
                : hasAvailableAlternative ? "Vẫn còn nhóm khác có thể tiếp nhận học viên."
                  : "Không còn nhóm đang mở nào còn chỗ trong chuyên ngành này."}</Typography>
              {!hasAvailableAlternative && <Button size="small" onClick={quickCreate} disabled={actionLoading || postCreateLoading}>+ Tạo mới</Button>}
            </Alert>}
            {createFeedback && <Alert severity="warning" sx={{ mb: 1 }} action={pendingCreatedReload && <Button
              size="small" disabled={postCreateLoading}
              onClick={() => handleGroupsCreated(pendingCreatedReload.createdGroups, pendingCreatedReload.scope)}>Tải lại nhóm</Button>}>{createFeedback}</Alert>}

            {/* Target Group Info & Progress */}
            {currentTargetGroup ? (
              <Box className="assignment-capacity">
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "#087F8C" }}>
                    {currentTargetGroup.code}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Sĩ số: {currentMemberCount} / {maximumStudents} học viên
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={maximumStudents > 0 ? Math.min(100, Math.round((currentMemberCount / maximumStudents) * 100)) : 100}
                  color={targetIsFull ? "error" : "primary"}
                  sx={{ height: 7, borderRadius: 4, bgcolor: "#CBE7F0" }}
                />
                <Typography variant="caption" className={targetIsFull ? "assignment-capacity-full" : ""}>{targetIsFull ? "Đã đủ sĩ số · Còn 0 chỗ" : `Còn ${remainingCapacity} chỗ`}</Typography>
              </Box>
            ) : targetGroups.length > 0 && !allGroupsFull && !groupsLoading && !error ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Chọn nhóm mục tiêu để xem thành viên và phân nhóm. Danh sách bên trái vẫn hiển thị học viên chưa có nhóm theo bộ lọc.
              </Alert>
            ) : null}

            {currentTargetGroup && <><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827" }}>
                Danh sách học viên trong nhóm ({groupMembers.length}):
              </Typography>
              <Chip size="small" label={`${groupMembers.length} học viên`} sx={{ height: 22, bgcolor: "#F0F4F8", color: "#52677A", fontWeight: 600 }} />
            </Box>

            {/* Target Group Members Table */}
            <TableContainer sx={{
              flexGrow: 1,
              maxHeight: groupMembers.length > 25 ? 460 : "none",
              border: "1px solid #D8E5EF",
              borderRadius: "6px",
              overflowY: groupMembers.length > 25 ? "auto" : "visible",
              overflowX: "auto",
            }}>
              <Table size="small" stickyHeader={groupMembers.length > 25} aria-label="Học viên trong nhóm" className="assignment-table assignment-members">
                <colgroup>
                  <col className="assignment-index-col" /><col className="assignment-code-col" />
                  <col className="assignment-family-col" /><col className="assignment-name-col" />
                  <col className="assignment-dob-col" /><col className="assignment-tuition-col" /><col className="assignment-action-col" />
                </colgroup>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#EDF4FA", color: "#111827", borderColor: "#D8E5EF", fontWeight: 700 } }}>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>STT</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mã HV</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Họ đệm</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tên</TableCell>
                    <TableCell className="assignment-nowrap" sx={{ fontWeight: 700 }}>Ngày sinh</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Học phí nhập học</TableCell>
                    <TableCell align="center" className="assignment-action" sx={{ fontWeight: 700 }}>Bỏ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        Nhóm này hiện chưa có học viên. Chọn học viên bên trái rồi bấm Gán.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupMembers.map((m, idx) => (
                      <TableRow key={m.id} hover sx={{ "&:hover": { bgcolor: "#F5FAFE!important" }, "& td": { borderColor: "#E2EBF2", color: "#111827" } }}>
                        <TableCell align="center">{idx + 1}</TableCell>
                        <TableCell sx={{ fontFamily: "inherit", fontWeight: 600 }}><span className="assignment-code" title={m.code || ""}>{m.code || "-"}</span></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}><span className="assignment-name" title={personNameParts(m).familyAndMiddle}>{personNameParts(m).familyAndMiddle}</span></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}><span className="assignment-name" title={personNameParts(m).givenName}>{personNameParts(m).givenName}</span></TableCell>
                        <TableCell className="assignment-nowrap" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{m.dob || "-"}</TableCell>
                        <TableCell><TuitionStatus paid={m.tuitionPaid} /></TableCell>
                        <TableCell align="center" className="assignment-action">
                          <Tooltip title="Bỏ khỏi nhóm">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Bỏ ${m.fullName} khỏi nhóm`}
                              onClick={() => setPendingRemoval({ ...m, groupId: targetGroupId, groupCode: currentTargetGroup.code })}
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
            </>}
          </Paper>
        </>} />}
      <ConfirmDialog open={!!pendingRemoval} title="Bỏ học viên khỏi nhóm" severity="error"
        content={`Bỏ ${pendingRemoval?.fullName || ""} khỏi nhóm ${pendingRemoval?.groupCode || ""}?`}
        confirmText="Bỏ khỏi nhóm" loading={actionLoading} onConfirm={handleRemoveMember}
        onClose={() => { if (!actionInFlight.current) setPendingRemoval(null); }} />
      </Box>
    </FeatureLayout>
  );
};

export default AssignClassGroups;
