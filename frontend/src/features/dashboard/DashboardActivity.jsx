import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Popover } from '@mui/material';
import { BellIcon } from '@heroicons/react/24/outline';
import { useDashboardData } from './useDashboardData';
import { dashboardFilters, SourceState } from './OperationalDashboard';

function ActivityList({ year, program }) {
  const { state, retry } = useDashboardData(year, program, 'activity');
  const source = state.sources.activity;
  if (state.error) return <div role="alert">Chưa tải được hoạt động.<button type="button" onClick={() => retry()}>Thử lại</button></div>;
  if (state.loading || source?.status === 'error') return <SourceState source={source} onRetry={() => retry('activity')} />;
  if (!source || source.status === 'not_implemented') return <p>Chưa có nguồn thông báo phù hợp cho hồ sơ và hệ đào tạo này.</p>;
  return <>
    <p className="od-muted">Lịch sử nghiệp vụ trong phạm vi đang chọn. Việc xem thông báo không thay đổi công việc chờ xử lý.</p>
    <p className="od-muted">Chưa hỗ trợ lưu trạng thái đã đọc / chưa đọc giữa các phiên.</p>
    {source.data.partial && <p role="status">Một số nguồn hoạt động chưa tải được.</p>}
    {!source.data.items.length ? <p>Chưa có hoạt động được ghi nhận.</p> : <ul className="od-activity-list">{source.data.items.map(item => <li key={item.id}>
      <Link to={item.href}><strong>{item.title}</strong><span>{item.detail}</span><time dateTime={item.at}>{new Date(item.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></Link>
    </li>)}</ul>}
  </>;
}

export default function DashboardActivity() {
  const [anchor, setAnchor] = useState(null);
  const [params] = useSearchParams();
  const { year, program } = dashboardFilters(params);
  return <>
    <button type="button" className="od-bell" aria-label="Thông báo" aria-haspopup="dialog" aria-expanded={!!anchor}
      aria-controls={anchor ? 'od-activity' : undefined} onClick={event => setAnchor(event.currentTarget)}><BellIcon aria-hidden="true" /></button>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <section id="od-activity" className="od-activity" role="dialog" aria-label="Thông báo và hoạt động gần đây">
        <h2>Hoạt động gần đây</h2><ActivityList year={year} program={program} />
      </section>
    </Popover>
  </>;
}
