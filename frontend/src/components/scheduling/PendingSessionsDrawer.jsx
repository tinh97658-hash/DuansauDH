import React from "react";
import { Box, Button, Drawer, IconButton, Paper, Typography } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";
import { vietnameseDate } from "../../utils/schedulingCalendar";
import "./schedulingReferences.css";

const PendingSessionsDrawer = ({ open, sessions, savingId, error, onClose, onConfirm }) => {
  const ordered = [...sessions].sort((a, b) => (b.sessionDate + (b.period === "AFTERNOON" ? "1" : "0")).localeCompare(a.sessionDate + (a.period === "AFTERNOON" ? "1" : "0")) || String(b.id).localeCompare(String(a.id)));
  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ className: "schedule-reference schedule-pending-drawer", sx: { width: "min(910px, 100vw)" } }}>
    <Box className="schedule-drawer-heading">
      <Typography component="h2">BUỔI CHỜ XÁC NHẬN · {ordered.length}</Typography>
      <IconButton aria-label="Đóng danh sách chờ xác nhận" onClick={onClose}><CloseRounded /></IconButton>
    </Box>
    <Box className="schedule-pending-list">
      {error && <Box role="alert" sx={{ mb: 2, color: "error.main" }}>{error}</Box>}
      {ordered.length === 0 ? <Typography>Không còn buổi học cần xác nhận.</Typography> : ordered.map((session) =>
        <Paper key={session.id} data-pending-session-id={session.id} variant="outlined" className="schedule-pending-row">
          <Box className="schedule-pending-info">
            <Typography className="schedule-pending-date">{vietnameseDate(session.sessionDate)} · {session.period === "MORNING" ? "SÁNG" : "CHIỀU"}</Typography>
            <Typography className="schedule-pending-name">{session.courseOffering?.name || session.courseOffering?.subject?.name}</Typography>
            <Typography className="schedule-pending-subject">{session.courseOffering?.subject?.name}</Typography>
            <Typography className="schedule-pending-location">GV {session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</Typography>
          </Box>
          <Box className="schedule-pending-actions">
            <Button variant="outlined" color="warning" onClick={() => onConfirm(session, "not_held")} disabled={Boolean(savingId)}>Không diễn ra</Button>
            <Button variant="contained" color="success" onClick={() => onConfirm(session, "held")} disabled={Boolean(savingId)}>✓ Đã diễn ra</Button>
          </Box>
        </Paper>)}
    </Box>
  </Drawer>;
};
export default PendingSessionsDrawer;
