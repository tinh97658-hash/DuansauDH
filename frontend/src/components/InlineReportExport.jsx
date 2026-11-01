import React, { useContext } from "react";
import DocumentExportMenu from "./DocumentExportMenu";
import { ReportExportContext } from "./ReportExportContext";

export default function InlineReportExport({ height = 40 }) {
  const context = useContext(ReportExportContext);
  if (!context) return null;
  return <div className="page-export-inline" data-export-exclude="true" style={{ "--export-control-height": `${height}px` }}>
    <DocumentExportMenu disabled={context.disabled} onWord={() => context.exportFormat("word")}
      onExcel={() => context.exportFormat("excel")} onPdf={() => context.exportFormat("pdf")}
      onError={context.onError} />
  </div>;
}
