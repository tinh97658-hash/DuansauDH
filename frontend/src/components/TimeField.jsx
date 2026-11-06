import React, { useEffect, useRef, useState } from "react";
import { Popover } from "@mui/material";
import { ClockIcon, ChevronUpIcon, ChevronDownIcon } from "./AppIcons";
import { normalizeTimeInput } from "../utils/schedulingCalendar";
import "./timeField.css";

function TimeSegment({label,value,max,onChange,onStep,onDone}) {
  const [editing,setEditing]=useState(false),[text,setText]=useState('');
  return <div className="app-time-segment" role="group" aria-label={label}>
    <span>{label}</span>
    <button type="button" aria-label={`Tăng ${label.toLowerCase()}`} onClick={()=>onStep(1)}><ChevronUpIcon/></button>
    <input type="text" role="spinbutton" inputMode="numeric" maxLength={2} aria-label={label==='Giờ'?'Giờ chính xác':'Phút chính xác'}
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} value={editing?text:String(value).padStart(2,'0')}
      onFocus={event=>{setEditing(true);setText(String(value).padStart(2,'0'));event.target.select();}}
      onBlur={()=>{setEditing(false);setText('');}}
      onChange={event=>{const next=event.target.value;if(!/^\d{0,2}$/.test(next))return;setEditing(true);setText(next);if(next!==''&&Number(next)<=max)onChange(Number(next));}}
      onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();setEditing(false);onStep(event.key==='ArrowUp'?1:-1);}else if(event.key==='Enter'){event.preventDefault();onDone();}}}/>
    <button type="button" aria-label={`Giảm ${label.toLowerCase()}`} onClick={()=>onStep(-1)}><ChevronDownIcon/></button>
  </div>;
}

/** A compact 24-hour editor shared by exam time fields. */
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
  const choose = (nextHour, nextMinute) => {
    const next = `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    setDraft(next);
    emit(next);
  };
  const step = amount => {
    const total = (hour * 60 + minute + amount + 1440) % 1440;
    choose(Math.floor(total / 60), total % 60);
  };
  return <>
    <span className={`app-time-field${disabled ? " is-disabled" : ""}`}>
      <input {...props} type="text" inputMode="numeric" placeholder="hh:mm" maxLength={5} value={draft}
        disabled={disabled} readOnly={readOnly} aria-invalid={Boolean(draft && !normalizeTimeInput(draft))}
        onChange={event => { const raw = event.target.value; setDraft(raw); const normalized = normalizeTimeInput(raw); if (normalized) emit(normalized, event); }}
        onBlur={event => { setDraft(normalizeTimeInput(draft) || value); onBlur?.(event); }} />
      <button type="button" className="app-time-trigger" aria-label={`Chọn giờ: ${label}`} aria-haspopup="dialog"
        aria-expanded={!!anchor && !disabled && !readOnly} disabled={disabled || readOnly}
        onClick={event => setAnchor(event.currentTarget.closest('.app-time-field'))}><ClockIcon fontSize="small" /></button>
    </span>
    {anchor && !disabled && !readOnly && <Popover open anchorEl={anchor} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{ className: "app-time-picker", role: "dialog", "aria-label": `Chọn giờ: ${label}` }}>
      <div className="app-time-picker-heading"><strong>Chọn thời gian</strong><small>24 giờ</small></div>
      <div className="app-time-digital">
        <TimeSegment label="Giờ" value={hour} max={23} onChange={next=>choose(next,minute)} onStep={delta=>step(delta*60)} onDone={()=>setAnchor(null)}/>
        <span className="app-time-colon" aria-hidden="true">:</span>
        <TimeSegment label="Phút" value={minute} max={59} onChange={next=>choose(hour,next)} onStep={delta=>step(delta)} onDone={()=>setAnchor(null)}/>
      </div>
      <button type="button" className="app-time-done" onClick={() => setAnchor(null)}>Xong</button>
    </Popover>}
  </>;
}
