import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import DeleteForever from "@mui/icons-material/DeleteForever";
import Face from "@mui/icons-material/Face";
import FileDownload from "@mui/icons-material/FileDownload";
import MeetingRoom from "@mui/icons-material/MeetingRoom";
import Person from "@mui/icons-material/Person";
import QrCodeScanner from "@mui/icons-material/QrCodeScanner";
import Refresh from "@mui/icons-material/Refresh";
import Schedule from "@mui/icons-material/Schedule";
import Warning from "@mui/icons-material/Warning";
import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import { closeAttendanceSession, getAttendanceWorkflow, openAttendanceSession, listSessionAttendance, listSessionEnrollments, listSessionReviews, withdrawParticipantEnrollment } from "./attendanceApi";
import AttendanceKiosk from "./AttendanceKiosk";
import AttendanceEnrollDialog from "./AttendanceEnrollDialog";
import AttendanceReviewDialog from "./AttendanceReviewDialog";
import { courseLabel, errorMessage, participantId, roomLabel, sessionTime } from "./attendanceDisplay";
import { usePermissions } from "../accounts/usePermissions";

export default function AttendanceSession({ sessionId, onBack }) {
  const { can, access } = usePermissions();
  const canRecord = can("attendance.record") && !access?.groupScope?.readOnly;
  const canEnroll = can("attendance.enroll") && !access?.groupScope?.readOnly;
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [enrollmentByParticipant, setEnrollmentByParticipant] = useState({});
  const [enrollmentStatusAvailable, setEnrollmentStatusAvailable] = useState(true);
  const [enrollmentBusyId, setEnrollmentBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);

  // Dialogs
  const [kioskOpen, setKioskOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const loadVersion = useRef(0);

  const loadSessionData = useCallback(async (quiet = false) => {
    if (!sessionId) return;
    const version = ++loadVersion.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      // Nạp thông tin buổi học và danh sách điểm danh
      const enrollmentRequest = listSessionEnrollments(sessionId)
        .then((data) => ({ ok: true, data }))
        .catch(() => ({ ok: false, data: null }));
      const [attRes, revRes, { data: sessData }, workflowData, enrollmentResult] = await Promise.all([
        listSessionAttendance(sessionId),
        listSessionReviews(sessionId, "PENDING"),
        axios.get(`${API_BASE_URL}/scheduling/teaching-sessions/${sessionId}`, { withCredentials: true }),
        getAttendanceWorkflow(sessionId),
        enrollmentRequest,
      ]);
      const courseOfferingId = sessData?.courseOfferingId || sessData?.courseOffering?.id;
      const rosterData = courseOfferingId
        ? (await axios.get(`${API_BASE_URL}/scheduling/course-offerings/${courseOfferingId}/roster`, { withCredentials: true })).data
        : { participants: [] };
      if (version !== loadVersion.current) return;
      setAttendanceRecords(Array.isArray(attRes) ? attRes : []);
      setPendingReviews(Array.isArray(revRes) ? revRes : []);
      setSession(sessData);
      setWorkflow(workflowData);
      setRoster(Array.isArray(rosterData?.participants) ? rosterData.participants : []);
      setEnrollmentStatusAvailable(enrollmentResult.ok);
      setEnrollmentByParticipant(
        Object.fromEntries(
          (enrollmentResult.data?.enrollments ?? []).map((item) => [item.participantId, item]),
        ),
      );
    } catch (err) {
      if (version === loadVersion.current) setError(errorMessage(err, "Lỗi tải dữ liệu điểm danh"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [sessionId]);

  const refreshAttendance = useCallback(() => loadSessionData(true), [loadSessionData]);

  useEffect(() => {
    setSession(null);
    setWorkflow(null);
    setRoster([]);
    setAttendanceRecords([]);
    setPendingReviews([]);
    setEnrollmentByParticipant({});
    setEnrollmentStatusAvailable(true);
    setEnrollmentBusyId(null);
    setNotice(null);
    setKioskOpen(false);
    setReviewOpen(false);
    setEnrollTarget(null);
    loadSessionData();
    return () => { ++loadVersion.current; };
  }, [loadSessionData]);

  const handleEnrollDialogClose = () => {
    setEnrollTarget(null);
    loadSessionData(true);
  };

  const handleWithdrawEnrollment = async (participant) => {
    const id = participantId(participant);
    if (!id || enrollmentBusyId) return;
    const name = participant.fullName || id;
    if (!window.confirm(`Thu hồi toàn bộ mẫu khuôn mặt của ${name}? Học viên sẽ phải đăng ký lại để điểm danh bằng khuôn mặt.`)) return;

    setEnrollmentBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const result = await withdrawParticipantEnrollment(id);
      setNotice(`Đã thu hồi ${result.templates_deleted ?? 0} mẫu khuôn mặt của ${name}.`);
      await loadSessionData(true);
    } catch (err) {
      setError(errorMessage(err, "Lỗi thu hồi mẫu khuôn mặt"));
    } finally {
      setEnrollmentBusyId(null);
    }
  };

  const changeWorkflow = async (action) => {
    if (workflowBusy) return;
    if (action === "close" && !window.confirm("Chốt điểm danh sẽ ghi vắng cho học viên chưa điểm danh và khóa kết quả buổi học. Bạn có muốn chốt?")) return;
    setWorkflowBusy(true); setError(null);
    try {
      if (action === "open") await openAttendanceSession(sessionId); else await closeAttendanceSession(sessionId);
      await loadSessionData();
    } catch (err) { setError(errorMessage(err)); }
    finally { setWorkflowBusy(false); }
  };

  // Xuất CSV báo cáo điểm danh
  const handleExportCsv = () => {
    if (!attendanceRecords.length && !roster.length) return;
    const rows = [
      ["Mã học viên", "Họ và tên", "Trạng thái", "Nguồn", "Độ tin cậy", "Thời gian ghi nhận", "Ghi chú"],
    ];

    const attMap = new Map(attendanceRecords.map((r) => [r.participantId, r]));
    const allParticipants = roster.length > 0 ? roster : attendanceRecords.map(r => ({ id: r.participantId, fullName: r.displayName }));

    allParticipants.forEach((p) => {
      const att = attMap.get(participantId(p));
      rows.push([
        p.code || p.studentCode || participantId(p),
        p.fullName || att?.displayName || "N/A",
        att ? (att.status === "PRESENT" ? "Có mặt" : att.status === "LATE" ? "Đi muộn" : att.status) : "Chưa điểm danh",
        att?.source || "CHƯA ĐIỂM DANH",
        att?.confidence != null ? `${(Number(att.confidence) * 100).toFixed(1)}%` : "",
        att?.recordedAt ? new Date(att.recordedAt).toLocaleString("vi-VN") : "",
        att?.note || "",
      ]);
    });

    const csvContent = "\uFEFF" + rows.map((e) => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `diem-danh-${session?.sessionDate || sessionId}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Tính thống kê
  const totalRoster = roster.length || attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === "PRESENT").length;
  const lateCount = attendanceRecords.filter((r) => r.status === "LATE").length;
  const pendingCount = pendingReviews.length;
  const enrolledCount = Object.values(enrollmentByParticipant).filter((item) => item.enrolled).length;

  if (kioskOpen && session) {
    return <AttendanceKiosk
      session={{ ...session, attendanceState: workflow?.state }}
      onClose={() => { setKioskOpen(false); loadSessionData(); }}
      onAttendanceRecorded={refreshAttendance}
    />;
  }

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header Buổi học */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {onBack && (
              <Button size="small" onClick={onBack}>
                ← Quay lại
              </Button>
            )}
            <Typography variant="h5" fontWeight="bold">
              {courseLabel(session)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5 }}>
            <span>
              <Schedule sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              {session?.sessionDate} (
                {sessionTime(session)}
              )
            </span>
            <span>
              <MeetingRoom sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              Phòng: {roomLabel(session?.room)}
            </span>
            <span>
              <Person sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              Giảng viên: {typeof session?.lecturer === "object" ? (session?.lecturer?.fullName || session?.lecturer?.name || "Chưa phân công") : (session?.lecturer || "Chưa phân công")}
            </span>
          </Typography>
        </Box>

        {/* Nút tác vụ chính */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title="Tải lại">
            <IconButton onClick={() => loadSessionData()} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExportCsv}
          >
            Xuất CSV
          </Button>

          <Button
            variant="outlined"
            color="warning"
            startIcon={
              <Badge badgeContent={pendingCount} color="error">
                <Warning />
              </Badge>
            }
            onClick={() => setReviewOpen(true)}
            disabled={!session || session.id !== sessionId || loading}
          >
            Duyệt ca ({pendingCount})
          </Button>

          <Button
            variant="contained"
            color={workflow?.state === "OPEN" ? "warning" : "success"}
            disabled={!canRecord || !session || !workflow || loading || workflowBusy || session.status === "not_held" || workflow.state === "CLOSED" || (workflow.state === "NOT_OPEN" && !workflow.withinWindow)}
            onClick={() => changeWorkflow(workflow?.state === "OPEN" ? "close" : "open")}
          >
            {workflowBusy ? "Đang xử lý…" : workflow?.state === "OPEN" ? "Chốt điểm danh" : workflow?.state === "CLOSED" ? "Đã chốt điểm danh" : "Mở điểm danh"}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<QrCodeScanner />}
            onClick={() => setKioskOpen(true)}
            disabled={!canRecord || !session || session.id !== sessionId || loading || Boolean(error) || session.status === "not_held" || workflow?.state !== "OPEN" || !workflow?.withinWindow}
          >
            Mở Kiosk Quét Mặt
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {workflow && <Alert severity={workflow.state === "OPEN" && workflow.withinWindow ? "success" : "info"}>
        {workflow.state === "CLOSED" ? "Buổi điểm danh đã chốt. Kết quả được khóa; học viên chưa điểm danh đã được ghi vắng." : workflow.state === "OPEN" ? workflow.withinWindow ? "Đang mở điểm danh. Học viên có thể quét đến hết giờ học." : "Đã hết giờ quét. Hãy xử lý ca chờ duyệt và chốt điểm danh." : "Chưa mở điểm danh. Cán bộ có thể mở từ 30 phút trước giờ học đến hết buổi. Chưa xác định vắng trước khi chốt."}
      </Alert>}

      {/* Thẻ Thống kê */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: "#f5f5f5" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">
                SĨ SỐ LỚP
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {totalRoster}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: "#e8f5e9" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="success.dark">
                CÓ MẶT (ĐÚNG GIỜ)
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.dark">
                {presentCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: "#fff3e0" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="warning.dark">
                ĐI MUỘN
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.dark">
                {lateCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: pendingCount > 0 ? "#ffebee" : "#fafafa" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color={pendingCount > 0 ? "error.main" : "text.secondary"}>
                CHỜ DUYỆT (REVIEW)
              </Typography>
              <Typography variant="h5" fontWeight="bold" color={pendingCount > 0 ? "error.main" : "inherit"}>
                {pendingCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bảng Danh sách Học viên & Điểm danh */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Danh sách học viên
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kiểm tra trạng thái khuôn mặt, đăng ký mới hoặc cập nhật mẫu đã có.
          </Typography>
        </Box>
        <Chip
          size="small"
          color={!enrollmentStatusAvailable ? "default" : totalRoster > 0 && enrolledCount === totalRoster ? "success" : "warning"}
          label={
            !enrollmentStatusAvailable
              ? "Không tải được trạng thái khuôn mặt"
              : totalRoster === 0
                ? "Chưa có học viên"
                : `${enrolledCount}/${totalRoster} học viên đã có khuôn mặt`
          }
        />
      </Box>
      <TableContainer component={Paper} elevation={1}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="medium">
            <TableHead sx={{ bgcolor: "#f5f5f5" }}>
              <TableRow>
                <TableCell>Học viên</TableCell>
                <TableCell>Mã định danh</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Nguồn điểm danh</TableCell>
                <TableCell>Độ tin cậy</TableCell>
                <TableCell>Thời gian ghi nhận</TableCell>
                <TableCell>Khuôn mặt</TableCell>
                <TableCell align="right">Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const attMap = new Map(attendanceRecords.map((r) => [r.participantId, r]));
                const displayList = roster.length > 0 ? roster : attendanceRecords.map(r => ({ id: r.participantId, fullName: r.displayName }));

                if (displayList.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Chưa có dữ liệu danh sách học viên trong buổi học này.
                      </TableCell>
                    </TableRow>
                  );
                }

                return displayList.map((participant, index) => {
                  const pId = participantId(participant) || `p-${index}`;
                  const att = attMap.get(pId) || attMap.get(participant.id);
                  const enrollment = enrollmentByParticipant[pId];
                  return (
                    <TableRow key={pId} hover>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        {participant.fullName || att?.displayName || "N/A"}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 13, fontFamily: "monospace" }}>
                        {participant.code || participant.studentCode || pId}
                      </TableCell>
                      <TableCell>
                        {att ? (
                          <Chip
                            label={att.status === "PRESENT" ? "Có mặt" : att.status === "LATE" ? "Đi muộn" : att.status === "ABSENT" ? "Vắng mặt" : att.status}
                            color={att.status === "PRESENT" ? "success" : att.status === "LATE" ? "warning" : "default"}
                            size="small"
                          />
                        ) : (
                          <Chip label="Chưa điểm danh" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        {att?.source === "FACE" ? (
                          <Chip label="Khuôn mặt (AI)" size="small" color="primary" variant="outlined" />
                        ) : att?.source === "REVIEW" ? (
                          <Chip label="Duyệt ca" size="small" color="warning" variant="outlined" />
                        ) : att?.source === "SYSTEM" ? (
                          <Chip label="Chốt buổi" size="small" variant="outlined" />
                        ) : att?.source === "MANUAL" ? (
                          <Chip label="Thủ công" size="small" variant="outlined" />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {att?.confidence != null ? `${(Number(att.confidence) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                        {att?.recordedAt ? new Date(att.recordedAt).toLocaleTimeString("vi-VN") : "—"}
                      </TableCell>
                      <TableCell>
                        {!enrollmentStatusAvailable ? (
                          <Chip label="Không tải được" size="small" variant="outlined" />
                        ) : !enrollment ? (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        ) : enrollment.enrolled ? (
                          <Tooltip title={enrollment.createdAt ? `Đăng ký lúc ${new Date(enrollment.createdAt).toLocaleString("vi-VN")}` : ""}>
                            <Chip label={`Đã có ${enrollment.templateCount} mẫu`} color="success" size="small" />
                          </Tooltip>
                        ) : enrollment.exists ? (
                          <Tooltip title="Mẫu cũ đã bị thu hồi; học viên cần đăng ký lại.">
                            <Chip label="Đã thu hồi" size="small" variant="outlined" />
                          </Tooltip>
                        ) : (
                          <Chip label="Chưa đăng ký" color="warning" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {canEnroll ? (
                          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Face />}
                              onClick={() => setEnrollTarget(participant)}
                            >
                              {enrollment?.enrolled ? "Cập nhật" : "Đăng ký"}
                            </Button>
                            {enrollment?.enrolled && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteForever />}
                                onClick={() => handleWithdrawEnrollment(participant)}
                                disabled={enrollmentBusyId === pId}
                              >
                                {enrollmentBusyId === pId ? "Đang thu hồi…" : "Thu hồi"}
                              </Button>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Enroll Dialog */}
      {enrollTarget && (
        <AttendanceEnrollDialog
          participant={enrollTarget}
          open={Boolean(enrollTarget)}
          onClose={handleEnrollDialogClose}
        />
      )}

      {/* Review Dialog */}
      {reviewOpen && (
        <AttendanceReviewDialog
          session={session}
          roster={roster}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onReviewResolved={refreshAttendance}
        />
      )}
    </Box>
  );
}
