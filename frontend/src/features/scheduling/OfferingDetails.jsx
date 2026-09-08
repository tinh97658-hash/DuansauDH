import React, { useState } from "react";
import { api, daysLabel, groupsOf, labelOf, message, Modal, Notice, rows, useLoad } from "./shared";
import { isSessionPast, shortTime, vietnameseDate } from "../../utils/schedulingCalendar";

export default function OfferingDetails({ offering, user, onClose, onSaved, onOpenSession, onSelect }) {
  const detail = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}`), [offering.id]);
  const roster = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}/roster`), [offering.id]);
  const unresolved = useLoad(async () => rows(await api.get(`/scheduling/course-offerings/${offering.id}/unresolved-teaching-sessions`)), [offering.id]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [retakeId, setRetakeId] = useState("");
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const value = detail.data || offering;
  const canManage = user.canManageScheduling === true;
  const canNotes = canManage || user.role === "admin";
  const summary = value.sessionSummary || {};
  const mutate = async (action, done) => {
    setSaving(true); setError(""); setSuccess("");
    try { await action(); if (done) done(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  const saveNotes = () => mutate(() => api.put(`/scheduling/course-offerings/${offering.id}/roster-notes`, {
    participantNotes: (roster.data?.participants || []).map((row) => ({ participantId: row.id, note: (notes[row.id] ?? row.note ?? "").trim() })).filter((row) => row.note),
  }), () => { setSuccess("Đã lưu ghi chú."); roster.reload(); setNotes({}); });
  return <Modal drawer title="CHI TIẾT LỚP HỌC PHẦN" busy={saving} onClose={onClose} actions={<>
    {canManage && value.status === "active" && <><button className="sl-btn" onClick={() => onSelect(value)}>Xếp lịch</button><button className="sl-btn sl-btn-primary" disabled={saving || detail.loading || unresolved.loading || !!unresolved.error || !summary.heldCount || !!unresolved.data?.length} onClick={() => setCompleting(true)}>Hoàn thành giảng dạy</button></>}
    {canManage && value.status === "completed" && <button className="sl-btn" disabled={roster.loading || !!roster.error} onClick={() => setRetakeOpen(true)}>Ghi nhận học viên cần học lại</button>}
  </>}>
    <h3>{value.subject?.code} · {value.subject?.name}</h3><p>{labelOf(value)}</p><p><span className={`sl-state ${value.status === "completed" ? "sl-complete" : "sl-progress"}`}>{value.status === "completed" ? "Hoàn thành" : "Đang dạy"}</span> · {value.participantCount} học viên</p>
    {detail.error && <Notice error={detail.error} />}{error && <Notice error={error} />}{success && <Notice>{success}</Notice>}
    <div className="v20-stack">{groupsOf(value).map((group) => <div key={group.id} className="v20-selected-chip">{group.code} · {group.academicYear} · {daysLabel(group.allowedWeekdays)}</div>)}</div>
    <p>Đã diễn ra: <strong>{summary.heldCount || 0}</strong> · Chờ xác nhận: <strong>{summary.pendingCount || 0}</strong> · Lịch tương lai: <strong>{summary.futurePlannedCount || 0}</strong></p>
    {value.status === "active" && <><h4>CÁC BUỔI CẦN XỬ LÝ</h4>{unresolved.loading ? <Notice>Đang tải...</Notice> : unresolved.error ? <Notice error={unresolved.error} /> : unresolved.data?.length ? <div className="v20-stack">{unresolved.data.map((session) => <button key={session.id} className={`sl-session ${isSessionPast(session) ? "sl-wait" : ""}`} onClick={() => onOpenSession(session)}><strong>{vietnameseDate(session.sessionDate)} · {shortTime(session.startTime)}–{shortTime(session.endTime)}</strong><span>{session.lecturer?.name} · {session.room?.code}</span><small>{isSessionPast(session) ? "Chờ xác nhận" : "Lịch tương lai · Cần xử lý trước khi hoàn thành"}</small></button>)}</div> : <Notice>Không còn buổi cần xử lý.</Notice>}</>}
    <h4>DANH SÁCH HỌC VIÊN</h4>{roster.loading ? <Notice>Đang tải danh sách...</Notice> : roster.error ? <Notice error={roster.error} /> : <><table className="v20-table"><thead><tr><th>STT</th><th>Học viên</th><th>Ghi chú</th></tr></thead><tbody>{roster.data?.participants.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.code}<br />{row.fullName}</td><td><textarea aria-label={`Ghi chú ${row.code}`} maxLength={2000} disabled={!canNotes || saving} value={notes[row.id] ?? row.note ?? ""} onChange={(event) => { const note = event.target.value; setNotes((current) => ({ ...current, [row.id]: note })); }} /></td></tr>)}</tbody></table>
      {canNotes && <button className="sl-btn" disabled={saving || !Object.keys(notes).length} onClick={saveNotes}>Lưu ghi chú</button>}</>}
    {completing && <Modal title="Hoàn thành giảng dạy" onClose={() => setCompleting(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setCompleting(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/course-offerings/${value.id}/completion`, {}), onSaved)}>Xác nhận hoàn thành</button></>}><p>Xác nhận lớp {value.subject?.code} đã hoàn thành giảng dạy? Lớp hoàn thành sẽ không được xếp thêm buổi học.</p>{error && <Notice error={error} />}</Modal>}
    {retakeOpen && <Modal title="Ghi nhận nhu cầu học lại" onClose={() => setRetakeOpen(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setRetakeOpen(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving || !retakeId} onClick={() => mutate(() => api.post("/scheduling/retakes", { sourceCourseOfferingId: value.id, participantId: retakeId }), () => { setRetakeOpen(false); setSuccess("Đã ghi nhận nhu cầu học lại. Học viên sẽ xuất hiện khi tổ chức học phần phù hợp cho khóa sau."); })}>Ghi nhận học lại</button></>}>
      <p>Chọn học viên của lớp đã hoàn thành có nhu cầu học lại học phần {value.subject?.name}.</p><label className="v20-field">Học viên<select aria-label="Học viên cần học lại" value={retakeId} onChange={(event) => setRetakeId(event.target.value)}><option value="">Chọn học viên</option>{roster.data?.participants.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.fullName}</option>)}</select></label>{error && <Notice error={error} />}
    </Modal>}
  </Modal>;
}
