import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdmissionPrintTemplate from "./AdmissionPrintTemplate";
import { readAdmissionPreview } from "./admissionDocumentExport";

export default function AdmissionPreview() {
  const [params] = useSearchParams();
  const [document] = useState(() => readAdmissionPreview(params.get("preview")));
  if (!document) return <main className="admission-preview"><p role="alert">Không tìm thấy dữ liệu xem trước. Vui lòng quay lại hồ sơ và chọn In / Xuất → Xuất PDF.</p></main>;
  return <main className="admission-preview">
    <nav className="admission-preview-actions" aria-label="In hồ sơ">
      <button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
    </nav>
    <section className="admission-print-page" aria-label="Mẫu hồ sơ A4"><AdmissionPrintTemplate document={document} /></section>
  </main>;
}
