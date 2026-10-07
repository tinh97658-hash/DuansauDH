import React, { useEffect, useRef, useState } from "react";
import { api, groupsOf, message, Modal, normalize, Notice, offeringTitle, rows, subjectLabel, useLoad } from "./shared";
import { getBusinessTodayKey, getRoomFloor, isPeriodTimeConsistent, isSessionPast, vietnameseDate } from "../../utils/schedulingCalendar";
import { lecturerRecommendationRank, lecturerTeachingGroup, teachingMajorForOffering } from "../../utils/lecturerQualification";

const periodTimes = (period) => period === "AFTERNOON"
  ? { startTime: "13:00", endTime: "17:00" }
  : { startTime: "07:00", endTime: "12:00" };

const ROOM_CAPACITY_DEFICIT_LIMIT = 10;

function LecturerPicker({ value, lecturers, offering, conflicts, disabled, locked, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const selected = lecturers.find((item) => item.id === value);
  useEffect(() => {
    const close = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const available = lecturers.filter((row) => row.active !== false || row.id === value).map((row) => ({
    ...row,
    recommendationRank: lecturerRecommendationRank(row, offering),
    teachingGroup: lecturerTeachingGroup(row),
    busy: conflicts.some((item) => item.lecturerId === row.id),
  })).sort((a, b) => b.recommendationRank - a.recommendationRank
    || a.teachingGroup.localeCompare(b.teachingGroup, "vi")
    || a.name.localeCompare(b.name, "vi"));
  const visible = available.filter((row) => normalize(`${row.name} ${row.code || ""} ${row.discipline?.name || ""} ${row.major?.name || ""} ${row.teachingGroup}`).includes(normalize(query)));

  if (locked) return <div className="sl-fixed-lecturer" aria-label="Giảng viên cố định">
    <strong>{selected?.name || "Giảng viên đã phân công"}</strong>
    <span>{selected?.major ? selected.major.name : "Đã cố định theo buổi học đầu tiên"}</span>
    <small>Giảng viên cố định của lớp · Các buổi sau chỉ thay đổi phòng học</small>
  </div>;

  return <div className="sl-lecturer-picker" ref={wrapper}>
    <button type="button" className="sl-lecturer-trigger" aria-label="Giảng viên" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => { setQuery(""); setOpen((current) => !current); }}>
      <span>{selected?.name || "Chọn giảng viên"}</span><b aria-hidden="true">⌄</b>
    </button>
    {open && <div className="sl-lecturer-popover">
      <input autoFocus aria-label="Tìm giảng viên" placeholder="Tìm theo tên giảng viên..." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="sl-lecturer-list" role="listbox" aria-label="Danh sách giảng viên">
        {visible.map((row, index) => <React.Fragment key={row.id}>
          {(index === 0 || visible[index - 1].recommendationRank !== row.recommendationRank || visible[index - 1].teachingGroup !== row.teachingGroup) && <div className={`sl-lecturer-group ${row.recommendationRank === 2 ? "sl-recommended" : ""}`}>{row.teachingGroup}{row.recommendationRank === 2 ? " · Đề xuất" : row.recommendationRank === 1 ? " · Cùng ngành" : ""}</div>}
          <button type="button" role="option" aria-selected={row.id === value} disabled={row.busy || row.active === false} onClick={() => { onChange(row.id); setOpen(false); }}>
            <span><strong>{row.name}</strong><small>{row.discipline?.name || row.code || "Chưa khai báo ngành"}</small></span>
            <em>{row.busy ? "Đang bận" : row.recommendationRank === 2 ? "Đúng chuyên ngành" : row.recommendationRank === 1 ? "Cùng ngành" : "Ngành khác"}</em>
          </button>
        </React.Fragment>)}
        {!visible.length && <p>Không tìm thấy giảng viên phù hợp.</p>}
      </div>
    </div>}
  </div>;
}

export default function SessionEditor({ session, offering, date, period, user, onClose, onSaved, onViewOffering }) {
  const initialPeriod = session?.period || period;
  const [form, setForm] = useState({ sessionDate: session?.sessionDate || date, period: initialPeriod,
    ...periodTimes(initialPeriod), lecturerId: session?.lecturerId || "", roomId: session?.roomId || "", note: session?.note || "" });
  const [editing, setEditing] = useState(!session);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const catalog = useLoad(async () => {
    const [lecturers, rooms, detail, offeringSessions] = await Promise.all([api.get("/system/lecturers"), api.get("/system/rooms?includeInactive=true"), api.get(`/scheduling/course-offerings/${offering.id}`), api.get(`/scheduling/course-offerings/${offering.id}/teaching-sessions`)]);
    return { lecturers: rows(lecturers), rooms: rows(rooms), offering: detail, offeringSessions: Array.isArray(offeringSessions) ? offeringSessions : [] };
  }, [offering.id]);
  const availability = useLoad(async () => rows(await api.get(`/scheduling/teaching-sessions?${new URLSearchParams({ from: form.sessionDate, to: form.sessionDate })}`)), [form.sessionDate]);
  const currentOffering = catalog.data?.offering || offering;
  const sessionForPeriod = session ? { ...session, endTime: periodTimes(session.period).endTime } : null;
  const future = session?.status === "planned" && !isSessionPast(sessionForPeriod);
  const pending = session?.status === "planned" && isSessionPast(sessionForPeriod);
  const canManage = user.canManageScheduling === true && currentOffering.status !== "completed";
  const editable = canManage && editing && (!session || future);
  const validTime = isPeriodTimeConsistent(form.period, form.startTime, form.endTime);
  const conflicts = (availability.data || []).filter((row) => row.id !== session?.id && row.status !== "not_held" && row.period === form.period);
  const ownGroups = new Set(groupsOf(currentOffering).map((group) => group.id));
  const classConflict = conflicts.find((row) => row.courseOfferingId === offering.id || groupsOf(row.courseOffering).some((group) => ownGroups.has(group.id)));
  const lecturers = catalog.data?.lecturers || [];
  const rooms = catalog.data?.rooms || [];
  const teachingMajor = teachingMajorForOffering(currentOffering);
  const assignedSession = (catalog.data?.offeringSessions || []).find((row) => row.id !== session?.id);
  const lecturerLocked = !!assignedSession;
  useEffect(() => {
    if (assignedSession?.lecturerId) setForm((current) => current.lecturerId === assignedSession.lecturerId ? current : { ...current, lecturerId: assignedSession.lecturerId });
  }, [assignedSession?.lecturerId]);
  const roomFloor = (room) => getRoomFloor(room.code) ?? (Number(String(room.code || "").match(/^[^0-9]*([0-9])/)?.[1] || NaN) || null);
  const roomReason = (room) => room.isActive === false ? "Ngừng sử dụng" : room.capacity == null ? "Chưa có sức chứa" : (currentOffering.participantCount || 0) - room.capacity >= ROOM_CAPACITY_DEFICIT_LIMIT ? "Không đủ chỗ" : conflicts.some((row) => row.roomId === room.id) ? "Đang bận" : "";
  const floors = [...new Set(rooms.map(roomFloor))].sort((a, b) => (a ?? 99) - (b ?? 99));
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
  const periodLabel = form.period === "MORNING" ? "SÁNG" : "CHIỀU";
  const roomStateLabel = (room) => {
    const reason = roomReason(room);
    if (reason === "Đang bận") return "ĐÃ CÓ LỊCH";
    if (reason === "Không đủ chỗ") return "KHÔNG ĐỦ CHỖ";
    if (reason === "Ngừng sử dụng") return "NGỪNG SỬ DỤNG";
    if (reason === "Chưa có sức chứa") return "CHƯA CÓ SỨC CHỨA";
    return "TRỐNG";
  };
  return <Modal wide hideHeader className="sl-session-editor-dialog" bodyClassName="sl-session-editor-body" title={`${!session ? "XẾP BUỔI" : editing ? "CHỈNH SỬA LỊCH" : "CHI TIẾT BUỔI HỌC"} · ${vietnameseDate(form.sessionDate)} · ${periodLabel}`} onClose={onClose} busy={saving} actions={<>
    {canManage && future && !editing && <><button className="sl-btn sl-btn-danger" disabled={saving} onClick={() => setDeleting(true)}>Xóa buổi học</button><button className="sl-btn" onClick={() => setEditing(true)}>Chỉnh sửa</button></>}
    {canManage && pending && <><button className="sl-btn" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: "not_held" }))}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: "held" }))}>Đã diễn ra</button></>}
    <button className="sl-btn" disabled={saving} onClick={onClose}>{editable ? "Hủy" : "Đóng"}</button>{editable && <button className="sl-btn sl-btn-primary" aria-label="Lưu buổi học" disabled={saving || catalog.loading || availability.loading || !!catalog.error || !!availability.error} onClick={save}>{saving ? "Đang lưu..." : "Lưu lịch"}</button>}
  </>}>
    <header className="sl-editor-hero"><div><div className="sl-eyebrow">{!session ? "XẾP BUỔI" : editing ? "CHỈNH SỬA LỊCH" : "CHI TIẾT BUỔI HỌC"} · {vietnameseDate(form.sessionDate)} · {periodLabel}</div><h2>{offeringTitle(currentOffering)}</h2><p>{subjectLabel(currentOffering)} · {groupsOf(currentOffering).length} lớp/nhóm · {currentOffering.participantCount ?? "…"} học viên</p></div><div className="sl-editor-hero-actions"><span>Đã diễn ra {currentOffering.sessionSummary?.heldCount || 0} buổi</span><button className="sl-drawer-close" aria-label="Đóng chi tiết buổi học" disabled={saving} onClick={onClose}>×</button></div></header>
    <div className="sl-editor-notices">{error && <Notice error={error} />}{catalog.error && <Notice error={catalog.error} />}{availability.error && <Notice error={availability.error} />}{pending && <div className="sl-attention">Buổi học đã kết thúc · Chờ xác nhận kết quả diễn ra.</div>}</div>
    <div className="v20-composer"><div className="sl-editor-info"><h4>THÔNG TIN BUỔI HỌC</h4><strong className="sl-editor-date">{vietnameseDate(form.sessionDate)} · {periodLabel}</strong>
      <div className="sl-editor-hidden-controls"><label>Ngày học<input aria-label="Ngày học" type="date" min={getBusinessTodayKey()} value={form.sessionDate} disabled={!editable || saving} onChange={(event) => { if (event.target.value) setField("sessionDate", event.target.value); }} /></label><label>Buổi<select aria-label="Buổi" value={form.period} disabled={!editable || saving} onChange={(event) => setField("period", event.target.value)}><option value="MORNING">Sáng</option><option value="AFTERNOON">Chiều</option></select></label></div>
      <label className="v20-field">Giảng viên<LecturerPicker value={form.lecturerId} lecturers={lecturers} offering={currentOffering} conflicts={conflicts} locked={lecturerLocked} disabled={!editable || catalog.loading || !!catalog.error || saving} onChange={(value) => setField("lecturerId", value)} />{teachingMajor && <small className="sl-teaching-unit-hint">Chuyên ngành của học phần: {teachingMajor.code ? `${teachingMajor.code} · ` : ""}{teachingMajor.name || "Đang xác định"}</small>}</label>
      {!catalog.loading && !catalog.error && !lecturers.some((row) => row.active !== false) && <Notice>Chưa có giảng viên đang hoạt động. Khai báo tại Hệ thống → Giảng viên.</Notice>}
      <label className="v20-field">Ghi chú<textarea aria-label="Ghi chú buổi học" placeholder="Nhập ghi chú..." maxLength={2000} value={form.note} disabled={!editable || saving} onChange={(event) => setField("note", event.target.value)} /></label>
      {classConflict && <Notice error={`Lớp / nhóm đang bận: ${classConflict.courseOffering?.subject?.name || "Buổi học khác"} · ${classConflict.period === "MORNING" ? "Sáng" : "Chiều"}`} />}
    </div><section className="sl-editor-rooms"><h4>PHÒNG HỌC TOÀN VIỆN</h4><p className="v20-hint">Tình trạng theo {vietnameseDate(form.sessionDate)} · {periodLabel}</p>
      {(catalog.loading || availability.loading) && <Notice>Đang kiểm tra phòng và giảng viên...</Notice>}
      {floors.map((floor) => <div className="v20-room-floor" key={floor ?? "other"}><h4>{floor == null ? "PHÒNG KHÁC" : `TẦNG ${floor}`}</h4><div className="v20-room-grid">{rooms.filter((room) => roomFloor(room) === floor).map((room) => { const reason = roomReason(room); return <button key={room.id} aria-pressed={form.roomId === room.id} className={`v20-room ${form.roomId === room.id ? "sl-on" : ""} ${reason === "Đang bận" ? "v20-busy" : reason ? "v20-unavailable" : ""}`} disabled={!editable || saving || !validTime || availability.loading || !!availability.error || !!reason} onClick={() => setField("roomId", room.id)}><strong>{room.code}</strong><span>{room.capacity == null ? "Chưa khai báo sức chứa" : `${room.capacity} chỗ`}</span><small>{roomStateLabel(room)}</small></button>; })}</div></div>)}
      {!catalog.loading && !rooms.length && <Notice>Chưa có phòng học. Quản trị viên khai báo tại Hệ thống → Phòng học.</Notice>}
    </section></div>
    {deleting && <Modal title="Xóa buổi học" busy={saving} onClose={() => setDeleting(false)} actions={<><button className="sl-btn" disabled={saving} onClick={() => setDeleting(false)}>Hủy</button><button className="sl-btn sl-btn-danger" disabled={saving} onClick={() => mutate(() => api.delete(`/scheduling/teaching-sessions/${session.id}`))}>Xác nhận xóa</button></>}><p>Xóa buổi học ngày {vietnameseDate(session.sessionDate)} khỏi lịch?</p>{error && <Notice error={error} />}</Modal>}
  </Modal>;
}
