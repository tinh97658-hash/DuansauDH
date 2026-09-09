import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import successCircle from "../../assets/create-offering-success.svg";
import { api, intersectDays, message, normalize, Notice, rows, SearchSelect, unique, useLoad } from "./shared";

const DEFAULT_OFFERING_NAME = "Lớp thạc sĩ bổ sung";
const groupLabel = (group) => [group?.code, group?.name].filter(Boolean).join(" · ");

export default function CreateOffering({ user }) {
  const navigate = useNavigate();
  const canEdit = user.role === "admin" || user.canManageScheduling === true;
  const [majorId, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [subjectId, setSubject] = useState("");
  const [offeringName, setOfferingName] = useState(DEFAULT_OFFERING_NAME);
  const [query, setQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupIds, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [roster, setRoster] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState(null);

  const majors = useLoad(async () => rows(await api.get("/system/majors?program=masters")).filter((item) => item.active !== false), []);
  const groups = useLoad(async () => majorId ? rows(await api.get(`/masters/class-groups?${new URLSearchParams({ majorId })}`)) : [], [majorId]);
  const candidates = useLoad(async () => majorId && year ? (await api.get(`/scheduling/course-offering-candidates?${new URLSearchParams({ program: "masters", majorId, academicYear: year })}`)).subjects : [], [majorId, year, created?.id]);
  const candidate = candidates.data?.find((item) => item.subject.id === subjectId);
  const subject = candidate?.subject;
  const eligible = candidate?.eligibleClassGroups || [];
  const chosen = eligible.filter((group) => groupIds.includes(group.id));
  const draft = { subjectId, classGroupIds: groupIds, majorId, academicYear: year };
  const preview = useLoad(async () => groupIds.length ? api.post("/scheduling/course-offerings/roster-preview", draft) : { participants: [], participantCount: 0 }, [subjectId, majorId, year, groupIds.join(",")]);
  const activeGroup = eligible.find((group) => group.id === activeGroupId) || chosen[0] || eligible[0];
  const days = intersectDays(chosen);

  const resetSelection = () => {
    setGroups([]);
    setActiveGroupId("");
    setCreated(null);
    setRoster(null);
    setSaveError("");
  };
  const changeScope = (callback) => {
    resetSelection();
    setSubject("");
    setQuery("");
    callback();
  };
  const toggleGroup = (group) => {
    if (!canEdit) return;
    setActiveGroupId(group.id);
    setGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id]);
  };
  const openConfirmation = () => {
    if (!preview.data?.participants) return;
    setSaveError("");
    setRoster(preview.data.participants.map((row) => ({ ...row, note: "" })));
  };
  const create = async () => {
    if (saving || !roster || !canEdit) return;
    setSaving(true);
    setSaveError("");
    try {
      const participantNotes = roster.map((row) => ({ participantId: row.id, note: row.note.trim() })).filter((row) => row.note);
      const result = await api.post("/scheduling/course-offerings", { ...draft, participantNotes });
      setCreated({ ...result, selectedClassGroups: chosen });
      setRoster(null);
    } catch (error) {
      setSaveError(message(error));
    } finally {
      setSaving(false);
    }
  };

  const major = majors.data?.find((item) => item.id === majorId);
  const groupMajorName = (group) => group.major?.name
    || majors.data?.find((item) => item.id === group.majorId)?.name
    || "Chưa xác định chuyên ngành";
  const participatingGroups = created?.selectedClassGroups || chosen;
  const participatingMajors = unique(participatingGroups.map(groupMajorName)).join(" · ");
  const years = unique((groups.data || []).map((group) => group.academicYear)).sort((a, b) => b.localeCompare(a, "vi", { numeric: true }));
  const visibleGroups = eligible.filter((group) => normalize(`${group.code} ${group.name}`).includes(normalize(groupQuery)));
  const filteredSubjects = (candidates.data || []).filter((item) => normalize(`${item.subject.code} ${item.subject.name}`).includes(normalize(query)));
  const totalStudents = preview.loading ? "…" : preview.error ? "—" : preview.data?.participantCount ?? 0;

  if (created) {
    return <section className="sl-create-flow-page sl-create-success-page">
      <div className="sl-create-success-card">
        <div className="sl-create-success-icon"><img src={successCircle} alt="" /><span>✓</span></div>
        <div className="sl-create-success-kicker">ĐÃ TẠO LỚP HỌC PHẦN</div>
        <h1>{offeringName}</h1>
        <p>{participatingMajors} · Năm {year}</p>
        <div className="sl-create-success-summary">
          <div><strong>{groupIds.length} lớp / nhóm</strong><strong>{created.participantCount ?? preview.data?.participantCount ?? 0} học viên</strong></div>
          <p>{participatingGroups.map(groupLabel).join(" · ")}</p>
        </div>
        <div className="sl-create-success-actions">
          <button onClick={() => { resetSelection(); setSubject(""); setOfferingName(DEFAULT_OFFERING_NAME); }}>Tạo lớp học phần khác</button>
          <button className="sl-primary" aria-label="Sang Xếp lịch" onClick={() => navigate(`/masters/schedule?offeringId=${created.id}`)}>Sang Xếp lịch →</button>
        </div>
      </div>
    </section>;
  }

  if (roster) {
    return <section className="sl-create-flow-page sl-create-confirm-page" role="dialog" aria-label="Xem trước danh sách lớp">
      <div className="sl-create-confirm-card">
        <header><h1>XÁC NHẬN LỚP HỌC PHẦN</h1></header>
        <div className="sl-create-confirm-course">
          <div className="sl-create-confirm-title"><h2>{offeringName}</h2><div><span>{year}</span><span>{subject?.credits ?? subject?.creditCount ?? 3} tín chỉ</span></div></div>
          <div className="sl-create-confirm-meta">
            <div><small>HỌC PHẦN</small><strong>{subject?.code} · {subject?.name}</strong></div>
            <div><small>CHUYÊN NGÀNH</small><strong>{participatingMajors}</strong></div>
          </div>
          <div className="sl-create-confirm-groups"><small>LỚP / KHÓA THAM GIA</small><div>{chosen.map((group) => <span key={group.id}>{group.name || group.code} · {group.academicYear}</span>)}</div></div>
        </div>
        <div className="sl-create-confirm-roster">
          <div className="sl-create-confirm-roster-head"><strong>DANH SÁCH HỌC VIÊN</strong><span>{roster.length} học viên</span></div>
          {saveError && <Notice error={saveError} />}
          <div className="sl-create-confirm-table-wrap">
            <table>
              <thead><tr><th>STT</th><th>MÃ HỌC VIÊN</th><th>HỌ VÀ TÊN HỌC VIÊN</th><th>GHI CHÚ</th></tr></thead>
              <tbody>{roster.map((row, index) => <tr key={row.id}>
                <td>{String(index + 1).padStart(2, "0")}</td>
                <td>{row.code}</td>
                <td>{row.fullName}</td>
                <td><input aria-label={`Ghi chú ${row.code}`} value={row.note} maxLength={2000} disabled={saving} placeholder="Nhập ghi chú..." onChange={(event) => { const note = event.target.value; setRoster((current) => current.map((item) => item.id === row.id ? { ...item, note } : item)); }} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <footer><span>{roster.length} học viên · {groupIds.length} lớp / nhóm</span><div><button disabled={saving} onClick={() => setRoster(null)}>← Quay lại chỉnh sửa</button><button className="sl-primary" aria-label="Xác nhận tạo lớp" disabled={saving} onClick={create}>{saving ? "Đang lưu..." : "Xác nhận tạo lớp học phần"}</button></div></footer>
      </div>
    </section>;
  }

  return <section className="sl-workspace sl-create-mode sl-create-figma">
    <aside className="sl-left">
      <div className="sl-scope"><div className="sl-eyebrow">PHẠM VI TỔ CHỨC</div>
        <div className="v20-scope-step"><b>1</b>CHUYÊN NGÀNH</div>
        <SearchSelect label="Chọn chuyên ngành" placeholder="Chọn chuyên ngành" value={majorId} disabled={majors.loading} options={majors.data || []} onChange={(value) => changeScope(() => { setMajor(value); setYear(""); })} />
        {majors.error && <Notice error={majors.error} />}
        <div className="v20-scope-step"><b>2</b>KHÓA / NĂM HỌC</div>
        <select className="sl-create-year" aria-label="Khóa / Năm học" value={year} disabled={!majorId || groups.loading} onChange={(event) => changeScope(() => setYear(event.target.value))}><option value="">Chọn khóa / năm</option>{years.map((value) => <option key={value}>{value}</option>)}</select>
        {groups.error && <Notice error={groups.error} />}
        {majorId && !groups.loading && !groups.error && !years.length && <Notice>Chưa có nhóm cho chuyên ngành này. <Link to="/masters/create-class-groups">Tạo nhóm học phần</Link></Notice>}
      </div>
      <div className="sl-worklist">
        <div className="sl-create-subject-title"><div className="v20-scope-step"><b>3</b>HỌC PHẦN CÒN CẦN TỔ CHỨC</div><span>{filteredSubjects.length}</span></div>
        <div className="sl-create-subject-search"><span>⌕</span><input aria-label="Tìm học phần" placeholder="Tìm học phần..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        {candidates.loading && majorId && year ? <Notice>Đang tải học phần...</Notice> : candidates.error ? <Notice error={candidates.error} /> : majorId && year ? <div className="sl-create-subject-list">{filteredSubjects.map((item) => <button key={item.subject.id} className={subjectId === item.subject.id ? "sl-selected" : ""} onClick={() => { resetSelection(); setSubject(item.subject.id); setGroupQuery(""); }}><strong>{item.subject.code}</strong><span>{item.subject.name}</span><small>{item.eligibleClassGroups.length} lớp / nhóm có thể chọn</small></button>)}
          {!filteredSubjects.length && <Notice>{query ? "Không có học phần khớp từ khóa." : <>Không còn học phần đủ điều kiện trong phạm vi này. Kiểm tra <Link to="/plan/training-plan">Kế hoạch đào tạo</Link>.</>}</Notice>}</div> : <Notice>Chọn chuyên ngành và khóa để xác định học phần còn cần tổ chức.</Notice>}
        {!canEdit && <div className="sl-create-permission">Tài khoản hiện tại chỉ có quyền xem.</div>}
      </div>
    </aside>
    <section className="sl-right">
      {!subject ? <div className="v20-empty-guide"><div><div className="sl-guide-icon">◇</div><div className="sl-eyebrow">TẠO LỚP HỌC PHẦN</div><h2>{!majorId ? "Bắt đầu bằng Chuyên ngành" : !year ? "Chọn khóa để tiếp tục" : "Chọn Học phần để tổ chức lớp học phần"}</h2><p>{major?.name}{year ? ` · ${year}` : ""}</p>{year && <strong>{candidates.data?.length || 0} học phần hiện có thể tổ chức.</strong>}</div></div> : <div className="sl-create-main">
        <div className="sl-create-name"><div className="sl-eyebrow">TẠO LỚP HỌC PHẦN</div><label>TÊN LỚP HỌC PHẦN *<input aria-label="Tên lớp học phần" value={offeringName} onChange={(event) => setOfferingName(event.target.value)} /></label></div>
        <div className="sl-create-picker">
          <section className="sl-create-groups"><div className="sl-create-section-title"><b>1</b><strong>LỚP / NHÓM THAM GIA</strong></div><input className="sl-create-filter" placeholder="Tìm lớp / nhóm..." aria-label="Tìm lớp / nhóm" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
            <div className="sl-create-group-list">{visibleGroups.map((group) => { const picked = groupIds.includes(group.id); const incompatible = !picked && chosen.length > 0 && !intersectDays([...chosen, group]).length; return <button key={group.id} aria-pressed={picked} className={`${picked ? "sl-picked" : ""} ${incompatible ? "sl-disabled" : ""}`} disabled={!canEdit || incompatible} onClick={() => toggleGroup(group)}><span className="sl-create-checkbox">{picked ? "✓" : ""}</span><span><strong>{groupLabel(group)}</strong><small>{groupMajorName(group)}</small></span><span className="sl-create-group-count">{group.memberCount || 0} học viên{picked && activeGroup?.id === group.id && <em>ĐANG XEM</em>}</span></button>; })}{!visibleGroups.length && <Notice>Không có lớp / nhóm phù hợp.</Notice>}</div>
          </section>
          <section className="sl-create-students"><div className="sl-create-section-title"><b>2</b><strong>HỌC VIÊN CỦA LỚP / NHÓM</strong></div>
            {activeGroup ? <><div className="sl-create-active-group"><strong>{groupLabel(activeGroup)}</strong><span>{preview.loading && groupIds.includes(activeGroup.id) ? "…" : groupIds.includes(activeGroup.id) ? preview.data?.participantCount ?? activeGroup.memberCount ?? 0 : activeGroup.memberCount ?? 0} học viên</span></div><div className="sl-create-student-list">{preview.loading && groupIds.includes(activeGroup.id) ? <Notice>Đang tải học viên...</Notice> : groupIds.includes(activeGroup.id) && !preview.error ? (preview.data?.participants || []).map((row, index) => <div key={row.id}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{row.fullName}</strong><small>{row.code}</small></p></div>) : <div className="v20-hint">Chọn lớp / nhóm để xem danh sách học viên.</div>}</div></> : <Notice>Chọn một lớp / nhóm để xem học viên.</Notice>}
          </section>
        </div>
        <div className="sl-create-footer">
          <div className="sl-create-selection-head"><strong>{groupIds.length} LỚP / NHÓM ĐÃ CHỌN</strong><strong>{totalStudents} HỌC VIÊN</strong></div>
          <div className="sl-create-selection-row"><div className="sl-create-chips">{chosen.map((group) => <span key={group.id}>{group.name || group.code} · {group.academicYear} · {group.memberCount || 0} HV</span>)}</div><div className="sl-create-actions"><button disabled={!canEdit || !groupIds.length} onClick={resetSelection}>Làm lại</button><button className="sl-primary" aria-label="Tạo lớp học phần" disabled={!canEdit || !offeringName.trim() || !groupIds.length || !days.length || preview.loading || !!preview.error || !preview.data?.participantCount} onClick={openConfirmation}>Tiếp tục →</button></div></div>
          {preview.error && <Notice error={preview.error} />}
        </div>
      </div>}
    </section>
  </section>;
}
