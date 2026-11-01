import React, { useEffect, useRef, useState } from "react";
import { Popover } from "@mui/material";
import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import { normalizeTimeInput } from "../utils/schedulingCalendar";
import "./timeField.css";

/** A shared time picker whose selection colors do not depend on the browser. */
export default function TimeField({ value = "", onChange, disabled, readOnly, onBlur, ...props }) {
  const [draft, setDraft] = useState(value);
  const [anchor, setAnchor] = useState(null);
  const lastEmitted = useRef(value);
  const label = props["aria-label"] || "Giờ";
  useEffect(() => {
    if (value !== lastEmitted.current) { setDraft(value); lastEmitted.current = value; }
  }, [value]);
  const emit = (next, event = {}) => {
    lastEmitted.current = next;
    onChange?.({ ...event, target: { ...event.target, name: props.name, id: props.id, value: next } });
  };
  const time = normalizeTimeInput(value) || "08:00";
  const [hour, minute] = time.split(":").map(Number);
  const selectedHour = hour % 12 || 12;
  const afternoon = hour >= 12;
  const choose = (nextHour, nextMinute, nextAfternoon) => {
    const next = `${String(nextHour % 12 + (nextAfternoon ? 12 : 0)).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    setDraft(next);
    emit(next);
  };
  const column = (title, items, selected, pick) => <div className="app-time-column" role="group" aria-label={title}>
    <strong>{title}</strong>
    <div>{items.map(item => <button type="button" key={item} aria-pressed={item === selected}
      ref={node => { if (node && item === selected) node.scrollIntoView?.({ block: "nearest" }); }}
      onClick={() => pick(item)}>{typeof item === "number" ? String(item).padStart(2, "0") : item}</button>)}</div>
  </div>;
  return <>
    <span className={`app-time-field${disabled ? " is-disabled" : ""}`}>
      <input {...props} type="text" inputMode="numeric" placeholder="hh:mm" maxLength={5} value={draft}
        disabled={disabled} readOnly={readOnly} aria-invalid={Boolean(draft && !normalizeTimeInput(draft))}
        onChange={event => { const raw = event.target.value; setDraft(raw); const normalized = normalizeTimeInput(raw); if (normalized) emit(normalized, event); }}
        onBlur={event => { setDraft(normalizeTimeInput(draft) || value); onBlur?.(event); }} />
      <button type="button" className="app-time-trigger" aria-label={`Chọn giờ: ${label}`} aria-haspopup="dialog"
        aria-expanded={!!anchor && !disabled && !readOnly} disabled={disabled || readOnly}
        onClick={event => setAnchor(event.currentTarget)}><AccessTimeRounded fontSize="small" /></button>
    </span>
    {anchor && !disabled && !readOnly && <Popover open anchorEl={anchor} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{ className: "app-time-picker", role: "dialog", "aria-label": `Chọn giờ: ${label}` }}>
      <div className="app-time-columns">
        {column("Giờ", Array.from({ length: 12 }, (_, i) => i + 1), selectedHour, next => choose(next, minute, afternoon))}
        {column("Phút", Array.from({ length: 60 }, (_, i) => i), minute, next => choose(selectedHour, next, afternoon))}
        {column("Buổi", ["SA", "CH"], afternoon ? "CH" : "SA", next => choose(selectedHour, minute, next === "CH"))}
      </div>
      <button type="button" className="app-time-done" onClick={() => setAnchor(null)}>Xong</button>
    </Popover>}
  </>;
}
