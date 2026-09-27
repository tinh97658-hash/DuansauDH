import React, { useState } from "react";
import { api, message, Modal, Notice } from "./shared";

export default function GroupSettings({ groups, onClose, onSaved }) {
  const [id, setId] = useState(groups[0]?.id || "");
  const [days, setDays] = useState(groups[0]?.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0]);
  const [type, setType] = useState(groups[0]?.groupType || "ADMINISTRATIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await api.put(`/scheduling/groups/${id}/settings`, { allowedWeekdays: days, groupType: type }); onSaved(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  return <Modal title="Ngày học và loại nhóm" busy={saving} onClose={onClose} actions={<><button className="sl-btn" disabled={saving} onClick={onClose}>Hủy</button><button className="sl-btn sl-btn-primary" disabled={saving || !id || !days.length} onClick={save}>Lưu cấu hình nhóm</button></>}>
    <label className="v20-field">Lớp / nhóm<select disabled={saving} value={id} onChange={(event) => { const group = groups.find((row) => row.id === event.target.value); setId(group.id); setDays(group.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0]); setType(group.groupType || "ADMINISTRATIVE"); }}>
      {groups.map((group) => <option value={group.id} key={group.id}>{group.code} · {group.name}</option>)}
    </select></label><label className="v20-field">Loại nhóm<select disabled={saving} value={type} onChange={(event) => setType(event.target.value)}><option value="ADMINISTRATIVE">Hành chính</option><option value="NON_ADMINISTRATIVE">Không hành chính</option></select></label>
    <p>Ngày có thể học của nhóm, áp dụng cho các lớp học phần của nhóm:</p><div className="v20-days">{[1, 2, 3, 4, 5, 6, 0].map((day) => <label key={day}><input type="checkbox" disabled={saving} checked={days.includes(day)} onChange={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />{day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`}</label>)}</div>{error && <Notice error={error} />}
  </Modal>;
}
