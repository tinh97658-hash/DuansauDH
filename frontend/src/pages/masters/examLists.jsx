import { usePermissions } from "../../features/accounts/usePermissions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { dashboardGradeScope } from "../../features/dashboard/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, ListSubheader, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import ListAltRounded from "@mui/icons-material/ListAltRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import GradeSettingsDialog from "../../features/exams/GradeSettingsDialog";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import ListPagination from "../../components/ListPagination";
import ResizableTable from "../../components/ResizableTable";
import DocumentExportMenu from "../../components/DocumentExportMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import AppDialog from "../../components/AppDialog";
import { downloadDocumentFile } from "../../utils/documentFiles";
import { buildGradebookDocument, createGradebookExcel, fetchAllGradebookRows, gradebookFilename, openGradebookPreview } from "../../features/exams/gradebookExport";
import { buildExamListDocument, createExamListExcel } from "../../features/exams/examListExport";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate, draftOf, formatAttemptScores, formatScore, gradebookColumns, gradebookRowValues, gradePayload, isExamCandidate, numericScore, RESULT_LABELS, rowError, SCORE_FIELDS, updateGradeDraft, visibleGradeRows } from "../../features/exams/gradebook";
import "../../features/exams/gradebook.css";
import { useSubjectCatalogRevision } from "../../utils/subjectCatalog";
import { notifyGradebookSaved } from "../../utils/gradebookRevision";

const panelSx = { borderColor: "#D7E4EE", borderRadius: 0, bgcolor: "#fff", boxShadow: "none" };
const inputSx = {
  "& .MuiOutlinedInput-root": {
    height: 30, fontSize: 12, borderRadius: 0, bgcolor: "transparent",
    "& fieldset, &:hover fieldset, &.Mui-focused fieldset": { border: 0 },
    "&.Mui-focused": { bgcolor: "transparent", boxShadow: "none" },
    "&.Mui-error": { bgcolor: "transparent", color: "#B52D2D" },
  },
  "& input": { px: 0.75, py: 0.5, textAlign: "center" },
};
const modes = { all: "Cả bảng điểm", exam: "DS thi" };
const PAGE_SIZE = 15;
const EXAM_WARNING_ID = "exam-missing-component-scores";
const EXAM_WARNING_CONTAINER = "exam-gradebook-warnings";
const COMPLETION_WARNING_ID = "exam-teaching-not-completed";
const COMPLETION_WARNING_MESSAGE = "Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm.";
const showCompletionWarning = () => {
  if (toast.isActive(COMPLETION_WARNING_ID)) toast.update(COMPLETION_WARNING_ID, { render: COMPLETION_WARNING_MESSAGE, autoClose: 5000 });
  else toast.warn(COMPLETION_WARNING_MESSAGE, { toastId: COMPLETION_WARNING_ID, containerId: EXAM_WARNING_CONTAINER });
};
const subjectNameKey = subject => (subject?.name || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const subjectKey = subject => subject?.id || subject?.code || "";
const subjectLabel = subject => [subject?.code, subject?.name].filter(Boolean).join(" - ");
const showMissingScoresWarning = () => {
  const message = "Hãy nhập đủ điểm thành phần cho tất cả học viên!";
  if (toast.isActive(EXAM_WARNING_ID)) toast.update(EXAM_WARNING_ID, { render: message, autoClose: 5000 });
  else toast.warn(message, { toastId: EXAM_WARNING_ID, containerId: EXAM_WARNING_CONTAINER });
};
const calculatedColumns = new Set(["eligible", "courseScore", "grade4", "letter", "attempts", "result"]);
function OfferingGroupHeader({ children }) {
  return <ListSubheader role="presentation" sx={{ fontSize: 10.5, lineHeight: '30px', fontWeight: 700, bgcolor: '#f8fafc', color: '#607486' }}>{children}</ListSubheader>;
}
OfferingGroupHeader.muiSkipListHighlight = true;
const errorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
};

export default function ExamLists() {
  const [entryParams] = useSearchParams();
  const { can } = usePermissions();
  const catalogRevision = useSubjectCatalogRevision();
  const [policyRevision, setPolicyRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setPolicyRevision(value => value + 1);
    const profileRefresh = event => { if (event.detail?.source === "profile") refresh(); };
    const storage = event => { if (["grading-policy-revision", "exam-gradebook-revision"].includes(event.key)) refresh(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("grading-policy-changed", refresh);
    window.addEventListener("exam-gradebook-saved", profileRefresh);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("grading-policy-changed", refresh); window.removeEventListener("storage", storage);
      window.removeEventListener("exam-gradebook-saved", profileRefresh);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const [workflow, setWorkflow] = useState({ status: "draft", version: 0 });
  const [workflowAction, setWorkflowAction] = useState("");
  const [workflowNote, setWorkflowNote] = useState("");
  const [workflowPhase,setWorkflowPhase]=useState('eligibility');
  const newWorkflow=workflow.mode==='new',legacyWorkflow=workflow.mode==='legacy_preserved';
  const componentEditable=newWorkflow&&workflow.eligibility.status==='draft';
  const resultEditable=newWorkflow&&workflow.eligibility.status==='approved'&&workflow.final.status==='draft';
  const workflowEditable=componentEditable||resultEditable;
  const beginWorkflow=(phase,action)=>{setWorkflowPhase(phase);setWorkflowAction(action);};
  const [auditRows, setAuditRows] = useState(null);
  const [groups, setGroups] = useState([]), [subjects, setSubjects] = useState([]);
  const [loadedOffering, setLoadedOffering] = useState(null);
  const [majorId, setMajorId] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [groupId, setGroupId] = useState(""), [offeringId, setOfferingId] = useState("");
  const [rows, setRows] = useState([]), [revision, setRevision] = useState(0), [dirty, setDirty] = useState({});
  const [mode, setMode] = useState("all"), [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0), [totalRows, setTotalRows] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [unassessedRows, setUnassessedRows] = useState(null);
  const pendingExamWarning = useRef(false);
  const includeIds = Object.values(dirty).filter(isExamCandidate).map(row => row.participantId).join(",");
  const excludeIds = Object.values(dirty).filter(row => !isExamCandidate(row)).map(row => row.participantId).join(",");
  const examIncludeIds = mode === "exam" ? includeIds : "", examExcludeIds = mode === "exam" ? excludeIds : "";
  const [optionsLoading, setOptionsLoading] = useState(true), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState(""), [pendingChange, setPendingChange] = useState(null);
  const canSubmitGrades = can("gradebook.submit");
  const canApproveGrades = can("gradebook.approve");
  const canEditPolicy = can("gradebook.policy");
  const refreshOfferingCompletion = offering => {
    if (typeof offering?.examGradesComplete !== 'boolean') return;
    setSubjects(previous => previous.map(item => item.id === offering.id ? { ...item, examGradesComplete: offering.examGradesComplete } : item));
  };
  const dirtyCount = Object.keys(dirty).length;

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/masters/exam-lists/options`)
      .then((options) => {
        if (!active) return;
        const list = options.data.groups || [];
        const offerings = options.data.courseOfferings || [];
        setGroups(list); setSubjects(offerings);
        const { group: first, offering, year } = dashboardGradeScope(entryParams, list, offerings);
        setYearFilter(year);
        setMajorId(first?.majorId || "");
        setGroupId(offering ? first.id : ""); setOfferingId(offering?.id || "");
      })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải danh sách lớp. Hãy tải lại trang.")))
      .finally(() => active && setOptionsLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRows([]);
    setUnassessedRows(null);
    if (!groupId || !offeringId) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError("");
    axios.get(`${API_BASE_URL}/masters/exam-lists`, { params: {
      classGroupId: groupId, courseOfferingId: offeringId, rosterScope: "offering", page, pageSize: PAGE_SIZE, mode, search,
      ...(mode === "exam" ? { includeIds: examIncludeIds, excludeIds: examExcludeIds } : {}),
    } })
      .then(({ data }) => { if (active) {
        setWorkflow(data.workflow || { status: "draft", version: 0 });
        if (data.offering) setLoadedOffering({ id: offeringId, status: data.offering.status });
        refreshOfferingCompletion(data.offering);
        const refreshedDirty = { ...dirtyRef.current };
        setRows(data.rows.map(row => {
          const draft = row.profileForeignLanguageExempt || row.studyLeaveFailure || (data.workflow && data.workflow.status !== "draft") ? undefined : dirtyRef.current[row.participantId];
          if (row.profileForeignLanguageExempt || row.studyLeaveFailure) delete refreshedDirty[row.participantId];
          const merged = { ...row, ...draft, studyStatus: row.studyStatus, studyLeaveFailure: row.studyLeaveFailure, eligibilityPolicy: row.eligibilityPolicy, profileForeignLanguageExempt: row.profileForeignLanguageExempt };
          const next = { ...(draft ? updateGradeDraft(merged) : draftOf(row)), savedEligibility: row.eligible };
          if (draft) refreshedDirty[row.participantId] = next;
          return next;
        }));
        dirtyRef.current = refreshedDirty;
        setDirty(refreshedDirty);
        setUnassessedRows(data.unassessedRows ?? null);
        if (!Object.keys(dirtyRef.current).length) setRevision(data.revision);
        setTotal(data.total); setTotalRows(data.totalRows);
        if (data.page !== page) setPage(data.page);
      } })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải bảng điểm.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [groupId, offeringId, page, mode, search, examIncludeIds, examExcludeIds, policyRevision]);

  useEffect(() => {
    if (!dirtyCount) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  useEffect(() => {
    if (!catalogRevision) return undefined;
    let active = true;
    axios.get(`${API_BASE_URL}/masters/exam-lists/options`)
      .then(({ data }) => { if (active) { setGroups(data.groups || []); setSubjects(data.courseOfferings || []); } })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể làm mới thông tin học phần.")));
    return () => { active = false; };
  }, [catalogRevision]);

  const majors = [...new Map(groups.filter((group) => group.majorId).map((group) => [group.majorId, { id: group.majorId, name: group.major?.name || group.major?.code || group.majorId }])).values()];
  const classChoices = useMemo(() => subjects.flatMap((offering) => (offering.groupLinks || []).flatMap((link) => {
    const group = groups.find((item) => item.id === link.classGroupId);
    return group ? [{ key: `${group.id}:${offering.id}`, group, offering, subject: link.subject || offering.subject }] : [];
  })), [subjects, groups]);
  const years = [...new Set(groups.filter(group => !majorId || group.majorId === majorId)
    .map(group => group.academicYear).filter(Boolean))].sort().reverse();
  const visibleClasses = classChoices.filter(({ group }) => (!majorId || group.majorId === majorId)
    && (!yearFilter || group.academicYear === yearFilter));
  const offeringChoices = [...new Map(visibleClasses.map(entry => [entry.offering.id, entry])).values()]
    .sort((a, b) => Number(a.offering.examGradesComplete === true) - Number(b.offering.examGradesComplete === true));
  const selectedEntry = classChoices.find(entry => entry.key === `${groupId}:${offeringId}`);
  const year = selectedEntry?.group.academicYear || "";
  const teachingCompleted = (loadedOffering?.id === offeringId ? loadedOffering.status : selectedEntry?.offering.status) === "completed";
  useEffect(() => {
    if (canSubmitGrades && offeringId && !teachingCompleted) showCompletionWarning();
    else toast.dismiss(COMPLETION_WARNING_ID);
    return () => toast.dismiss(COMPLETION_WARNING_ID);
  }, [canSubmitGrades, offeringId, teachingCompleted]);
  const selectedName = subjectNameKey(selectedEntry?.subject);
  const offeringLabel = entry => {
    const classNames = (entry.offering.groupLinks || []).map(link => groups.find(group => group.id === link.classGroupId))
      .filter(Boolean).map(group => group.code || group.name);
    const name = entry.offering.name || entry.subject?.name || "Lớp học phần";
    return classNames.length && !classNames.every(value => name.includes(value)) ? `${name} — ${classNames.join(" + ")}` : name;
  };
  const linkedGroups = (selectedEntry?.offering.groupLinks || []).map(link => groups.find(group => group.id === link.classGroupId)).filter(Boolean);
  const selectedGroup = linkedGroups.length > 1 ? {
    ...selectedEntry?.group, name: linkedGroups.map(group => group.name).join(" + "), code: linkedGroups.map(group => group.code || group.name).join(" + "),
  } : selectedEntry?.group;
  const selectedOffering = selectedEntry ? { ...selectedEntry.offering, subject: selectedEntry.subject, subjectId: subjectKey(selectedEntry.subject) } : undefined;
  const visible = visibleGradeRows(rows, mode, "");
  const currentPage = page;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible;
  const examPrintReady = newWorkflow&&workflow.eligibility.status==='approved'&&!dirtyCount;
  const remainingUnassessed = unassessedRows === null ? null : Math.max(0, unassessedRows + Object.values(dirty).reduce(
    (count, row) => count + Number(row.eligible === null) - Number(row.savedEligibility == null), 0,
  ));
  useEffect(() => {
    if (mode !== "exam" || remainingUnassessed === null || !pendingExamWarning.current) return;
    pendingExamWarning.current = false;
    if (remainingUnassessed > 0) showMissingScoresWarning();
  }, [mode, remainingUnassessed]);
  const selectMode = (next) => {
    pendingExamWarning.current = next === "exam" && remainingUnassessed === null;
    if (next === "exam" && remainingUnassessed > 0) showMissingScoresWarning();
    else toast.dismiss(EXAM_WARNING_ID);
    setPage(1); setMode(next);
  };
  const examPrintRows = mode === "exam" && examPrintReady ? pageRows : [];
  const requestChange = (change) => { if (dirtyCount) setPendingChange(() => change); else change(); };
  const selectClass = (entry) => { pendingExamWarning.current = false; toast.dismiss(EXAM_WARNING_ID); setDirty({}); dirtyRef.current = {}; setSuccess(""); setPage(1); setGroupId(entry?.group.id || ""); setOfferingId(entry?.offering.id || ""); };
  const edit = (id, patch) => {
    if (!workflowEditable) return;
    if (!canSubmitGrades || !teachingCompleted) { if (canSubmitGrades) showCompletionWarning(); return; }
    if (rows.find(row => row.participantId === id)?.profileForeignLanguageExempt || rows.find(row => row.participantId === id)?.studyLeaveFailure) return;
    if(('testScore' in patch||'assignmentScore' in patch||'examExempt' in patch)&&!componentEditable)return;
    if('examScore' in patch&&(!resultEditable||!rows.find(row=>row.participantId===id)?.examScoreEditable))return;
    const apply = row => ["testScore", "assignmentScore", "examScore", "examExempt"].some(key => key in patch) ? updateGradeDraft({ ...row, ...patch }) : { ...row, ...patch };
    setRows((current) => current.map((row) => row.participantId === id ? apply(row) : row));
    const row = dirty[id] || rows.find(item => item.participantId === id);
    setDirty((current) => ({ ...current, [id]: apply(row) })); setSuccess("");
  };
  const runWorkflow = async () => {
    setSaving(true); setError("");
    try {
      await axios.post(`${API_BASE_URL}/masters/exam-lists/${workflowPhase}/workflow`, { classGroupId: groupId, courseOfferingId: offeringId,
        rosterScope: "offering", revision, version: workflow[workflowPhase==='final'?'final':'eligibility'].version, action: workflowAction, note: workflowNote });
      setWorkflowAction(""); setWorkflowNote(""); setPolicyRevision(value => value + 1);
      notifyGradebookSaved();
    } catch (failure) { setError(errorMessage(failure, "Không thể xử lý bảng điểm.")); }
    finally { setSaving(false); }
  };
  const loadHistory = async () => {
    try { const { data } = await axios.get(`${API_BASE_URL}/masters/exam-lists/history`, { params: { classGroupId: groupId, courseOfferingId: offeringId } }); setAuditRows(data); }
    catch (failure) { setError(errorMessage(failure, "Không tải được lịch sử.")); }
  };
  const save = async () => {
    if (!canSubmitGrades || !teachingCompleted) { if (canSubmitGrades) showCompletionWarning(); return; }
    const changed = Object.values(dirty);
    for (const row of changed) {
      const invalid = rowError(row);
      if (invalid) { setError(`${row.code || row.fullName}: ${invalid}`); return; }
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data } = await axios.put(`${API_BASE_URL}/masters/exam-lists`, {
        classGroupId: groupId, courseOfferingId: offeringId, rosterScope: "offering", revision, rows: changed.map(gradePayload),
        page, pageSize: PAGE_SIZE, mode, search,
      });
      setRows(data.rows.map(row => ({ ...draftOf(row), savedEligibility: row.eligible }))); setRevision(data.revision); setDirty({}); dirtyRef.current = {};
      refreshOfferingCompletion(data.offering);
      setTotal(data.total); setTotalRows(data.totalRows); setPage(data.page);
      setUnassessedRows(data.unassessedRows ?? null);
      setSuccess(`Đã cập nhật bảng điểm cho ${changed.length} học viên.`);
      notifyGradebookSaved();
    } catch (failure) {
      if (failure.response?.data?.code === "TEACHING_NOT_COMPLETED") {
        setLoadedOffering({ id: offeringId, status: "active" });
        showCompletionWarning();
      } else setError(errorMessage(failure, "Không thể lưu bảng điểm. Các điểm vừa nhập vẫn được giữ trên màn hình."));
    }
    finally { setSaving(false); }
  };
  const exportGradebook = async (format) => {
    if (!groupId || !offeringId || !total || optionsLoading || loading || saving || exporting) return;
    if (mode === "exam" && !examPrintReady) return;
    setExporting(true); setError("");
    let previewTab;
    try {
      if (format === "pdf") {
        // Reserve the tab during the click, before network requests lose user activation.
        previewTab = window.open("about:blank", "_blank");
        if (!previewTab) throw new Error("Trình duyệt đã chặn tab xem trước. Vui lòng cho phép mở tab mới và chọn PDF / In lại.");
        previewTab.opener = null;
      }
      const exported = await fetchAllGradebookRows(params => axios.get(`${API_BASE_URL}/masters/exam-lists`, { params }), {
        classGroupId: groupId, courseOfferingId: offeringId, rosterScope: "offering", mode, search,
        ...(mode === "exam" ? { includeIds, excludeIds } : {}),
      }, () => workflow.status === "draft" ? dirtyRef.current : {});
      if (mode === "exam") {
        const document = buildExamListDocument(selectedGroup, selectedOffering, exported);
        if (!document.rows.length) throw new Error("Không có học viên đủ tư cách và không miễn thi để in.");
        if (format === "excel") downloadDocumentFile(await createExamListExcel(document), gradebookFilename(selectedGroup, selectedOffering, "DS-thi"));
        else openGradebookPreview(document, previewTab);
        return;
      }
      const document = buildGradebookDocument(selectedGroup, selectedOffering, exported);
      if (format === "excel") downloadDocumentFile(await createGradebookExcel(document), gradebookFilename(selectedGroup, selectedOffering));
      else openGradebookPreview(document, previewTab);
    } catch (failure) { previewTab?.close(); setError(failure.response ? errorMessage(failure, "Không thể xuất bảng điểm.") : failure.message); }
    finally { setExporting(false); }
  };
  const blank = mode === "exam";
  const locked = !workflowEditable || !canSubmitGrades || !teachingCompleted || saving || exporting || blank;
  const columns = gradebookColumns(blank).map(column => calculatedColumns.has(column.key) ? {
    ...column, header: <span className="exam-calculated-label">{column.key==='eligible'?(newWorkflow&&workflow.eligibility.status==='approved'?'Tư cách đã duyệt':'Tư cách dự kiến'):column.label}</span>,
  } : column);
  const busy = optionsLoading || loading;

  return <FeatureLayout title="Danh sách thi, điểm thi" group="Quá trình học tập" maxWidth={1880}>
    <Box className="exam-gradebook" data-exam-print-blocked={blank && !examPrintReady ? "true" : undefined}>
      <ToastContainer containerId={EXAM_WARNING_CONTAINER} enableMultiContainer position="top-right" autoClose={5000}
        newestOnTop limit={1} className="exam-warning-toast-container exam-no-print" toastClassName="exam-warning-toast"
        progressClassName="exam-warning-progress" />
      <Paper variant="outlined" sx={{ ...panelSx, p: 1, mb: 1 }} className="exam-no-print">
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Chuyên ngành" value={majorId} disabled={optionsLoading || saving || exporting} sx={{ flex: "0 1 240px", minWidth: 180 }} onChange={(event) => {
            const next = event.target.value;
            requestChange(() => {
              setMajorId(next);
              const nextYear = groups.some(group => (!next || group.majorId === next) && group.academicYear === yearFilter) ? yearFilter : "";
              setYearFilter(nextYear);
              const candidates = classChoices.filter(({ group }) => (!next || group.majorId === next)
                && (!nextYear || group.academicYear === nextYear));
              selectClass(candidates.find(entry => entry.offering.id === offeringId)
                || candidates.find(entry => subjectNameKey(entry.subject) === selectedName) || candidates[0]);
            });
          }}><MenuItem value="">Tất cả chuyên ngành</MenuItem>{majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}</FilterSelectField>
          <FilterSelectField label="Năm" value={yearFilter} disabled={optionsLoading || saving || exporting} sx={{ flex: "0 0 110px", minWidth: 110 }} onChange={(event) => {
            const next = event.target.value;
            requestChange(() => {
              setYearFilter(next);
              const candidates = classChoices.filter(({ group }) => (!majorId || group.majorId === majorId)
                && (!next || group.academicYear === next));
              selectClass(candidates.find(entry => entry.offering.id === offeringId)
                || candidates.find(entry => subjectNameKey(entry.subject) === selectedName) || candidates[0]);
            });
          }}><MenuItem value="">Tất cả năm</MenuItem>{years.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</FilterSelectField>
          <FilterSelectField label="Tên lớp học phần" value={offeringChoices.some(entry => entry.offering.id === offeringId) ? offeringId : ""}
            disabled={optionsLoading || saving || exporting || !offeringChoices.length} sx={{ flex: "1 1 500px", minWidth: 260 }}
            selectSx={{ height: 38, "& .MuiSelect-select": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", py: 0, pr: "34px !important" } }}
            MenuProps={{ PaperProps: { sx: { maxWidth: "calc(100vw - 32px)", "& .MuiMenuItem-root": { whiteSpace: "normal", overflowWrap: "anywhere" } } } }}
            renderValue={value => { const entry = offeringChoices.find(entry => entry.offering.id === value); return entry ? offeringLabel(entry) : 'Chưa có lớp học phần'; }}
            onChange={(event) => { const value = event.target.value; requestChange(() => selectClass(offeringChoices.find(entry => entry.offering.id === value))); }}>
            {!offeringChoices.length && <MenuItem value="">Chưa có lớp học phần</MenuItem>}
            {offeringChoices.flatMap((entry, index) => [
              ...(index === 0 || Boolean(offeringChoices[index - 1].offering.examGradesComplete) !== Boolean(entry.offering.examGradesComplete)
                ? [<OfferingGroupHeader key={`heading-${entry.offering.id}`}>{entry.offering.examGradesComplete ? 'ĐÃ HOÀN TẤT' : 'CẦN HOÀN THIỆN'}</OfferingGroupHeader>] : []),
              <MenuItem key={entry.offering.id} value={entry.offering.id} className={entry.offering.examGradesComplete ? 'exam-offering-completed' : ''}
                sx={entry.offering.examGradesComplete ? { color: '#8796a5', '&.Mui-selected': { color: '#526a82', bgcolor: '#edf3f8' } } : undefined}>{offeringLabel(entry)}</MenuItem>,
            ])}
          </FilterSelectField>
          <FilterSelectField label="Môn" value={subjectKey(selectedEntry?.subject)} disabled sx={{ flex: "0 1 220px", minWidth: 180 }}>
            <MenuItem value={subjectKey(selectedEntry?.subject)}>{selectedEntry ? subjectLabel(selectedEntry.subject) : "Chưa có môn học"}</MenuItem>
          </FilterSelectField>
          <FilterSearchField placeholder="Mã HV, họ tên..." value={search} disabled={saving || exporting} onChange={(event) => { setPage(1); setSearch(event.target.value); }} sx={{ flex: "0 0 200px", minWidth: 200 }} />
        </Stack>
      </Paper>

      <div className="exam-workspace-controls exam-no-print">
      {legacyWorkflow&&<Alert severity="info">Bảng điểm cũ được bảo toàn, chỉ xem trong quy trình mới. Cần rà soát trước khi chuyển đổi; không tự suy diễn danh sách thi hoặc ca thi đã diễn ra.</Alert>}
      {newWorkflow&&mode==='exam'&&workflow.eligibility.status!=='approved'&&<Alert severity="info">DS thi chỉ hiển thị sau khi duyệt tư cách thi. Tư cách dự kiến chưa phải danh sách được phép xếp thi.</Alert>}
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" className="exam-workflow-toolbar">
      <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
        <Chip label={legacyWorkflow?'Dữ liệu cũ — cần rà soát':({draft:'Tư cách nháp',submitted:'Tư cách chờ duyệt',approved:'DS thi đã duyệt'}[workflow.eligibility?.status]||'Đang tải quy trình')} />
        {newWorkflow&&workflow.eligibility.status!=='approved'&&<Typography variant="caption">Chưa đến giai đoạn nhập điểm thi.</Typography>}
        {newWorkflow&&canSubmitGrades&&componentEditable&&<Button disabled={busy||saving||dirtyCount>0||!teachingCompleted||!offeringId} onClick={()=>beginWorkflow('eligibility','submit')}>Gửi duyệt tư cách</Button>}
        {newWorkflow&&canApproveGrades&&workflow.eligibility.status==='submitted'&&<Button disabled={busy||saving||dirtyCount>0} onClick={()=>beginWorkflow('eligibility','approve')}>Duyệt tư cách</Button>}
        {newWorkflow&&canApproveGrades&&workflow.eligibility.status!=='draft'&&<Button disabled={busy||saving} onClick={()=>beginWorkflow('eligibility','reopen')}>Mở lại tư cách</Button>}
        {newWorkflow&&workflow.eligibility.status==='approved'&&<>
          <Chip label={{not_available:'Chờ ca thi diễn ra',draft:'Kết quả nháp',submitted:'Kết quả chờ duyệt',approved:'Kết quả đã duyệt'}[workflow.final.status]} />
          {can('gradebook.view')&&<Button component={Link} to={`/masters/exam-schedule?offeringId=${offeringId}`}>Xếp lịch thi</Button>}
          {canSubmitGrades&&workflow.final.status==='draft'&&<Button disabled={busy||saving||dirtyCount>0} onClick={()=>beginWorkflow('final','submit')}>Gửi duyệt kết quả</Button>}
          {canApproveGrades&&workflow.final.status==='submitted'&&<Button disabled={busy||saving} onClick={()=>beginWorkflow('final','approve')}>Duyệt kết quả</Button>}
          {canApproveGrades&&['submitted','approved'].includes(workflow.final.status)&&<Button disabled={busy||saving} onClick={()=>beginWorkflow('final','reopen')}>Mở lại kết quả</Button>}
        </>}
        <Button disabled={!offeringId || saving} onClick={loadHistory}>Lịch sử điểm</Button>
      </Stack>
          <DocumentExportMenu disabled={!groupId || !offeringId || !total || busy || saving || exporting || (blank && !examPrintReady)}
            excelLabel="Excel (.xlsx)" pdfLabel="PDF / In" onExcel={() => exportGradebook("excel")} onPdf={() => exportGradebook("pdf")} />
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} className="exam-view-toolbar">
        <Stack direction="row" flexWrap="wrap" gap={0.5} aria-label="Chế độ bảng điểm">
          {Object.entries(modes).map(([key, label]) => <Button key={key} startIcon={<ListAltRounded />} disabled={saving || exporting} variant={mode === key ? "contained" : "outlined"} aria-pressed={mode === key} onClick={() => selectMode(key)} sx={{ boxShadow: "none", ...(mode === key ? { bgcolor: "#173E75" } : { bgcolor: "#fff" }) }}>{label}</Button>)}
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center">
          <Button variant="contained" startIcon={<SaveRounded />} disabled={!workflowEditable || !canSubmitGrades || !teachingCompleted || !dirtyCount || saving || exporting || busy} onClick={save} sx={{ bgcolor: "#0788B8", boxShadow: "none" }}>{saving ? "Đang lưu..." : "Cập nhật cả bảng"}</Button>
          <Tooltip title="Cài đặt điểm số">
            <span><IconButton aria-label="Cài đặt điểm số" disabled={optionsLoading} onClick={() => setSettingsOpen(true)} size="small"
              sx={{ color: "#173E75", width: 34, height: 34, "&:hover": { bgcolor: "#EDF4FA" } }}><SettingsRounded fontSize="small" /></IconButton></span>
          </Tooltip>
          <Chip size="small" label={`${total} / ${totalRows} học viên`} sx={{ bgcolor: "#EDF4FA", color: "#173E75" }} />{dirtyCount > 0 && <Chip size="small" color="warning" variant="outlined" label={`${dirtyCount} học viên chưa lưu`} />}
        </Stack>
      </Stack>
      </div>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {blank && !busy && !examPrintReady && dirtyCount > 0 && <Alert severity="info" sx={{ mb: 1.5 }} className="exam-no-print">
        Cập nhật cả bảng để lưu tư cách trước khi in danh sách thi.
      </Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }} className="exam-no-print">{success}</Alert>}
      <Paper variant="outlined" sx={{ ...panelSx, overflow: "hidden" }}>
        {busy ? <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={30} aria-label="Đang tải bảng điểm" /></Box> : !groupId || !offeringId ? <Box className="exam-empty-scope" role="status">
          <Typography component="h1">Chưa chọn lớp học phần</Typography>
          <Typography>Chọn lớp học phần và môn ở phía trên để xem bảng điểm.</Typography>
        </Box> : <TableContainer sx={{ overflowX: "auto" }} className="exam-table-container exam-no-print" onPointerDownCapture={() => { if (canSubmitGrades && !teachingCompleted) showCompletionWarning(); }}>
          <ResizableTable columns={columns} storageKey="masters-exam-gradebook-columns" freezeThrough="firstName">
            <TableBody>{!visible.length ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#607486" }}>{!groupId ? "Chưa có lớp học viên." : !offeringId ? "Lớp chưa có học phần được tổ chức. Hãy tạo lớp học phần để nhập điểm." : "Không có học viên phù hợp với danh sách đang chọn."}</TableCell></TableRow> : pageRows.map((row, index) => {
              const name = personNameParts(row);
              const rowLocked = locked || !!row.profileForeignLanguageExempt || !!row.studyLeaveFailure;
              return <TableRow key={row.participantId} hover sx={{ "& td": { fontSize: 12.5, py: 0.75, borderColor: "#E2EBF2" }, ...(dirty[row.participantId] ? { bgcolor: "#FFFDF5" } : {}) }}>
                <TableCell align="center">{pageStart + index + 1}</TableCell><TableCell sx={{ fontWeight: 600 }}>{row.code || "—"}
                  {["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn"].includes(row.studyStatus) && <Typography component="span" variant="caption" display="block" sx={{ color: "#B86216", fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{row.studyStatus}</Typography>}
                </TableCell>
                <TableCell title={name.familyAndMiddle}>{name.familyAndMiddle}</TableCell><TableCell>{name.givenName}</TableCell>
                <TableCell align="center">{displayGradeDate(row.dob)}</TableCell><TableCell align="center">{row.gender || "—"}</TableCell>
                <TableCell align="center" className="exam-derived-cell"><Checkbox size="small" disabled checked={row.eligible === true} inputProps={{ "aria-label": `Tư cách thi ${row.code}` }} sx={{ "&.Mui-checked.Mui-disabled": { color: "#0788B8" } }} />
                  {row.eligible !== true && <Typography variant="caption" component="div">{row.examExempt ? "Miễn thi" : row.eligible === false ? "Không đủ tư cách" : "Chưa đủ điểm"}</Typography>}
                </TableCell>
                <TableCell align="center" title={row.profileForeignLanguageExempt ? "Miễn thi ngoại ngữ theo hồ sơ học viên" : undefined}><Checkbox size="small" disabled={rowLocked||!componentEditable} checked={row.examExempt} inputProps={{ "aria-label": `Miễn thi ${row.code}` }} onChange={(event) => edit(row.participantId, { examExempt: event.target.checked, result: event.target.checked ? "exempt" : "pending" })} /></TableCell>
                {!blank && <>{SCORE_FIELDS.map(([key, label, max]) => {
                  const disabled = rowLocked || (['testScore','assignmentScore'].includes(key)?!componentEditable:key==='examScore'?!resultEditable||!row.examScoreEditable:true);
                  const cellClass = key === 'examScore' ? (disabled ? 'exam-derived-cell exam-score-locked' : 'exam-editable-cell') : calculatedColumns.has(key) ? 'exam-derived-cell' : undefined;
                  return <TableCell key={key} align="center" className={cellClass}>
                  <TextField fullWidth size="small" value={blank ? "" : row[key]} disabled={disabled} InputProps={{ readOnly: ["courseScore", "grade4"].includes(key) }} error={!blank && numericScore(row[key]) !== null && (!Number.isFinite(numericScore(row[key])) || numericScore(row[key]) < 0 || numericScore(row[key]) > max)} onChange={["courseScore", "grade4"].includes(key) ? undefined : (event) => { const value = event.target.value; const score = numericScore(value); if (value === "" || (/^\d*(?:[.,]\d*)?$/.test(value) && Number.isFinite(score) && score >= 0 && score <= max)) edit(row.participantId, { [key]: value }); }} onBlur={calculatedColumns.has(key) ? undefined : (event) => { const value = formatScore(event.target.value, max); if (value !== row[key]) edit(row.participantId, { [key]: value }); }} inputProps={{ "aria-label": `${label} ${row.code}`, inputMode: "decimal" }} sx={inputSx} />
                </TableCell>;
                })}
                <TableCell className="exam-derived-cell"><TextField fullWidth size="small" value={blank ? "" : row.letterGrade} disabled={rowLocked || (row.eligible === false && !row.examExempt)} InputProps={{ readOnly: true }} inputProps={{ "aria-label": `Thang điểm chữ ${row.code}`, maxLength: 10 }} sx={inputSx} /></TableCell>
                <TableCell className="exam-derived-cell"><TextField fullWidth size="small" value={blank ? "" : formatAttemptScores(row.attemptScores)} disabled={rowLocked || (row.eligible === false && !row.examExempt)} InputProps={{ readOnly: true }} inputProps={{ "aria-label": `Điểm các lần thi ${row.code}` }} sx={inputSx} /></TableCell></>}
                {!blank && <TableCell className="exam-derived-cell"><TextField select fullWidth size="small" SelectProps={{ native: true }} value={row.result} disabled inputProps={{ "aria-label": `Kết quả điểm ${row.code}` }} sx={{ ...inputSx, "& select": { py: 0.5, fontSize: 12, color: row.result === "failed" ? "#B52D2D" : row.result === "passed" ? "#137B3B" : "#607486" } }}>
                  {Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{row.studyLeaveFailure && value === "failed" ? "Không đạt" : label}</option>)}
                </TextField></TableCell>}
                {blank && <TableCell><TextField fullWidth size="small" value={row.notes} disabled inputProps={{ "aria-label": `Ghi chú ${row.code}`, maxLength: 1000 }} sx={{ ...inputSx, "& input": { px: 0.75, py: 0.5, textAlign: "left" } }} /></TableCell>}
              </TableRow>;
            })}</TableBody>
          </ResizableTable>
        </TableContainer>}
        {!busy && visible.length > 0 && <ListPagination className="exam-no-print" count={total}
          page={currentPage - 1} pageSize={PAGE_SIZE} onPageChange={next => setPage(next + 1)}
          disabled={saving || exporting} recordLabel="học viên" showSinglePageSummary />}
        {blank && groupId && offeringId && <Box className="exam-print-sheet" sx={{ display: "none" }}>
          <table data-testid="exam-print-table" aria-label="Danh sách in">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{examPrintRows.map((row, index) => {
              const values = gradebookRowValues(row, pageStart + index, blank);
              return <tr key={row.participantId}>{values.map((value, cellIndex) => <td key={columns[cellIndex].key}>{value}</td>)}</tr>;
            })}</tbody>
          </table>
        </Box>}
      </Paper>
      <details className="exam-rules-disclosure exam-no-print"><summary>Quy tắc tính điểm và tư cách thi</summary>
      <Typography sx={{ color: "#607486", fontSize: 11.5 }}>Tư cách dự kiến dùng điểm thành phần và cấu hình hiện hành. Sau khi duyệt, DS thi và điểm thành phần được lưu cố định. Chưa đến giai đoạn nhập điểm thi khi chưa có ca thi được xác nhận Đã diễn ra. Không đủ tư cách thi được giữ nguyên quyết định, không tự chuyển thành 0/F. Kết quả cuối được gửi duyệt và mở lại riêng. Các ô nền xanh xám được tính tự động. Nháy đúp mép tiêu đề để tự căn độ rộng cột.</Typography>
      </details>
      {dirtyCount > 0 && !blank && <Alert severity="warning" sx={{ mt: 1 }} className="exam-no-print">Bạn có điểm chưa lưu. Bảng điểm Excel và PDF sử dụng các điểm vừa nhập.</Alert>}
      {settingsOpen && <GradeSettingsDialog canEdit={canEditPolicy} initialMajorId={majorId} initialYear={year} groups={groups} onClose={() => setSettingsOpen(false)} />}
      <AppDialog
        open={!!workflowAction}
        onClose={() => setWorkflowAction("")}
        title={`${{submit:'Gửi duyệt',approve:'Duyệt',reopen:'Mở lại'}[workflowAction]} ${workflowPhase==='eligibility'?'tư cách thi':'kết quả cuối'}`}
        saving={saving}
        onConfirm={runWorkflow}
        confirmText="Xác nhận"
        confirmDisabled={!workflowNote.trim()}
      >
        <Typography component="label" htmlFor="exam-workflow-note" sx={{ display: "block", mb: "6px", color: "#435b72", fontSize: "13px", fontWeight: 700, lineHeight: 1.5, textTransform: "uppercase" }}>
          Lý do hoặc căn cứ
        </Typography>
        <TextField
          id="exam-workflow-note" autoFocus fullWidth multiline minRows={3}
          placeholder="Nhập lý do hoặc căn cứ..."
          inputProps={{ "aria-label": "Lý do hoặc căn cứ" }}
          value={workflowNote} disabled={saving} onChange={event => setWorkflowNote(event.target.value)}
          sx={{ "& .MuiInputBase-input:focus-visible": { outline: "none" } }}
        />
      </AppDialog>
      <Dialog open={auditRows !== null} onClose={() => setAuditRows(null)} fullWidth maxWidth="md">
        <DialogTitle>Lịch sử bảng điểm</DialogTitle><DialogContent>{(auditRows || []).map(event => <Box key={event.id} sx={{ mb: 2 }}>
          <Typography>{event.createdAt} · {event.actor?.name} · {{ save: "Lưu điểm", submit: "Gửi duyệt", approve: "Duyệt và khóa", reopen: "Mở lại" }[event.action]}</Typography><Typography>{event.note}</Typography>
          <details><summary>Kết quả tại thời điểm xử lý</summary>{(event.after?.snapshot?.rows || event.after?.grades || (Array.isArray(event.after) ? event.after : [])).map(row =>
            <Typography key={row.participantId}>{row.code || row.fullName || row.participantId}: {row.courseScore ?? "—"} · {RESULT_LABELS[row.result]}</Typography>)}</details>
        </Box>)}</DialogContent><DialogActions><Button onClick={() => setAuditRows(null)}>Đóng</Button></DialogActions>
      </Dialog>
      <ConfirmDialog
        open={Boolean(pendingChange)}
        onClose={() => setPendingChange(null)}
        title="Có điểm chưa lưu"
        content={`Bạn đã chỉnh sửa ${dirtyCount} học viên. Chuyển lựa chọn sẽ bỏ các thay đổi này.`}
        cancelText="Ở lại"
        confirmText="Bỏ thay đổi và tiếp tục"
        severity="warning"
        onConfirm={() => {
          const change = pendingChange;
          setPendingChange(null);
          setDirty({});
          change();
        }}
      />
    </Box>
  </FeatureLayout>;
}
