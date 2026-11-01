import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import DocumentExportMenu from "./DocumentExportMenu";
import { ReportExportContext } from "./ReportExportContext";
import { snapshotReport } from "../utils/reportSnapshot";
import { downloadReport } from "../utils/reportExport";
import { reserveReportPreview } from "../utils/reportPreview";
import "./pageExport.css";

export default function PageExportBoundary({ title, config, children }) {
  const root = useRef(null);
  const [hasMenu, setHasMenu] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const provider = useRef(null);
  const [, refresh] = useState(0);
  const registerReport = useCallback(next => {
    provider.current = next; refresh(value => value + 1);
    return () => { if (provider.current === next) { provider.current = null; refresh(value => value + 1); } };
  }, []);
  const exportFormat = useCallback(async format => {
    setError("");
    const reservedTab = format === "pdf" ? reserveReportPreview() : undefined;
    try {
      const getter = provider.current?.current?.getReport || config?.getReport;
      const report = getter ? await getter() : snapshotReport(root.current, title);
      await downloadReport(report, format, ...(reservedTab ? [{ reservedTab }] : []));
    } catch (failure) { reservedTab?.close(); throw failure; }
  }, [config, title]);
  useLayoutEffect(() => {
    const inspect = () => {
      setHasMenu(!!root.current?.querySelector('[data-document-export="true"], [data-export-managed="true"]'));
      setHasData(!!root.current?.querySelector("tbody tr td:not([colspan]), .od-card, dl, .MuiCardContent-root > ol > li, .MuiCardContent-root > ul > li"));
    };
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(root.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const disabled = provider.current?.current?.disabled || config?.disabled || (!provider.current && !config?.getReport && !hasData);
  return <ReportExportContext.Provider value={config === false ? null : { exportFormat, registerReport, disabled,
    onError: failure => setError(failure.message || "Không thể xuất file. Vui lòng thử lại.") }}>
    <div className="page-export-boundary">
      {config !== false && config?.placement !== "inline" && !hasMenu && <div className="page-export-toolbar" data-export-exclude="true"
        title={provider.current || config?.getReport ? "Xuất dữ liệu theo bộ lọc hiện tại" : "Xuất nội dung đang hiển thị trên màn hình"}>
        <DocumentExportMenu disabled={disabled}
          onWord={() => exportFormat("word")} onExcel={() => exportFormat("excel")} onPdf={() => exportFormat("pdf")}
          onError={failure => setError(failure.message || "Không thể xuất file. Vui lòng thử lại.")} />
      </div>}
      {error && <div className="page-export-error" role="alert" data-export-exclude="true">{error}<button type="button" onClick={() => setError("")}>Đóng</button></div>}
      <div ref={root} className="page-export-content">{children}</div>
    </div>
  </ReportExportContext.Provider>;
}
