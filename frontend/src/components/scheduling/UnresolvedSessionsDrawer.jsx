import React from "react";
import { Alert, Box, ButtonBase, CircularProgress, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";
import { isSessionPast, shortTime, vietnameseDate } from "../../utils/schedulingCalendar";
import { schedulingType, schedulingTypographySx } from "./schedulingTypography";

const UnresolvedSessionsDrawer = ({ open, offering, sessions, loading, error, onClose, onOpenSession }) => {
  const planned = sessions.filter((session) => session.status === "planned");
  const now = new Date();
  const pending = planned.filter((session) => isSessionPast(session, now)).sort((left, right) => (
    `${right.sessionDate} ${right.endTime}`.localeCompare(`${left.sessionDate} ${left.endTime}`) || String(right.id).localeCompare(String(left.id))
  ));
  const upcoming = planned.filter((session) => !isSessionPast(session, now)).sort((left, right) => (
    `${left.sessionDate} ${left.startTime}`.localeCompare(`${right.sessionDate} ${right.startTime}`) || String(left.id).localeCompare(String(right.id))
  ));
  const groups = (offering?.groupLinks || []).map((link) => link.classGroup?.code).filter(Boolean).join(", ");

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ "data-testid": "unresolved-sessions-drawer", "data-scheduling-typography": "compact", sx: { ...schedulingTypographySx, width: "min(640px, 100vw)", display: "flex", flexDirection: "column" } }}>
      <Box sx={{ p: "18px 20px 14px", borderBottom: "1px solid #D1DBE1", bgcolor: "#F5F8FA" }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="caption" sx={{ "&&": { color: "#607784", ...schedulingType.eyebrow } }}>CÁC BUỔI CẦN XỬ LÝ</Typography>
            <Typography variant="h6" sx={{ "&&": { ...schedulingType.drawerTitle, color: "#1C3B51" } }}>{offering?.subject?.code} · {offering?.subject?.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ "&&": { fontSize: 11, fontWeight: 400 } }}>{groups || "Chưa có lớp/nhóm"} · Xuyên tuần</Typography>
          </Box>
          <IconButton aria-label="Đóng các buổi cần xử lý" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
      </Box>
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", p: 1.5 }}>
        {loading ? <Box role="status" aria-label="Đang tải các buổi cần xử lý" sx={{ p: 3, textAlign: "center" }}><CircularProgress size={25} /></Box>
          : error ? <Alert severity="error">{error}</Alert>
            : planned.length === 0 ? <Typography variant="body2" color="text.secondary">Không còn buổi học cần xử lý.</Typography>
              : [{ label: "CHỜ XÁC NHẬN", items: pending, color: "#8A5B08", background: "#FFF6DD", state: "Chờ xác nhận" },
                { label: "ĐÃ XẾP SẮP TỚI", items: upcoming, color: "#286F9E", background: "#E9F3F9", state: "Đã xếp" }].map((section) => (
                <Box key={section.label} component="section" aria-label={section.label} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ "&&": { display: "block", mb: 0.75, color: section.color, fontSize: 11, fontWeight: 700 } }}>{section.label} · {section.items.length}</Typography>
                  {section.items.map((session) => (
                    <ButtonBase key={session.id} component="button" onClick={() => onOpenSession(session)} aria-label={`Xem buổi ${vietnameseDate(session.sessionDate)} ${shortTime(session.startTime)}`} sx={{ width: "100%", display: "block", textAlign: "left", mb: 0.7, p: "10px 11px", border: "1px solid #CDD7DE", borderLeft: `3px solid ${section.color}`, bgcolor: section.background }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{vietnameseDate(session.sessionDate)}</Typography>
                        <Typography variant="caption" sx={{ "&&": { color: section.color, fontWeight: 700 } }}>{section.state}</Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ "&&": { display: "block", fontWeight: 600 } }}>{session.period === "MORNING" ? "Sáng" : "Chiều"} · {shortTime(session.startTime)}–{shortTime(session.endTime)}</Typography>
                      <Typography variant="caption" sx={{ "&&": { display: "block", color: "#536A77" } }}>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</Typography>
                    </ButtonBase>
                  ))}
                </Box>
              ))}
      </Box>
    </Drawer>
  );
};
export default UnresolvedSessionsDrawer;
