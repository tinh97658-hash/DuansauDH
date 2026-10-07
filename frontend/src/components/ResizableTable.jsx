import React, { useEffect, useRef, useState } from "react";
import { Box, Table, TableCell, TableHead, TableRow } from "@mui/material";

export default function ResizableTable({ columns, storageKey, children }) {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch { return {}; }
  });
  const drag = useRef(null);
  const tableRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const widthOf = (column) => Math.max(column.minWidth || 60, Math.min(1000,
    Number.isFinite(widths[column.key]) ? widths[column.key] : column.width));
  const setWidth = (column, width) => setWidths((previous) => ({
    ...previous, [column.key]: Math.max(column.minWidth || 60, Math.min(1000, width)),
  }));
  const stopDrag = () => { drag.current = null; setPreview(null); };
  const autoFit = (column, index) => {
    const measure = document.createElement("span");
    Object.assign(measure.style, { position: "fixed", visibility: "hidden", whiteSpace: "pre", width: "max-content" });
    document.body.appendChild(measure);
    let width = column.minWidth || 60;
    try {
      for (const row of tableRef.current.rows) {
        const cell = row.cells[index];
        if (!cell || cell.colSpan !== 1) continue;
        const style = window.getComputedStyle(cell);
        measure.style.font = style.font;
        measure.textContent = cell.textContent.trim();
        const contentWidth = measure.textContent ? measure.getBoundingClientRect().width : cell.scrollWidth;
        width = Math.max(width, contentWidth + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + 16);
      }
    } finally { measure.remove(); }
    setWidth(column, Math.ceil(width));
  };

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* Storage may be disabled. */ }
  }, [storageKey, widths]);

  return <Box sx={{ position: "relative", width: "max-content" }}><Table ref={tableRef} size="small" stickyHeader sx={{
    tableLayout: "fixed", width: columns.reduce((sum, column) => sum + widthOf(column), 0),
    "& td, & th": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    "& td .MuiTypography-root": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  }}>
    <colgroup>{columns.map((column) => <col key={column.key} style={{ width: widthOf(column) }} />)}</colgroup>
    <TableHead><TableRow>
      {columns.map((column, index) => <TableCell key={column.key} align={column.align || "left"}>
        {column.header ?? column.label}
        <Box
          role="slider" aria-orientation="horizontal" tabIndex={0}
          aria-label={`Độ rộng cột ${column.label}`}
          aria-valuemin={column.minWidth || 60} aria-valuemax={1000} aria-valuenow={widthOf(column)}
          title="Kéo mép cột để đổi độ rộng; nháy đúp để vừa nội dung"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const left = columns.slice(0, index).reduce((sum, item) => sum + widthOf(item), 0);
            drag.current = { key: column.key, x: event.clientX, width: widthOf(column), pending: widthOf(column), left };
            setPreview({ left: left + widthOf(column), width: widthOf(column) });
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (drag.current?.key === column.key) {
              const pending = Math.max(column.minWidth || 60, Math.min(1000, drag.current.width + event.clientX - drag.current.x));
              drag.current.pending = pending;
              setPreview({ left: drag.current.left + pending, width: pending });
            }
          }}
          onPointerUp={() => {
            if (drag.current?.key === column.key) setWidth(column, drag.current.pending);
            stopDrag();
          }}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
          onDoubleClick={() => autoFit(column, index)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setWidth(column, widthOf(column) + (event.key === "ArrowRight" ? 10 : -10));
            }
          }}
          sx={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 9,
            cursor: "col-resize", touchAction: "none", userSelect: "none",
            "&::after": { content: '""', position: "absolute", top: 0, bottom: 0, right: 0, width: 2, bgcolor: "#0788B8", opacity: 0 },
            "&:hover::after, &:focus-visible::after": { opacity: 1 },
            "&:focus-visible": { outline: "none" },
          }}
        />
      </TableCell>)}
    </TableRow></TableHead>
    {children}
  </Table>
    {preview && <Box aria-hidden="true" sx={{
      position: "absolute", top: 0, bottom: 0, left: preview.left - 1,
      borderLeft: "1px dashed #0788B8", zIndex: 5, pointerEvents: "none",
    }}><Box sx={{
      position: "absolute", top: 2, right: 5, px: 0.75, py: 0.25,
      bgcolor: "#173E75", color: "white", borderRadius: "3px", fontSize: 11, whiteSpace: "nowrap",
    }}>{Math.round(preview.width)} px</Box></Box>}
  </Box>;
}
