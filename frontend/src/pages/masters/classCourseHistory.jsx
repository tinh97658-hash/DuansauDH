import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, CircularProgress } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import OfferingDetails from "../../features/scheduling/OfferingDetails";
import { API_BASE_URL } from "../../config/http";
import "./classCourseHistory.css";

const asList = (value) => (Array.isArray(value) ? value : value?.data || []);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
const yearsForMajor = (groups, majorId) => [...new Set(groups.filter((group) => group.majorId === majorId).map((group) => group.academicYear).filter(Boolean))]
  .sort((left, right) => right.localeCompare(left, "vi", { numeric: true }));
const preferredYearForMajor = (groups, majorId) => {
  const availableYears = yearsForMajor(groups, majorId);
  const currentYear = String(new Date().getFullYear());
  return availableYears.includes(currentYear) ? currentYear : availableYears[0] || "";
};
const statusInfo = {
  completed: { label: "Hoàn thành", tone: "green" },
  in_progress: { label: "Đang học", tone: "orange" },
  scheduled: { label: "Đã xếp lịch", tone: "blue" },
  not_started: { label: "Chưa tổ chức", tone: "gray" },
};

function SelectFilter({ label, value, onChange, children, disabled }) {
  return <label className="tp-filter"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select></label>;
}

function StatusBadge({ status, offering, onOpen }) {
  const info = statusInfo[status] || statusInfo.not_started;
  if (!offering) return <span className={`tp-status tp-${info.tone}`}>{info.label}</span>;
  return <button type="button" className={`tp-status tp-status-button tp-${info.tone}`} onClick={() => onOpen(offering)} aria-label={`Xem chi tiết: ${info.label}`}>{info.label}</button>;
}

const offeringGroups = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
const sameSubject = (subject, offering) => {
  const offered = offering?.subject;
  if (!offered) return false;
  return Boolean(subject.code && offered.code && normalize(subject.code) === normalize(offered.code))
    || Boolean(subject.name && offered.name && normalize(subject.name) === normalize(offered.name));
};

export default function ClassCourseHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [majors, setMajors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [majorId, setMajorId] = useState(searchParams.get("majorId") || "");
  const [academicYear, setAcademicYear] = useState(searchParams.get("year") || "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [report, setReport] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [selectedOffering, setSelectedOffering] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

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

  const visibleMajors = useMemo(() => majors.filter((major) => groups.some((group) => group.majorId === major.id && group.academicYear)), [groups, majors]);
  const years = useMemo(() => yearsForMajor(groups, majorId), [groups, majorId]);
  const scopeGroups = useMemo(() => groups.filter((group) => group.majorId === majorId && group.academicYear === academicYear), [academicYear, groups, majorId]);
  const scopeCurriculumIds = useMemo(() => [...new Set(scopeGroups.map((group) => group.curriculumId).filter(Boolean))], [scopeGroups]);
  const inconsistentCurricula = scopeCurriculumIds.length > 1;

  useEffect(() => {
    if (loadingCatalog) return;
    const nextMajorId = visibleMajors.some((major) => major.id === majorId) ? majorId : visibleMajors[0]?.id || "";
    const availableYears = yearsForMajor(groups, nextMajorId);
    const nextAcademicYear = nextMajorId === majorId && availableYears.includes(academicYear)
      ? academicYear
      : preferredYearForMajor(groups, nextMajorId);
    if (nextMajorId === majorId && nextAcademicYear === academicYear) return;
    setMajorId(nextMajorId);
    setAcademicYear(nextAcademicYear);
    setSelectedOffering(null);
    setError("");
  }, [academicYear, groups, loadingCatalog, majorId, visibleMajors]);

  useEffect(() => {
    if (!majorId || !academicYear || !years.includes(academicYear) || inconsistentCurricula) {
      setReport(null);
      setOfferings([]);
      setSelectedOffering(null);
      setLoadingReport(false);
      return undefined;
    }
    let active = true;
    setReport(null);
    setOfferings([]);
    setSelectedOffering(null);
    setLoadingReport(true);
    setError("");
    Promise.all([
      axios.get(`${API_BASE_URL}/scheduling/class-curriculum-progress`, {
        params: { majorId, academicYear }, withCredentials: true,
      }),
      axios.get(`${API_BASE_URL}/scheduling/course-offerings`, {
        params: { program: "masters", majorId, academicYear }, withCredentials: true,
      }).catch(() => ({ data: [] })),
    ]).then(([progressResponse, offeringResponse]) => {
      if (!active) return;
      setReport(progressResponse.data);
      setOfferings(asList(offeringResponse.data));
    }).catch(() => active && setError("Không thể tải dữ liệu theo dõi tiến độ."))
      .finally(() => active && setLoadingReport(false));
    return () => { active = false; };
  }, [academicYear, inconsistentCurricula, majorId, years]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (majorId) next.set("majorId", majorId);
    if (academicYear) next.set("year", academicYear);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [academicYear, majorId, searchParams, setSearchParams]);

  const classes = useMemo(() => report?.classes || [], [report]);
  const subjectRows = useMemo(() => {
    const rows = new Map();
    classes.forEach((classGroup) => (classGroup.subjects || []).forEach((subject) => {
      if (!rows.has(subject.curriculumSubjectId)) rows.set(subject.curriculumSubjectId, { ...subject, byClass: {} });
      rows.get(subject.curriculumSubjectId).byClass[classGroup.id] = subject;
    }));
    return [...rows.values()];
  }, [classes]);

  const visibleSubjects = useMemo(() => subjectRows.filter((row) => {
    const classSubjects = Object.values(row.byClass);
    if (status !== "all" && !classSubjects.some((subject) => subject.status === status)) return false;
    const lecturers = classSubjects.flatMap((subject) => subject.sessions || []).map((session) => session.lecturer?.name || "").join(" ");
    return !search.trim() || normalize(`${row.code || ""} ${row.name} ${lecturers}`).includes(normalize(search));
  }), [search, status, subjectRows]);

  const offeringFor = (classGroup, subject) => {
    const candidates = offerings.filter((offering) => offeringGroups(offering).some((group) => group.id === classGroup.id) && sameSubject(subject, offering));
    if (subject.status === "completed") return candidates.find((offering) => offering.status === "completed") || candidates[0] || null;
    if (subject.status === "not_started") return null;
    return candidates.find((offering) => offering.status === "active") || candidates[0] || null;
  };

  const curriculumLabel = classes.find((classGroup) => classGroup.curriculum?.code)?.curriculum.code;

  return <FeatureLayout title="Theo dõi tiến độ">
    <div className="tp-page">
      <section className="tp-filters" aria-label="Bộ lọc tiến độ">
        <SelectFilter label="Chuyên ngành" value={majorId} onChange={(value) => { setMajorId(value); setAcademicYear(preferredYearForMajor(groups, value)); setSelectedOffering(null); setError(""); }} disabled={loadingCatalog}>
          <option value="">Chọn chuyên ngành</option>
          {visibleMajors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </SelectFilter>
        <SelectFilter label="Khóa / năm học" value={academicYear} onChange={(value) => { setAcademicYear(value); setSelectedOffering(null); setError(""); }} disabled={!majorId || !years.length}>
          <option value="">Chọn khóa / năm học</option>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </SelectFilter>
        <SelectFilter label="Trạng thái" value={status} onChange={setStatus} disabled={!report}>
          <option value="all">Tất cả</option>
          {Object.entries(statusInfo).map(([value, info]) => <option value={value} key={value}>{info.label}</option>)}
        </SelectFilter>
        <label className="tp-filter"><span>Tìm kiếm</span><div className="tp-search"><SearchRounded /><input aria-label="Tìm kiếm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, học phần, giảng viên..." disabled={!report} /></div></label>
      </section>

      {error && <Alert severity="error">{error}</Alert>}
      {(loadingCatalog || loadingReport) && <Box className="tp-loading"><CircularProgress size={30} /></Box>}
      {!loadingCatalog && !majorId && <Alert severity="info">Vui lòng chọn chuyên ngành và khóa / năm học để xem tiến độ.</Alert>}
      {!loadingCatalog && majorId && !academicYear && <Alert severity="info">Vui lòng chọn khóa / năm học để xem tiến độ.</Alert>}
      {!loadingCatalog && majorId && academicYear && inconsistentCurricula && <Alert severity="error">
        Dữ liệu không nhất quán: các lớp trong chuyên ngành và khóa / năm học đã chọn đang được gán nhiều chương trình đào tạo khác nhau. Không thể hiển thị ma trận tiến độ.
      </Alert>}

      {!loadingCatalog && !loadingReport && !error && report && <section className="tp-content" aria-label="Tổng quan tiến độ">
        <header className="tp-matrix-heading">
          <div><h2>Tiến độ học phần theo lớp</h2><p>{classes.length} lớp{curriculumLabel ? ` · Chương trình đào tạo ${curriculumLabel}` : ""}</p></div>
          <p>Chọn trạng thái của một lớp để xem chi tiết lớp học phần.</p>
        </header>

        {classes.length === 0 ? <div className="tp-empty-classes">
          <h2>Không có lớp phù hợp</h2><p>Không có lớp thuộc chuyên ngành và khóa / năm học đã chọn.</p>
        </div> : <>
          <div className="tp-table-wrap"><div className="tp-table-scroll"><table className="tp-table" aria-label="Ma trận tiến độ học phần theo lớp">
            <thead><tr>
              <th scope="col" className="tp-sticky tp-sticky-code">Mã học phần</th>
              <th scope="col" className="tp-sticky tp-sticky-name">Tên học phần</th>
              <th scope="col" className="tp-sticky tp-sticky-credits tp-centered">Tín chỉ</th>
              {classes.map((classGroup) => <th scope="col" className="tp-class-heading tp-centered" key={classGroup.id}>{classGroup.code}</th>)}
            </tr></thead>
            <tbody>{visibleSubjects.map((row) => <tr key={row.curriculumSubjectId}>
              <td className="tp-sticky tp-sticky-code tp-course-code">{row.code || "—"}</td>
              <td className="tp-sticky tp-sticky-name tp-course">{row.name}</td>
              <td className="tp-sticky tp-sticky-credits tp-centered">{row.credits ?? "—"}</td>
              {classes.map((classGroup) => {
                const subject = row.byClass[classGroup.id];
                if (!subject) return <td className="tp-centered tp-not-applicable" key={classGroup.id} aria-label={`Không áp dụng cho ${classGroup.code}`}>—</td>;
                const offering = offeringFor(classGroup, subject);
                return <td className="tp-centered" key={classGroup.id}><StatusBadge status={subject.status} offering={offering} onOpen={setSelectedOffering} /></td>;
              })}
            </tr>)}</tbody>
          </table></div></div>
          {!visibleSubjects.length && <div className="tp-empty">{subjectRows.length ? "Không có học phần phù hợp với bộ lọc." : "Chưa có dữ liệu học phần áp dụng cho các lớp. Vui lòng kiểm tra chương trình đào tạo."}</div>}
        </>}
      </section>}
    </div>
    {selectedOffering && <OfferingDetails offering={selectedOffering} user={{}} onClose={() => setSelectedOffering(null)} />}
  </FeatureLayout>;
}
