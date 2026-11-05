import React from 'react';
import { Typography } from '@mui/material';
import { offeringStages as stages, stageOf } from './offeringStages';

// Display copy only: use the same authoritative stage as the offering dropdown.
const descriptions = new Map([
  [stages.teaching, 'Đang giảng dạy · Chưa mở nhập điểm'],
  [stages.components_missing, 'Đang nhập điểm thành phần'],
  [stages.eligibility_ready, 'Sẵn sàng xếp thi'],
  [stages.eligibility_pending, 'Lưu điểm để cập nhật tư cách thi'],
  [stages.awaiting_exam, 'Chờ tổ chức thi'],
  [stages.exam_missing, 'Chờ nhập điểm thi'],
  [stages.result_ready, 'Chờ gửi duyệt kết quả'],
  [stages.result_pending, 'Chờ duyệt / khóa điểm'],
  [stages.completed, 'Đã hoàn tất bảng điểm'],
  [stages.review, 'Chưa đủ thông tin · Cần rà soát'],
]);

export default function GradebookStageNotice({ offering }) {
  if (!offering) return null;
  const stage = stageOf(offering);
  return <Typography component="p" role="status" aria-label="Giai đoạn bảng điểm"
    sx={{ m: 0, fontSize: 12.5, fontWeight: 500, color: stage.tone === 'warm' ? '#A56615' : stage.tone === 'green' ? '#2E6B45' : '#435B72' }}>
    {descriptions.get(stage)}
  </Typography>;
}
