import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/http";
import { Box, Button, Drawer, IconButton, Paper, Typography } from "@mui/material";
import { CloseRounded } from "@mui/icons-material";
import "./schedulingReferences.css";

const CourseOfferingDrawer = ({ open, offering, canManage, onClose, onSchedule }) => {
  const groups = (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
  const summary = offering?.sessionSummary || {};
  const [memberCounts, setMemberCounts] = useState({});
  const [countError, setCountError] = useState("");
  const groupKey = groups.map((group) => group.id).sort().join(",");
  useEffect(() => {
    let active = true;
    setMemberCounts({}); setCountError("");
    if (!open || !groupKey) return () => { active = false; };
    Promise.all(groupKey.split(",").map(async (id) => {
      const { data } = await axios.get(API_BASE_URL + "/masters/class-groups/" + id);
      return [id, data.memberCount ?? data.members?.length ?? 0];
    })).then((counts) => { if (active) setMemberCounts(Object.fromEntries(counts)); })
      .catch(() => { if (active) setCountError("Không tải được sĩ số nhóm. Vui lòng mở lại chi tiết."); });
    return () => { active = false; };
  }, [open, groupKey]);

  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ className: "schedule-reference schedule-class-drawer", sx: { width: "min(700px, 100vw)" } }}>
    <Box className="schedule-class-header">
      <IconButton className="schedule-class-close" aria-label="Đóng chi tiết lớp học phần" onClick={onClose}><CloseRounded /></IconButton>
      <Typography className="schedule-eyebrow">LỚP HỌC PHẦN</Typography>
      <Typography component="h2" className="schedule-class-title">{offering?.name || offering?.subject?.name}</Typography>
      <Typography className="schedule-class-subject">{offering?.subject?.name}</Typography>
      <Typography className="schedule-class-members">{groups.length} lớp/nhóm · {offering?.participantCount ?? 0} học viên</Typography>
      {offering?.status === "active" && <span className="schedule-active-badge">ĐANG DẠY</span>}
    </Box>
    <Box className="schedule-class-content">
      <Box className="schedule-class-counters">
        {[{ value: summary.heldCount, label: "Đã diễn ra" }, { value: summary.pendingCount, label: "Chờ xác nhận" }, { value: summary.futurePlannedCount, label: "Đã xếp sắp tới" }].map((counter) =>
          <Paper key={counter.label} variant="outlined" data-counter={counter.label}><strong>{Number(counter.value || 0)}</strong><span>{counter.label}</span></Paper>)}
      </Box>
      <Typography className="schedule-eyebrow schedule-source-heading">LỚP / NHÓM THAM GIA</Typography>
      {countError && <Typography role="alert" color="error">{countError}</Typography>}
      <Box className="schedule-source-groups">{groups.map((group) =>
        <Paper key={group.id} variant="outlined"><Typography>{group.name}</Typography><Typography className="schedule-source-meta">{group.major?.name || "Chưa có ngành"} · {memberCounts[group.id] ?? group.memberCount ?? group.members?.length ?? "…"} học viên</Typography></Paper>)}</Box>
    </Box>
    <Box className="schedule-class-actions">{canManage && <Button fullWidth variant="outlined" onClick={() => onSchedule(offering)}>Xếp lịch / Xếp thêm</Button>}</Box>
  </Drawer>;
};
export default CourseOfferingDrawer;
