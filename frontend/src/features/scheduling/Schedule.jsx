import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, daysLabel, groupsOf, intersectDays, labelOf, message, Modal, normalize, Notice, rows, SearchSelect, unique, useLoad } from "./shared";
import { addDays, formatDateKey, getBusinessTodayKey, isSessionPast, mondayOf, shortTime, vietnameseDate, vietnameseDayMonth, vietnameseWeekdayShort, weekDaysFrom } from "../../utils/schedulingCalendar";
import SessionEditor from "./SessionEditor";
import OfferingDetails from "./OfferingDetails";

export default function Schedule({ user }) {
  const [params] = useSearchParams();
  const requested = params.get("offeringId") || "";
  const appliedRequest = useRef("");
  const [majorId, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [groupId, setGroup] = useState("");
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState(() => formatDateKey(mondayOf(getBusinessTodayKey())));
  const [institute, setInstitute] = useState(false);
  const [selectedId, setSelected] = useState(requested);
  const [editor, setEditor] = useState(null);
  const [details, setDetails] = useState(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [slotDetails, setSlotDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canEdit = user.canManageScheduling === true;
  const offerings = useLoad(async () => rows(await api.get("/scheduling/course-offerings?program=masters")), []);
  const majors = useLoad(async () => rows(await api.get("/system/majors?program=masters")), []);
  const end = formatDateKey(addDays(week, 6));
  const sessions = useLoad(async () => rows(await api.get(`/scheduling/teaching-sessions?${new URLSearchParams({ from: week, to: end })}`)), [week, end]);
  const pending = useLoad(async () => canEdit ? rows(await api.get("/scheduling/pending-teaching-sessions")) : [], [canEdit]);
  const all = offerings.data || [];
  const selected = all.find((offering) => offering.id === selectedId);
  useEffect(() => {
    if (!requested || !offerings.data || appliedRequest.current === requested) return;
    const offering = offerings.data.find((item) => item.id === requested);
    if (offering) {
      appliedRequest.current = requested;
      setSelected(requested); setStatus(offering.status); setMajor(""); setYear(""); setGroup(""); setQuery("");
      const timer = setTimeout(() => document.getElementById(`offering-${requested}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 50);
      return () => clearTimeout(timer);
    }
    // Apply the navigation target once, not after every save/refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, offerings.data]);
  const inScope = (offering) => groupsOf(offering).some((group) => (!majorId || (group.majorId || group.major?.id) === majorId) && (!year || group.academicYear === year) && (!groupId || group.id === groupId));
  const scoped = all.filter(inScope);
  const listed = scoped.filter((offering) => offering.status === status && normalize(`${offering.subject?.code} ${offering.subject?.name} ${labelOf(offering)}`).includes(normalize(query)));
  const scopeGroups = Array.from(new Map(all.flatMap(groupsOf).filter((group) => (!majorId || group.majorId === majorId) && (!year || group.academicYear === year)).map((group) => [group.id, group])).values());
  const visibleSessions = (sessions.data || []).filter((session) => institute || inScope(session.courseOffering));
  const selectedDays = selected?.allowedWeekdays || intersectDays(groupsOf(selected));
  const selecting = canEdit && selected?.status === "active";
  const refresh = () => { offerings.reload(); sessions.reload(); pending.reload(); };
  const saved = () => { setEditor(null); setDetails(null); setError(""); refresh(); };
  const openSession = (session) => { setDetails(null); setPendingOpen(false); setSlotDetails(null); setEditor({ session, offering: all.find((row) => row.id === session.courseOfferingId) || session.courseOffering }); };
  const select = (offering) => { setSelected(offering.id); setDetails(null); };
  const changeScope = (callback) => { callback(); setSelected(""); };
  const confirmation = async (session, result) => {
    setSaving(true); setError("");
    try { await api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: result }); refresh(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  const sessionState = (session) => session.status === "held" ? ["sl-held", "✓ Đã diễn ra"] : session.status === "not_held" ? ["sl-not", "— Không diễn ra"] : isSessionPast(session) ? ["sl-wait", "● Chờ xác nhận"] : ["", "○ Đã xếp"];
  const sessionCard = (session) => { const [style, state] = sessionState(session); return <button key={session.id} className={`sl-session ${style}`} onClick={() => openSession(session)}><strong>{session.courseOffering?.subject?.code}</strong><span>{labelOf(session.courseOffering)}</span><small>{shortTime(session.startTime)}–{shortTime(session.endTime)} · {session.room?.code}</small><small>{session.lecturer?.name}</small><em>{state}</em></button>; };
  return <section className="sl-workspace"><aside className="sl-left"><div className="sl-scope"><div className="sl-eyebrow">PHẠM VI XẾP LỊCH</div>
    <SearchSelect label="Chuyên ngành" value={majorId} placeholder="Tất cả chuyên ngành" options={[{ id: "", name: "Tất cả chuyên ngành" }, ...(majors.data || [])]} onChange={(value) => changeScope(() => { setMajor(value); setYear(""); setGroup(""); })} />
    <div className="sl-filter"><span>Khóa</span><select className="sl-select" aria-label="Khóa / Năm" value={year} onChange={(event) => changeScope(() => { setYear(event.target.value); setGroup(""); })}><option value="">Tất cả khóa</option>{unique(all.flatMap(groupsOf).filter((group) => !majorId || group.majorId === majorId).map((group) => group.academicYear)).sort((a, b) => b.localeCompare(a, "vi", { numeric: true })).map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="sl-filter"><span>Lớp / nhóm</span><select className="sl-select" aria-label="Lớp / nhóm" value={groupId} onChange={(event) => changeScope(() => setGroup(event.target.value))}><option value="">Tất cả lớp / nhóm</option>{scopeGroups.map((group) => <option key={group.id} value={group.id}>{group.code} · {group.name}</option>)}</select></div>
    <div className="sl-summary">{[["active", "Đang dạy"], ["completed", "Hoàn thành"]].map(([value, label]) => <button key={value} className={status === value ? "sl-on" : ""} onClick={() => setStatus(value)}><strong>{scoped.filter((offering) => offering.status === value).length}</strong>{label}</button>)}</div>
    <div className="sl-search-wrap"><span>⌕</span><input className="sl-search" aria-label="Tìm môn / lớp" placeholder="Tìm môn / lớp..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {!canEdit && <div className="sl-attention">Quyền chỉ xem · Quản trị viên phân công người phụ trách tại Hệ thống → QL Người dùng.</div>}
    {majors.error && <Notice error={majors.error} />}
  </div><div className="sl-worklist">{offerings.loading ? <Notice>Đang tải lớp học phần...</Notice> : offerings.error ? <Notice error={offerings.error} /> : <section className="sl-section"><h2>{status === "active" ? "ĐANG DẠY" : "HOÀN THÀNH"} · {listed.length}</h2>{listed.map((offering) => {
    const weekSessions = (sessions.data || []).filter((session) => session.courseOfferingId === offering.id && session.status !== "not_held");
    const summary = offering.sessionSummary || {};
    return <article key={offering.id} id={`offering-${offering.id}`} className={`sl-card ${selectedId === offering.id ? "sl-selected" : ""}`}>
      <button className="sl-btn sl-btn-link" style={{ padding: 0, textAlign: "left", width: "100%" }} onClick={() => setDetails(offering)}><div className="sl-card-head"><strong>{offering.subject?.code}</strong><span className={`sl-state ${offering.status === "completed" ? "sl-complete" : "sl-progress"}`}>{offering.status === "completed" ? "Hoàn thành" : "Đang dạy"}</span></div><div className="sl-meta"><strong>{offering.subject?.name}</strong><span>{labelOf(offering)} · {offering.participantCount} HV</span></div></button>
      <div className="sl-card-foot"><div className="sl-card-copy"><span>{summary.heldCount || 0} buổi đã diễn ra · {summary.pendingCount || 0} chờ xác nhận</span><span>{sessions.loading ? "Đang tải tuần..." : weekSessions.length ? `${weekSessions.length} buổi trong tuần` : "Chưa có lịch tuần này"}</span></div>{canEdit && offering.status === "active" && <button className="sl-btn sl-btn-primary sl-btn-sm" onClick={() => select(offering)}>{weekSessions.length ? "Xếp thêm" : "Xếp lịch"}</button>}</div>
    </article>;
  })}{!listed.length && <Notice>Không có lớp học phần trong phạm vi đã chọn.</Notice>}</section>}</div></aside>
  <section className="sl-right"><div className="sl-schedule-head"><div><div className="sl-eyebrow">LỊCH HỌC THEO TUẦN</div><div className="sl-week"><button aria-label="Tuần trước" onClick={() => setWeek(formatDateKey(addDays(week, -7)))}>‹</button><strong>{vietnameseDate(week)} – {vietnameseDate(end)}</strong><button aria-label="Tuần sau" onClick={() => setWeek(formatDateKey(addDays(week, 7)))}>›</button><button style={{ width: "auto" }} onClick={() => setWeek(formatDateKey(mondayOf(getBusinessTodayKey())))}>Hôm nay</button></div></div>
    <div className="sl-actions"><div className="sl-seg"><button className={!institute ? "sl-on" : ""} onClick={() => setInstitute(false)}>Theo phạm vi</button><button className={institute ? "sl-on" : ""} onClick={() => setInstitute(true)}>Toàn Viện</button></div>{canEdit && <button className="sl-pending" onClick={() => setPendingOpen(true)}>Chờ xác nhận · {pending.loading ? "…" : pending.data?.length ?? "—"}</button>}<button className="sl-btn" aria-label="Tải lại lịch" onClick={refresh}>↻</button></div>
  </div>{selecting && <div className="sl-selected-strip"><span className="sl-selected-tag">ĐANG XẾP</span><div className="sl-selected-main"><strong>{selected.subject?.code} · {selected.subject?.name}</strong><span>{labelOf(selected)} · {selected.participantCount} HV</span></div><div className="sl-selected-next"><span>Ngày có thể xếp</span><strong>{daysLabel(selectedDays)}</strong></div><button className="sl-btn" onClick={() => setSelected("")}>Bỏ chọn</button></div>}
    {sessions.error && <Notice error={sessions.error} />}{error && <Notice error={error} />}
    <div className={`sl-calendar-wrap ${selecting ? "sl-selecting" : ""}`} aria-busy={sessions.loading}><div className="sl-calendar" role="table" aria-label="Lịch học theo tuần"><div className="sl-corner">BUỔI</div>{weekDaysFrom(week).map((day) => <div className="sl-day" key={formatDateKey(day)}><strong>{vietnameseWeekdayShort(day)}</strong><span>{vietnameseDayMonth(day)}</span></div>)}
      {["MORNING", "AFTERNOON"].map((period) => <React.Fragment key={period}><div className="sl-period"><b>{period === "MORNING" ? "☀" : "◐"}</b><span>{period === "MORNING" ? "SÁNG" : "CHIỀU"}</span></div>{weekDaysFrom(week).map((day) => {
        const date = formatDateKey(day);
        const past = isSessionPast({ sessionDate: date, endTime: period === "MORNING" ? "12:00" : "23:59" });
        const incompatible = selecting && !selectedDays.includes(day.getDay());
        const items = visibleSessions.filter((session) => session.sessionDate === date && session.period === period);
        return <div key={date} className={`sl-slot ${past ? "sl-past" : ""} ${incompatible ? "sl-incompatible" : ""}`}><div className="v20-slot-items">
          {sessions.loading ? <span className="v20-hint">Đang tải...</span> : items.slice(0, 2).map(sessionCard)}
          {items.length > 2 && <button className="sl-other" onClick={() => setSlotDetails({ date, period, items })}>+ {items.length - 2} buổi khác</button>}
          {selecting && !past && !incompatible && <button className="v20-add-slot" aria-label={`Xếp ${period === "MORNING" ? "Sáng" : "Chiều"} ${date}`} disabled={sessions.loading || !!sessions.error} onClick={() => setEditor({ offering: selected, date, period })}>+ Xếp buổi</button>}
          {!items.length && !selecting && !sessions.loading && <span className="v20-hint">{past ? "Buổi đã qua" : "Chưa có lịch"}</span>}
          {incompatible && <span className="v20-hint">Không thuộc ngày học chung</span>}
        </div></div>;
      })}</React.Fragment>)}
    </div></div><div className="sl-legend"><span>○ Đã xếp</span><span>● Chờ xác nhận</span><span>✓ Đã diễn ra</span><span>— Không diễn ra</span><small>Kiểm tra trùng lịch trên toàn Viện.</small></div>
  </section>
  {editor && <SessionEditor key={editor.session?.id || `${editor.date}-${editor.period}`} {...editor} user={user} onClose={() => setEditor(null)} onSaved={saved} onViewOffering={(offering) => { setEditor(null); setDetails(offering); }} />}
  {details && <OfferingDetails offering={details} user={user} onClose={() => setDetails(null)} onSaved={saved} onOpenSession={openSession} onSelect={select} />}
  {slotDetails && <Modal title={`CÁC BUỔI HỌC · ${vietnameseDate(slotDetails.date)}`} onClose={() => setSlotDetails(null)}>{slotDetails.items.map(sessionCard)}</Modal>}
  {pendingOpen && <Modal drawer title="BUỔI HỌC CHỜ XÁC NHẬN" busy={saving} onClose={() => setPendingOpen(false)}>{pending.loading ? <Notice>Đang tải...</Notice> : pending.error ? <Notice error={pending.error} /> : <>{error && <Notice error={error} />}{pending.data?.map((session) => <div className="sl-card" key={session.id}>{sessionCard(session)}<p>{vietnameseDate(session.sessionDate)}</p><div className="v20-flex"><button className="sl-btn" disabled={saving} onClick={() => confirmation(session, "not_held")}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => confirmation(session, "held")}>Đã diễn ra</button></div></div>)}{!pending.data?.length && <Notice>Không có buổi chờ xác nhận.</Notice>}</>}</Modal>}
  </section>;
}
