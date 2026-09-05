import React from "react";
import { Box, Button, Chip, Drawer, IconButton, Paper, Stack, Typography } from "@mui/material";
import { CloseRounded, EventNoteRounded } from "@mui/icons-material";
import { schedulingType, schedulingTypographySx } from "./schedulingTypography";

import { BUSINESS_TIME_ZONE } from "../../utils/schedulingCalendar";

const offeringGroups = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);

const CourseOfferingDrawer = ({ open, offering, canManage, saving, onClose, onSchedule, onComplete, onViewUnresolved }) => {
  const groups = offeringGroups(offering);
  const summary = offering?.sessionSummary || {};
  const heldCount = Number(summary.heldCount || 0);
  const pendingCount = Number(summary.pendingCount || 0);
  const futureCount = Number(summary.futurePlannedCount || 0);
  const plannedCount = Number(summary.plannedCount || 0);
  const active = offering?.status === "active";
  const canComplete = active && heldCount >= 1 && plannedCount === 0;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ "data-scheduling-typography": "compact", sx: { ...schedulingTypographySx, width: "min(640px, 100vw)", display: "flex", flexDirection: "column" } }}>
      <Box sx={{ p: "18px 20px 14px", borderBottom: "1px solid #D1DBE1", bgcolor: "#F5F8FA" }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box><Typography variant="caption" sx={{ "&&": { color: "#607784", ...schedulingType.eyebrow } }}>LỚP HỌC PHẦN</Typography><Typography variant="h5" sx={{ "&&": { ...schedulingType.drawerTitle, mt: 0.25, color: "#1C3B51" } }}>{offering?.subject?.code} · {offering?.subject?.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ "&&": { fontSize: 11, fontWeight: 400 } }}>{groups.length} lớp/nhóm · {offering?.participantCount ?? 0} học viên hiện có</Typography></Box>
          <IconButton aria-label="Đóng chi tiết lớp học phần" onClick={onClose}><CloseRounded /></IconButton>
        </Stack>
      </Box>
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", p: 2 }}>
        <Chip label={active ? "ĐANG DẠY" : "HOÀN THÀNH"} color={active ? "primary" : "success"} size="small" sx={{ fontWeight: 700 }} />
        <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid #D2DCE3", bgcolor: "#F8FAFB" }}>
          {[{ value: heldCount, label: "Đã diễn ra" }, { value: pendingCount, label: "Chờ xác nhận" }, { value: futureCount, label: "Đã xếp sắp tới" }].map((item, index) => <Box key={item.label} sx={{ height: 72, p: 1.2, textAlign: "center", borderLeft: index ? "1px solid #D2DCE3" : 0 }}><Typography variant="h5" sx={{ "&&": { fontSize: 17, fontWeight: 700, color: "#234B66" } }}>{item.value}</Typography><Typography variant="caption" color="text.secondary">{item.label}</Typography></Box>)}
        </Box>

        <Typography variant="caption" sx={{ "&&": { display: "block", mt: 1.75, mb: 0.7, color: "#506570", ...schedulingType.eyebrow } }}>LỚP / NHÓM HỌC</Typography>
        <Stack spacing={0.65}>{groups.map((group) => <Paper key={group.id} variant="outlined" sx={{ p: "10px 11px" }}><Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{group.code} · {group.name}</Typography><Typography variant="caption" color="text.secondary">{group.major?.name || "Chưa có ngành"} · {group.academicYear || "-"}{group.term ? ` · ${group.term}` : ""}</Typography></Paper>)}</Stack>

        {offering && !active && <Box sx={{ mt: 1.5, p: 1, border: "1px solid #C6D9CD", bgcolor: "#EBF7F0", color: "#276B49", fontSize: 12 }}>Hoàn thành lúc {offering.completedAt ? new Date(offering.completedAt).toLocaleString("vi-VN", { timeZone: BUSINESS_TIME_ZONE }) : "—"}{offering.completedBy?.name ? ` · ${offering.completedBy.name}` : ""}</Box>}
        {active && plannedCount > 0 && <Box sx={{ mt: 1.5, p: 1, border: "1px solid #D8E0E5", bgcolor: "#F7F9FA", color: "#526773", fontSize: 12 }}>Còn {plannedCount} buổi đã xếp hoặc chờ xác nhận.</Box>}
        {active && plannedCount === 0 && heldCount === 0 && <Box sx={{ mt: 1.5, p: 1, border: "1px solid #D8E0E5", bgcolor: "#F7F9FA", color: "#526773", fontSize: 12 }}>Cần ít nhất một buổi được xác nhận đã diễn ra trước khi hoàn thành giảng dạy.</Box>}
      </Box>
      <Stack spacing={0.7} sx={{ p: "12px 15px", borderTop: "1px solid #CAD4DB", bgcolor: "#FFFFFF" }}>
        {active && canManage && <Button variant="outlined" startIcon={<EventNoteRounded />} onClick={() => onSchedule(offering)}>Xếp lịch / Xếp thêm</Button>}
        {active && plannedCount > 0 && <Button variant="text" onClick={() => onViewUnresolved(offering)} disabled={saving}>Xem các buổi cần xử lý</Button>}
        {active && canManage && <Button color="success" variant="contained" onClick={() => onComplete(offering)} disabled={!canComplete || saving}>Xác nhận hoàn thành giảng dạy</Button>}
      </Stack>
    </Drawer>
  );
};

export default CourseOfferingDrawer;
