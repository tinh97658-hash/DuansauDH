import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import GradebookPrintTemplate from "./GradebookPrintTemplate";
import { readGradebookPreview } from "./gradebookExport";

export default function GradebookPreview() {
  const [params] = useSearchParams();
  const [document] = useState(() => readGradebookPreview(params.get("preview")));
  if (!document) return <main><p role="alert">Không tìm thấy bản xem trước. Vui lòng quay lại bảng điểm và chọn PDF / In lại.</p></main>;
  return <main className={document.kind === "exam-list" ? "sl-schedule-preview" : "gradebook-preview"}>
    <nav className={document.kind === "exam-list" ? "sl-preview-actions" : undefined}><button type="button" onClick={() => window.print()}>In / Lưu PDF</button></nav>
    <GradebookPrintTemplate document={document} />
  </main>;
}
