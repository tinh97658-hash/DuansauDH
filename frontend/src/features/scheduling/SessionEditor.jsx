import React, { useState } from "react";
import { api, groupsOf, labelOf, message, Modal, Notice, rows, useLoad } from "./shared";
import { getBusinessTodayKey, getRoomFloor, isPeriodTimeConsistent, isSessionPast, shortTime, timesOverlap, vietnameseDate } from "../../utils/schedulingCalendar";

const periodTimes = (period) => period === "AFTERNOON"
  ? { startTime: "13:00", endTime: "17:00" }
  : { startTime: "07:00", endTime: "12:00" };

export default function SessionEditor({ session, offering, date, period, user, onClose, onSaved, onViewOffering }) {
  const [form, setForm] = useState({ sessionDate: session?.sessionDate || date, period: session?.period || period,
    ...(session ? { startTime: shortTime(session.startTime), endTime: shortTime(session.endTime) } : periodTimes(period)), lecturerId: session?.lecturerId || "", roomId: session?.roomId || "", note: session?.note || "" });
  const [editing, setEditing] = useState(!session);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const catalog = useLoad(async () => {
    const [lecturers, rooms, detail] = await Promise.all([api.get("/system/lecturers"), api.get("/system/rooms?includeInactive=true"), api.get(`/scheduling/course-offerings/${offering.id}`)]);
    return { lecturers: rows(lecturers), rooms: rows(rooms), offering: detail };
  }, [offering.id]);
  const availability = useLoad(async () => rows(await api.get(`/scheduling/teaching-sessions?${new URLSearchParams({ from: form.sessionDate, to: form.sessionDate })}`)), [form.sessionDate]);
  const currentOffering = catalog.data?.offering || offering;
  const future = session?.status === "planned" && !isSessionPast(session);
  const pending = session?.status === "planned" && isSessionPast(session);
  const canManage = user.canManageScheduling === true && currentOffering.status !== "completed";
  const editable = canManage && editing && (!session || future);
  const validTime = isPeriodTimeConsistent(form.period, form.startTime, form.endTime);
  const conflicts = validTime ? (availability.data || []).filter((row) => row.id !== session?.id && row.status !== "not_held" && timesOverlap(`${form.startTime}:00`, `${form.endTime}:00`, row.startTime.length === 5 ? `${row.startTime}:00` : row.startTime, row.endTime.length === 5 ? `${row.endTime}:00` : row.endTime)) : [];
  const ownGroups = new Set(groupsOf(currentOffering).map((group) => group.id));
  const classConflict = conflicts.find((row) => row.courseOfferingId === offering.id || groupsOf(row.courseOffering).some((group) => ownGroups.has(group.id)));
  const lecturers = catalog.data?.lecturers || [];
  const rooms = catalog.data?.rooms || [];
  const roomReason = (room) => room.isActive === false ? "Ngừng sử dụng" : room.capacity == null ? "Chưa có sức chứa" : room.capacity < (currentOffering.participantCount || 0) ? "Không đủ chỗ" : conflicts.some((row) => row.roomId === room.id) ? "Đang bận" : "";
  const floors = [...new Set(rooms.map((room) => getRoomFloor(room.code)))].sort((a, b) => (a ?? 99) - (b ?? 99));
  const setField = (name, value) => { setForm((current) => ({ ...current, [name]: value, ...(name === "period" ? periodTimes(value) : {}) })); setError(""); };
  const mutate = async (action) => {
    setSaving(true); setError("");
    try { await action(); onSaved(); }
    catch (failure) { setError(message(failure)); availability.reload(); }
    finally { setSaving(false); }
  };
  const save = () => {
    if (!editable || saving) return;
    if (!validTime) return setError("Khung giờ của buổi học không hợp lệ. Vui lòng chọn lại buổi.");
    if (!form.lecturerId || !form.roomId) return setError("Vui lòng chọn giảng viên và phòng học.");
    if (isSessionPast(form)) return setError("Không thể xếp lịch vào buổi học đã kết thúc.");
    if (classConflict) return setError("Lớp / nhóm đã có lịch trong khoảng thời gian này.");
    const room = rooms.find((item) => item.id === form.roomId);
    if (!room || roomReason(room)) return setError("Phòng đã chọn không còn phù hợp.");
    if (!lecturers.some((row) => row.id === form.lecturerId && row.active !== false)) return setError("Vui lòng chọn giảng viên đang hoạt động.");
    if (conflicts.some((row) => row.lecturerId === form.lecturerId)) return setError("Giảng viên đã có lịch trong khoảng thời gian này.");
    mutate(() => session ? api.put(`/scheduling/teaching-sessions/${session.id}`, form) : api.post("/scheduling/teaching-sessions", { ...form, courseOfferingId: offering.id }));
  };
  return <Modal wide title={`${!session ? "XẾP BUỔI" : editing ? "CHỈNH SỬA LỊCH" : "CHI TIẾT BUỔI HỌC"} · ${vietnameseDate(form.sessionDate)}`} onClose={onClose} busy={saving} actions={<>
    {canManage && future && !editing && <><button className="sl-btn sl-btn-danger" disabled={saving} onClick={() => setDeleting(true)}>Xóa buổi học</button><button className="sl-btn" onClick={() => setEditing(true)}>Chỉnh sửa</button></>}
    {canManage && pending && <><button className="sl-btn" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: "not_held" }))}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: "held" }))}>Đã diễn ra</button></>}
    <button className="sl-btn" disabled={saving} onClick={onClose}>Đóng</button>{editable && <button className="sl-btn sl-btn-primary" disabled={saving || catalog.loading || availability.loading || !!catalog.error || !!availability.error} onClick={save}>{saving ? "Đang lưu..." : "Lưu buổi học"}</button>}
  </>}>
    <h3>{currentOffering.subject?.code} · {currentOffering.subject?.name}</h3><p>{labelOf(currentOffering)} · {currentOffering.participantCount ?? "…"} học viên</p>
    {error && <Notice error={error} />}{catalog.error && <Notice error={catalog.error} />}{availability.error && <Notice error={availability.error} />}
    {pending && <div className="sl-attention">Buổi học đã kết thúc · Chờ xác nhận kết quả diễn ra.</div>}
    <div className="v20-composer"><div><h4>THỜI GIAN</h4>
      <label className="v20-field">Ngày học<input aria-label="Ngày học" type="date" min={getBusinessTodayKey()} value={form.sessionDate} disabled={!editable || saving} onChange={(event) => { if (event.target.value) setField("sessionDate", event.target.value); }} /></label>
      <label className="v20-field">Buổi<select aria-label="Buổi" value={form.period} disabled={!editable || saving} onChange={(event) => setField("period", event.target.value)}><option value="MORNING">Sáng</option><option value="AFTERNOON">Chiều</option></select></label>
      <p className="v20-hint">Khung giờ buổi học: {form.startTime}–{form.endTime}</p>
      <label className="v20-field">Giảng viên<select aria-label="Giảng viên" value={form.lecturerId} disabled={!editable || catalog.loading || !!catalog.error || saving} onChange={(event) => setField("lecturerId", event.target.value)}><option value="">Chọn giảng viên</option>{lecturers.filter((row) => row.active !== false || row.id === form.lecturerId).map((row) => { const busy = conflicts.some((item) => item.lecturerId === row.id); return <option key={row.id} value={row.id} disabled={busy || row.active === false}>{row.name}{busy ? " · Đang bận" : ""}</option>; })}</select></label>
      {!catalog.loading && !catalog.error && !lecturers.some((row) => row.active !== false) && <Notice>Chưa có giảng viên đang hoạt động. Khai báo tại Hệ thống → Giảng viên.</Notice>}
      <label className="v20-field">Ghi chú<textarea aria-label="Ghi chú buổi học" maxLength={2000} value={form.note} disabled={!editable || saving} onChange={(event) => setField("note", event.target.value)} /></label>
      {classConflict && <Notice error={`Lớp / nhóm đang bận: ${classConflict.courseOffering?.subject?.name || "Buổi học khác"} · ${shortTime(classConflict.startTime)}–${shortTime(classConflict.endTime)}`} />}
      <button className="sl-btn sl-btn-link" onClick={() => onViewOffering(currentOffering)}>Xem chi tiết lớp học phần</button>
    </div><section><h4>CHỌN PHÒNG HỌC</h4><p className="v20-hint">Phòng học được kiểm tra theo ngày và buổi đã chọn.</p>
      {(catalog.loading || availability.loading) && <Notice>Đang kiểm tra phòng và giảng viên...</Notice>}
      {floors.map((floor) => <div className="v20-room-floor" key={floor ?? "other"}><h4>{floor == null ? "Phòng khác" : `Tầng ${floor}`}</h4><div className="v20-room-grid">{rooms.filter((room) => getRoomFloor(room.code) === floor).map((room) => { const reason = roomReason(room); return <button key={room.id} aria-pressed={form.roomId === room.id} className={`v20-room ${form.roomId === room.id ? "sl-on" : ""} ${reason === "Đang bận" ? "v20-busy" : reason ? "v20-unavailable" : ""}`} disabled={!editable || saving || !validTime || availability.loading || !!availability.error || !!reason} onClick={() => setField("roomId", room.id)}><strong>{room.code}</strong><span>{room.capacity == null ? "Chưa khai báo sức chứa" : `${room.capacity} chỗ`}</span><small>{reason || (validTime ? "Có thể chọn" : "Chờ chọn giờ")}</small></button>; })}</div></div>)}
      {!catalog.loading && !rooms.length && <Notice>Chưa có phòng học. Quản trị viên khai báo tại Hệ thống → Phòng học.</Notice>}
    </section></div>
    {deleting && <Modal title="Xóa buổi học" busy={saving} onClose={() => setDeleting(false)} actions={<><button className="sl-btn" disabled={saving} onClick={() => setDeleting(false)}>Hủy</button><button className="sl-btn sl-btn-danger" disabled={saving} onClick={() => mutate(() => api.delete(`/scheduling/teaching-sessions/${session.id}`))}>Xác nhận xóa</button></>}><p>Xóa buổi học ngày {vietnameseDate(session.sessionDate)} khỏi lịch?</p>{error && <Notice error={error} />}</Modal>}
  </Modal>;
}
