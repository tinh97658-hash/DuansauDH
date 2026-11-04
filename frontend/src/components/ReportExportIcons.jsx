import React from "react";

export function ExportDownloadIcon(props) {
  return <svg className="report-export-download" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />
  </svg>;
}

function FileIcon({ children, ...props }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />{children}
  </svg>;
}
export function ExcelFileIcon(props) {
  return <FileIcon {...props}><path d="M8 12h8v6H8zM8 15h8M12 12v6" /></FileIcon>;
}
export function WordFileIcon(props) {
  return <FileIcon {...props}><path d="M8 12h8M8 15h8M8 18h5" /></FileIcon>;
}
export function PdfFileIcon(props) {
  return <FileIcon {...props}><text x="6.3" y="17.5" fontFamily="Arial,sans-serif" fontSize="6" fontWeight="600" fill="currentColor" stroke="none">PDF</text></FileIcon>;
}

export function ExportChevronIcon() {
  return <svg className="report-export-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" />
  </svg>;
}
