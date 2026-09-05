import React from "react";
import { Box, Button, Drawer, IconButton, Paper, Stack, Typography } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";
import { shortTime, vietnameseDate } from "../../utils/schedulingCalendar";
import { schedulingType, schedulingTypographySx } from "./schedulingTypography";

const groupsLabel = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup?.code).filter(Boolean).join(", ") || "Chưa có lớp/nhóm";
const periodLabel = (period) => period === "MORNING" ? "Sáng" : "Chiều";

const PendingSessionsDrawer = ({ open, sessions, savingId, error, onClose, onConfirm, onOpenSession }) => {
  const ordered = [...sessions].sort((left, right) => `${right.sessionDate} ${right.endTime}`.localeCompare(`${left.sessionDate} ${left.endTime}`) || String(right.id).localeCompare(String(left.id)));
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ "data-scheduling-typography": "compact", sx: { ...schedulingTypographySx, width: "min(640px, 100vw)", display: "flex", flexDirection: "column" } }}>
      <Box sx={{ p: "18px 20px 14px", borderBottom: "1px solid #D1DBE1", bgcolor: "#F5F8FA" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box><Typography variant="caption" sx={{ "&&": { color: "#7B5A11", ...schedulingType.eyebrow } }}>XUYÊN TUẦN · GẦN NHẤT TRƯỚC</Typography><Typography variant="h6" sx={{ "&&": { ...schedulingType.drawerTitle, color: "#1C3B51" } }}>Buổi chờ xác nhận · {ordered.length}</Typography></Box>
          <IconButton aria-label="Đóng danh sách chờ xác nhận" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
      </Box>
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", p: 1.5 }}>
        {error && <Box role="alert" sx={{ mb: 1, p: 1, borderLeft: "3px solid #B4232B", bgcolor: "#FFF0F0", color: "#842027" }}>{error}</Box>}
        {ordered.length === 0 ? <Typography variant="body2" color="text.secondary">Không còn buổi học cần xác nhận.</Typography> : ordered.map((session) => (
          <Paper key={session.id} data-pending-session-id={session.id} variant="outlined" sx={{ mb: 0.8, p: "10px 11px", borderLeft: "3px solid #CD8810", bgcolor: "#FFFDF7" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Box sx={{ minWidth: 92, pr: { sm: 1 }, borderRight: { sm: "1px solid #D8E0E5" } }}><Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{vietnameseDate(session.sessionDate)}</Typography><Typography variant="caption" sx={{ "&&": { color: "#795A13" } }}>{periodLabel(session.period)} · {shortTime(session.startTime)}–{shortTime(session.endTime)}</Typography></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{session.courseOffering?.subject?.code} · {session.courseOffering?.subject?.name}</Typography><Typography variant="caption" sx={{ "&&": { display: "block", color: "#536A77" } }}>{groupsLabel(session.courseOffering)}</Typography><Typography variant="caption" sx={{ "&&": { display: "block", color: "#536A77" } }}>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</Typography></Box>
              <Stack spacing={0.45} sx={{ minWidth: 150 }}>
                <Button size="small" variant="outlined" onClick={() => onOpenSession(session)} disabled={Boolean(savingId)}>Xem chi tiết</Button>
                <Button size="small" color="warning" onClick={() => onConfirm(session, "not_held")} disabled={Boolean(savingId)}>Không diễn ra</Button>
                <Button size="small" color="success" variant="contained" onClick={() => onConfirm(session, "held")} disabled={Boolean(savingId)}>✓ Đã diễn ra</Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Drawer>
  );
};

export default PendingSessionsDrawer;
