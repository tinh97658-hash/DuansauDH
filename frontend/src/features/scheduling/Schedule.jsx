import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { api, groupsOf, intersectDays, labelOf, message, Modal, normalize, Notice, offeringTitle, rows, SearchSelect, subjectLabel, unique, useLoad } from "./shared";
import { addDays, formatDateKey, getBusinessTodayKey, isSessionPast, mondayOf, vietnameseDate, vietnameseDayMonth, vietnameseWeekdayShort, weekDaysFrom } from "../../utils/schedulingCalendar";
import SessionEditor from "./SessionEditor";
import OfferingDetails from "./OfferingDetails";

const WEEK_SLOT_LIMIT = 3;
const DAY_FOCUS_STATUS_LANES = [
  { key: "planned", label: "ĐÃ XẾP", symbol: "○" },
  { key: "held", label: "ĐÃ DIỄN RA", symbol: "✓" },
  { key: "not", label: "KHÔNG DIỄN RA", symbol: "—" },
];

function SessionMagnifier({ session, stateClass, stateLabel, className, onClick, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const triggerRef = useRef(null);
  const previewRef = useRef(null);
  const openTimer = useRef(null);
  const previewId = `session-magnifier-${session.id}`;
  const title = offeringTitle(session.courseOffering);
  const subject = subjectLabel(session.courseOffering);
  const lecturer = session.lecturer?.name || "Chưa có giảng viên";
  const room = session.room?.code || "Chưa có phòng";
  const period = session.period === "MORNING" ? "Sáng" : "Chiều";
  const time = session.startTime && session.endTime
    ? `${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}`
    : "Chưa có giờ";

  const close = () => {
    window.clearTimeout(openTimer.current);
    setOpen(false);
  };
  const openSoon = () => {
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(true), 180);
  };
  const openNow = () => {
    window.clearTimeout(openTimer.current);
    setOpen(true);
  };

  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const preview = previewRef.current;
      if (!trigger || !preview) return;
      const triggerRect = trigger.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const edge = 12;
      const gap = 12;
      const fitsRight = triggerRect.right + gap + previewRect.width <= window.innerWidth - edge;
      const fitsLeft = triggerRect.left - gap - previewRect.width >= edge;
      let left = fitsRight
        ? triggerRect.right + gap
        : fitsLeft
          ? triggerRect.left - gap - previewRect.width
          : triggerRect.left + (triggerRect.width - previewRect.width) / 2;
      left = Math.min(Math.max(edge, left), window.innerWidth - edge - previewRect.width);
      let top = triggerRect.top + (triggerRect.height - previewRect.height) / 2;
      top = Math.min(Math.max(edge, top), window.innerHeight - edge - previewRect.height);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const preview = open && createPortal(
    <aside
      id={previewId}
      ref={previewRef}
      className={`sl-session-magnifier ${stateClass}`}
      role="tooltip"
      style={position}
    >
      <div className="sl-magnifier-eyebrow"><span aria-hidden="true">Aa</span>XEM NHANH LỚP HỌC</div>
      <strong className="sl-magnifier-title">{title}</strong>
      <span className="sl-magnifier-subject">{subject}</span>
      <dl>
        <div><dt>Thời gian</dt><dd>{vietnameseDate(session.sessionDate)} · {period} · {time}</dd></div>
        <div><dt>Giảng viên</dt><dd>{lecturer}</dd></div>
        <div><dt>Phòng học</dt><dd>{room}</dd></div>
      </dl>
      <em>{stateLabel}</em>
      <small>Nhấn Enter để xem chi tiết</small>
    </aside>,
    document.body
  );

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={className}
      aria-describedby={open ? previewId : undefined}
      onMouseEnter={openSoon}
      onMouseLeave={close}
      onFocus={openNow}
      onBlur={close}
      onClick={onClick}
    >
      {children}
    </button>
    {preview}
  </>;
}

function WeekOverflowPreview({ date, dayLabel, period, hiddenSessions, onOpenDay }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const previewId = `week-overflow-${date}-${period.toLowerCase()}`;
  const periodLabel = period === "MORNING" ? "SÁNG" : "CHIỀU";

  const clearOpenTimer = () => window.clearTimeout(openTimer.current);
  const clearCloseTimer = () => window.clearTimeout(closeTimer.current);
  const queueOpen = () => {
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = window.setTimeout(() => setOpen(true), 150);
  };
  const queueClose = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        window.clearTimeout(openTimer.current);
        window.clearTimeout(closeTimer.current);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const edge = 12;
      let left = triggerRect.left;
      if (left + popoverRect.width > window.innerWidth - edge) left = window.innerWidth - edge - popoverRect.width;
      left = Math.max(edge, left);
      let top = triggerRect.bottom + 8;
      if (top + popoverRect.height > window.innerHeight - edge) top = Math.max(edge, triggerRect.top - popoverRect.height - 8);
      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const preview = open && createPortal(
    <aside
      id={previewId}
      ref={popoverRef}
      className="sl-week-overflow-popover"
      role="tooltip"
      style={position}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={queueClose}
    >
      <header><strong>{dayLabel} · {periodLabel}</strong><span>{hiddenSessions.length} lớp còn lại</span></header>
      <div className="sl-week-overflow-list">
        {hiddenSessions.map((session) => {
          const title = offeringTitle(session.courseOffering);
          const room = session.room?.code || "Chưa có phòng";
          return <article key={session.id}><strong title={title}>{title}</strong><span title={room}>{room}</span></article>;
        })}
      </div>
    </aside>,
    document.body
  );

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="sl-other"
      aria-label={`Xem thêm ${hiddenSessions.length} lớp ngày ${date}`}
      aria-describedby={open ? previewId : undefined}
      aria-expanded={open}
      onMouseEnter={queueOpen}
      onMouseLeave={queueClose}
      onFocus={queueOpen}
      onBlur={(event) => {
        if (!popoverRef.current?.contains(event.relatedTarget)) queueClose();
      }}
      onClick={onOpenDay}
    >
      +{hiddenSessions.length} lớp
    </button>
    {preview}
  </>;
}

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
  const sessionCard = (session, compact = false) => {
    const [style, state] = sessionState(session);
    return <SessionMagnifier key={session.id} session={session} stateClass={style} stateLabel={state} className={`sl-session ${compact ? "sl-session-compact" : ""} ${style}`} onClick={() => openSession(session)}><strong>{offeringTitle(session.courseOffering)}</strong><span>{subjectLabel(session.courseOffering)}</span><small>{session.lecturer?.name || "Chưa có giảng viên"} · {session.room?.code || "Chưa có phòng"}</small><em>{state}</em></SessionMagnifier>;
  };
  const dayFocusSessionCard = (session) => {
    const style = { held: "sl-held", not: "sl-not", planned: "" }[dayFocusStatusKey(session)];
    const title = offeringTitle(session.courseOffering);
    const subject = subjectLabel(session.courseOffering);
    const subjectCode = session.courseOffering?.subject?.code || subject || "Chưa có mã học phần";
    const room = session.room?.code || "Chưa có phòng";
    const state = sessionState(session)[1];
    return <SessionMagnifier key={session.id} session={session} stateClass={style} stateLabel={state} className={`sl-session sl-focus-session ${style}`} onClick={() => openSession(session)}><strong title={title}>{title}</strong><span className="sl-focus-meta" title={`${subject} · ${room}`}><span>{subjectCode}</span><span>· {room}</span></span></SessionMagnifier>;
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
  const schedulingAvailability = ({ past, incompatible }) => {
    const visible = selecting && !past && !incompatible;
    return { visible, enabled: visible && !sessions.loading && !sessions.error };
  };
  const openSlotScheduler = (slot, period) => {
    if (!schedulingAvailability(slot).enabled) return;
    setEditor({ offering: selected, date: slot.date, period });
  };
  const addSessionButton = (day, period, existingSlot) => {
    const slot = existingSlot || slotState(day, period);
    const availability = schedulingAvailability(slot);
    return availability.visible && <button type="button" className="v20-add-slot" aria-label={`Xếp ${period === "MORNING" ? "Sáng" : "Chiều"} ${slot.date}`} disabled={!availability.enabled} onClick={() => openSlotScheduler(slot, period)}>+ Xếp buổi</button>;
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
  </div>{selecting && <div className="sl-selected-strip"><span className="sl-selected-tag">ĐANG XẾP</span><strong className="sl-selected-offering" title={offeringTitle(selected)}>{offeringTitle(selected)}</strong><span className="sl-selected-meta">{selected.subject?.code ? `${selected.subject.code} · ` : ""}{groupsOf(selected).length} lớp/nhóm · {selected.participantCount ?? 0} HV</span><button type="button" className="sl-btn sl-selected-clear" onClick={() => setSelected("")}>Bỏ chọn</button></div>}
    {sessions.error && <Notice error={sessions.error} />}{error && <Notice error={error} />}
    <div className={`sl-calendar-wrap ${selecting ? "sl-selecting" : ""}`} aria-busy={sessions.loading}>{focusedDay ? <section className="sl-day-focus" aria-label={`Lịch ngày ${vietnameseDate(focusedDate)}`}>
      <header className="sl-day-focus-head"><button type="button" className="sl-focus-back" onClick={() => setFocusedDate("")}>← Tuần</button><strong>{vietnameseWeekdayShort(focusedDay)} · {vietnameseDate(focusedDate)} · {sessionsOn(focusedDate).length} lớp</strong></header>
      <nav className="sl-day-focus-tabs" aria-label="Chọn ngày trong tuần">{weekDays.map((day) => {
        const date = formatDateKey(day);
        const count = sessionsOn(date).length;
        return <button type="button" key={date} className={date === focusedDate ? "sl-active" : ""} title={`${vietnameseDate(date)} · ${count} lớp`} aria-label={`${vietnameseWeekdayShort(day)} ${vietnameseDate(date)} · ${count} lớp`} aria-pressed={date === focusedDate} onClick={() => setFocusedDate(date)}><strong>{vietnameseWeekdayShort(day)}</strong><b>{count}</b></button>;
      })}</nav>
      <div className="sl-day-focus-periods">{["MORNING", "AFTERNOON"].map((period) => {
        const slot = slotState(focusedDay, period);
        const { items, past, incompatible } = slot;
        const periodLabel = period === "MORNING" ? "SÁNG" : "CHIỀU";
        const grouped = { planned: [], held: [], not: [] };
        items.forEach((session) => grouped[dayFocusStatusKey(session)].push(session));
        return <section className={`sl-day-focus-period ${past ? "sl-past" : ""} ${incompatible ? "sl-incompatible" : ""}`} aria-label={`${periodLabel} · ${items.length} lớp`} key={period}><header><h2>{periodLabel}</h2><span>{items.length} lớp</span></header><div className="sl-day-focus-period-body">
          {sessions.loading ? <span className="v20-hint">Đang tải...</span> : <>
            {!!items.length && <div className="sl-status-board" aria-label={`Trạng thái ${periodLabel}`}>{DAY_FOCUS_STATUS_LANES.map((lane) => <section className={`sl-status-lane sl-status-lane-${lane.key}`} aria-label={`${lane.label} · ${grouped[lane.key].length} lớp`} key={lane.key}><header><strong><i aria-hidden="true">{lane.symbol}</i>{lane.label}</strong><b>{grouped[lane.key].length}</b></header><div className="sl-status-lane-list">{grouped[lane.key].map(dayFocusSessionCard)}{!grouped[lane.key].length && <span className="sl-lane-empty">Không có lớp</span>}</div></section>)}</div>}
            {!items.length && <span className="sl-focus-empty">{past ? "Buổi đã qua" : "Chưa có lịch"}</span>}
          </>}
          {incompatible && <span className="sl-focus-empty">Không thuộc ngày học chung</span>}
          {addSessionButton(focusedDay, period, slot)}
        </div></section>;
      })}</div>
    </section> : <div className="sl-calendar" role="table" aria-label="Lịch học theo tuần"><div className="sl-corner">BUỔI</div>{weekDays.map((day) => {
      const dateKey = formatDateKey(day);
      const isToday = dateKey === todayKey;
      const count = sessionsOn(dateKey).length;
      return <button type="button" className={`sl-day ${isToday ? "sl-is-today" : ""}`} key={dateKey} aria-label={`Xem lịch ${vietnameseDate(dateKey)}: ${count} lớp`} onClick={() => setFocusedDate(dateKey)}><strong>{vietnameseWeekdayShort(day)}</strong><span>{vietnameseDayMonth(day).replace("/", "-")}</span><b>{count}</b>{isToday && <i className="sl-today-indicator" aria-label="Hôm nay" title="Hôm nay" />}</button>;
    })}
      {["MORNING", "AFTERNOON"].map((period) => <React.Fragment key={period}><div className="sl-period"><span>{period === "MORNING" ? "SÁNG" : "CHIỀU"}</span></div>{weekDays.map((day) => {
        const slot = slotState(day, period);
        const { date, past, incompatible, items } = slot;
        const availability = schedulingAvailability(slot);
        const handleSlotSelection = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (availability.enabled) openSlotScheduler(slot, period);
        };
        return <div key={date} className={`sl-slot ${past ? "sl-past" : ""} ${incompatible ? "sl-incompatible" : ""} ${availability.enabled ? "sl-slot-schedulable" : ""}`} onClickCapture={availability.visible ? handleSlotSelection : undefined}>
          {availability.visible && <button type="button" className="sl-slot-schedule-target" aria-label={`Xếp ${period === "MORNING" ? "Sáng" : "Chiều"} ${date}`} disabled={!availability.enabled} />}
          <div className="v20-slot-items">
          {sessions.loading ? <span className="v20-hint">Đang tải...</span> : items.slice(0, WEEK_SLOT_LIMIT).map((session) => sessionCard(session, true))}
          {items.length > WEEK_SLOT_LIMIT && <WeekOverflowPreview date={date} dayLabel={vietnameseWeekdayShort(day)} period={period} hiddenSessions={items.slice(WEEK_SLOT_LIMIT)} onOpenDay={() => setFocusedDate(date)} />}
          {!items.length && availability.visible && <span className={`v20-add-slot sl-week-slot-affordance${availability.enabled ? "" : " sl-disabled"}`} aria-hidden="true">+ Xếp buổi</span>}
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
