import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, CircularProgress } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";
import { isSessionPast, vietnameseDate } from "../../utils/schedulingCalendar";
import "./classCourseHistory.css";

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
const statusInfo = {
  completed: { label: "Hoàn thành", tone: "green" },
  in_progress: { label: "Đang học", tone: "orange" },
  scheduled: { label: "Đã xếp lịch", tone: "blue" },
  not_started: { label: "Chưa tổ chức", tone: "gray" },
};
const sessionInfo = {
  held: { label: "Đã diễn ra", tone: "green" },
  pending: { label: "Chờ xác nhận", tone: "orange" },
  future: { label: "Sắp tới", tone: "blue" },
  not_held: { label: "Không diễn ra", tone: "red" },
};
const sessionCategory = (session) => {
  if (session.status === "held") return "held";
  if (session.status === "not_held") return "not_held";
  return isSessionPast(session) ? "pending" : "future";
};
const periodLabel = (period) => period === "MORNING" ? "Sáng" : "Chiều";

function SelectFilter({ label, value, onChange, children, disabled }) {
  return <label className="tp-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></label>;
}

function StatusBadge({ status }) {
  const info = statusInfo[status] || statusInfo.not_started;
  return <span className={`tp-status tp-${info.tone}`}>{info.label}</span>;
}

export default function ClassCourseHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [majors, setMajors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [majorId, setMajorId] = useState(searchParams.get("majorId") || "");
  const [academicYear, setAcademicYear] = useState(searchParams.get("year") || "");
  const [classId, setClassId] = useState(searchParams.get("groupId") || "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [report, setReport] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [classWindowStart, setClassWindowStart] = useState(0);
  const drawerCloseRef = useRef(null);
  const drawerTriggerRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API_BASE_URL}/system/majors?program=masters`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/plan/classes?program=masters`, { withCredentials: true }),
    ]).then(([majorResponse, groupResponse]) => {
      if (!active) return;
      setMajors(asList(majorResponse.data));
      setGroups(asList(groupResponse.data).filter((group) => group.groupType !== "NON_ADMINISTRATIVE"));
      setError("");
    }).catch(() => active && setError("Không thể tải danh mục ngành và lớp."))
      .finally(() => active && setLoadingCatalog(false));
    return () => { active = false; };
  }, []);

  const visibleMajors = useMemo(() => majors.filter((major) => groups.some((group) => group.majorId === major.id)), [groups, majors]);
  const years = useMemo(() => [...new Set(groups.filter((group) => group.majorId === majorId).map((group) => group.academicYear).filter(Boolean))].sort().reverse(), [groups, majorId]);

  useEffect(() => {
    if (!majorId || !academicYear || !years.includes(academicYear)) {
      setReport(null);
      setLoadingReport(false);
      return undefined;
    }
    let active = true;
    setReport(null);
    setLoadingReport(true);
    setError("");
    axios.get(`${API_BASE_URL}/scheduling/class-curriculum-progress`, {
      params: { majorId, academicYear }, withCredentials: true,
    }).then(({ data }) => active && setReport(data))
      .catch(() => active && setError("Không thể tải dữ liệu theo dõi tiến độ."))
      .finally(() => active && setLoadingReport(false));
    return () => { active = false; };
  }, [academicYear, majorId, years]);

  useEffect(() => {
    if (report && !report.classes.some((classGroup) => classGroup.id === classId)) setClassId(report.classes[0]?.id || "");
  }, [classId, report]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (majorId) next.set("majorId", majorId);
    if (academicYear) next.set("year", academicYear);
    if (classId) next.set("groupId", classId);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [academicYear, classId, majorId, searchParams, setSearchParams]);

  const currentClass = report?.classes.find((classGroup) => classGroup.id === classId);
  const visibleSubjects = useMemo(() => (currentClass?.subjects || []).filter((subject) => {
    if (status !== "all" && subject.status !== status) return false;
    const lecturers = (subject.sessions || []).map((session) => session.lecturer?.name || "").join(" ");
    const haystack = `${subject.code || ""} ${subject.name} ${lecturers}`;
    return !search.trim() || normalize(haystack).includes(normalize(search));
  }), [currentClass, search, status]);

  const classes = report?.classes || [];
  const windowStart = Math.min(classWindowStart, Math.max(0, classes.length - 4));
  const visibleClasses = classes.slice(windowStart, windowStart + 4);
  const selectedSubject = currentClass?.subjects.find((subject) => subject.curriculumSubjectId === selectedSubjectId);
  const sessionSummary = useMemo(() => (selectedSubject?.sessions || []).reduce((summary, session) => {
    const category = sessionCategory(session);
    if (category !== "not_held") summary[category] += 1;
    return summary;
  }, { held: 0, pending: 0, future: 0 }), [selectedSubject]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.setTimeout(() => {
      if (drawerTriggerRef.current && document.contains(drawerTriggerRef.current)) drawerTriggerRef.current.focus();
    }, 0);
  }, []);

  const openSubject = (subjectId, trigger) => {
    drawerTriggerRef.current = trigger;
    setSelectedSubjectId(subjectId);
    setDrawerOpen(true);
  };

  // Reconcile the window when the scope/selection changes, not when arrows are used.
  useEffect(() => {
    const index = report?.classes.findIndex((group) => group.id === classId) ?? -1;
    const maxStart = Math.max(0, (report?.classes.length || 0) - 4);
    setClassWindowStart((start) => {
      const clamped = Math.min(start, maxStart);
      if (index < 0) return 0;
      if (index < clamped) return index;
      if (index >= clamped + 4) return Math.min(index - 3, maxStart);
      return clamped;
    });
    setSelectedSubjectId("");
    setDrawerOpen(false);
  }, [classId, report]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    if (visibleSubjects.some((subject) => subject.curriculumSubjectId === selectedSubjectId)) return;
    setSelectedSubjectId("");
    setDrawerOpen(false);
  }, [selectedSubjectId, visibleSubjects]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    drawerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  const resetFilters = () => {
    setMajorId(""); setAcademicYear(""); setClassId("");
    setStatus("all"); setSearch(""); setSelectedSubjectId(""); setDrawerOpen(false); setClassWindowStart(0);
  };
  return <FeatureLayout title="Theo dõi tiến độ">
    <div className="tp-page">
      <section className="tp-filters" aria-label="Bộ lọc tiến độ">
        <SelectFilter label="Chuyên ngành" value={majorId} onChange={(value) => { setMajorId(value); setAcademicYear(""); setClassId(""); setSelectedSubjectId(""); setDrawerOpen(false); }} disabled={loadingCatalog}>
          <option value="">Chọn chuyên ngành</option>
          {visibleMajors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </SelectFilter>
        <SelectFilter label="Khóa / năm học" value={academicYear} onChange={(value) => { setAcademicYear(value); setClassId(""); setSelectedSubjectId(""); setDrawerOpen(false); }} disabled={!years.length}>
          <option value="">Chọn khóa / năm học</option>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </SelectFilter>
        <SelectFilter label="Trạng thái" value={status} onChange={setStatus}>
          <option value="all">Tất cả</option>
          {Object.entries(statusInfo).map(([value, info]) => <option value={value} key={value}>{info.label}</option>)}
        </SelectFilter>
        <label className="tp-filter"><span>Tìm kiếm</span><div className="tp-search"><SearchRounded /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, học phần, giảng viên..." /></div></label>
      </section>

      {error && <Alert severity="error">{error}</Alert>}
      {(loadingCatalog || loadingReport) && <Box className="tp-loading"><CircularProgress size={30} /></Box>}
      {!loadingCatalog && !majorId && <Alert severity="info">Vui lòng chọn chuyên ngành và khóa / năm học để xem tiến độ.</Alert>}
      {!loadingCatalog && majorId && !academicYear && <Alert severity="info">Vui lòng chọn khóa / năm học để xem tiến độ.</Alert>}

      {!loadingCatalog && !loadingReport && !error && report && <section className="tp-content">
        <section className="tp-overview" aria-label="Tổng quan lớp">
          <p className="tp-section-label">Tổng quan lớp <span>{classes.length} lớp</span></p>
          {classes.length > 0 && <div className="tp-overview-scroll">
            <div className={`tp-overview-row ${classes.length > 4 ? "tp-carousel" : ""}`}>
              {classes.length > 4 && <button type="button" className="tp-carousel-arrow" aria-label="Các lớp trước" disabled={windowStart === 0} onClick={() => setClassWindowStart(Math.max(0, windowStart - 1))}>‹</button>}
              <div className={`tp-class-items tp-class-count-${Math.min(classes.length, 4)}`} style={{ "--class-count": Math.min(classes.length, 4) }}>
                {visibleClasses.map((classGroup) => {
                  const summary = classGroup.summary;
                  const percentage = summary.totalSubjectCount ? Math.round(summary.completedSubjectCount / summary.totalSubjectCount * 100) : 0;
                  const ongoing = summary.inProgressSubjectCount + summary.scheduledSubjectCount;
                  return <button type="button" className={`tp-class-item ${classGroup.id === classId ? "selected" : ""}`} key={classGroup.id}
                    aria-pressed={classGroup.id === classId} onClick={() => setClassId(classGroup.id)}>
                    <span className="tp-class-identity"><strong>{classGroup.code}</strong>
                      <small>{classGroup.memberCount} học viên{classes.length > 1 && ` · ${summary.completedSubjectCount}/${summary.totalSubjectCount} hoàn thành`}</small>
                      {classes.length > 1 && <span className="tp-ongoing">{ongoing} đang học</span>}
                    </span>
                    {classes.length <= 2 && <span className="tp-progress">
                      {classes.length === 1 && <span className="tp-progress-copy"><small>TIẾN ĐỘ HỌC PHẦN</small><b>{summary.completedSubjectCount} / {summary.totalSubjectCount} hoàn thành</b></span>}
                      <span className="tp-progress-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span>
                      <small>{percentage}%</small>
                    </span>}
                    {classes.length === 1 && <span className="tp-summary tp-summary-full" role="group" aria-label="Thống kê tiến độ lớp">
                      <span className="tp-green"><b>{summary.completedSubjectCount}</b>Hoàn thành</span>
                      <span className="tp-orange"><b>{ongoing}</b>Đang học</span>
                      <span className="tp-gray"><b>{summary.notStartedSubjectCount}</b>Chưa tổ chức</span>
                    </span>}
                  </button>;
                })}
              </div>
              {classes.length > 4 && <button type="button" className="tp-carousel-arrow" aria-label="Các lớp tiếp theo" disabled={windowStart >= classes.length - 4} onClick={() => setClassWindowStart(Math.min(classes.length - 4, windowStart + 1))}>›</button>}
            </div>
          </div>}
        </section>

        {classes.length === 0 ? <div className="tp-empty-classes">
          <h2>Không có lớp phù hợp</h2>
          <p>Thử đổi Chuyên ngành hoặc Khóa / Năm học.</p>
          <button type="button" onClick={resetFilters}>Đặt lại bộ lọc</button>
        </div> : currentClass && <section className="tp-detail">
          <header className="tp-detail-header" role="group" aria-label="Tổng quan lớp đang chọn">
            <div className="tp-detail-heading">
              <h2>{currentClass.code}</h2>
              <p>{currentClass.memberCount} học viên · {currentClass.summary.totalSubjectCount} học phần áp dụng · {currentClass.curriculum?.code || "Chưa có thông tin chương trình đào tạo"}</p>
            </div>
            {classes.length >= 2 && <div className="tp-summary tp-summary-compact" role="group" aria-label="Thống kê tiến độ lớp">
              <span className="tp-green"><b>{currentClass.summary.completedSubjectCount}</b>Hoàn thành</span>
              <span className="tp-orange"><b>{currentClass.summary.inProgressSubjectCount + currentClass.summary.scheduledSubjectCount}</b>Đang học</span>
              <span className="tp-gray"><b>{currentClass.summary.notStartedSubjectCount}</b>Chưa tổ chức</span>
            </div>}
          </header>
          <div className="tp-table-wrap"><div className="tp-table-scroll"><table className="tp-table" aria-label="Tiến độ học phần">
            <colgroup><col className="tp-col-code" /><col /><col className="tp-col-credits" /><col className="tp-col-status" /><col className="tp-col-sessions" /></colgroup>
            <thead><tr><th scope="col" className="tp-code-heading">Mã học phần</th><th scope="col">Tên học phần</th><th scope="col" className="tp-centered">Tín chỉ</th><th scope="col" className="tp-centered">Trạng thái</th><th scope="col" className="tp-centered">Buổi đã học</th></tr></thead>
            <tbody>{visibleSubjects.map((subject) => <tr key={subject.curriculumSubjectId}
              className={`tp-subject-row ${selectedSubject === subject ? "tp-subject-selected" : ""}`}
              tabIndex={0}
              onClick={(event) => openSubject(subject.curriculumSubjectId, event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                openSubject(subject.curriculumSubjectId, event.currentTarget);
              }}
              aria-label={`Xem chi tiết học phần ${subject.name}`}
            >
              <td className="tp-course-code">{subject.code || "—"}</td>
              <td className="tp-course">{subject.name}</td>
              <td className="tp-centered">{subject.credits ?? "—"}</td>
              <td className="tp-centered"><StatusBadge status={subject.status} /></td>
              <td className="tp-centered">{subject.heldSessionCount}</td>
            </tr>)}</tbody>
          </table></div></div>
          {!visibleSubjects.length && <div className="tp-empty">{currentClass.subjects.length
            ? "Không có học phần phù hợp với bộ lọc."
            : "Chưa có dữ liệu học phần áp dụng cho lớp. Vui lòng kiểm tra chương trình đào tạo."}</div>}
        </section>}
      </section>}
    </div>
    {drawerOpen && selectedSubject && currentClass && <div className="tp-drawer-layer">
      <button type="button" className="tp-drawer-backdrop" aria-label="Đóng lớp phủ chi tiết học phần" onClick={closeDrawer} />
      <aside className="tp-drawer" role="dialog" aria-modal="true" aria-labelledby="tp-drawer-title">
        <header className="tp-drawer-header">
          <span className="tp-drawer-kicker">CHI TIẾT HỌC PHẦN</span>
          <button type="button" className="tp-drawer-close" aria-label="Đóng chi tiết học phần" onClick={closeDrawer} ref={drawerCloseRef}>×</button>
          <div className="tp-drawer-subject-meta">
            <strong>{selectedSubject.code || "—"}</strong>
            <StatusBadge status={selectedSubject.status} />
          </div>
          <h2 id="tp-drawer-title">{selectedSubject.name}</h2>
          <div className="tp-drawer-counts" aria-label="Tổng hợp buổi học">
            <span className="tp-drawer-held">{sessionSummary.held} đã diễn ra</span>
            <span className="tp-drawer-pending">{sessionSummary.pending} chờ xác nhận</span>
            <span className="tp-drawer-future">{sessionSummary.future} sắp tới</span>
          </div>
        </header>
        <div className="tp-drawer-class">
          <span>Lớp / nhóm học</span>
          <strong>{currentClass.code} · {currentClass.memberCount} học viên</strong>
        </div>
        <section className="tp-timeline" aria-labelledby="tp-timeline-title">
          <h3 id="tp-timeline-title">LỊCH SỬ BUỔI HỌC</h3>
          {(selectedSubject.sessions || []).length ? <ol>
            {selectedSubject.sessions.map((session, index) => {
              const category = sessionCategory(session);
              const info = sessionInfo[category];
              return <li className={`tp-session tp-session-${info.tone}`} key={session.id || `${session.sessionDate}-${index}`}>
                <span className="tp-timeline-dot" aria-hidden="true" />
                <div className="tp-session-heading"><strong>Buổi {index + 1}</strong></div>
                <div className="tp-session-date"><p>{session.sessionDate ? vietnameseDate(session.sessionDate) : "Chưa có ngày"} · {periodLabel(session.period)}</p><span>{info.label}</span></div>
                <small>{session.room?.code || "Chưa có phòng"} · {session.lecturer?.name || "Chưa có giảng viên"}</small>
              </li>;
            })}
          </ol> : <p className="tp-timeline-empty">Chưa có buổi học.</p>}
        </section>
      </aside>
    </div>}
  </FeatureLayout>;
}
