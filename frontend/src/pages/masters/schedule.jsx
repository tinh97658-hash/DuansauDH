import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputAdornment,
  MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { AddRounded, RefreshRounded, SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import CourseOfferingDrawer from "../../components/scheduling/CourseOfferingDrawer";
import PendingSessionsDrawer from "../../components/scheduling/PendingSessionsDrawer";
import UnresolvedSessionsDrawer from "../../components/scheduling/UnresolvedSessionsDrawer";
import { schedulingType, schedulingTypographySx } from "../../components/scheduling/schedulingTypography";
import SessionComposer from "../../components/scheduling/SessionComposer";
import WeeklyCalendar from "../../components/scheduling/WeeklyCalendar";
import "../../components/scheduling/schedulingReferences.css";
import { API_BASE_URL } from "../../config/http";
import { addDays, formatDateKey, getBusinessTodayKey, isSessionPast, mondayOf } from "../../utils/schedulingCalendar";

const rowsFrom = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
const offeringGroups = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
const unique = (values) => [...new Set(values.filter(Boolean))];
const requestMessage = (error, fallback) => error?.response?.data?.message || fallback;
const conflictDetail = (details) => {
  const context = details?.conflictingSession || {};
  const groups = (context.classGroups || []).map((group) => group.code || group.name).filter(Boolean).join(", ");
  return [
    context.subject?.code ? `Học phần: ${context.subject.code}${context.subject.name ? ` · ${context.subject.name}` : ""}` : "",
    groups ? `Lớp: ${groups}` : "",
    context.lecturer?.name ? `Giảng viên: ${context.lecturer.name}` : "",
    context.room?.code ? `Phòng: ${context.room.code}` : "",
  ].filter(Boolean).join(" · ");
};

const conflictMessage = (error, rooms, lecturers) => {
  const response = error?.response;
  if (response?.status !== 409) return requestMessage(error, "Không thể lưu buổi học.");
  const code = response.data?.code;
  const details = response.data?.details || {};
  if (code === "SESSION_TIME_IN_PAST") return requestMessage(error, "Không thể xếp lịch vào một buổi học đã kết thúc.");
  if (code === "ROOM_CONFLICT") {
    const room = rooms.find((item) => item.id === details.roomId);
    return `Phòng ${room?.code || details.conflictingSession?.room?.code || "đã chọn"} đang được sử dụng.${conflictDetail(details) ? `\n${conflictDetail(details)}` : ""}`;
  }
  if (code === "LECTURER_CONFLICT") {
    const lecturer = lecturers.find((item) => item.id === details.lecturerId);
    return `Giảng viên ${lecturer?.name || details.conflictingSession?.lecturer?.name || "đã chọn"} đang bận.${conflictDetail(details) ? `\n${conflictDetail(details)}` : ""}`;
  }
  if (code === "CLASS_GROUP_CONFLICT") return `Một hoặc nhiều nhóm học viên đã có lịch trong khoảng thời gian này.${conflictDetail(details) ? `\n${conflictDetail(details)}` : ""}`;
  if (code === "ROOM_CAPACITY_MISSING") return `Phòng ${details.roomCode || "đã chọn"} chưa được khai báo sức chứa và chưa thể dùng để xếp lịch.`;
  if (code === "ROOM_CAPACITY_EXCEEDED") return `Phòng ${details.roomCode || "đã chọn"} chỉ có ${details.roomCapacity} chỗ nhưng lớp học phần có ${details.participantCount} học viên.`;
  return requestMessage(error, "Dữ liệu vừa thay đổi và phát sinh xung đột. Vui lòng kiểm tra lại.");
};

const scopeForOffering = (offering) => {
  const groups = offeringGroups(offering);
  const majorIds = unique(groups.map((group) => group.majorId || group.major?.id));
  const years = unique(groups.map((group) => group.academicYear));
  return {
    majorId: majorIds.length === 1 ? majorIds[0] : "",
    academicYear: years.length === 1 ? years[0] : "",
  };
};

const Schedule = () => {
  const [searchParams] = useSearchParams();
  const requestedOfferingId = searchParams.get("offeringId") || "";
  const offeringRefs = useRef({});
  const sessionsRequestId = useRef(0);
  const [offerings, setOfferings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pendingSessions, setPendingSessions] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [highlightedId, setHighlightedId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [search, setSearch] = useState("");
  const [monday, setMonday] = useState(() => mondayOf(getBusinessTodayKey()));
  const requestedSessionId = searchParams.get("sessionId") || "";
  const [canManageScheduling, setCanManageScheduling] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  const [guidance, setGuidance] = useState("");
  const [composer, setComposer] = useState(null);
  const [composerError, setComposerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailOfferingId, setDetailOfferingId] = useState("");
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingSavingId, setPendingSavingId] = useState("");
  const [unresolvedOffering, setUnresolvedOffering] = useState(null);
  const [unresolvedSessions, setUnresolvedSessions] = useState([]);
  const [unresolvedLoading, setUnresolvedLoading] = useState(false);
  const [unresolvedError, setUnresolvedError] = useState("");
  const [offWeekAvailability, setOffWeekAvailability] = useState({ from: "", sessions: [], loading: false, error: "" });

  const weekFrom = formatDateKey(monday);
  const weekTo = formatDateKey(addDays(monday, 6));
  const composerDate = composer?.availabilityDate || composer?.initialDate;
  const composerMonday = composerDate ? mondayOf(composerDate) : monday;
  const composerWeekFrom = formatDateKey(composerMonday);
  const composerWeekTo = formatDateKey(addDays(composerMonday, 6));
  const needsOffWeekAvailability = Boolean(composer && (!composer.session || (composer.session.status === "planned" && !isSessionPast(composer.session))) && composerWeekFrom !== weekFrom);

  useEffect(() => {
    if (!needsOffWeekAvailability) return undefined;
    let active = true;
    setOffWeekAvailability({ from: composerWeekFrom, sessions: [], loading: true, error: "" });
    const params = new URLSearchParams({ from: composerWeekFrom, to: composerWeekTo });
    axios.get(`${API_BASE_URL}/scheduling/teaching-sessions?${params}`, { withCredentials: true })
      .then(({ data }) => { if (active) setOffWeekAvailability({ from: composerWeekFrom, sessions: rowsFrom(data), loading: false, error: "" }); })
      .catch((failure) => { if (active) setOffWeekAvailability({ from: composerWeekFrom, sessions: [], loading: false, error: requestMessage(failure, "Không thể tải lịch toàn Viện cho tuần của buổi học.") }); });
    return () => { active = false; };
  }, [composerWeekFrom, composerWeekTo, needsOffWeekAvailability]);

  useEffect(() => {
    if (!unresolvedOffering) return undefined;
    let active = true;
    setUnresolvedLoading(true); setUnresolvedError(""); setUnresolvedSessions([]);
    const url = `${API_BASE_URL}/scheduling/course-offerings/${unresolvedOffering.id}`;
    axios.get(`${url}/unresolved-teaching-sessions`, { withCredentials: true })
      .then(async ({ data }) => {
        if (!active) return;
        const rows = rowsFrom(data);
        setUnresolvedSessions(rows);
        setUnresolvedLoading(false);
        if (rows.length === 0) {
          // Refresh only this summary; do not reapply a deep-link's calendar selection.
          try {
            const detail = await axios.get(url, { withCredentials: true });
            if (active) setOfferings((current) => current.map((item) => item.id === detail.data?.id ? detail.data : item));
          } catch (failure) {
            if (active) setError(requestMessage(failure, "Không thể cập nhật tổng hợp lớp học phần. Vui lòng tải lại danh sách."));
          }
        }
      })
      .catch((failure) => { if (active) setUnresolvedError(requestMessage(failure, "Không thể tải các buổi cần xử lý hoặc cập nhật tổng hợp lớp học phần.")); })
      .finally(() => { if (active) setUnresolvedLoading(false); });
    return () => { active = false; };
  }, [unresolvedOffering]);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/scheduling/course-offerings?program=masters`, { withCredentials: true });
      let rows = rowsFrom(data);
      if (requestedOfferingId && !rows.some((offering) => offering.id === requestedOfferingId)) {
        try {
          const detail = await axios.get(`${API_BASE_URL}/scheduling/course-offerings/${requestedOfferingId}`, { withCredentials: true });
          if (detail.data?.id && detail.data?.subject?.program === "masters") rows = [detail.data, ...rows];
        } catch {
          // A stale/deleted query id must not make the persisted worklist unusable.
        }
      }
      setOfferings(rows);
      const requested = rows.find((offering) => offering.id === requestedOfferingId);
      if (requested) {
        const scope = scopeForOffering(requested);
        setSelectedId(requested.id);
        setMajorId(scope.majorId);
        setAcademicYear(scope.academicYear);
        setSearch("");
        setHighlightedId(requested.id);
      } else {
        setSelectedId((current) => rows.some((offering) => offering.id === current) ? current : "");
      }
      setError("");
    } catch (requestFailure) {
      setOfferings([]);
      setSelectedId("");
      setError(requestMessage(requestFailure, "Không thể tải danh sách lớp học phần."));
    } finally {
      setLoading(false);
    }
  }, [requestedOfferingId]);

  const loadSessions = useCallback(async () => {
    const requestId = ++sessionsRequestId.current;
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams({ from: weekFrom, to: weekTo });
      const { data } = await axios.get(`${API_BASE_URL}/scheduling/teaching-sessions?${params}`, { withCredentials: true });
      if (requestId !== sessionsRequestId.current) return;
      setSessions(rowsFrom(data));
      setSessionsError("");
    } catch (requestFailure) {
      if (requestId !== sessionsRequestId.current) return;
      setSessions([]);
      setSessionsError(requestMessage(requestFailure, "Không thể tải lịch học của tuần."));
    } finally {
      if (requestId === sessionsRequestId.current) setSessionsLoading(false);
    }
  }, [weekFrom, weekTo]);

  const loadPendingSessions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/scheduling/pending-teaching-sessions`, { withCredentials: true });
      setPendingSessions(rowsFrom(data).filter((session) => session.courseOffering?.subject?.active !== false));
      setPendingError("");
    } catch (requestFailure) {
      setPendingSessions([]);
      setPendingError(requestMessage(requestFailure, "Không thể tải danh sách buổi chờ xác nhận."));
    }
  }, []);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);
  useEffect(() => {
    loadSessions();
    // Invalidate in-flight responses on week change and unmount, including errors.
    return () => { sessionsRequestId.current += 1; };
  }, [loadSessions]);
  useEffect(() => {
    if (accessLoaded && canManageScheduling) loadPendingSessions();
    else if (accessLoaded) setPendingSessions([]);
  }, [accessLoaded, canManageScheduling, loadPendingSessions]);

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API_BASE_URL}/system/lecturers`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/system/rooms?includeInactive=true`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/auth/session`, { withCredentials: true }),
    ])
      .then(([lecturerResponse, roomResponse, sessionResponse]) => {
        if (!active) return;
        setLecturers(rowsFrom(lecturerResponse.data).filter((lecturer) => lecturer.active === true));
        setRooms(rowsFrom(roomResponse.data));
        setCanManageScheduling(sessionResponse.data?.user?.canManageScheduling === true);
      })
      .catch((requestFailure) => { if (active) setError(requestMessage(requestFailure, "Không thể tải giảng viên, phòng học hoặc quyền xếp lịch.")); })
      .finally(() => { if (active) setAccessLoaded(true); });
    return () => { active = false; };
  }, []);

  const allGroups = useMemo(() => offerings.flatMap(offeringGroups), [offerings]);
  const majors = useMemo(() => {
    const byId = new Map();
    allGroups.forEach((group) => { if (group.major?.id) byId.set(group.major.id, group.major); });
    return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));
  }, [allGroups]);
  const years = useMemo(() => unique(allGroups.filter((group) => !majorId || group.majorId === majorId).map((group) => group.academicYear)).sort((a, b) => String(b).localeCompare(String(a), "vi", { numeric: true })), [allGroups, majorId]);


  const scopeOfferings = useMemo(() => offerings.filter((offering) => offeringGroups(offering).some((group) => (
    (!majorId || group.majorId === majorId)
    && (!academicYear || group.academicYear === academicYear)
  ))), [academicYear, majorId, offerings]);
  const weekSessionsFor = (id) => sessions.filter((session) => session.courseOfferingId === id && session.isScheduled !== false && session.status !== "not_held");

  const filteredOfferings = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return scopeOfferings.filter((offering) => {
      if (!keyword) return true;
      const subject = offering.subject || {};
      if (offering.name?.toLocaleLowerCase("vi").includes(keyword)) return true;
      const groupText = offeringGroups(offering).map((group) => `${group.code || ""} ${group.name || ""} ${group.major?.name || ""}`).join(" ");
      return `${subject.code || ""} ${subject.name || ""} ${groupText}`.toLocaleLowerCase("vi").includes(keyword);
    });
  }, [scopeOfferings, search]);

  const displaySessions = useMemo(() => sessions.filter((session) => session.courseOffering?.subject?.active !== false && offeringGroups(session.courseOffering).some((group) => (
      (!majorId || group.majorId === majorId)
      && (!academicYear || group.academicYear === academicYear)
    ))), [academicYear, majorId, sessions]);
  const availabilitySessions = sessions;
  useEffect(() => {
    if (!highlightedId || !filteredOfferings.some((offering) => offering.id === highlightedId)) return undefined;
    const element = offeringRefs.current[highlightedId];
    if (element?.scrollIntoView) element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const timer = window.setTimeout(() => setHighlightedId(""), 2200);
    return () => window.clearTimeout(timer);
  }, [filteredOfferings, highlightedId]);

  useEffect(() => {
    if (!requestedSessionId || !accessLoaded) return undefined;
    let active = true;
    axios.get(API_BASE_URL + "/scheduling/teaching-sessions/" + requestedSessionId).then(({ data }) => {
      if (!active) return;
      if (data.courseOfferingId !== requestedOfferingId) { setError("Buổi học không thuộc lớp học phần đã chọn."); return; }
      setComposer({ session: data, initialDate: data.sessionDate || getBusinessTodayKey(), initialPeriod: data.period || "" });
      if (data.sessionDate) setMonday(mondayOf(data.sessionDate));
    }).catch((e) => { if (active) setError(requestMessage(e, "Không tải được buổi học.")); });
    return () => { active = false; };
  }, [requestedSessionId, requestedOfferingId, accessLoaded]);

  const selectedOffering = offerings.find((offering) => offering.id === selectedId) || null;
  const selecting = Boolean(selectedOffering && accessLoaded && canManageScheduling);

  const selectOffering = (offering) => {
    setSelectedId(offering.id);
    setDetailOfferingId("");
    setGuidance("");

  };
  const openSlot = (sessionDate, period) => {

    if (!selecting) return;
    setGuidance("");
    setComposerError("");
    setComposer({ session: null, initialDate: sessionDate, initialPeriod: period });
  };
  const openSession = (session) => {
    setGuidance(""); setComposerError("");
    setPendingOpen(false);
    setUnresolvedOffering(null);
    setComposer({ session, initialDate: session.sessionDate || getBusinessTodayKey(), initialPeriod: session.period || "" });
  };

  const saveSession = async (values) => {
    setSaving(true);
    setComposerError("");
    try {
      if (composer?.session) {
        await axios.put(`${API_BASE_URL}/scheduling/teaching-sessions/${composer.session.id}`, values, { withCredentials: true });
        toast.success("Đã lưu thay đổi lịch.");
      } else {
        await axios.post(`${API_BASE_URL}/scheduling/teaching-sessions`, { courseOfferingId: selectedOffering.id, ...values }, { withCredentials: true });
        toast.success("Buổi học đã được tạo.");
      }
      setComposer(null);
      setMonday(mondayOf(values.sessionDate));
      await Promise.all([loadSessions(), loadOfferings(), loadPendingSessions()]);
    } catch (requestFailure) {
      setComposerError(conflictMessage(requestFailure, rooms, lecturers));
      if (requestFailure?.response?.status === 409 && requestFailure?.response?.data?.code === "ROOM_CONFLICT") await loadSessions();
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async () => {
    if (!composer?.session) return;
    setSaving(true);
    setComposerError("");
    try {
      await axios.delete(`${API_BASE_URL}/scheduling/teaching-sessions/${composer.session.id}`, { withCredentials: true });
      setComposer(null);
      toast.success("Đã xóa buổi học khỏi lịch.");
      await Promise.all([loadSessions(), loadOfferings(), loadPendingSessions()]);
    } catch (requestFailure) {
      setComposerError(requestMessage(requestFailure, "Không thể xóa buổi học."));
    } finally {
      setSaving(false);
    }
  };

  const confirmTeachingSession = async (targetSession, confirmationStatus, closeComposer = false) => {
    if (!targetSession) return;
    if (closeComposer) setSaving(true);
    setPendingSavingId(targetSession.id);
    setComposerError(""); setPendingError("");
    try {
      await axios.put(`${API_BASE_URL}/scheduling/teaching-sessions/${targetSession.id}/confirmation`, { status: confirmationStatus }, { withCredentials: true });
      if (closeComposer) setComposer(null);
      toast.success(confirmationStatus === "held" ? "Đã xác nhận buổi học đã diễn ra." : "Đã xác nhận buổi học không diễn ra.");
      await Promise.all([loadSessions(), loadOfferings(), loadPendingSessions()]);
    } catch (requestFailure) {
      const message = requestMessage(requestFailure, "Không thể xác nhận buổi học.");
      if (closeComposer) setComposerError(message);
      else setPendingError(message);
    } finally {
      if (closeComposer) setSaving(false);
      setPendingSavingId("");
    }
  };

  const confirmSession = (confirmationStatus) => confirmTeachingSession(composer?.session, confirmationStatus, true);

  const viewUnresolvedSessions = (offering) => {
    setUnresolvedSessions([]); setUnresolvedLoading(true); setUnresolvedError("");
    setUnresolvedOffering(offering);
    setDetailOfferingId("");
  };

  const viewOffering = (offering) => {
    setComposer(null);
    setDetailOfferingId(offering?.id || offering?.courseOfferingId || "");
  };

  const composerAvailabilityLoading = needsOffWeekAvailability && (offWeekAvailability.from !== composerWeekFrom || offWeekAvailability.loading);
  const composerCanEdit = canManageScheduling && (!needsOffWeekAvailability || (!composerAvailabilityLoading && !offWeekAvailability.error));
  const detailOffering = offerings.find((offering) => offering.id === detailOfferingId) || null;
  const selectedGroups = offeringGroups(selectedOffering);
  const selectedStrip = selectedOffering ? (
    <Box
      data-testid="selected-offering-strip"
      sx={{ minHeight: 68, display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto minmax(220px,1fr) minmax(210px,auto) auto" }, alignItems: "center", gap: 1.4, px: 1.5, py: 0.8, borderBottom: "1px solid #7EAFD1", bgcolor: "#E6F2F9" }}
    >
      <Typography variant="caption" sx={{ "&&": { pr: { md: 1.5 }, borderRight: { md: "1px solid #A4C6DC" }, color: "#075A9C", fontWeight: 700 } }}>{selecting ? "▣ ĐANG XẾP" : "CHỈ XEM"}</Typography>
      <Box><Typography variant="subtitle2" sx={{ "&&": { color: "#143D5B" } }}>{selectedOffering.name || selectedOffering.subject?.name}</Typography><Typography variant="caption">{selectedGroups.map((group) => `${group.code} · ${group.major?.name || "Chưa có ngành"}`).join("; ")}</Typography></Box>
      <Box sx={{ pl: { md: 1.5 }, borderLeft: { md: "1px solid #AECDDB" } }}><Typography variant="caption" color="text.secondary">BƯỚC TIẾP THEO</Typography><Typography variant="caption" sx={{ "&&": { display: "block", color: "#234B66", fontWeight: 700 } }}>{selecting ? "Chọn ngày trên lịch để nhập buổi học." : "Lớp học phần đang ở chế độ chỉ xem."}</Typography></Box>
      <Stack direction="row" spacing={0.5}>
        {selecting && <Button size="small" variant="contained" onClick={() => openSlot(weekFrom < getBusinessTodayKey() ? getBusinessTodayKey() : weekFrom, "")}>Thêm buổi</Button>}
        <Button size="small" variant="outlined" onClick={() => setDetailOfferingId(selectedOffering.id)}>Chi tiết</Button>
        <Button size="small" variant="outlined" onClick={() => setSelectedId("")}>Bỏ chọn</Button>
      </Stack>
    </Box>
  ) : null;

  return (
    <FeatureLayout title="Xếp lịch" group="Đào tạo Thạc sĩ" desc="Chọn lớp học phần và xếp buổi học theo thời gian thực." hideHeader workspaceMode>
      <Box
        data-testid="schedule-workspace"
        data-scheduling-typography="compact"
        sx={{ ...schedulingTypographySx, height: { lg: "100%" }, minHeight: { xs: 650, lg: 0 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(330px, 30%) minmax(0, 70%)" }, gap: "1px", bgcolor: "#C3CED6", border: "1px solid #C5D0D8", overflow: { lg: "hidden" } }}
      >
        <Box component="aside" sx={{ minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "#FFFFFF", borderRight: { lg: "1px solid #C5D0D8" } }}>
          <Box sx={{ flex: "none", p: 1.3, borderBottom: "1px solid #D5DEE4", bgcolor: "#FFFFFF" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ "&&": { color: "#566875", ...schedulingType.eyebrow } }}>PHẠM VI LÀM VIỆC</Typography>
              <Button size="small" component={Link} to="/masters/course-offerings" startIcon={<AddRounded />}>Tạo mới</Button>
            </Stack>
            <Typography component="label" variant="caption" sx={{ "&&": { display: "block", mt: 0.6, mb: 0.3, color: "#5C6E7A", fontSize: 11.5, fontWeight: 600 } }}>Chuyên ngành</Typography>
            <FormControl size="small" fullWidth><Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} displayEmpty renderValue={(value) => value ? majors.find((major) => major.id === value)?.name : "Tất cả chuyên ngành"} inputProps={{ "aria-label": "Chuyên ngành" }} value={majorId} onChange={(event) => { setMajorId(event.target.value); setAcademicYear(""); }}><MenuItem value="">Tất cả chuyên ngành</MenuItem>{majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.code} · {major.name}</MenuItem>)}</Select></FormControl>
            <Stack direction="row" spacing={0.65} sx={{ mt: 0.65 }}>
              <Box sx={{ flex: 1 }}><Typography component="label" variant="caption" sx={{ "&&": { display: "block", mb: 0.3, color: "#5C6E7A", fontSize: 11.5, fontWeight: 600 } }}>Khóa / Năm</Typography><FormControl size="small" fullWidth><Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} displayEmpty renderValue={(value) => value || "Tất cả"} inputProps={{ "aria-label": "Khóa / Năm" }} value={academicYear} onChange={(event) => { setAcademicYear(event.target.value); }}><MenuItem value="">Tất cả</MenuItem>{years.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}</Select></FormControl></Box>
            </Stack>
            {accessLoaded && !canManageScheduling && <Box sx={{ mt: 0.65, px: 0.8, py: 0.65, borderLeft: "3px solid #7E9EB3", bgcolor: "#EEF4F7", color: "#526875", fontSize: 11 }}>Quyền chỉ xem · Không thể tạo hoặc sửa lịch.</Box>}
            {error && <Alert severity="error" sx={{ mt: 0.65, py: 0 }}>{error}</Alert>}
          </Box>

          <Box sx={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column", p: 1.1, bgcolor: "#F1F4F6", overflow: "hidden" }}>
            <Stack direction="row" spacing={0.6} sx={{ mb: 0.75 }}>
              <TextField size="small" fullWidth placeholder="Tìm môn / lớp..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ bgcolor: "#FFFFFF", "&& .MuiOutlinedInput-root": { height: 32 } }} />
              <Button aria-label="Tải lại danh sách và lịch" variant="outlined" onClick={() => { loadOfferings(); loadSessions(); }} sx={{ "&&": { minWidth: 38, px: 0 } }}><RefreshRounded fontSize="small" /></Button>
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.65 }}><Typography variant="caption" sx={{ "&&": { color: "#4E626F", fontWeight: 700 } }}>LỚP HỌC PHẦN</Typography><Chip size="small" label={filteredOfferings.length} sx={{ height: 19 }} /></Stack>
            <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", pr: 0.25 }}>
              {loading ? <Box role="status" sx={{ height: 180, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box>
                : filteredOfferings.length === 0 ? <Box sx={{ p: 2, border: "1px dashed #B8C5CE", bgcolor: "#FFFFFF", textAlign: "center" }}><Typography variant="caption" color="text.secondary">Chưa có lớp học phần phù hợp.</Typography></Box>
                  : <Stack spacing={0.7}>{filteredOfferings.map((offering) => {
                    const groups = offeringGroups(offering);
                    const weekSessions = weekSessionsFor(offering.id);
                    const upcomingThisWeek = weekSessions.filter((session) => session.status === "planned" && !isSessionPast(session)).length;
                    const selected = offering.id === selectedId;
                    const highlighted = offering.id === highlightedId;
                    return (
                      <Box
                        key={offering.id}
                        ref={(element) => { offeringRefs.current[offering.id] = element; }}
                        component="article"
                        role="button"
                        tabIndex={0}
                        className="schedule-offering-card"
                        data-offering-id={offering.id}
                        data-selected={selected ? "true" : "false"}
                        data-new-offering={highlighted ? "true" : "false"}
                        onClick={() => setDetailOfferingId(offering.id)}
                        onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setDetailOfferingId(offering.id); } }}
                        sx={{ p: 1, border: "1px solid", borderColor: selected ? "#3D86BA" : "#C6D1D9", borderLeft: `3px solid ${selected ? "#075A9C" : "#7E9EB3"}`, bgcolor: highlighted ? "#E8F6FC" : (selected ? "#EFF7FB" : "#FFFFFF"), boxShadow: highlighted ? "inset 0 0 0 2px #5FA6D0" : "none", cursor: "pointer", transition: "background-color 180ms, border-color 180ms, box-shadow 180ms", "&:hover": { bgcolor: selected ? "#E8F4FA" : "#F8FAFB", borderColor: "#7EAAC7" } }}
                      >
                        <Typography component="h2" className="schedule-offering-name">{offering.name || offering.subject?.name}</Typography>
                        <Typography className="schedule-offering-subject">{offering.subject?.name}</Typography>
                        <Typography className="schedule-offering-members">{groups.length} lớp/nhóm · {offering.participantCount ?? 0} HV</Typography>
                        <Box className="schedule-offering-footer">
                          <Typography className="schedule-offering-held">Đã diễn ra {Number(offering.sessionSummary?.heldCount || 0)} buổi</Typography>
                          <Typography className="schedule-offering-week" data-has-week={weekSessions.length > 0}>{upcomingThisWeek > 0 ? "Có " + upcomingThisWeek + " lịch sắp tới" : weekSessions.length > 0 ? "Có lịch tuần này" : "Chưa có lịch tuần này"}</Typography>
                          {canManageScheduling && <Button variant="contained" onClick={(event) => { event.stopPropagation(); selectOffering(offering); }}>Xếp lịch</Button>}
                        </Box>
                      </Box>
                    );
                  })}</Stack>}
            </Box>
          </Box>
        </Box>

        <Box component="section" sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", bgcolor: "#EDF2F5", overflow: "hidden" }}>
          {guidance && <Alert severity="warning" onClose={() => setGuidance("")} sx={{ m: 0.75 }}>{guidance}</Alert>}
          <WeeklyCalendar
            monday={monday} sessions={displaySessions} loading={sessionsLoading} error={sessionsError}
            selection={selectedStrip} selecting={selecting} pendingCount={pendingSessions.length}
            onPrevious={() => setMonday((value) => addDays(value, -7))} onToday={() => setMonday(mondayOf(getBusinessTodayKey()))} onNext={() => setMonday((value) => addDays(value, 7))}
            onOpenPending={() => { setPendingError(""); setPendingOpen(true); }} onSlotClick={openSlot} onSessionClick={openSession}
          />
        </Box>
      </Box>

      <SessionComposer
        open={Boolean(composer)} offering={offerings.find((offering) => offering.id === composer?.session?.courseOfferingId) || selectedOffering} session={composer?.session || null} initialDate={composer?.initialDate || ""} initialPeriod={composer?.initialPeriod || ""}
        lecturers={lecturers} rooms={rooms} sessions={needsOffWeekAvailability ? offWeekAvailability.sessions : availabilitySessions} canEdit={composerCanEdit} weekFrom={composerWeekFrom} weekTo={composerWeekTo}
        onDateChange={(date) => setComposer((current) => ({ ...current, availabilityDate: date }))} availabilityLoading={composerAvailabilityLoading} saving={saving} serverError={composerError || (needsOffWeekAvailability ? offWeekAvailability.error : "")} onClose={() => { if (!saving) setComposer(null); }} onSubmit={saveSession} onDelete={deleteSession} onConfirm={confirmSession} onViewOffering={viewOffering}
      />
      <PendingSessionsDrawer
        open={pendingOpen} sessions={pendingSessions} savingId={pendingSavingId} error={pendingError}
        onClose={() => { if (!pendingSavingId) setPendingOpen(false); }}
        onConfirm={(session, confirmationStatus) => confirmTeachingSession(session, confirmationStatus)}
      />
      <CourseOfferingDrawer
        open={Boolean(detailOffering)} offering={detailOffering} canManage={canManageScheduling} saving={saving}
        onChanged={loadOfferings} onClose={() => setDetailOfferingId("")} onSchedule={selectOffering} onScheduleSession={(session) => { setDetailOfferingId(""); openSession(session); }} onViewUnresolved={viewUnresolvedSessions}
      />
      <UnresolvedSessionsDrawer
        open={Boolean(unresolvedOffering)} offering={unresolvedOffering} sessions={unresolvedSessions} loading={unresolvedLoading} error={unresolvedError}
        onClose={() => setUnresolvedOffering(null)} onOpenSession={openSession}
      />
      <ToastContainer position="top-center" autoClose={2400} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover draggable={false} limit={2} />
    </FeatureLayout>
  );
};

export default Schedule;
