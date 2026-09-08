import React from "react";
import {
  Alert, Box, Button, ButtonBase, CircularProgress, IconButton, Paper, Stack, Typography,
} from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded, TodayRounded } from "@mui/icons-material";
import { schedulingType, schedulingTypographySx } from "./schedulingTypography";
import {
  formatDateKey, getBusinessTodayKey, isSessionPast, vietnameseDate, vietnameseDayMonth,
  vietnameseWeekdayShort, weekDaysFrom,
} from "../../utils/schedulingCalendar";

const PERIODS = [
  { value: "MORNING", label: "SÁNG" },
  { value: "AFTERNOON", label: "CHIỀU" },
];
const groupCodes = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup?.code).filter(Boolean).join(", ");

const sessionVisual = (session) => {
  if (session.status === "held") return { key: "held", label: "✓ ĐÃ DIỄN RA", background: "#ebf7f0", border: "#92c7a7", accent: "#35875a", color: "#26704b" };
  if (session.status === "not_held") return { key: "not-held", label: "— KHÔNG DIỄN RA", background: "#fff4f4", border: "#d9a0a4", accent: "#b4232b", color: "#9b1c23" };
  if (isSessionPast(session)) return { key: "pending", label: "● CHỜ XÁC NHẬN", background: "#fff6dd", border: "#dabb68", accent: "#cd8810", color: "#8a5b08" };
  return { key: "planned", label: "○ ĐÃ XẾP SẮP TỚI", background: "#e9f3f9", border: "#91bad5", accent: "#2f7db2", color: "#286f9e" };
};

const SessionCard = ({ session, onOpen }) => {
  const visual = sessionVisual(session);
  return (
    <ButtonBase
      component="button"
      onClick={(event) => { event.stopPropagation(); onOpen(session); }}
      aria-label={`Xem buổi học ${session.courseOffering?.subject?.code || ""} ${(session.period === "MORNING" ? "Sáng" : "Chiều")}`}
      data-session-state={visual.key}
      data-session-id={session.id}
      style={{ backgroundColor: visual.background, borderColor: visual.border, borderLeftColor: visual.accent }}
      sx={{
        width: "100%", display: "block", mb: 0.45, p: "7px 8px", border: "1px solid", borderLeft: "3px solid",
        color: "text.primary", textAlign: "left", transition: "filter 150ms", "&:hover": { filter: "brightness(.98)" },
      }}
    >
      <Typography data-testid="calendar-class-title" variant="body2" sx={{ "&&": { ...schedulingType.cardTitle, fontSize: 14, textTransform: "uppercase", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", color: "#244A61", lineHeight: 1.25, overflowWrap: "anywhere" } }}>{session.courseOffering?.name || groupCodes(session.courseOffering)}</Typography>
      <Typography data-testid="calendar-subject-title" variant="caption" noWrap sx={{ "&&": { ...schedulingType.meta, fontSize: 12, display: "block", mt: "4px", color: "#253C49" } }}>{session.courseOffering?.subject?.name}</Typography>
      <Typography variant="caption" sx={{ "&&": { ...schedulingType.meta, fontSize: 12, display: "block", mt: "3px", color: "#687780", overflowWrap: "anywhere" } }}>GV {session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</Typography>
      <Typography variant="caption" noWrap sx={{ "&&": { ...schedulingType.status, fontSize: 12, display: "block", mt: "3px", color: visual.color } }}>{visual.label}</Typography>
    </ButtonBase>
  );
};

const WeeklyCalendar = ({
  monday, sessions, loading, error, selection, selecting = false, pendingCount = 0,
  onPrevious, onToday, onNext, onOpenPending, onSlotClick, onSessionClick,
}) => {
  const days = weekDaysFrom(monday);
  const todayKey = getBusinessTodayKey();
  const sessionsBySlot = sessions.reduce((result, session) => {
    const key = `${session.sessionDate}:${session.period}`;
    (result[key] ||= []).push(session);
    return result;
  }, {});

  return (
    <Paper variant="outlined" data-testid="weekly-calendar" data-scheduling-typography="compact" data-selecting={selecting ? "true" : "false"} sx={{ ...schedulingTypographySx, minHeight: 0, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", border: 0, borderRadius: 0, bgcolor: "#EDF2F5" }}>
      <Box sx={{ minHeight: 58, px: 1.2, py: 0.55, borderBottom: "1px solid #CDD7DE", display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(180px,1fr) auto minmax(180px,1fr)" }, gap: 1, alignItems: "center", bgcolor: "#FFFFFF" }}>
        <Box>
          <Typography component="h1" variant="subtitle1" sx={{ "&&": { ...schedulingType.pageTitle, color: "#173B70" } }}>Xếp lịch</Typography>
          <Typography variant="caption" sx={{ "&&": { color: "#68737D" } }}>Chọn lớp học phần và xếp buổi học theo thời gian thực.</Typography>
        </Box>
        <Stack direction="row" spacing={0.35} alignItems="center" justifyContent="center">
          <IconButton size="small" aria-label="Tuần trước" onClick={onPrevious}><ChevronLeftRounded /></IconButton>
          <Typography variant="subtitle2" sx={{ "&&": { minWidth: 184, textAlign: "center", color: "#203F55", whiteSpace: "nowrap" } }}>{vietnameseDate(days[0])} — {vietnameseDate(days[6])}</Typography>
          <IconButton size="small" aria-label="Tuần sau" onClick={onNext}><ChevronRightRounded /></IconButton>
        </Stack>
        <Stack direction="row" spacing={0.6} justifyContent="flex-end">
          <Button size="small" variant="outlined" startIcon={<TodayRounded />} onClick={onToday} sx={{ "&&": { minHeight: 28, py: 0 } }}>Hôm nay</Button>
          <Button
            size="small"
            aria-label={`Mở ${pendingCount} buổi chờ xác nhận`}
            onClick={onOpenPending}
            disabled={pendingCount === 0}
            sx={{ "&&": { minHeight: 29, border: "1px solid #CFB25D", bgcolor: "#FFF8E3", color: "#694E12", fontWeight: 600, "&:hover": { bgcolor: "#FFF1C7" } } }}
          >● {pendingCount} chờ xác nhận</Button>
        </Stack>
      </Box>

      {selection}
      {error && <Alert severity="error" sx={{ m: 0.75 }}>{error}</Alert>}
      {loading ? (
        <Box role="status" aria-label="Đang tải lịch tuần" sx={{ minHeight: 0, flex: 1, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
      ) : (
        <Box sx={{ minHeight: 0, flex: 1, overflowX: "auto", overflowY: { xs: "auto", lg: "hidden" }, bgcolor: "#EDF2F5", p: 0.55 }}>
          <Box sx={{ minWidth: 860, minHeight: { xs: 480, lg: 0 }, height: "100%", display: "grid", gridTemplateColumns: "58px repeat(7, minmax(110px, 1fr))", gridTemplateRows: "40px repeat(2, minmax(0, 1fr))", borderTop: "1px solid #CBD5DC", borderLeft: "1px solid #CBD5DC" }}>
            <Box sx={{ display: "grid", placeItems: "center", borderRight: "1px solid #CBD5DC", borderBottom: "1px solid #CBD5DC", bgcolor: "#E7EDF1" }}><Typography variant="caption" sx={{ "&&": { fontWeight: 700 } }}>BUỔI</Typography></Box>
            {days.map((day) => {
              const todayCell = formatDateKey(day) === todayKey;
              return (
                <Box key={formatDateKey(day)} data-day-header={formatDateKey(day)} data-today={todayCell ? "true" : "false"} style={{ whiteSpace: "nowrap" }} sx={{ minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 0.55, borderRight: "1px solid #CBD5DC", borderBottom: "1px solid #CBD5DC", bgcolor: todayCell ? "#E7F2F8" : "#F3F6F8" }}>
                  <Typography variant="caption" sx={{ "&&": { ...schedulingType.weekday, color: todayCell ? "#075A9C" : "#233F54" } }}>{vietnameseWeekdayShort(day)}</Typography>
                  <Typography variant="caption" sx={{ "&&": { ...schedulingType.date, color: "#627480" } }}>{vietnameseDayMonth(day)}</Typography>
                  {todayCell && <Box aria-label="Hôm nay" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#167CB5" }} />}
                </Box>
              );
            })}

            {PERIODS.map((period) => (
              <React.Fragment key={period.value}>
                <Box data-testid={`period-label-${period.value}`} data-period-label={period.value} style={{ writingMode: "horizontal-tb", transform: "none" }} sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.35, borderRight: "1px solid #CBD5DC", borderBottom: "1px solid #CBD5DC", bgcolor: "#E7EDF1" }}>
                  <Typography variant="caption" sx={{ "&&": { fontSize: 11, fontWeight: 700, color: "#526773" } }}>{period.label}</Typography>
                </Box>
                {days.map((day) => {
                  const date = formatDateKey(day);
                  const pastDate = date < todayKey;
                  const selectable = selecting && !pastDate;
                  const slotSessions = [...(sessionsBySlot[`${date}:${period.value}`] || [])].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
                  return (
                    <Box
                      key={`${date}:${period.value}`}
                      role={selectable ? "button" : undefined}
                      tabIndex={selectable ? 0 : undefined}
                      aria-label={selectable ? `Thêm buổi ${period.label === "SÁNG" ? "Sáng" : "Chiều"} ngày ${vietnameseDate(day)}` : undefined}
                      data-slot-date={date}
                      data-past-date={pastDate ? "true" : "false"}
                      data-period={period.value}
                      onClick={selectable ? () => onSlotClick(date, period.value) : undefined}
                      onKeyDown={selectable ? (event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onSlotClick(date, period.value);
                        }
                      } : undefined}
                      sx={{
                        minHeight: 0, overflowY: "auto", p: 0.45, borderRight: "1px solid #CBD5DC", borderBottom: "1px solid #CBD5DC",
                        bgcolor: pastDate ? "#EDF0F2" : selectable ? "#FAFDFF" : "#FFFFFF", boxShadow: selectable ? "inset 0 0 0 1px #AFD2E8" : "none", cursor: selectable ? "pointer" : "default",
                        transition: "background-color 150ms, box-shadow 150ms", "&:hover": selectable ? { bgcolor: "#E6F4FC", boxShadow: "inset 0 0 0 2px #448FC2" } : {},
                      }}
                    >
                      {slotSessions.map((session) => <SessionCard key={session.id} session={session} onOpen={onSessionClick} />)}
                      {slotSessions.length === 0 && <Box sx={{ height: "100%", minHeight: 42, display: "grid", placeItems: "center", textAlign: "center" }}>
                        {pastDate ? <Box sx={{ color: "#788893" }}><Typography variant="caption" sx={{ "&&": { display: "block", fontWeight: 700 } }}>ĐÃ QUA</Typography><Typography variant="caption">Không có lịch</Typography></Box>
                          : <Typography variant="caption" sx={{ "&&": { color: selectable ? "#286F9E" : "#788893", fontWeight: selectable ? 500 : 400 } }}>{selectable ? "+ Chọn buổi này" : "Chưa có lịch"}</Typography>}
                      </Box>}
                    </Box>
                  );
                })}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default WeeklyCalendar;
