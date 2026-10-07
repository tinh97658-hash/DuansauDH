import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Stack, TableBody, TableCell, TableContainer, TableRow, TextField, Typography } from "@mui/material";
import { DownloadRounded, ListAltRounded, SaveRounded } from "@mui/icons-material";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import ResizableTable from "../../components/ResizableTable";
import { API_BASE_URL } from "../../config/http";
import { personNameParts } from "../../utils/personName";
import { draftOf, gradebookCsv, gradePayload, numericScore, RESULT_LABELS, rowError, SCORE_FIELDS, visibleGradeRows } from "../../features/exams/gradebook";
import "../../features/exams/gradebook.css";

const panelSx = { borderColor: "#D7E4EE", borderRadius: "10px", bgcolor: "#fff", boxShadow: "0 2px 6px rgba(18,59,98,.07)" };
const inputSx = { "& .MuiOutlinedInput-root": { height: 30, fontSize: 12, borderRadius: "5px", bgcolor: "#fff" }, "& input": { px: 0.75, py: 0.5, textAlign: "center" }, "& fieldset": { borderColor: "#D7E4EE" } };
const modes = { all: "Cả bảng điểm", exam: "DS thi" };
const PAGE_SIZE = 15;
const displayDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.split("-").reverse().join("/") : date || "—";
const errorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || fallback;
};

export default function ExamLists() {
  const [groups, setGroups] = useState([]), [subjects, setSubjects] = useState([]);
  const [year, setYear] = useState(""), [groupId, setGroupId] = useState(""), [offeringId, setOfferingId] = useState("");
  const [rows, setRows] = useState([]), [revision, setRevision] = useState(0), [dirty, setDirty] = useState({});
  const [mode, setMode] = useState("all"), [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [role, setRole] = useState(""), [optionsLoading, setOptionsLoading] = useState(true), [subjectsLoading, setSubjectsLoading] = useState(false), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState(""), [pendingChange, setPendingChange] = useState(null);
  const canEdit = role === "admin" || role === "examiner";
  const dirtyCount = Object.keys(dirty).length;

  useEffect(() => {
    let active = true;
    Promise.all([axios.get(`${API_BASE_URL}/masters/exam-lists/options`), axios.get(`${API_BASE_URL}/auth/isStaff`)])
      .then(([options, auth]) => {
        if (!active) return;
        const list = options.data.groups || [];
        setGroups(list); setRole(auth.data.message || "");
        const first = list[0]; setYear(first?.academicYear || ""); setGroupId(first?.id || "");
      })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải danh sách lớp. Hãy tải lại trang.")))
      .finally(() => active && setOptionsLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSubjects([]); setOfferingId(""); setRows([]); setDirty({}); setSuccess("");
    if (!groupId) { setSubjectsLoading(false); return () => { active = false; }; }
    setSubjectsLoading(true); setError("");
    axios.get(`${API_BASE_URL}/masters/exam-lists/subjects`, { params: { classGroupId: groupId } })
      .then(({ data }) => { if (active) { setSubjects(data); setOfferingId(data[0]?.id || ""); } })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải học phần của lớp.")))
      .finally(() => active && setSubjectsLoading(false));
    return () => { active = false; };
  }, [groupId]);

  useEffect(() => {
    let active = true;
    setRows([]); setDirty({}); setSuccess("");
    if (!groupId || !offeringId) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError("");
    axios.get(`${API_BASE_URL}/masters/exam-lists`, { params: { classGroupId: groupId, courseOfferingId: offeringId } })
      .then(({ data }) => { if (active) { setRows(data.rows.map(draftOf)); setRevision(data.revision); } })
      .catch((failure) => active && setError(errorMessage(failure, "Không thể tải bảng điểm.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [groupId, offeringId]);

  useEffect(() => {
    if (!dirtyCount) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const years = [...new Set(groups.map((group) => group.academicYear || ""))].sort().reverse();
  const visibleGroups = groups.filter((group) => (group.academicYear || "") === year);
  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedOffering = subjects.find((subject) => subject.id === offeringId);
  const visible = useMemo(() => visibleGradeRows(rows, mode, search), [rows, mode, search]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = useMemo(() => visible.slice(pageStart, pageStart + PAGE_SIZE), [visible, pageStart]);
  const printRows = useMemo(() => visibleGradeRows(rows, mode, ""), [rows, mode]);
  useEffect(() => { setPage(1); }, [groupId, offeringId, mode, search]);
  useEffect(() => { setPage((value) => Math.min(value, totalPages)); }, [totalPages]);
  const requestChange = (change) => { if (dirtyCount) setPendingChange(() => change); else change(); };
  const edit = (id, patch) => {
    setRows((current) => current.map((row) => row.participantId === id ? { ...row, ...patch } : row));
    setDirty((current) => ({ ...current, [id]: true })); setSuccess("");
  };
  const save = async () => {
    const changed = rows.filter((row) => dirty[row.participantId]);
    for (const row of changed) {
      const invalid = rowError(row);
      if (invalid) { setError(`${row.code || row.fullName}: ${invalid}`); return; }
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data } = await axios.put(`${API_BASE_URL}/masters/exam-lists`, {
        classGroupId: groupId, courseOfferingId: offeringId, revision, rows: changed.map(gradePayload),
      });
      setRows(data.rows.map(draftOf)); setRevision(data.revision); setDirty({});
      setSuccess(`Đã cập nhật bảng điểm cho ${changed.length} học viên.`);
    } catch (failure) { setError(errorMessage(failure, "Không thể lưu bảng điểm. Các điểm vừa nhập vẫn được giữ trên màn hình.")); }
    finally { setSaving(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([gradebookCsv(visible, mode === "exam")], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url;
    anchor.download = `bang-diem-${selectedGroup?.code || "lop"}-${selectedOffering?.subject?.code || "hoc-phan"}-${mode}.csv`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const blank = mode === "exam";
  const locked = !canEdit || saving || blank;
  const columns = [
    { key: "index", label: "STT", width: 45, minWidth: 40, align: "center" },
    { key: "code", label: "Mã HV", width: 140 }, { key: "lastName", label: "Họ đệm", width: 150 },
    { key: "firstName", label: "Tên", width: 85 }, { key: "dob", label: "Ngày sinh", width: 110, align: "center" },
    { key: "gender", label: "Giới tính", width: 75, align: "center" },
    { key: "eligible", label: "Tư cách", width: 85, align: "center" }, { key: "exempt", label: "Miễn thi", width: 85, align: "center" },
    ...SCORE_FIELDS.map(([key, label]) => ({ key, label, width: key === "assignmentScore" ? 130 : 115, minWidth: 90, align: "center" })),
    { key: "letter", label: "Thang điểm chữ", width: 120, align: "center" },
    { key: "attempts", label: "Điểm các lần thi hết môn", width: 185 }, { key: "result", label: "Kết quả điểm", width: 155 },
  ];
  const busy = optionsLoading || subjectsLoading || loading;

  return <FeatureLayout title="Danh sách thi, điểm thi" group="Quá trình học tập" maxWidth={1880}>
    <Box className="exam-gradebook">
      <Paper variant="outlined" sx={{ ...panelSx, p: 1.5, mb: 1.5 }} className="exam-no-print">
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Năm vào trường" value={year} disabled={optionsLoading || saving} sx={{ flex: "1 1 150px", minWidth: 150 }} onChange={(event) => {
            const next = event.target.value;
            requestChange(() => { setYear(next); setOfferingId(""); setGroupId(groups.find((group) => (group.academicYear || "") === next)?.id || ""); });
          }}>{!years.length && <MenuItem value="">Chưa có năm tuyển sinh</MenuItem>}{years.map((value) => <MenuItem key={value} value={value}>{value || "Chưa có năm"}</MenuItem>)}</FilterSelectField>
          <FilterSelectField label="Chọn lớp" value={groupId} disabled={optionsLoading || saving || !visibleGroups.length} sx={{ flex: "2 1 260px", minWidth: 230 }} onChange={(event) => { const value = event.target.value; requestChange(() => { setOfferingId(""); setGroupId(value); }); }}>
            {!visibleGroups.length && <MenuItem value="">Chưa có lớp học viên</MenuItem>}{visibleGroups.map((group) => <MenuItem key={group.id} value={group.id}>{group.name} · {group.code}</MenuItem>)}
          </FilterSelectField>
          <FilterSelectField label="Chọn môn" value={offeringId} disabled={subjectsLoading || saving || !subjects.length} sx={{ flex: "3 1 380px", minWidth: 260 }} onChange={(event) => { const value = event.target.value; requestChange(() => setOfferingId(value)); }}>
            {!subjects.length && <MenuItem value="">{subjectsLoading ? "Đang tải học phần..." : "Chưa tổ chức học phần"}</MenuItem>}{subjects.map((offering) => <MenuItem key={offering.id} value={offering.id}>{offering.subject?.name} · {offering.name || offering.subject?.code}</MenuItem>)}
          </FilterSelectField>
          <FilterSearchField placeholder="Tìm theo mã HV, họ tên..." value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: "2 1 250px", minWidth: 230 }} />
        </Stack>
      </Paper>

      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }} className="exam-no-print">
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Button variant="contained" startIcon={<SaveRounded />} disabled={!canEdit || !dirtyCount || saving || busy} onClick={save} sx={{ bgcolor: "#0788B8", boxShadow: "none", borderRadius: "7px" }}>{saving ? "Đang lưu..." : "Cập nhật cả bảng"}</Button>
          {Object.entries(modes).map(([key, label]) => <Button key={key} startIcon={<ListAltRounded />} variant={mode === key ? "contained" : "outlined"} onClick={() => setMode(key)} sx={{ borderRadius: "7px", boxShadow: "none", ...(mode === key ? { bgcolor: "#173E75" } : { bgcolor: "#fff" }) }}>{label}</Button>)}
        </Stack>
        <Stack direction="row" gap={0.75}>
          <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!visible.length || busy} onClick={download}>Xuất CSV</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }} className="exam-no-print">{success}</Alert>}
      <Paper variant="outlined" sx={{ ...panelSx, overflow: "hidden" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ p: 1.5, borderBottom: "1px solid #D7E4EE" }}>
          <Box><Typography component="h1" sx={{ fontSize: 15, fontWeight: 700, color: "#173E75", m: 0 }}>{modes[mode].toLocaleUpperCase("vi")}</Typography>
            <Typography sx={{ fontSize: 12, color: "#607486", mt: 0.25 }}>{[selectedGroup?.name, selectedOffering?.subject?.name].filter(Boolean).join(" · ") || "Chọn lớp và học phần để xem danh sách thi."}</Typography>
          </Box>
          <Stack direction="row" gap={0.75} className="exam-no-print"><Chip size="small" label={`${visible.length} / ${rows.length} học viên`} sx={{ bgcolor: "#EDF4FA", color: "#173E75" }} />{dirtyCount > 0 && <Chip size="small" color="warning" variant="outlined" label={`${dirtyCount} học viên chưa lưu`} />}</Stack>
        </Stack>
        {busy ? <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={30} aria-label="Đang tải bảng điểm" /></Box> : <TableContainer sx={{ overflowX: "auto" }} className="exam-table-container exam-no-print">
          <ResizableTable columns={columns} storageKey="masters-exam-gradebook-columns">
            <TableBody>{!visible.length ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#607486" }}>{!groupId ? "Chưa có lớp học viên." : !offeringId ? "Lớp chưa có học phần được tổ chức. Hãy tạo lớp học phần để nhập điểm." : "Không có học viên phù hợp với danh sách đang chọn."}</TableCell></TableRow> : pageRows.map((row, index) => {
              const name = personNameParts(row);
              return <TableRow key={row.participantId} hover sx={{ "& td": { fontSize: 12.5, py: 0.75, borderColor: "#E2EBF2" }, ...(dirty[row.participantId] ? { bgcolor: "#FFFDF5" } : {}) }}>
                <TableCell align="center">{pageStart + index + 1}</TableCell><TableCell sx={{ fontWeight: 600 }}>{row.code || "—"}</TableCell>
                <TableCell title={name.familyAndMiddle}>{name.familyAndMiddle}</TableCell><TableCell>{name.givenName}</TableCell>
                <TableCell align="center">{displayDate(row.dob)}</TableCell><TableCell align="center">{row.gender || "—"}</TableCell>
                <TableCell align="center"><Checkbox size="small" disabled={locked} indeterminate={row.eligible == null} checked={row.eligible === true} inputProps={{ "aria-label": `Tư cách thi ${row.code}` }} onChange={(event) => edit(row.participantId, { eligible: event.target.checked })} /></TableCell>
                <TableCell align="center"><Checkbox size="small" disabled={locked} checked={row.examExempt} inputProps={{ "aria-label": `Miễn thi ${row.code}` }} onChange={(event) => edit(row.participantId, { examExempt: event.target.checked, result: event.target.checked ? "exempt" : "pending" })} /></TableCell>
                {SCORE_FIELDS.map(([key, label, max]) => <TableCell key={key} align="center" sx={{ bgcolor: "#F7FAFC" }}>
                  <TextField fullWidth size="small" value={blank ? "" : row[key]} disabled={locked} error={!blank && numericScore(row[key]) !== null && (!Number.isFinite(numericScore(row[key])) || numericScore(row[key]) < 0 || numericScore(row[key]) > max)} onChange={(event) => edit(row.participantId, { [key]: event.target.value })} inputProps={{ "aria-label": `${label} ${row.code}`, inputMode: "decimal" }} sx={inputSx} />
                </TableCell>)}
                <TableCell><TextField fullWidth size="small" value={blank ? "" : row.letterGrade} disabled={locked} onChange={(event) => edit(row.participantId, { letterGrade: event.target.value.toUpperCase() })} inputProps={{ "aria-label": `Thang điểm chữ ${row.code}`, maxLength: 10 }} sx={inputSx} /></TableCell>
                <TableCell><TextField fullWidth size="small" value={blank ? "" : row.attemptScores} disabled={locked} placeholder={locked ? "" : "8,5; 9"} onChange={(event) => edit(row.participantId, { attemptScores: event.target.value })} inputProps={{ "aria-label": `Điểm các lần thi ${row.code}` }} sx={inputSx} /></TableCell>
                <TableCell><TextField select fullWidth size="small" SelectProps={{ native: true }} value={blank ? "pending" : row.result} disabled={locked || row.examExempt} onChange={(event) => edit(row.participantId, { result: event.target.value })} inputProps={{ "aria-label": `Kết quả điểm ${row.code}` }} sx={{ ...inputSx, "& select": { py: 0.5, fontSize: 12, color: row.result === "failed" ? "#B52D2D" : row.result === "passed" ? "#137B3B" : "#607486" } }}>
                  {Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{blank ? "" : label}</option>)}
                </TextField></TableCell>
              </TableRow>;
            })}</TableBody>
          </ResizableTable>
        </TableContainer>}
        {!busy && visible.length > 0 && <Box className="exam-no-print" sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 1, minHeight: 48, px: 1.5, py: 0.75, borderTop: "1px solid #D7E4EE" }}>
          <Typography variant="caption" sx={{ color: "#607486", fontWeight: 600, position: { xs: "static", md: "absolute" }, left: 16 }}>
            Hiển thị {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visible.length)} trên {visible.length} học viên
          </Typography>
          {totalPages > 1 && <Pagination
            page={currentPage} count={totalPages} onChange={(_event, value) => setPage(value)}
            color="primary" size="medium" showFirstButton showLastButton
            sx={{ "& .MuiPaginationItem-root": { minWidth: 38, height: 38, fontSize: 14, fontWeight: 600 } }}
          />}
        </Box>}
        <Box className="exam-print-sheet" sx={{ display: "none" }}>
          <table data-testid="exam-print-table" aria-label="Danh sách in">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{printRows.map((row, index) => {
              const name = personNameParts(row);
              const values = [index + 1, row.code || "—", name.familyAndMiddle, name.givenName, displayDate(row.dob), row.gender || "—",
                row.eligible == null ? "Chưa xét" : row.eligible ? "Đủ tư cách" : "Không đủ tư cách", row.examExempt ? "Có" : "Không",
                ...SCORE_FIELDS.map(([key]) => blank ? "" : row[key]), blank ? "" : row.letterGrade,
                blank ? "" : row.attemptScores, blank ? "" : RESULT_LABELS[row.result]];
              return <tr key={row.participantId}>{values.map((value, cellIndex) => <td key={columns[cellIndex].key}>{value}</td>)}</tr>;
            })}</tbody>
          </table>
        </Box>
      </Paper>
      <Typography sx={{ mt: 1, color: "#607486", fontSize: 11.5 }} className="exam-no-print">Tư cách thi: dấu gạch là chưa xét. Điểm học phần, thang 4 và điểm chữ được nhập trực tiếp. Nháy đúp mép tiêu đề để tự căn độ rộng cột.</Typography>
      {dirtyCount > 0 && <Alert severity="warning" sx={{ mt: 1 }} className="exam-no-print">Bạn có điểm chưa lưu. Danh sách in và CSV sử dụng các điểm vừa nhập.</Alert>}
      <Dialog open={Boolean(pendingChange)} onClose={() => setPendingChange(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "#173E75", fontSize: 16 }}>Có điểm chưa lưu</DialogTitle>
        <DialogContent>Bạn đã chỉnh sửa {dirtyCount} học viên. Chuyển lựa chọn sẽ bỏ các thay đổi này.</DialogContent>
        <DialogActions><Button onClick={() => setPendingChange(null)}>Ở lại</Button><Button color="warning" onClick={() => { const change = pendingChange; setPendingChange(null); setDirty({}); change(); }}>Bỏ thay đổi và tiếp tục</Button></DialogActions>
      </Dialog>
    </Box>
  </FeatureLayout>;
}
