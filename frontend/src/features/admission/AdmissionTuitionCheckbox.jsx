import { formatDateTime } from "../../utils/dateFormat";
import React, { useState } from "react";
import axios from "axios";
import { Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../../config/http";

export default function AdmissionTuitionCheckbox({ record, disabled = false, showDetails = false, onSaved, onBusyChange }) {
  const [pending, setPending] = useState(false);
  const payment = record.extraData?.tuitionPayment;
  const canUpdate = record.trainingLevel === "Thạc sĩ" && ["Đã trúng tuyển", "Đang học"].includes(record.studyStatus);
  const update = async (paid) => {
    setPending(true); onBusyChange?.(true);
    try {
      const { data } = await axios.put(`${API_BASE_URL}/plan/admission-records/${record.id}/tuition`, { paid, updatedAt: record.updatedAt }, { withCredentials: true });
      await onSaved?.({ ...record, ...data });
      toast.success(paid ? "Đã xác nhận học phí nhập học." : "Đã hủy xác nhận học phí nhập học.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật học phí nhập học. Vui lòng tải lại hồ sơ.");
    } finally { setPending(false); onBusyChange?.(false); }
  };
  const checkbox = <Checkbox size="small" checked={payment?.paid === true} disabled={disabled || pending || !canUpdate || !record.updatedAt} inputProps={{ "aria-label": `Đã nộp học phí nhập học ${record.code || record.fullName}` }} onChange={(event) => update(event.target.checked)} />;
  if (!showDetails) return checkbox;
  return <Stack spacing={0.5}>
    <FormControlLabel control={checkbox} label="Đã nộp học phí nhập học" />
    <Typography variant="caption">Trạng thái Đang học được cập nhật khi học viên được phân lớp. Bỏ tích để sửa xác nhận học phí nhầm.</Typography>
    {payment?.updatedAt && <Typography variant="caption">Cập nhật: {formatDateTime(payment.updatedAt)} · {payment.updatedBy || "—"}</Typography>}
  </Stack>;
}
