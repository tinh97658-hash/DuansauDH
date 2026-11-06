import { XMarkIcon } from "../../components/AppIcons";
import AppSelect from "../../components/AppSelect";
import { usePermissions } from "../accounts/usePermissions";
import DateField from "../../components/DateField";
import React, { useEffect, useState } from "react";
import { notify } from "../../utils/notify";
import { api, groupsOf, message, Modal, Notice, offeringTitle, rows, SearchSelect, subjectLabel, useLoad } from "./shared";
import { getBusinessTodayKey, getRoomFloor, isPeriodTimeConsistent, isSessionPast, isSessionStartedInBusinessTimezone, periodTimes, vietnameseDate } from "../../utils/schedulingCalendar";
import { shouldSuggestClosing } from "./sessionWarning";
import { recommendedUnitForOffering } from "../../utils/lecturerQualification";

import LecturerPicker from "./LecturerPicker";

const ROOM_CAPACITY_DEFICIT_LIMIT = 10;
export default function SessionEditor({ session, offering, date, period, user, onClose, onSaved, onViewOffering }) {
  const { can } = usePermissions();
  const initialPeriod = session?.period || period;
  const [form, setForm] = useState({ sessionDate: session?.sessionDate || date, period: initialPeriod,
    ...periodTimes(initialPeriod), lecturerId: session?.lecturerId || "", roomId: session?.roomId || "", note: session?.note || "" });
  const [editing, setEditing] = useState(!session);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [unitFilter, setUnitFilter] = useState(null);
  const [roomManuallySelected, setRoomManuallySelected] = useState(false);
  const catalog = useLoad(async signal => {
    const [lecturers, units, rooms, detail, offeringSessions] = await Promise.all([api.get("/system/lecturers", { signal }), api.get("/system/units", { signal }), api.get("/system/rooms", { signal }), api.get(`/scheduling/course-offerings/${offering.id}`, { signal }), api.get(`/scheduling/course-offerings/${offering.id}/teaching-sessions`, { signal })]);
    const availableRooms = rows(rooms);
    // A historical room stays visible without requiring catalog administration access.
    const historicalRoom = session?.room;
    return { lecturers: rows(lecturers), units: rows(units), rooms: historicalRoom && !availableRooms.some(room => room.id === historicalRoom.id)
      ? [...availableRooms, { ...historicalRoom, isActive: false }] : availableRooms, offering: detail, offeringSessions: Array.isArray(offeringSessions) ? offeringSessions : [] };
  }, [offering.id, session?.id, session?.room]);
  const availability = useLoad(async signal => rows(await api.get(`/scheduling/teaching-sessions?${new URLSearchParams({ from: form.sessionDate, to: form.sessionDate, conflictForOfferingId: offering.id })}`, { signal })), [form.sessionDate, offering.id]);

  const currentOffering = catalog.data?.offering || offering;
  const sessionForPeriod = session ? { ...session, endTime: periodTimes(session.period).endTime } : null;
  const future = session?.status === "planned" && !isSessionPast(sessionForPeriod);
  const pending = session?.status === "planned" && isSessionPast(sessionForPeriod);
  const canManage = can("scheduling.write") && (currentOffering.canWriteSchedule ?? currentOffering.scopeWritable) !== false && currentOffering.status !== "completed";
  const suggestClosing = !session && shouldSuggestClosing(currentOffering);
  const editable = canManage && editing && (!session || future);
  const validTime = isPeriodTimeConsistent(form.period, form.startTime, form.endTime);
  const conflicts = (availability.data || []).filter((row) => row.id !== session?.id && row.status !== "not_held" && row.period === form.period);
  const ownGroups = new Set(groupsOf(currentOffering).map((group) => group.id));
  const classConflict = conflicts.find((row) => row.schedulingConflict || row.courseOfferingId === offering.id || groupsOf(row.courseOffering).some((group) => ownGroups.has(group.id)));
  const lecturers = catalog.data?.lecturers || [];
  const rooms = catalog.data?.rooms || [];
  const recommendedUnit = recommendedUnitForOffering(currentOffering);
  const assignedSession = (catalog.data?.offeringSessions || []).find((row) => row.id !== session?.id);
  const lecturerLocked = !!assignedSession;
  const selectedLecturer = lecturers.find((row) => row.id === (assignedSession?.lecturerId || form.lecturerId));
  const selectedUnitId = lecturerLocked ? selectedLecturer?.unitId || "" : unitFilter ?? selectedLecturer?.unitId ?? "";
  const units = (catalog.data?.units || []).filter((unit) => unit.active !== false || unit.id === selectedUnitId)
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  const filteredLecturers = lecturerLocked || !selectedUnitId ? lecturers : lecturers.filter((row) => row.unitId === selectedUnitId);
  useEffect(() => {
    if (assignedSession?.lecturerId) setForm((current) => current.lecturerId === assignedSession.lecturerId ? current : { ...current, lecturerId: assignedSession.lecturerId });
  }, [assignedSession?.lecturerId]);
  const roomFloor = (room) => getRoomFloor(room.code) ?? (Number(String(room.code || "").match(/^[^0-9]*([0-9])/)?.[1] || NaN) || null);
  const roomReason = (room) => room.isActive === false ? "Ngừng sử dụng" : room.capacity == null ? "Chưa có sức chứa" : (currentOffering.participantCount || 0) - room.capacity >= ROOM_CAPACITY_DEFICIT_LIMIT ? "Không đủ chỗ" : conflicts.some((row) => row.roomId === room.id) ? "Đang bận" : "";
  const firstRoomSession = [...(catalog.data?.offeringSessions || [])]
    .filter(row => row.roomId && row.status !== "not_held" && (!row.courseOfferingId || row.courseOfferingId === offering.id))
    .sort((left, right) => {
      const slot = row => `${String(row.sessionDate || "9999-12-31").slice(0, 10)}T${row.startTime || periodTimes(row.period).startTime}`;
      return slot(left).localeCompare(slot(right)) || String(left.id || "").localeCompare(String(right.id || ""));
    })[0];
  const suggestedRoom = rooms.find(room => room.id === firstRoomSession?.roomId);
  const suggestedRoomReason = firstRoomSession ? suggestedRoom ? roomReason(suggestedRoom) : "Phòng không còn trong danh mục" : "";
  const suggestedRoomId = suggestedRoom && !suggestedRoomReason && validTime ? suggestedRoom.id : "";
  useEffect(() => {
    // Suggest only for a new session, after checking the target slot. A manual
    // choice remains the user's choice when notes, dates or availability refresh.
    if (session || roomManuallySelected || !editable || catalog.loading || availability.loading || catalog.error || availability.error) return;
    setForm(current => current.roomId === suggestedRoomId ? current : { ...current, roomId: suggestedRoomId });
  }, [session, roomManuallySelected, editable, catalog.loading, catalog.error, availability.loading, availability.error, suggestedRoomId]);
  const floors = [...new Set(rooms.map(roomFloor))].sort((a, b) => (a ?? 99) - (b ?? 99));
  const setField = (name, value) => { if (name === "roomId") setRoomManuallySelected(true); setForm((current) => ({ ...current, [name]: value, ...(name === "period" ? periodTimes(value) : {}) })); setError(""); };
  const selectUnit = (unitId) => {
    setUnitFilter(unitId);
    if (unitId && selectedLecturer?.unitId !== unitId) setField("lecturerId", "");
  };
  const selectLecturer = (lecturerId) => {
    setUnitFilter(lecturers.find((row) => row.id === lecturerId)?.unitId || "");
    setField("lecturerId", lecturerId);
  };
  const mutate = async (action) => {
    setSaving(true); setError("");
    try { await action(); onSaved(); }
    catch (failure) { notify.error(message(failure)); availability.reload(); }
    finally { setSaving(false); }
  };
  const save = () => {
    if (!editable || saving) return;
    if (!validTime) return setError("Khung giờ của buổi học không hợp lệ. Vui lòng chọn lại buổi.");
    if (!form.lecturerId || !form.roomId) return setError("Vui lòng chọn giảng viên và phòng học.");
    const movingSlot = !session || form.sessionDate !== session.sessionDate || form.period !== session.period ||
      form.startTime.slice(0, 5) !== (session.startTime || periodTimes(session.period).startTime).slice(0, 5);
    if (movingSlot && isSessionStartedInBusinessTimezone(form)) return setError("Không thể xếp lịch vào buổi học đã bắt đầu.");
    if (!movingSlot && isSessionPast(form)) return setError("Không thể xếp lịch vào buổi học đã kết thúc.");
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
    <header className="sl-editor-hero"><div><div className="sl-eyebrow">{!session ? "XẾP BUỔI" : editing ? "CHỈNH SỬA LỊCH" : "CHI TIẾT BUỔI HỌC"} · {vietnameseDate(form.sessionDate)} · {periodLabel}</div><h2>{offeringTitle(currentOffering)}</h2><p>{subjectLabel(currentOffering)} · {groupsOf(currentOffering).length} lớp/nhóm · {currentOffering.participantCount ?? "…"} học viên</p></div><div className="sl-editor-hero-actions"><span>Đã diễn ra {currentOffering.sessionSummary?.heldCount || 0} buổi</span><button className="sl-drawer-close" aria-label="Đóng chi tiết buổi học" disabled={saving} onClick={onClose}><XMarkIcon fontSize="small" /></button></div></header>
    <div className="sl-editor-notices">{error && <Notice error={error} />}{catalog.error && <Notice error={catalog.error} />}{availability.error && <Notice error={availability.error} />}{suggestClosing && <Notice>Đã học được {currentOffering.sessionSummary.heldCount} buổi, bạn có muốn đóng lớp không?</Notice>}{pending && <div className="sl-attention">Buổi học đã kết thúc · Chờ xác nhận kết quả diễn ra.</div>}</div>
    <div className="v20-composer"><div className="sl-editor-info"><h4>THÔNG TIN BUỔI HỌC</h4><strong className="sl-editor-date">{vietnameseDate(form.sessionDate)} · {periodLabel}</strong>
      <div className="sl-editor-hidden-controls"><label>Ngày học<DateField size="small" inputProps={{ "aria-label": "Ngày học", min: getBusinessTodayKey() }} value={form.sessionDate} disabled={!editable || saving} onChange={(event) => { setField("sessionDate", event.target.value); }} /></label><label>Buổi<AppSelect aria-label="Buổi" value={form.period} disabled={!editable || saving} onChange={(event) => setField("period", event.target.value)}><option value="MORNING">Sáng</option><option value="AFTERNOON">Chiều</option></AppSelect></label></div>
      <label className="v20-field sl-unit-field">Đơn vị<SearchSelect label="Đơn vị" value={selectedUnitId} options={[{ id: "", name: "Tất cả đơn vị" }, ...units]} placeholder="Nhập để tìm đơn vị..." disabled={!editable || lecturerLocked || catalog.loading || !!catalog.error || saving} onChange={selectUnit} /></label>
      <label className="v20-field">Giảng viên<LecturerPicker key={selectedUnitId} value={form.lecturerId} lecturers={filteredLecturers} offering={currentOffering} conflicts={conflicts} locked={lecturerLocked} disabled={!editable || catalog.loading || !!catalog.error || saving} onChange={selectLecturer} />{recommendedUnit?.name && <small className="sl-teaching-unit-hint">Ngành đề xuất: {recommendedUnit.name}</small>}</label>
      {!catalog.loading && !catalog.error && !lecturers.some((row) => row.active !== false) && <Notice>Chưa có giảng viên đang hoạt động. Khai báo tại Hệ thống → Giảng viên.</Notice>}
      <label className="v20-field">Ghi chú<textarea aria-label="Ghi chú buổi học" placeholder="Nhập ghi chú..." maxLength={2000} value={form.note} disabled={!editable || saving} onChange={(event) => setField("note", event.target.value)} /></label>
      {classConflict && <Notice error={`Lớp / nhóm đang bận: ${classConflict.courseOffering?.subject?.name || "Buổi học khác"} · ${classConflict.period === "MORNING" ? "Sáng" : "Chiều"}`} />}
    </div><section className="sl-editor-rooms"><h4>PHÒNG HỌC TOÀN VIỆN</h4><p className="v20-hint">Tình trạng theo {vietnameseDate(form.sessionDate)} · {periodLabel}</p>
      {!session && firstRoomSession && !catalog.loading && !catalog.error && <div className={`sl-room-suggestion${suggestedRoomReason ? " sl-room-suggestion-unavailable" : ""}`} role="status">
        <strong>Phòng đề xuất: {suggestedRoom?.code || firstRoomSession.room?.code || "Phòng của buổi đầu tiên"}</strong>
        <span>{availability.loading ? "Đang kiểm tra phòng cho buổi học này..." : availability.error ? "Chưa kiểm tra được tình trạng phòng. Vui lòng thử lại." : suggestedRoomReason
          ? `${suggestedRoomReason}. Vui lòng chọn phòng khác cho buổi này.` : "Theo phòng của buổi học đầu tiên. Bạn vẫn có thể chọn phòng khác."}</span>
      </div>}
      {(catalog.loading || availability.loading) && <Notice>Đang kiểm tra phòng và giảng viên...</Notice>}
      {floors.map((floor) => <div className="v20-room-floor" key={floor ?? "other"}><h4>{floor == null ? "PHÒNG KHÁC" : `TẦNG ${floor}`}</h4><div className="v20-room-grid">{rooms.filter((room) => roomFloor(room) === floor).map((room) => { const reason = roomReason(room); return <button key={room.id} aria-pressed={form.roomId === room.id} className={`v20-room ${form.roomId === room.id ? "sl-on" : ""} ${reason === "Đang bận" ? "v20-busy" : reason ? "v20-unavailable" : ""}`} disabled={!editable || saving || !validTime || availability.loading || !!availability.error || !!reason} onClick={() => setField("roomId", room.id)}><strong>{room.code}</strong><span>{room.capacity == null ? "Chưa khai báo sức chứa" : `${room.capacity} chỗ`}</span><small>{roomStateLabel(room)}</small></button>; })}</div></div>)}
      {!catalog.loading && !rooms.length && <Notice>Chưa có phòng học. Quản trị viên khai báo tại Hệ thống → Phòng học.</Notice>}
    </section></div>
    {deleting && <Modal title="Xóa buổi học" busy={saving} onClose={() => setDeleting(false)} actions={<><button className="sl-btn" disabled={saving} onClick={() => setDeleting(false)}>Hủy</button><button className="sl-btn sl-btn-danger" disabled={saving} onClick={() => mutate(() => api.delete(`/scheduling/teaching-sessions/${session.id}`))}>Xác nhận xóa</button></>}><p>Xóa buổi học ngày {vietnameseDate(session.sessionDate)} khỏi lịch?</p>{error && <Notice error={error} />}</Modal>}
  </Modal>;
}
