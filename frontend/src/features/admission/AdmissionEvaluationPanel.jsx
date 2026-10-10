import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { API_BASE_URL } from "../../config/http";

const options = { withCredentials: true };
const decisionLabels = { pending: "Chưa duyệt", admitted: "Đã trúng tuyển", rejected: "Không trúng tuyển", reopen: "Mở lại kết quả", saved: "Lưu điểm xét tuyển", major_transfer: "Lưu xét tuyển trước chuyển ngành", tuition_paid: "Xác nhận đã nộp học phí", tuition_unpaid: "Hủy xác nhận học phí" };

export function AdmissionResult({ evaluation }) {
  if (!evaluation) return <Alert severity="info">Hồ sơ chưa có kết quả xét tuyển.</Alert>;
  const result = evaluation.result;
  return <Stack spacing={1.5}>
    <Typography variant="body2">Năm tuyển sinh: <b>{evaluation.round?.academicYear || evaluation.recordSnapshot?.academicYear || "—"}</b> · Đợt: <b>{evaluation.round?.name || "—"}</b></Typography>
    <Typography variant="body2">Chuyên ngành xét tuyển: <b>{evaluation.majorName || evaluation.recordSnapshot?.majorName || "—"}</b></Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Chip label={decisionLabels[evaluation.decision] || evaluation.decision} color={evaluation.decision === "admitted" ? "success" : evaluation.decision === "rejected" ? "error" : "default"} />
      <Chip label={`Tổng điểm: ${result.total ?? "Chưa nhập điểm"}`} />
      <Chip label={`Điểm ngưỡng ngành: ${result.cutoff ?? "Chưa nhập"}`} variant="outlined" />
      <Chip label={result.meetsCutoff === true ? "Đạt ngưỡng" : result.meetsCutoff === false ? "Chưa đạt ngưỡng" : "Chờ xét tuyển"} variant="outlined" />
    </Stack>
    {evaluation.stale && <Alert severity="warning">Thông tin hồ sơ đã thay đổi so với lần lưu điểm. Kiểm tra lại tại màn hình Điểm xét tuyển thạc sĩ.</Alert>}
  </Stack>;
}

export default function AdmissionEvaluationPanel({ record, isAdmin = false, disabled = false, onDecided, onBusyChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/admission-records/${record.id}/evaluation`, options);
      setEvaluation(data.evaluation);
      setHistory(data.history || []);
    } catch (err) { setError(err.response?.data?.message || "Không tải được dữ liệu xét tuyển."); }
    finally { setLoading(false); }
  }, [record.id]);
  useEffect(() => { load(); }, [load, record]);
  const canAdmit = evaluation?.decision === "pending" && !evaluation.stale
    && evaluation.result?.eligibility === "eligible" && evaluation.result?.meetsCutoff === true
    && record.studyStatus !== "Đang học";
  const confirmDecision = async () => {
    if (busy || disabled || !decision || !note.trim()) return;
    setBusy(true); onBusyChange?.(true); setError(""); setSuccess("");
    try {
      await axios.post(`${API_BASE_URL}/plan/admission-records/${record.id}/evaluation/decision`, {
        decision, version: evaluation.version, note: note.trim(),
      }, options);
      setDecision(null);
      await load();
      await onDecided?.();
      setSuccess("Đã cập nhật kết quả xét tuyển và trạng thái hồ sơ.");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể phê duyệt xét tuyển.");
      if (err.response?.status === 409) { setDecision(null); await load(); setError(err.response?.data?.message); }
    } finally { setBusy(false); onBusyChange?.(false); }
  };
  const openDecision = (value) => { setNote(""); setDecision(value); setError(""); setSuccess(""); };
  if (loading) return <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  return <Stack spacing={2}>
    {success && <Alert severity="success">{success}</Alert>}
    {error && <Alert severity="error" action={<Button onClick={load}>Tải lại</Button>}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography fontWeight={800} color="#173E75" mb={2}>KẾT QUẢ XÉT TUYỂN</Typography>
      <AdmissionResult evaluation={evaluation} />
      {disabled && !busy && <Alert severity="warning" sx={{ mt: 2 }}>Lưu thay đổi hồ sơ trước khi phê duyệt xét tuyển.</Alert>}
      {evaluation?.decision === "pending" && !canAdmit && <Alert severity="info" sx={{ mt: 2 }}>
        {evaluation.stale ? "Hồ sơ đã thay đổi. Kiểm tra và lưu lại điểm xét tuyển trước khi duyệt." : "Chỉ duyệt trúng tuyển khi đã nhập điểm, đủ điều kiện và đạt điểm ngưỡng của ngành."}
      </Alert>}
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
        <Button href="/masters/admission-scores" disabled={busy || disabled}>Mở điểm xét tuyển thạc sĩ</Button>
        {isAdmin && evaluation?.decision === "pending" && <>
          <Button variant="contained" color="success" disabled={busy || disabled || !canAdmit} onClick={() => openDecision("admitted")}>Duyệt trúng tuyển</Button>
          <Button variant="outlined" color="error" disabled={busy || disabled} onClick={() => openDecision("rejected")}>Không trúng tuyển</Button>
        </>}
        {isAdmin && evaluation && evaluation.decision !== "pending" && <Button variant="outlined" disabled={busy || disabled || record.studyStatus === "Đang học"} onClick={() => openDecision("reopen")}>Mở lại xét tuyển</Button>}
      </Stack>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography fontWeight={800} color="#173E75" mb={2}>LỊCH SỬ XÉT TUYỂN</Typography>
      {!history.length && <Typography variant="body2">Chưa có lịch sử xét tuyển.</Typography>}
      {history.map((entry) => {
        const snapshot = entry.snapshot || {};
        return <Box key={entry.id} sx={{ py: 1.5, borderBottom: "1px solid #e2e8f0" }}>
          <Typography variant="body2" fontWeight={700}>{decisionLabels[entry.action] || entry.action} · {new Date(entry.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Typography>
          {snapshot.tuitionPayment ? <Typography variant="body2">Học phí nhập học: {snapshot.tuitionPayment.paid ? "Đã nộp" : "Chưa xác nhận"} · Trạng thái: {snapshot.record?.studyStatus || "—"}</Typography> : <>
          <Typography variant="body2">Năm: {snapshot.round?.academicYear || snapshot.record?.academicYear || "—"} · Đợt: {snapshot.round?.name || "—"} · Ngành: {snapshot.record?.majorName || "Chưa lưu tên ngành"}</Typography>
          <Typography variant="body2">Điểm hồ sơ: {snapshot.result?.total ?? "—"} · Điểm ngưỡng ngành: {snapshot.result?.cutoff ?? "—"} · Kết quả: {decisionLabels[snapshot.evaluation?.decision] || "—"}</Typography>
          </>}
          <Typography variant="caption" display="block">Người thực hiện: {entry.actor || "—"}</Typography>
          {(snapshot.decisionNo || snapshot.decisionDate) && <Typography variant="body2">Quyết định: {snapshot.decisionNo || "—"} · {snapshot.decisionDate || "—"}</Typography>}
          {snapshot.note && <Typography variant="body2">{snapshot.note}</Typography>}
        </Box>;
      })}
    </Paper>
    <Dialog open={Boolean(decision)} onClose={() => { if (!busy) setDecision(null); }} fullWidth maxWidth="sm">
      <DialogTitle>{decisionLabels[decision]}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>Xác nhận kết quả cho {record.fullName || record.code || "hồ sơ này"}. Thao tác sẽ cập nhật trạng thái hồ sơ và lưu lịch sử xét tuyển.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField autoFocus fullWidth multiline minRows={2} label="Ghi chú / lý do" value={note} disabled={busy} inputProps={{ maxLength: 2000 }} onChange={(event) => setNote(event.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setDecision(null)}>Hủy</Button>
        <Button variant="contained" disabled={busy || disabled || !note.trim()} onClick={confirmDecision}>{busy ? "Đang xử lý…" : "Xác nhận"}</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
