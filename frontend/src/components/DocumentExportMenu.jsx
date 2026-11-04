import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ReportExportContext } from "./ReportExportContext";
import { createPortal } from "react-dom";
import "./documentExportMenu.css";
import { notify } from "../utils/notify";
import { ExportDownloadIcon, ExportChevronIcon, WordFileIcon, ExcelFileIcon, PdfFileIcon } from "./ReportExportIcons";
import { dropdownMenuGeometry } from "../utils/dropdownGeometry";

export default function DocumentExportMenu({ onWord, onExcel, onPdf, onError, formats, disabledFormats = [], showFileIcons = true, disabled = false, className = "", label = "Xuất báo cáo", title, wordLabel = "Word (.docx)", excelLabel = "Excel (.xlsx)", pdfLabel = "PDF (.pdf)" }) {
  const reportExport = useContext(ReportExportContext);
  const allowedFormats = formats || reportExport?.formats || ["word", "excel", "pdf"];
  onWord ||= reportExport ? () => reportExport.exportFormat("word") : undefined;
  onExcel ||= reportExport ? () => reportExport.exportFormat("excel") : undefined;
  onPdf ||= reportExport ? () => reportExport.exportFormat("pdf") : undefined;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuId = useId();
  const items = [
    ...(onExcel ? [{ name: excelLabel, action: onExcel, Icon: ExcelFileIcon, format: "excel" }] : []),
    ...(onWord ? [{ name: wordLabel, action: onWord, Icon: WordFileIcon, format: "word" }] : []),
    ...(onPdf ? [{ name: pdfLabel, action: onPdf, Icon: PdfFileIcon, format: "pdf" }] : []),
  ].filter(item => allowedFormats.includes(item.format));

  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    let frame;
    const measure = () => {
      if (!trigger.current || !menu.current) return;
      const geometry = dropdownMenuGeometry(trigger.current, {
        allowFlip: true, menuHeight: menu.current.scrollHeight + 2,
      });
      if (geometry) setPosition(previous => Object.keys(geometry).every(key => previous[key] === geometry[key]) ? previous : geometry);
      // Track layout shifts as well as window scrolling/resizing while this portal is open.
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
    const outside = (event) => { if (!root.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  const select = async (action) => {
    setOpen(false);
    trigger.current?.focus();
    try {
      const result = action();
      if (result && typeof result.then === "function") { setBusy(true); await result; }
    }
    catch (error) { if (onError) onError(error); else notify.error(error.message || "Không thể xuất file."); }
    finally { setBusy(false); }
  };
  const keyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (!open && event.key === "ArrowDown" && !disabled && !busy) {
      event.preventDefault(); setOpen(true);
    }
  };

  return <div className="document-export" data-document-export="true" ref={root} onKeyDown={keyDown}
    onBlur={(event) => { if (!root.current?.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={`document-export-trigger ${className}`} aria-label={title || label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      title={title} aria-busy={busy} disabled={disabled || busy} onClick={() => setOpen(!open)}>
      <ExportDownloadIcon /><span>{busy ? "Đang xuất…" : label}</span><ExportChevronIcon />
    </button>
    {open && !disabled && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={label} className="document-export-options" style={position}>
      {items.map(({ name, action, Icon, format }) => <button key={format} type="button" role="menuitem" aria-label={name} data-standard-format={['Excel (.xlsx)', 'Word (.docx)', 'PDF (.pdf)'].includes(name) || undefined} title={format === 'pdf' ? 'In / Lưu PDF' : name} disabled={disabledFormats.includes(format)} aria-disabled={disabledFormats.includes(format) || undefined} onClick={() => select(action)}>
        {showFileIcons && <Icon className={`document-export-icon document-export-icon-${format}`} width="20" height="20" aria-hidden="true" focusable="false" />}
        <span>{name}</span>
      </button>)}
    </div>, document.body)}
  </div>;
}
