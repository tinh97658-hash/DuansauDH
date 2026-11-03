import { createReportExcel, createReportWord, createReportPdf, normalizeReport } from "../../utils/reportExport";
import { downloadDocumentFile } from "../../utils/documentFiles";

// One document per class. ZIP avoids browser blocks on multiple downloads/tabs.
export async function downloadClassProgressBatch(documents, format) {
  const writers = { word: createReportWord, excel: createReportExcel, pdf: createReportPdf };
  const extensions = { word: "docx", excel: "xlsx", pdf: "pdf" };
  if (!writers[format]) throw new Error("Định dạng xuất file không hợp lệ.");
  const reports = documents.map(document => normalizeReport(document));
  if (!reports.length || reports.some(report => report.template !== "class-progress" || report.sections.length !== 1)) {
    throw new Error("Mỗi file tiến độ phải chứa đúng một lớp.");
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const names = new Set();
  for (const report of reports) {
    let filename = `${report.filename}.${extensions[format]}`;
    for (let index = 2; names.has(filename); index++) filename = `${report.filename}-${index}.${extensions[format]}`;
    names.add(filename);
    const blob = await writers[format](report);
    zip.file(filename, await blob.arrayBuffer());
  }
  const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadDocumentFile(archive, `Theo-doi-tien-do-${reports.length}-lop.zip`);
}
