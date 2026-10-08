import React, { useRef, useState } from "react";
import "./resizableSplit.css";

export default function ResizableSplit({ left, right }) {
  const root = useRef(null);
  const pointerActive = useRef(false);
  const [ratio, setRatio] = useState(55);
  const [dragging, setDragging] = useState(false);
  const clamp = (value) => {
    const width = root.current?.getBoundingClientRect().width || 1000;
    const minimum = Math.min(45, 300 / width * 100);
    return Math.max(minimum, Math.min(100 - minimum, value));
  };
  const move = (event) => {
    const rect = root.current.getBoundingClientRect();
    if (rect.width) setRatio(clamp((event.clientX - rect.left) / rect.width * 100));
  };
  return <div ref={root} className={`resizable-split ${dragging ? "is-dragging" : ""}`} style={{ "--split-left": `${ratio}fr`, "--split-right": `${100 - ratio}fr` }}>
    <section className="resizable-split-panel" aria-label="Học viên chưa phân lớp">{left}</section>
    {/* Focusable separators expose their current position; the project's older aria-query omits this property. */}
    {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
    <div className="resizable-split-divider" role="separator" tabIndex={0} aria-label="Điều chỉnh độ rộng hai bảng"
      aria-orientation="vertical" aria-valuemin={Math.round(clamp(0))} aria-valuemax={Math.round(clamp(100))} aria-valuenow={Math.round(ratio)}
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); pointerActive.current = true; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); move(event); }}
      onPointerMove={(event) => { if (pointerActive.current) move(event); }}
      onPointerUp={(event) => { if (pointerActive.current) { pointerActive.current = false; event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); } }}
      onPointerCancel={() => { pointerActive.current = false; setDragging(false); }}
      onLostPointerCapture={() => { pointerActive.current = false; setDragging(false); }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); setRatio((value) => clamp(event.key === "Home" ? 0 : event.key === "End" ? 100 : value + (event.key === "ArrowRight" ? 2 : -2)));
      }} />
    <section className="resizable-split-panel" aria-label="Lớp mục tiêu">{right}</section>
  </div>;
}
