import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import PendingActionsOutlined from "@mui/icons-material/PendingActionsOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { API_BASE_URL } from "../../config/http";
import "./operationalDashboard.css";

const currentYear = new Date().getFullYear();
const WARNING_PREVIEW_LIMIT = 3;
const definitions = [
  { key: "grouping", source: "grouping", title: "Học viên chưa phân nhóm", healthyTitle: "Phân nhóm học viên", action: "Phân nhóm", healthy: "Không còn học viên chờ phân nhóm", unit: "học viên", Icon: GroupsOutlined, tone: "teal" },
  { key: "scheduling", source: "teaching", title: "Lớp chưa xếp lịch", healthyTitle: "Xếp lịch học", action: "Xếp lịch", healthy: "Không còn lớp chờ xếp lịch", unit: "lớp học phần", Icon: CalendarMonthOutlined, tone: "blue" },
  { key: "grades", source: "grades", title: "Lớp chưa nhập đủ điểm", healthyTitle: "Nhập điểm học phần", action: "Nhập điểm", healthy: "Không có lớp chờ bổ sung điểm", unit: "nhóm học viên", Icon: AssignmentOutlined, tone: "violet" },
  { key: "progress", source: "teaching", title: "Tiến độ cần kiểm tra", healthyTitle: "Kiểm tra tiến độ", action: "Kiểm tra", healthy: "Không có buổi học chờ xác nhận", unit: "lớp có buổi chờ xác nhận", Icon: PendingActionsOutlined, tone: "amber" },
];
const metricOf = (source, key) => source?.data?.[key] || source?.data;

function SourceState({ source, onRetry, compact = false }) {
  if (!source || source.status === "loading") return <div className={`od-loading${compact ? " od-loading-compact" : ""}`} role="status" aria-label="Đang tải công việc"><span /><span /></div>;
  if (source.status === "error") return <div className="od-source-error" role="alert"><span>Chưa tải được dữ liệu.</span><button type="button" onClick={onRetry}><RefreshOutlined />Thử lại</button></div>;
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
          : <p className="od-healthy-text"><CheckCircleOutline aria-hidden="true" /><span>{healthy}</span></p>
          : <SourceState source={source} onRetry={onRetry} compact />}
      </div>
    </div>
    {ready && <div className="od-card-footer">
      {metric.count > 0 && <span className="od-card-state">Cần xử lý</span>}
      <Link className="od-card-action" to={metric.href}>{metric.count > 0 ? action : "Xem chi tiết"}<ArrowForwardOutlined /></Link>
    </div>}
  </article>;
}

function WorkCategory({ definition, source, onRetry }) {
  const metric = source?.status === "ready" ? metricOf(source, definition.key) : null;
  const grouping = definition.key === "grouping";
  if (metric?.count === 0) return null;
  return <section className={`od-work-category od-tone-${definition.tone}`} aria-label={definition.title}>
    <div className="od-category-heading"><h3><definition.Icon />{grouping ? "Học viên chờ phân nhóm" : definition.title}</h3>
      {metric && <span className="od-category-count">{metric.count} {definition.unit}</span>}
    </div>
    {!metric ? <SourceState source={source} onRetry={onRetry} /> : <>
      <ul className="od-work-list">{metric.items.map((item) => <li key={item.id}>
        <Link to={item.href}><span className="od-item-copy"><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>
          {item.count != null && <span className="od-row-metric">
            <span className="od-item-count">{item.count} {item.unit}</span></span>}
          <span className="od-row-action">{definition.action}<ArrowForwardOutlined aria-hidden="true" /></span>
        </Link>
      </li>)}</ul>
      <div className="od-category-footer">
        {metric.itemCount > metric.items.length && <span>Hiển thị {metric.items.length}/{metric.itemCount} mục</span>}
        <Link to={metric.href}>{definition.key === "grades" ? "Mở bảng điểm cần xử lý" : "Xem tất cả"}<ArrowForwardOutlined /></Link>
      </div>
    </>}
  </section>;
}

function WarningPanel({ source, onRetry }) {
  const progress = source?.status === "ready" ? source.data.progress : null;
  // Preserve the API's existing priority order; only limit the Home preview.
  const warnings = progress?.items.slice(0, WARNING_PREVIEW_LIMIT) || [];
  return <aside className="od-panel od-warnings" aria-labelledby="od-warning-title">
    <div className="od-panel-heading"><h2 id="od-warning-title"><WarningAmberOutlined aria-hidden="true" />CẢNH BÁO</h2>{progress?.count > 0 && <span className="od-warning-badge">{progress.count} lớp</span>}</div>
    <div className="od-warning-content">{!progress ? <SourceState source={source} onRetry={onRetry} /> : progress.count === 0
      ? <div className="od-warning-healthy"><CheckCircleOutline aria-hidden="true" /><div><strong>Không có cảnh báo</strong><p>Chưa phát hiện vấn đề cần xử lý.</p></div></div>
      : <><p className="od-panel-description">Buổi học đã qua giờ, chưa xác nhận kết quả.</p>
        <ul className="od-warning-list">{warnings.map((item) => <li key={item.id}><Link to={item.href} aria-label={[item.title, item.detail].filter(Boolean).join(". ")}>
          <span className="od-warning-icon"><WarningAmberOutlined aria-hidden="true" /></span>
          <span className="od-item-copy"><strong title={item.title}>{item.title}</strong><small title={item.detail}>{item.detail}</small></span><ArrowForwardOutlined aria-hidden="true" />
        </Link></li>)}</ul>
      </>}</div>
    {progress?.count > 0 && <div className="od-category-footer"><Link to={progress.href}>{progress.count > warnings.length ? `Xem tất cả ${progress.count} lớp` : "Xem buổi chờ xác nhận"}<ArrowForwardOutlined /></Link></div>}
  </aside>;
}

export default function OperationalDashboard() {
  const [params, setParams] = useSearchParams();
  const year = /^\d{4}$/.test(params.get("year") || "") ? params.get("year") : String(currentYear);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ year, loading: true, permissions: null, sources: {}, error: false });
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    const controller = new AbortController();
    setState({ year, loading: true, permissions: null, sources: {}, error: false });
    axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year }, withCredentials: true, signal: controller.signal })
      .then(({ data }) => { if (request === generation.current) setState({ ...data, year, loading: false, error: false }); })
      .catch(() => { if (request === generation.current) setState({ year, loading: false, permissions: null, sources: {}, error: true }); });
    return () => { controller.abort(); generation.current += 1; };
  }, [year, revision]);

  const retry = async (section) => {
    const request = generation.current;
    setState((previous) => ({ ...previous, sources: { ...previous.sources, [section]: { status: "loading" } } }));
    try {
      const { data } = await axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year, section }, withCredentials: true });
      if (request === generation.current) setState((previous) => ({ ...previous, permissions: data.permissions, sources: { ...previous.sources, ...data.sources } }));
    } catch (error) {
      if (request === generation.current && [401, 403].includes(error.response?.status)) {
        setState({ year, loading: false, permissions: null, sources: {}, error: true });
        return;
      }
      if (request === generation.current) setState((previous) => ({ ...previous, sources: { ...previous.sources, [section]: { status: "error" } } }));
    }
  };
  const loading = state.loading || state.year !== year;
  const permissions = !loading && state.permissions;
  const permitted = definitions.filter((definition) => permissions?.[definition.key]);
  const work = permitted.filter((definition) => definition.key !== "progress");
  const workHealthy = work.length > 0 && work.every((definition) => state.sources[definition.source]?.status === "ready" && metricOf(state.sources[definition.source], definition.key)?.count === 0);
  const overviewSource = state.sources.teaching;
  const overview = overviewSource?.status === "ready" ? overviewSource.data.overview : null;
  const years = [...new Set([year, ...Array.from({ length: 6 }, (_, index) => String(currentYear - 3 + index))])].sort().reverse();

  return <div className="operational-dashboard">
    <header className="od-header"><div><h1>Bảng điều khiển công việc</h1><p>Theo dõi các công việc cần xử lý và tình trạng nghiệp vụ theo năm tuyển sinh.</p></div>
      <div className="od-header-controls"><span className="od-level">Thạc sĩ</span><label className="od-year">Năm tuyển sinh<select aria-label="Năm tuyển sinh" value={year} onChange={(event) => {
        const next = new URLSearchParams(params); next.set("year", event.target.value); setParams(next);
      }}>{years.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    </header>
    {loading ? <div className="od-cards" aria-label="Đang tải tổng quan">{[0, 1, 2, 3].map((key) => <div key={key} className="od-card"><SourceState /></div>)}</div>
      : state.error ? <div className="od-panel od-page-error" role="alert"><WarningAmberOutlined /><span>Không thể tải tổng quan công việc.</span><button type="button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>
        : <>
          {permitted.length > 0 && <section className="od-cards" aria-label="Công việc theo quyền truy cập" style={{ "--od-columns": Math.min(4, permitted.length), "--od-small-columns": Math.min(2, permitted.length) }}>{permitted.map((definition) => <ActionCard key={definition.key} definition={definition}
            source={state.sources[definition.source]} onRetry={() => retry(definition.source)} />)}</section>}
          {!permitted.length && <div className="od-panel od-no-access"><AssignmentOutlined /><div><h2>Chưa có tác vụ được giao</h2><p>Tài khoản hiện chưa có quyền xử lý các hàng đợi công việc này.</p></div></div>}
          {(work.length > 0 || permissions?.progress) && <div className={`od-main${permissions?.progress && work.length ? "" : " od-main-single"}`}>
            {work.length > 0 && <section className="od-panel" aria-labelledby="od-work-title"><div className="od-panel-heading"><h2 id="od-work-title"><AssignmentOutlined aria-hidden="true" />VIỆC CẦN XỬ LÝ</h2><span>Thạc sĩ · {year}</span></div>
              {workHealthy ? <div className="od-empty"><CheckCircleOutline /><strong>Không có mục chờ xử lý</strong><span>Mọi đầu việc trong phạm vi hiện tại đã hoàn thành.</span></div>
                : work.map((definition) => <WorkCategory key={definition.key} definition={definition} source={state.sources[definition.source]} onRetry={() => retry(definition.source)} />)}
            </section>}
            {permissions?.progress && <WarningPanel source={state.sources.teaching} onRetry={() => retry("teaching")} />}
          </div>}
          {permissions?.overview && <section className="od-panel od-overview" aria-labelledby="od-overview-title"><div className="od-panel-heading"><h2 id="od-overview-title">TÌNH HÌNH ĐÀO TẠO</h2><span>Lớp học phần thạc sĩ · {year}</span></div>
            {overview ? <dl>{[["Lớp đang mở", overview.active], ["Đang giảng dạy", overview.inProgress], ["Chưa xếp buổi học", overview.unscheduled], ["Đã hoàn thành", overview.completed]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              : <SourceState source={overviewSource} onRetry={() => retry("teaching")} />}
          </section>}
        </>}
  </div>;
}
