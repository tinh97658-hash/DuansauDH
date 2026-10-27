import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowForward, Event, MeetingRoom, Schedule } from "@mui/icons-material";
import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import AttendanceSession from "../../features/attendance/AttendanceSession";

export default function AttendancePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (sessionId) return; // Nếu đã có sessionId cụ thể thì không cần nạp danh sách buổi

    let active = true;
    setLoading(true);
    setError(null);

    // Lấy danh sách buổi học
    axios
      .get(`${API_BASE_URL}/scheduling/teaching-sessions`, {
        params: { from: filterDate, to: filterDate },
        withCredentials: true,
      })
      .then(({ data }) => {
        if (!active) return;
        setSessions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.data?.message || err.message || "Lỗi tải lịch buổi học");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId, filterDate]);

  // Nếu URL có sessionId, hiển thị chi tiết điểm danh buổi đó
  if (sessionId) {
    return <AttendanceSession sessionId={sessionId} onBack={() => navigate("/masters/attendance")} />;
  }

  // Nếu chưa chọn buổi, hiển thị danh mục các buổi học để chọn
  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Quản Lý Điểm Danh Buổi Học
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chọn buổi học cần điểm danh, mở kiosk camera hoặc duyệt các trường hợp nhận diện.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            type="date"
            label="Ngày học"
            size="small"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer component={Paper} elevation={1}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : sessions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Event sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              Không tìm thấy buổi học nào trong ngày {filterDate}.
            </Typography>
          </Box>
        ) : (
          <Table size="medium">
            <TableHead sx={{ bgcolor: "#f5f5f5" }}>
              <TableRow>
                <TableCell>Ngày học</TableCell>
                <TableCell>Thời gian</TableCell>
                <TableCell>Lớp học phần</TableCell>
                <TableCell>Phòng học</TableCell>
                <TableCell>Giảng viên</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: "bold" }}>{item.sessionDate}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Schedule sx={{ fontSize: 16, color: "text.secondary" }} />
                      {item.period === "MORNING"
                        ? "Sáng (07:30 - 11:30)"
                        : item.period === "AFTERNOON"
                        ? "Chiều (13:30 - 17:00)"
                        : (item.startTime ? `${item.startTime} - ${item.endTime || "..."}` : "Trong ngày")}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "500" }}>
                    {item.courseOffering?.name || item.courseOfferingName || item.courseOffering?.subject?.name || item.courseOfferingId?.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <MeetingRoom sx={{ fontSize: 16, color: "text.secondary" }} />
                      {typeof item.room === "object" ? (item.room?.code || item.room?.name || "Chưa xếp") : (item.room || "Chưa xếp")}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {typeof item.lecturer === "object" ? (item.lecturer?.name || item.lecturer?.fullName || "Chưa phân công") : (item.lecturer || "Chưa phân công")}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status === "held" ? "Đã diễn ra" : item.status === "planned" ? "Kế hoạch" : "Hủy"}
                      size="small"
                      color={item.status === "held" ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={() => navigate(`/masters/attendance/${item.id}`)}
                    >
                      Điểm danh
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
}
