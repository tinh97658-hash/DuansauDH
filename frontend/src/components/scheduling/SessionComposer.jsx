import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControl, MenuItem, Paper, Popover, Select, Stack, TextField, Typography,
} from "@mui/material";
import { AccessTimeRounded, CheckCircleRounded, DeleteOutlineRounded, EditRounded, MeetingRoomRounded, VisibilityRounded } from "@mui/icons-material";
import {
  getBusinessTodayKey, getRoomFloor, isPeriodTimeConsistent, isSessionPast, normalizeTimeInput, shortTime, timesOverlap, validTimeRange, vietnameseDate,
} from "../../utils/schedulingCalendar";
import { schedulingType, schedulingTypographySx } from "./schedulingTypography";

const offeringGroups = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
const groupLabel = (offering) => offeringGroups(offering).map((group) => `${group.code}${group.major?.name ? ` · ${group.major.name}` : ""}`).join("; ");
const emptyForm = { sessionDate: "", period: "", startTime: "", endTime: "", lecturerId: "", roomId: "", note: "" };
const periodLabel = (period) => period === "MORNING" ? "SÁNG" : (period === "AFTERNOON" ? "CHIỀU" : "Chưa chọn buổi");
const FieldLabel = ({ children }) => <Typography component="label" variant="caption" sx={{ "&&": { display: "block", mb: 0.35, color: "#506570", ...schedulingType.fieldLabel } }}>{children}</Typography>;

// Draft selections stay in the popover until Done; persisted times remain HH:mm.
const DigitalTimePicker = ({ period, startTime, endTime, disabled, error, onChange }) => {
  const [picker, setPicker] = useState(null);
  const startButton = useRef(null);
  const endButton = useRef(null);
  const hourList = useRef(null);
  const minuteList = useRef(null);
  const returnFocus = useRef(null);
  const morning = period === "MORNING";
  const endAtNoon = morning && picker?.field === "endTime" && picker.hour === "12";
  const hours = Array.from({ length: morning && picker?.field === "endTime" ? 13 : 12 }, (_, index) => String(index + (morning ? 0 : 12)).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

  const openPicker = (field) => {
    const value = field === "startTime" ? startTime : endTime;
    const [hour, minute] = value ? value.split(":") : [null, null];
    const hourAllowed = hour !== null && Number(hour) >= (morning ? 0 : 12)
      && Number(hour) <= (morning ? (field === "endTime" ? 12 : 11) : 23);
    setPicker({ field, hour: hourAllowed ? hour : null, minute: hourAllowed ? (morning && hour === "12" ? "00" : minute) : null });
  };
  useEffect(() => {
    if (!picker) {
      returnFocus.current?.focus();
      returnFocus.current = null;
      return;
    }
    // Keep the selected row visible when opening an existing time or changing hour.
    [hourList.current, minuteList.current].forEach((list) => {
      const selected = list?.querySelector('[aria-pressed="true"]');
      if (selected) list.scrollTop = selected.offsetTop - (list.clientHeight - selected.clientHeight) / 2;
    });
  }, [picker]);
  const closePicker = () => {
    returnFocus.current = picker?.field === "startTime" ? startButton.current : endButton.current;
    setPicker(null);
  };
  const finish = () => {
    onChange(picker.field, `${picker.hour}:${picker.minute}`);
    if (picker.field === "startTime" && !endTime) {
      endButton.current?.focus();
      setPicker({ field: "endTime", hour: null, minute: null });
    } else closePicker();
  };

  return <>
    <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
      {[{ field: "startTime", label: "Bắt đầu", value: startTime, ref: startButton }, { field: "endTime", label: "Kết thúc", value: endTime, ref: endButton }].map(({ field, label, value, ref }) => (
        <Box key={field} sx={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>{label}</FieldLabel>
          <ButtonBase ref={ref} aria-label={label} aria-haspopup="dialog" aria-expanded={picker?.field === field} aria-invalid={Boolean(error)} aria-describedby={error ? "session-time-error" : undefined} disabled={disabled} onClick={() => openPicker(field)}
            sx={{ width: "100%", height: 36, border: "1px solid", borderColor: error ? "#b4232b" : "#bcc8d0", bgcolor: disabled ? "#f5f8fa" : "#fff", borderRadius: "3px", px: "10px", display: "flex", justifyContent: "space-between", fontFamily: "inherit", fontSize: 12.5, fontWeight: 400, color: "#24475d", "&.Mui-focusVisible": { outline: "2px solid #075a9c", outlineOffset: 2 } }}>
            <span>{value || "Chọn giờ"}</span><AccessTimeRounded sx={{ fontSize: 16, color: "#617985" }} />
          </ButtonBase>
        </Box>
      ))}
    </Stack>
    {picker && <Popover open anchorEl={picker.field === "startTime" ? startButton.current : endButton.current} onClose={closePicker} disableRestoreFocus
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      PaperProps={{ role: "dialog", "aria-labelledby": "digital-time-picker-title", sx: { ...schedulingTypographySx, mt: 0.5, width: 236, maxHeight: 300, border: "1px solid #b9c6cf", borderRadius: "3px", bgcolor: "#fff", boxShadow: "0 3px 12px #24475d26" } }}>
      <Typography id="digital-time-picker-title" sx={{ "&&": { p: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "#24475d", borderBottom: "1px solid #d9e1e6" } }}>CHỌN GIỜ {picker?.field === "startTime" ? "BẮT ĐẦU" : "KẾT THÚC"}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {[{ key: "hour", label: "Giờ", values: hours, ref: hourList }, { key: "minute", label: "Phút", values: minutes, ref: minuteList }].map(({ key, label, values, ref }) => (
          <Box key={key} sx={{ minWidth: 0, borderRight: key === "hour" ? "1px solid #d9e1e6" : 0 }}>
            <Typography sx={{ "&&": { textAlign: "center", py: 0.5, fontSize: 10.5, fontWeight: 700, color: "#526773" } }}>{label.toLocaleUpperCase("vi")}</Typography>
            <Box ref={ref} role="group" aria-label={label} sx={{ height: 166, overflowY: "auto", overscrollBehavior: "contain", position: "relative" }}>
              {values.map((value) => <ButtonBase key={value} aria-label={`${label} ${value}`} aria-pressed={picker?.[key] === value} disabled={key === "minute" && endAtNoon && value !== "00"}
                onClick={() => setPicker((current) => ({ ...current, [key]: value, ...(key === "hour" && morning && current.field === "endTime" && value === "12" ? { minute: "00" } : {}) }))}
                sx={{ display: "flex", width: "100%", height: 30, fontFamily: "inherit", fontSize: 13, fontVariantNumeric: "tabular-nums", bgcolor: picker?.[key] === value ? "#e8f3fa" : "transparent", color: picker?.[key] === value ? "#075a9c" : "#24475d", fontWeight: picker?.[key] === value ? 700 : 400, "&:hover": { bgcolor: "#f0f6fa" }, "&.Mui-disabled": { color: "#a5afb6" }, "&.Mui-focusVisible": { outline: "2px solid #075a9c", outlineOffset: -2 } }}>{value}</ButtonBase>)}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: "6px 10px", display: "flex", justifyContent: "flex-end", borderTop: "1px solid #d9e1e6" }}><Button size="small" variant="contained" disabled={!picker?.hour || !picker?.minute} onClick={finish}>Xong</Button></Box>
    </Popover>}
  </>;
};

const roomPalette = {
  available: { border: "#BECBD4", background: "#FFFFFF", color: "#21724C" },
  selected: { border: "#1F78B2", background: "#EAF5FB", color: "#075A9C" },
  busy: { border: "#D5B45B", background: "#FFF6DD", color: "#815A08" },
  "too-small": { border: "#C8B995", background: "#F3F0E8", color: "#756133" },
  "no-capacity": { border: "#B9C1C7", background: "#EEF1F3", color: "#66727A" },
  inactive: { border: "#ADB5BB", background: "#E5E8EA", color: "#646D73" },
  "time-required": { border: "#D4DBDF", background: "#F5F7F8", color: "#75838C" },
};

const SessionComposer = ({
  open, offering, session, lecturers, rooms, sessions, canEdit, weekFrom, weekTo,
  saving, serverError, availabilityLoading = false, initialDate, initialPeriod, onClose, onSubmit, onDelete, onConfirm, onViewOffering,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(session ? {
      sessionDate: session.sessionDate || "",
      period: session.period || "",
      startTime: shortTime(session.startTime),
      endTime: shortTime(session.endTime),
      lecturerId: session.lecturerId || session.lecturer?.id || "",
      roomId: session.roomId || session.room?.id || "",
      note: session.note || "",
    } : { ...emptyForm, sessionDate: initialDate || "", period: initialPeriod || "" });
    setEditing(!session);
    setValidationError("");
    setConfirmDelete(false);
    setTimeTouched(false);
  }, [initialDate, initialPeriod, open, session]);

  const displayOffering = session?.courseOffering || offering;
  const participantCount = Number(displayOffering?.participantCount || 0);
  const normalizedStart = normalizeTimeInput(form.startTime);
  const normalizedEnd = normalizeTimeInput(form.endTime);
  const rangeValid = validTimeRange(normalizedStart, normalizedEnd);
  const periodValid = rangeValid && isPeriodTimeConsistent(form.period, normalizedStart, normalizedEnd);
  const timeError = timeTouched ? (!normalizedStart || !normalizedEnd ? "Vui lòng chọn giờ bắt đầu và giờ kết thúc."
    : !rangeValid ? "Giờ kết thúc phải sau giờ bắt đầu." : "") : "";
  const periodError = rangeValid && !periodValid ? (form.period === "MORNING"
    ? "Giờ học không khớp với buổi Sáng. Buổi Sáng kết thúc lúc 12:00."
    : "Giờ học không khớp với buổi Chiều. Buổi Chiều bắt đầu từ 12:00.") : "";
  const historicalMismatch = session && !isPeriodTimeConsistent(session.period, session.startTime, session.endTime);
  const futurePlanned = Boolean(session && session.status === "planned" && !isSessionPast(session));
  const pendingConfirmation = Boolean(session && session.status === "planned" && isSessionPast(session));
  const editable = Boolean(canEdit && displayOffering?.status !== "completed" && (!session || (futurePlanned && editing)));
  const canManageFuture = Boolean(canEdit && displayOffering?.status !== "completed" && futurePlanned);
  const canConfirm = Boolean(canEdit && displayOffering?.status !== "completed" && pendingConfirmation);

  const overlappingSessions = useMemo(() => periodValid ? sessions.filter((item) => (
    item.id !== session?.id
    && item.status !== "not_held"
    && item.sessionDate === form.sessionDate
    && timesOverlap(`${normalizedStart}:00`, `${normalizedEnd}:00`, item.startTime.length === 5 ? `${item.startTime}:00` : item.startTime, item.endTime.length === 5 ? `${item.endTime}:00` : item.endTime)
  )) : [], [normalizedEnd, form.sessionDate, normalizedStart, periodValid, session?.id, sessions]);

  const roomOptions = useMemo(() => {
    if (!session?.room || rooms.some((room) => room.id === session.room.id)) return rooms;
    return [...rooms, { ...session.room, isActive: false }];
  }, [rooms, session]);
  const availability = useMemo(() => roomOptions.map((room) => {
    const conflict = overlappingSessions.find((item) => item.roomId === room.id) || null;
    const inactive = room.isActive === false;
    const missingCapacity = room.capacity === null || room.capacity === undefined;
    const tooSmall = !missingCapacity && room.capacity < participantCount;
    return { room, conflict, inactive, missingCapacity, tooSmall };
  }), [overlappingSessions, participantCount, roomOptions]);
  const groupedRooms = useMemo(() => {
    const groups = new Map();
    [...availability]
      .sort((left, right) => (getRoomFloor(left.room.code) ?? 99) - (getRoomFloor(right.room.code) ?? 99) || String(left.room.code).localeCompare(String(right.room.code), "vi", { numeric: true }))
      .forEach((item) => {
        const floor = getRoomFloor(item.room.code);
        const key = floor === null ? "unknown" : String(floor);
        const values = groups.get(key) || [];
        values.push(item);
        groups.set(key, values);
      });
    return [...groups.entries()];
  }, [availability]);

  const lecturerAvailability = useMemo(() => lecturers.map((lecturer) => ({
    lecturer,
    conflict: overlappingSessions.find((item) => item.lecturerId === lecturer.id) || null,
  })), [lecturers, overlappingSessions]);
  const chosenRoom = roomOptions.find((room) => room.id === form.roomId) || session?.room;
  const selectedRoomState = availability.find(({ room }) => room.id === form.roomId);
  const selectedRoomConflict = selectedRoomState?.conflict || null;
  const selectedRoomUnavailable = Boolean(selectedRoomState?.inactive || selectedRoomState?.missingCapacity || selectedRoomState?.tooSmall);
  const selectedLecturerConflict = lecturerAvailability.find(({ lecturer }) => lecturer.id === form.lecturerId)?.conflict || null;
  const currentLecturerMissing = session?.lecturer && !lecturers.some((lecturer) => lecturer.id === session.lecturer.id);

  const setField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setValidationError("");
  };
  const chooseTime = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setTimeTouched(true);
    setValidationError("");
  };
  const submit = () => {
    setTimeTouched(true);
    if (!normalizedStart || !normalizedEnd) return;
    if (!rangeValid) { setValidationError("Giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (!periodValid) { setValidationError(periodError); return; }
    if (!form.sessionDate || !form.period || !form.startTime || !form.endTime || !form.lecturerId || !form.roomId) {
      setValidationError("Vui lòng nhập đủ ngày, buổi, thời gian, giảng viên và phòng học.");
      return;
    }
    if (form.sessionDate < getBusinessTodayKey() || isSessionPast({ ...form, endTime: normalizedEnd })) {
      setValidationError("Không thể xếp lịch vào một buổi học đã kết thúc.");
      return;
    }
    if (selectedLecturerConflict) {
      setValidationError("Giảng viên đã chọn đang bận trong khoảng thời gian này. Vui lòng chọn giảng viên khác.");
      return;
    }
    if (selectedRoomConflict) {
      setValidationError(`Phòng ${chosenRoom?.code || "đã chọn"} đang bận trong khoảng thời gian này. Vui lòng chọn phòng khác.`);
      return;
    }
    if (selectedRoomUnavailable) {
      setValidationError(selectedRoomState?.inactive ? "Phòng đã chọn đang ngừng sử dụng." : selectedRoomState?.missingCapacity ? "Phòng đã chọn chưa khai báo sức chứa." : `Phòng ${chosenRoom?.code} không đủ sức chứa cho ${participantCount} học viên.`);
      return;
    }
    onSubmit({ ...form, startTime: normalizedStart, endTime: normalizedEnd, note: form.note.trim() || null });
  };

  const title = !session ? "XẾP BUỔI" : (editing ? "CHỈNH SỬA LỊCH" : "CHI TIẾT BUỔI HỌC");

  return (
    <>
      <Dialog
        open={open}
        onClose={saving ? undefined : onClose}
        fullWidth
        maxWidth="lg"
        aria-labelledby="session-composer-title"
        PaperProps={{ "data-scheduling-typography": "compact", sx: { ...schedulingTypographySx, width: "min(1180px, calc(100vw - 48px))", height: "min(760px, calc(100vh - 32px))", maxHeight: "calc(100vh - 32px)", overflow: "hidden" } }}
      >
        <DialogTitle id="session-composer-title" component="div" sx={{ p: "18px 20px 14px" }}>
          <Typography variant="caption" sx={{ "&&": { color: "#607784", ...schedulingType.eyebrow } }}>{title}{form.sessionDate ? ` · ${vietnameseDate(form.sessionDate)}` : ""}</Typography>
          <Typography variant="h4" sx={{ "&&": { ...schedulingType.drawerTitle, mt: 0.25, color: "#1C3B51" } }}>{displayOffering?.subject?.code} · {displayOffering?.subject?.name}</Typography>
          <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.3, color: "#5C6F7B", fontSize: 11, fontWeight: 400 } }}>{groupLabel(displayOffering) || "Chưa có nhóm học viên"} · {participantCount} học viên</Typography>
        </DialogTitle>

        <DialogContent sx={{ p: "0 !important", minHeight: 0, overflow: "hidden" }}>
          <Box sx={{ height: "100%", minHeight: 0, display: "grid", gridTemplateColumns: { xs: "1fr", md: "42% 58%" }, overflow: "hidden" }}>
            <Box sx={{ minHeight: 0, p: 1.75, overflowY: "auto", bgcolor: "#FFFFFF" }}>
              {availabilityLoading && <Alert severity="info" sx={{ mb: 1 }}>Đang tải lịch toàn Viện cho tuần của buổi học...</Alert>}
              {session && !editing && <Box sx={{ mb: 1.2, p: 0.85, borderLeft: `3px solid ${pendingConfirmation ? "#CD8810" : "#7E9EB3"}`, bgcolor: pendingConfirmation ? "#FFF6DD" : "#EEF4F7", color: "#526875", fontSize: 11 }}>{pendingConfirmation ? "Buổi học đã kết thúc · Chờ xác nhận kết quả diễn ra." : futurePlanned ? "Buổi học đã xếp · Có thể chỉnh sửa trước khi kết thúc." : "Buổi học đã xác nhận · Chế độ chỉ xem."}</Box>}
              {historicalMismatch && <Alert severity="warning" sx={{ mb: 1 }}>Dữ liệu hiện tại có giờ học không khớp với buổi {session.period === "MORNING" ? "Sáng" : "Chiều"}. Hãy chỉnh lại trước khi lưu thay đổi.</Alert>}
              {editable && periodError && <Alert severity="error" sx={{ mb: 1 }}>{periodError}</Alert>}
              {(validationError || serverError) && <Box role="alert" sx={{ mb: 1.2, p: 1, border: "1px solid #D99191", borderLeft: "3px solid #B4232B", bgcolor: "#FFF0F0", color: "#842027", fontSize: 12, lineHeight: 1.45, whiteSpace: "pre-line" }}><strong>Không thể lưu:</strong><br />{validationError || serverError}</Box>}

              <Typography variant="caption" sx={{ "&&": { color: "#506570", ...schedulingType.eyebrow } }}>THỜI GIAN</Typography>
              <Box sx={{ mt: 0.7 }}><FieldLabel>Ngày học</FieldLabel><TextField type="date" size="small" fullWidth value={form.sessionDate} onChange={setField("sessionDate")} disabled={!editable} inputProps={{ "aria-label": "Ngày học", min: weekFrom, max: weekTo }} /></Box>
              <Box sx={{ mt: 0.75 }}>
                <FieldLabel>Buổi</FieldLabel>
                <Box aria-label="Buổi" sx={{ height: 34, border: "1px solid #c5d0d8", bgcolor: "#f5f8fa", px: "10px", display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 600, color: "#24475d" }}>{periodLabel(form.period)}</Box>
                {form.period === "AFTERNOON" && <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.5, color: "#647784" } }}>Buổi tối thuộc Chiều</Typography>}
              </Box>
              <DigitalTimePicker key={`${session?.id || "create"}:${initialDate}:${initialPeriod}`} period={form.period} startTime={form.startTime} endTime={form.endTime} disabled={!editable} error={timeError} onChange={chooseTime} />
              {timeError && <Typography id="session-time-error" role="alert" sx={{ "&&": { mt: 0.5, color: "#b4232b", fontSize: 12 } }}>{timeError}</Typography>}

              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" sx={{ "&&": { color: "#506570", ...schedulingType.eyebrow } }}>THÀNH PHẦN · READ ONLY</Typography>
                <Stack spacing={0.55} sx={{ mt: 0.65 }}>{offeringGroups(displayOffering).map((group) => <Paper key={group.id} variant="outlined" sx={{ px: 1, py: 0.75 }}><Typography variant="body2" sx={{ "&&": { fontWeight: 700 } }}>{group.code} · {group.name}</Typography><Typography variant="caption">{group.major?.name || "Chưa có ngành"} · {group.academicYear || "-"}{group.term ? ` · ${group.term}` : ""}</Typography></Paper>)}</Stack>
              </Box>

              <Box sx={{ mt: 1.5 }}><FieldLabel>Giảng viên</FieldLabel><FormControl size="small" fullWidth disabled={!editable || !periodValid || availabilityLoading}><Select MenuProps={{ PaperProps: { sx: schedulingTypographySx } }} inputProps={{ "aria-label": "Giảng viên" }} value={form.lecturerId} onChange={setField("lecturerId")}>
                {currentLecturerMissing && <MenuItem value={session.lecturer.id} disabled>{session.lecturer.code} · {session.lecturer.name} (ngừng sử dụng)</MenuItem>}
                {lecturerAvailability.map(({ lecturer, conflict }) => <MenuItem key={lecturer.id} value={lecturer.id} disabled={Boolean(conflict)}>{lecturer.code} · {lecturer.name}{conflict ? ` · Đang bận ${shortTime(conflict.startTime)}–${shortTime(conflict.endTime)}` : ""}</MenuItem>)}
              </Select></FormControl></Box>
              {!periodValid && <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.5, color: "#647784" } }}>Chọn thời gian để kiểm tra giảng viên.</Typography>}
              {selectedLecturerConflict && editable && <Alert severity="warning" sx={{ mt: 0.75 }}>Giảng viên đã chọn vừa trở thành bận. Hãy chọn giảng viên khác.</Alert>}
              <Box sx={{ mt: 1 }}><FieldLabel>Ghi chú</FieldLabel><TextField multiline minRows={3} size="small" fullWidth value={form.note} onChange={setField("note")} disabled={!editable} inputProps={{ "aria-label": "Ghi chú", maxLength: 2000 }} /></Box>
            </Box>

            <Box sx={{ minHeight: 0, p: 1.75, overflowY: "auto", borderLeft: { md: "1px solid #D2DCE3" }, bgcolor: "#F4F7F9" }}>
              <Typography variant="caption" sx={{ "&&": { color: "#506570", ...schedulingType.eyebrow } }}>PHÒNG HỌC TOÀN VIỆN</Typography>
              <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.3, color: "#6A7D88" } }}>{form.sessionDate ? vietnameseDate(form.sessionDate) : "Chưa chọn ngày"} · {periodLabel(form.period)}{rangeValid ? ` · ${form.startTime}–${form.endTime}` : ""}</Typography>
              {!periodValid && <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.8, color: "#647784" } }}>Chọn giờ bắt đầu và kết thúc để kiểm tra tình trạng phòng.</Typography>}
              {selectedRoomConflict && editable && <Alert severity="warning" sx={{ mt: 0.8 }}>Phòng đã chọn vừa trở thành bận. Hãy chọn phòng khác trước khi lưu.</Alert>}
              {roomOptions.length === 0 ? <Alert severity="warning" sx={{ mt: 1 }}>Chưa có phòng học đang hoạt động.</Alert> : groupedRooms.map(([floor, floorRooms]) => (
                <Box key={floor} sx={{ mt: 1.2 }}>
                  <Typography variant="caption" sx={{ "&&": { color: "#284C62", fontWeight: 700 } }}>{floor === "unknown" ? "TẦNG CHƯA XÁC ĐỊNH" : `TẦNG ${floor}`}</Typography>
                  <Box sx={{ mt: 0.55, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(145px, 1fr))", lg: "repeat(3, minmax(145px, 1fr))" }, gap: 0.75 }}>
                    {floorRooms.map(({ room, conflict, inactive, missingCapacity, tooSmall }) => {
                      const busy = Boolean(conflict);
                      const selected = form.roomId === room.id;
                      const state = !periodValid || availabilityLoading ? "time-required" : inactive ? "inactive" : busy ? "busy" : missingCapacity ? "no-capacity" : tooSmall ? "too-small" : selected ? "selected" : "available";
                      const palette = roomPalette[state];
                      const disabled = !editable || !["available", "selected"].includes(state);
                      const stateLabel = state === "inactive" ? "NGỪNG SỬ DỤNG" : state === "time-required" ? "CHỜ KIỂM TRA" : state === "busy" ? "ĐÃ DÙNG" : state === "no-capacity" ? "CHƯA KHAI BÁO SỨC CHỨA" : state === "too-small" ? "KHÔNG ĐỦ" : state === "selected" ? "ĐÃ CHỌN" : "TRỐNG";
                      const ariaPrefix = state === "inactive" ? "Phòng ngừng sử dụng" : state === "time-required" ? "Phòng chờ thời gian" : state === "busy" ? "Phòng bận" : state === "no-capacity" ? "Phòng chưa có sức chứa" : state === "too-small" ? "Phòng không đủ sức chứa" : "Chọn phòng";
                      return (
                        <Box key={room.id} data-room-state={state} style={{ borderColor: palette.border, backgroundColor: palette.background }} sx={{ border: state === "selected" ? "2px solid" : "1px solid" }}>
                          <Button fullWidth disabled={disabled} onClick={() => { setForm((current) => ({ ...current, roomId: room.id })); setValidationError(""); }} aria-label={`${ariaPrefix} ${room.code}`} sx={{ "&&": { minHeight: 76, display: "block", p: 0.9, color: "#1F4158", textAlign: "left", borderRadius: 0, cursor: disabled ? "not-allowed" : "pointer", pointerEvents: "auto", "&.Mui-disabled": { color: "#596A74", pointerEvents: "auto" }, "&:hover": { bgcolor: state === "available" ? "#EAF5FB" : undefined } } }}>
                            <Stack direction="row" spacing={0.7} alignItems="center"><MeetingRoomRounded sx={{ fontSize: 19 }} /><Typography variant="body2" sx={{ "&&": { fontSize: 13, fontWeight: 700 } }}>{room.code}</Typography></Stack>
                            <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.2 } }}>{room.name}</Typography>
                            <Typography variant="caption" sx={{ "&&": { display: "block" } }}>{missingCapacity ? "Chưa khai báo" : tooSmall ? `${room.capacity} chỗ / lớp ${participantCount} HV` : `${room.capacity} chỗ`}</Typography>
                            <Typography variant="caption" sx={{ "&&": { display: "block", mt: 0.35, color: palette.color, fontSize: 10, fontWeight: 700 } }}>{stateLabel}</Typography>
                          </Button>
                          {busy && <Box sx={{ px: 0.85, py: 0.65, borderTop: "1px solid #DED4B7", bgcolor: "#FFF8E5" }}><Typography variant="caption" sx={{ "&&": { display: "block", fontWeight: 700 } }}>{shortTime(conflict.startTime)}–{shortTime(conflict.endTime)} · {conflict.courseOffering?.subject?.code || "Buổi học"}</Typography><Typography variant="caption" sx={{ "&&": { display: "block" } }}>{groupLabel(conflict.courseOffering) || "Chưa có nhóm"} · {conflict.lecturer?.name || "Chưa có giảng viên"}</Typography></Box>}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ minHeight: 58, p: "12px 15px", gap: 0.5 }}>
          <Typography variant="body2" sx={{ "&&": { mr: "auto", color: "#4E6471" } }}>Phòng: <strong>{chosenRoom?.code || "Chưa chọn"}</strong></Typography>
          {session && !editing && <Button startIcon={<VisibilityRounded />} onClick={() => onViewOffering(displayOffering)} disabled={saving}>Xem lớp học phần</Button>}
          {canManageFuture && !editing && <Button startIcon={<EditRounded />} variant="outlined" onClick={() => setEditing(true)} disabled={saving}>Chỉnh sửa lịch</Button>}
          {canManageFuture && !editing && <Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => setConfirmDelete(true)} disabled={saving}>Xóa khỏi lịch</Button>}
          {canConfirm && <Button color="warning" variant="outlined" onClick={() => onConfirm("not_held")} disabled={saving}>Không diễn ra</Button>}
          {canConfirm && <Button color="success" variant="outlined" onClick={() => onConfirm("held")} disabled={saving}>✓ Đã diễn ra</Button>}
          <Button onClick={editing && session ? () => setEditing(false) : onClose} disabled={saving}>{editing ? "Hủy" : "Đóng"}</Button>
          {editable && <Button variant="contained" startIcon={<CheckCircleRounded />} onClick={submit} disabled={saving || Boolean(periodError) || Boolean(normalizedStart && normalizedEnd && !rangeValid)}>{saving ? "Đang lưu..." : (session ? "Lưu thay đổi" : "Lưu lịch")}</Button>}
        </DialogActions>
      </Dialog>

      <Dialog PaperProps={{ sx: schedulingTypographySx }} open={confirmDelete} onClose={() => !saving && setConfirmDelete(false)} aria-labelledby="delete-session-title">
        <DialogTitle id="delete-session-title">Xóa buổi học khỏi lịch?</DialogTitle>
        <DialogContent><DialogContentText>Buổi học đã xếp sẽ bị xóa. Lớp học phần vẫn được giữ nguyên.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setConfirmDelete(false)} disabled={saving}>Hủy</Button><Button color="error" variant="contained" onClick={onDelete} disabled={saving}>Xác nhận xóa</Button></DialogActions>
      </Dialog>
    </>
  );
};

export default SessionComposer;
