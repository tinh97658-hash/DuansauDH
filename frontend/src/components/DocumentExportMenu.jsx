import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReactComponent as WordFileIcon } from "../assets/icons/filetype-docx.svg";
import { ReactComponent as ExcelFileIcon } from "../assets/icons/filetype-xlsx.svg";
import { ReactComponent as PdfFileIcon } from "../assets/icons/filetype-pdf.svg";
import "./documentExportMenu.css";

export default function DocumentExportMenu({ onWord, onExcel, onPdf, onError, showFileIcons = true, disabled = false, className = "", label = "In / Xuất" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuId = useId();
  const items = [
    { name: "Xuất Word", action: onWord, Icon: WordFileIcon, format: "word" },
    ...(onExcel ? [{ name: "Xuất Excel", action: onExcel, Icon: ExcelFileIcon, format: "excel" }] : []),
    { name: "Xuất PDF", action: onPdf, Icon: PdfFileIcon, format: "pdf" },
  ];

  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const height = menu.current.offsetHeight;
    setPosition({
      top: anchor.bottom + height + 4 <= window.innerHeight ? anchor.bottom + 4 : Math.max(4, anchor.top - height - 4),
      left: Math.max(4, Math.min(anchor.right - menu.current.offsetWidth, window.innerWidth - menu.current.offsetWidth - 4)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    const outside = (event) => { if (!root.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const select = async (action) => {
    setOpen(false);
    trigger.current?.focus();
    try {
      const result = action();
      if (result && typeof result.then === "function") { setBusy(true); await result; }
    }
    catch (error) { onError?.(error); }
    finally { setBusy(false); }
  };
  const keyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...menu.current.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (!open && event.key === "ArrowDown" && !disabled && !busy) {
      event.preventDefault(); setOpen(true);
    }
  };

  return <div className="document-export" ref={root} onKeyDown={keyDown}
    onBlur={(event) => { if (!root.current?.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={`document-export-trigger ${className}`} aria-label={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-busy={busy} disabled={disabled || busy} onClick={() => setOpen(!open)}>
      {busy ? "Đang xuất…" : "In / Xuất"} <span aria-hidden="true">▼</span>
    </button>
    {open && !disabled && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={label} className="document-export-options" style={position}>
      {items.map(({ name, action, Icon, format }) => <button key={format} type="button" role="menuitem" onClick={() => select(action)}>
        {showFileIcons && <Icon className={`document-export-icon document-export-icon-${format}`} width="20" height="20" aria-hidden="true" focusable="false" />}
        <span>{name}</span>
      </button>)}
    </div>, document.body)}
  </div>;
}
