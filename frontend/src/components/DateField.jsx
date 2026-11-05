import React, { useEffect, useRef, useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import { CalendarDaysIcon } from "./AppIcons";
import DateCalendar from "./DateCalendar";
import "./dateField.css";
import { DATE_PLACEHOLDER, formatDate, parseDisplayDate } from "../utils/dateFormat";

/** Fixed day/month/year display, with ISO values for existing form handlers. */
export default function DateField({ value = "", onChange, inputProps = {}, InputProps = {},
  disabled, error, helperText, onBlur, min: minimum, max: maximum, readOnly: isReadOnly, ...props }) {
  const [draft, setDraft] = useState(() => formatDate(value, ""));
  const [calendarAnchor, setCalendarAnchor] = useState(null);
  const lastEmitted = useRef(value);
  const reference = useRef(value);
  const { min = minimum, max = maximum, readOnly = isReadOnly, ...textInputProps } = inputProps;
  const draftDate = parseDisplayDate(draft, reference.current);
  const invalid = Boolean(draft && (!draftDate || (min && draftDate < min) || (max && draftDate > max)));
  useEffect(() => {
    if (value && parseDisplayDate(value)) reference.current = value;
    if (value !== lastEmitted.current) {
      setDraft(formatDate(value, ""));
      lastEmitted.current = value;
    }
  }, [value]);
  const change = (event, fromPicker = false) => {
    const raw = event.target.value;
    const iso = parseDisplayDate(raw, reference.current);
    const valid = !raw || (iso && (!min || iso >= min) && (!max || iso <= max));
    setDraft(fromPicker && iso ? formatDate(iso, "") : raw);
    const next = valid ? iso : "";
    lastEmitted.current = next;
    if (next) reference.current = next;
    onChange?.({ ...event, target: { ...event.target, id: props.id, name: props.name, value: next } });
  };
  return <><TextField {...props} className={`app-date-field ${props.className || ""}`} type="text" value={draft} disabled={disabled}
    placeholder={DATE_PLACEHOLDER} error={Boolean(error || invalid)}
    helperText={invalid ? `Nhập ngày hợp lệ theo ${DATE_PLACEHOLDER}${min ? `, từ ${formatDate(min)}` : ""}${max ? `, đến ${formatDate(max)}` : ""}.` : helperText}
    onChange={change} onBlur={event => {
      if (!invalid) setDraft(formatDate(value, ""));
      onBlur?.(event);
    }}
    inputProps={{ ...textInputProps, readOnly, min, max, "aria-label": textInputProps["aria-label"] || props.label,
      maxLength: 10 }}
    InputProps={{ ...InputProps, readOnly: InputProps.readOnly || readOnly,
      endAdornment: <InputAdornment position="end">{InputProps.endAdornment}
          <IconButton size="small" type="button" disabled={disabled || readOnly || InputProps.readOnly}
            aria-label={`Chọn ngày${props.label ? `: ${props.label}` : ""}`} aria-haspopup="dialog" aria-expanded={!!calendarAnchor}
            onClick={event => setCalendarAnchor(event.currentTarget)}><CalendarDaysIcon fontSize="small" /></IconButton>
      </InputAdornment> }} />
    {calendarAnchor && !disabled && !readOnly && !InputProps.readOnly && <DateCalendar anchorEl={calendarAnchor}
      value={value} min={min} max={max} label={textInputProps["aria-label"] || props.label}
      onSelect={next => change({ target: { value: next } }, true)} onClose={() => setCalendarAnchor(null)} />}
  </>;
}
