import React, { useEffect, useState } from "react";
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
import {
  CheckCircle,
  Face,
  FileDownload,
  MeetingRoom,
  Person,
  QrCodeScanner,
  Refresh,
  Schedule,
  Warning,
} from "@mui/icons-material";
import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import { listSessionAttendance, listSessionReviews } from "./attendanceApi";
import AttendanceKiosk from "./AttendanceKiosk";
import AttendanceEnrollDialog from "./AttendanceEnrollDialog";
import AttendanceReviewDialog from "./AttendanceReviewDialog";

export default function AttendanceSession({ sessionId, onBack }) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [error, setError] = useState(null);

  // Dialogs
  const [kioskOpen, setKioskOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState(null);

  const loadSessionData = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // Nạp thông tin buổi học và danh sách điểm danh
      const [attRes, revRes] = await Promise.all([
        listSessionAttendance(sessionId).catch(() => []),
        listSessionReviews(sessionId, "PENDING").catch(() => []),
      ]);
      setAttendanceRecords(Array.isArray(attRes) ? attRes : []);
      setPendingReviews(Array.isArray(revRes) ? revRes : []);

      // Lấy thông tin chi tiết buổi học qua API scheduling có sẵn
      try {
        const { data: sessData } = await axios.get(
          `${API_BASE_URL}/scheduling/sessions/${sessionId}`,
          { withCredentials: true }
        );
        setSession(sessData);

        // Lấy roster của lớp học phần
        if (sessData?.courseOfferingId) {
          const { data: rosterData } = await axios.get(
            `${API_BASE_URL}/scheduling/offerings/${sessData.courseOfferingId}/roster`,
            { withCredentials: true }
          );
          setRoster(rosterData?.participants || []);
        }
      } catch {
        // Fallback tối thiểu nếu không lấy được scheduling session
        setSession({ id: sessionId, sessionDate: "Hôm nay", startTime: "08:00" });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Lỗi tải dữ liệu điểm danh");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  // Xuất CSV báo cáo điểm danh
  const handleExportCsv = () => {
    if (!attendanceRecords.length && !roster.length) return;
    const rows = [
      ["Mã học viên", "Họ và tên", "Trạng thái", "Nguồn", "Độ tin cậy", "Thời gian ghi nhận", "Ghi chú"],
    ];

    const attMap = new Map(attendanceRecords.map((r) => [r.participantId, r]));
    const allParticipants = roster.length > 0 ? roster : attendanceRecords.map(r => ({ id: r.participantId, fullName: r.displayName }));

    allParticipants.forEach((p) => {
      const att = attMap.get(p.id);
      rows.push([
        p.code || p.id,
        p.fullName || att?.displayName || "N/A",
        att ? (att.status === "PRESENT" ? "Có mặt" : att.status === "LATE" ? "Đi muộn" : att.status) : "Vắng mặt",
        att?.source || "CHƯA ĐIỂM DANH",
        att?.confidence ? `${(Number(att.confidence) * 100).toFixed(1)}%` : "",
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
  };

  // Tính thống kê
  const totalRoster = roster.length || attendanceRecords.length;
  const presentCount = attendanceRecords.filter((r) => r.status === "PRESENT").length;
  const lateCount = attendanceRecords.filter((r) => r.status === "LATE").length;
  const pendingCount = pendingReviews.length;

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
              Điểm Danh Buổi Học
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5 }}>
            <span>
              <Schedule sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              {session?.sessionDate} ({session?.startTime} - {session?.endTime || "..."})
            </span>
            <span>
              <MeetingRoom sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              Phòng: {session?.room || "Chưa xếp phòng"}
            </span>
            <span>
              <Person sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.5 }} />
              Giảng viên: {session?.lecturer || "Chưa phân công"}
            </span>
          </Typography>
        </Box>

        {/* Nút tác vụ chính */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title="Tải lại">
            <IconButton onClick={loadSessionData} disabled={loading}>
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
          >
            Duyệt ca ({pendingCount})
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<QrCodeScanner />}
            onClick={() => setKioskOpen(true)}
          >
            Mở Kiosk Quét Mặt
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

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
                <TableCell align="right">Sinh trắc học</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const attMap = new Map(attendanceRecords.map((r) => [r.participantId, r]));
                const displayList = roster.length > 0 ? roster : attendanceRecords.map(r => ({ id: r.participantId, fullName: r.displayName }));

                if (displayList.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Chưa có dữ liệu danh sách học viên trong buổi học này.
                      </TableCell>
                    </TableRow>
                  );
                }

                return displayList.map((participant) => {
                  const att = attMap.get(participant.id);
                  return (
                    <TableRow key={participant.id} hover>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        {participant.fullName || att?.displayName || "N/A"}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 13, fontFamily: "monospace" }}>
                        {participant.code || participant.id}
                      </TableCell>
                      <TableCell>
                        {att ? (
                          <Chip
                            label={att.status === "PRESENT" ? "Có mặt" : att.status === "LATE" ? "Đi muộn" : att.status}
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
                        ) : att?.source === "MANUAL" ? (
                          <Chip label="Thủ công" size="small" variant="outlined" />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {att?.confidence ? `${(Number(att.confidence) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                        {att?.recordedAt ? new Date(att.recordedAt).toLocaleTimeString("vi-VN") : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Face />}
                          onClick={() => setEnrollTarget(participant)}
                        >
                          Đăng ký mẫu
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Kiosk Dialog */}
      {kioskOpen && (
        <AttendanceKiosk
          session={session}
          onClose={() => {
            setKioskOpen(false);
            loadSessionData();
          }}
          onAttendanceRecorded={loadSessionData}
        />
      )}

      {/* Enroll Dialog */}
      {enrollTarget && (
        <AttendanceEnrollDialog
          participant={enrollTarget}
          open={Boolean(enrollTarget)}
          onClose={() => setEnrollTarget(null)}
        />
      )}

      {/* Review Dialog */}
      {reviewOpen && (
        <AttendanceReviewDialog
          session={session}
          roster={roster}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onReviewResolved={loadSessionData}
        />
      )}
    </Box>
  );
}
