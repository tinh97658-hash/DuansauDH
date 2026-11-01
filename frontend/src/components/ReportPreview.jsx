import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { readReportPreview } from "../utils/reportPreview";
import { reportOrientation, reportPrintSections } from "../utils/reportExport";
import { DOCUMENT_INSTITUTION, DOCUMENT_NATIONAL_HEADING, documentDateLine } from "../utils/documentHeading";
import "./reportPreview.css";
import { isReportSerialColumn, isReportYearColumn, reportCompactColumn, reportCompactWidth } from "../utils/reportTableLayout";

const isCourseName = header => /^(Tên môn học|Tên học phần|Chương trình đào tạo|Tên CTĐT)$/iu.test(String(header).trim());
const isCourseCatalog = section => section.headers.some(isCourseName)
  && section.headers.some(header => /^(Mã số|Mã chữ|Mã HP|TC|Tín chỉ|Số TC)$/iu.test(String(header).trim()));
const isAdmissionTable = section => section.headers.includes("Ngày sinh") && section.headers.includes("Họ đệm")
  && section.headers.some(header => /^(Mã HV|Mã học viên)$/iu.test(String(header).trim()));
const isAdmissionCompact = (section, header) => isAdmissionTable(section)
  && /^(STT|Mã HV|Mã học viên|Ngày sinh|Giới tính)$/iu.test(String(header).trim());
const isScoreTable = section => section.headers.includes("Mã hồ sơ")
  && section.headers.some(header => /^Tổng điểm/iu.test(String(header).trim()));
const isScoreCompact = (section, header) => isScoreTable(section)
  && /^(STT|Mã hồ sơ|Họ tên|Họ và tên|Năm sinh|Giới tính|Tổng điểm.*|Điểm ngưỡng.*)$/iu.test(String(header).trim());
const cellClass = (section, header) => [
  isReportSerialColumn(header) ? "report-serial-cell" : isReportYearColumn(header) ? "report-year-cell" : "",
  isCourseCatalog(section) ? isCourseName(header) ? "report-course-name" : "report-course-compact" : "",
  isAdmissionCompact(section, header) ? "report-admission-compact" : "",
  isScoreCompact(section, header) ? "report-score-compact" : "",
].filter(Boolean).join(" ") || undefined;

export default function ReportPreview() {
  const [params] = useSearchParams();
  const [report] = useState(() => readReportPreview(params.get("preview")));
  if (!report) return <main><p role="alert">Không tìm thấy dữ liệu xem trước. Vui lòng quay lại và chọn Xuất PDF lần nữa.</p></main>;
  const sections = reportPrintSections(report), landscape = reportOrientation(report) === "landscape";
  return <main className={`report-preview${landscape ? " report-landscape" : ""}`}>
    <style>{`@media print { @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; } }`}</style>
    <nav className="report-preview-actions"><button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
      <span>Xem trước nội dung; khi in, tắt đầu trang và chân trang của trình duyệt.</span></nav>
    <article className="report-print-sheet">
      <header className="report-document-heading"><div>{DOCUMENT_INSTITUTION.map((line, index) => <div key={line} className={index === 1 ? "report-underlined" : ""}>{line}</div>)}</div>
        <div>{DOCUMENT_NATIONAL_HEADING.map((line, index) => <div key={line} className={index === 1 ? "report-underlined" : ""}>{line}</div>)}<p>{documentDateLine(report)}</p></div></header>
      <h1>{report.title}</h1>
      {report.metadata.map(([label, value], index) => <p className="report-metadata" key={index}><strong>{label}:</strong> {value}</p>)}
      {sections.map((section, index) => <section className="report-print-section" key={index}>
        {section.title?.trim().toLocaleLowerCase("vi-VN") !== report.title.trim().toLocaleLowerCase("vi-VN") && <h2>{section.title}</h2>}
        <table className={`document-report-table${isCourseCatalog(section) ? " report-course-table" : ""}${isAdmissionTable(section) ? " report-admission-table" : ""}${isScoreTable(section) ? " report-score-table" : ""}`}>
          <colgroup>{section.headers.map((header, index) => <col key={index} style={isAdmissionCompact(section, header) || isScoreCompact(section, header) ? { width: "1%" } : isCourseCatalog(section)
            ? isCourseName(header) ? undefined : { width: "1%" }
            : reportCompactColumn(header) ? { width: `${reportCompactWidth(section, index)}pt` } : undefined} />)}</colgroup>
          <thead><tr>{section.headers.map((header, index) => <th key={index} className={cellClass(section, header)}>{header}</th>)}</tr></thead>
          <tbody>{section.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className={cellClass(section, section.headers[column])}>{value}</td>)}</tr>)}</tbody></table>
      </section>)}
    </article>
  </main>;
}
