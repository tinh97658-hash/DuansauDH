import { openDocumentPreview } from "./documentFiles";
const PREFIX = "report-preview:";
export function reserveReportPreview() {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Trình duyệt đã chặn tab xem trước. Vui lòng cho phép mở tab mới và thử lại.");
  tab.opener = null;
  return tab;
}
export function openReportPreview(report, reservedTab) {
  openDocumentPreview({ prefix: PREFIX, path: "/reports/export-preview", snapshot: report, reservedTab, fallbackToCurrentTab: false });
}
export function readReportPreview(id) {
  try {
    const report = JSON.parse(sessionStorage.getItem(`${PREFIX}${id}`));
    const scalar = value => typeof value === "string" || typeof value === "number" && Number.isFinite(value);
    return report?.version === 1 && typeof report.title === "string" && typeof report.generatedAt === "string"
      && Array.isArray(report.metadata) && report.metadata.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(scalar))
      && Array.isArray(report.sections) && report.sections.length && report.sections.every(section => typeof section.title === "string"
        && Array.isArray(section.headers) && section.headers.length && section.headers.every(scalar)
        && Array.isArray(section.rows) && section.rows.every(row => Array.isArray(row) && row.length === section.headers.length && row.every(scalar))) ? report : null;
  } catch { return null; }
}
