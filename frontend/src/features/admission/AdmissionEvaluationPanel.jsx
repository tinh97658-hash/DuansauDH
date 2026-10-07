import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { API_BASE_URL } from "../../config/http";

const options = { withCredentials: true };
const decisionLabels = { pending: "Chưa duyệt", admitted: "Đã trúng tuyển", rejected: "Không trúng tuyển", reopen: "Mở lại kết quả", saved: "Lưu điểm xét tuyển", tuition_paid: "Xác nhận đã nộp học phí", tuition_unpaid: "Hủy xác nhận học phí" };

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

export default function AdmissionEvaluationPanel({ record }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
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
  if (loading) return <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  return <Stack spacing={2}>
    {error && <Alert severity="error" action={<Button onClick={load}>Tải lại</Button>}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography fontWeight={800} color="#173E75" mb={2}>KẾT QUẢ XÉT TUYỂN</Typography>
      <AdmissionResult evaluation={evaluation} />
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
  </Stack>;
}
