import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { readLearnerTranscript, TRANSCRIPT_COLUMN_WIDTHS, TRANSCRIPT_TABLE_WIDTH, TRANSCRIPT_HEADERS,
  transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues } from "./learnerTranscript";
import "./learnerTranscript.css";
import { TRANSCRIPT_PAGE, LEARNER_TRANSCRIPT_LAYOUT as L } from "./transcriptForm";
import { paginateTranscriptRows } from "./transcriptPagination";

export default function LearnerTranscriptPreview() {
  const [params] = useSearchParams();
  const [document] = useState(() => readLearnerTranscript(params.get("preview")));
  const [pages, setPages] = useState(null);
  const firstSheet = useRef(null);
  const printed = useRef(false);
  useLayoutEffect(() => {
    if (!document || !firstSheet.current) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const sheet = firstSheet.current;
      const table = sheet.querySelector("table");
      const rowHeights = Array.from(table.tBodies[0].rows).map(row => row.offsetHeight);
      // Reserve the complete GPA/signature block so it cannot overlay any row.
      const tail = sheet.querySelector(".transcript-signoff").offsetHeight + 20;
      const bodyHeight = (TRANSCRIPT_PAGE.height - TRANSCRIPT_PAGE.top - TRANSCRIPT_PAGE.bottom) / 20 * 96 / 72 - 24;
      const headerHeight = table.offsetTop - sheet.offsetTop;
      const tableHeader = table.tHead.offsetHeight;
      setPages(rowHeights.some(height => height > 0) ? paginateTranscriptRows(rowHeights,
        bodyHeight - headerHeight - tableHeader - tail, bodyHeight - tableHeader - tail)
        : [document.subjects.map((_, index) => index)]);
    };
    if (window.document.fonts) window.document.fonts.ready.then(measure);
    else measure();
    return () => { active = false; };
  }, [document]);
  useEffect(() => {
    if (!document || !pages || printed.current) return;
    let secondFrame;
    const finish = () => {
      window.sessionStorage.removeItem(`learner-transcript-preview:${params.get("preview")}`);
      window.close();
    };
    window.addEventListener("afterprint", finish);
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (printed.current) return;
        printed.current = true;
        window.focus();
        window.print();
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame != null) window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("afterprint", finish);
    };
  }, [document, pages, params]);
  const pageRows = pages || [document?.subjects.map((_, index) => index) || []];
  if (!document) return <p role="alert">Không tìm thấy dữ liệu in. Vui lòng đóng cửa sổ này và thử lại.</p>;
  const details = transcriptDocumentDetails(document);
  return <main className="transcript-preview transcript-print-document">
    <style>{"@media screen { .transcript-print-document { visibility:hidden; background:#fff; } }"}</style>
    <div className="transcript-viewer-canvas">
    {pageRows.map((indices, pageIndex) => <div className="transcript-page-frame" key={pageIndex}
      style={{ width: `${TRANSCRIPT_PAGE.width / 20 * 96 / 72}px`, height: `${TRANSCRIPT_PAGE.height / 20 * 96 / 72}px` }}>
    <article className="transcript-sheet" ref={pageIndex === 0 ? firstSheet : null}
      aria-label={`Trang ${pageIndex + 1} / ${pageRows.length}`}>
      {pageIndex === 0 && <>
      <div style={{ height: `${L.topBlank}pt` }} />
      <p className="transcript-number">{details.numberLine}</p>
      <div style={{ height: `${L.numberTitleGap}pt` }} />
      <h1>{document.title}</h1>
      <div style={{ height: `${L.titleMetadataGap}pt` }} />
      <div className="transcript-fields">{transcriptMetadataRows(document).map((pair, index) => <div className="transcript-metadata-row" key={index}>
        {pair.map(field => <dl key={field.label}><dt>{field.label}:</dt><dd><strong>{field.value}</strong></dd></dl>)}
      </div>)}</div>
      </>}
      <div className="transcript-table-scroll"><table aria-label="Kết quả các học phần">
        <colgroup>{TRANSCRIPT_COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width: `${width / TRANSCRIPT_TABLE_WIDTH * 100}%` }} />)}</colgroup>
        <thead><tr>{TRANSCRIPT_HEADERS.map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{indices.map(index => document.subjects[index]).map(subject => <tr key={`${subject.subjectId || "subject"}:${subject.index}`}>{transcriptSubjectValues(subject).map((text, column) => <td key={column}>{text}</td>)}</tr>)}</tbody>
      </table></div>
      {!document.subjects.length && <p>Chưa có học phần trong chương trình đào tạo của lớp.</p>}
      {pageIndex === pageRows.length - 1 && <section className="transcript-signoff" aria-label="Ký xác nhận bảng điểm">
        <div className="transcript-summary-band">
        <p className="transcript-gpa">{details.gpa.label}: <strong>{details.gpa.value}</strong></p>
        <p className="transcript-issue-date">{details.issueDate}</p>
        </div>
        <div className="transcript-signatures">{details.signatures.map((signature, index) => <div key={index}>
          <div className="transcript-signature-roles">{signature.roles.map(role => <div key={role}>{role}</div>)}</div>
          <p className="transcript-signature-name">{signature.name || ""}</p>
        </div>)}</div>
      </section>}
      <footer className="transcript-form-footer">{details.footer.map(label => <span key={label}>{label}</span>)}</footer>
    </article>
    </div>)}
    </div>
  </main>;
}
