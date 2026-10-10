import React from "react";
import { gradebookDocumentColumns } from "./gradebookLayout";
import "./gradebookPrint.css";

export default function GradebookPrintTemplate({ document }) {
  const columns = gradebookDocumentColumns(document);
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  return <article className="gradebook-document">
    <header><strong>{document.university}</strong><strong>{document.institute}</strong></header>
    <h1>{document.title}</h1>
    <p><b>Lớp:</b> {document.group}</p><p><b>Học phần:</b> {document.subject}</p>
    <table aria-label="Bảng điểm môn học">
      <colgroup>{document.headers.map((label, index) => <col key={label} style={{ width: `${columns[index].width / totalWidth * 100}%` }} />)}</colgroup>
      <thead><tr>{document.headers.map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{document.rows.map((values, index) => <tr key={index}>{values.map((value, column) => <td key={column} className={[[2, 3].includes(column) ? "name" : "", columns[column].nowrap ? "nowrap" : ""].filter(Boolean).join(" ")}>{value}</td>)}</tr>)}</tbody>
    </table>
    <footer><p className="signing-date">{document.signingDate}</p>
      <div className="signature-roles"><div><b>VIỆN TRƯỞNG</b></div><div><b>PHỤ TRÁCH LỚP</b></div></div>
    </footer>
  </article>;
}
