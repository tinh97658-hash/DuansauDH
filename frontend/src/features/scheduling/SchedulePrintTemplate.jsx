import React from "react";
import { scheduleDocumentMetadata, scheduleDocumentColumns, scheduleDocumentCell } from "./scheduleExport";
import "./schedulePrint.css";

export default function SchedulePrintTemplate({ schedule }) {
  const { rows } = schedule;
  const metadata = scheduleDocumentMetadata(schedule);
  const columns = scheduleDocumentColumns(schedule);
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  return <div className="sl-print-sheet">
    <header className="sl-print-header"><div>{metadata.institution.map((text, index) => index === 1 ? <strong key={text}>{text}</strong> : <span key={text}>{text}</span>)}</div><div>{metadata.nationalHeading.map((text, index) => index === 0 ? <strong key={text}>{text}</strong> : <b key={text}>{text}</b>)}</div></header>
    <h1>{metadata.title}</h1>
    <p className="sl-print-range">{metadata.range}</p>
    <div className="sl-print-scope">{metadata.scope.map(({ label, value }) => <span key={label}><b>{label}:</b> {value}</span>)}</div>
    <table>
      <colgroup>{columns.map((column) => <col key={column.key} style={{ width: `${column.weight / totalWeight * 100}%` }} />)}</colgroup>
      <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.nowrap ? "sl-print-nowrap" : undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column) =>
        <td key={column.key} className={column.nowrap ? "sl-print-centered" : undefined}>
          {scheduleDocumentCell(row, column).map((part, index) => <div key={index} className={part.nowrap ? "sl-print-nowrap" : undefined}>{part.text}</div>)}
        </td>)}</tr>)}{!rows.length && <tr><td className="sl-print-empty" colSpan={columns.length}>Không có lịch học trong phạm vi đã chọn.</td></tr>}</tbody>
    </table>
    <footer>{metadata.total}</footer>
  </div>;
}
