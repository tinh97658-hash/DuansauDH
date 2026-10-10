import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Stack, TableBody, TableCell, TableContainer, TableRow, TextField, Typography } from "@mui/material";
import { DownloadRounded, ListAltRounded, SaveRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import ResizableTable from "../../components/ResizableTable";
import DocumentExportMenu from "../../components/DocumentExportMenu";
import { downloadDocumentFile } from "../../utils/documentFiles";
import { buildGradebookDocument, createGradebookExcel, fetchAllGradebookRows, gradebookFilename, openGradebookPreview } from "../../features/exams/gradebookExport";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate, draftOf, gradebookColumns, gradebookCsv, gradebookRowValues, gradePayload, numericScore, RESULT_LABELS, rowError, SCORE_FIELDS } from "../../features/exams/gradebook";
import "../../features/exams/gradebook.css";

const panelSx = { borderColor: "#D7E4EE", borderRadius: "10px", bgcolor: "#fff", boxShadow: "0 2px 6px rgba(18,59,98,.07)" };
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
const errorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
};

export default function ExamLists() {
  const [groups, setGroups] = useState([]), [subjects, setSubjects] = useState([]);
  const [majorId, setMajorId] = useState("");
  const [year, setYear] = useState(""), [groupId, setGroupId] = useState(""), [offeringId, setOfferingId] = useState("");
  const [rows, setRows] = useState([]), [revision, setRevision] = useState(0), [dirty, setDirty] = useState({});
  const [mode, setMode] = useState("all"), [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0), [totalRows, setTotalRows] = useState(0);
  const [exporting, setExporting] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const includeIds = Object.values(dirty).filter(row => row.eligible === true && !row.examExempt).map(row => row.participantId).join(",");
  const excludeIds = Object.values(dirty).filter(row => row.eligible !== true || row.examExempt).map(row => row.participantId).join(",");
  const examIncludeIds = mode === "exam" ? includeIds : "", examExcludeIds = mode === "exam" ? excludeIds : "";
  const [role, setRole] = useState(""), [optionsLoading, setOptionsLoading] = useState(true), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState(""), [pendingChange, setPendingChange] = useState(null);
  const canEdit = role === "admin" || role === "examiner";
  const dirtyCount = Object.keys(dirty).length;

  useEffect(() => {
    let active = true;
    Promise.all([axios.get(`${API_BASE_URL}/masters/exam-lists/options`), axios.get(`${API_BASE_URL}/auth/isStaff`)])
      .then(([options, auth]) => {
        if (!active) return;
        const list = options.data.groups || [];
        const offerings = options.data.courseOfferings || [];
        setGroups(list); setSubjects(offerings); setRole(auth.data.message || "");
        const first = list[0];
        const offering = offerings.find((item) => item.groupLinks?.some((link) => link.classGroupId === first?.id));
        setMajorId(first?.majorId || ""); setYear(first?.academicYear || "");
        setGroupId(offering ? first.id : ""); setOfferingId(offering?.id || "");
      })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải danh sách lớp. Hãy tải lại trang.")))
      .finally(() => active && setOptionsLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRows([]);
    if (!groupId || !offeringId) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError("");
    axios.get(`${API_BASE_URL}/masters/exam-lists`, { params: {
      classGroupId: groupId, courseOfferingId: offeringId, page, pageSize: PAGE_SIZE, mode, search,
      ...(mode === "exam" ? { includeIds: examIncludeIds, excludeIds: examExcludeIds } : {}),
    } })
      .then(({ data }) => { if (active) {
        setRows(data.rows.map(row => dirtyRef.current[row.participantId] || draftOf(row)));
        if (!Object.keys(dirtyRef.current).length) setRevision(data.revision);
        setTotal(data.total); setTotalRows(data.totalRows);
        if (data.page !== page) setPage(data.page);
      } })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải bảng điểm.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [groupId, offeringId, page, mode, search, examIncludeIds, examExcludeIds]);

  useEffect(() => {
    if (!dirtyCount) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const majors = [...new Map(groups.filter((group) => group.majorId).map((group) => [group.majorId, { id: group.majorId, name: group.major?.name || group.major?.code || group.majorId }])).values()];
  const majorGroups = groups.filter((group) => !majorId || group.majorId === majorId);
  const years = [...new Set(majorGroups.map((group) => group.academicYear || ""))].sort().reverse();
  const classChoices = useMemo(() => subjects.flatMap((offering) => (offering.groupLinks || []).flatMap((link) => {
    const group = groups.find((item) => item.id === link.classGroupId);
    return group ? [{ key: `${group.id}:${offering.id}`, group, offering }] : [];
  })), [subjects, groups]);
  const visibleClasses = classChoices.filter(({ group }) => (!majorId || group.majorId === majorId) && (group.academicYear || "") === year);
  const subjectKey = (offering) => offering?.subjectId || offering?.subject?.id || offering?.subject?.code || "";
  const subjectChoices = [...new Map(visibleClasses.map(({ offering }) => [subjectKey(offering), offering.subject])).entries()];
  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedOffering = subjects.find((subject) => subject.id === offeringId);
  const visible = rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible;
  const examPrintRows = mode === "exam" ? pageRows : [];
  const requestChange = (change) => { if (dirtyCount) setPendingChange(() => change); else change(); };
  const selectClass = (entry) => { setDirty({}); dirtyRef.current = {}; setSuccess(""); setPage(1); setGroupId(entry?.group.id || ""); setOfferingId(entry?.offering.id || ""); };
  const edit = (id, patch) => {
    setRows((current) => current.map((row) => row.participantId === id ? { ...row, ...patch } : row));
    const row = dirty[id] || rows.find(item => item.participantId === id);
    setDirty((current) => ({ ...current, [id]: { ...row, ...patch } })); setSuccess("");
  };
  const save = async () => {
    const changed = Object.values(dirty);
    for (const row of changed) {
      const invalid = rowError(row);
      if (invalid) { setError(`${row.code || row.fullName}: ${invalid}`); return; }
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data } = await axios.put(`${API_BASE_URL}/masters/exam-lists`, {
        classGroupId: groupId, courseOfferingId: offeringId, revision, rows: changed.map(gradePayload),
        page, pageSize: PAGE_SIZE, mode, search,
      });
      setRows(data.rows.map(draftOf)); setRevision(data.revision); setDirty({}); dirtyRef.current = {};
      setTotal(data.total); setTotalRows(data.totalRows); setPage(data.page);
      setSuccess(`Đã cập nhật bảng điểm cho ${changed.length} học viên.`);
    } catch (failure) { setError(errorMessage(failure, "Không thể lưu bảng điểm. Các điểm vừa nhập vẫn được giữ trên màn hình.")); }
    finally { setSaving(false); }
  };
  const download = async () => {
    setExporting(true); setError("");
    try {
      const exported = await fetchAllGradebookRows(params => axios.get(`${API_BASE_URL}/masters/exam-lists`, { params }), {
        classGroupId: groupId, courseOfferingId: offeringId, mode, search,
        ...(mode === "exam" ? { includeIds, excludeIds } : {}),
      }, () => dirtyRef.current);
      const url = URL.createObjectURL(new Blob([gradebookCsv(exported, mode === "exam")], { type: "text/csv;charset=utf-8;" }));
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `${mode === "exam" ? "ds-thi" : "ca-bang-diem"}-${selectedGroup?.code || "lop"}-${selectedOffering?.subject?.code || "hoc-phan"}.csv`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.response ? errorMessage(failure, "Không thể xuất danh sách.") : failure.message); }
    finally { setExporting(false); }
  };
  const exportGradebook = async (format) => {
    if (!groupId || !offeringId || !total || optionsLoading || loading || saving || exporting) return;
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
        classGroupId: groupId, courseOfferingId: offeringId, mode: "all", search,
      }, () => dirtyRef.current);
      const document = buildGradebookDocument(selectedGroup, selectedOffering, exported);
      if (format === "excel") downloadDocumentFile(await createGradebookExcel(document), gradebookFilename(selectedGroup, selectedOffering));
      else openGradebookPreview(document, previewTab);
    } catch (failure) { previewTab?.close(); setError(failure.response ? errorMessage(failure, "Không thể xuất bảng điểm.") : failure.message); }
    finally { setExporting(false); }
  };
  const blank = mode === "exam";
  const locked = !canEdit || saving || exporting || blank;
  const columns = gradebookColumns(blank);
  const busy = optionsLoading || loading;

  return <FeatureLayout title="Danh sách thi, điểm thi" group="Quá trình học tập" maxWidth={1880}>
    <Box className="exam-gradebook">
      <Paper variant="outlined" sx={{ ...panelSx, p: 1.5, mb: 1.5 }} className="exam-no-print">
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Chuyên ngành" value={majorId} disabled={optionsLoading || saving || exporting} sx={{ flex: "2 1 220px", minWidth: 180 }} onChange={(event) => {
            const next = event.target.value;
            requestChange(() => {
              const scopedGroups = groups.filter((group) => !next || group.majorId === next);
              const nextYear = scopedGroups.some((group) => (group.academicYear || "") === year) ? year : scopedGroups[0]?.academicYear || "";
              setMajorId(next); setYear(nextYear);
              selectClass(classChoices.find(({ group }) => (!next || group.majorId === next) && (group.academicYear || "") === nextYear));
            });
          }}><MenuItem value="">Tất cả chuyên ngành</MenuItem>{majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}</FilterSelectField>
          <FilterSelectField label="Năm" value={year} disabled={optionsLoading || saving || exporting} sx={{ flex: "1 1 100px", minWidth: 100 }} onChange={(event) => {
            const next = event.target.value;
            requestChange(() => { setYear(next); selectClass(classChoices.find(({ group }) => (!majorId || group.majorId === majorId) && (group.academicYear || "") === next)); });
          }}>{!years.length && <MenuItem value="">Chưa có năm tuyển sinh</MenuItem>}{years.map((value) => <MenuItem key={value} value={value}>{value || "Chưa có năm"}</MenuItem>)}</FilterSelectField>
          <FilterSelectField label="Lớp học phần" value={groupId && offeringId ? `${groupId}:${offeringId}` : ""} disabled={optionsLoading || saving || exporting || !visibleClasses.length} sx={{ flex: "3 1 280px", minWidth: 230 }} onChange={(event) => { const value = event.target.value; requestChange(() => selectClass(visibleClasses.find((entry) => entry.key === value))); }}>
            {!visibleClasses.length && <MenuItem value="">Chưa có lớp học phần</MenuItem>}{visibleClasses.map((entry) => <MenuItem key={entry.key} value={entry.key}>{entry.offering.name || entry.offering.subject?.name} · {entry.group.name}</MenuItem>)}
          </FilterSelectField>
          <FilterSelectField label="Môn" value={subjectKey(selectedOffering)} disabled={optionsLoading || saving || exporting || !subjectChoices.length} sx={{ flex: "2 1 220px", minWidth: 180 }} onChange={(event) => { const value = event.target.value; requestChange(() => selectClass(visibleClasses.find((entry) => subjectKey(entry.offering) === value))); }}>
            {!subjectChoices.length && <MenuItem value="">Chưa có môn học</MenuItem>}{subjectChoices.map(([id, subject]) => <MenuItem key={id} value={id}>{subject?.name}</MenuItem>)}
          </FilterSelectField>
          <FilterSearchField placeholder="Tìm theo mã HV, họ tên..." value={search} disabled={saving || exporting} onChange={(event) => { setPage(1); setSearch(event.target.value); }} sx={{ flex: "2 1 250px", minWidth: 230 }} />
        </Stack>
      </Paper>

      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }} className="exam-no-print">
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Button variant="contained" startIcon={<SaveRounded />} disabled={!canEdit || !dirtyCount || saving || exporting || busy} onClick={save} sx={{ bgcolor: "#0788B8", boxShadow: "none", borderRadius: "7px" }}>{saving ? "Đang lưu..." : "Cập nhật cả bảng"}</Button>
          {Object.entries(modes).map(([key, label]) => <Button key={key} startIcon={<ListAltRounded />} disabled={saving || exporting} variant={mode === key ? "contained" : "outlined"} onClick={() => { setPage(1); setMode(key); }} sx={{ borderRadius: "7px", boxShadow: "none", ...(mode === key ? { bgcolor: "#173E75" } : { bgcolor: "#fff" }) }}>{label}</Button>)}
        </Stack>
        <Stack direction="row" gap={0.75}>
          {mode === "all" ? <DocumentExportMenu disabled={!groupId || !offeringId || !total || busy || saving || exporting}
            excelLabel="Excel (.xlsx)" pdfLabel="PDF / In" onExcel={() => exportGradebook("excel")} onPdf={() => exportGradebook("pdf")} />
            : <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!total || busy || saving || exporting} onClick={download}>{exporting ? "Đang xuất..." : "Xuất CSV"}</Button>}
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }} className="exam-no-print">{success}</Alert>}
      <Paper variant="outlined" sx={{ ...panelSx, overflow: "hidden" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ p: 1.5, borderBottom: "1px solid #D7E4EE" }}>
          <Box><Typography component="h1" sx={{ fontSize: 15, fontWeight: 700, color: "#173E75", m: 0 }}>{modes[mode].toLocaleUpperCase("vi")}</Typography>
            <Typography sx={{ fontSize: 12, color: "#607486", mt: 0.25 }}>{[selectedGroup?.name, selectedOffering?.subject?.name].filter(Boolean).join(" · ") || "Chọn lớp và học phần để xem danh sách thi."}</Typography>
          </Box>
          <Stack direction="row" gap={0.75} className="exam-no-print"><Chip size="small" label={`${total} / ${totalRows} học viên`} sx={{ bgcolor: "#EDF4FA", color: "#173E75" }} />{dirtyCount > 0 && <Chip size="small" color="warning" variant="outlined" label={`${dirtyCount} học viên chưa lưu`} />}</Stack>
        </Stack>
        {busy ? <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={30} aria-label="Đang tải bảng điểm" /></Box> : <TableContainer sx={{ overflowX: "auto" }} className="exam-table-container exam-no-print">
          <ResizableTable columns={columns} storageKey="masters-exam-gradebook-columns" freezeThrough="firstName">
            <TableBody>{!visible.length ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#607486" }}>{!groupId ? "Chưa có lớp học viên." : !offeringId ? "Lớp chưa có học phần được tổ chức. Hãy tạo lớp học phần để nhập điểm." : "Không có học viên phù hợp với danh sách đang chọn."}</TableCell></TableRow> : pageRows.map((row, index) => {
              const name = personNameParts(row);
              return <TableRow key={row.participantId} hover sx={{ "& td": { fontSize: 12.5, py: 0.75, borderColor: "#E2EBF2" }, ...(dirty[row.participantId] ? { bgcolor: "#FFFDF5" } : {}) }}>
                <TableCell align="center">{pageStart + index + 1}</TableCell><TableCell sx={{ fontWeight: 600 }}>{row.code || "—"}</TableCell>
                <TableCell title={name.familyAndMiddle}>{name.familyAndMiddle}</TableCell><TableCell>{name.givenName}</TableCell>
                <TableCell align="center">{displayGradeDate(row.dob)}</TableCell><TableCell align="center">{row.gender || "—"}</TableCell>
                <TableCell align="center"><Checkbox size="small" disabled={locked} indeterminate={row.eligible == null} checked={row.eligible === true} inputProps={{ "aria-label": `Tư cách thi ${row.code}` }} onChange={(event) => edit(row.participantId, { eligible: event.target.checked })} /></TableCell>
                <TableCell align="center"><Checkbox size="small" disabled={locked} checked={row.examExempt} inputProps={{ "aria-label": `Miễn thi ${row.code}` }} onChange={(event) => edit(row.participantId, { examExempt: event.target.checked, result: event.target.checked ? "exempt" : "pending" })} /></TableCell>
                {!blank && <>{SCORE_FIELDS.map(([key, label, max]) => <TableCell key={key} align="center" sx={{ bgcolor: "#F7FAFC" }}>
                  <TextField fullWidth size="small" value={blank ? "" : row[key]} disabled={locked} error={!blank && numericScore(row[key]) !== null && (!Number.isFinite(numericScore(row[key])) || numericScore(row[key]) < 0 || numericScore(row[key]) > max)} onChange={(event) => edit(row.participantId, { [key]: event.target.value })} inputProps={{ "aria-label": `${label} ${row.code}`, inputMode: "decimal" }} sx={inputSx} />
                </TableCell>)}
                <TableCell><TextField fullWidth size="small" value={blank ? "" : row.letterGrade} disabled={locked} onChange={(event) => edit(row.participantId, { letterGrade: event.target.value.toUpperCase() })} inputProps={{ "aria-label": `Thang điểm chữ ${row.code}`, maxLength: 10 }} sx={inputSx} /></TableCell>
                <TableCell><TextField fullWidth size="small" value={blank ? "" : row.attemptScores} disabled={locked} onChange={(event) => edit(row.participantId, { attemptScores: event.target.value })} inputProps={{ "aria-label": `Điểm các lần thi ${row.code}` }} sx={inputSx} /></TableCell></>}
                <TableCell><TextField select fullWidth size="small" SelectProps={{ native: true }} value={blank ? "pending" : row.result} disabled={locked || row.examExempt} onChange={(event) => edit(row.participantId, { result: event.target.value })} inputProps={{ "aria-label": `Kết quả điểm ${row.code}` }} sx={{ ...inputSx, "& select": { py: 0.5, fontSize: 12, color: row.result === "failed" ? "#B52D2D" : row.result === "passed" ? "#137B3B" : "#607486" } }}>
                  {Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{blank ? "" : label}</option>)}
                </TextField></TableCell>
              </TableRow>;
            })}</TableBody>
          </ResizableTable>
        </TableContainer>}
        {!busy && visible.length > 0 && <Box className="exam-no-print" sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 1, minHeight: 48, px: 1.5, py: 0.75, borderTop: "1px solid #D7E4EE" }}>
          <Typography variant="caption" sx={{ color: "#607486", fontWeight: 600, position: { xs: "static", md: "absolute" }, left: 16 }}>
            Hiển thị {pageStart + 1}–{pageStart + pageRows.length} trên {total} học viên
          </Typography>
          {totalPages > 1 && <Pagination
            page={currentPage} count={totalPages} disabled={saving || exporting} onChange={(_event, value) => setPage(value)}
            color="primary" size="medium" showFirstButton showLastButton
            sx={{ "& .MuiPaginationItem-root": { minWidth: 38, height: 38, fontSize: 14, fontWeight: 600 } }}
          />}
        </Box>}
        {blank && <Box className="exam-print-sheet" sx={{ display: "none" }}>
          <table data-testid="exam-print-table" aria-label="Danh sách in">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{examPrintRows.map((row, index) => {
              const values = gradebookRowValues(row, pageStart + index, blank);
              return <tr key={row.participantId}>{values.map((value, cellIndex) => <td key={columns[cellIndex].key}>{value}</td>)}</tr>;
            })}</tbody>
          </table>
        </Box>}
      </Paper>
      <Typography sx={{ mt: 1, color: "#607486", fontSize: 11.5 }} className="exam-no-print">Tư cách thi: dấu gạch là chưa xét. Điểm học phần, thang 4 và điểm chữ được nhập trực tiếp. Nháy đúp mép tiêu đề để tự căn độ rộng cột.</Typography>
      {dirtyCount > 0 && <Alert severity="warning" sx={{ mt: 1 }} className="exam-no-print">Bạn có điểm chưa lưu. {mode === "all" ? "Excel và PDF sử dụng các điểm vừa nhập." : "Danh sách in và CSV sử dụng các điểm vừa nhập."}</Alert>}
      <Dialog open={Boolean(pendingChange)} onClose={() => setPendingChange(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "#173E75", fontSize: 16 }}>Có điểm chưa lưu</DialogTitle>
        <DialogContent>Bạn đã chỉnh sửa {dirtyCount} học viên. Chuyển lựa chọn sẽ bỏ các thay đổi này.</DialogContent>
        <DialogActions><Button onClick={() => setPendingChange(null)}>Ở lại</Button><Button color="warning" onClick={() => { const change = pendingChange; setPendingChange(null); setDirty({}); change(); }}>Bỏ thay đổi và tiếp tục</Button></DialogActions>
      </Dialog>
    </Box>
  </FeatureLayout>;
}
