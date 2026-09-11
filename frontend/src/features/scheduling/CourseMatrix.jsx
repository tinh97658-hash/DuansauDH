import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, groupsOf, labelOf, Notice, offeringTitle, rows, SearchSelect, subjectLabel, unique, useLoad } from "./shared";
import OfferingDetails from "./OfferingDetails";

export default function CourseMatrix({ user }) {
  const navigate = useNavigate();
  const [majorId, setMajor] = useState("");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [viewMode, setViewMode] = useState("board"); // "board" | "pivot"
  const [detailOffering, setDetailOffering] = useState(null);

  const canEdit = user.canManageScheduling === true;
  const offerings = useLoad(async () => rows(await api.get("/scheduling/course-offerings?program=masters")), []);
  const majors = useLoad(async () => rows(await api.get("/system/majors?program=masters")), []);

  const all = useMemo(() => offerings.data || [], [offerings.data]);

  // Filter logic
  const filtered = useLoadOfferings(all, majorId, status, query);

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
      const summary = offering.sessionSummary || {};
      const cohorts = unique(groupsOf(offering).map((g) => g.academicYear).filter(Boolean));
      if (cohorts.length > 1) crossCohort++;
      if (offering.status === "completed") {
        completed++;
      } else if (!summary.totalCount) {
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
    if (cohortFilter === "all") return allCohorts;
    if (cohortFilter === "cross") return [];
    return allCohorts.filter((c) => c === cohortFilter);
  }, [allCohorts, cohortFilter]);

  const crossCohortOfferings = useMemo(() => {
    return filtered.filter((offering) => {
      const cohorts = unique(groupsOf(offering).map((g) => g.academicYear).filter(Boolean));
      return cohorts.length > 1;
    });
  }, [filtered]);

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
        <div className="sl-matrix-title-wrap">
          <div className="sl-eyebrow">TỔNG QUAN ĐÀO TẠO & LỊCH HỌC</div>
          <h1>MA TRẬN LỚP HỌC PHẦN THEO KHÓA</h1>
        </div>
        <div className="sl-matrix-top-actions">
          <button
            type="button"
            className="sl-btn sl-btn-secondary"
            onClick={() => navigate("/masters/schedule")}
          >
            📅 Sang Lịch biểu tuần
          </button>
          {canEdit && (
            <button
              type="button"
              className="sl-btn sl-btn-primary"
              onClick={() => navigate("/masters/course-offerings")}
            >
              + Tạo lớp học phần mới
            </button>
          )}
        </div>
      </header>

      {/* KPI Stats Bar */}
      <div className="sl-matrix-kpi-bar" role="region" aria-label="Chỉ số tổng quan">
        <div className="sl-matrix-kpi">
          <span>TỔNG SỐ LỚP HỌC PHẦN</span>
          <strong>{kpis.total}</strong>
        </div>
        <div className={`sl-matrix-kpi ${kpis.unscheduled > 0 ? "kpi-warn" : ""}`}>
          <span>CHƯA XẾP LỊCH</span>
          <strong>{kpis.unscheduled}</strong>
          {kpis.unscheduled > 0 && <small>Cần ưu tiên sắp xếp lịch</small>}
        </div>
        <div className="sl-matrix-kpi kpi-progress">
          <span>ĐANG HỌC / ĐÃ XẾP LỊCH</span>
          <strong>{kpis.scheduled}</strong>
          <small>Đang diễn ra hoặc có lịch tuần tới</small>
        </div>
        <div className="sl-matrix-kpi">
          <span>ĐÃ HOÀN THÀNH</span>
          <strong>{kpis.completed}</strong>
        </div>
        <div className="sl-matrix-kpi kpi-cross">
          <span>GHÉP LIÊN KHÓA</span>
          <strong>{kpis.crossCohort}</strong>
          <small>Lớp học chung 2 khóa trở lên</small>
        </div>
      </div>

      {/* Filter and View Switcher Toolbar */}
      <div className="sl-matrix-toolbar">
        <div className="sl-matrix-filters">
          <div className="sl-matrix-filter-item">
            <label htmlFor="matrix-major-filter">Chuyên ngành</label>
            <SearchSelect
              id="matrix-major-filter"
              label="Chuyên ngành"
              value={majorId}
              placeholder="Tất cả chuyên ngành"
              options={[{ id: "", name: "Tất cả chuyên ngành" }, ...(majors.data || [])]}
              onChange={setMajor}
            />
          </div>

          <div className="sl-matrix-filter-item">
            <label htmlFor="matrix-status-filter">Trạng thái</label>
            <select
              id="matrix-status-filter"
              className="sl-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang mở (chưa hoàn thành)</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>

          <div className="sl-matrix-filter-item sl-matrix-search-item">
            <label htmlFor="matrix-search-input">Tìm kiếm</label>
            <input
              id="matrix-search-input"
              className="sl-search-input"
              placeholder="Tìm theo tên lớp, mã môn, học phần..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="sl-matrix-view-toggle">
          <button
            type="button"
            className={viewMode === "board" ? "active" : ""}
            onClick={() => setViewMode("board")}
            aria-pressed={viewMode === "board"}
          >
            🗂️ Dạng cột theo khóa
          </button>
          <button
            type="button"
            className={viewMode === "pivot" ? "active" : ""}
            onClick={() => setViewMode("pivot")}
            aria-pressed={viewMode === "pivot"}
          >
            📊 Bảng ma trận môn
          </button>
        </div>
      </div>

      {/* Cohort Quick Filter Tabs (When in Board View) */}
      {viewMode === "board" && (
        <div className="sl-matrix-cohort-tabs" role="tablist" aria-label="Bộ lọc khóa nhanh">
          <button
            type="button"
            className={cohortFilter === "all" ? "active" : ""}
            onClick={() => setCohortFilter("all")}
          >
            Tất cả các khóa ({allCohorts.length})
          </button>
          {allCohorts.map((cohort) => {
            const count = filtered.filter((o) =>
              groupsOf(o).some((g) => g.academicYear === cohort)
            ).length;
            return (
              <button
                key={cohort}
                type="button"
                className={cohortFilter === cohort ? "active" : ""}
                onClick={() => setCohortFilter(cohort)}
              >
                Khóa {cohort} ({count})
              </button>
            );
          })}
          {kpis.crossCohort > 0 && (
            <button
              type="button"
              className={`sl-tab-cross ${cohortFilter === "cross" ? "active" : ""}`}
              onClick={() => setCohortFilter("cross")}
            >
              Chỉ lớp ghép đa khóa ({crossCohortOfferings.length})
            </button>
          )}
        </div>
      )}

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
            {cohortFilter === "cross" ? (
              <CohortColumn
                title="Lớp ghép đa khóa"
                subtitle="Các lớp học phần có học viên từ 2 khóa trở lên"
                offerings={crossCohortOfferings}
                canEdit={canEdit}
                onSelectOffering={openSchedule}
                onViewDetails={setDetailOffering}
              />
            ) : (
              displayedCohorts.map((cohort) => {
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
              })
            )}
          </div>
        ) : (
          <PivotMatrixView
            offerings={filtered}
            cohorts={allCohorts}
            canEdit={canEdit}
            onSelectOffering={openSchedule}
            onViewDetails={setDetailOffering}
          />
        )}
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
          offerings.map((offering) => (
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
    <article className={`sl-matrix-card ${offering.status === "completed" ? "card-completed" : ""}`}>
      <div className="sl-matrix-card-top">
        <div className="sl-matrix-card-title-row">
          <strong className="sl-matrix-card-title" title={offeringTitle(offering)}>
            {offeringTitle(offering)}
          </strong>
          {(offering.subject?.subjectType === "KC" || offering.subject?.allowCrossMajor) && (
            <span className="sl-matrix-cross-tag" style={{ background: "#F3E5F5", color: "#7B1FA2", borderColor: "#CE93D8" }} title="Học phần dùng chung cấp Viện">
              Môn chung
            </span>
          )}
          {isCrossCohort && (
            <span className="sl-matrix-cross-tag" title={`Ghép giữa: ${cohorts.join(", ")}`}>
              Ghép đa khóa
            </span>
          )}
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
          Chi tiết
        </button>
        {canEdit && offering.status === "active" && (
          <button
            type="button"
            className="sl-btn sl-btn-primary sl-btn-sm"
            onClick={() => onSelectOffering(offering.id)}
          >
            🗓️ Xếp lịch
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
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong>{subject.code}</strong>
                  {(subject.subjectType === "KC" || subject.allowCrossMajor) && (
                    <span style={{ fontSize: "10px", background: "#F3E5F5", color: "#7B1FA2", padding: "1px 5px", borderRadius: "3px", fontWeight: 700 }}>
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
function useLoadOfferings(all, majorId, status, query) {
  return useMemo(() => {
    return all.filter((offering) => {
      const groups = groupsOf(offering);
      const matchesMajor = !majorId || groups.some((g) => (g.majorId || g.major?.id) === majorId);
      const matchesStatus = status === "all" || offering.status === status;
      const searchStr = `${offering.name || ""} ${offering.subject?.code || ""} ${offering.subject?.name || ""} ${labelOf(offering)}`.toLowerCase();
      const matchesQuery = !query.trim() || searchStr.includes(query.trim().toLowerCase());
      return matchesMajor && matchesStatus && matchesQuery;
    });
  }, [all, majorId, status, query]);
}

