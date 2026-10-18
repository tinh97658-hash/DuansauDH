import React, { useState } from "react";
import { Alert } from "@mui/material";
import { api, message, Modal, Notice, offeringTitle } from "./shared";

const scheduleWarning = "Vui lòng xóa lịch học trước khi xóa lớp học phần";

export default function OfferingDeleteButton({ offering, disabled = false, className = "sl-btn sl-btn-danger", onDeleted, onScheduleDeleted }) {
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = offering.status === "completed" || (offering.sessionSummary?.heldCount || 0) > 0;
  const hasSchedule = (offering.sessionSummary?.totalCount || 0) > 0;
  const remove = async () => {
    setSaving(true); setError("");
    const removingSchedule = dialog === "schedule";
    try {
      await api.delete(`/scheduling/course-offerings/${offering.id}${removingSchedule ? "/teaching-sessions" : ""}`);
      setDialog(null);
      if (removingSchedule) onScheduleDeleted?.();
      else onDeleted?.();
    } catch (failure) {
      if (failure?.response?.data?.code === "OFFERING_HAS_SCHEDULE") setDialog("warning");
      else setError(message(failure));
    } finally { setSaving(false); }
  };
  return <>
    <button type="button" className={className} disabled={disabled || locked || saving}
      title={locked ? "Không thể xóa lớp học phần đã có buổi xác nhận diễn ra" : "Xóa lớp học phần"}
      aria-label={`Xóa lớp học phần ${offeringTitle(offering)}`}
      onClick={() => { setError(""); setDialog(hasSchedule ? "warning" : "offering"); }}>Xóa lớp</button>
    {dialog && <Modal title={dialog === "schedule" ? "Xóa lịch học" : "Xóa lớp học phần"} busy={saving}
      onClose={() => setDialog(null)} actions={<>
        <button type="button" className="sl-btn" disabled={saving} onClick={() => setDialog(null)}>Hủy</button>
        {dialog === "warning"
          ? <button type="button" className="sl-btn sl-btn-danger" onClick={() => setDialog("schedule")}>Xóa lịch học</button>
          : <button type="button" className="sl-btn sl-btn-danger" disabled={saving} onClick={remove}>
            {saving ? "Đang xóa..." : dialog === "schedule" ? "Xác nhận xóa lịch học" : "Xác nhận xóa lớp"}</button>}
      </>}>
      {dialog === "warning" ? <Alert severity="warning">{scheduleWarning}</Alert>
        : dialog === "schedule" ? <p>Xóa toàn bộ lịch học của lớp “{offeringTitle(offering)}”? Lớp học phần vẫn được giữ lại. Sau đó bạn có thể xóa lớp học phần.</p>
          : <p>Xóa lớp học phần “{offeringTitle(offering)}” và các liên kết ghép lớp của lớp này?</p>}
      {error && <Notice error={error} />}
    </Modal>}
  </>;
}
