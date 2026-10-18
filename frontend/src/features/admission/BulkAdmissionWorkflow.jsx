import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Button, Checkbox, Chip, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/http";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import ResizableTable from "../../components/ResizableTable";
import { getMockConfirmResult } from "../../utils/confirmHelper";
import { createScoreTemplate, EXCEL_MIME, parseScoreExcel, readExcelFile } from "./admissionExcel";

const options = { withCredentials: true };
const PAGE_SIZE = 15;

const BULK_ADMISSION_COLUMNS = [
  { key: "code", label: "Mã hồ sơ", width: 130, minWidth: 100 },
  { key: "name", label: "Họ tên", width: 180, minWidth: 140 },
  { key: "birthYear", label: "Năm sinh", width: 90, minWidth: 80, align: "center" },
  { key: "gender", label: "Giới tính", width: 90, minWidth: 80, align: "center" },
  { key: "major", label: "Chuyên ngành", width: 220, minWidth: 150 },
  { key: "contact", label: "Liên hệ", width: 180, minWidth: 140 },
  { key: "total", label: "Tổng điểm (0–20)", width: 140, minWidth: 110, align: "center" },
  { key: "cutoff", label: "Điểm ngưỡng ngành", width: 150, minWidth: 120, align: "center" },
  { key: "condition", label: "Điều kiện theo điểm", width: 160, minWidth: 130, align: "center" },
  { key: "status", label: "Trạng thái", width: 140, minWidth: 110, align: "center" },
];

export default function BulkAdmissionWorkflow({ data, visibleRows, paginationKey, admin, loading = false, thresholdsDirty = false, onRefresh, onDirtyChange, onBusyChange, recordViewControl }) {
  const navigate = useNavigate();
  const [navTarget, setNavTarget] = useState(null);
  const [page, setPage] = useState(1), [previewPage, setPreviewPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStart, pageStart + PAGE_SIZE);
  useEffect(() => { setPage(1); }, [paginationKey, data.round.id]);
  const [drafts, setDrafts] = useState({});
  const fileInput = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [pending, setBusy] = useState(false);
  const busy = pending || loading;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(pending); }, [pending, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  useEffect(() => { setDrafts({}); setPreview(null); setError(""); }, [data]);
  useEffect(() => {
    const handler = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const run = async (action) => {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); }
    catch (err) {
      setError(err.response?.data?.message || err.message || "Không thể thực hiện thao tác.");
      if (err.response?.status === 409) setPreview(null);
    } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const rows = Object.entries(drafts).map(([id, value]) => {
      if (value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 20) throw new Error("Điểm phải từ 0 đến 20. Nhập đầy đủ các ô đang sửa trước khi lưu.");
      const row = data.rows.find((item) => item.admissionRecordId === id);
      return { admissionRecordId: id, score: Number(value), version: row.version };
    });
    await axios.put(`${API_BASE_URL}/plan/admission-rounds/${data.round.id}/scores`, { rows }, options);
    await onRefresh(); setDrafts({}); setSuccess(`Đã lưu điểm của ${rows.length} hồ sơ. Bấm Xét tuyển để xem danh sách đạt ngưỡng.`);
  });
  const evaluate = () => run(async () => {
    const response = await axios.post(`${API_BASE_URL}/plan/admission-rounds/${data.round.id}/preview`, {}, options);
    setPreview(response.data);
    setPreviewPage(1);
    setSelected(response.data.rows.map((row) => row.admissionRecordId));
  });
  const confirm = () => run(async () => {
    const response = await axios.post(`${API_BASE_URL}/plan/admission-rounds/${data.round.id}/confirm`, { previewToken: preview.previewToken, admissionRecordIds: selected }, options);
    setPreview(null); await onRefresh(); setSuccess(`Đã duyệt ${response.data.admittedCount} hồ sơ sang trạng thái Đã trúng tuyển.`);
  });
  const downloadTemplate = () => run(async () => {
    const buffer = await createScoreTemplate(data.round, visibleRows);
    const url = URL.createObjectURL(new Blob([buffer], { type: EXCEL_MIME }));
    const link = document.createElement("a");
    link.href = url; link.download = `Mau_diem_xet_tuyen_${data.round.id}.xlsx`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSuccess(`Đã tải file mẫu với ${visibleRows.length} hồ sơ đang hiển thị. Điền cột Tổng điểm rồi chọn Import từ file Excel.`);
  });
  const importFile = (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    run(async () => {
      const buffer = await readExcelFile(file);
      const imported = await parseScoreExcel(buffer, data.round.id, data.rows);
      await axios.put(`${API_BASE_URL}/plan/admission-rounds/${data.round.id}/scores`, { rows: imported.rows }, options);
      await onRefresh(); setDrafts({});
      setSuccess(`Đã import và lưu điểm ${imported.rows.length} hồ sơ.${imported.skippedCount ? ` Bỏ qua ${imported.skippedCount} dòng chưa điền điểm hoặc đã duyệt giữ nguyên điểm.` : ""} Bấm Xét tuyển để xem danh sách đạt ngưỡng.`);
    });
  };
  const handleRecordClick = (event, to) => {
    if (dirty || thresholdsDirty) {
      const mockResult = getMockConfirmResult("Điểm đang sửa chưa lưu. Rời trang và bỏ các thay đổi?");
      if (mockResult !== null) {
        if (!mockResult) event.preventDefault();
        return;
      }
      event.preventDefault();
      setNavTarget(to);
    }
  };

  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {success && <Alert severity="success">{success}</Alert>}
    <Paper variant="outlined" sx={{ p: 2, borderRadius: "6px" }}>
      <Stack spacing={1.5}>
        <Typography fontWeight={700}>Nhập điểm hồ sơ và xét tuyển</Typography>
        <Typography variant="body2">Tải file Excel mẫu gồm mã hồ sơ, họ tên, năm sinh, giới tính, chuyên ngành, thông tin liên hệ và điểm của danh sách theo bộ lọc trên tất cả các trang. Điền cột Tổng điểm, lưu file .xlsx rồi import lại để lưu điểm hàng loạt. Có thể nhập trực tiếp trên bảng.</Typography>
        {(admin || recordViewControl) && <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          {admin && <>
          <Button variant="outlined" disabled={busy || dirty || !visibleRows.length} onClick={downloadTemplate} sx={{ borderRadius: "4px" }}>Tải file Excel mẫu</Button>
          <Button variant="outlined" disabled={busy || dirty} onClick={() => fileInput.current?.click()} sx={{ borderRadius: "4px" }}>Import từ file Excel</Button>
          <input ref={fileInput} type="file" accept={`.xlsx,${EXCEL_MIME}`} aria-label="Chọn file Excel nhập điểm" hidden disabled={busy || dirty} onChange={importFile} />
          <Button variant="contained" disabled={busy || !dirty} onClick={save} sx={{ borderRadius: "4px", bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}>Lưu điểm hàng loạt{dirty ? ` (${Object.keys(drafts).length})` : ""}</Button>
          <Button variant="contained" color="success" disabled={busy || dirty || thresholdsDirty || !(data.round.majorThresholds || []).some((entry) => entry.cutoff != null)} onClick={evaluate} sx={{ borderRadius: "4px" }}>Xét tuyển</Button>
          </>}
          {recordViewControl}
        </Stack>}
        {dirty && <Alert severity="warning" sx={{ borderRadius: "4px" }}>Điểm đang sửa chưa được lưu. Lưu điểm hàng loạt trước khi tải mẫu, import Excel hoặc xét tuyển.</Alert>}
      </Stack>
    </Paper>
    <TableContainer component={Paper} variant="outlined" sx={{ borderColor: "#D7E4EE", borderRadius: "6px", overflow: "auto", boxShadow: "0 2px 8px rgba(23, 62, 117, 0.04)" }}>
      <ResizableTable
        columns={BULK_ADMISSION_COLUMNS}
        storageKey="bulk-admission-table-widths"
        aria-label="Bảng nhập điểm hồ sơ và xét tuyển"
      >
        <TableBody>
          {pageRows.map((row) => (
            <TableRow key={row.admissionRecordId} hover sx={{ "&:hover": { bgcolor: "#F5FAFE!important" }, "& td": { borderColor: "#E2EBF2" } }}>
              <TableCell>{row.code || "Chưa có mã"}</TableCell>
              <TableCell><Button component={Link} to={`/plan/admission-records/${row.admissionRecordId}?tab=admission`} onClick={(event) => handleRecordClick(event, `/plan/admission-records/${row.admissionRecordId}?tab=admission`)} sx={{ textTransform: "none", fontWeight: 600, color: "var(--primary, #0788B8)" }}>{row.fullName}</Button></TableCell>
              <TableCell align="center">{row.birthYear ?? "—"}</TableCell>
              <TableCell align="center">{row.gender || "—"}</TableCell>
              <TableCell>{row.majorName}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}><Typography variant="body2">{row.phone || "—"}</Typography>{row.email && <Typography variant="caption" color="text.secondary">{row.email}</Typography>}</TableCell>
              <TableCell align="center">{admin && row.decision === "pending" ? <TextField size="small" type="number" value={drafts[row.admissionRecordId] ?? row.total ?? ""} disabled={busy} inputProps={{ min: 0, max: 20, step: 0.01, "aria-label": `Điểm ${row.code || row.fullName}` }} sx={{ width: 85, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }} onChange={(event) => {
                const value = event.target.value;
                setDrafts((previous) => { const next = { ...previous }; if (value === String(row.total ?? "") && !row.stale) delete next[row.admissionRecordId]; else next[row.admissionRecordId] = value; return next; }); setSuccess("");
              }} /> : row.total ?? "—"}</TableCell>
              <TableCell align="center">{row.cutoff ?? "Chưa nhập"}</TableCell>
              <TableCell align="center"><Chip size="small" label={drafts[row.admissionRecordId] !== undefined ? "Chưa lưu điểm" : row.stale ? "Cần xác minh lại" : row.meetsCutoff === true ? "Đủ điều kiện" : row.meetsCutoff === false ? "Chưa đạt ngưỡng" : row.total == null ? "Chưa nhập điểm" : "Chờ xét tuyển"} color={drafts[row.admissionRecordId] === undefined && !row.stale && row.meetsCutoff === true ? "success" : "default"} sx={{ borderRadius: "4px" }} /></TableCell>
              <TableCell align="center">{row.decision === "admitted" ? row.studyStatus || "Đã trúng tuyển" : row.decision === "rejected" ? "Không trúng tuyển" : "Chưa duyệt"}</TableCell>
            </TableRow>
          ))}
          {!visibleRows.length && <TableRow><TableCell colSpan={10} align="center">Chưa có hồ sơ phù hợp với đợt và bộ lọc đang chọn.</TableCell></TableRow>}
        </TableBody>
      </ResizableTable>
    </TableContainer>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" justifyContent="space-between">
      <Typography variant="body2">Hiển thị {visibleRows.length ? pageStart + 1 : 0}–{Math.min(pageStart + PAGE_SIZE, visibleRows.length)} trên {visibleRows.length} hồ sơ</Typography>
      <Pagination aria-label="Phân trang hồ sơ xét tuyển" count={pageCount} page={currentPage} onChange={(_, value) => setPage(value)} color="primary" size="small" />
    </Stack>

    <AppDialog
      open={Boolean(preview)}
      onClose={() => !busy && setPreview(null)}
      maxWidth="lg"
      fullWidth
      title="Duyệt danh sách hồ sơ đạt điểm xét tuyển"
      actions={
        <>
          <Button disabled={busy} onClick={() => setPreview(null)} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "4px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
          <Button variant="contained" disabled={busy || !selected.length} onClick={confirm} sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "4px", bgcolor: "#0788B8", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}>Đồng ý duyệt</Button>
        </>
      }
    >
      {preview && <Stack spacing={2}>
        <Alert severity="info" sx={{ borderRadius: "4px" }}>Đợt {preview.round.name}: có {preview.rows.length} hồ sơ đạt ngưỡng của ngành đăng ký. Trạng thái hồ sơ sẽ được cập nhật sau khi bấm Đồng ý duyệt.</Alert>
        {!preview.rows.length && <Alert severity="warning" sx={{ borderRadius: "4px" }}>Chưa có hồ sơ đủ điều kiện để duyệt. Kiểm tra điểm và các hồ sơ cần xác minh lại.</Alert>}
        {error && <Alert severity="error" sx={{ borderRadius: "4px" }}>{error}</Alert>}
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#EDF4FA", "& th": { fontWeight: 700, color: "#111" } }}>
              <TableCell><Checkbox inputProps={{ "aria-label": "Chọn tất cả hồ sơ đạt ngưỡng" }} checked={preview.rows.length > 0 && selected.length === preview.rows.length} indeterminate={selected.length > 0 && selected.length < preview.rows.length} disabled={busy || !preview.rows.length} onChange={(event) => setSelected(event.target.checked ? preview.rows.map((row) => row.admissionRecordId) : [])} /></TableCell>
              <TableCell>Mã hồ sơ</TableCell>
              <TableCell>Họ tên</TableCell>
              <TableCell>Năm sinh</TableCell>
              <TableCell>Giới tính</TableCell>
              <TableCell>Chuyên ngành</TableCell>
              <TableCell>Tổng điểm</TableCell>
              <TableCell>Điểm ngưỡng</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.rows.slice((previewPage - 1) * PAGE_SIZE, previewPage * PAGE_SIZE).map((row) => (
              <TableRow key={row.admissionRecordId} hover sx={{ "&:hover": { bgcolor: "#F5FAFE!important" } }}>
                <TableCell><Checkbox inputProps={{ "aria-label": `Duyệt ${row.code || row.fullName}` }} disabled={busy} checked={selected.includes(row.admissionRecordId)} onChange={(event) => setSelected((previous) => event.target.checked ? [...previous, row.admissionRecordId] : previous.filter((id) => id !== row.admissionRecordId))} /></TableCell>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.fullName}</TableCell>
                <TableCell>{row.birthYear ?? "—"}</TableCell>
                <TableCell>{row.gender || "—"}</TableCell>
                <TableCell>{row.majorName}</TableCell>
                <TableCell>{row.total}</TableCell>
                <TableCell>{row.cutoff}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination aria-label="Phân trang danh sách duyệt" count={Math.max(1, Math.ceil(preview.rows.length / PAGE_SIZE))} page={previewPage} onChange={(_, value) => setPreviewPage(value)} color="primary" size="small" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Đã chọn {selected.length} hồ sơ.</Typography>
      </Stack>}
    </AppDialog>

    <ConfirmDialog
      open={Boolean(navTarget)}
      onClose={() => setNavTarget(null)}
      onConfirm={() => {
        const to = navTarget;
        setNavTarget(null);
        navigate(to);
      }}
      title="XÁC NHẬN RỜI TRANG"
      content="Điểm đang sửa chưa lưu. Rời trang và bỏ các thay đổi?"
      severity="warning"
      confirmText="Rời trang"
    />
  </Stack>;
}
