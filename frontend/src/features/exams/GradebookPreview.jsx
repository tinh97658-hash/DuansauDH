import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import GradebookPrintTemplate from "./GradebookPrintTemplate";
import { readGradebookPreview } from "./gradebookExport";
import { readSubjectSigningPreview } from "./subjectSigningExport";
import SubjectSigningPrint from "./SubjectSigningPrint";

export default function GradebookPreview() {
  const [params] = useSearchParams();
  const [document] = useState(() => readGradebookPreview(params.get("preview")) || readSubjectSigningPreview(params.get("preview")));
  if (!document) return <main><p role="alert">Không tìm thấy bản xem trước. Vui lòng quay lại bảng điểm và chọn PDF / In lại.</p></main>;
  return <main className={document.kind === "exam-list" ? "sl-schedule-preview" : "gradebook-preview"}>
    <nav className={document.kind === "exam-list" ? "sl-preview-actions" : undefined}><button type="button" onClick={() => window.print()}>In / Lưu PDF</button></nav>
    {document.kind === "subject-signing" ? <SubjectSigningPrint document={document} /> : <GradebookPrintTemplate document={document} />}
  </main>;
}
