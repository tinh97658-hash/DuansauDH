import React from "react";
import { ArrowDownTrayIcon, ChevronDownIcon, DocumentIcon, DocumentTextIcon, TableCellsIcon } from "./AppIcons";

export function ExportDownloadIcon(props) {
  return <ArrowDownTrayIcon className="report-export-download" style={{ width: 18, height: 18 }} {...props} />;
}

export function ExcelFileIcon(props) {
  return <TableCellsIcon style={{ width: 20, height: 20 }} {...props} />;
}
export function WordFileIcon(props) {
  return <DocumentTextIcon style={{ width: 20, height: 20 }} {...props} />;
}
export function PdfFileIcon(props) {
  return <DocumentIcon style={{ width: 20, height: 20 }} {...props} />;
}

export function ExportChevronIcon() {
  return <ChevronDownIcon className="report-export-chevron" style={{ width: 14, height: 14 }} />;
}
