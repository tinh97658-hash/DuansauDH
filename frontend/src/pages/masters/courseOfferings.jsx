import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, IconButton,
  InputAdornment, MenuItem, Paper, Select, Stack, TextField, Typography,
} from "@mui/material";
import {
  ArrowForwardRounded, CheckCircleRounded, CloseRounded, LayersRounded,
  RefreshRounded, SearchRounded,
} from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import { schedulingType, schedulingTypographySx } from "../../components/scheduling/schedulingTypography";
import { API_BASE_URL } from "../../config/http";

const rowsFrom = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
const byTextDesc = (left, right) => String(right).localeCompare(String(left), "vi", { numeric: true });
const unique = (values) => [...new Set(values.filter(Boolean))];

const requestError = (error, fallback) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;
  if (status === 403) return message || "Tài khoản không có quyền tạo lớp học phần.";
  if (status === 409) return message || "Dữ liệu vừa thay đổi hoặc lớp học phần đã tồn tại.";
  if (status === 400 || status === 404) return message || "Dữ liệu lựa chọn không còn hợp lệ.";
  return message || fallback;
};

const StepLabel = ({ number, children }) => (
  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.65 }}>
    <Box sx={{ width: 23, height: 23, display: "grid", placeItems: "center", borderRadius: "4px", bgcolor: "#E7F2F8", color: "#075A9C", fontSize: 11, fontWeight: 700 }}>{number}</Box>
    <Typography variant="caption" sx={{ "&&": { color: "#536B79", fontWeight: 700, ...schedulingType.eyebrow } }}>{children}</Typography>
  </Stack>
);

const WorkspaceGuide = ({ selectedMajor, academicYear, candidateCount }) => {
  let title = "Bắt đầu bằng Chuyên ngành";
  let copy = "Chọn chuyên ngành ở bên trái để bắt đầu tạo lớp học phần.";
  let meta = "";
  if (selectedMajor && !academicYear) {
    title = selectedMajor.name;
    copy = "Tiếp tục chọn Khóa / Năm học để xác định các học phần còn cần tổ chức.";
  } else if (selectedMajor && academicYear) {
    title = "Chọn Học phần để tổ chức lớp học phần";
    copy = `${selectedMajor.name} · ${academicYear}`;
    meta = `${candidateCount} học phần hiện có thể tổ chức.`;
  }
  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "grid", placeItems: "center", bgcolor: "#EEF3F6", p: 4, textAlign: "center" }}>
      <Box sx={{ maxWidth: 500 }}>
        <Box sx={{ width: 50, height: 50, display: "grid", placeItems: "center", mx: "auto", mb: 1.25, border: "1px solid #A8BDCB", borderRadius: "50%", bgcolor: "#FFFFFF", color: "#2D6C95" }}><LayersRounded /></Box>
        <Typography variant="caption" sx={{ "&&": { color: "#607784", ...schedulingType.eyebrow } }}>TẠO LỚP HỌC PHẦN</Typography>
        <Typography variant="h5" sx={{ "&&": { mt: 0.5, color: "#24465D" } }}>{title}</Typography>
        <Typography variant="body2" sx={{ "&&": { mt: 0.75, color: "#637682" } }}>{copy}</Typography>
        {meta && <Typography variant="body2" sx={{ "&&": { mt: 1, color: "#31536A", fontWeight: 700 } }}>{meta}</Typography>}
      </Box>
    </Box>
  );
};

const CourseOfferings = () => {
  const navigate = useNavigate();
  const [majors, setMajors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedMajorId, setSelectedMajorId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [participantPreview, setParticipantPreview] = useState({ key: "", count: 0, loading: false, error: "" });
  const previewRequest = useRef(0);
  const candidatesRequest = useRef(0);
  const [canManageScheduling, setCanManageScheduling] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdOffering, setCreatedOffering] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/auth/session`, { withCredentials: true }),
    ])
      .then(([majorResponse, sessionResponse]) => {
        if (!active) return;
        setMajors(rowsFrom(majorResponse.data).filter((major) => major.active !== false));
        setCanManageScheduling(sessionResponse.data?.user?.canManageScheduling === true);
        setError("");
      })
      .catch((requestFailure) => { if (active) setError(requestError(requestFailure, "Không thể tải dữ liệu khởi tạo.")); })
      .finally(() => { if (active) { setAccessLoaded(true); setLoadingContext(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedMajorId) { setGroups([]); return undefined; }
    let active = true;
    setLoadingContext(true);
    axios.get(`${API_BASE_URL}/masters/class-groups?${new URLSearchParams({ majorId: selectedMajorId })}`, { withCredentials: true })
      .then(({ data }) => { if (active) { setGroups(rowsFrom(data)); setError(""); } })
      .catch((requestFailure) => { if (active) { setGroups([]); setError(requestError(requestFailure, "Không thể tải nhóm học viên của ngành đã chọn.")); } })
      .finally(() => { if (active) setLoadingContext(false); });
    return () => { active = false; };
  }, [selectedMajorId]);

  const academicYears = useMemo(() => unique(groups.map((group) => group.academicYear)).sort(byTextDesc), [groups]);
  const terms = useMemo(() => unique(groups.filter((group) => group.academicYear === academicYear).map((group) => group.term))
    .sort((left, right) => String(left).localeCompare(String(right), "vi", { numeric: true })), [groups, academicYear]);

  const loadCandidates = useCallback(async () => {
    const requestId = ++candidatesRequest.current;
    if (!selectedMajorId || !academicYear) { setCandidates([]); setLoadingCandidates(false); return; }
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams({ program: "masters", majorId: selectedMajorId, academicYear });
      if (term) params.set("term", term);
      const { data } = await axios.get(`${API_BASE_URL}/scheduling/course-offering-candidates?${params}`, { withCredentials: true });
      if (requestId !== candidatesRequest.current) return;
      setCandidates(rowsFrom(data?.subjects));
      setError("");
    } catch (requestFailure) {
      if (requestId !== candidatesRequest.current) return;
      setCandidates([]);
      setError(requestError(requestFailure, "Không thể tải học phần còn cần tổ chức."));
    } finally {
      if (requestId === candidatesRequest.current) setLoadingCandidates(false);
    }
  }, [academicYear, selectedMajorId, term]);

  useEffect(() => {
    loadCandidates();
    return () => { candidatesRequest.current += 1; };
  }, [loadCandidates]);

  useEffect(() => {
    const requestId = ++previewRequest.current;
    const key = selectedGroupIds.join(",");
    if (selectedGroupIds.length === 0) {
      setParticipantPreview({ key, count: 0, loading: false, error: "" });
    } else {
      setParticipantPreview({ key, count: null, loading: true, error: "" });
      axios.post(`${API_BASE_URL}/scheduling/course-offerings/participant-preview`, { classGroupIds: selectedGroupIds }, { withCredentials: true })
        .then(({ data }) => {
          if (previewRequest.current !== requestId) return;
          if (!Number.isInteger(data?.participantCount) || data.participantCount < 0) throw new Error("Invalid participant preview");
          setParticipantPreview({ key, count: data.participantCount, loading: false, error: "" });
        })
        .catch((requestFailure) => {
          if (previewRequest.current !== requestId) return;
          setParticipantPreview({ key, count: null, loading: false, error: requestError(requestFailure, "Không thể tính tổng học viên. Vui lòng chọn lại nhóm để thử lại.") });
        });
    }
    return () => { previewRequest.current = requestId + 1; };
  }, [selectedGroupIds]);

  const selectedMajor = majors.find((major) => major.id === selectedMajorId) || null;
  const selectedCandidate = candidates.find((candidate) => candidate.subject?.id === selectedSubjectId) || null;
  const selectedGroups = (selectedCandidate?.eligibleClassGroups || []).filter((group) => selectedGroupIds.includes(group.id));
  const previewCurrent = participantPreview.key === selectedGroupIds.join(",");
  const previewLoading = selectedGroupIds.length > 0 && (!previewCurrent || participantPreview.loading);
  const previewError = previewCurrent ? participantPreview.error : "";
  const selectedMemberCount = selectedGroupIds.length === 0 ? 0 : previewCurrent && !previewLoading && !previewError ? participantPreview.count : null;
  const filteredCandidates = useMemo(() => {
    const keyword = subjectSearch.trim().toLocaleLowerCase("vi");
    if (!keyword) return candidates;
    return candidates.filter((candidate) => `${candidate.subject?.code || ""} ${candidate.subject?.name || ""}`.toLocaleLowerCase("vi").includes(keyword));
  }, [candidates, subjectSearch]);
  const displayedGroups = useMemo(() => {
    if (!selectedCandidate) return [];
    const eligible = (selectedCandidate.eligibleClassGroups || []).map((group) => ({ group, eligibility: "eligible" }));
    const busy = (selectedCandidate.activeClassGroups || []).map((group) => ({ group, eligibility: "active" }));
    const completed = (selectedCandidate.completedClassGroups || []).map((group) => ({ group, eligibility: "completed" }));
    const seen = new Set();
    const keyword = groupSearch.trim().toLocaleLowerCase("vi");
    return [...eligible, ...busy, ...completed].filter(({ group }) => {
      if (!group?.id || seen.has(group.id)) return false;
      seen.add(group.id);
      return !keyword || `${group.code || ""} ${group.name || ""} ${group.major?.name || ""}`.toLocaleLowerCase("vi").includes(keyword);
    });
  }, [groupSearch, selectedCandidate]);

  const resetDraft = () => { setSelectedGroupIds([]); setCreatedOffering(null); setError(""); };
  const changeMajor = (value) => {
    setSelectedMajorId(value); setAcademicYear(""); setTerm(""); setCandidates([]); setSelectedSubjectId("");
    setSubjectSearch(""); setGroupSearch(""); setSelectedGroupIds([]); setCreatedOffering(null); setError("");
  };
  const changeAcademicYear = (value) => {
    setAcademicYear(value); setTerm(""); setCandidates([]); setSelectedSubjectId(""); setSubjectSearch("");
    setGroupSearch(""); setSelectedGroupIds([]); setCreatedOffering(null); setError("");
  };
  const changeTerm = (value) => {
    setTerm(value); setSelectedSubjectId(""); setGroupSearch(""); setSelectedGroupIds([]); setCreatedOffering(null); setError("");
  };
  const chooseSubject = (subjectId) => { setSelectedSubjectId(subjectId); setSelectedGroupIds([]); setGroupSearch(""); setCreatedOffering(null); setError(""); };
  const toggleGroup = (groupId) => {
    if (!canManageScheduling) return;
    setSelectedGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  const createOffering = async () => {
    if (!canManageScheduling || !selectedSubjectId || selectedGroupIds.length === 0 || previewLoading || previewError || selectedMemberCount === null) return;
    setSaving(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/scheduling/course-offerings`, { subjectId: selectedSubjectId, classGroupIds: selectedGroupIds }, { withCredentials: true });
      setCreatedOffering(data);
      toast.success("Đã tạo lớp học phần.");
      setError("");
      await loadCandidates();
    } catch (requestFailure) {
      setError(requestError(requestFailure, "Không thể tạo lớp học phần."));
    } finally {
      setSaving(false);
    }
  };

  const createdGroups = (createdOffering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
  const compositionMajors = unique(selectedGroups.map((group) => group.major?.name));
  const compositionTerms = unique(selectedGroups.map((group) => group.term));

  return (
    <FeatureLayout hideHeader workspaceMode>
      <Box
        data-testid="create-offering-workspace"
        data-scheduling-typography="compact"
        sx={{
          ...schedulingTypographySx,
          height: "100%", minHeight: 0, display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(320px, 30%) minmax(0, 70%)" }, gap: "1px", bgcolor: "#C8D3DB",
          border: "1px solid #C5D0D8", overflow: { lg: "hidden" },
        }}
      >
        <Box component="aside" sx={{ minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "#F8FAFB", borderRight: { lg: "1px solid #C5D0D8" } }}>
          <Box sx={{ flex: "none", p: 1.5, bgcolor: "#FFFFFF", borderBottom: "1px solid #D6E0E6" }}>
            <Typography variant="caption" sx={{ "&&": { display: "block", mb: 1, color: "#526875", ...schedulingType.eyebrow } }}>PHẠM VI TỔ CHỨC</Typography>
            <StepLabel number="1">CHUYÊN NGÀNH</StepLabel>
            <FormControl size="small" fullWidth>
              <Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} displayEmpty inputProps={{ "aria-label": "Chọn chuyên ngành" }} value={selectedMajorId} renderValue={(value) => value ? majors.find((major) => major.id === value)?.name : "Chọn chuyên ngành"} onChange={(event) => changeMajor(event.target.value)} disabled={loadingContext && majors.length === 0}>
                {majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name} ({major.code})</MenuItem>)}
              </Select>
            </FormControl>

            {selectedMajorId && (
              <Box sx={{ mt: 1.25 }}>
                <StepLabel number="2">KHÓA / NĂM HỌC</StepLabel>
                <Stack direction="row" spacing={0.75}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography component="label" variant="caption" sx={{ "&&": { display: "block", mb: 0.35, color: "#5C6E7A", ...schedulingType.fieldLabel } }}>Khóa / Năm học</Typography>
                    <FormControl size="small" fullWidth>
                      <Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} displayEmpty inputProps={{ "aria-label": "Khóa / Năm học" }} value={academicYear} renderValue={(value) => value || "Chọn khóa / năm"} onChange={(event) => changeAcademicYear(event.target.value)} disabled={loadingContext || academicYears.length === 0}>
                        {academicYears.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                  {academicYear && terms.length > 0 && (
                    <Box sx={{ minWidth: 112 }}>
                      <Typography component="label" variant="caption" sx={{ "&&": { display: "block", mb: 0.35, color: "#5C6E7A", ...schedulingType.fieldLabel } }}>Học kỳ</Typography>
                      <FormControl size="small" fullWidth>
                        <Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} displayEmpty renderValue={(value) => value || "Tất cả"} inputProps={{ "aria-label": "Học kỳ" }} value={term} onChange={(event) => changeTerm(event.target.value)}>
                          <MenuItem value="">Tất cả</MenuItem>{terms.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </Stack>
                {!loadingContext && academicYears.length === 0 && <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.65, color: "warning.dark" } }}>Chuyên ngành chưa có nhóm với năm học hợp lệ.</Typography>}
              </Box>
            )}
          </Box>

          <Box sx={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column", p: 1.2, bgcolor: "#F1F4F6", overflow: "hidden" }}>
            {academicYear && (
              <>
                <Stack direction="row" alignItems="center" spacing={0.65} sx={{ mb: 0.75 }}>
                  <Box sx={{ width: 23, height: 23, display: "grid", placeItems: "center", borderRadius: "4px", bgcolor: "#E7F2F8", color: "#075A9C", fontSize: 11, fontWeight: 700 }}>3</Box>
                  <Typography variant="caption" sx={{ "&&": { flex: 1, color: "#4E626F", ...schedulingType.eyebrow } }}>HỌC PHẦN CÒN CẦN TỔ CHỨC</Typography>
                  <Chip size="small" label={filteredCandidates.length} sx={{ height: 19 }} />
                  <IconButton size="small" aria-label="Tải lại học phần" onClick={loadCandidates} disabled={loadingCandidates}><RefreshRounded fontSize="small" /></IconButton>
                </Stack>
                <TextField
                  size="small" fullWidth placeholder="Tìm học phần..." value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ mb: 0.75, bgcolor: "#FFFFFF" }}
                />
              </>
            )}
            {error && <Alert severity="error" sx={{ mb: 0.75, py: 0 }}>{error}</Alert>}
            {accessLoaded && !canManageScheduling && <Box sx={{ mb: 0.75, p: 0.75, borderLeft: "3px solid #CE9D35", bgcolor: "#FFF8E5", color: "#674F1E", fontSize: 11 }}>Tài khoản hiện tại chỉ có quyền xem.</Box>}
            <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto" }}>
              {!selectedMajorId ? <Typography variant="caption" color="text.secondary">Chọn chuyên ngành để tiếp tục.</Typography>
                : !academicYear ? <Typography variant="caption" color="text.secondary">Chọn khóa / năm học để tải học phần.</Typography>
                  : loadingCandidates ? <Box role="status" sx={{ height: 120, display: "grid", placeItems: "center" }}><CircularProgress size={25} /></Box>
                    : filteredCandidates.length === 0 ? <Box sx={{ p: 2, border: "1px dashed #B8C5CE", bgcolor: "#FFFFFF", textAlign: "center" }}><Typography variant="caption" color="text.secondary">Không còn học phần cần tổ chức trong phạm vi đã chọn.</Typography></Box>
                      : <Stack spacing={0.6}>{filteredCandidates.map((candidate) => {
                        const item = candidate.subject || {};
                        const selected = item.id === selectedSubjectId;
                        return (
                          <Box
                            key={item.id} component="button" type="button" onClick={() => chooseSubject(item.id)} data-selected={selected ? "true" : "false"}
                            sx={{ width: "100%", p: 1, border: "1px solid", borderColor: selected ? "#3D86BA" : "#C6D1D9", borderLeft: `3px solid ${selected ? "#075A9C" : "#7E9EB3"}`, bgcolor: selected ? "#EFF7FB" : "#FFFFFF", textAlign: "left", color: "inherit", cursor: "pointer", transition: "background-color 150ms, border-color 150ms", "&:hover": { bgcolor: selected ? "#E7F3FA" : "#F7FAFC", borderColor: "#7EAAC7" } }}
                          >
                            <Typography variant="body2" sx={{ "&&": { color: "#1C3A50", fontWeight: 700 } }}>{item.code || "Không mã"} · {item.name}</Typography>
                            <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.35, color: "#5F717D" } }}>{candidate.eligibleClassGroups?.length || 0} lớp/nhóm có thể chọn</Typography>
                          </Box>
                        );
                      })}</Stack>}
            </Box>
          </Box>
        </Box>

        <Box component="section" sx={{ minWidth: 0, minHeight: 0, bgcolor: "#EEF3F6", p: { xs: 1, lg: 1.25 }, overflow: "hidden" }}>
          {createdOffering ? (
            <Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "#F7FAFC" }}>
              <Paper variant="outlined" sx={{ width: "min(560px, 92%)", p: 2.75, textAlign: "center", borderColor: "#B6CCDA" }}>
                <CheckCircleRounded sx={{ color: "success.main", fontSize: 42 }} />
                <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.5, color: "success.dark", ...schedulingType.eyebrow } }}>ĐÃ TẠO LỚP HỌC PHẦN</Typography>
                <Typography variant="h4" sx={{ "&&": { mt: 0.5 } }}>{createdOffering.subject?.code} · {createdOffering.subject?.name}</Typography>
                <Typography variant="body2" sx={{ "&&": { mt: 0.6, color: "text.secondary" } }}>{unique(createdGroups.map((group) => group.major?.name)).join(" · ")} · {unique(createdGroups.map((group) => group.academicYear)).join(", ")}</Typography>
                <Box sx={{ mt: 1.5, p: 1.25, bgcolor: "#F0F5F8", border: "1px solid #D5E0E6" }}>
                  <Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{createdGroups.length} lớp/nhóm · {createdOffering.participantCount ?? 0} học viên hiện có</Typography>
                  <Typography variant="caption">{createdGroups.map((group) => `${group.code} · ${group.name}`).join("; ")}</Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="center" spacing={0.75} sx={{ mt: 1.75 }}>
                  <Button variant="outlined" onClick={() => { setCreatedOffering(null); setSelectedSubjectId(""); setSelectedGroupIds([]); }}>Tạo lớp học phần khác</Button>
                  <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate(`/masters/schedule?offeringId=${createdOffering.id}`)}>Sang Xếp lịch</Button>
                </Stack>
              </Paper>
            </Box>
          ) : !selectedCandidate ? (
            <WorkspaceGuide selectedMajor={selectedMajor} academicYear={academicYear} candidateCount={candidates.length} />
          ) : (
            <Paper variant="outlined" data-testid="offering-shell" sx={{ height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "68px minmax(0,1fr)", overflow: "hidden" }}>
              <Box sx={{ px: 1.75, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, borderBottom: "1px solid #D7E0E6" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ "&&": { color: "#718692", ...schedulingType.eyebrow } }}>TẠO LỚP HỌC PHẦN</Typography>
                  <Typography variant="h5" noWrap>{selectedCandidate.subject?.code} · {selectedCandidate.subject?.name}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexShrink={0}><Chip size="small" variant="outlined" label={selectedMajor?.code || selectedMajor?.name} /><Chip size="small" variant="outlined" label={academicYear} />{term && <Chip size="small" variant="outlined" label={term} />}</Stack>
              </Box>

              <Box data-testid="offering-body" sx={{ minHeight: 0, display: "grid", gridTemplateRows: "minmax(0,1fr) 170px", overflow: "hidden" }}>
              <Box data-testid="offering-top-panels" sx={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", overflow: "hidden" }}>
                <Box data-testid="offering-groups-panel" sx={{ minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto auto minmax(0,1fr)", borderRight: "1px solid #d2dbe1" }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: "12px 14px", minHeight: 64, borderBottom: "1px solid #E0E7EB" }}>
                  <Box sx={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "4px", bgcolor: "#EDF6FB", color: "#126B9F", fontWeight: 700 }}>1</Box>
                  <Box sx={{ flex: 1 }}><Typography variant="caption" sx={{ "&&": { display: "block", color: "#284C62", ...schedulingType.panelTitle } }}>GHÉP LỚP / NHÓM</Typography><Typography variant="caption" color="text.secondary">Thành phần chính của lớp học phần</Typography></Box>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ p: "8px 12px" }}>
                  <TextField size="small" fullWidth placeholder="Tìm lớp / nhóm..." value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} />
                  <Chip size="small" label={`${selectedCandidate.eligibleClassGroups?.length || 0} có thể chọn`} />
                </Stack>
                <Box sx={{ minHeight: 0, overflowY: "auto", px: 0.75, pb: 1 }}>
                  {displayedGroups.length === 0 ? <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}><Typography variant="body2" color="text.secondary">Không có lớp/nhóm phù hợp.</Typography></Box>
                    : displayedGroups.map(({ group, eligibility }) => {
                      const selectable = eligibility === "eligible";
                      const checked = selectedGroupIds.includes(group.id);
                      const statusText = selectable ? (checked ? "ĐÃ CHỌN" : "CÓ THỂ CHỌN") : (eligibility === "active" ? "ĐANG TỔ CHỨC" : "ĐÃ HOÀN THÀNH");
                      return (
                        <Box
                          key={group.id} component="button" type="button" disabled={!selectable || !canManageScheduling} onClick={() => toggleGroup(group.id)}
                          sx={{ width: "100%", minHeight: 58, display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", alignItems: "center", gap: 1, p: "8px 10px", border: 0, borderBottom: "1px solid #e1e7eb", bgcolor: checked ? "#F1F8FC" : (selectable ? "#FFFFFF" : "#F4F6F7"), color: "inherit", textAlign: "left", cursor: selectable && canManageScheduling ? "pointer" : "not-allowed", opacity: selectable ? 1 : 0.72, transition: "background-color 150ms", "&:hover": selectable && canManageScheduling ? { bgcolor: "#EAF5FB" } : {} }}
                        >
                          <Checkbox checked={checked} disabled={!selectable || !canManageScheduling} inputProps={{ "aria-label": `Chọn nhóm ${group.code}` }} />
                          <Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap sx={{ "&&": schedulingType.cardTitle }}>{group.code} · {group.name}</Typography><Typography variant="caption" noWrap>{group.major?.name || "Chưa có ngành"} · {group.academicYear || "-"}{group.term ? ` · ${group.term}` : ""} · {group.memberCount ?? 0} HV</Typography></Box>
                          <Chip size="small" color={checked ? "primary" : "default"} variant={checked ? "filled" : "outlined"} label={statusText} />
                        </Box>
                      );
                    })}
                </Box>
                </Box>
                <Box data-testid="offering-retake-panel" aria-disabled="true" sx={{ minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto auto minmax(0,1fr)", bgcolor: "#F5F7F9" }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ p: "12px 14px", minHeight: 64, borderBottom: "1px solid #E0E7EB" }}>
                    <Box sx={{ flexShrink: 0, width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "4px", bgcolor: "#E7EDF1", color: "#627682", fontWeight: 700 }}>2</Box>
                    <Box><Typography variant="caption" sx={{ "&&": { display: "block", color: "#536B79", ...schedulingType.panelTitle } }}>HỌC VIÊN HỌC LẠI TỪ KHÓA TRƯỚC</Typography><Typography variant="caption" color="text.secondary">Chỉ ghép bổ sung vào lớp / nhóm ở vùng 1</Typography></Box>
                  </Stack>
                  <Box sx={{ p: "8px 12px" }}><TextField size="small" fullWidth disabled placeholder="Tìm học viên học lại..." inputProps={{ "aria-label": "Tìm học viên học lại" }} /></Box>
                  <Box sx={{ minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", p: "20px 24px", textAlign: "center" }}>
                    <Box sx={{ maxWidth: 330 }}>
                      <Typography sx={{ "&&": { fontSize: 12, fontWeight: 600, color: "#526773" } }}>Chưa có dữ liệu học lại chính thức</Typography>
                      <Typography sx={{ "&&": { mt: 0.75, fontSize: 10.5, fontWeight: 400, lineHeight: 1.4, color: "#6a7b86" } }}>Danh sách học viên học lại sẽ xuất hiện tại đây khi kết quả học tập được liên kết chính xác với học phần.</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Box data-testid="offering-bottom-panel" sx={{ height: 170, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", borderTop: "1px solid #C9D5DD", bgcolor: "#F7FAFC" }}>
                <Box sx={{ p: "12px 14px", minWidth: 0, minHeight: 0, overflowY: "auto" }}>
                  <Typography variant="caption" sx={{ "&&": { color: "#26495E", fontWeight: 700 } }}>3 · THÀNH PHẦN LỚP HỌC PHẦN</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ "&&": { ml: 0.75 } }}>Những lớp/nhóm đã chọn</Typography>
                  <Stack direction="row" spacing={0.65} sx={{ mt: 0.8, overflowX: "auto", pb: 0.5 }}>
                    {selectedGroups.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ "&&": { py: 1.5 } }}>Chưa chọn thành phần. Bắt đầu bằng một lớp/nhóm ở vùng trên.</Typography>
                      : selectedGroups.map((group) => (
                        <Paper key={group.id} variant="outlined" sx={{ minWidth: 165, maxWidth: 220, height: 48, display: "flex", alignItems: "center", px: 1, borderColor: "#BFD0DA" }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="caption" noWrap sx={{ "&&": { fontWeight: 700 } }}>{group.code}</Typography><Typography variant="caption" noWrap sx={{ "&&": { display: "block" } }}>{group.major?.name} · {group.memberCount ?? 0} HV</Typography></Box>
                          {canManageScheduling && <IconButton size="small" aria-label={`Bỏ nhóm ${group.code}`} onClick={() => toggleGroup(group.id)}><CloseRounded fontSize="small" /></IconButton>}
                        </Paper>
                      ))}
                  </Stack>
                </Box>
                <Box data-testid="offering-summary" sx={{ p: "11px 14px", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", borderLeft: "1px solid #D9E1E6", bgcolor: "#FFFFFF" }}>
                  <Typography variant="caption" sx={{ "&&": { color: "#748792", ...schedulingType.eyebrow } }}>TỔNG HỢP</Typography>
                  <Box sx={{ minHeight: 0, overflowY: "auto", py: 0.5 }}>
                    <Stack direction="row" spacing={2}>
                      <Box><Typography variant="h5" sx={{ "&&": { fontSize: 16, fontWeight: 700 } }}>{selectedGroups.length}</Typography><Typography variant="caption">Lớp / nhóm</Typography></Box>
                      <Box><Typography variant="h5" sx={{ "&&": { fontSize: 16, fontWeight: 700 } }} data-testid="participant-preview-count" aria-live="polite">{previewLoading ? <CircularProgress size={18} aria-label="Đang tính tổng học viên" /> : selectedMemberCount ?? "—"}</Typography><Typography variant="caption">Tổng học viên</Typography></Box>
                    </Stack>
                    {previewError && <Typography role="alert" variant="caption" color="error" sx={{ "&&": { display: "block" } }}>{previewError}</Typography>}
                    <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.6 } }}>Chuyên ngành: {compositionMajors.join(" · ") || "Chưa có ngành"}</Typography>
                    <Typography variant="caption" sx={{ "&&": { display: "block" } }}>Khóa / Năm: {academicYear}{compositionTerms.length ? ` · ${compositionTerms.join(", ")}` : ""}</Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing="6px" sx={{ height: 36 }}>
                    <Button size="small" variant="outlined" sx={{ "&&": { width: 74, minWidth: 74, height: 36, flexShrink: 0 } }} onClick={resetDraft} disabled={!canManageScheduling || selectedGroups.length === 0}>Làm lại</Button>
                    <Button size="small" fullWidth variant="contained" sx={{ "&&": { flex: 1, minWidth: 0, px: 0.5, height: 36, whiteSpace: "nowrap", fontSize: 12.5, fontWeight: 600 } }} onClick={createOffering} disabled={!canManageScheduling || selectedGroups.length === 0 || saving || previewLoading || Boolean(previewError) || selectedMemberCount === null}>{saving ? "Đang lưu..." : "Tạo lớp học phần"}</Button>
                  </Stack>
                </Box>
              </Box>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
      <ToastContainer position="top-center" autoClose={2400} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover draggable={false} limit={2} />
    </FeatureLayout>
  );
};

export default CourseOfferings;
