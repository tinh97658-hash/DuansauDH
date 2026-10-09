import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import { DownloadRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import ResizableTable from "../../components/ResizableTable";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import { disciplinesFromMajors, majorDisciplineId, majorsForDiscipline } from "../../utils/disciplineScope";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate } from "../../features/exams/gradebook";
import { downloadDocumentFile } from "../../utils/documentFiles";
import { createClassScoreWorkbook, scoreSummaryColumns, scoreSummaryValue } from "./classScoreSummaryExcel";
import "./classScoreSummary.css";

const endpoint = `${API_BASE_URL}/reports/class-score-summary`;
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

export default function ClassScoreSummary() {
  const [groups, setGroups] = useState([]);
  const [year, setYear] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [report, setReport] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [optionsReload, setOptionsReload] = useState(0);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    setOptionsError("");
    axios.get(`${endpoint}/options`).then(({ data }) => {
      if (!active) return;
      const available = data.groups || [];
      const years = [...new Set(available.map(group => group.academicYear || ""))].sort((a, b) => b.localeCompare(a, "vi", { numeric: true }));
      const initialYear = years[0] || "";
      setGroups(available);
      setYear(initialYear);
      const initialGroup = available.find(group => (group.academicYear || "") === initialYear);
      setDisciplineId(majorDisciplineId(initialGroup?.major));
      setMajorId(initialGroup?.majorId || initialGroup?.major?.id || "");
      setClassGroupId(initialGroup?.id || "");
      setReport(null);
    }).catch(error => { if (active) setOptionsError(errorMessage(error, "Không tải được danh sách lớp.")); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [optionsReload]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    setSelectedId("");
    if (!classGroupId || loadingOptions) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    axios.get(`${endpoint}/export`, { params: { classGroupId, ...(debouncedSearch ? { search: debouncedSearch } : {}) } }).then(({ data }) => {
      if (active) setReport(data);
    }).catch(error => { if (active) setError(errorMessage(error, "Không tải được bảng điểm.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classGroupId, loadingOptions, reload, debouncedSearch]);

  const years = useMemo(() => [...new Set(groups.map(group => group.academicYear || ""))]
    .sort((a, b) => b.localeCompare(a, "vi", { numeric: true })), [groups]);
  const yearGroups = useMemo(() => groups.filter(group => (group.academicYear || "") === year), [groups, year]);
  const yearMajors = useMemo(() => [...new Map(yearGroups.filter(group => group.major).map(group => [group.major.id, group.major])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "vi")), [yearGroups]);
  const disciplines = useMemo(() => disciplinesFromMajors(yearMajors), [yearMajors]);
  const majors = useMemo(() => majorsForDiscipline(yearMajors, disciplineId), [yearMajors, disciplineId]);
  const classes = useMemo(() => yearGroups.filter(group => (!disciplineId || majorDisciplineId(group.major) === disciplineId)
    && (!majorId || (group.majorId || group.major?.id) === majorId)), [yearGroups, disciplineId, majorId]);
  const currentReport = report?.group?.id === classGroupId ? report : null;
  const subjects = currentReport?.subjects || [];
  const columns = scoreSummaryColumns(subjects);
  const busy = loadingOptions || loading;
  const selectGroup = (group) => {
    setYear(group?.academicYear || "");
    setDisciplineId(majorDisciplineId(group?.major));
    setMajorId(group?.majorId || group?.major?.id || "");
    setClassGroupId(group?.id || "");
  };
  const changeScope = (nextYear, nextDisciplineId, nextMajorId) => {
    const available = groups.filter(group => (group.academicYear || "") === nextYear);
    const discipline = available.some(group => majorDisciplineId(group.major) === nextDisciplineId) ? nextDisciplineId : "";
    const inDiscipline = available.filter(group => !discipline || majorDisciplineId(group.major) === discipline);
    const major = inDiscipline.some(group => (group.majorId || group.major?.id) === nextMajorId) ? nextMajorId : "";
    const choices = inDiscipline.filter(group => !major || (group.majorId || group.major?.id) === major);
    selectGroup(choices.find(group => group.id === classGroupId) || choices[0]);
  };
  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const { data } = await axios.get(`${endpoint}/export`, { params: { classGroupId, ...(debouncedSearch ? { search: debouncedSearch } : {}) } });
      const blob = await createClassScoreWorkbook(data);
      const code = (data.group.code || data.group.name).replace(/[<>:"/\\|?*]/g, "-");
      downloadDocumentFile(blob, `Tong-hop-diem-${code}.xlsx`);
    } catch (error) { setError(errorMessage(error, "Không xuất được file Excel.")); }
    finally { setExporting(false); }
  };

  return <FeatureLayout title="Tổng hợp điểm của lớp" group="BÁO CÁO">
    <section className="css-report" aria-label="Tổng hợp điểm của lớp">
      <Paper variant="outlined" className="css-filters">
        <FilterSelectField label="Năm vào trường" value={year} disabled={loadingOptions || exporting || !groups.length} onChange={event => changeScope(event.target.value, disciplineId, majorId)}>
          {!years.length && <MenuItem value="">Chọn năm</MenuItem>}
          {years.map(value => <MenuItem key={value} value={value}>{value || "Chưa có năm"}</MenuItem>)}
        </FilterSelectField>
        <FilterSelectField label="Ngành" value={disciplineId} disabled={loadingOptions || exporting || !disciplines.length} onChange={event => changeScope(year, event.target.value, majorId)}>
          {!disciplines.length && <MenuItem value="">Chưa có ngành</MenuItem>}
          {disciplines.map(discipline => <MenuItem key={discipline.id} value={discipline.id}>{discipline.name}</MenuItem>)}
        </FilterSelectField>
        <FilterSelectField label="Chuyên ngành" value={majorId} disabled={loadingOptions || exporting || !majors.length} onChange={event => changeScope(year, disciplineId, event.target.value)}>
          {!majors.length && <MenuItem value="">Chưa có chuyên ngành</MenuItem>}
          {majors.map(major => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
        </FilterSelectField>
        <FilterSelectField label="Chọn lớp" value={classGroupId} disabled={loadingOptions || exporting || !classes.length} onChange={event => selectGroup(groups.find(group => group.id === event.target.value))}>
          {!classes.length && <MenuItem value="">Chọn lớp học viên</MenuItem>}
          {classes.map(group => <MenuItem key={group.id} value={group.id}>{group.code || group.name}{group.major?.name ? ` — ${group.major.name}` : ""}</MenuItem>)}
        </FilterSelectField>
        <FilterSearchField placeholder="Tìm theo mã HV, họ tên..." value={search} disabled={loadingOptions || exporting} inputProps={{ maxLength: 200 }} onChange={event => setSearch(event.target.value)} />
        <Button className="css-export" variant="contained" color="success" startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadRounded />} onClick={exportExcel} disabled={busy || exporting || search.trim() !== debouncedSearch || !currentReport?.rows?.length || !subjects.length}>Xuất file Excel</Button>
      </Paper>
      {(optionsError || error) && <Alert severity="error" action={<Button color="inherit" size="small" disabled={busy || exporting} onClick={() => optionsError ? setOptionsReload(value => value + 1) : setReload(value => value + 1)}>Thử lại</Button>}>{optionsError || error}</Alert>}
      <Paper variant="outlined" className="css-content">
        <div className="css-heading">
          <div><h1 className="css-title">TỔNG HỢP ĐIỂM CỦA LỚP</h1><p>Bảng điểm toàn bộ chương trình đào tạo{currentReport?.group?.name ? ` · ${currentReport.group.name}` : ""}</p></div>
          {currentReport && <Chip size="small" label={`${currentReport.total} học viên`} sx={{ bgcolor: "var(--table-header-bg)", color: "var(--secondary)" }} />}
        </div>
      {busy && <div className="css-empty" role="status"><CircularProgress size={24} /><span>Đang tải bảng điểm...</span></div>}
      {!busy && !optionsError && !groups.length && <div className="css-empty">Chưa có lớp học viên. Hãy tạo lớp và phân học viên vào lớp trước.</div>}
      {!busy && currentReport && <>
        {!currentReport.curriculum && <Alert severity="warning">Lớp chưa được gán chương trình đào tạo. Hãy chọn CTĐT cho lớp để xem đầy đủ các học phần.</Alert>}
        {currentReport.curriculum && !subjects.length && <Alert severity="info">Chương trình đào tạo chưa có học phần.</Alert>}
        <TableContainer className="css-table-scroll">
          <ResizableTable columns={columns} storageKey="report-class-score-summary-widths" freezeThrough="firstName">
            <TableBody>
              {!currentReport.rows.length && <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>{debouncedSearch ? "Không có học viên phù hợp với tìm kiếm." : "Lớp chưa có học viên."}</TableCell></TableRow>}
              {currentReport.rows.map((row, index) => {
                const name = personNameParts(row);
                const detailPath = row.admissionRecordId ? `${currentReport.group.program === "doctoral" ? "/plan/admission-records" : "/masters/admitted-records"}/${row.admissionRecordId}?tab=grades&classGroupId=${currentReport.group.id}` : null;
                const studentInfo = value => detailPath ? <Link className="css-student-link" to={detailPath} title={`Xem bảng điểm của ${row.fullName || row.code}`}>{value}</Link> : value;
                return <TableRow key={row.participantId} hover selected={selectedId === row.participantId} onClick={() => setSelectedId(row.participantId)}>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell title={row.code} sx={{ fontWeight: 600 }}>{studentInfo(row.code || "—")}</TableCell>
                  <TableCell title={name.familyAndMiddle}>{studentInfo(name.familyAndMiddle)}</TableCell>
                  <TableCell title={name.givenName}>{studentInfo(name.givenName)}</TableCell>
                  <TableCell align="center">{studentInfo(displayGradeDate(row.dob))}</TableCell>
                  <TableCell align="center">{studentInfo(row.gender || "—")}</TableCell>
                  {subjects.map(subject => {
                    const entry = row.scores?.[subject.id];
                    return <TableCell key={subject.id} align="center" className={entry?.result === "failed" ? "css-failed" : entry?.result === "exempt" ? "css-exempt" : ""} title={`${subject.name}: ${entry?.result === "exempt" ? "Miễn thi" : entry?.score == null ? "Chưa có điểm" : scoreSummaryValue(entry)}`}>{scoreSummaryValue(entry)}</TableCell>;
                  })}
                </TableRow>;
              })}
            </TableBody>
          </ResizableTable>
        </TableContainer>
      </>}
      </Paper>
    </section>
  </FeatureLayout>;
}
