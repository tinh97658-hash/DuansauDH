import React, { useState } from "react";
import { api, groupsOf, message, Modal, Notice, offeringTitle, rows, subjectLabel, useLoad } from "./shared";

export default function OfferingDetails({ offering, user, onClose, onSaved, onSelect }) {
  const detail = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}`), [offering.id]);
  const roster = useLoad(() => api.get(`/scheduling/course-offerings/${offering.id}/roster`), [offering.id]);
  const unresolved = useLoad(async () => rows(await api.get(`/scheduling/course-offerings/${offering.id}/unresolved-teaching-sessions`)), [offering.id]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [retakeId, setRetakeId] = useState("");
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const value = detail.data || offering;
  const canManage = user.canManageScheduling === true;
  const summary = value.sessionSummary || {};
  const mutate = async (action, done) => {
    setSaving(true); setError(""); setSuccess("");
    try { await action(); if (done) done(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  return <Modal wide hideHeader className="sl-offering-drawer" bodyClassName="sl-offering-body" title="CHI TIẾT LỚP HỌC PHẦN" busy={saving} onClose={onClose} actions={<>
    {canManage && value.status === "active" && <><button className="sl-btn" onClick={() => onSelect(value)}>Xếp lịch / Xếp thêm</button><button className="sl-btn sl-btn-primary" disabled={saving || detail.loading || unresolved.loading || !!unresolved.error || !summary.heldCount || !!unresolved.data?.length} onClick={() => setCompleting(true)}>Xác nhận hoàn thành giảng dạy</button></>}
    {canManage && value.status === "completed" && <button className="sl-btn" disabled={roster.loading || !!roster.error} onClick={() => setRetakeOpen(true)}>Ghi nhận học viên cần học lại</button>}
  </>}>
    <header className="sl-offering-hero"><div><div className="sl-eyebrow">LỚP HỌC PHẦN</div><h2>{offeringTitle(value)}</h2><strong>{subjectLabel(value)}</strong><p>{groupsOf(value).length} lớp/nhóm · {value.participantCount ?? 0} học viên</p><span className={`sl-state ${value.status === "completed" ? "sl-complete" : "sl-progress"}`}>{value.status === "completed" ? "HOÀN THÀNH" : "ĐANG DẠY"}</span></div><button className="sl-drawer-close" aria-label="Đóng" disabled={saving} onClick={onClose}>×</button></header>
    <div className="sl-offering-content">{detail.error && <Notice error={detail.error} />}{error && <Notice error={error} />}{success && <Notice>{success}</Notice>}
      <div className="sl-offering-stats">{[[summary.heldCount || 0, "Đã diễn ra"], [summary.pendingCount || 0, "Chờ xác nhận"], [summary.futurePlannedCount || 0, "Đã xếp sắp tới"]].map(([count, label]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <h3 className="sl-offering-groups-title">LỚP / NHÓM THAM GIA</h3>
      <div className="sl-offering-groups">{groupsOf(value).map((group) => <div key={group.id}><strong>{group.name || group.code}</strong><span>{group.major?.name || value.subject?.major?.name || "Chưa có chuyên ngành"} · {group.memberCount ?? value.participantCount ?? 0} học viên</span></div>)}</div>
    </div>
    {completing && <Modal title="Hoàn thành giảng dạy" onClose={() => setCompleting(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setCompleting(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => mutate(() => api.put(`/scheduling/course-offerings/${value.id}/completion`, {}), onSaved)}>Xác nhận hoàn thành</button></>}><p>Xác nhận lớp {value.subject?.code} đã hoàn thành giảng dạy? Lớp hoàn thành sẽ không được xếp thêm buổi học.</p>{error && <Notice error={error} />}</Modal>}
    {retakeOpen && <Modal title="Ghi nhận nhu cầu học lại" onClose={() => setRetakeOpen(false)} busy={saving} actions={<><button className="sl-btn" disabled={saving} onClick={() => setRetakeOpen(false)}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving || !retakeId} onClick={() => mutate(() => api.post("/scheduling/retakes", { sourceCourseOfferingId: value.id, participantId: retakeId }), () => { setRetakeOpen(false); setSuccess("Đã ghi nhận nhu cầu học lại. Học viên sẽ xuất hiện khi tổ chức học phần phù hợp cho khóa sau."); })}>Ghi nhận học lại</button></>}>
      <p>Chọn học viên của lớp đã hoàn thành có nhu cầu học lại học phần {value.subject?.name}.</p><label className="v20-field">Học viên<select aria-label="Học viên cần học lại" value={retakeId} onChange={(event) => setRetakeId(event.target.value)}><option value="">Chọn học viên</option>{roster.data?.participants.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.fullName}</option>)}</select></label>{error && <Notice error={error} />}
    </Modal>}
  </Modal>;
}
