import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { API_BASE_URL } from "../../config/http";
import { vietnameseDate } from "../../utils/schedulingCalendar";

export default function CourseOfferingSessions({ offering, onSchedule }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const id = offering?.id;
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(API_BASE_URL + "/scheduling/course-offerings/" + id + "/sessions");
      if (!Array.isArray(data)) throw new Error("Invalid sessions response");
      setSessions(data.filter((s) => s.isScheduled !== false && s.sessionDate));
    } catch (e) { setError(e.response?.data?.message || "Không tải được các buổi học."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { setSessions([]); load(); }, [load]);
  return <Box sx={{ mt: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="subtitle2">Các buổi đã xếp · {sessions.length} buổi</Typography>
      <Button onClick={load} disabled={loading}>Tải lại</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <Typography role="status">Đang tải buổi học...</Typography> : <TableContainer sx={{ maxHeight: 350 }}>
      <Table size="small" stickyHeader><TableHead><TableRow>{["STT", "Ngày / Buổi", "Phòng", "Giảng viên", "Thao tác"].map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
        {sessions.map((s, i) => <TableRow key={s.id}><TableCell>{String(i + 1).padStart(2, "0")}</TableCell>
          <TableCell>{vietnameseDate(s.sessionDate)} · {s.period === "MORNING" ? "Sáng" : "Chiều"}</TableCell>
          <TableCell>{s.room?.code || "—"}</TableCell><TableCell>{s.lecturer?.name || "—"}</TableCell>
          <TableCell>{onSchedule && <Button onClick={() => onSchedule(s)}>Xem lịch</Button>}</TableCell></TableRow>)}
        {!sessions.length && <TableRow><TableCell colSpan={5}>Chưa có buổi học. Chọn ngày và Sáng/Chiều trên lịch để thêm buổi.</TableCell></TableRow>}
      </TableBody></Table>
    </TableContainer>}
  </Box>;
}
