import React from "react";
import { scheduleDocumentMetadata, scheduleDocumentColumns, scheduleDocumentCell } from "./scheduleExport";
import "./schedulePrint.css";

export default function SchedulePrintTemplate({ schedule }) {
  const { rows } = schedule;
  const metadata = scheduleDocumentMetadata(schedule);
  const columns = scheduleDocumentColumns(schedule);
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  return <div className="sl-print-sheet">
    <header className="sl-print-header"><div>{metadata.institution.map((text, index) => index === 1 ? <strong key={text}>{text}</strong> : <span key={text}>{text}</span>)}</div><div><h1>{metadata.title}</h1><p className="sl-print-range">{metadata.range}</p></div></header>
    <p className="sl-print-notice">{metadata.notice}</p>
    <table>
      <colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.weight / totalWeight * 100}%` }} />)}</colgroup>
      <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.nowrap ? "sl-print-nowrap" : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column) =>
        <td key={column.key} className={column.center ? "sl-print-centered" : undefined}>
          {scheduleDocumentCell(row, column).map((part, index) => <div key={index} className={part.nowrap ? "sl-print-nowrap" : undefined}>{part.text}</div>)}
        </td>)}</tr>)}{!rows.length && <tr><td className="sl-print-empty" colSpan={columns.length}>Không có lịch học trong phạm vi đã chọn.</td></tr>}</tbody>
    </table>
    <p className="sl-print-total">{metadata.total}</p>
    <section className="sl-print-signoff" aria-label="Lịch trực và ký xác nhận">
      <div className="sl-print-duty">{metadata.duty.map((text) => <p key={text}>{text}</p>)}</div>
      <div className="sl-print-signatures">{metadata.signatures.map((title) => <div key={title}><b>{title}</b><i>{metadata.signaturePrompt}</i></div>)}</div>
    </section>
    <footer className="sl-print-form-footer">{metadata.footer.map((text) => <span key={text}>{text}</span>)}</footer>
  </div>;
}
