import React, { useState } from "react";
import axios from "axios";
import { Alert, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { API_BASE_URL } from "../../config/http";
import { readSubjectSigningImport, previewSubjectSigningImport } from "./subjectSigningImport";

const fileBytes = file => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Không đọc được file Excel.")); reader.readAsArrayBuffer(file);
});
const failureMessage = failure => {
  const message = failure.response?.data?.message;
  return Array.isArray(message) ? message.join(" ") : message || failure.message || "Không thể nhập điểm từ Excel.";
};
const score = value => value == null ? "—" : String(value);

export default function GradebookImportDialog({ classGroupId, offeringId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState(null), [filename, setFilename] = useState("");
  const chooseFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(null); setError(""); setFilename(file.name); setBusy(true);
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error("Chọn file .xlsx tối đa 5 MB được xuất từ hệ thống.");
      const imported = await readSubjectSigningImport(await fileBytes(file), offeringId);
      const roster = []; let revision;
      for (let page = 1; ; page++) {
        const { data } = await axios.get(`${API_BASE_URL}/masters/exam-lists`, { params: {
          classGroupId, courseOfferingId: offeringId, rosterScope: "offering", mode: "all", search: "", page, pageSize: 15,
        } });
        if (!data.componentImportAllowed) throw new Error("Chỉ nhập Excel sau khi hoàn thành giảng dạy và trước khi tạo lịch thi, khi bảng điểm còn được phép sửa.");
        if (data.page !== page || (revision !== undefined && data.revision !== revision)) throw new Error("Bảng điểm đã thay đổi trong lúc đọc file. Hãy chọn lại file để kiểm tra.");
        if (data.total > 1000) throw new Error("Mỗi lần import hỗ trợ tối đa 1000 học viên.");
        revision = data.revision; roster.push(...data.rows);
        if (page * 15 >= data.total) break;
      }
      const rows = previewSubjectSigningImport(imported, roster);
      if (!rows.length) throw new Error("Các điểm trong file đã trùng với điểm hiện tại, không có thay đổi cần lưu.");
      setPreview({ revision, rows });
    } catch (failure) { setError(failureMessage(failure)); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try {
      const { data } = await axios.post(`${API_BASE_URL}/masters/exam-lists/import-components`, {
        classGroupId, courseOfferingId: offeringId, rosterScope: "offering", revision: preview.revision,
        rows: preview.rows.map(({ participantId, testScore, assignmentScore }) => ({ participantId,
          ...(testScore !== undefined ? { testScore } : {}), ...(assignmentScore !== undefined ? { assignmentScore } : {}) })),
      });
      onSaved(data, preview.rows.length);
    } catch (failure) {
      setError(failureMessage(failure));
      if ([400, 403, 409].includes(failure.response?.status)) setPreview(null);
    } finally { setBusy(false); }
  };
  return <AppDialog open title="Nhập điểm từ Excel" onClose={onClose} onConfirm={confirm} confirmText="Xác nhận cập nhật điểm"
    confirmDisabled={!preview} loading={busy} maxWidth="md">
    <Stack spacing={1.5}>
      <Typography>Chọn phiếu Excel đã giao cho giảng viên. Chỉ nhập Điểm KT và Điểm TL/BTL; ô trống giữ nguyên điểm hiện có. Chỉ được nhập trước khi tạo lịch thi.</Typography>
      <Button component="label" variant="outlined" disabled={busy} sx={{ alignSelf: "flex-start" }}>Chọn file Excel
        <input type="file" accept=".xlsx" aria-label="Chọn file điểm Excel" hidden disabled={busy} onChange={chooseFile} />
      </Button>
      {filename && <Typography variant="body2">{filename}</Typography>}
      {busy && <Typography role="status">Đang xử lý...</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      {preview && <>
        <Alert severity="info">Có {preview.rows.length} học viên thay đổi điểm. Kiểm tra trước khi xác nhận lưu.</Alert>
        <TableContainer sx={{ maxHeight: 360 }}><Table size="small" stickyHeader aria-label="Xem trước điểm nhập từ Excel">
          <TableHead><TableRow>{["Mã HV", "Họ tên", "Điểm KT: hiện tại → nhập", "Điểm TL/BTL: hiện tại → nhập"].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{preview.rows.map(row => <TableRow key={row.participantId}>
            <TableCell>{row.code}</TableCell><TableCell>{row.fullName}</TableCell>
            <TableCell>{score(row.oldTestScore)} → {row.testScore === undefined ? "Giữ nguyên" : score(row.testScore)}</TableCell>
            <TableCell>{score(row.oldAssignmentScore)} → {row.assignmentScore === undefined ? "Giữ nguyên" : score(row.assignmentScore)}</TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
      </>}
    </Stack>
  </AppDialog>;
}
