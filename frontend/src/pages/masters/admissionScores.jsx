import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import BulkAdmissionWorkflow from "../../features/admission/BulkAdmissionWorkflow";
import FeatureLayout from "../../components/FeatureLayout";
import { API_BASE_URL } from "../../config/http";
import { normalizeMajorsResponse } from "../../utils/majors";

const options = { withCredentials: true };
export default function AdmissionScores() {
  const [scoresDirty, setScoresDirty] = useState(false), [workflowBusy, setWorkflowBusy] = useState(false);
  const [rounds, setRounds] = useState([]), [majors, setMajors] = useState([]);
  const [admin, setAdmin] = useState(false), [roundId, setRoundId] = useState("");
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [form, setForm] = useState(null);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [majorFilter, setMajorFilter] = useState("all");
  const [thresholdDrafts, setThresholdDrafts] = useState({});
  const thresholdsDirty = Object.keys(thresholdDrafts).length > 0;
  const loadRounds = useCallback(async () => {
    const [config, catalog, session] = await Promise.all([
      axios.get(`${API_BASE_URL}/plan/admission-rounds`, options), axios.get(`${API_BASE_URL}/system/majors`, options), axios.get(`${API_BASE_URL}/auth/session`, options),
    ]);
    setRounds(config.data.rows || []);
    setMajors(normalizeMajorsResponse(catalog.data).filter((major) => major.program === "masters" && major.active !== false));
    setAdmin(session.data.user?.role === "admin"); return config.data.rows || [];
  }, []);
  useEffect(() => {
    loadRounds().then((rows) => { if (rows.length) setRoundId(rows[0].id); else setLoading(false); })
      .catch((err) => { setError(err.response?.data?.message || "Không tải được đợt xét tuyển."); setLoading(false); });
  }, [loadRounds]);
  const loadRanking = useCallback(async () => {
    if (!roundId) return;
    setLoading(true); setError("");
    try { const response = await axios.get(`${API_BASE_URL}/plan/admission-rounds/${roundId}/ranking`, options); setData(response.data); }
    catch (err) { setData(null); setError(err.response?.data?.message || "Không tải được bảng điểm."); }
    finally { setLoading(false); }
  }, [roundId]);
  useEffect(() => { loadRanking(); }, [loadRanking]);
  useEffect(() => {
    const handler = (event) => { if (thresholdsDirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [thresholdsDirty]);
  const canDiscard = () => (!scoresDirty && !thresholdsDirty) || window.confirm("Điểm hồ sơ hoặc điểm ngưỡng ngành đang sửa chưa lưu. Bỏ các thay đổi để tiếp tục?");
  const openForm = (round) => {
    setError(""); setForm(round ? { id: round.id, name: round.name, academicYear: round.academicYear, majorThresholds: round.majorThresholds || [],
      rules: round.rules, regulationNo: round.regulationNo || "", decisionNo: round.decisionNo || undefined, decisionDate: round.decisionDate || undefined }
      : { name: "", academicYear: "2026", majorThresholds: [] });
  };
  const saveRound = async () => {
    setSaving(true); setError("");
    try {
      const { id, ...payload } = form;
      const response = id ? await axios.put(`${API_BASE_URL}/plan/admission-rounds/${id}`, payload, options) : await axios.post(`${API_BASE_URL}/plan/admission-rounds`, payload, options);
      await loadRounds(); setForm(null); setThresholdDrafts({});
      if (response.data.id === roundId) await loadRanking(); else { setData(null); setRoundId(response.data.id); }
    } catch (err) { setError(err.response?.data?.message || "Không thể lưu đợt xét tuyển."); }
    finally { setSaving(false); }
  };
  const saveMajorThresholds = async () => {
    setSaving(true); setError("");
    try {
      const entries = new Map((data.round.majorThresholds || []).map((entry) => [entry.majorId, entry.cutoff]));
      Object.entries(thresholdDrafts).forEach(([majorId, value]) => {
        if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 20)) throw new Error("Điểm ngưỡng phải từ 0 đến 20.");
        entries.set(majorId, value === "" ? null : Number(value));
      });
      const { name, academicYear, rules, regulationNo, decisionNo, decisionDate } = data.round;
      await axios.put(`${API_BASE_URL}/plan/admission-rounds/${roundId}`, { name, academicYear, rules, regulationNo,
        decisionNo: decisionNo || undefined, decisionDate: decisionDate || undefined,
        majorThresholds: Array.from(entries, ([majorId, cutoff]) => ({ majorId, cutoff })) }, options);
      setThresholdDrafts({}); await loadRounds(); await loadRanking();
    } catch (err) { setError(err.response?.data?.message || err.message || "Không thể lưu điểm ngưỡng các ngành."); }
    finally { setSaving(false); }
  };
  const rows = (data?.rows || []).filter((row) => {
    const matches = `${row.fullName} ${row.code || ""}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"));
    return matches && (majorFilter === "all" || row.majorId === majorFilter) && (filter === "all" || (filter === "eligible" ? !row.stale && row.meetsCutoff === true
      : filter === "below" ? row.meetsCutoff === false : filter === "unscored" ? row.total == null : row.decision === filter));
  });
  return <FeatureLayout title="Điểm xét tuyển thạc sĩ" group="Thủ tục đầu vào" hideHeader={false} desc="Chọn đợt xét tuyển toàn viện, nhập điểm ngưỡng từng ngành và điểm hồ sơ để lọc danh sách đạt ngưỡng.">
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} gap={1.5}>
        <TextField select size="small" label="Đợt xét tuyển toàn viện" value={roundId} disabled={saving || workflowBusy || loading}
          onChange={(event) => { if (canDiscard()) { setData(null); setThresholdDrafts({}); setMajorFilter("all"); setRoundId(event.target.value); } }} sx={{ flex: 1, minWidth: 220 }}>
          <MenuItem value="">Chọn đợt xét tuyển</MenuItem>{rounds.map((round) => <MenuItem key={round.id} value={round.id}>{round.name} · {round.academicYear}</MenuItem>)}
        </TextField>
        <Button onClick={() => { if (canDiscard()) { setThresholdDrafts({}); loadRanking(); } }} disabled={!roundId || loading || workflowBusy || saving}>Tải lại</Button>
        {admin && <>
          <Button variant="outlined" disabled={!data || loading || workflowBusy || saving} onClick={() => { if (canDiscard()) openForm(data.round); }}>Sửa đợt</Button>
          <Button variant="contained" disabled={workflowBusy || saving} onClick={() => { if (canDiscard()) openForm(null); }}>Tạo đợt xét tuyển</Button>
        </>}
      </Stack></Paper>
      {loading && <Box sx={{ textAlign: "center", p: 2 }}><CircularProgress size={28} /></Box>}
      {!rounds.length && !loading && <Alert severity="info">Tạo đợt xét tuyển chung cho toàn viện, sau đó nhập điểm ngưỡng của từng ngành trong đợt.</Alert>}
      {data && <>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>Điểm ngưỡng từng ngành — {data.round.name}</Typography>
          <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Ngành</TableCell><TableCell>Chuyên ngành</TableCell><TableCell>Điểm ngưỡng (0–20)</TableCell></TableRow></TableHead><TableBody>
            {majors.map((major) => <TableRow key={major.id}><TableCell>{major.discipline?.name || "—"}</TableCell><TableCell>{major.name}</TableCell><TableCell>
              {admin ? <TextField size="small" type="number" value={thresholdDrafts[major.id] ?? data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? ""}
                disabled={saving || workflowBusy || loading} inputProps={{ min: 0, max: 20, step: 0.01, "aria-label": `Điểm ngưỡng ${major.name}` }}
                onChange={(event) => setThresholdDrafts((previous) => { const next = { ...previous }; if (event.target.value === String(data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? "")) delete next[major.id]; else next[major.id] = event.target.value; return next; })} />
                : data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? "Chưa nhập"}
            </TableCell></TableRow>)}
          </TableBody></Table></TableContainer>
          {admin && <Button sx={{ mt: 1 }} variant="contained" disabled={!thresholdsDirty || saving || workflowBusy || loading || scoresDirty} onClick={saveMajorThresholds}>Lưu điểm ngưỡng các ngành</Button>}
          {thresholdsDirty && <Alert severity="warning" sx={{ mt: 1 }}>Điểm ngưỡng đang sửa chưa lưu.{scoresDirty ? " Lưu điểm hồ sơ trước, sau đó lưu điểm ngưỡng các ngành." : " Lưu điểm ngưỡng trước khi xét tuyển."}</Alert>}
        </Paper>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={`Ngành đã nhập ngưỡng: ${(data.round.majorThresholds || []).filter((entry) => entry.cutoff != null).length}`} color="primary" />
          <Chip label={`Hồ sơ: ${data.rows.length}`} variant="outlined" />
          <Chip label={`Đạt ngưỡng: ${data.rows.filter((row) => !row.stale && row.meetsCutoff === true).length}`} color="success" variant="outlined" />
          <Chip label={`Đã duyệt: ${data.admittedCount}`} variant="outlined" />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField size="small" label="Tìm họ tên / mã hồ sơ" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: 1 }} />
          <TextField select size="small" label="Lọc ngành" value={majorFilter} onChange={(event) => setMajorFilter(event.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="all">Tất cả ngành</MenuItem>{majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Lọc hồ sơ" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ minWidth: 220 }}>
            {[["all", "Tất cả"], ["eligible", "Đạt ngưỡng"], ["below", "Dưới ngưỡng"], ["unscored", "Chưa nhập điểm"], ["pending", "Chưa duyệt"], ["admitted", "Đã trúng tuyển"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
        </Stack>
        <BulkAdmissionWorkflow data={data} visibleRows={rows} paginationKey={`${roundId}:${search}:${filter}:${majorFilter}`} admin={admin} loading={loading || saving} thresholdsDirty={thresholdsDirty} onRefresh={loadRanking} onDirtyChange={setScoresDirty} onBusyChange={setWorkflowBusy} />
      </>}
    </Stack>
    <Dialog open={Boolean(form)} onClose={() => !saving && setForm(null)} maxWidth="sm" fullWidth>
      <DialogTitle>{form?.id ? "Sửa đợt xét tuyển toàn viện" : "Tạo đợt xét tuyển toàn viện"}</DialogTitle>
      <DialogContent>{form && <Stack spacing={2} mt={1}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField size="small" label="Tên đợt xét tuyển" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <TextField size="small" label="Năm tuyển sinh" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} />
        <Typography variant="body2">Đợt áp dụng cho tất cả ngành thạc sĩ trong năm. Nhập điểm ngưỡng từng ngành ở bảng sau khi tạo đợt.</Typography>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setForm(null)} disabled={saving}>Hủy</Button><Button variant="contained" onClick={saveRound} disabled={saving || !form?.name.trim() || !form?.academicYear}>Lưu đợt xét tuyển</Button></DialogActions>
    </Dialog>
  </FeatureLayout>;
}
