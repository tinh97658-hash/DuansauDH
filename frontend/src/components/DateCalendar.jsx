import { ChevronLeftIcon, ChevronRightIcon } from "./AppIcons";
import React, { useState } from "react";
import { Popover } from "@mui/material";
import AppSelect from "./AppSelect";
import { formatDate, parseDisplayDate } from "../utils/dateFormat";
import { getBusinessTodayKey } from "../utils/schedulingCalendar";

const keyOf = date => date.toISOString().slice(0, 10);
const dateOf = key => new Date(`${key}T00:00:00Z`);
const shiftDay = (key, amount) => { const date = dateOf(key); date.setUTCDate(date.getUTCDate() + amount); return keyOf(date); };

export default function DateCalendar({ anchorEl, value, min, max, onSelect, onClose, label }) {
  const today = getBusinessTodayKey();
  const withinBounds = key => (!min || key >= min) && (!max || key <= max);
  const initial = parseDisplayDate(value) || (min && today < min ? min : max && today > max ? max : today);
  const [focused, setFocused] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const first = dateOf(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => shiftDay(`${month}-01`, index - offset));
  const activeDate = days.includes(focused) ? focused : days.find(key => key.startsWith(month) && withinBounds(key));
  const firstYear = min ? Number(min.slice(0, 4)) : Math.min(1900, year);
  const lastYear = max ? Number(max.slice(0, 4)) : Math.max(Number(today.slice(0, 4)) + 100, year);
  const moveMonth = amount => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    setMonth(keyOf(date).slice(0, 7));
  };
  const select = key => { if (withinBounds(key)) { onSelect(key); onClose(); } };
  const handleKey = (event, key) => {
    const amount = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (amount === undefined) return;
    event.preventDefault();
    const next = shiftDay(key, amount);
    if (!withinBounds(next)) return;
    setFocused(next);
    setMonth(next.slice(0, 7));
    requestAnimationFrame(() => document.querySelector(`.app-date-calendar [data-date="${next}"]`)?.focus());
  };
  return <Popover open anchorEl={anchorEl} onClose={onClose}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
    PaperProps={{ className: "app-date-calendar", role: "dialog", "aria-label": `Chọn ngày${label ? `: ${label}` : ""}` }}>
    <div className="app-date-calendar-header">
      <button type="button" aria-label="Tháng trước" disabled={!!min && month <= min.slice(0, 7)} onClick={() => moveMonth(-1)}><ChevronLeftIcon fontSize="inherit" /></button>
      <AppSelect aria-label="Tháng" value={monthNumber} onChange={event => setMonth(`${year}-${String(event.target.value).padStart(2, "0")}`)}>
        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
      </AppSelect>
      <AppSelect aria-label="Năm" value={year} onChange={event => setMonth(`${event.target.value}-${String(monthNumber).padStart(2, "0")}`)}>
        {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => <option key={i} value={firstYear + i}>{firstYear + i}</option>)}
      </AppSelect>
      <button type="button" aria-label="Tháng sau" disabled={!!max && month >= max.slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRightIcon fontSize="inherit" /></button>
    </div>
    <div className="app-date-calendar-grid" role="group" aria-label={`Tháng ${monthNumber}/${year}`}>
      {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(day => <span key={day}>{day}</span>)}
      {days.map(key => <button type="button" key={key} data-date={key} aria-label={formatDate(key)}
        aria-pressed={key === parseDisplayDate(value)} aria-current={key === today ? "date" : undefined}
        className={key.startsWith(month) ? undefined : "outside-month"} disabled={!withinBounds(key)}
        tabIndex={key === activeDate ? 0 : -1} autoFocus={key === activeDate} onFocus={() => setFocused(key)}
        onKeyDown={event => handleKey(event, key)} onClick={() => select(key)}>{Number(key.slice(8, 10))}</button>)}
    </div>
    <div className="app-date-calendar-footer">
      <button type="button" onClick={() => { onSelect(""); onClose(); }}>Xóa</button>
      <button type="button" disabled={!withinBounds(today)} onClick={() => select(today)}>Hôm nay</button>
    </div>
  </Popover>;
}
