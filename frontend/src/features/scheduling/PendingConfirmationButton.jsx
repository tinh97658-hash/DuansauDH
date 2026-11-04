import React from 'react';

export default function PendingConfirmationButton({ count, loading = false, error, open, controls, onClick }) {
  const state = loading ? 'Đang tải' : error ? 'Lỗi tải danh sách' : count == null ? 'Chưa tải' : count;
  return <button type="button" className="sl-pending" aria-expanded={open} aria-controls={open ? controls : undefined}
    aria-busy={loading} title={error ? 'Không tải được danh sách. Mở để xem lỗi.' : count === 0 ? 'Không có buổi chờ xác nhận trong phạm vi hiện tại.' : 'Mở danh sách chờ xác nhận trong phạm vi hiện tại.'}
    onClick={onClick}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    <span>Chờ xác nhận ({state})</span>
  </button>;
}
