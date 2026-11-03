import React from "react";
import { SUBJECT_SIGNING_FORM as F, SUBJECT_SIGNING_LAYOUT as L, signingMetadataFields, subjectSigningDate } from "./subjectSigningExport";
import "./subjectSigningPrint.css";

export default function SubjectSigningPrint({ document }) {
  const width = F.widths.reduce((a, b) => a + b, 0);
  return <div className="subject-signing-pages"><article className="subject-signing-sheet" aria-label="Phiếu theo dõi tình hình học tập">
    <header><div>{document.university}</div><strong>{document.institute}</strong></header>
    <h1>{document.title}</h1>
    <div className="subject-signing-metadata">{signingMetadataFields(document).map((fields, i) => <div className="subject-signing-fields" key={i}
      style={{ gridTemplateColumns: L.metadataWidths[i].map(value => `${value}fr`).join(' ') }}>
      {fields.map(([label, value]) => <p key={label}><strong>{label}: </strong><span className={label === "Địa điểm" ? "subject-signing-location" : undefined}>{value}</span></p>)}
    </div>)}</div>
    <table className="document-report-table" aria-label="Theo dõi môn học">
      <colgroup>{F.widths.map((value, col) => <col key={col} style={{ width: `${value / width * 100}%` }} />)}</colgroup>
      <thead><tr><th rowSpan={2}>STT</th><th rowSpan={2}>Họ và tên học viên</th><th colSpan={12}>Theo dõi số tiết học của học viên</th><th colSpan={2}>Số tiết vắng</th><th rowSpan={2}>Kết quả xử lý</th></tr>
        <tr>{Array.from({ length: 9 }, (_, i) => <th key={i} aria-label={`Buổi ${i + 1}`} />)}
          {["Điểm KT", "Điểm ThL/TH", "Điểm TL/BTL", "Có lý do", "Không lý do"].map(label => <th key={label}>{label}</th>)}
        </tr></thead>
      <tbody>{document.rows.map((row, i) => <tr key={i}>{row.map((value, col) => <td key={col}>{value}</td>)}</tr>)}
        {["Có mặt/Tổng số", "Cán bộ phụ trách"].map(label => <tr className="subject-signing-summary" key={label}><td colSpan={2}>{label}</td>{Array.from({ length: 15 }, (_, i) => <td key={i} />)}</tr>)}
      </tbody>
    </table>
    <section className="subject-signing-signoff">
      <div className="subject-signing-notes"><p><strong className="subject-signing-note-label">Ghi chú: </strong><strong>Phần theo dõi số tiết của học viên</strong>{F.notes[0].slice("Ghi chú: Phần theo dõi số tiết của học viên".length)}</p><p>{F.notes[1]}</p></div>
      <p className="subject-signing-date">{subjectSigningDate}</p>
      <div className="subject-signing-roles">{F.signatures.map(role => <div key={role}><span>{role}</span><p>(Ký và ghi rõ họ tên)</p></div>)}</div>
    </section>
    <footer><span>NBH: {F.publishedOn}-REV:{F.revision}</span><span>{F.code}</span></footer>
  </article></div>;
}
