import React from 'react';
import { ClockIcon } from '../../components/AppIcons';

export default function PendingConfirmationButton({ count, loading = false, error, open, controls, onClick, showIcon = true }) {
  const state = loading && count == null ? 'Đang tải' : error ? 'Lỗi tải danh sách' : count == null ? 'Chưa tải' : count;
  return <button type="button" className="sl-pending" aria-expanded={open} aria-controls={open ? controls : undefined}
    aria-busy={loading} title={error ? 'Không tải được danh sách. Mở để xem lỗi.' : count === 0 ? 'Không có buổi chờ xác nhận trong phạm vi hiện tại.' : 'Mở danh sách chờ xác nhận trong phạm vi hiện tại.'}
    onClick={onClick}>
    {showIcon && <ClockIcon style={{ width: 16, height: 16 }} />}
    <span>Chờ xác nhận ({state})</span>
  </button>;
}
