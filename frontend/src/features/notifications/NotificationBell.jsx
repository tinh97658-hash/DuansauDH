import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover } from '@mui/material';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import { CalendarDaysIcon, ClipboardDocumentListIcon, UsersIcon } from '../../components/AppIcons';
import { useConfirmGradeLeave, useDiscardUnsavedGrades } from '../../components/UnsavedChangesGuard';
import { useNotificationInbox } from './useNotificationInbox';
import './notifications.css';

export const safeNotificationHref = href => typeof href === 'string' && (/^\/masters\/study-leaves$/i.test(href)
  || /^\/(?:masters\/exam-lists\?|plan\/admission-records\/[0-9a-f-]+\?)/i.test(href));
export default function NotificationBell() {
  const inbox = useNotificationInbox(), navigate = useNavigate(), confirmLeave = useConfirmGradeLeave();
  const discardUnsaved = useDiscardUnsavedGrades();
  const [anchor, setAnchor] = useState(null), [linkError, setLinkError] = useState('');
  useEffect(() => { setAnchor(null); setLinkError(''); }, [inbox.identity]);
  const open = event => { setAnchor(event.currentTarget); setLinkError(''); void inbox.refresh(1); };
  const openItem = async item => {
    if (!await confirmLeave()) return;
    const response = await inbox.read(item.id);
    if (!response) return;
    if (!safeNotificationHref(response.item?.href)) { setLinkError('Không mở được bản ghi từ thông báo này.'); return; }
    discardUnsaved();
    setAnchor(null); navigate(response.item.href);
  };
  const count = inbox.unreadCount;
  return <>
    <button type="button" className="notification-bell" aria-label="Thông báo" aria-haspopup="dialog" aria-expanded={!!anchor}
      aria-controls={anchor ? 'notification-inbox' : undefined} onClick={open} title={count == null ? 'Thông báo' : `${count} thông báo chưa đọc`}>
      <BellAlertIcon aria-hidden="true" />{count > 0 && <span className="notification-badge" aria-label={`${count} thông báo chưa đọc`}>{count > 9 ? '9+' : count}</span>}
    </button>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { className: 'notification-paper' } }}>
      <section id="notification-inbox" className="notification-inbox" role="dialog" aria-label="Thông báo">
        <div className="notification-heading"><h2>Thông báo</h2>{count != null && <span>{count} chưa đọc</span>}
          <button type="button" disabled={inbox.busy || !count} onClick={() => { void inbox.readAll(); }}>Đánh dấu tất cả đã đọc</button></div>
        {(inbox.actionError || linkError) && <p className="notification-error" role="alert">{inbox.actionError || linkError}</p>}
        {!inbox.enabled ? <p className="notification-state">Chọn hồ sơ làm việc để xem thông báo.</p>
          : inbox.status === 'loading' || inbox.status === 'idle' ? <p className="notification-state" role="status">Đang tải thông báo…</p>
          : inbox.status === 'error' ? <div className="notification-state notification-error" role="alert">{inbox.error}<button type="button" onClick={() => { void inbox.refresh(inbox.page); }}>Thử lại</button></div>
          : !inbox.total ? <p className="notification-state">Bạn chưa có thông báo.</p> : <>
            {count === 0 && <p className="notification-read-clear">Không có thông báo chưa đọc.</p>}
            <ul className="notification-list">{inbox.items.map(item => {
              const Icon = item.type.startsWith('grade.') ? ClipboardDocumentListIcon : item.type.startsWith('transfer.') ? UsersIcon : CalendarDaysIcon;
              return <li key={item.id} data-unread={!item.readAt}><button type="button" disabled={inbox.busy} onClick={() => { void openItem(item); }}>
                <Icon aria-hidden="true" /><span className="notification-copy"><strong>{item.title}</strong><span title={item.body}>{item.body}</span>
                  <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></span>
                {!item.readAt && <span className="notification-unread-dot" aria-label="Chưa đọc" />}</button></li>;
            })}</ul>
            {inbox.total > 6 && <nav className="notification-pages" aria-label="Trang thông báo">
              <button type="button" disabled={inbox.page === 1 || inbox.busy} onClick={() => { void inbox.refresh(inbox.page - 1); }}>Trước</button>
              <span>{inbox.page}/{Math.ceil(inbox.total / 6)}</span><button type="button" disabled={inbox.page * 6 >= inbox.total || inbox.busy} onClick={() => { void inbox.refresh(inbox.page + 1); }}>Tiếp</button>
            </nav>}
          </>}
      </section>
    </Popover>
  </>;
}
