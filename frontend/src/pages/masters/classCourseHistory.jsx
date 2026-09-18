import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, CircularProgress } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";
import "./classCourseHistory.css";

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
const statusInfo = {
  completed: { label: "Hoàn thành", tone: "green" },
  in_progress: { label: "Đang học", tone: "orange" },
  scheduled: { label: "Đã xếp lịch", tone: "blue" },
  not_started: { label: "Chưa tổ chức", tone: "gray" },
};
const periodName = { MORNING: "Sáng", AFTERNOON: "Chiều" };
const shortDate = (value) => {
  if (!value) return "—";
  const [, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}`;
};

function SelectFilter({ label, value, onChange, children, disabled }) {
  return <label className="tp-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></label>;
}

function StatusBadge({ status }) {
  const info = statusInfo[status] || statusInfo.not_started;
  return <span className={`tp-status tp-${info.tone}`}><i />{info.label}</span>;
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
  const [expandedSubjectId, setExpandedSubjectId] = useState("");

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
      return undefined;
    }
    let active = true;
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
    const haystack = `${subject.code || ""} ${subject.name} ${subject.lecturer?.name || ""}`;
    return !search.trim() || normalize(haystack).includes(normalize(search));
  }), [currentClass, search, status]);

  const major = visibleMajors.find((item) => item.id === majorId);
  return <FeatureLayout title="Theo dõi tiến độ">
    <main className="tp-page">
      <section className="tp-filters" aria-label="Bộ lọc tiến độ">
        <SelectFilter label="Chuyên ngành" value={majorId} onChange={(value) => { setMajorId(value); setAcademicYear(""); setClassId(""); setExpandedSubjectId(""); }} disabled={loadingCatalog}>
          <option value="">Chọn chuyên ngành</option>
          {visibleMajors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </SelectFilter>
        <SelectFilter label="Khóa / năm học" value={academicYear} onChange={(value) => { setAcademicYear(value); setClassId(""); }} disabled={!years.length}>
          <option value="">Chọn khóa / năm học</option>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </SelectFilter>
        <SelectFilter label="Trạng thái" value={status} onChange={setStatus}>
          <option value="all">Tất cả</option>
          {Object.entries(statusInfo).map(([value, info]) => <option value={value} key={value}>{info.label}</option>)}
        </SelectFilter>
        <label className="tp-search"><SearchRounded /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, học phần, giảng viên..." /></label>
      </section>

      {error && <Alert severity="error">{error}</Alert>}
      {(loadingCatalog || loadingReport) && <Box className="tp-loading"><CircularProgress size={30} /></Box>}
      {!loadingCatalog && !majorId && <Alert severity="info">Vui lòng chọn chuyên ngành và khóa / năm học để xem tiến độ.</Alert>}
      {!loadingCatalog && majorId && !academicYear && <Alert severity="info">Vui lòng chọn khóa / năm học để xem tiến độ.</Alert>}

      {!loadingCatalog && !loadingReport && report && <>
        <section className="tp-overview">
          <p className="tp-section-label">Tổng quan lớp</p>
          <div className="tp-class-grid">
            {report.classes.map((classGroup) => {
              const summary = classGroup.summary;
              const percentage = summary.totalSubjectCount ? Math.round(summary.completedSubjectCount / summary.totalSubjectCount * 100) : 0;
              const ongoing = summary.inProgressSubjectCount + summary.scheduledSubjectCount;
              return <button className={`tp-class-card ${classGroup.id === classId ? "selected" : ""}`} key={classGroup.id} onClick={() => { setClassId(classGroup.id); setExpandedSubjectId(""); }}>
                <strong>{classGroup.code}</strong>
                <small>{classGroup.memberCount} học viên</small>
                <span><b>{summary.completedSubjectCount} / {summary.totalSubjectCount} hoàn thành</b><em>{ongoing} đang học</em></span>
                <i><u style={{ width: `${percentage}%` }} /></i>
              </button>;
            })}
          </div>
        </section>

        {currentClass ? <section className="tp-detail">
          <header className="tp-detail-header">
            <div><h2>{currentClass.code}</h2><p>{currentClass.memberCount} học viên · {currentClass.summary.totalSubjectCount} học phần áp dụng · {currentClass.major?.name || major?.name || "—"} · {currentClass.curriculum?.code || `Khóa ${currentClass.academicYear}`}</p></div>
            <div className="tp-summary">
              <span className="green"><b>{currentClass.summary.completedSubjectCount}</b>Hoàn thành</span>
              <span className="orange"><b>{currentClass.summary.inProgressSubjectCount + currentClass.summary.scheduledSubjectCount}</b>Đang học</span>
              <span className="gray"><b>{currentClass.summary.notStartedSubjectCount}</b>Chưa tổ chức</span>
            </div>
          </header>

          <div className="tp-table-wrap"><table className="tp-table">
            <thead><tr><th>Mã học phần</th><th>Học phần</th><th>Trạng thái</th><th>Giảng viên</th><th>Thời gian</th><th>Phòng</th><th>Buổi</th></tr></thead>
            <tbody>{visibleSubjects.map((subject) => <React.Fragment key={subject.curriculumSubjectId}>
              <tr
                className="tp-subject-row"
                tabIndex={0}
                onClick={() => setExpandedSubjectId((value) => value === subject.curriculumSubjectId ? "" : subject.curriculumSubjectId)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setExpandedSubjectId((value) => value === subject.curriculumSubjectId ? "" : subject.curriculumSubjectId);
                }}
                aria-label={`Nhấn để xem chi tiết ${subject.name}`}
              >
                <td className="tp-course-code">{subject.code || "—"}</td>
                <td className="tp-course">{subject.name}</td>
                <td><StatusBadge status={subject.status} /></td>
                <td>{subject.lecturer?.name || "—"}</td>
                <td>{subject.schedule ? `${shortDate(subject.schedule.sessionDate)} · ${periodName[subject.schedule.period] || subject.schedule.startTime?.slice(0, 5)}` : "—"}</td>
                <td>{subject.room?.code || "—"}</td>
                <td>{subject.status === "scheduled" ? subject.sessionCount : subject.heldSessionCount}</td>
              </tr>
              {expandedSubjectId === subject.curriculumSubjectId && <tr className="tp-expanded"><td colSpan={7}>Đã học <strong>{subject.heldSessionCount}</strong> buổi · Tổng lịch <strong>{subject.sessionCount}</strong> buổi · {subject.lecturer?.name || "Chưa phân công giảng viên"} · {subject.room?.code || "Chưa xếp phòng"}</td></tr>}
            </React.Fragment>)}</tbody>
          </table></div>
          {!visibleSubjects.length && <div className="tp-empty">Không có học phần phù hợp với bộ lọc.</div>}
        </section> : <Alert severity="info">Khóa đã chọn chưa có lớp để theo dõi.</Alert>}
      </>}
    </main>
  </FeatureLayout>;
}
