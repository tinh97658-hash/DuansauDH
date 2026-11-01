import { createContext, useContext, useEffect, useRef } from "react";
export const ReportExportContext = createContext(null);

export function useReportExport(getReport, disabled = false) {
  const context = useContext(ReportExportContext);
  const provider = useRef();
  provider.current = { getReport, disabled };
  const register = context?.registerReport;
  useEffect(() => register?.(provider), [register, disabled]);
}
