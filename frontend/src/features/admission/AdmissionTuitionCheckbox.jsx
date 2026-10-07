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
      toast.success(paid ? "Đã xác nhận học phí nhập học. Trạng thái chuyển sang Đang học." : "Đã hủy xác nhận học phí nhập học. Trạng thái trở về Đã trúng tuyển.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật học phí nhập học. Vui lòng tải lại hồ sơ.");
    } finally { setPending(false); onBusyChange?.(false); }
  };
  const checkbox = <Checkbox size="small" checked={payment?.paid === true} disabled={disabled || pending || !canUpdate || !record.updatedAt} inputProps={{ "aria-label": `Đã nộp học phí nhập học ${record.code || record.fullName}` }} onChange={(event) => update(event.target.checked)} />;
  if (!showDetails) return checkbox;
  return <Stack spacing={0.5}>
    <FormControlLabel control={checkbox} label="Đã nộp học phí nhập học" />
    <Typography variant="caption">Tích để chuyển từ Đã trúng tuyển sang Đang học. Bỏ tích để sửa xác nhận nhầm.</Typography>
    {payment?.updatedAt && <Typography variant="caption">Cập nhật: {new Date(payment.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {payment.updatedBy || "—"}</Typography>}
  </Stack>;
}
