import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, daysLabel, groupsOf, intersectDays, labelOf, message, Modal, normalize, Notice, offeringTitle, rows, SearchSelect, subjectLabel, unique, useLoad } from "./shared";
import { addDays, formatDateKey, getBusinessTodayKey, isSessionPast, mondayOf, vietnameseDate, vietnameseDayMonth, vietnameseWeekdayShort, weekDaysFrom } from "../../utils/schedulingCalendar";
import SessionEditor from "./SessionEditor";
import OfferingDetails from "./OfferingDetails";

const WEEK_SLOT_LIMIT = 3;
const DAY_FOCUS_STATUS_LANES = [
  { key: "planned", label: "ĐÃ XẾP", symbol: "○" },
  { key: "held", label: "ĐÃ DIỄN RA", symbol: "✓" },
  { key: "not", label: "KHÔNG DIỄN RA", symbol: "—" },
];

export default function Schedule({ user }) {
  const [params] = useSearchParams();
  const requested = params.get("offeringId") || "";
  const todayKey = getBusinessTodayKey();
  const currentWeek = formatDateKey(mondayOf(todayKey));
  const appliedRequest = useRef("");
  const [majorId, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState(() => currentWeek);
  const [selectedId, setSelected] = useState(requested);
  const [editor, setEditor] = useState(null);
  const [details, setDetails] = useState(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const weekDays = weekDaysFrom(week);
  const selectedDays = selected?.allowedWeekdays || intersectDays(groupsOf(selected));
  const selectedGroupIds = new Set(groupsOf(selected).map((group) => group.id));
  const selecting = canEdit && selected?.status === "active";
  const refresh = () => { offerings.reload(); sessions.reload(); pending.reload(); };
  const saved = () => { setEditor(null); setDetails(null); setError(""); refresh(); };
  const openSession = (session) => { setDetails(null); setPendingOpen(false); setEditor({ session, offering: all.find((row) => row.id === session.courseOfferingId) || session.courseOffering }); };
  const select = (offering) => { setSelected(offering.id); setDetails(null); };
  const changeScope = (callback) => { callback(); setSelected(""); };
  const confirmation = async (session, result) => {
    setSaving(true); setError("");
    try { await api.put(`/scheduling/teaching-sessions/${session.id}/confirmation`, { status: result }); refresh(); }
    catch (failure) { setError(message(failure)); }
    finally { setSaving(false); }
  };
  const sessionStatusKey = (session) => session.status === "held" ? "held" : session.status === "not_held" ? "not" : isSessionPast(session) ? "wait" : "planned";
  const dayFocusStatusKey = (session) => session.status === "held" ? "held" : session.status === "not_held" ? "not" : "planned";
  const sessionState = (session) => ({ held: ["sl-held", "✓ ĐÃ DIỄN RA"], not: ["sl-not", "— KHÔNG DIỄN RA"], wait: ["sl-wait", "● CHỜ XÁC NHẬN"], planned: ["", "○ ĐÃ XẾP"] }[sessionStatusKey(session)]);
  const sessionCard = (session, compact = false) => { const [style, state] = sessionState(session); return <button key={session.id} className={`sl-session ${compact ? "sl-session-compact" : ""} ${style}`} onClick={() => openSession(session)}><strong>{offeringTitle(session.courseOffering)}</strong><span>{subjectLabel(session.courseOffering)}</span><small>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</small><em>{state}</em></button>; };
  const dayFocusSessionCard = (session) => {
    const style = { held: "sl-held", not: "sl-not", planned: "" }[dayFocusStatusKey(session)];
    const title = offeringTitle(session.courseOffering);
    const subject = subjectLabel(session.courseOffering);
    const subjectCode = session.courseOffering?.subject?.code || subject || "Chưa có mã học phần";
    const room = session.room?.code || "Chưa có phòng";
    return <button key={session.id} className={`sl-session sl-focus-session ${style}`} onClick={() => openSession(session)}><strong title={title}>{title}</strong><span className="sl-focus-meta" title={`${subject} · ${room}`}><span>{subjectCode}</span><span>· {room}</span></span></button>;
  };
  const changeWeek = (nextWeek) => {
    const focusedWeekdayIndex = focusedDate
      ? weekDays.findIndex((day) => formatDateKey(day) === focusedDate)
      : -1;
    setWeek(nextWeek);
    if (focusedWeekdayIndex >= 0) {
      setFocusedDate(formatDateKey(addDays(nextWeek, focusedWeekdayIndex)));
    }
  };
  const sessionsOn = (date, period) => visibleSessions.filter((session) => session.sessionDate === date && (!period || session.period === period));
  const slotState = (day, period) => {
    const date = formatDateKey(day);
    return {
      date,
      past: isSessionPast({ sessionDate: date, endTime: period === "MORNING" ? "12:00" : "23:59" }),
      incompatible: selecting && !selectedDays.includes(day.getDay()),
      items: sessionsOn(date, period),
      occupied: selecting && (sessions.data || []).some((session) => session.status !== "not_held" && session.sessionDate === date && session.period === period && (session.courseOfferingId === selected.id || groupsOf(session.courseOffering).some((group) => selectedGroupIds.has(group.id)))),
    };
  };
  const addSessionButton = (day, period) => {
    const { date, past, incompatible, occupied } = slotState(day, period);
    return selecting && !past && !incompatible && !occupied && <button className="v20-add-slot" aria-label={`Xếp ${period === "MORNING" ? "Sáng" : "Chiều"} ${date}`} disabled={sessions.loading || !!sessions.error} onClick={() => setEditor({ offering: selected, date, period })}>+ Xếp buổi</button>;
  };
  const focusedDay = focusedDate ? weekDays.find((day) => formatDateKey(day) === focusedDate) : null;
  return <section className={`sl-workspace sl-schedule-view ${sidebarCollapsed ? "sl-sidebar-collapsed" : ""}`} aria-label="Không gian xếp lịch"><aside className="sl-left" data-collapsed={sidebarCollapsed}>
    <button type="button" className="sl-sidebar-toggle" aria-label={sidebarCollapsed ? "Mở phạm vi làm việc" : "Thu gọn phạm vi làm việc"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? "›" : "‹"}</button>
    <div className="sl-sidebar-content"><div className="sl-scope"><div className="sl-eyebrow">PHẠM VI LÀM VIỆC</div>
    <div className="sl-schedule-scope-fields">
      <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>1</b>CHUYÊN NGÀNH</div><SearchSelect label="Chuyên ngành" value={majorId} placeholder="Tất cả chuyên ngành" options={[{ id: "", name: "Tất cả chuyên ngành" }, ...(majors.data || [])]} onChange={(value) => changeScope(() => { setMajor(value); setYear(""); })} /></div>
      <div className="sl-schedule-scope-field"><div className="v20-scope-step"><b>2</b>KHÓA / NĂM HỌC</div><select className={`sl-select sl-year-select${year ? "" : " sl-placeholder"}`} aria-label="Khóa / Năm" value={year} onChange={(event) => changeScope(() => setYear(event.target.value))}><option value="">Tất cả</option>{unique(all.flatMap(groupsOf).filter((group) => !majorId || group.majorId === majorId).map((group) => group.academicYear)).sort((a, b) => b.localeCompare(a, "vi", { numeric: true })).map((value) => <option key={value}>{value}</option>)}</select></div>
    </div>
    {!canEdit && <div className="sl-attention">Quyền chỉ xem · Quản trị viên phân công người phụ trách tại Hệ thống → QL Người dùng.</div>}
    {majors.error && <Notice error={majors.error} />}
  </div><div className="sl-worklist"><div className="sl-search-wrap"><span>⌕</span><input className="sl-search" aria-label="Tìm môn / lớp" placeholder="Tìm lớp học phần..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="sl-card-scroll">{offerings.loading ? <Notice>Đang tải lớp học phần...</Notice> : offerings.error ? <Notice error={offerings.error} /> : <section className="sl-section"><h2><span>LỚP HỌC PHẦN</span><b>{listed.length}</b></h2>{listed.map((offering) => {
    const summary = offering.sessionSummary || {};
    return <article key={offering.id} id={`offering-${offering.id}`} className={`sl-card ${selectedId === offering.id ? "sl-selected" : ""}`}>
      <button className="sl-btn sl-btn-link sl-card-detail" onClick={() => setDetails(offering)}><strong>{offeringTitle(offering)}</strong><span>{subjectLabel(offering)}</span><small>{groupsOf(offering).length} lớp/nhóm · {offering.participantCount ?? 0} HV</small></button>
      <div className="sl-card-foot"><div className="sl-card-copy"><strong>Đã diễn ra {summary.heldCount || 0} buổi</strong><span className={!summary.futurePlannedCount ? "sl-no-week" : ""}>{summary.futurePlannedCount ? `Có ${summary.futurePlannedCount} lịch sắp tới` : "Chưa có lịch tuần này"}</span></div>{canEdit && offering.status === "active" && <button className="sl-btn sl-btn-primary sl-btn-sm" onClick={() => select(offering)}>Xếp lịch</button>}</div>
    </article>;
  })}{!listed.length && <Notice>Không có lớp học phần trong phạm vi đã chọn.</Notice>}</section>}</div></div></div></aside>
  <section className="sl-right"><div className="sl-schedule-head"><h1>XẾP LỊCH</h1><div className="sl-week"><button aria-label="Tuần trước" onClick={() => changeWeek(formatDateKey(addDays(week, -7)))}>‹</button><strong>{vietnameseDate(week)} — {vietnameseDate(end)}</strong><button aria-label="Tuần sau" onClick={() => changeWeek(formatDateKey(addDays(week, 7)))}>›</button></div>
    <div className="sl-actions"><button className="sl-btn sl-today" disabled={week === currentWeek && !focusedDate} onClick={() => changeWeek(currentWeek)}>Tuần này</button>{canEdit && <button className="sl-pending" onClick={() => setPendingOpen(true)}>{pending.loading ? "…" : pending.data?.length ?? "—"} chờ xác nhận</button>}</div>
  </div>{selecting && <div className="sl-selected-strip"><span className="sl-selected-tag">ĐANG XẾP</span><div className="sl-selected-main"><strong>{selected.subject?.code} · {selected.subject?.name}</strong><span>{labelOf(selected)} · {selected.participantCount} HV</span></div><div className="sl-selected-next"><span>Ngày có thể xếp</span><strong>{daysLabel(selectedDays)}</strong></div><button className="sl-btn" onClick={() => setSelected("")}>Bỏ chọn</button></div>}
    {sessions.error && <Notice error={sessions.error} />}{error && <Notice error={error} />}
    <div className={`sl-calendar-wrap ${selecting ? "sl-selecting" : ""}`} aria-busy={sessions.loading}>{focusedDay ? <section className="sl-day-focus" aria-label={`Lịch ngày ${vietnameseDate(focusedDate)}`}>
      <header className="sl-day-focus-head"><button type="button" className="sl-focus-back" onClick={() => setFocusedDate("")}>← Tuần</button><strong>{vietnameseWeekdayShort(focusedDay)} · {vietnameseDate(focusedDate)} · {sessionsOn(focusedDate).length} lớp</strong></header>
      <nav className="sl-day-focus-tabs" aria-label="Chọn ngày trong tuần">{weekDays.map((day) => {
        const date = formatDateKey(day);
        const count = sessionsOn(date).length;
        return <button type="button" key={date} className={date === focusedDate ? "sl-active" : ""} title={`${vietnameseDate(date)} · ${count} lớp`} aria-label={`${vietnameseWeekdayShort(day)} ${vietnameseDate(date)} · ${count} lớp`} aria-pressed={date === focusedDate} onClick={() => setFocusedDate(date)}><strong>{vietnameseWeekdayShort(day)}</strong><b>{count}</b></button>;
      })}</nav>
      <div className="sl-day-focus-periods">{["MORNING", "AFTERNOON"].map((period) => {
        const { items, past, incompatible } = slotState(focusedDay, period);
        const periodLabel = period === "MORNING" ? "SÁNG" : "CHIỀU";
        const grouped = { planned: [], held: [], not: [] };
        items.forEach((session) => grouped[dayFocusStatusKey(session)].push(session));
        return <section className={`sl-day-focus-period ${past ? "sl-past" : ""} ${incompatible ? "sl-incompatible" : ""}`} aria-label={`${periodLabel} · ${items.length} lớp`} key={period}><header><h2>{periodLabel}</h2><span>{items.length} lớp</span></header><div className="sl-day-focus-period-body">
          {sessions.loading ? <span className="v20-hint">Đang tải...</span> : <>
            {!!items.length && <div className="sl-status-board" aria-label={`Trạng thái ${periodLabel}`}>{DAY_FOCUS_STATUS_LANES.map((lane) => <section className={`sl-status-lane sl-status-lane-${lane.key}`} aria-label={`${lane.label} · ${grouped[lane.key].length} lớp`} key={lane.key}><header><strong><i aria-hidden="true">{lane.symbol}</i>{lane.label}</strong><b>{grouped[lane.key].length}</b></header><div className="sl-status-lane-list">{grouped[lane.key].map(dayFocusSessionCard)}{!grouped[lane.key].length && <span className="sl-lane-empty">Không có lớp</span>}</div></section>)}</div>}
            {!items.length && <span className="sl-focus-empty">{past ? "Buổi đã qua" : "Chưa có lịch"}</span>}
          </>}
          {incompatible && <span className="sl-focus-empty">Không thuộc ngày học chung</span>}
          {addSessionButton(focusedDay, period)}
        </div></section>;
      })}</div>
    </section> : <div className="sl-calendar" role="table" aria-label="Lịch học theo tuần"><div className="sl-corner">BUỔI</div>{weekDays.map((day) => {
      const dateKey = formatDateKey(day);
      const isToday = dateKey === todayKey;
      const count = sessionsOn(dateKey).length;
      return <button type="button" className={`sl-day ${isToday ? "sl-is-today" : ""}`} key={dateKey} aria-label={`Xem lịch ${vietnameseDate(dateKey)}: ${count} lớp`} onClick={() => setFocusedDate(dateKey)}><strong>{vietnameseWeekdayShort(day)}</strong><span>{vietnameseDayMonth(day).replace("/", "-")}</span><b>{count}</b>{isToday && <i className="sl-today-indicator" aria-label="Hôm nay" title="Hôm nay" />}</button>;
    })}
      {["MORNING", "AFTERNOON"].map((period) => <React.Fragment key={period}><div className="sl-period"><span>{period === "MORNING" ? "SÁNG" : "CHIỀU"}</span></div>{weekDays.map((day) => {
        const { date, past, incompatible, items } = slotState(day, period);
        return <div key={date} className={`sl-slot ${past ? "sl-past" : ""} ${incompatible ? "sl-incompatible" : ""}`}><div className="v20-slot-items">
          {sessions.loading ? <span className="v20-hint">Đang tải...</span> : items.slice(0, WEEK_SLOT_LIMIT).map((session) => sessionCard(session, true))}
          {items.length > WEEK_SLOT_LIMIT && <button className="sl-other" aria-label={`Xem thêm ${items.length - WEEK_SLOT_LIMIT} lớp ngày ${date}`} onClick={() => setFocusedDate(date)}>+{items.length - WEEK_SLOT_LIMIT} lớp</button>}
          {addSessionButton(day, period)}
          {!items.length && !selecting && !sessions.loading && <span className="v20-hint">{past ? "Buổi đã qua" : "Chưa có lịch"}</span>}
          {incompatible && <span className="v20-hint">Không thuộc ngày học chung</span>}
        </div></div>;
      })}</React.Fragment>)}
    </div>}</div>
  </section>
  {editor && <SessionEditor key={editor.session?.id || `${editor.date}-${editor.period}`} {...editor} user={user} onClose={() => setEditor(null)} onSaved={saved} onViewOffering={(offering) => { setEditor(null); setDetails(offering); }} />}
  {details && <OfferingDetails offering={details} user={user} onClose={() => setDetails(null)} onSaved={saved} onOpenSession={openSession} onSelect={select} />}
  {pendingOpen && <Modal wide className="sl-pending-drawer" bodyClassName="sl-pending-body" title={`BUỔI CHỜ XÁC NHẬN · ${pending.data?.length ?? 0}`} busy={saving} onClose={() => setPendingOpen(false)}>{pending.loading ? <Notice>Đang tải...</Notice> : pending.error ? <Notice error={pending.error} /> : <>{error && <Notice error={error} />}{[...(pending.data || [])].sort((left, right) => `${left.sessionDate} ${left.endTime}`.localeCompare(`${right.sessionDate} ${right.endTime}`)).map((session) => {
    const title = offeringTitle(session.courseOffering);
    return <article className="sl-pending-card" key={session.id}>
      <div className="sl-pending-date"><strong>{vietnameseDate(session.sessionDate)}</strong><span>{session.period === "MORNING" ? "SÁNG" : "CHIỀU"}</span></div>
      <div className="sl-pending-copy"><h3 title={title}>{title}</h3><span>{subjectLabel(session.courseOffering)}</span></div>
      <div className="sl-pending-side"><small>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</small><div className="sl-pending-actions"><button className="sl-btn" disabled={saving} onClick={() => confirmation(session, "not_held")}>Không diễn ra</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => confirmation(session, "held")}>✓ Đã diễn ra</button></div></div>
    </article>;
  })}{!pending.data?.length && <Notice>Không có buổi chờ xác nhận.</Notice>}</>}</Modal>}
  </section>;
}
