import { notify } from "../../utils/notify";
import { usePermissions } from "../../features/accounts/usePermissions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { dashboardGradeScope } from "../../features/dashboard/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { DocumentCheckIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ClockIcon, Cog6ToothIcon } from "../../components/AppIcons";
import GradeSettingsDialog from "../../features/exams/GradeSettingsDialog";
import GradebookHistoryDialog from "../../features/exams/GradebookHistoryDialog";
import GradebookStageNotice from "../../features/exams/GradebookStageNotice";
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
import { downloadReport } from "../../utils/reportExport";
import { buildExamListDocument, createExamListExcel, createExamListWord } from "../../features/exams/examListExport";
import { buildSubjectSigningDocument, createSubjectSigningExcel, createSubjectSigningWord, openSubjectSigningPreview, subjectSigningFilename } from "../../features/exams/subjectSigningExport";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate, draftOf, formatAttemptScores, formatScore, gradebookColumns, gradebookRowValues, gradePayload, isExamCandidate, numericScore, RESULT_LABELS, rowError, SCORE_FIELDS, updateGradeDraft, visibleGradeRows } from "../../features/exams/gradebook";
import "../../features/exams/gradebook.css";
import { useSubjectCatalogRevision } from "../../utils/subjectCatalog";
import { notifyGradebookSaved } from "../../utils/gradebookRevision";
import { useUnsavedGrades, UNSAVED_GRADE_MESSAGE } from "../../components/UnsavedChangesGuard";
import { hasGradeChanges } from "../../utils/gradebookNavigation";
import { navigateScoreGrid } from "../../utils/scoreGridNavigation";

import { stageOf, sortOfferingChoices } from "../../features/exams/offeringStages";
import { offeringOptions, useOfferingMenu } from "../../features/exams/OfferingOptions";

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
const modes = { all: "Bảng điểm", exam: "Danh sách thi" };
const PAGE_SIZE = 15;
const EXAM_WARNING_ID = "exam-missing-component-scores";
const EXAM_WARNING_CONTAINER = "exam-gradebook-warnings";
const COMPLETION_WARNING_MESSAGE = "Vui lòng xác nhận hoàn thành giảng dạy trước khi nhập điểm.";
const subjectNameKey = subject => (subject?.name || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const subjectKey = subject => subject?.id || subject?.code || "";
const subjectLabel = subject => [subject?.code, subject?.name].filter(Boolean).join(" - ");
const showMissingScoresWarning = () => {
  const message = "Hãy nhập đủ điểm thành phần cho tất cả học viên!";
  if (toast.isActive(EXAM_WARNING_ID)) toast.update(EXAM_WARNING_ID, { render: message, autoClose: 5000 });
  else toast.warn(message, { toastId: EXAM_WARNING_ID, containerId: EXAM_WARNING_CONTAINER });
};
const calculatedColumns = new Set(["eligible", "courseScore", "grade4", "letter", "attempts", "result"]);

const errorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
};

export default function ExamLists() {
  const offeringMenu = useOfferingMenu();
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
  const [workflowPhase,setWorkflowPhase]=useState('final');
  const newWorkflow=workflow.mode==='new',legacyWorkflow=workflow.mode==='legacy_preserved';
  const componentEditable=newWorkflow&&!['submitted','approved'].includes(workflow.final.status);
  const resultEditable=newWorkflow&&workflow.eligibility.status==='approved'&&workflow.final.status==='draft';
  const workflowEditable=componentEditable||resultEditable;
  const workflowNeedsNote = ['reopen', 'request_reopen', 'reject_reopen'].includes(workflowAction);
  const beginWorkflow=(phase,action)=>{setWorkflowNote('');setWorkflowPhase(phase);setWorkflowAction(action);};
  const [auditRows, setAuditRows] = useState(null);
  const [groups, setGroups] = useState([]), [subjects, setSubjects] = useState([]);
  const [loadedOffering, setLoadedOffering] = useState(null);
  const [majorId, setMajorId] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [groupId, setGroupId] = useState(""), [offeringId, setOfferingId] = useState("");
  const [rows, setRows] = useState([]), [revision, setRevision] = useState(0), [dirty, setDirty] = useState({});
  const savedRows = useRef(new Map());
  const [mode, setMode] = useState("all"), [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0), [totalRows, setTotalRows] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [unassessedRows, setUnassessedRows] = useState(null);
  const workflowReminderToast = useRef(null);
  const completionWarningToast = useRef(null);
  const showCompletionWarning = () => {
    const id = completionWarningToast.current;
    if (id !== null && toast.isActive(id)) toast.update(id, { render: COMPLETION_WARNING_MESSAGE, autoClose: 5000 });
    else completionWarningToast.current = toast.warn(COMPLETION_WARNING_MESSAGE, { containerId: EXAM_WARNING_CONTAINER });
  };
  const dismissCompletionWarning = () => {
    if (completionWarningToast.current !== null) toast.dismiss(completionWarningToast.current);
  };
  const pendingExamWarning = useRef(false);
  const includeIds = Object.values(dirty).filter(isExamCandidate).map(row => row.participantId).join(",");
  const excludeIds = Object.values(dirty).filter(row => !isExamCandidate(row)).map(row => row.participantId).join(",");
  const examIncludeIds = mode === "exam" ? includeIds : "", examExcludeIds = mode === "exam" ? excludeIds : "";
  const [optionsLoading, setOptionsLoading] = useState(true), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [pendingChange, setPendingChange] = useState(null);
  const canSubmitGrades = can("gradebook.submit");
  const canApproveGrades = can("gradebook.approve");
  const canEditPolicy = can("gradebook.policy");
  const refreshOfferingCompletion = offering => {
    if (!offering) return;
    setSubjects(previous => previous.map(item => item.id === offering.id ? { ...item,
      ...(offering.status ? { status: offering.status } : {}),
      ...(offering.gradebookStage ? { gradebookStage: offering.gradebookStage } : {}),
      ...(typeof offering.examGradesComplete === 'boolean' ? { examGradesComplete: offering.examGradesComplete } : {}),
      ...(offering.gradebookCompletionStatus ? { gradebookCompletionStatus: offering.gradebookCompletionStatus } : {}),
    } : item));
  };
  const dirtyCount = Object.keys(dirty).length;
  useUnsavedGrades(dirtyCount > 0);

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
        if (data.offering) setLoadedOffering({ id: offeringId, status: data.offering.status, examScheduling: data.offering.examScheduling });
        refreshOfferingCompletion(data.offering);
        const refreshedDirty = { ...dirtyRef.current };
        setRows(data.rows.map(row => {
          savedRows.current.set(row.participantId, draftOf(row));
          const draft = row.canEditGrade === false || row.profileForeignLanguageExempt || row.studyLeaveFailure || (data.workflow && data.workflow.status !== "draft") ? undefined : dirtyRef.current[row.participantId];
          if (row.canEditGrade === false || row.profileForeignLanguageExempt || row.studyLeaveFailure) delete refreshedDirty[row.participantId];
          const merged = { ...row, ...draft, canEditGrade: row.canEditGrade, studyStatus: row.studyStatus, studyLeaveFailure: row.studyLeaveFailure, eligibilityPolicy: row.eligibilityPolicy, profileForeignLanguageExempt: row.profileForeignLanguageExempt };
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
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
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
  const offeringChoices = sortOfferingChoices([...new Map(visibleClasses.map(entry => [entry.offering.id, entry])).values()]);
  const selectedEntry = classChoices.find(entry => entry.key === `${groupId}:${offeringId}`);
  const year = selectedEntry?.group.academicYear || "";
  const teachingCompleted = (loadedOffering?.id === offeringId ? loadedOffering.status : selectedEntry?.offering.status) === "completed";
  const studying = !!selectedEntry && stageOf(selectedEntry.offering).group === 0;
  useEffect(() => {
    if (offeringId && studying) showCompletionWarning();
    else dismissCompletionWarning();
  }, [offeringId, studying]);
  useEffect(() => () => dismissCompletionWarning(), []);
  const selectedName = subjectNameKey(selectedEntry?.subject);
  const offeringLabel = entry => {
    const classNames = (entry.offering.groupLinks || []).map(link => groups.find(group => group.id === link.classGroupId))
      .filter(Boolean).map(group => group.code || group.name);
    const duplicate = offeringChoices.filter(item => item.offering.name === entry.offering.name && item.group.id === entry.group.id).length > 1;
    const name = (duplicate ? `${entry.offering.name} [${entry.offering.id.slice(0, 8)}]` : entry.offering.name) || entry.subject?.name || "Lớp học phần";
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
  const selectClass = (entry) => { pendingExamWarning.current = false; toast.dismiss(EXAM_WARNING_ID); setDirty({}); dirtyRef.current = {};  setPage(1); setGroupId(entry?.group.id || ""); setOfferingId(entry?.offering.id || ""); };
  const edit = (id, patch) => {
    if (!workflowEditable) return;
    if (!canSubmitGrades || !teachingCompleted) { if (canSubmitGrades) showCompletionWarning(); return; }
    if (rows.find(row => row.participantId === id)?.canEditGrade === false || rows.find(row => row.participantId === id)?.profileForeignLanguageExempt || rows.find(row => row.participantId === id)?.studyLeaveFailure) return;
    if(('testScore' in patch||'assignmentScore' in patch||'examExempt' in patch)&&!componentEditable)return;
    if('examScore' in patch&&(!resultEditable||!rows.find(row=>row.participantId===id)?.examScoreEditable))return;
    const apply = row => ["testScore", "assignmentScore", "examScore", "examExempt"].some(key => key in patch) ? updateGradeDraft(row, patch) : { ...row, ...patch };
    setRows((current) => current.map((row) => row.participantId === id ? apply(row) : row));
    const row = dirty[id] || rows.find(item => item.participantId === id);
    const changed = apply(row);
    setDirty((current) => {
      const next = { ...current };
      if (hasGradeChanges(savedRows.current.get(id), changed)) next[id] = changed;
      else delete next[id];
      dirtyRef.current = next;
      return next;
    });
  };
  const formatInput = (id, key) => {
    const format = row => ({ ...row, [key]: formatScore(row[key]) });
    setRows(current => current.map(row => row.participantId === id ? format(row) : row));
    setDirty(current => current[id] ? { ...current, [id]: format(current[id]) } : current);
  };
  const runWorkflow = async () => {
    setSaving(true); setError("");
    try {
      await axios.post(`${API_BASE_URL}/masters/exam-lists/${workflowPhase}/workflow`, { classGroupId: groupId, courseOfferingId: offeringId,
        rosterScope: "offering", revision, version: workflow[workflowPhase==='final'?'final':'eligibility'].version, action: workflowAction, note: workflowNote });
      setWorkflowAction(""); setWorkflowNote(""); setPolicyRevision(value => value + 1);
      notifyGradebookSaved();
    } catch (failure) {
      if (workflowPhase === 'eligibility' && workflowAction === 'submit') setWorkflowAction("");
      notify.error(errorMessage(failure, "Không thể xử lý bảng điểm."));
    }
    finally { setSaving(false); }
  };
  const loadHistory = async () => {
    try { const { data } = await axios.get(`${API_BASE_URL}/masters/exam-lists/history`, { params: { classGroupId: groupId, courseOfferingId: offeringId } }); setAuditRows(data); }
    catch (failure) { notify.error(errorMessage(failure, "Không tải được lịch sử.")); }
  };
  const save = async () => {
    if (!canSubmitGrades || !teachingCompleted) { if (canSubmitGrades) showCompletionWarning(); return; }
    const changed = Object.values(dirty);
    for (const row of changed) {
      const invalid = rowError(row);
      if (invalid) { setError(`${row.code || row.fullName}: ${invalid}`); return; }
    }
    setSaving(true); setError("");
    try {
      const { data } = await axios.put(`${API_BASE_URL}/masters/exam-lists`, {
        classGroupId: groupId, courseOfferingId: offeringId, rosterScope: "offering", revision, rows: changed.map(gradePayload),
        page, pageSize: PAGE_SIZE, mode, search,
      });
      setRows(data.rows.map(row => { const saved = draftOf(row); savedRows.current.set(row.participantId, saved); return { ...saved, savedEligibility: row.eligible }; })); setRevision(data.revision); setDirty({}); dirtyRef.current = {};
      if (data.workflow) setWorkflow(data.workflow);
      if (data.offering) setLoadedOffering(data.offering);
      refreshOfferingCompletion(data.offering);
      setTotal(data.total); setTotalRows(data.totalRows); setPage(data.page);
      setUnassessedRows(data.unassessedRows ?? null);
      notify.success(`Đã cập nhật bảng điểm cho ${changed.length} học viên.`);
      notifyGradebookSaved();
    } catch (failure) {
      if (failure.response?.data?.code === "TEACHING_NOT_COMPLETED") {
        setLoadedOffering({ id: offeringId, status: "active" });
        showCompletionWarning();
      } else notify.error(errorMessage(failure, "Không thể lưu bảng điểm. Các điểm vừa nhập vẫn được giữ trên màn hình."));
    }
    finally { setSaving(false); }
  };
  const exportFile = async (format) => {
    if (!groupId || !offeringId || !total || optionsLoading || loading || saving || exporting) return;
    const isExamList = mode === "exam";
    if (isExamList && !examPrintReady) return;
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
        ...(isExamList ? { includeIds, excludeIds } : {}),
      }, () => workflow.status === "draft" ? dirtyRef.current : {});
      const document = isExamList ? buildExamListDocument(selectedGroup, selectedOffering, exported)
        : buildGradebookDocument(selectedGroup, selectedOffering, exported);
      if (!document.rows.length) throw new Error(isExamList ? "Không có học viên đủ tư cách và không miễn thi để in." : "Không có dữ liệu bảng điểm để xuất.");
      if (format === "excel") downloadDocumentFile(await (isExamList ? createExamListExcel(document) : createGradebookExcel(document)), gradebookFilename(selectedGroup, selectedOffering, isExamList ? "DS-thi" : undefined));
      else if (format === "word" && isExamList) downloadDocumentFile(await createExamListWord(document), gradebookFilename(selectedGroup, selectedOffering, "DS-thi").replace(/\.xlsx$/, ".docx"));
      else if (format === "word") await downloadReport({ title: document.title, metadata: [["Lớp", document.group], ["Học phần", document.subject]],
        sections: [{ title: document.title, headers: document.headers, rows: document.rows }] }, "word");
      else openGradebookPreview(document, previewTab);
    } catch (failure) { previewTab?.close(); notify.error(failure.response ? errorMessage(failure, isExamList ? "Không thể xuất danh sách thi." : "Không thể xuất bảng điểm.") : failure.message); }
    finally { setExporting(false); }
  };
  const blank = mode === "exam";
  const exportSigningSheet = async format => {
    if (!groupId || !offeringId || !totalRows || busy || saving || exporting || dirtyCount || blank) return;
    setExporting(true); setError("");
    let previewTab;
    try {
      if (format === "pdf") {
        previewTab = window.open("about:blank", "_blank");
        if (!previewTab) throw new Error("Trình duyệt đã chặn tab xem trước. Vui lòng cho phép mở tab mới và thử lại.");
        previewTab.opener = null;
      }
      const exported = await fetchAllGradebookRows(params => axios.get(`${API_BASE_URL}/masters/exam-lists`, { params }), {
        classGroupId: groupId, courseOfferingId: offeringId, rosterScope: "offering", mode: "all", search: "",
      });
      if (!exported.length) throw new Error("Lớp học phần chưa có học viên để xuất phiếu ký.");
      const document = buildSubjectSigningDocument(linkedGroups.length ? linkedGroups : [selectedGroup], selectedOffering, exported);
      if (format === "pdf") openSubjectSigningPreview(document, previewTab);
      else downloadDocumentFile(await (format === "word" ? createSubjectSigningWord(document) : createSubjectSigningExcel(document)), subjectSigningFilename(document, format));
    } catch (failure) { previewTab?.close(); notify.error(failure.response ? errorMessage(failure, "Không thể xuất phiếu ký.") : failure.message); }
    finally { setExporting(false); }
  };
  const locked = !workflowEditable || !canSubmitGrades || !teachingCompleted || saving || exporting || blank;
  const columnWidths = { index: 44, code: 112, lastName: 180, firstName: 90, dob: 104, gender: 72,
    eligible: blank ? 104 : 124, exempt: 76, testScore: 96, assignmentScore: 112, examScore: 112,
    courseScore: 100, grade4: 76, letter: 92, attempts: 152, result: 136, notes: 360 };
  const columns = gradebookColumns(blank).map(column => {
    const label = column.key === 'eligible'
      ? 'Tư cách thi'
      : column.label;
    return { ...column, width: columnWidths[column.key],
      minWidth: column.key === 'index' ? 40 : column.key === 'notes' ? 240 : Math.min(columnWidths[column.key], column.minWidth || 72),
      stretch: blank ? column.key === 'notes' : column.key === 'lastName',
      ...(calculatedColumns.has(column.key) ? { header: <span className="exam-calculated-label">{label}</span> } : {}),
      ...(['letter', 'attempts', 'result'].includes(column.key) ? { align: 'center' } : {}),
    };
  });
  const busy = optionsLoading || loading;
  const eligibilityLabel = { draft: 'Chưa đủ điểm thành phần', submitted: 'Cần lưu lại điểm', approved: 'Tư cách thi tự động' }[workflow.eligibility?.status] || 'Đang tải quy trình';
  const needsLockNotice = newWorkflow && selectedEntry?.offering.gradebookCompletionStatus === 'needs_lock' && workflow.final.status !== 'approved';
  let workflowReminder = '';
  if (!error && !dirtyCount && teachingCompleted && totalRows > 0 && newWorkflow && loadedOffering?.id === offeringId) {
    if (workflow.eligibility.status === 'approved' && workflow.final.status !== 'approved' && loadedOffering.examScheduling?.remainingCount > 0)
      workflowReminder = 'Đã tính tư cách thi. Vui lòng xếp lịch thi cho học viên đủ tư cách.';
  }
  useEffect(() => {
    if (workflowReminderToast.current && workflowReminderToast.current.offeringId !== offeringId) {
      toast.clearWaitingQueue({ containerId: EXAM_WARNING_CONTAINER });
      toast.dismiss(workflowReminderToast.current.id);
      workflowReminderToast.current = null;
    }
    // Keep the current toast while refreshing so the next phase replaces it in place.
    if (busy || saving) return;
    if (!workflowReminder) {
      if (workflowReminderToast.current) {
        toast.clearWaitingQueue({ containerId: EXAM_WARNING_CONTAINER });
        toast.dismiss(workflowReminderToast.current.id);
      }
      workflowReminderToast.current = null;
    } else if (workflowReminderToast.current && toast.isActive(workflowReminderToast.current.id)) {
      toast.update(workflowReminderToast.current.id, { render: workflowReminder, autoClose: 5000 });
    } else {
      toast.clearWaitingQueue({ containerId: EXAM_WARNING_CONTAINER });
      workflowReminderToast.current = { offeringId, id: toast.warn(workflowReminder, { containerId: EXAM_WARNING_CONTAINER }) };
    }
  }, [workflowReminder, offeringId, revision, busy, saving]);
  useEffect(() => () => {
    toast.clearWaitingQueue({ containerId: EXAM_WARNING_CONTAINER });
    if (workflowReminderToast.current) toast.dismiss(workflowReminderToast.current.id);
  }, []);

  return <FeatureLayout title="Danh sách thi, điểm thi" group="Quá trình học tập" maxWidth={1880} exportConfig={false}>
    <Box className="exam-gradebook" data-exam-print-blocked={blank && !examPrintReady ? "true" : undefined}>
      <ToastContainer containerId={EXAM_WARNING_CONTAINER} enableMultiContainer position="top-right" autoClose={5000}
        newestOnTop limit={1} className="exam-warning-toast-container exam-no-print" toastClassName="app-toast exam-warning-toast"
         />
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
            inputRef={offeringMenu.inputRef} MenuProps={offeringMenu.menuProps}
            renderValue={value => { const entry = offeringChoices.find(entry => entry.offering.id === value); return entry ? offeringLabel(entry) : 'Chưa có lớp học phần'; }}
            onChange={(event) => { const value = event.target.value; requestChange(() => selectClass(offeringChoices.find(entry => entry.offering.id === value))); }}>
            {!offeringChoices.length && <MenuItem value="">Chưa có lớp học phần</MenuItem>}
            {offeringOptions(offeringChoices, offeringLabel, entry => {
              if (entry.offering.id === offeringId && stageOf(entry.offering).group === 0) showCompletionWarning();
            })}
          </FilterSelectField>
          <FilterSelectField label="Môn" value={subjectKey(selectedEntry?.subject)} disabled sx={{ flex: "0 1 220px", minWidth: 180 }}>
            <MenuItem value={subjectKey(selectedEntry?.subject)}>{selectedEntry ? subjectLabel(selectedEntry.subject) : "Chưa có môn học"}</MenuItem>
          </FilterSelectField>
          <FilterSearchField placeholder="Mã HV, họ tên..." value={search} disabled={saving || exporting} onChange={(event) => { setPage(1); setSearch(event.target.value); }} sx={{ flex: "0 0 200px", minWidth: 200 }} />
        </Stack>
      </Paper>

      <div className="exam-workspace-controls exam-no-print">
      <div className="exam-main-toolbar">
        <div className="exam-mode-switch" role="group" aria-label="Chế độ bảng điểm">
          {Object.entries(modes).map(([key, label]) => <Button key={key} startIcon={<ClipboardDocumentListIcon />} disabled={saving || exporting} variant={mode === key ? "contained" : "outlined"} aria-pressed={mode === key} onClick={() => selectMode(key)}>{label}</Button>)}
        </div>
        <div className="exam-toolbar-status">
          {busy ? <Typography role="status">Đang tải...</Typography> : !selectedEntry ? <Typography role="status">Chưa chọn lớp học phần</Typography> : <>
            {legacyWorkflow ? <Typography role="status" title="Bảng điểm cũ được bảo toàn, chỉ xem trong quy trình mới. Cần rà soát trước khi chuyển đổi; không tự suy diễn danh sách thi hoặc ca thi đã diễn ra.">Dữ liệu cũ · Chỉ xem</Typography>
              : blank ? <Typography role="status" title={newWorkflow && workflow.eligibility.status !== 'approved' ? 'Danh sách thi tự động cập nhật sau khi lưu đủ điểm thành phần.' : undefined}>{eligibilityLabel} · {total}/{totalRows} học viên</Typography>
                : needsLockNotice ? <Typography role="status" className="exam-status-warning" title="Đã lưu đủ điểm thi hết môn. Cần gửi duyệt và duyệt kết quả để khóa điểm.">{workflow.final.status === 'submitted' ? 'Chờ duyệt / khóa điểm' : 'Đủ điểm thi · Cần gửi duyệt kết quả'}</Typography>
                  : <GradebookStageNotice offering={selectedEntry?.offering} />}
            {(!blank || legacyWorkflow) && <Typography className="exam-student-count">{total}/{totalRows} học viên</Typography>}
            {newWorkflow && workflow.eligibility.reopenRequest && <Typography variant="caption" title={workflow.eligibility.reopenRequest.note}>Chờ duyệt mở lại tư cách</Typography>}
          </>}
          {dirtyCount > 0 && <Chip size="small" color="warning" variant="outlined" label={`${dirtyCount} học viên chưa lưu`} title={blank ? 'Chuyển sang Bảng điểm và cập nhật cả bảng để lưu thay đổi trước khi in danh sách thi.' : undefined} />}
        </div>
        <div className="exam-tool-actions">
        {newWorkflow&&workflow.eligibility.status==='approved'&&<>
          {can('exams.view')&&workflow.final.status!=='approved'&&loadedOffering?.id===offeringId&&loadedOffering.examScheduling?.candidateCount>0&&(loadedOffering.examScheduling.remainingCount>0||workflow.final.status==='not_available')&&<Button startIcon={<CalendarDaysIcon />} component={Link} to={`/masters/exam-schedule?offeringId=${offeringId}`}>{loadedOffering.examScheduling.remainingCount>0?'Xếp lịch thi':'Xem lịch thi'}</Button>}
          {!blank&&canSubmitGrades&&workflow.final.status==='draft'&&<Button disabled={busy||saving||dirtyCount>0} onClick={()=>beginWorkflow('final','submit')}>Gửi duyệt kết quả</Button>}
          {!blank&&canApproveGrades&&workflow.final.status==='submitted'&&<Button disabled={busy||saving} onClick={()=>beginWorkflow('final','approve')}>Duyệt và khóa điểm</Button>}
          {!blank&&canApproveGrades&&['submitted','approved'].includes(workflow.final.status)&&<Button disabled={busy||saving} onClick={()=>beginWorkflow('final','reopen')}>Mở lại kết quả</Button>}
        </>}
        {!blank && <Button startIcon={<ClockIcon />} disabled={!offeringId || saving} onClick={loadHistory}>Lịch sử điểm</Button>}
          {blank && <DocumentExportMenu label="Danh sách thi" title="Xuất lịch thi kết thúc học phần" disabled={!groupId || !offeringId || !total || busy || saving || exporting || !examPrintReady}
            onWord={() => exportFile("word")} onExcel={() => exportFile("excel")} onPdf={() => exportFile("pdf")} />}
          {!blank && <Tooltip title={dirtyCount ? "Lưu các điểm đang chỉnh sửa trước khi xuất phiếu ký" : "Xuất phiếu theo dõi tình hình học tập — BM.02-QT.SDH.03"}><span>
            <DocumentExportMenu label="Xuất báo cáo" title="Xuất phiếu theo dõi tình hình học tập — BM.02-QT.SDH.03" disabled={!groupId || !offeringId || !totalRows || busy || saving || exporting || !!dirtyCount}
              onWord={() => exportSigningSheet("word")} onExcel={() => exportSigningSheet("excel")} onPdf={() => exportSigningSheet("pdf")} />
          </span></Tooltip>}
          {!blank && <Button startIcon={<DocumentCheckIcon />} disabled={!workflowEditable || !canSubmitGrades || !teachingCompleted || (!dirtyCount && !(newWorkflow && workflow.eligibility.status !== 'approved' && totalRows > 0 && unassessedRows === 0)) || saving || exporting || busy} onClick={save}>{saving ? "Đang lưu..." : "Cập nhật cả bảng"}</Button>}
          <Tooltip title="Cài đặt điểm số">
            <span><IconButton aria-label="Cài đặt điểm số" disabled={optionsLoading} onClick={() => setSettingsOpen(true)} size="small"
              sx={{ color: "#173E75", width: 34, height: 34, "&:hover": { bgcolor: "#EDF4FA" } }}><Cog6ToothIcon fontSize="small" /></IconButton></span>
          </Tooltip>
        </div>
      </div>
      </div>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!blank && (componentEditable || resultEditable) && <Typography className="exam-no-print" variant="caption" sx={{ display: "block", mb: 0.75, color: "text.secondary" }}>
        Người phụ trách một lớp thành viên có thể nhập điểm cho toàn bộ lớp ghép. Dùng ↑ ↓ ← → để chuyển giữa các ô điểm có thể nhập trên trang hiện tại.
      </Typography>}
      <Paper variant="outlined" sx={{ ...panelSx, overflow: "hidden" }}>
        {busy ? <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={30} aria-label="Đang tải bảng điểm" /></Box> : !groupId || !offeringId ? <Box className="exam-empty-scope" role="status">
          <Typography component="h1">Chưa chọn lớp học phần</Typography>
          <Typography>Chọn lớp học phần và môn ở phía trên để xem bảng điểm.</Typography>
        </Box> : <TableContainer sx={{ overflowX: "auto" }} className="exam-table-container exam-no-print" onKeyDown={navigateScoreGrid} onPointerDownCapture={() => { if (canSubmitGrades && !teachingCompleted) showCompletionWarning(); }}>
          <ResizableTable columns={columns} storageKey="masters-exam-gradebook-columns" freezeThrough="firstName">
            <TableBody>{!visible.length ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#607486" }}>{!groupId ? "Chưa có lớp học viên." : !offeringId ? "Lớp chưa có học phần được tổ chức. Hãy tạo lớp học phần để nhập điểm." : "Không có học viên phù hợp với danh sách đang chọn."}</TableCell></TableRow> : pageRows.map((row, index) => {
              const name = personNameParts(row);
              const rowLocked = locked || row.canEditGrade === false || !!row.profileForeignLanguageExempt || !!row.studyLeaveFailure;
              return <TableRow key={row.participantId} hover sx={{ "& td": { fontSize: 12.5, py: 0.75, borderColor: "#E2EBF2" }, ...(dirty[row.participantId] ? { bgcolor: "#FFFDF5" } : {}) }}>
                <TableCell align="center">{pageStart + index + 1}</TableCell><TableCell sx={{ fontWeight: 500 }}>{row.code || "—"}
                  {row.canEditGrade === false && <Typography component="span" variant="caption" display="block" sx={{color:'text.secondary'}}>Chỉ xem</Typography>}
                  {["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn"].includes(row.studyStatus) && <Typography component="span" variant="caption" display="block" sx={{ color: "#B86216", fontWeight: 500, fontSize: 11, whiteSpace: "nowrap" }}>{row.studyStatus}</Typography>}
                </TableCell>
                <TableCell title={name.familyAndMiddle}>{name.familyAndMiddle}</TableCell><TableCell title={name.givenName}>{name.givenName}</TableCell>
                <TableCell align="center">{displayGradeDate(row.dob)}</TableCell><TableCell align="center">{row.gender || "—"}</TableCell>
                <TableCell align="center" className="exam-derived-cell"><Checkbox size="small" disabled checked={row.eligible === true} inputProps={{ "aria-label": `Tư cách thi ${row.code}` }} sx={{ "&.Mui-checked.Mui-disabled": { color: "#0788B8" } }} />
                  {row.eligible !== true && <Typography variant="caption" component="div">{row.examExempt ? "Miễn thi" : row.eligible === false ? "Không đủ tư cách" : "Chưa đủ điểm"}</Typography>}
                </TableCell>
                <TableCell align="center" title={row.profileForeignLanguageExempt ? "Miễn thi ngoại ngữ theo hồ sơ học viên" : undefined}><Checkbox size="small" disabled={rowLocked||!componentEditable} checked={row.examExempt} inputProps={{ "aria-label": `Miễn thi ${row.code}` }} onChange={(event) => edit(row.participantId, { examExempt: event.target.checked, result: event.target.checked ? "exempt" : "pending" })} /></TableCell>
                {!blank && <>{SCORE_FIELDS.map(([key, label, max]) => {
                  const disabled = rowLocked || (['testScore','assignmentScore'].includes(key)?!componentEditable:key==='examScore'?!resultEditable||!row.examScoreEditable:true);
                  const cellClass = key === 'examScore' ? (disabled ? 'exam-derived-cell exam-score-locked' : 'exam-editable-cell') : calculatedColumns.has(key) ? 'exam-derived-cell' : undefined;
                  return <TableCell key={key} align="center" className={cellClass}>
                  <TextField fullWidth size="small" autoComplete="off" name={`grade-${offeringId}-${row.participantId}-${key}`} value={blank ? "" : row[key]} disabled={disabled} InputProps={{ readOnly: ["courseScore", "grade4"].includes(key) }} error={!blank && numericScore(row[key]) !== null && (!Number.isFinite(numericScore(row[key])) || numericScore(row[key]) < 0 || numericScore(row[key]) > max)} onChange={["courseScore", "grade4"].includes(key) ? undefined : (event) => { const value = event.target.value; const score = numericScore(value); if (value === "" || (/^\d*(?:[.,]\d*)?$/.test(value) && Number.isFinite(score) && score >= 0 && score <= max)) edit(row.participantId, { [key]: value }); }} onBlur={calculatedColumns.has(key) ? undefined : () => formatInput(row.participantId, key)} inputProps={{ "data-score-column": key, "aria-label": `${label} ${row.code}`, inputMode: "decimal", autoCorrect: "off", autoCapitalize: "off", spellCheck: false }} sx={inputSx} />
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
      <Typography sx={{ color: "#607486", fontSize: 11.5 }}>Tư cách thi tự động cập nhật khi lưu đủ điểm thành phần, không cần duyệt trước khi thi. Có thể sửa điểm thành phần cho đến khi gửi duyệt kết quả cuối. Điều kiện đạt so sánh điểm gốc và điểm học phần trước khi làm tròn với ngưỡng trong Cài đặt điểm số. Điểm thi chỉ nhập sau khi ca thi được xác nhận Đã diễn ra. Lịch thi đã xếp giữ nguyên danh sách tại thời điểm xếp; hãy kiểm tra lại lịch khi tư cách thi thay đổi. Kết quả cuối được gửi duyệt, duyệt và khóa điểm; mở lại kết quả cần lý do. Các ô nền xanh xám được tính tự động. Nháy đúp mép tiêu đề để tự căn độ rộng cột.</Typography>
      </details>
      {dirtyCount > 0 && !blank && <Alert severity="warning" sx={{ mt: 1 }} className="exam-no-print">Bạn có điểm chưa lưu.</Alert>}
      {settingsOpen && <GradeSettingsDialog canEdit={canEditPolicy} initialMajorId={majorId} initialYear={year} groups={groups} onClose={() => setSettingsOpen(false)} />}
      <AppDialog
        open={!!workflowAction}
        onClose={() => setWorkflowAction("")}
        title={`${{submit:'Gửi duyệt',approve:'Duyệt',reopen:'Mở lại',request_reopen:'Xin mở lại',reject_reopen:'Từ chối mở lại'}[workflowAction]} ${workflowPhase==='eligibility'?'tư cách thi':'kết quả cuối'}`}
        saving={saving}
        onConfirm={runWorkflow}
        confirmText="Xác nhận"
        confirmDisabled={workflowNeedsNote && !workflowNote.trim()}
      >
        {!workflowNeedsNote && <Typography>Xác nhận {workflowAction === 'submit' ? 'gửi duyệt' : 'duyệt'} {workflowPhase === 'eligibility' ? 'tư cách thi' : 'kết quả cuối'} của lớp học phần này?</Typography>}
        {workflowNeedsNote && <>
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
        </>}
      </AppDialog>
      {auditRows !== null && <GradebookHistoryDialog events={auditRows} onClose={() => setAuditRows(null)} />}
      <ConfirmDialog
        open={Boolean(pendingChange)}
        onClose={() => setPendingChange(null)}
        title="CÓ ĐIỂM CHƯA LƯU"
        content={UNSAVED_GRADE_MESSAGE}
        cancelText="Ở lại"
        confirmText="Bỏ thay đổi và tiếp tục"
        severity="warning"
        onConfirm={() => {
          const change = pendingChange;
          setPendingChange(null);
          setDirty({});
          dirtyRef.current = {};
          change();
        }}
      />
    </Box>
  </FeatureLayout>;
}
