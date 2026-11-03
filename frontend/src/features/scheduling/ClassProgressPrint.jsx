import React from "react";
import { TRANSCRIPT_FORM } from "../learners/transcriptForm";
import { PROGRESS_FORM_WIDTHS, progressDateLine, progressMetadataRows, progressNumberLine } from "./classProgressReport";
import "./classProgressPrint.css";

export default function ClassProgressPrint({ report }) {
  const totalWidth = PROGRESS_FORM_WIDTHS.reduce((sum, width) => sum + width, 0);
  return <main className="class-progress-print">
    <style>{"@media print { @page { size: A4 portrait; margin: 20pt 28.3pt 34pt 42.5pt; } }"}</style>
    <nav className="progress-print-actions"><button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
      <span>Xem trước nội dung; khi in, tắt đầu trang và chân trang của trình duyệt.</span></nav>
    {report.sections.map((section, index) => <article className="progress-form-sheet" key={index} aria-label={`Tiến độ lớp ${section.title}`}>
      <p className="progress-form-number">{progressNumberLine(section)}</p>
      <h1>{report.title}</h1>
      <div className="progress-form-fields">{progressMetadataRows(section).map((pair, row) => <div className="progress-form-field-row" key={row}>
        {pair.map(([label, value]) => <div key={label}><span>{label}: </span><strong>{value}</strong></div>)}
      </div>)}</div>
      <table className="document-report-table" aria-label={`Học phần và tiến độ lớp ${section.title}`}>
        <colgroup>{PROGRESS_FORM_WIDTHS.map((width, col) => <col key={col} style={{ width: `${width / totalWidth * 100}%` }} />)}</colgroup>
        <thead><tr>{section.headers.map((header, col) => <th key={col}>{header}</th>)}</tr></thead>
        <tbody>{section.rows.map((row, i) => <tr key={i}>{row.map((value, col) => <td key={col}>{value}</td>)}</tr>)}</tbody>
      </table>
      <section className="progress-form-signoff" aria-label="Ký xác nhận tiến độ">
        <div className="progress-form-summary"><p>{section.summary}</p><p className="progress-form-date">{progressDateLine(report)}</p></div>
        <div className="progress-form-signatures">{TRANSCRIPT_FORM.signatureRoles.map((roles, i) => <div key={i}>{roles.map(role => <div key={role}>{role}</div>)}</div>)}</div>
      </section>
    </article>)}
  </main>;
}
