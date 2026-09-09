import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, daysLabel, groupsOf, intersectDays, labelOf, message, Modal, normalize, Notice, offeringTitle, rows, SearchSelect, subjectLabel, unique, useLoad } from "./shared";
import { addDays, formatDateKey, getBusinessTodayKey, isSessionPast, mondayOf, vietnameseDate, vietnameseDayMonth, vietnameseWeekdayShort, weekDaysFrom } from "../../utils/schedulingCalendar";
import SessionEditor from "./SessionEditor";
import OfferingDetails from "./OfferingDetails";

export default function Schedule({ user }) {
  const [params] = useSearchParams();
  const requested = params.get("offeringId") || "";
  const appliedRequest = useRef("");
  const [majorId, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState(() => formatDateKey(mondayOf(getBusinessTodayKey())));
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
      setSelected(requested); setStatus(offering.status); setMajor(""); setYear(""); setQuery("");
      const timer = setTimeout(() => document.getElementById(`offering-${requested}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 50);
      return () => clearTimeout(timer);
    }
    // Apply the navigation target once, not after every save/refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, offerings.data]);
  const inScope = (offering) => groupsOf(offering).some((group) => (!majorId || (group.majorId || group.major?.id) === majorId) && (!year || group.academicYear === year));
  const scoped = all.filter(inScope);
  const listed = scoped.filter((offering) => offering.status === status && normalize(`${offering.subject?.code} ${offering.subject?.name} ${labelOf(offering)}`).includes(normalize(query)));
  const visibleSessions = (sessions.data || []).filter((session) => inScope(session.courseOffering));
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
  const sessionState = (session) => session.status === "held" ? ["sl-held", "✓ ĐÃ DIỄN RA"] : session.status === "not_held" ? ["sl-not", "— KHÔNG DIỄN RA"] : isSessionPast(session) ? ["sl-wait", "● CHỜ XÁC NHẬN"] : ["", "○ ĐÃ XẾP"];
  const sessionCard = (session) => { const [style, state] = sessionState(session); return <button key={session.id} className={`sl-session ${style}`} onClick={() => openSession(session)}><strong>{offeringTitle(session.courseOffering)}</strong><span>{subjectLabel(session.courseOffering)}</span><small>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</small><em>{state}</em></button>; };
  return <section className="sl-workspace sl-schedule-view"><aside className="sl-left"><div className="sl-scope"><div className="sl-eyebrow">PHẠM VI LÀM VIỆC</div>
    <label className="sl-scope-label">Chuyên ngành</label><SearchSelect label="Chuyên ngành" value={majorId} placeholder="Tất cả chuyên ngành" options={[{ id: "", name: "Tất cả chuyên ngành" }, ...(majors.data || [])]} onChange={(value) => changeScope(() => { setMajor(value); setYear(""); })} />
    <label className="sl-scope-label">Khóa / Năm</label><select className="sl-select sl-year-select" aria-label="Khóa / Năm" value={year} onChange={(event) => changeScope(() => setYear(event.target.value))}><option value="">Tất cả</option>{unique(all.flatMap(groupsOf).filter((group) => !majorId || group.majorId === majorId).map((group) => group.academicYear)).sort((a, b) => b.localeCompare(a, "vi", { numeric: true })).map((value) => <option key={value}>{value}</option>)}</select>
    {!canEdit && <div className="sl-attention">Quyền chỉ xem · Quản trị viên phân công người phụ trách tại Hệ thống → QL Người dùng.</div>}
    {majors.error && <Notice error={majors.error} />}
  </div><div className="sl-worklist"><div className="sl-search-wrap"><span>⌕</span><input className="sl-search" aria-label="Tìm môn / lớp" placeholder="Tìm lớp học phần..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="sl-card-scroll">{offerings.loading ? <Notice>Đang tải lớp học phần...</Notice> : offerings.error ? <Notice error={offerings.error} /> : <section className="sl-section"><h2><span>LỚP HỌC PHẦN</span><b>{listed.length}</b></h2>{listed.map((offering) => {
    const summary = offering.sessionSummary || {};
    return <article key={offering.id} id={`offering-${offering.id}`} className={`sl-card ${selectedId === offering.id ? "sl-selected" : ""}`}>
      <button className="sl-btn sl-btn-link sl-card-detail" onClick={() => setDetails(offering)}><strong>{offeringTitle(offering)}</strong><span>{subjectLabel(offering)}</span><small>{groupsOf(offering).length} lớp/nhóm · {offering.participantCount ?? 0} HV</small></button>
      <div className="sl-card-foot"><div className="sl-card-copy"><strong>Đã diễn ra {summary.heldCount || 0} buổi</strong><span className={!summary.futurePlannedCount ? "sl-no-week" : ""}>{summary.futurePlannedCount ? `Có ${summary.futurePlannedCount} lịch sắp tới` : "Chưa có lịch tuần này"}</span></div>{canEdit && offering.status === "active" && <button className="sl-btn sl-btn-primary sl-btn-sm" onClick={() => select(offering)}>Xếp lịch</button>}</div>
    </article>;
  })}{!listed.length && <Notice>Không có lớp học phần trong phạm vi đã chọn.</Notice>}</section>}</div></div></aside>
  <section className="sl-right"><div className="sl-schedule-head"><h1>XẾP LỊCH</h1><div className="sl-week"><button aria-label="Tuần trước" onClick={() => setWeek(formatDateKey(addDays(week, -7)))}>‹</button><strong>{vietnameseDate(week)} — {vietnameseDate(end)}</strong><button aria-label="Tuần sau" onClick={() => setWeek(formatDateKey(addDays(week, 7)))}>›</button></div>
    <div className="sl-actions">{canEdit && <button className="sl-pending" onClick={() => setPendingOpen(true)}>{pending.loading ? "…" : pending.data?.length ?? "—"} chờ xác nhận</button>}<button className="sl-btn sl-today" onClick={() => setWeek(formatDateKey(mondayOf(getBusinessTodayKey())))}>Hôm nay</button></div>
  </div>{selecting && <div className="sl-selected-strip"><span className="sl-selected-tag">ĐANG XẾP</span><div className="sl-selected-main"><strong>{selected.subject?.code} · {selected.subject?.name}</strong><span>{labelOf(selected)} · {selected.participantCount} HV</span></div><div className="sl-selected-next"><span>Ngày có thể xếp</span><strong>{daysLabel(selectedDays)}</strong></div><button className="sl-btn" onClick={() => setSelected("")}>Bỏ chọn</button></div>}
    {sessions.error && <Notice error={sessions.error} />}{error && <Notice error={error} />}
    <div className={`sl-calendar-wrap ${selecting ? "sl-selecting" : ""}`} aria-busy={sessions.loading}><div className="sl-calendar" role="table" aria-label="Lịch học theo tuần"><div className="sl-corner">BUỔI</div>{weekDaysFrom(week).map((day) => <div className="sl-day" key={formatDateKey(day)}><strong>{vietnameseWeekdayShort(day)}</strong><span>{vietnameseDayMonth(day).replace("/", "-")}</span></div>)}
      {["MORNING", "AFTERNOON"].map((period) => <React.Fragment key={period}><div className="sl-period"><span>{period === "MORNING" ? "SÁNG" : "CHIỀU"}</span></div>{weekDaysFrom(week).map((day) => {
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
    </div></div>
  </section>
  {editor && <SessionEditor key={editor.session?.id || `${editor.date}-${editor.period}`} {...editor} user={user} onClose={() => setEditor(null)} onSaved={saved} onViewOffering={(offering) => { setEditor(null); setDetails(offering); }} />}
  {details && <OfferingDetails offering={details} user={user} onClose={() => setDetails(null)} onSaved={saved} onOpenSession={openSession} onSelect={select} />}
  {slotDetails && <Modal title={`CÁC BUỔI HỌC · ${vietnameseDate(slotDetails.date)}`} onClose={() => setSlotDetails(null)}>{slotDetails.items.map(sessionCard)}</Modal>}
  {pendingOpen && <Modal wide className="sl-pending-drawer" bodyClassName="sl-pending-body" title={`BUỔI CHỜ XÁC NHẬN · ${pending.data?.length ?? 0}`} busy={saving} onClose={() => setPendingOpen(false)}>{pending.loading ? <Notice>Đang tải...</Notice> : pending.error ? <Notice error={pending.error} /> : <>{error && <Notice error={error} />}{[...(pending.data || [])].sort((left, right) => `${right.sessionDate} ${right.endTime}`.localeCompare(`${left.sessionDate} ${left.endTime}`)).map((session) => <article className="sl-pending-card" key={session.id}><div className="sl-pending-copy"><strong>{vietnameseDate(session.sessionDate)} · {session.period === "MORNING" ? "SÁNG" : "CHIỀU"}</strong><h3>{offeringTitle(session.courseOffering)}</h3><span>{subjectLabel(session.courseOffering)}</span><small>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</small></div><div className="sl-pending-actions"><button className="sl-btn" disabled={saving} onClick={() => confirmation(session, "not_held")}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => confirmation(session, "held")}>✓ Đã diễn ra</button></div></article>)}{!pending.data?.length && <Notice>Không có buổi chờ xác nhận.</Notice>}</>}</Modal>}
  </section>;
}
