import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardSelect from './DashboardSelect';
import DashboardColumns from './DashboardColumns';
import AdaptiveTaskList from './AdaptiveTaskList';
import { ArrowRightIcon, ChevronLeftIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClipboardDocumentCheckIcon, ChartBarIcon, CalendarDaysIcon, ClockIcon, UsersIcon } from '../../components/AppIcons';
import { useAuthSession } from '../../context/AuthSession';
import { useDashboardData } from './useDashboardData';
import './operationalDashboard.css';

const programs = { masters: 'Thạc sĩ', doctoral: 'Tiến sĩ' };
const doctoralEmptyMessage = 'Chưa được phân công hoặc chưa có dữ liệu cho hệ Tiến sĩ.';
const doctoralEmptySources = Object.fromEntries(['grouping', 'teaching', 'grades', 'approvals', 'studyLeaveApproval',
  'majorTransferApproval', 'learnersChart', 'sessionsChart', 'completionChart'].map(key => [key, { status: 'empty', message: doctoralEmptyMessage }]));
const currentYear = new Date().getFullYear();
export const dashboardFilters = params => ({ year: /^\d{4}$/.test(params.get('year') || '')
  && Number(params.get('year')) >= currentYear - 2 && Number(params.get('year')) <= currentYear + 2 ? params.get('year') : String(currentYear),
  program: params.get('program') === 'doctoral' ? 'doctoral' : 'masters' });
const stages = ['components_missing', 'awaiting_exam', 'exam_missing', 'result_ready'];
const stageTitles = ['Chưa hoàn thiện điểm thành phần', 'Chờ tổ chức thi', 'Thi xong, chờ nhập điểm thi', 'Đủ kết quả, chờ gửi duyệt'];
const workDefinitions = [
  { key: 'grouping', tab: 'grouping', source: 'grouping', title: 'Học viên chưa phân nhóm', description: 'Học viên đủ điều kiện đang chờ phân nhóm', unit: 'học viên', Icon: UsersIcon },
  { key: 'scheduling', tab: 'teaching', source: 'teaching', title: 'Lớp học phần chưa xếp lịch', description: 'Bố trí các buổi học cho lớp học phần', unit: 'lớp học phần', Icon: CalendarDaysIcon },
  { key: 'progress', tab: 'teaching', source: 'teaching', title: 'Buổi học chờ xác nhận', description: 'Buổi học đã qua giờ kết thúc, chưa xác nhận', unit: 'buổi', Icon: ClockIcon },
  { key: 'grades', tab: 'grades', source: 'grades', title: 'Công việc liên quan đến điểm', description: 'Bốn giai đoạn nghiệp vụ, theo dõi riêng từng tầng', unit: 'lớp học phần', Icon: ClipboardDocumentListIcon },
];
const metricOf = (source, key) => key === 'scheduling' || key === 'progress' ? source?.data?.[key] : source?.data;
const gradeGroups = data => stages.map((stage, index) => data?.stages?.find(group => group.stage === stage)
  || { stage, title: stageTitles[index], count: 0, items: [] });
const metricCount = (metric, key) => key === 'grades'
  ? gradeGroups(metric).reduce((sum, group) => sum + group.count, 0) : metric?.count;
const summaryLabels = { grouping: 'Chờ phân nhóm', scheduling: 'Chưa xếp lịch', progress: 'Chờ xác nhận buổi học', grades: 'Theo dõi điểm' };

const workDestination = (definition, metric, year) => {
  if (definition.key === 'grades') return `/masters/exam-lists?${new URLSearchParams({ year })}`;
  if (metric?.href) return metric.href;
  if (definition.key === 'grouping') return `/masters/assign-class-groups?${new URLSearchParams({ year })}`;
  return `/masters/schedule?${new URLSearchParams({ year, queue: definition.key === 'progress' ? 'pending-confirmation' : 'unscheduled' })}`;
};

function SummaryCards({ permissions, sources, year }) {
  const definitions = workDefinitions.filter(definition => permissions[definition.key]);
  if (!definitions.length) return null;
  return <section className="od-summary" aria-label="Chỉ số công việc" style={{ '--od-summary-columns': definitions.length }}>
    {definitions.map(definition => {
      const source = sources[definition.source];
      const ready = source?.status === 'ready';
      const metric = metricOf(source, definition.key);
      const count = metricCount(metric, definition.key);
      const href = ready ? workDestination(definition, metric, year) : null;
      const Card = href ? Link : 'div';
      const status = ready ? count === 0 ? 'Đã xử lý hết' : 'Cần xử lý' : source?.status === 'empty' ? 'Chưa có dữ liệu' : source?.status === 'error' ? 'Chưa tải được' : source?.status === 'not_implemented' ? 'Chưa triển khai' : 'Đang tải';
      return <article className="od-stat" key={definition.key} data-kind={definition.key}>
        <Card className="od-stat-link" {...(href ? { to: href, 'aria-label': `Xem công việc: ${summaryLabels[definition.key]}` } : { 'aria-disabled': true })}>
        <div className="od-stat-body"><h2>{summaryLabels[definition.key]}</h2>
          <div className="od-stat-value"><strong>{ready ? count.toLocaleString('vi-VN') : '—'}</strong>
            <span className="od-stat-icon"><definition.Icon aria-hidden="true" /></span></div>
          <span className="od-stat-unit">{definition.unit}</span>
        </div>
        <span className="od-stat-footer">
          <span className={`od-stat-status${ready && count === 0 ? ' od-stat-done' : ''}`}><span aria-hidden="true" />{status}</span>
          <ArrowRightIcon aria-hidden="true" />
        </span>
        </Card>
      </article>;
    })}
  </section>;
}

export function SourceState({ source, onRetry }) {
  if (source?.status === 'empty') return <p className="od-empty" role="status">{source.message}</p>;
  if (source?.status === 'not_implemented') return <p className="od-muted">{source.message || 'Nghiệp vụ này chưa được triển khai.'}</p>;
  if (source?.status === 'error') return <div className="od-source-error" role="alert">Chưa tải được dữ liệu.<button type="button" onClick={onRetry}>Thử lại</button></div>;
  return <p className="od-muted" role="status">Đang tải dữ liệu…</p>;
}

function ApprovalRow({ item, measuring = false }) {
  const Tag = measuring ? 'div' : 'li';
  const detail = item.detail || (item.nextExamAt
    ? `Lịch thi: ${new Date(item.nextExamAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : '');
  return <Tag className="od-approval-row">
    <div className="od-item-copy"><strong title={item.title}>{item.title}</strong>{detail && <small title={detail}>{detail}</small>}</div>
    {item.href && (measuring ? <span className="od-item-action">Mở<ArrowRightIcon aria-hidden="true" /></span>
      : <Link className="od-item-action" to={item.href} aria-label={`${item.action || 'Mở chức năng'}: ${item.title}`}>
        <span>Mở</span><ArrowRightIcon aria-hidden="true" /></Link>)}
  </Tag>;
}

function ApprovalList({ items = [], emptyRef }) {
  const viewport = useRef(null), measurements = useRef(null);
  const [capacity, setCapacity] = useState(1);
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    let frame;
    const measure = () => {
      // Use the tallest loaded row so every page fits, including long names.
      const tallest = Math.max(1, ...Array.from(measurements.current?.children || [], row => row.getBoundingClientRect().height));
      const next = Math.max(1, Math.floor((viewport.current?.clientHeight || 0) / tallest));
      setCapacity(previous => previous === next ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (viewport.current) observer?.observe(viewport.current);
    if (measurements.current) observer?.observe(measurements.current);
    window.addEventListener('resize', schedule);
    measure();
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', schedule); };
  }, [items]);
  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const current = Math.min(page, pages - 1), start = current * capacity;
  return <div className="od-approval-list">
    <div className="od-approval-viewport" ref={viewport}>
      <div className="od-approval-measure" ref={measurements} aria-hidden="true" inert="">
        {items.map(item => <ApprovalRow key={item.id} item={item} measuring />)}
      </div>
      {items.length ? <ul className="od-items" aria-label="Danh sách chờ phê duyệt">
        {items.slice(start, start + capacity).map(item => <ApprovalRow key={item.id} item={item} />)}
      </ul> : <p className="od-empty od-centered-empty" tabIndex={-1} ref={emptyRef}><CheckCircleIcon aria-hidden="true" /><span>Không có yêu cầu chờ phê duyệt</span></p>}
    </div>
    {items.length > 0 && <div className="od-approval-pagination">
      {pages > 1 && <><span role="status">{start + 1}–{Math.min(start + capacity, items.length)}/{items.length} mục đã tải</span>
        <nav aria-label="Trang chờ phê duyệt"><button type="button" disabled={current === 0} aria-label="Trang phê duyệt trước" onClick={() => setPage(current - 1)}><ChevronLeftIcon aria-hidden="true" /></button>
          <button type="button" disabled={current === pages - 1} aria-label="Trang phê duyệt tiếp" onClick={() => setPage(current + 1)}><ArrowRightIcon aria-hidden="true" /></button></nav></>}
    </div>}
  </div>;
}

const tabLabels = { grouping: 'Phân nhóm', scheduling: 'Xếp lịch', progress: 'Xác nhận', grades: 'Điểm' };
const stageLabels = ['Điểm thành phần', 'Tổ chức thi', 'Điểm thi', 'Gửi duyệt'];
const emptyLabels = { grouping: 'Không có chuyên ngành chờ phân nhóm.', scheduling: 'Không có lớp chờ xếp lịch.',
  progress: 'Không có lớp chờ xác nhận.', grades: 'Không có lớp chờ xử lý điểm.' };

function WorkPanel({ permissions, sources, retry, tab, setTab, year }) {
  const [selectedStage, setSelectedStage] = useState('');
  const definitions = workDefinitions.filter(definition => permissions[definition.key]);
  const active = definitions.some(definition => definition.key === tab) ? tab : definitions[0]?.key;
  const definition = definitions.find(item => item.key === active);
  const source = sources[definition?.source];
  const metric = metricOf(source, active);
  const groups = useMemo(() => gradeGroups(sources.grades?.data).filter(group => group.count > 0), [sources.grades?.data]);
  const stage = groups.find(group => group.stage === selectedStage) || groups[0];
  const items = useMemo(() => {
    const loaded = active === 'grades' ? stage?.items || [] : metric?.items || [];
    if (active === 'grouping' || active === 'progress') {
      return loaded.filter(item => Number(item.count) > 0).slice().sort((a, b) => Number(b.count) - Number(a.count)
        || a.title.localeCompare(b.title, 'vi') || String(a.id).localeCompare(String(b.id)));
    }
    return loaded;
  }, [active, metric, stage]);
  const itemCount = active === 'grades' ? stage?.count
    : items.length === (metric?.items?.length || 0) ? metric?.itemCount : undefined;
  const onTabKey = event => {
    const index = definitions.findIndex(item => event.currentTarget.id === `od-tab-${item.key}`);
    const next = event.key === 'ArrowRight' ? (index + 1) % definitions.length : event.key === 'ArrowLeft' ? (index - 1 + definitions.length) % definitions.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? definitions.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(definitions[next].key); event.currentTarget.parentElement.children[next]?.focus();
  };
  return <section className="od-panel od-work" aria-labelledby="od-work-title">
    <div className="od-panel-heading"><h2 className="od-panel-title" id="od-work-title"><span className="od-panel-title-icon od-panel-title-icon--work" aria-hidden="true"><ClipboardDocumentListIcon /></span><span className="od-panel-title-text">Công việc cần xử lý</span></h2></div>
    <div className="od-tabs" role="tablist" aria-label="Nhóm công việc">{definitions.map(item => <button type="button" key={item.key}
      id={`od-tab-${item.key}`} role="tab" aria-selected={active === item.key} aria-controls="od-work-content"
      tabIndex={active === item.key ? 0 : -1} onKeyDown={onTabKey} onClick={() => setTab(item.key)}>{tabLabels[item.key]}</button>)}</div>
    <div className="od-work-body" id="od-work-content" role="tabpanel" aria-labelledby={`od-tab-${active}`} tabIndex={0}>
      {source?.status !== 'ready' ? <SourceState source={source} onRetry={() => retry(definition.source)} /> : <>
        {active === 'grades' && groups.length > 1 && <div className="od-stage-picker" role="group" aria-label="Giai đoạn điểm">
          {groups.map(group => <button type="button" key={group.stage} title={stageTitles[stages.indexOf(group.stage)]}
            aria-pressed={stage.stage === group.stage} onClick={() => setSelectedStage(group.stage)}>
            <span>{stageLabels[stages.indexOf(group.stage)]}</span><span className="od-count">{group.count}</span>
          </button>)}
        </div>}
        {active === 'grades' && groups.length === 1 && <p className="od-stage-label" title={stageTitles[stages.indexOf(stage.stage)]}>
          {stageLabels[stages.indexOf(stage.stage)]}
        </p>}
        <AdaptiveTaskList items={items} itemCount={itemCount} href={workDestination(definition, metric, year)}
          kind={active} empty={emptyLabels[active]} contextKey={`${active}:${active === 'grades' ? stage?.stage || '' : ''}`} />
      </>}
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
  const emptyDetail = current && sources[current.source]?.status === 'ready' && !current.metric?.items?.length;
  const allClear = groups.every(group => sources[group.source]?.status === 'ready' && group.metric?.count === 0);
  return <section className="od-panel od-approvals" aria-labelledby="od-approval-title">
    <div className="od-panel-heading"><h2 className="od-panel-title" id="od-approval-title"><span className="od-panel-title-icon od-panel-title-icon--approval" aria-hidden="true"><ClipboardDocumentCheckIcon /></span><span className="od-panel-title-text">Chờ phê duyệt</span></h2></div>
    {current ? <div className="od-approval-detail"><button className="od-back" type="button" onClick={() => setSelected(null)}><ChevronLeftIcon aria-hidden="true" />Tổng quan phê duyệt</button>
      {!emptyDetail && <h3 tabIndex={-1} ref={focusHeading}>{current.title}</h3>}
      {sources[current.source]?.status === 'ready' ? <ApprovalList key={current.key} items={current.metric?.items} emptyRef={focusHeading} />
        : <SourceState source={sources[current.source]} onRetry={() => retry(current.source)} />}
    </div> : <>
      <ul className={`od-approval-groups${allClear ? ' od-approval-clear' : ''}`} style={{ '--od-approval-group-count': groups.length }}>{groups.map(group => <li key={group.key} data-pending={sources[group.source]?.status === 'ready' && group.metric?.count > 0}>
      <button type="button" onClick={() => setSelected(group.key)}><span className="od-approval-icon"><group.Icon aria-hidden="true" /></span><span>{group.title}</span>
        {sources[group.source]?.status === 'ready' && <strong>{group.metric?.count ?? 0}</strong>}<ArrowRightIcon aria-hidden="true" /></button>
      {sources[group.source]?.status !== 'ready' && <SourceState source={sources[group.source]} onRetry={() => retry(group.source)} />}
    </li>)}</ul></>}
  </section>;
}

const colors = ['#10b5df', '#6978d6', '#e4a74c', '#20a58d', '#b776bc', '#8a99ab', '#d57d64'];
function ChartFigure({ source, sourceKey, retry }) {
  const data = source?.data;
  const values = [...(data?.values || []).reduce((map, value) => map.set(value.label, (map.get(value.label) || 0) + Number(value.count)), new Map())]
    .map(([label, count]) => ({ label, count }));
  const total = values.reduce((sum, value) => sum + value.count, 0);
  let position = 0;
  const gradient = values.map((value, index) => { const start = position; position += total ? value.count / total * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${position}%`; }).join(',');
  return source?.status !== 'ready' ? <SourceState source={source} onRetry={() => retry(sourceKey)} /> : <figure aria-label={data.title}>
      <figcaption><span>{data.title}</span><span className="od-chart-unit">Đơn vị: {data.unit}</span></figcaption>
      {data.kind === 'bar' && values.length ? <div className="od-columns" aria-label="Số lớp hoàn thành theo tháng">{values.map(value => <div className="od-month" key={value.label}>
        <div className="od-column-track"><strong style={{ bottom: `calc(${value.count / Math.max(...values.map(item => item.count), 1) * 100}% + 7px)` }}>{value.count}</strong>
          <i aria-hidden="true" style={{ height: `${value.count / Math.max(...values.map(item => item.count), 1) * 100}%` }} /></div><span>{value.label}</span></div>)}</div>
        : !total ? <p className="od-empty">Chưa có dữ liệu trong phạm vi này.</p>
        : <div className="od-chart-body"><div className="od-donut" aria-hidden="true" style={{ background: `conic-gradient(${gradient})` }}><span><strong>{total}</strong>{data.unit}</span></div>
          <ul className="od-legend">{values.map((value, index) => <li key={value.label}><i aria-hidden="true" style={{ background: colors[index % colors.length] }} /><span>{value.label}</span><strong>{value.count}</strong></li>)}</ul></div>}
    </figure>;
}

function OverviewCharts({ sources, permissions, retry }) {
  const [selected, setSelected] = useState('');
  const topics = [ ...(permissions.learnersOverview ? [{ key: 'learnersChart', label: 'Hồ sơ / học viên trong khóa' }] : []),
    ...(permissions.overview ? [{ key: 'sessionsChart', label: 'Buổi học trong tuần' }, { key: 'completionChart', label: 'Tiến độ giảng dạy' }] : [])
  ].filter(topic => sources[topic.key]?.status !== 'not_implemented');
  const key = topics.some(topic => topic.key === selected) ? selected : topics[0]?.key;
  if (!key) return null;
  return <section className="od-charts od-charts-single" aria-label="Thống kê đào tạo">
    <section className="od-panel od-chart" aria-labelledby="od-chart-title">
      <div className="od-panel-heading od-panel-heading--overview"><div><h2 className="od-panel-title" id="od-chart-title"><span className="od-panel-title-icon od-panel-title-icon--overview" aria-hidden="true"><ChartBarIcon /></span><span className="od-panel-title-text">Tổng quan đào tạo</span></h2></div>
        <label className="od-chart-select"><span className="od-visually-hidden">Chủ đề</span><DashboardSelect aria-label="Chủ đề tổng quan" value={key} onChange={event => setSelected(event.target.value)}>
          {topics.map(topic => <option key={topic.key} value={topic.key}>{topic.label}</option>)}</DashboardSelect></label></div>
      <ChartFigure source={sources[key]} sourceKey={key} retry={retry} />
    </section>
  </section>;
}

export default function OperationalDashboard() {
  const [params, setParams] = useSearchParams();
  const { year, program } = dashboardFilters(params);
  const session = useAuthSession();
  const profileKey = `${session?.user?.id || ''}:${session?.activeProfile?.id || ''}`;
  const scope = `${profileKey}:${year}:${program}`;
  const [selection, setSelection] = useState({ scope, tab: 'grouping' });
  const tab = selection.scope === scope ? selection.tab : 'grouping';
  const selectTab = value => setSelection({ scope, tab: value });
  const { state, retry } = useDashboardData(year, program);
  const emptyDoctoral = program === 'doctoral' && !state.loading && !state.error
    && Object.values(state.sources || {}).every(source => source.status === 'not_implemented');
  // These flags only render non-actionable placeholders; API permissions remain unchanged.
  const permissions = emptyDoctoral ? { ...state.permissions, grouping: true, scheduling: true, progress: true,
    grades: true, overview: true, learnersOverview: true } : state.permissions || {};
  const sources = emptyDoctoral ? doctoralEmptySources : state.sources;
  const hasWork = workDefinitions.some(definition => permissions[definition.key]);
  const hasApprovals = permissions.approvals || permissions.studyLeaveApproval || permissions.majorTransferApproval;
  const hasCharts = (permissions.overview || permissions.learnersOverview) && ['learnersChart', 'sessionsChart', 'completionChart']
    .some(key => sources[key] && sources[key].status !== 'not_implemented');
  const years = Array.from({ length: 5 }, (_, index) => String(currentYear + 2 - index));
  const setFilter = (key, value) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next); };
  return <div className="operational-dashboard">
    <header className="od-header"><div>
      <h1><span>Xin chào, </span><strong>{session?.user?.name || 'bạn'}</strong><span aria-hidden="true"> 👋</span></h1><p>Công việc cần quan tâm trong phạm vi của bạn</p></div>
      <div className="od-filters" role="group" aria-label="Bộ lọc dashboard">
        <label>Hệ đào tạo<DashboardSelect aria-label="Hệ đào tạo" value={program} onChange={event => setFilter('program', event.target.value)}>
          {Object.entries(programs).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DashboardSelect></label>
        <label>Năm tuyển sinh<DashboardSelect aria-label="Năm tuyển sinh" value={year} onChange={event => setFilter('year', event.target.value)}>
          {years.map(value => <option key={value}>{value}</option>)}</DashboardSelect></label>
      </div>
    </header>
    {state.loading ? <div className="od-panel"><SourceState /></div> : state.error ? <div className="od-panel od-page-error" role="alert">Không thể tải tổng quan công việc.<button type="button" onClick={() => retry()}>Thử lại</button></div>
      : <div className="od-content" key={scope}>
        <DashboardColumns className={`od-layout${hasWork && (hasApprovals || hasCharts) ? '' : ' od-layout-single'}`}>
        {hasWork && <div className="od-work-column">
          <SummaryCards permissions={permissions} sources={sources} year={year} />
          <WorkPanel permissions={permissions} sources={sources} retry={retry} tab={tab} setTab={selectTab} year={year} />
        </div>}
        {(hasApprovals || hasCharts) && <aside className="od-sidebar" aria-label="Phê duyệt và tổng quan">
          {hasApprovals && <ApprovalPanel permissions={permissions} sources={sources} retry={retry} />}
          {hasCharts && <OverviewCharts permissions={permissions} sources={sources} retry={retry} />}
        </aside>}
        {!hasWork && !hasApprovals && !hasCharts && <section className="od-panel od-no-access">
          {Object.values(state.sources).some(source => source.status === 'not_implemented')
            ? <><h2>Nội dung tổng quan chưa được triển khai</h2><p>Chưa có nguồn tổng quan phù hợp cho hệ đào tạo đang chọn.</p></>
            : <><h2>Chưa có nội dung phù hợp với quyền hiện tại</h2><p>Hồ sơ đang chọn chưa có quyền xem hoặc xử lý các mục tổng quan này.</p></>}
        </section>}
        </DashboardColumns>
      </div>}
  </div>;
}
