import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SchedulePrintTemplate from "./SchedulePrintTemplate";
import { readSchedulePreview } from "./scheduleExport";

export default function SchedulePreview() {
  const [params] = useSearchParams();
  const [schedule] = useState(() => readSchedulePreview(params.get("preview")));
  if (!schedule) return <main className="sl-schedule-preview"><p role="alert">Không tìm thấy dữ liệu xem trước. Vui lòng quay lại màn hình Xếp lịch và chọn In / Xuất → Xuất PDF.</p></main>;
  return <main className="sl-schedule-preview">
    <nav className="sl-preview-actions" aria-label="Xuất lịch học">
      <button type="button" onClick={() => window.print()}>In / Lưu PDF</button>
    </nav>
    <section className="sl-print-only" aria-label="Mẫu lịch học"><SchedulePrintTemplate schedule={schedule} /></section>
  </main>;
}
