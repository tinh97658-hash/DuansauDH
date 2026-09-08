import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";
import { getBusinessTodayKey, isSessionPast, vietnameseDate } from "../../utils/schedulingCalendar";
import "./schedulingReferences.css";
const periodName = (p) => p === "MORNING" ? "Sáng" : p === "AFTERNOON" ? "Chiều" : "";
export default function SessionComposer({
  open, offering, session, lecturers = [], rooms = [], sessions = [], canEdit, saving, serverError,
  availabilityLoading = false, initialDate, initialPeriod, onClose, onSubmit, onDelete, onConfirm, onViewOffering, onDateChange,
}) {
  const [form, setForm] = useState({ sessionDate: "", period: "", lecturerId: "", roomId: "", note: "" });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDateFields, setShowDateFields] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({ sessionDate: session?.sessionDate || initialDate || "", period: session?.period || initialPeriod || "",
      lecturerId: session?.lecturerId || "", roomId: session?.roomId || "", note: session?.note || "" });
    setEditing(!session || session.isScheduled === false); setError(""); setConfirmDelete(false);
    setShowDateFields(Boolean(session) || !initialDate || !initialPeriod);
  }, [open, session, initialDate, initialPeriod]);
  const current = session?.courseOffering ? { ...session.courseOffering, ...(offering?.id === session.courseOffering.id ? offering : {}) } : offering;
  const past = Boolean(session && isSessionPast(session));
  const mutable = canEdit && (!session || (session.status === "planned" && !past));
  const editable = mutable && editing;
  const conflicts = sessions.filter((s) => s.id !== session?.id && s.status !== "not_held" && s.sessionDate === form.sessionDate && s.period === form.period);
  const chosenRoom = rooms.find((r) => r.id === form.roomId) || session?.room;
  const chosenLecturer = lecturers.find((l) => l.id === form.lecturerId) || session?.lecturer;
  const participantCount = Number(current?.participantCount || 0);
  const roomIssue = (room) => room.isActive !== true ? "Ngừng sử dụng" : room.capacity == null ? "Chưa khai báo sức chứa" : room.capacity < participantCount ? "Không đủ sức chứa" : conflicts.some((s) => s.roomId === room.id) ? "Đã có lịch" : "";
  const change = (key) => (e) => {
    const value = e.target.value; setForm((f) => ({ ...f, [key]: value })); setError("");
    if (key === "sessionDate" && value) onDateChange?.(value);
  };
  const submit = () => {
    if (!form.sessionDate || !form.period || !form.lecturerId || !form.roomId) { setError("Chọn đủ ngày, buổi, giảng viên và phòng học."); return; }
    // The half-day boundary is internal; users select only the day and period.
    const endTime = form.period === "MORNING" ? "12:00:00" : "23:59:59";
    if (form.sessionDate < getBusinessTodayKey() || isSessionPast({ sessionDate: form.sessionDate, endTime })) { setError("Không thể xếp buổi đã kết thúc."); return; }
    if (!chosenRoom || roomIssue(chosenRoom)) { setError(roomIssue(chosenRoom || {}) || "Chọn phòng học."); return; }
    if (conflicts.some((s) => s.lecturerId === form.lecturerId)) { setError("Giảng viên đã bận trong buổi này."); return; }
    onSubmit({ ...form, note: form.note.trim() || null });
  };

  const floors = rooms.reduce((result, room) => {
    const match = String(room.code || "").match(/^(?:P[. -]?)?(\d)\d{2}$/i);
    const floor = match ? "TẦNG " + match[1] : "PHÒNG KHÁC";
    (result[floor] ||= []).push(room);
    return result;
  }, {});
  const dateLabel = (form.sessionDate ? vietnameseDate(form.sessionDate) : "Chọn ngày") + " · " + (periodName(form.period).toUpperCase() || "CHỌN BUỔI");
  return <>
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth={false}
      aria-labelledby="session-composer-title" PaperProps={{ className: "schedule-reference schedule-composer" }}
      BackdropProps={{ sx: { bgcolor: "rgba(23,59,112,.08)" } }}>
      <DialogTitle component="div" id="session-composer-title" className="schedule-composer-header">
        <Box>
          <Typography className="schedule-eyebrow">{editing ? "XẾP BUỔI" : "CHI TIẾT BUỔI HỌC"} · {dateLabel}</Typography>
          <Typography component="h2" className="schedule-class-title">{current?.name || current?.subject?.name}</Typography>
          <Typography className="schedule-composer-meta">{current?.subject?.name} · {current?.groupLinks?.length || 0} lớp/nhóm · {current?.participantCount ?? 0} học viên</Typography>
        </Box>
        <span className="schedule-held-badge">Đã diễn ra {Number(current?.sessionSummary?.heldCount || 0)} buổi</span>
      </DialogTitle>
      <DialogContent className="schedule-composer-content">
        <Box className="schedule-session-info">
          <Typography className="schedule-eyebrow">THÔNG TIN BUỔI HỌC</Typography>
          <Box className="schedule-session-date"><Typography>{dateLabel}</Typography>
            {editable && !showDateFields && <Button size="small" onClick={() => setShowDateFields(true)}>Đổi ngày / buổi</Button>}
          </Box>
          {(error || serverError) && <Alert severity="error" sx={{ mb: 2 }}>{error || serverError}</Alert>}
          {session?.isScheduled !== false && session && !editing && <Alert severity="info" sx={{ mb: 2 }}>{session.status === "held" ? "Đã xác nhận diễn ra." : session.status === "not_held" ? "Đã xác nhận không diễn ra." : past ? "Buổi học đã kết thúc · Chờ xác nhận." : "Buổi học đã xếp."}</Alert>}
          {showDateFields && <Box className="schedule-date-fields">
            <TextField label="Ngày học" type="date" size="small" value={form.sessionDate} onChange={change("sessionDate")} disabled={!editable} InputLabelProps={{ shrink: true }} inputProps={{ "aria-label": "Ngày học", min: getBusinessTodayKey() }} />
            <TextField select label="Buổi học" size="small" value={form.period} onChange={change("period")} disabled={!editable} SelectProps={{ inputProps: { "aria-label": "Buổi học" } }}>
              <MenuItem value="MORNING">Sáng</MenuItem><MenuItem value="AFTERNOON">Chiều</MenuItem>
            </TextField>
          </Box>}
          <Typography component="label" htmlFor="session-lecturer" className="schedule-field-label">Giảng viên</Typography>
          <TextField id="session-lecturer" select fullWidth value={form.lecturerId} onChange={change("lecturerId")} disabled={!editable || !form.period || availabilityLoading}
            SelectProps={{ displayEmpty: true, inputProps: { "aria-label": "Giảng viên" } }}>
            <MenuItem value="" disabled>Chọn giảng viên</MenuItem>
            {chosenLecturer && !lecturers.some((l) => l.id === chosenLecturer.id) && <MenuItem value={chosenLecturer.id} disabled>{chosenLecturer.name}</MenuItem>}
            {lecturers.map((l) => <MenuItem key={l.id} value={l.id} disabled={conflicts.some((s) => s.lecturerId === l.id)}>{l.code} · {l.name}{conflicts.some((s) => s.lecturerId === l.id) ? " · Đang bận" : ""}</MenuItem>)}
          </TextField>
          <Typography component="label" htmlFor="session-note" className="schedule-field-label schedule-note-label">Ghi chú</Typography>
          <TextField id="session-note" fullWidth placeholder="Nhập ghi chú..." multiline minRows={5} value={form.note} onChange={change("note")} disabled={!editable} inputProps={{ "aria-label": "Ghi chú", maxLength: 2000 }} />
        </Box>
        <Box className="schedule-room-panel">
          <Typography className="schedule-eyebrow">PHÒNG HỌC TOÀN VIỆN</Typography>
          <Typography className="schedule-room-context">Tình trạng theo {dateLabel}</Typography>
          {availabilityLoading && <Typography role="status">Đang kiểm tra phòng và giảng viên...</Typography>}
          {!rooms.length && <Alert severity="info">Chưa có phòng học đang hoạt động.</Alert>}
          {Object.entries(floors).sort(([a], [b]) => a === "PHÒNG KHÁC" ? 1 : b === "PHÒNG KHÁC" ? -1 : a.localeCompare(b, "vi", { numeric: true })).map(([floor, floorRooms]) => <Box className="schedule-room-floor" key={floor}>
            <Typography className="schedule-eyebrow">{floor}</Typography>
            <Box className="schedule-room-grid">{floorRooms.map((r) => <Button key={r.id} variant="outlined" className="schedule-room-card"
              aria-label={"Chọn phòng " + r.code} aria-pressed={r.id === form.roomId} title={r.name}
              disabled={!editable || !form.sessionDate || !form.period || availabilityLoading || Boolean(roomIssue(r))}
              onClick={() => { setForm((f) => ({ ...f, roomId: r.id })); setError(""); }}>
              <strong>{r.code}</strong><span>{r.capacity == null ? "Chưa khai báo sức chứa" : r.capacity + " chỗ"}</span>
              <span className={"schedule-room-status" + (roomIssue(r) ? " is-unavailable" : "")}>{roomIssue(r) || "TRỐNG"}</span>
            </Button>)}</Box>
          </Box>)}
        </Box>
      </DialogContent>
      <DialogActions className="schedule-composer-footer">
        <Typography>Phòng đã chọn: <strong>{chosenRoom?.code || "Chưa chọn"}</strong></Typography>
        <Box className="schedule-composer-actions">
          {session && !editing && <Button onClick={() => onViewOffering(current)}>Xem lớp học phần</Button>}
          {mutable && !editing && <><Button onClick={() => { setEditing(true); setShowDateFields(true); }}>Chỉnh sửa lịch</Button><Button color="error" onClick={() => setConfirmDelete(true)}>Xóa khỏi lịch</Button></>}
          {canEdit && session?.status === "planned" && past && <><Button disabled={saving} onClick={() => onConfirm("not_held")}>Không diễn ra</Button><Button disabled={saving} onClick={() => onConfirm("held")}>Đã diễn ra</Button></>}
          <Button variant="outlined" disabled={saving} onClick={onClose}>{editing ? "Hủy" : "Đóng"}</Button>
          {editable && <Button variant="contained" onClick={submit} disabled={saving || availabilityLoading}>{saving ? "Đang lưu..." : session ? "Lưu thay đổi" : "Lưu lịch"}</Button>}
        </Box>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(open && confirmDelete)} onClose={() => !saving && setConfirmDelete(false)}>
      <DialogTitle>Gỡ buổi học khỏi lịch?</DialogTitle><DialogContent>Buổi này sẽ được xóa khỏi lịch của lớp học phần.</DialogContent>
      <DialogActions><Button onClick={() => setConfirmDelete(false)} disabled={saving}>Hủy</Button><Button onClick={onDelete} disabled={saving}>Xác nhận xóa</Button></DialogActions>
    </Dialog>
  </>;
}
