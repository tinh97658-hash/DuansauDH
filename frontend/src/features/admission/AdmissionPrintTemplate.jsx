import React from "react";
import "./admissionPrint.css";

function DocumentField({ field, extra = false }) {
  const singleLine = /^(Mã học viên|Email)/i.test(field.label);
  return <div className={`${extra ? "admission-sheet-extra" : "admission-sheet-field"}${singleLine ? " admission-sheet-single-line" : ""}`}>
    <strong>{field.label}</strong>{" "}
    <span style={{ fontWeight: field.bold ? 700 : undefined, textTransform: field.uppercase ? "uppercase" : undefined }}>{field.value}</span>
  </div>;
}

function InformationSection({ section }) {
  return <>
    <h2>{section.title}</h2>
    <div className="admission-sheet-fields">
      {section.fields.map((field) => <DocumentField key={field.label} field={field} />)}
    </div>
    {section.extra && <DocumentField field={section.extra} extra />}
  </>;
}

// Approved administrative layout: black on white, open columns and photo on the right.
export default function AdmissionPrintTemplate({ document }) {
  return <article className="admission-document" data-testid="admission-document">
    <div className="a4-paper-sheet admission-sheet">
    <table className="admission-sheet-masthead document-report-table"><colgroup><col style={{width:"81.5mm"}}/><col style={{width:"83.5mm"}}/></colgroup><tbody><tr>
      <td>
        {document.masthead.map((line) => <strong key={line}>{line}</strong>)}
        <div className="admission-sheet-rule" aria-hidden="true" />
        <div className="admission-sheet-code">Số HS: {document.displayCode}</div>
      </td>
      <td>
        {document.nationalHeading.map((line) => <strong key={line}>{line}</strong>)}
        <div className="admission-sheet-rule" aria-hidden="true" />
        <div className="admission-sheet-date">{document.dateLine}</div>
      </td>
    </tr></tbody></table>
    <div className="admission-sheet-title">
      <h1>{document.title}</h1>
      <div>{document.subtitle}</div>
    </div>
    <section className="admission-sheet-personal">
      <div className="admission-sheet-personal-info"><InformationSection section={document.sections[0]} /></div>
      <div className="admission-sheet-photo">
        {document.photo ? <img src={document.photo} alt="Ảnh 3x4" /> : <span>Ảnh 3 × 4</span>}
      </div>
    </section>
    <section><InformationSection section={document.sections[1]} /></section>
    <section><InformationSection section={document.sections[2]} /></section>
    <section className="admission-sheet-checklist">
      <h2>{document.checklistTitle}</h2>
      <div className="admission-sheet-checks">
        {document.documents.map((item) => <div key={item.key}>
          <span className="admission-sheet-check" aria-label={item.checked ? "Đã có" : "Chưa có"}>{item.checked ? "✓" : ""}</span>
          <span>{item.label}</span>
        </div>)}
      </div>
    </section>
    <footer className="admission-sheet-signatures">
      {document.signatures.map((signature) => <div key={signature.title}>
        <div className="admission-sheet-date">{signature.date}</div>
        <strong className="admission-sheet-signer-title">{signature.title}</strong>
        <em>{signature.instruction}</em>
        <strong className="admission-sheet-signer-name">{signature.name}</strong>
      </div>)}
    </footer>
    </div>
  </article>;
}
