import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddRounded,
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
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

  const all = useMemo(() => offerings.data || [], [offerings.data]);

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
    let completed = 0;
    let crossCohort = 0;

    for (const offering of filtered) {
      const cohorts = unique(groupsOf(offering).map((g) => g.academicYear).filter(Boolean));
      if (cohorts.length > 1) crossCohort++;
      if (scheduleCategory(offering) === "completed") {
        completed++;
      } else if (scheduleCategory(offering) === "unscheduled") {
        unscheduled++;
      } else {
        scheduled++;
      }
    }
    return {
      total: filtered.length,
      unscheduled,
      scheduled,
      completed,
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
      {/* Top Header */}
      <header className="sl-matrix-header">
        <div className="sl-matrix-top-actions">
          <button
            type="button"
            className="sl-btn sl-btn-secondary"
            onClick={() => navigate("/masters/schedule")}
          >
            <CalendarMonthRounded aria-hidden="true" /> Lịch biểu tuần
          </button>
          {canEdit && (
            <button
              type="button"
              className="sl-btn sl-btn-primary"
              onClick={() => navigate("/masters/course-offerings")}
            >
              <AddRounded aria-hidden="true" /> Tạo lớp học phần
            </button>
          )}
        </div>
      </header>

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
        <div className="sl-matrix-kpi kpi-complete">
          <span className="sl-matrix-kpi-icon"><CheckCircleOutlineRounded aria-hidden="true" /></span>
          <div><strong>{kpis.completed}</strong><span>ĐÃ HOÀN THÀNH</span><small>Đã kết thúc học phần</small></div>
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
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>
        </div>
      </div>

      <div className="sl-matrix-content">
        <div className="sl-matrix-content-head">
          <div>
            <h2>{viewMode === "board" ? "Lớp học phần theo khóa" : "Đối chiếu học phần giữa các khóa"}</h2>
            <p>{viewMode === "board" ? (year ? `Danh sách lớp học phần của khóa ${year}.` : "Các khóa được tách thành từng nhóm độc lập.") : "Theo dõi nhanh học phần đã mở và tình trạng lịch ở từng khóa."}</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="sl-matrix-body">
          {offerings.loading ? (
            <Notice>Đang tải dữ liệu lớp học phần...</Notice>
          ) : offerings.error ? (
            <Notice error={offerings.error} />
          ) : filtered.length === 0 ? (
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
                    onSelectOffering={openSchedule}
                    onViewDetails={setDetailOffering}
                  />
                );
              })}
            </div>
          ) : (
            <PivotMatrixView
              offerings={filtered}
              cohorts={displayedCohorts}
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
function CohortColumn({ title, subtitle, offerings, canEdit, onSelectOffering, onViewDetails }) {
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

      <div className="sl-matrix-col-cards">
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
  const summary = offering.sessionSummary || {};
  const groups = groupsOf(offering);
  const cohorts = unique(groups.map((g) => g.academicYear).filter(Boolean));
  const isCrossCohort = cohorts.length > 1;

  const totalSessions = summary.totalCount || 0;
  const heldSessions = summary.heldCount || 0;
  const futureSessions = summary.futurePlannedCount || 0;

  return (
    <article className={`sl-matrix-card ${offering.status === "completed" ? "card-completed" : totalSessions === 0 ? "card-unscheduled" : "card-scheduled"}`}>
      <div className="sl-matrix-card-top">
        <div className="sl-matrix-card-title-row">
          <strong className="sl-matrix-card-title" title={offeringTitle(offering)}>
            {offeringTitle(offering)}
          </strong>
          <div className="sl-matrix-card-tags">
            {(offering.subject?.subjectType === "KC" || offering.subject?.allowCrossMajor) && (
              <span className="sl-matrix-cross-tag sl-matrix-common-tag" title="Học phần dùng chung cấp Viện">
                Môn chung
              </span>
            )}
            {isCrossCohort && (
              <span className="sl-matrix-cross-tag" title={`Ghép giữa: ${cohorts.join(", ")}`}>
                Đa khóa
              </span>
            )}
          </div>
        </div>
        <div className="sl-matrix-card-subject">
          {subjectLabel(offering)}
        </div>
        <div className="sl-matrix-card-meta">
          <span>{groups.length} lớp/nhóm ({offering.participantCount ?? 0} HV)</span>
          {offering.status === "completed" && <span className="sl-status-done">Đã hoàn thành</span>}
        </div>
      </div>

      <div className="sl-matrix-card-schedule-info">
        {totalSessions === 0 ? (
          <div className="sl-matrix-schedule-status status-empty">
            <span className="dot dot-warn" />
            <span>Chưa xếp lịch học nào</span>
          </div>
        ) : (
          <div className="sl-matrix-schedule-status status-active">
            <span className="dot dot-green" />
            <span>
              Đã xếp <strong>{totalSessions}</strong> buổi
              {heldSessions > 0 && ` (${heldSessions} đã học)`}
              {futureSessions > 0 && ` · ${futureSessions} sắp tới`}
            </span>
          </div>
        )}
      </div>

      <div className="sl-matrix-card-actions">
        <button
          type="button"
          className="sl-btn sl-btn-sm"
          onClick={() => onViewDetails(offering)}
        >
          Xem chi tiết
        </button>
        {canEdit && offering.status === "active" && (
          <button
            type="button"
            className="sl-btn sl-btn-primary sl-btn-sm"
            onClick={() => onSelectOffering(offering.id)}
          >
            <CalendarMonthRounded aria-hidden="true" /> Xếp lịch
          </button>
        )}
      </div>
    </article>
  );
}

// Sub-component: Pivot Matrix View (Subjects x Cohorts)
function PivotMatrixView({ offerings, cohorts, canEdit, onSelectOffering, onViewDetails }) {
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

  return (
    <div className="sl-matrix-pivot-wrap">
      <table className="sl-matrix-pivot-table">
        <thead>
          <tr>
            <th className="sl-pivot-subj-col">HỌC PHẦN</th>
            <th className="sl-pivot-credits-col">TC</th>
            {cohorts.map((cohort) => (
              <th key={cohort} className="sl-pivot-cohort-col">
                KHÓA {cohort}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id}>
              <td className="sl-pivot-subj-cell">
                <div className="sl-pivot-subject-code">
                  <strong>{subject.code}</strong>
                  {(subject.subjectType === "KC" || subject.allowCrossMajor) && (
                    <span className="sl-matrix-cross-tag sl-matrix-common-tag">
                      Môn chung
                    </span>
                  )}
                </div>
                <span>{subject.name}</span>
              </td>
              <td className="sl-pivot-credits-cell">
                {subject.credits ?? subject.creditCount ?? 3}
              </td>
              {cohorts.map((cohort) => {
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
                          return (
                            <div key={offering.id} className="sl-pivot-mini-card">
                              <button
                                type="button"
                                className="sl-pivot-card-title-btn"
                                onClick={() => onViewDetails(offering)}
                                title="Bấm để xem chi tiết"
                              >
                                {offeringTitle(offering)}
                              </button>
                              <div className="sl-pivot-card-stats">
                                <span className={total ? "has-sessions" : "no-sessions"}>
                                  {total ? `${total} buổi` : "Chưa có lịch"}
                                </span>
                                {canEdit && offering.status === "active" && (
                                  <button
                                    type="button"
                                    className="sl-pivot-schedule-btn"
                                    onClick={() => onSelectOffering(offering.id)}
                                  >
                                    Xếp lịch →
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

