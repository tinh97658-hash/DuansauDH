import React, { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import FilterSelectField from "../../components/FilterSelectField";
import ResizableTable from "../../components/ResizableTable";
import { API_BASE_URL } from "../../config/http";
import { RESULT_LABELS, SCORE_FIELDS, formatAttemptScores } from "../exams/gradebook";
import { calculateExamEligibility } from "../exams/gradingPolicy";
import "./learnerScorecard.css";
import { useSubjectCatalogRevision } from "../../utils/subjectCatalog";
import { useGradebookRevision } from "../../utils/gradebookRevision";

const columns = [
  { key: "index", label: "STT", width: 50, minWidth: 40, align: "center" },
  { key: "code", label: "Mã HP", width: 110 },
  { key: "name", label: "Học phần", width: 310, minWidth: 180 },
  { key: "credits", label: "Tín chỉ", width: 70, align: "center" },
  { key: "type", label: "Loại học phần", width: 110 },
  ...SCORE_FIELDS.map(([key, label]) => ({ key, label, width: key === "assignmentScore" ? 140 : 125, align: "center" })),
  { key: "letter", label: "Thang điểm chữ", width: 130, align: "center" },
  { key: "attempts", label: "Điểm các lần thi hết môn", width: 200 },
  { key: "result", label: "Kết quả", width: 150 },
];

export default function LearnerScorecard({ admissionRecordId, classGroupId, onClassChange }) {
  const catalogRevision = useSubjectCatalogRevision();
  const gradebookRevision = useGradebookRevision();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    setLoading(true);
    axios.get(`${API_BASE_URL}/reports/learner-scorecard/${admissionRecordId}`, {
      params: classGroupId ? { classGroupId } : {},
    }).then(({ data }) => { if (active) setReport(data); })
      .catch(error => { if (active) setError(error.response?.data?.message || error.message || "Không tải được bảng điểm học viên."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admissionRecordId, classGroupId, reload, catalogRevision, gradebookRevision]);

  const subjects = (report?.subjects || []).map(subject => {
    const details = subject.grade?.details;
    if (!details || subject.grade.studyLeaveFailure || details.studyLeaveFailure || details.source === "recognition" || details.examExempt || calculateExamEligibility(details) !== false) return subject;
    return { ...subject, grade: { ...subject.grade, score: 0, result: "failed",
      details: { ...details, examScore: 0, courseScore: 0, grade4: 0, letterGrade: "F", attemptScores: [0] } } };
  });
  const gradedCount = subjects.filter(subject => subject.grade?.score != null || ["passed", "failed", "exempt"].includes(subject.grade?.result)).length;
  return <Paper variant="outlined" className="learner-scorecard" aria-label="Bảng điểm học viên">
    <div className="lsc-heading">
      <div><h2>BẢNG ĐIỂM</h2><p>{report?.student ? `${report.student.code || ""} · ${report.student.fullName}` : "Điểm các học phần trong chương trình đào tạo của lớp"}</p></div>
      {report?.curriculum && <Chip size="small" label={`${gradedCount}/${subjects.length} học phần có kết quả`} sx={{ bgcolor: "var(--table-header-bg)", color: "var(--secondary)" }} />}
    </div>
    {loading && <div className="lsc-empty" role="status"><CircularProgress size={24} /><span>Đang tải bảng điểm...</span></div>}
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setReload(value => value + 1)}>Thử lại</Button>}>{error}</Alert>}
    {!loading && report && <>
      {!report.group ? <Alert severity="info">Học viên chưa được phân vào lớp. Hãy phân lớp để xem bảng điểm theo chương trình đào tạo.</Alert> : <>
        <div className="lsc-scope">
          <FilterSelectField label="Lớp học viên" value={report.group.id} disabled={report.groups.length < 2} onChange={event => onClassChange(event.target.value)}>
            {report.groups.map(group => <MenuItem key={group.id} value={group.id}>{group.code || group.name}</MenuItem>)}
          </FilterSelectField>
          {report.curriculum && <div className="lsc-curriculum"><span>CHƯƠNG TRÌNH ĐÀO TẠO</span><strong>{report.curriculum.name}</strong><p>{subjects.length} học phần · {report.curriculum.totalCredits ?? subjects.reduce((total, subject) => total + Number(subject.credits || 0), 0)} tín chỉ</p></div>}
        </div>
        {!report.curriculum && <Alert severity="warning">Lớp chưa được gán chương trình đào tạo. Hãy chọn CTĐT cho lớp để xem đầy đủ các học phần.</Alert>}
        {report.curriculum && !subjects.length && <Alert severity="info">Chương trình đào tạo chưa có học phần.</Alert>}
        {subjects.length > 0 && <TableContainer className="lsc-table-scroll">
          <ResizableTable columns={columns} storageKey="learner-scorecard-widths" freezeThrough="name">
            <TableBody>{subjects.map((subject, index) => {
              const grade = subject.grade;
              const details = grade?.details || {};
              const result = grade?.studyLeaveFailure || details.studyLeaveFailure ? "Không đạt" : grade?.profileForeignLanguageExempt || details.profileForeignLanguageExempt
                ? "Miễn thi" : RESULT_LABELS[grade?.result] || RESULT_LABELS.pending;
              return <TableRow key={subject.id} hover className={grade?.result === "failed" ? "lsc-failed" : grade?.result === "exempt" ? "lsc-exempt" : ""}>
                <TableCell align="center">{index + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{subject.code || "—"}</TableCell>
                <TableCell title={subject.name}>{subject.name}</TableCell>
                <TableCell align="center">{subject.credits ?? "—"}</TableCell>
                <TableCell>{subject.isRequired ? "Bắt buộc" : "Tự chọn"}</TableCell>
                {SCORE_FIELDS.map(([key]) => <TableCell key={key} align="center">{(key === "courseScore" ? grade?.score : details[key]) ?? ""}</TableCell>)}
                <TableCell align="center">{details.letterGrade || ""}</TableCell>
                <TableCell>{formatAttemptScores(details.attemptScores)}</TableCell>
                <TableCell className="lsc-result">{result}</TableCell>
              </TableRow>;
            })}</TableBody>
          </ResizableTable>
        </TableContainer>}
      </>}
    </>}
  </Paper>;
}
