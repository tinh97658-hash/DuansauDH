import React, { useLayoutEffect, useRef, useState } from "react";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

// Share the menu across staff roles rather than using the browser's native blue highlight.
export default function YearSelect({ label, value, years, onChange, placeholder = "Tất cả", disabled = false, className = "", menuClassName = "", role = "combobox" }) {
  const root = useRef(null);
  const menuAction = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState();
  useLayoutEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open || disabled) return undefined;
    const measure = () => setMenuWidth(root.current?.getBoundingClientRect().width || undefined);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (root.current) observer?.observe(root.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [open, disabled]);
  useLayoutEffect(() => { if (open) menuAction.current?.updatePosition(); }, [open, menuWidth]);
  return <Select ref={root} className={className} variant="standard" disableUnderline displayEmpty
    open={open && !disabled} onClose={() => setOpen(false)}
    onOpen={() => { setMenuWidth(root.current?.getBoundingClientRect().width || undefined); setOpen(true); }}
    SelectDisplayProps={{ "aria-label": label, role }}
    value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
    sx={{ "& .MuiSelect-select": { display: "flex", alignItems: "center", boxSizing: "border-box", height: "100%", minHeight: 0, padding: 0, background: "transparent" },
      "&.Mui-focused": { borderColor: "var(--primary)", boxShadow: "0 0 0 1px var(--primary)" } }}
    MenuProps={{ action: menuAction, anchorEl: () => root.current, anchorOrigin: {vertical: "bottom", horizontal: "left"}, transformOrigin: {vertical: "top", horizontal: "left"},
      PaperProps: { className: menuClassName, style: { width: menuWidth, minWidth: menuWidth, maxWidth: menuWidth }, sx: { borderRadius: 0, border: "1px solid var(--dropdown-border, #b9cad8)" } } }}>
    <MenuItem value="">{placeholder}</MenuItem>
    {years.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
  </Select>;
}
