import AppSelect from "../../components/AppSelect";
import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowPathIcon, ArrowRightIcon, CalendarDaysIcon, CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, ExclamationTriangleIcon, UsersIcon } from "../../components/AppIcons";
import { API_BASE_URL } from "../../config/http";
import { useGradebookRevision } from "../../utils/gradebookRevision";
import "./operationalDashboard.css";

const currentYear = new Date().getFullYear();
const programLabels = { masters: "Thạc sĩ", doctoral: "Tiến sĩ" };
const definitions = [
  { key: "studyLeaveApproval", source: "studyLeaveApproval", inboxOnly: true, title: "Chờ duyệt bảo lưu", action: "Duyệt / Từ chối", unit: "yêu cầu", Icon: ClockIcon, tone: "amber" },
  { key: "majorTransferApproval", source: "majorTransferApproval", inboxOnly: true, title: "Chờ duyệt chuyển chuyên ngành", action: "Duyệt / Từ chối", unit: "yêu cầu", Icon: ClipboardDocumentListIcon, tone: "violet" },
  { key: "resultApproval", permission: "approvals", source: "approvals", title: "Chờ duyệt khóa điểm", healthyTitle: "Duyệt khóa điểm", action: "Duyệt khóa điểm", healthy: "Không có yêu cầu chờ duyệt khóa điểm", unit: "lớp", Icon: ClipboardDocumentListIcon, tone: "violet" },
  { key: "grouping", source: "grouping", title: "Học viên chưa phân nhóm", healthyTitle: "Phân nhóm học viên", action: "Phân nhóm", healthy: "Không còn học viên chờ phân nhóm", unit: "học viên", Icon: UsersIcon, tone: "teal" },
  { key: "scheduling", source: "teaching", title: "Lớp chưa xếp lịch", healthyTitle: "Xếp lịch học", action: "Xếp lịch", healthy: "Không còn lớp chờ xếp lịch", unit: "lớp học phần", Icon: CalendarDaysIcon, tone: "blue" },
  { key: "grades", source: "grades", title: "Chờ nhập điểm thành phần", healthyTitle: "Nhập điểm thành phần", action: "Nhập điểm", healthy: "Không có lớp chờ nhập điểm thành phần", unit: "lớp", Icon: ClipboardDocumentListIcon, tone: "violet" },
  { key: "progress", source: "teaching", title: "Tiến độ cần kiểm tra", healthyTitle: "Kiểm tra tiến độ", action: "Kiểm tra", healthy: "Không có buổi học chờ xác nhận", unit: "buổi chờ xác nhận", Icon: ClockIcon, tone: "amber" },
];
const metricOf = (source, key) => source?.data?.[key] || (source?.data && ["eligibilityReopen", "eligibilityApproval", "resultApproval"].includes(key)
  ? { count: 0, itemCount: 0, items: [], href: "/masters/exam-lists" } : source?.data);

function SourceState({ source, onRetry, compact = false }) {
  if (source?.status === "not_implemented") return <p className="od-unavailable">{source.message || "Chức năng chưa được triển khai."}</p>;
  if (!source || source.status === "loading") return <div className={`od-loading${compact ? " od-loading-compact" : ""}`} role="status" aria-label="Đang tải công việc"><span /><span /></div>;
  if (source.status === "error") return <div className="od-source-error" role="alert"><span>Chưa tải được dữ liệu.</span><button type="button" onClick={onRetry}><ArrowPathIcon />Thử lại</button></div>;
  return null;
}

export function ActionCard({ definition, source, onRetry }) {
  const { key, title, healthyTitle, action, healthy, unit, Icon, tone } = definition;
  const metric = source?.status === "ready" ? metricOf(source, key) : null;
  const ready = metric && Number.isFinite(metric.count);
  return <article className={`od-card od-tone-${tone}${ready && metric.count === 0 ? " od-card-healthy" : ""}`} aria-label={title}>
    <div className="od-card-body">
      <span className="od-icon"><Icon aria-hidden="true" /></span>
      <div className="od-card-content">
        <h2>{ready && metric.count === 0 ? healthyTitle : title}</h2>
        {ready ? metric.count > 0 ? <div className="od-card-value"><strong>{metric.count.toLocaleString("vi-VN")}</strong><span>{unit}{key === "grouping" ? " đang chờ" : ""}</span></div>
          : <p className="od-healthy-text"><CheckCircleIcon aria-hidden="true" /><span>{healthy}</span></p>
          : <SourceState source={source} onRetry={onRetry} compact />}
      </div>
    </div>
    {ready && <div className="od-card-footer">
      {metric.count > 0 && <span className="od-card-state">Cần xử lý</span>}
      <Link className="od-card-action" to={metric.href}>{metric.count > 0 ? action : "Xem chi tiết"}<ArrowRightIcon /></Link>
    </div>}
  </article>;
}

function WorkCategory({ definition, source, onRetry }) {
  const metric = source?.status === "ready" ? metricOf(source, definition.key) : null;
  const grouping = definition.key === "grouping";
  if (metric?.count === 0) return null;
  return <section className={`od-work-category od-tone-${definition.tone}`} aria-label={definition.title}>
    <div className="od-category-heading"><h3><definition.Icon />{grouping ? "Học viên chờ phân nhóm" : definition.key === 'grades' ? 'CHỜ NHẬP ĐIỂM THÀNH PHẦN' : definition.title}</h3>
      {metric && <span className="od-category-count">{metric.count} {definition.unit}</span>}
    </div>
    {!metric ? <SourceState source={source} onRetry={onRetry} /> : <>
      <ul className="od-work-list">{metric.items.map((item) => <li key={item.id}>
        <Link to={item.href}><span className="od-item-copy"><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>
          {item.count != null && <span className="od-row-metric">
            <span className="od-item-count">{item.count} {item.unit}</span></span>}
          <span className="od-row-action">{definition.action}<ArrowRightIcon aria-hidden="true" /></span>
        </Link>
      </li>)}</ul>
      <div className="od-category-footer">
        {metric.itemCount > metric.items.length && <span>Hiển thị {metric.items.length}/{metric.itemCount} mục</span>}
        <Link to={metric.href}>{definition.key === "grades" ? "Mở bảng điểm cần xử lý" : "Xem tất cả"}<ArrowRightIcon /></Link>
      </div>
    </>}
  </section>;
}

function WarningPanel({ teachingSource, gradesSource, permissions, year, program, onRetry }) {
  const progress = permissions.progress && teachingSource?.status === "ready" ? teachingSource.data.progress : null;
  const groups = [
    ...(progress ? [{ key: 'teaching', title: 'BUỔI HỌC CHƯA XÁC NHẬN', items: progress.items, count: progress.count, unit: 'buổi' }] : []),
    ...(permissions.grades && gradesSource?.status === 'ready' ? (gradesSource.data.warningGroups || []).filter(group => ['exam', 'examGrades'].includes(group.key)) : []),
  ];
  const count = new Set(groups.flatMap(group => group.items.map(item => item.id))).size;
  const groupHrefs = {
    teaching: progress?.href,
    exam: `/${program}/exam-schedule?${new URLSearchParams({ year })}`,
    examGrades: `/${program}/exam-lists?${new URLSearchParams({ year })}`,
  };
  const ready = (!permissions.progress || teachingSource?.status === 'ready') && (!permissions.grades || gradesSource?.status === 'ready');
  return <aside className="od-panel od-warnings" aria-labelledby="od-warning-title">
    <div className="od-panel-heading"><h2 id="od-warning-title"><ExclamationTriangleIcon aria-hidden="true" />CẢNH BÁO</h2>{count > 0 && <span className="od-warning-badge">{count} lớp</span>}</div>
    <div className="od-warning-content">
      {permissions.progress && teachingSource?.status !== 'ready' && <SourceState source={teachingSource} onRetry={() => onRetry('teaching')} />}
      {permissions.grades && gradesSource?.status !== 'ready' && <SourceState source={gradesSource} onRetry={() => onRetry('grades')} />}
      {ready && count === 0
      ? <div className="od-warning-healthy"><CheckCircleIcon aria-hidden="true" /><div><strong>Không có cảnh báo</strong><p>Chưa phát hiện vấn đề cần xử lý.</p></div></div>
      : groups.filter(group => group.items.length > 0).map(group => <section className="od-warning-group" key={group.key} aria-label={group.title}>
        <h3>{group.title}<span className="od-warning-badge">{group.count ?? group.items.length} {group.unit || 'lớp'}</span></h3>
        <ul className="od-warning-list">{group.items.map((item) => <li key={item.id}><Link to={item.href} aria-label={[item.title, item.detail].filter(Boolean).join(". ")}>
          <span className="od-warning-icon"><ExclamationTriangleIcon aria-hidden="true" /></span>
          <span className="od-item-copy"><strong title={item.title}>{item.title}</strong><small title={item.detail}>{item.detail}</small></span><ArrowRightIcon aria-hidden="true" />
        </Link></li>)}</ul>
        {groupHrefs[group.key] && <div className="od-category-footer od-warning-group-footer"><Link to={groupHrefs[group.key]}>Xem tất cả<ArrowRightIcon /></Link></div>}
      </section>)}</div>
  </aside>;
}

export default function OperationalDashboard() {
  const [params, setParams] = useSearchParams();
  const year = /^\d{4}$/.test(params.get("year") || "") ? params.get("year") : String(currentYear);
  const program = params.get("program") === "doctoral" ? "doctoral" : "masters";
  const programLabel = programLabels[program];
  const [revision, setRevision] = useState(0);
  const gradebookRevision = useGradebookRevision();
  const [state, setState] = useState({ year, program, loading: true, permissions: null, sources: {}, error: false });
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const request = ++generation.current;
    const controller = new AbortController();
    inFlight.current = true;
    setState(previous => previous.year === year && previous.program === program && previous.permissions
      ? { ...previous, error: false } : { year, program, loading: true, permissions: null, sources: {}, error: false });
    axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year, program }, withCredentials: true, signal: controller.signal })
      .then(({ data }) => { if (request === generation.current) setState({ ...data, year, program, loading: false, error: false }); })
      .catch(() => { if (request === generation.current) setState({ year, program, loading: false, permissions: null, sources: {}, error: true }); })
      .finally(() => { if (request === generation.current) inFlight.current = false; });
    return () => { controller.abort(); generation.current += 1; inFlight.current = false; };
  }, [year, program, revision, gradebookRevision]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden" && !inFlight.current) setRevision(value => value + 1); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const retry = async (section) => {
    const request = generation.current;
    setState((previous) => ({ ...previous, sources: { ...previous.sources, [section]: { status: "loading" } } }));
    try {
      const { data } = await axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year, program, section }, withCredentials: true });
      if (request === generation.current) setState((previous) => ({ ...previous, permissions: data.permissions, sources: { ...previous.sources, ...data.sources } }));
    } catch (error) {
      if (request === generation.current && [401, 403].includes(error.response?.status)) {
        setState({ year, program, loading: false, permissions: null, sources: {}, error: true });
        return;
      }
      if (request === generation.current) setState((previous) => ({ ...previous, sources: { ...previous.sources, [section]: { status: "error" } } }));
    }
  };
  const loading = state.loading || state.year !== year || state.program !== program;
  const permissions = !loading && state.permissions;
  const permitted = definitions.filter((definition) => permissions?.[definition.permission || definition.key]);
  const cards = permitted.filter((definition) => definition.source !== "approvals" && !definition.inboxOnly);
  const work = permitted.filter((definition) => definition.key !== "progress");
  const workHealthy = work.length > 0 && work.every((definition) => state.sources[definition.source]?.status === "ready" && metricOf(state.sources[definition.source], definition.key)?.count === 0);
  const overviewSource = state.sources.teaching;
  const showWarnings = permissions?.progress || permissions?.grades;
  const overview = overviewSource?.status === "ready" ? overviewSource.data.overview : null;
  const years = [...new Set([year, ...Array.from({ length: 6 }, (_, index) => String(currentYear - 3 + index))])].sort().reverse();

  return <div className="operational-dashboard">
    <header className="od-header"><div><h1>Bảng điều khiển công việc</h1><p>Theo dõi các công việc cần xử lý và tình trạng nghiệp vụ theo năm tuyển sinh.</p></div>
    </header>
    <div className="od-summary-row">
      <div className="od-filters" role="group" aria-label="Bộ lọc dashboard">
        <label className="od-filter">Hệ đào tạo<AppSelect aria-label="Hệ đào tạo" value={program} onChange={(event) => {
          const next = new URLSearchParams(params); next.set("program", event.target.value); setParams(next);
        }}>{Object.entries(programLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect></label>
        <label className="od-filter">Năm tuyển sinh<AppSelect aria-label="Năm tuyển sinh" value={year} onChange={(event) => {
        const next = new URLSearchParams(params); next.set("year", event.target.value); setParams(next);
      }}>{years.map((value) => <option key={value}>{value}</option>)}</AppSelect></label></div>
      <div className="od-summary-content">
    {loading ? <div className="od-cards" aria-label="Đang tải tổng quan">{[0, 1, 2, 3].map((key) => <div key={key} className="od-card"><SourceState /></div>)}</div>
      : state.error ? <div className="od-panel od-page-error" role="alert"><ExclamationTriangleIcon /><span>Không thể tải tổng quan công việc.</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>
        : <>
          {cards.length > 0 && <section className="od-cards" aria-label="Công việc theo quyền truy cập" style={{ "--od-columns": Math.min(4, cards.length), "--od-small-columns": Math.min(2, cards.length) }}>{cards.map((definition) => <ActionCard key={definition.key} definition={definition}
            source={state.sources[definition.source]} onRetry={() => retry(definition.source)} />)}</section>}
        </>}
      </div>
    </div>
    {!loading && !state.error && <>
          {!permitted.length && <div className="od-panel od-no-access"><ClipboardDocumentListIcon /><div><h2>Chưa có tác vụ được giao</h2><p>Tài khoản hiện chưa có quyền xử lý các hàng đợi công việc này.</p></div></div>}
          {(work.length > 0 || showWarnings) && <div className={`od-main${showWarnings && work.length ? "" : " od-main-single"}`}>
            {work.length > 0 && <section className="od-panel" aria-labelledby="od-work-title"><div className="od-panel-heading"><h2 id="od-work-title"><ClipboardDocumentListIcon aria-hidden="true" />VIỆC CẦN XỬ LÝ</h2><span>{programLabel} · {year}</span></div>
              {workHealthy ? <div className="od-empty"><CheckCircleIcon /><strong>Không có mục chờ xử lý</strong><span>Mọi đầu việc trong phạm vi hiện tại đã hoàn thành.</span></div>
                : work.map((definition) => <WorkCategory key={definition.key} definition={definition} source={state.sources[definition.source]} onRetry={() => retry(definition.source)} />)}
            </section>}
            {showWarnings && <WarningPanel teachingSource={state.sources.teaching} gradesSource={state.sources.grades} permissions={permissions} year={year} program={program} onRetry={retry} />}
          </div>}
          {permissions?.overview && <section className="od-panel od-overview" aria-labelledby="od-overview-title"><div className="od-panel-heading"><h2 id="od-overview-title">TÌNH HÌNH ĐÀO TẠO</h2><span>Lớp học phần {programLabel.toLocaleLowerCase("vi-VN")} · {year}</span></div>
            {overview ? <dl>{[["Lớp đang mở", overview.active], ["Đang giảng dạy", overview.inProgress], ["Chưa xếp buổi học", overview.unscheduled], ["Đã hoàn thành", overview.completed]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              : <SourceState source={overviewSource} onRetry={() => retry("teaching")} />}
          </section>}
        </>}
  </div>;
}
