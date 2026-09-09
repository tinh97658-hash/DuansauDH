import React, { useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import { Dialog } from "@mui/material";
import { API_BASE_URL } from "../../config/http";

export const api = {
  get: async (path) => (await axios.get(`${API_BASE_URL}${path}`, { withCredentials: true })).data,
  post: async (path, body) => (await axios.post(`${API_BASE_URL}${path}`, body, { withCredentials: true })).data,
  put: async (path, body) => (await axios.put(`${API_BASE_URL}${path}`, body, { withCredentials: true })).data,
  delete: async (path) => (await axios.delete(`${API_BASE_URL}${path}`, { withCredentials: true })).data,
};
export const message = (error) => {
  const value = error?.response?.data?.message || error?.message || "Không thể tải dữ liệu. Vui lòng thử lại.";
  return Array.isArray(value) ? value.join(" · ") : value;
};
export const rows = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  throw new Error("Dữ liệu trả về không hợp lệ.");
};
export const unique = (items) => [...new Set(items.filter(Boolean))];
export const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
export const groupsOf = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
export const labelOf = (offering) => groupsOf(offering).map((group) => group.code).join(" · ");
export const offeringTitle = (offering) => {
  const groups = groupsOf(offering);
  if (!groups.length) return offering?.subject?.name || "Lớp học phần";
  const title = groups[0].name || groups[0].code;
  return groups.length > 1 ? `${title} + ${groups.length - 1} lớp` : title;
};
export const subjectLabel = (offering) => [offering?.subject?.code, offering?.subject?.name].filter(Boolean).join(" - ");
export const daysLabel = (days) => days?.length ? days.map((day) => day === 0 ? "CN" : `T${day + 1}`).join(", ") : "Chưa cấu hình";
export const intersectDays = (groups) => groups.length ? [1, 2, 3, 4, 5, 6, 0].filter((day) => groups.every((group) => (group.allowedWeekdays || [1, 2, 3, 4, 5, 6, 0]).includes(day))) : [];

// Ignore late responses when scope changes or the component unmounts.
export function useLoad(loader, dependencies) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: "" });
    Promise.resolve().then(loader).then((data) => { if (active) setState({ data, loading: false, error: "" }); })
      .catch((error) => { if (active) setState({ data: null, loading: false, error: message(error) }); });
    return () => { active = false; };
    // Callers supply the values used by their loader, as with useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}

export function Notice({ error, children }) {
  return <div className={error ? "v20-error" : "sl-empty"} role={error ? "alert" : "status"}>{error || children}</div>;
}
export function Modal({ title, children, onClose, busy = false, wide = false, drawer = false, actions, className = "", hideHeader = false, bodyClassName = "", transparentBackdrop = false }) {
  const titleId = useId();
  return <Dialog open hideBackdrop={transparentBackdrop} onClose={busy ? undefined : onClose} maxWidth={false} aria-labelledby={titleId}
    PaperProps={{ className: `scheduling-v20 v20-dialog ${wide ? "v20-wide" : ""} ${drawer ? "v20-drawer" : ""} ${className}` }}>
    {hideHeader ? <h2 id={titleId} className="sl-sr-only">{title}</h2> : <header className="v20-dialog-head"><h2 id={titleId}>{title}</h2><button className="sl-btn" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></header>}
    <div className={`v20-dialog-body ${bodyClassName}`}>{children}</div>
    {actions && <footer className="v20-dialog-foot">{actions}</footer>}
  </Dialog>;
}
export function SearchSelect({ label, value, options, onChange, placeholder = "Chọn...", disabled = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <div ref={wrapper} className="sl-combo" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <input aria-label={label} role="combobox" aria-expanded={open} aria-controls={`options-${label}`} autoComplete="off" disabled={disabled}
      value={open ? query : options.find((item) => item.id === value)?.name || ""} placeholder={placeholder}
      onFocus={() => { setQuery(""); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} />
    <button aria-label={`Mở ${label}`} disabled={disabled} onClick={() => { setQuery(""); setOpen(!open); }}>▾</button>
    {open && <div className="sl-combo-list sl-show" id={`options-${label}`} role="listbox" aria-label={label}>
      {options.filter((item) => normalize(item.name + " " + (item.code || "")).includes(normalize(query))).map((item) => <button key={item.id} role="option" aria-selected={item.id === value} onClick={() => { onChange(item.id); setOpen(false); }}>{item.name}<small>{item.code}</small></button>)}
    </div>}
  </div>;
}
