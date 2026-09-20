import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarMonthRounded,
  GridViewRounded,
  LayersRounded,
  PendingActionsRounded,
  SearchRounded,
  TableChartRounded,
  ViewColumnRounded,
} from "@mui/icons-material";
import { api, groupsOf, labelOf, Notice, offeringTitle, rows, subjectLabel, unique, useLoad } from "./shared";
import { getBusinessTodayKey } from "../../utils/schedulingCalendar";
import OfferingDetails from "./OfferingDetails";

const vietnameseNameCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
const COHORT_WINDOW_SIZE = 4;

function scheduleCategory(offering) {
  if (offering.status === "completed") return "completed";
  return (offering.sessionSummary?.totalCount || 0) > 0 ? "scheduled" : "unscheduled";
}

function subjectName(offering) {
  return offering.subject?.name || offering.subject?.code || offeringTitle(offering) || "";
}

function plannedDateDistance(offering, todayKey) {
  const date = offering.sessionSummary?.nextSessionDate
    || offering.sessionSummary?.nearestSessionDate
    || offering.sessionSummary?.firstPlannedSessionDate;
  const dateValue = Date.parse(`${date || ""}T12:00:00Z`);
  const todayValue = Date.parse(`${todayKey}T12:00:00Z`);
  return Number.isFinite(dateValue) && Number.isFinite(todayValue)
    ? Math.abs(dateValue - todayValue)
    : Number.POSITIVE_INFINITY;
}

export function sortCourseOfferings(offerings, todayKey = getBusinessTodayKey()) {
  const rank = { unscheduled: 0, scheduled: 1, completed: 2 };
  return [...offerings].sort((left, right) => {
    const leftCategory = scheduleCategory(left);
    const rightCategory = scheduleCategory(right);
    const categoryOrder = rank[leftCategory] - rank[rightCategory];
    if (categoryOrder !== 0) return categoryOrder;

    if (leftCategory === "scheduled") {
      const dateOrder = plannedDateDistance(left, todayKey) - plannedDateDistance(right, todayKey);
      if (dateOrder !== 0) return dateOrder;
    }

    return vietnameseNameCollator.compare(subjectName(left), subjectName(right));
  });
}

export default function CourseMatrix({ user }) {
  const navigate = useNavigate();
  const [majorId, setMajor] = useState("");
  const [scheduleState, setScheduleState] = useState("all");
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("board"); // "board" | "pivot"
  const [detailOffering, setDetailOffering] = useState(null);

  const canEdit = user.canManageScheduling === true;
  const offerings = useLoad(async () => rows(await api.get("/scheduling/course-offerings?program=masters")), []);
  const majors = useLoad(async () => rows(await api.get("/system/majors?program=masters")), []);

  const all = useMemo(
    () => (offerings.data || []).filter((offering) => offering.status !== "completed"),
    [offerings.data]
  );

  // Filter logic
  const filtered = useLoadOfferings(all, majorId, year, scheduleState, query);

  // Cohorts calculation
  const allCohorts = useMemo(() => {
    return unique(all.flatMap(groupsOf).map((group) => group.academicYear).filter(Boolean))
      .sort((a, b) => b.localeCompare(a, "vi", { numeric: true }));
  }, [all]);

  // KPIs
  const kpis = useMemo(() => {
    let unscheduled = 0;
    let scheduled = 0;
    let crossCohort = 0;

    for (const offering of filtered) {
      const cohorts = unique(groupsOf(offering).map((g) => g.academicYear).filter(Boolean));
      if (cohorts.length > 1) crossCohort++;
      if (scheduleCategory(offering) === "unscheduled") {
        unscheduled++;
      } else {
        scheduled++;
      }
    }
    return {
      total: filtered.length,
      unscheduled,
      scheduled,
      crossCohort,
    };
  }, [filtered]);

  const displayedCohorts = useMemo(() => {
    if (year) return [year];
    return unique(filtered.flatMap(groupsOf).map((group) => group.academicYear).filter(Boolean))
      .sort((a, b) => b.localeCompare(a, "vi", { numeric: true }));
  }, [filtered, year]);

  const openSchedule = (offeringId) => {
    navigate(`/masters/schedule?offeringId=${offeringId}`);
  };

  const refresh = () => {
    offerings.reload();
  };

  return (
    <section className="sl-workspace sl-matrix-workspace" aria-label="Ma trận lớp học phần theo khóa">
      {/* KPI Stats Bar */}
      <div className="sl-matrix-kpi-bar" role="region" aria-label="Chỉ số tổng quan">
        <div className="sl-matrix-kpi">
          <span className="sl-matrix-kpi-icon"><LayersRounded aria-hidden="true" /></span>
          <div><strong>{kpis.total}</strong><span>TỔNG SỐ LỚP HỌC PHẦN</span><small>Trong phạm vi đang lọc</small></div>
        </div>
        <div className={`sl-matrix-kpi ${kpis.unscheduled > 0 ? "kpi-warn" : ""}`}>
          <span className="sl-matrix-kpi-icon"><PendingActionsRounded aria-hidden="true" /></span>
          <div><strong>{kpis.unscheduled}</strong><span>CHƯA XẾP LỊCH</span><small>{kpis.unscheduled > 0 ? "Cần ưu tiên sắp xếp" : "Đã xử lý đầy đủ"}</small></div>
        </div>
        <div className="sl-matrix-kpi kpi-progress">
          <span className="sl-matrix-kpi-icon"><CalendarMonthRounded aria-hidden="true" /></span>
          <div><strong>{kpis.scheduled}</strong><span>ĐANG HỌC / ĐÃ XẾP LỊCH</span><small>Đã có buổi học</small></div>
        </div>
        <div className="sl-matrix-kpi kpi-cross">
          <span className="sl-matrix-kpi-icon"><GridViewRounded aria-hidden="true" /></span>
          <div><strong>{kpis.crossCohort}</strong><span>GHÉP LIÊN KHÓA</span><small>Học chung từ 2 khóa</small></div>
        </div>
      </div>

      {/* Filter and View Switcher Toolbar */}
      <div className="sl-matrix-toolbar">
        <div className="sl-matrix-toolbar-head">
          <div>
            <h2>Bộ lọc dữ liệu</h2>
            <span>Đang hiển thị {filtered.length} / {all.length} lớp học phần</span>
          </div>
          <div className="sl-matrix-view-toggle" aria-label="Kiểu hiển thị">
            <button
              type="button"
              className={viewMode === "board" ? "active" : ""}
              onClick={() => setViewMode("board")}
              aria-pressed={viewMode === "board"}
            >
              <ViewColumnRounded aria-hidden="true" /> Dạng cột theo khóa
            </button>
            <button
              type="button"
              className={viewMode === "pivot" ? "active" : ""}
              onClick={() => setViewMode("pivot")}
              aria-pressed={viewMode === "pivot"}
            >
              <TableChartRounded aria-hidden="true" /> Bảng ma trận môn
            </button>
          </div>
        </div>
        <div className="sl-matrix-filters">
          <div className="sl-matrix-filter-item sl-matrix-search-item">
            <label htmlFor="matrix-search-input">Tìm kiếm</label>
            <div className="sl-matrix-search-wrap">
              <SearchRounded aria-hidden="true" />
              <input
                id="matrix-search-input"
                className="sl-search-input"
                placeholder="Tên lớp, mã môn hoặc học phần..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="sl-matrix-filter-item">
            <label htmlFor="matrix-major-filter">Chuyên ngành</label>
            <select
              id="matrix-major-filter"
              className="sl-select"
              value={majorId}
              onChange={(e) => setMajor(e.target.value)}
            >
              <option value="">Tất cả chuyên ngành</option>
              {(majors.data || []).map((major) => (
                <option key={major.id} value={major.id}>
                  {major.name}{major.code ? ` (${major.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="sl-matrix-filter-item">
            <label htmlFor="matrix-year-filter">Khóa / năm học</label>
            <select
              id="matrix-year-filter"
              className="sl-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">Tất cả khóa</option>
              {allCohorts.map((cohort) => <option key={cohort} value={cohort}>Khóa {cohort}</option>)}
            </select>
          </div>

          <div className="sl-matrix-filter-item">
            <label htmlFor="matrix-status-filter">Tình trạng lịch</label>
            <select
              id="matrix-status-filter"
              className="sl-select"
              value={scheduleState}
              onChange={(e) => setScheduleState(e.target.value)}
            >
              <option value="all">Tất cả tình trạng</option>
              <option value="scheduled">Đã xếp lịch</option>
              <option value="unscheduled">Chưa xếp lịch</option>
            </select>
          </div>
        </div>
      </div>

      <div className="sl-matrix-content">
        <div className="sl-matrix-content-head">
          <div>
            <h2>{viewMode === "board" ? "Lớp học phần theo khóa" : "Đối chiếu học phần giữa các khóa"}</h2>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="sl-matrix-body">
          {offerings.loading ? (
            <Notice>Đang tải dữ liệu lớp học phần...</Notice>
          ) : offerings.error ? (
            <Notice error={offerings.error} />
          ) : filtered.length === 0 && (viewMode === "board" || all.length === 0) ? (
            <Notice>Không tìm thấy lớp học phần phù hợp với bộ lọc hiện tại.</Notice>
          ) : viewMode === "board" ? (
            <div className="sl-matrix-board">
              {displayedCohorts.map((cohort) => {
                const cohortOfferings = filtered.filter((offering) =>
                  groupsOf(offering).some((group) => group.academicYear === cohort)
                );
                return (
                  <CohortColumn
                    key={cohort}
                    cohortYear={cohort}
                    title={`Khóa ${cohort}`}
                    subtitle={`${cohortOfferings.length} lớp học phần`}
                    offerings={cohortOfferings}
                    canEdit={canEdit}
                    fourColumns={Boolean(year)}
                    onSelectOffering={openSchedule}
                    onViewDetails={setDetailOffering}
                  />
                );
              })}
            </div>
          ) : (
            <PivotMatrixView
              key={`${year}|${allCohorts.join("|")}`}
              offerings={filtered}
              cohorts={allCohorts}
              selectedYear={year}
              canEdit={canEdit}
              onSelectOffering={openSchedule}
              onViewDetails={setDetailOffering}
            />
          )}
        </div>
      </div>

      {/* Offering Details Drawer Modal */}
      {detailOffering && (
        <OfferingDetails
          offering={detailOffering}
          user={user}
          onClose={() => setDetailOffering(null)}
          onSaved={refresh}
          onSelect={(item) => openSchedule(item.id)}
        />
      )}
    </section>
  );
}

// Sub-component: Column for a single Cohort
function CohortColumn({ title, subtitle, offerings, canEdit, fourColumns, onSelectOffering, onViewDetails }) {
  const orderedOfferings = sortCourseOfferings(offerings);
  return (
    <div className="sl-matrix-col" role="region" aria-label={title}>
      <div className="sl-matrix-col-header">
        <div>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
        <b className="sl-matrix-col-badge">{offerings.length}</b>
      </div>

      <div className={`sl-matrix-col-cards ${fourColumns ? "sl-matrix-col-cards-four" : ""}`}>
        {offerings.length === 0 ? (
          <div className="sl-matrix-empty-col">Không có lớp học phần nào</div>
        ) : (
          orderedOfferings.map((offering) => (
            <OfferingCard
              key={offering.id}
              offering={offering}
              canEdit={canEdit}
              onSelectOffering={onSelectOffering}
              onViewDetails={onViewDetails}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Sub-component: Card for an offering in the matrix
function OfferingCard({ offering, canEdit, onSelectOffering, onViewDetails }) {
  const groups = groupsOf(offering);
  const cohorts = unique(groups.map((g) => g.academicYear).filter(Boolean));

  return (
    <article className={`sl-matrix-card card-${scheduleCategory(offering)}`}>
      <button
        type="button"
        className="sl-matrix-card-detail-trigger"
        onClick={() => onViewDetails(offering)}
        aria-label={`Xem chi tiết ${offeringTitle(offering)}`}
        title="Bấm để xem chi tiết"
      />
      <div className="sl-matrix-card-title-row">
        <strong className="sl-matrix-card-title" title={offeringTitle(offering)}>
          {offeringTitle(offering)}
        </strong>
        <OfferingStatus offering={offering} />
      </div>
      <div className="sl-matrix-card-subject" title={subjectLabel(offering)}>
        {subjectLabel(offering)}
      </div>
      {(cohorts.length > 1 || offering.subject?.subjectType === "KC" || offering.subject?.allowCrossMajor) && (
        <div className="sl-matrix-card-tags">
          {(offering.subject?.subjectType === "KC" || offering.subject?.allowCrossMajor) && (
            <span className="sl-matrix-common-tag" title="Học phần dùng chung cấp Viện">Môn chung</span>
          )}
          <CrossCohortBadge cohorts={cohorts} />
        </div>
      )}
      <div className="sl-matrix-card-meta">
        <span>{groups.length} lớp/nhóm · {offering.participantCount ?? 0} HV</span>
        {canEdit && offering.status === "active" && (
          <button
            type="button"
            className="sl-matrix-schedule-link"
            onClick={() => onSelectOffering(offering.id)}
          >
            Xếp lịch →
          </button>
        )}
      </div>
    </article>
  );
}

function OfferingStatus({ offering }) {
  const category = scheduleCategory(offering);
  return (
    <span className={`sl-matrix-status status-${category}`}>
      {category === "completed" ? <><span aria-hidden="true">✓</span> Hoàn thành</>
        : category === "unscheduled" ? <><span aria-hidden="true">●</span> Chưa xếp lịch</>
          : `${offering.sessionSummary.totalCount} buổi`}
    </span>
  );
}

function CrossCohortBadge({ cohorts }) {
  if (cohorts.length <= 1) return null;
  const label = [...cohorts].sort((a, b) => b.localeCompare(a, "vi", { numeric: true })).join(" · ");
  return <span className="sl-matrix-cross-tag" title={`Một lớp học phần ghép các khóa: ${label}`}>GHÉP {label}</span>;
}

// Sub-component: Pivot Matrix View (Subjects x Cohorts)
function PivotMatrixView({ offerings, cohorts, selectedYear, canEdit, onSelectOffering, onViewDetails }) {
  // Anchor to unfiltered, known years; missing years remain empty comparison columns.
  // Reset only when the source years or explicit year selection change.
  const [windowStart, setWindowStart] = useState(0);
  const knownYears = cohorts.filter((year) => /^[1-9]\d{3}$/.test(year)).map(Number);
  const newestYear = knownYears.length ? Math.max(...knownYears) : null;
  const oldestYear = knownYears.length ? Math.min(...knownYears) : null;
  const lastStart = selectedYear || newestYear === null ? 0
    : Math.max(0, newestYear - oldestYear - (COHORT_WINDOW_SIZE - 1));
  const visibleCohorts = selectedYear ? [selectedYear] : newestYear === null ? []
    : Array.from({ length: COHORT_WINDOW_SIZE }, (_, index) => String(newestYear - windowStart - index));

  if (visibleCohorts.length === 0) {
    return <Notice>Chưa có khóa / năm học dạng năm hợp lệ để hiển thị ma trận.</Notice>;
  }

  // Extract distinct subjects
  const subjectsMap = new Map();
  for (const offering of offerings) {
    if (offering.subject && !subjectsMap.has(offering.subject.id)) {
      subjectsMap.set(offering.subject.id, offering.subject);
    }
  }
  const subjects = [...subjectsMap.values()].sort((a, b) =>
    (a.code || "").localeCompare(b.code || "", "vi")
  );
  const pivotMinWidth = 240 + 48 + (selectedYear ? 660 : visibleCohorts.length * 210);

  return (
    <div className="sl-matrix-pivot">
      {lastStart > 0 && (
        <div className="sl-matrix-cohort-window" role="group" aria-label="Chuyển khoảng khóa">
          {windowStart > 0 && (
            <button type="button" aria-label="Xem khóa mới hơn"
              onClick={() => setWindowStart((start) => Math.max(0, start - 1))}>‹</button>
          )}
          <span aria-live="polite">Khóa {visibleCohorts[0]} – {visibleCohorts[visibleCohorts.length - 1]}</span>
          {windowStart < lastStart && (
            <button type="button" aria-label="Xem khóa cũ hơn"
              onClick={() => setWindowStart((start) => Math.min(lastStart, start + 1))}>›</button>
          )}
        </div>
      )}
      <div className="sl-matrix-pivot-wrap">
        <table className={`sl-matrix-pivot-table ${selectedYear ? "sl-matrix-pivot-table-selected-year" : ""}`} aria-label="Ma trận học phần theo khóa" style={{ minWidth: `${pivotMinWidth}px` }}>
          <colgroup>
            <col className="sl-pivot-subj-track" />
            <col className="sl-pivot-credits-track" />
            {visibleCohorts.map((cohort) => (
              <col key={cohort} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sl-pivot-subj-col">HỌC PHẦN</th>
              <th scope="col" className="sl-pivot-credits-col">TC</th>
              {visibleCohorts.map((cohort) => (
                <th scope="col" key={cohort} className="sl-pivot-cohort-col">
                  KHÓA {cohort}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 && (
              <tr><td colSpan={visibleCohorts.length + 2}>
                <Notice>Không tìm thấy lớp học phần phù hợp với bộ lọc hiện tại.</Notice>
              </td></tr>
            )}
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="sl-pivot-subj-cell">
                  <div className="sl-pivot-subject-code">
                    <strong>{subject.code}</strong>
                    {(subject.subjectType === "KC" || subject.allowCrossMajor) && (
                      <span className="sl-matrix-common-tag">
                        Môn chung
                      </span>
                    )}
                  </div>
                  <span>{subject.name}</span>
                </td>
                <td className="sl-pivot-credits-cell">
                  {subject.credits ?? subject.creditCount ?? 3}
                </td>
                {visibleCohorts.map((cohort) => {
                  const cellOfferings = offerings.filter(
                    (o) =>
                      o.subjectId === subject.id &&
                      groupsOf(o).some((g) => g.academicYear === cohort)
                  );
                  return (
                    <td key={cohort} className="sl-pivot-cell">
                      {cellOfferings.length === 0 ? (
                        <span className="sl-pivot-empty">—</span>
                      ) : (
                        <div className="sl-pivot-cell-offerings">
                          {cellOfferings.map((offering) => {
                            const summary = offering.sessionSummary || {};
                            const total = summary.totalCount || 0;
                            const groups = groupsOf(offering);
                            const linkedCohorts = unique(groups.map((group) => group.academicYear).filter(Boolean));
                            const linkedGroupLabel = groups
                              .map((group) => group.code || group.name)
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <div
                                key={offering.id}
                                className={`sl-pivot-mini-card ${selectedYear ? "sl-pivot-mini-card-wide" : ""}`}
                                role={selectedYear ? "group" : undefined}
                                aria-label={selectedYear ? `Bản ghi ${offeringTitle(offering)}` : undefined}
                              >
                                <button
                                  type="button"
                                  className="sl-pivot-card-detail-trigger"
                                  onClick={() => onViewDetails(offering)}
                                  aria-label={`Xem chi tiết ${offeringTitle(offering)}`}
                                  title="Bấm để xem chi tiết"
                                />
                                <strong className="sl-pivot-card-title" title={offeringTitle(offering)}>
                                  {offeringTitle(offering)}
                                </strong>
                                {selectedYear && (
                                  <span className="sl-pivot-card-groups" title={linkedGroupLabel || "Chưa có lớp/nhóm"}>
                                    {linkedGroupLabel || "Chưa có lớp/nhóm"}
                                  </span>
                                )}
                                <span className="sl-pivot-card-meta">{groups.length} lớp/nhóm · {offering.participantCount ?? 0} HV</span>
                                <CrossCohortBadge cohorts={linkedCohorts} />
                                <div className="sl-pivot-card-stats">
                                  <OfferingStatus offering={offering} />
                                  {canEdit && offering.status === "active" && (
                                    <button
                                      type="button"
                                      className="sl-pivot-schedule-btn sl-matrix-schedule-link"
                                      onClick={() => onSelectOffering(offering.id)}
                                    >
                                      {total ? "Xếp thêm →" : "Xếp lịch →"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Hook helper for filtering offerings
function useLoadOfferings(all, majorId, year, scheduleState, query) {
  return useMemo(() => {
    return all.filter((offering) => {
      const groups = groupsOf(offering);
      const matchesMajor = !majorId || groups.some((g) => (g.majorId || g.major?.id) === majorId);
      const matchesYear = !year || groups.some((g) => g.academicYear === year);
      const matchesScheduleState = scheduleState === "all" || scheduleCategory(offering) === scheduleState;
      const searchStr = `${offering.name || ""} ${offering.subject?.code || ""} ${offering.subject?.name || ""} ${labelOf(offering)}`.toLowerCase();
      const matchesQuery = !query.trim() || searchStr.includes(query.trim().toLowerCase());
      return matchesMajor && matchesYear && matchesScheduleState && matchesQuery;
    });
  }, [all, majorId, year, scheduleState, query]);
}

