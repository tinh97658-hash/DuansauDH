import React, { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardSelect from './DashboardSelect';
import { ArrowRightIcon, ChevronDownIcon, ChevronLeftIcon, CheckCircleIcon, ChartBarIcon, ClipboardDocumentListIcon, CalendarDaysIcon, ClockIcon, UsersIcon } from '../../components/AppIcons';
import { useAuthSession } from '../../context/AuthSession';
import { useDashboardData } from './useDashboardData';
import './operationalDashboard.css';

const programs = { masters: 'Thạc sĩ', doctoral: 'Tiến sĩ' };
const currentYear = new Date().getFullYear();
export const dashboardFilters = params => ({ year: /^\d{4}$/.test(params.get('year') || '') ? params.get('year') : String(currentYear),
  program: params.get('program') === 'doctoral' ? 'doctoral' : 'masters' });
const stages = ['components_missing', 'awaiting_exam', 'exam_missing', 'result_ready'];
const stageTitles = ['Chưa hoàn thiện điểm thành phần', 'Chờ tổ chức thi', 'Thi xong, chờ nhập điểm thi', 'Đủ kết quả, chờ gửi duyệt'];
const stageDescriptions = ['Đã hoàn thành giảng dạy, chưa đủ điểm thành phần', 'Phân biệt lớp chưa có lịch thi và đã có lịch thi',
  'Theo dõi kết quả sau khi đã xác nhận thi', 'Mở bảng điểm để kiểm tra và gửi duyệt kết quả'];
const workDefinitions = [
  { key: 'grouping', tab: 'grouping', source: 'grouping', title: 'Học viên chưa phân nhóm', description: 'Học viên đủ điều kiện đang chờ phân nhóm', unit: 'học viên', Icon: UsersIcon },
  { key: 'scheduling', tab: 'teaching', source: 'teaching', title: 'Lớp học phần chưa xếp lịch', description: 'Bố trí các buổi học cho lớp học phần', unit: 'lớp học phần', Icon: CalendarDaysIcon },
  { key: 'progress', tab: 'teaching', source: 'teaching', title: 'Buổi học chờ xác nhận', description: 'Buổi học đã qua giờ kết thúc, chưa xác nhận', unit: 'buổi', Icon: ClockIcon },
  { key: 'grades', tab: 'grades', source: 'grades', title: 'Công việc liên quan đến điểm', description: 'Bốn giai đoạn nghiệp vụ, theo dõi riêng từng tầng', unit: 'lớp học phần', Icon: ClipboardDocumentListIcon },
];
const metricOf = (source, key) => key === 'scheduling' || key === 'progress' ? source?.data?.[key] : source?.data;
const gradeGroups = data => stages.map((stage, index) => data?.stages?.find(group => group.stage === stage)
  || { stage, title: stageTitles[index], count: 0, items: [] });

export function SourceState({ source, onRetry }) {
  if (source?.status === 'not_implemented') return <p className="od-muted">{source.message || 'Nghiệp vụ này chưa được triển khai.'}</p>;
  if (source?.status === 'error') return <div className="od-source-error" role="alert">Chưa tải được dữ liệu.<button type="button" onClick={onRetry}>Thử lại</button></div>;
  return <p className="od-muted" role="status">Đang tải dữ liệu…</p>;
}

function ItemList({ items = [], empty = 'Không có mục chờ xử lý.' }) {
  if (!items.length) return <p className="od-empty"><CheckCircleIcon aria-hidden="true" />{empty}</p>;
  return <ul className="od-items">{items.map(item => <li key={item.id}>
    <div className="od-item-copy"><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}
      {item.nextExamAt && <small>Lịch thi: {new Date(item.nextExamAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small>}</div>
    {item.count != null && <span className="od-count">{item.count} {item.unit || 'học viên'}</span>}
    {item.href && <Link className="od-item-action" to={item.href} aria-label={`${item.action || 'Mở chức năng'}: ${item.title}`}>
      <span>{item.action || 'Mở'}</span><ArrowRightIcon aria-hidden="true" /></Link>}
  </li>)}</ul>;
}

function WorkPanel({ permissions, sources, retry }) {
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState({});
  const definitions = workDefinitions.filter(definition => permissions[definition.key]);
  const tabs = [{ key: 'all', label: 'Tất cả' }, ...(permissions.grouping ? [{ key: 'grouping', label: 'Phân nhóm' }] : []),
    ...(permissions.scheduling || permissions.progress ? [{ key: 'teaching', label: 'Lịch học' }] : []), ...(permissions.grades ? [{ key: 'grades', label: 'Điểm' }] : [])];
  const active = tabs.some(item => item.key === tab) ? tab : 'all';
  const selectTab = key => { setTab(key); };
  const toggle = key => setExpanded(previous => ({ ...previous, [key]: !previous[key] }));
  const onTabKey = event => {
    const index = tabs.findIndex(item => event.currentTarget.id === `od-tab-${item.key}`);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); selectTab(tabs[next].key); event.currentTarget.parentElement.children[next]?.focus();
  };
  return <section className="od-panel od-work" aria-labelledby="od-work-title">
    <div className="od-panel-heading"><h2 id="od-work-title"><ClipboardDocumentListIcon aria-hidden="true" />Công việc cần xử lý</h2><span>{definitions.length} nhóm công việc</span></div>
    <div className="od-tabs" role="tablist" aria-label="Nhóm công việc">{tabs.map(item => <button type="button" key={item.key}
      id={`od-tab-${item.key}`} role="tab" aria-selected={active === item.key} aria-controls="od-work-content"
      tabIndex={active === item.key ? 0 : -1} onKeyDown={onTabKey} onClick={() => selectTab(item.key)}>{item.label}</button>)}</div>
    <div id="od-work-content" role="tabpanel" aria-labelledby={`od-tab-${active}`} tabIndex={0}>
      {definitions.filter(definition => active === 'all' || active === definition.tab).map(definition => {
        const source = sources[definition.source], metric = metricOf(source, definition.key);
        const groups = definition.key === 'grades' ? gradeGroups(metric) : null;
        const count = groups ? groups.reduce((sum, group) => sum + group.count, 0) : metric?.count;
        const items = groups ? groups.flatMap(group => group.items) : metric?.items;
        const ready = source?.status === 'ready';
        return <section className={`od-work-group ${active === 'all' ? 'od-work-summary' : 'od-work-detail'}${ready && count === 0 ? ' od-work-clear' : ''}`} data-work-kind={definition.key} key={definition.key} aria-label={definition.title}>
          {!(active === 'grades' && groups) && <div className="od-group-heading"><definition.Icon aria-hidden="true" />
            <div className="od-group-copy">
            {active === 'all' ? <button className="od-text-button" type="button" onClick={() => selectTab(definition.tab)}>{definition.title}</button>
              : <h3>{definition.title}</h3>}
            {active === 'all' && <small>{ready && count === 0 ? 'Không có mục chờ xử lý.' : definition.description}</small>}
            </div>
            {ready && <span className="od-count"><strong>{count}</strong>{' '}<span>{definition.unit}</span></span>}
          </div>}
          {!ready ? <SourceState source={source} onRetry={() => retry(definition.source)} /> : active === 'all' ? <>
            <div className="od-group-actions"><button type="button" title="Xem danh sách trong tab chi tiết" onClick={() => selectTab(definition.tab)}>Chi tiết</button>
              {!!items?.length && <button type="button" title={expanded[definition.key] ? 'Thu gọn phần xem trước' : 'Xem trước ngay tại Dashboard'} aria-expanded={!!expanded[definition.key]} aria-controls={`od-preview-${definition.key}`} onClick={() => toggle(definition.key)}>
                <span className="od-visually-hidden">{expanded[definition.key] ? 'Thu gọn' : 'Xem trước'}</span><ChevronDownIcon aria-hidden="true" /></button>}
              {metric?.href && <Link to={metric.href} title="Mở trang chức năng gốc" aria-label={`Mở chức năng: ${definition.title}`}><ArrowRightIcon aria-hidden="true" /></Link>}
            </div>
            {expanded[definition.key] && <div className="od-preview" id={`od-preview-${definition.key}`}><ItemList items={items?.slice(0, 5)} />
              {items?.length > 5 && <button type="button" onClick={() => selectTab(definition.tab)}>Xem đầy đủ trong tab chi tiết</button>}</div>}
          </> : groups ? <><p className="od-grade-intro">Theo dõi theo <strong>bốn giai đoạn nghiệp vụ</strong>. Thời gian chờ được xem riêng trong từng tầng.</p>
            <div className="od-grade-stages">{groups.map((group, index) => <section key={group.stage} aria-label={stageTitles[index]}>
            <button className="od-stage-toggle" type="button" aria-expanded={!!expanded[group.stage]} aria-controls={`od-stage-${group.stage}`} onClick={() => toggle(group.stage)}>
              <span className="od-step">{index + 1}</span><span className="od-stage-copy"><strong>{stageTitles[index]}</strong><small>{stageDescriptions[index]}</small></span><span className="od-count">{group.count} lớp học phần</span><ChevronDownIcon aria-hidden="true" /></button>
            {expanded[group.stage] && <div id={`od-stage-${group.stage}`}><ItemList items={group.items} /></div>}
          </section>)}</div></> : <ItemList items={items} />}
        </section>;
      })}
    </div>
  </section>;
}

function ApprovalPanel({ permissions, sources, retry }) {
  const [selected, setSelected] = useState(null);
  const focusHeading = useCallback(element => element?.focus(), []);
  const groups = [
    ...(permissions.approvals ? [{ key: 'results', source: 'approvals', title: 'Kết quả điểm chờ duyệt', Icon: ClipboardDocumentListIcon, metric: sources.approvals?.data?.resultApproval }] : []),
    ...(permissions.studyLeaveApproval ? [{ key: 'leaves', source: 'studyLeaveApproval', title: 'Bảo lưu / gia hạn chờ duyệt', Icon: CalendarDaysIcon, metric: sources.studyLeaveApproval?.data }] : []),
    ...(permissions.majorTransferApproval ? [{ key: 'transfers', source: 'majorTransferApproval', title: 'Chuyển chuyên ngành chờ duyệt', Icon: UsersIcon, metric: sources.majorTransferApproval?.data }] : []),
  ];
  const current = groups.find(group => group.key === selected);
  const allClear = groups.every(group => sources[group.source]?.status === 'ready' && group.metric?.count === 0);
  return <section className="od-panel od-approvals" aria-labelledby="od-approval-title">
    <div className="od-panel-heading"><h2 id="od-approval-title"><CheckCircleIcon aria-hidden="true" />Chờ phê duyệt</h2></div>
    {current ? <div className="od-approval-detail"><button className="od-back" type="button" onClick={() => setSelected(null)}><ChevronLeftIcon aria-hidden="true" />Tổng quan phê duyệt</button>
      <h3 tabIndex={-1} ref={focusHeading}>{current.title}</h3>
      {sources[current.source]?.status === 'ready' ? <ItemList items={current.metric?.items} />
        : <SourceState source={sources[current.source]} onRetry={() => retry(current.source)} />}
    </div> : <>
      {allClear && <p className="od-approval-empty"><CheckCircleIcon aria-hidden="true" />Không có yêu cầu chờ phê duyệt</p>}
      <ul className={`od-approval-groups${allClear ? ' od-approval-clear' : ''}`}>{groups.map(group => <li key={group.key} data-pending={sources[group.source]?.status === 'ready' && group.metric?.count > 0}>
      <button type="button" onClick={() => setSelected(group.key)}><span className="od-approval-icon"><group.Icon aria-hidden="true" /></span><span>{group.title}</span>
        {sources[group.source]?.status === 'ready' && <strong>{group.metric?.count ?? 0}</strong>}<ArrowRightIcon aria-hidden="true" /></button>
      {sources[group.source]?.status !== 'ready' && <SourceState source={sources[group.source]} onRetry={() => retry(group.source)} />}
    </li>)}</ul></>}
  </section>;
}

const colors = ['#4651c8', '#178e8b', '#da795b', '#98a9c1', '#c8a260', '#70827c', '#9c8fb2'];
function ChartPanel({ sources, permissions, retry }) {
  const [selected, setSelected] = useState('');
  const topics = [ ...(permissions.learnersOverview ? [{ key: 'learnersChart', label: 'Hồ sơ / học viên trong khóa' }] : []),
    ...(permissions.overview ? [{ key: 'sessionsChart', label: 'Buổi học trong tuần' }, { key: 'completionChart', label: 'Hoàn thành giảng dạy' }] : [])
  ].filter(topic => sources[topic.key]?.status !== 'not_implemented');
  const key = topics.some(topic => topic.key === selected) ? selected : topics[0]?.key;
  if (!key) return null;
  const source = sources[key], data = source?.data;
  const values = [...(data?.values || []).reduce((map, value) => map.set(value.label, (map.get(value.label) || 0) + Number(value.count)), new Map())]
    .map(([label, count]) => ({ label, count }));
  const total = values.reduce((sum, value) => sum + value.count, 0);
  let position = 0;
  const gradient = values.map((value, index) => { const start = position; position += total ? value.count / total * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${position}%`; }).join(',');
  return <section className="od-panel od-chart" aria-labelledby="od-chart-title">
    <div className="od-panel-heading"><h2 id="od-chart-title"><ChartBarIcon aria-hidden="true" />Tổng quan</h2>
      <label className="od-chart-select"><span className="od-visually-hidden">Chủ đề</span><DashboardSelect aria-label="Chủ đề tổng quan" value={key} onChange={event => setSelected(event.target.value)}>
      {topics.map(topic => <option key={topic.key} value={topic.key}>{topic.label}</option>)}</DashboardSelect></label></div>
    {source?.status !== 'ready' ? <SourceState source={source} onRetry={() => retry(key)} /> : <figure aria-label={data.title}>
      <figcaption>{data.title}</figcaption>
      {data.kind === 'bar' && values.length ? <div className="od-columns" aria-label="Số lớp hoàn thành theo tháng">{values.map(value => <div className="od-month" key={value.label}>
        <div className="od-column-track"><strong style={{ bottom: `calc(${value.count / Math.max(...values.map(item => item.count), 1) * 100}% + 7px)` }}>{value.count}</strong>
          <i aria-hidden="true" style={{ height: `${value.count / Math.max(...values.map(item => item.count), 1) * 100}%` }} /></div><span>{value.label}</span></div>)}</div>
        : !total ? <p className="od-empty">Chưa có dữ liệu trong phạm vi này.</p>
        : <div className="od-chart-body"><div className="od-donut" aria-hidden="true" style={{ background: `conic-gradient(${gradient})` }}><span><strong>{total}</strong>{data.unit}</span></div>
          <ul className="od-legend">{values.map((value, index) => <li key={value.label}><i aria-hidden="true" style={{ background: colors[index % colors.length] }} /><span>{value.label}</span><strong>{value.count}</strong></li>)}</ul></div>}
      <p className="od-chart-total">Tổng: {total} {data.unit}</p>
      {data.description && <p className="od-chart-description">{data.description}</p>}
    </figure>}
  </section>;
}

export default function OperationalDashboard() {
  const [params, setParams] = useSearchParams();
  const { year, program } = dashboardFilters(params);
  const session = useAuthSession();
  const profileKey = `${session?.user?.id || ''}:${session?.activeProfile?.id || ''}`;
  const { state, retry } = useDashboardData(year, program);
  const permissions = state.permissions || {};
  const hasWork = workDefinitions.some(definition => permissions[definition.key]);
  const hasApprovals = permissions.approvals || permissions.studyLeaveApproval || permissions.majorTransferApproval;
  const hasCharts = (permissions.overview || permissions.learnersOverview) && ['learnersChart', 'sessionsChart', 'completionChart']
    .some(key => state.sources[key] && state.sources[key].status !== 'not_implemented');
  const years = [...new Set([year, ...Array.from({ length: 7 }, (_, index) => String(currentYear - 4 + index))])].sort().reverse();
  const setFilter = (key, value) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next); };
  return <div className="operational-dashboard">
    <header className="od-header"><div><p className="od-eyebrow">TỔNG QUAN · {programs[program]} · {year}</p>
      <h1><span>Xin chào, </span><strong>{session?.activeProfile?.name || session?.user?.name || 'bạn'}</strong></h1><p>Công việc cần quan tâm trong phạm vi của bạn</p></div>
      <div className="od-filters" role="group" aria-label="Bộ lọc dashboard">
        <label>Hệ đào tạo<DashboardSelect aria-label="Hệ đào tạo" value={program} onChange={event => setFilter('program', event.target.value)}>
          {Object.entries(programs).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DashboardSelect></label>
        <label>Năm tuyển sinh<DashboardSelect aria-label="Năm tuyển sinh" value={year} onChange={event => setFilter('year', event.target.value)}>
          {years.map(value => <option key={value}>{value}</option>)}</DashboardSelect></label>
      </div>
    </header>
    {state.loading ? <div className="od-panel"><SourceState /></div> : state.error ? <div className="od-panel od-page-error" role="alert">Không thể tải tổng quan công việc.<button type="button" onClick={() => retry()}>Thử lại</button></div>
      : <div className={`od-layout${hasWork && (hasApprovals || hasCharts) ? '' : ' od-layout-single'}`} key={`${profileKey}:${year}:${program}`}>
        {hasWork && <WorkPanel permissions={permissions} sources={state.sources} retry={retry} />}
        {(hasApprovals || hasCharts) && <aside className="od-sidebar" aria-label="Phê duyệt và tổng quan">
          {hasApprovals && <ApprovalPanel permissions={permissions} sources={state.sources} retry={retry} />}
          {hasCharts && <ChartPanel permissions={permissions} sources={state.sources} retry={retry} />}
        </aside>}
        {!hasWork && !hasApprovals && !hasCharts && <section className="od-panel od-no-access">
          {Object.values(state.sources).some(source => source.status === 'not_implemented')
            ? <><h2>Nội dung tổng quan chưa được triển khai</h2><p>Chưa có nguồn tổng quan phù hợp cho hệ đào tạo đang chọn.</p></>
            : <><h2>Chưa có nội dung phù hợp với quyền hiện tại</h2><p>Hồ sơ đang chọn chưa có quyền xem hoặc xử lý các mục tổng quan này.</p></>}
        </section>}
      </div>}
  </div>;
}
