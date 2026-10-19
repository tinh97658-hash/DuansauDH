import { usePermissions } from "../../features/accounts/usePermissions";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import BulkAdmissionWorkflow from "../../features/admission/BulkAdmissionWorkflow";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import AppDialog from "../../components/AppDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getMockConfirmResult } from "../../utils/confirmHelper";
import { API_BASE_URL } from "../../config/http";
import { normalizeMajorsResponse } from "../../utils/majors";

const options = { withCredentials: true };
const compactFieldLabelSx = {
  display: "block",
  mb: "5px",
  color: "#435b72",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  textTransform: "uppercase",
};
const compactControlSx = {
  "& .MuiOutlinedInput-root": {
    height: 40,
    borderRadius: "4px",
    backgroundColor: "#fff",
    color: "#1c2936",
    fontSize: "13px",
    fontWeight: 500,
    "& fieldset": { borderColor: "#c5d1db" },
    "&:hover fieldset": { borderColor: "#8fa6b9" },
    "&.Mui-focused fieldset": { borderColor: "var(--primary, #0788B8)", borderWidth: "1.5px" },
  },
  "& .MuiOutlinedInput-input": {
    height: "auto",
    padding: "9px 12px",
    lineHeight: "20px",
  },
};
export default function AdmissionScores() {
  const { can } = usePermissions();
  const admin = can("admission.manage");
  const [scoresDirty, setScoresDirty] = useState(false), [workflowBusy, setWorkflowBusy] = useState(false);
  const [rounds, setRounds] = useState([]), [majors, setMajors] = useState([]);
  const [roundId, setRoundId] = useState("");
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [form, setForm] = useState(null);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [majorFilter, setMajorFilter] = useState("all");
  const [thresholdDrafts, setThresholdDrafts] = useState({});
  const [discardAction, setDiscardAction] = useState(null);
  const [showEligible, setShowEligible] = useState(false);
  const thresholdsDirty = Object.keys(thresholdDrafts).length > 0;
  const loadRounds = useCallback(async () => {
    const [config, catalog] = await Promise.all([
      axios.get(`${API_BASE_URL}/plan/admission-rounds`, options), axios.get(`${API_BASE_URL}/system/majors`, options),
    ]);
    setRounds(config.data.rows || []);
    setMajors(normalizeMajorsResponse(catalog.data).filter((major) => major.program === "masters" && major.active !== false));
    return config.data.rows || [];
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
  const runWithDiscardCheck = (action) => {
    if (!scoresDirty && !thresholdsDirty) {
      action();
      return;
    }
    const mock = getMockConfirmResult("Điểm hồ sơ hoặc điểm ngưỡng ngành đang sửa chưa lưu. Bỏ các thay đổi để tiếp tục?");
    if (mock !== null) {
      if (mock) action();
      return;
    }
    setDiscardAction(() => action);
  };
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
    const matchesView = showEligible
      ? !row.stale && row.meetsCutoff === true && row.decision !== "rejected"
      : row.decision === "pending";
    const matches = `${row.fullName} ${row.code || ""}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"));
    return matchesView && matches && (majorFilter === "all" || row.majorId === majorFilter) && (filter === "all" || (filter === "eligible" ? !row.stale && row.meetsCutoff === true
      : filter === "below" ? row.meetsCutoff === false : filter === "unscored" ? row.total == null : row.decision === filter));
  });
  return <FeatureLayout title="Điểm xét tuyển thạc sĩ" group="Thủ tục đầu vào" hideHeader={false} desc="Chọn đợt xét tuyển toàn viện, nhập điểm ngưỡng từng ngành và điểm hồ sơ để lọc danh sách đạt ngưỡng.">
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper variant="outlined" sx={{ p: "12px", borderRadius: "6px", borderColor: "#C6D5E1", bgcolor: "#FFF", boxShadow: "none" }}>
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSelectField label="Đợt xét tuyển toàn viện" value={roundId} disabled={saving || workflowBusy || loading}
            onChange={(event) => { const val = event.target.value; runWithDiscardCheck(() => { setData(null); setThresholdDrafts({}); setMajorFilter("all"); setRoundId(val); }); }} sx={{ width: { xs: "100%", sm: 360 }, maxWidth: "100%" }}>
            <MenuItem value="">Chọn đợt xét tuyển</MenuItem>{rounds.map((round) => <MenuItem key={round.id} value={round.id}>{round.name} · {round.academicYear}</MenuItem>)}
          </FilterSelectField>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ "& .MuiButton-root": { height: 38, whiteSpace: "nowrap", borderRadius: "4px" } }}>
            <Button size="small" variant="outlined" startIcon={<RefreshRounded />} onClick={() => runWithDiscardCheck(() => { setThresholdDrafts({}); loadRanking(); })} disabled={!roundId || loading || workflowBusy || saving}>Tải lại</Button>
            {admin && <>
              <Button size="small" variant="outlined" startIcon={<EditRounded />} disabled={!data || loading || workflowBusy || saving} onClick={() => runWithDiscardCheck(() => openForm(data.round))}>Sửa đợt</Button>
              <Button size="small" variant="contained" startIcon={<AddRounded />} disabled={workflowBusy || saving} onClick={() => runWithDiscardCheck(() => openForm(null))} sx={{ bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }}>Tạo đợt xét tuyển</Button>
            </>}
          </Stack>
        </Stack>
      </Paper>
      {loading && <Box sx={{ textAlign: "center", p: 2 }}><CircularProgress size={28} /></Box>}
      {!rounds.length && !loading && <Alert severity="info" sx={{ borderRadius: "4px" }}>Tạo đợt xét tuyển chung cho toàn viện, sau đó nhập điểm ngưỡng của từng ngành trong đợt.</Alert>}
      {data && <>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: "6px", borderColor: "#D7E4EE" }}>
          <Typography fontWeight={700} mb={1}>Điểm ngưỡng từng ngành — {data.round.name}</Typography>
          <TableContainer sx={{ border: "1px solid #D7E4EE", borderRadius: "6px" }}><Table size="small"><TableHead><TableRow sx={{ bgcolor: "#EDF4FA", "& th": { fontWeight: 700, color: "#111" } }}><TableCell>Ngành</TableCell><TableCell>Chuyên ngành</TableCell><TableCell>Điểm ngưỡng (0–20)</TableCell></TableRow></TableHead><TableBody>
            {majors.map((major) => <TableRow key={major.id} hover sx={{ "&:hover": { bgcolor: "#F5FAFE!important" }, "& td": { borderColor: "#E2EBF2" } }}><TableCell>{major.discipline?.name || "—"}</TableCell><TableCell>{major.name}</TableCell><TableCell>
              {admin ? <TextField size="small" type="number" value={thresholdDrafts[major.id] ?? data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? ""}
                disabled={saving || workflowBusy || loading} inputProps={{ min: 0, max: 20, step: 0.01, "aria-label": `Điểm ngưỡng ${major.name}` }}
                sx={{ width: 90, "& .MuiOutlinedInput-root": { borderRadius: "4px" } }}
                onChange={(event) => setThresholdDrafts((previous) => { const next = { ...previous }; if (event.target.value === String(data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? "")) delete next[major.id]; else next[major.id] = event.target.value; return next; })} />
                : data.round.majorThresholds?.find((entry) => entry.majorId === major.id)?.cutoff ?? "Chưa nhập"}
            </TableCell></TableRow>)}
          </TableBody></Table></TableContainer>
          {admin && <Button sx={{ mt: 1.5, borderRadius: "4px", bgcolor: "#0788B8", "&:hover": { bgcolor: "#056A8F" } }} variant="contained" disabled={!thresholdsDirty || saving || workflowBusy || loading || scoresDirty} onClick={saveMajorThresholds}>Lưu điểm ngưỡng các ngành</Button>}
          {thresholdsDirty && <Alert severity="warning" sx={{ mt: 1, borderRadius: "4px" }}>Điểm ngưỡng đang sửa chưa lưu.{scoresDirty ? " Lưu điểm hồ sơ trước, sau đó lưu điểm ngưỡng các ngành." : " Lưu điểm ngưỡng trước khi xét tuyển."}</Alert>}
        </Paper>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={`Ngành đã nhập ngưỡng: ${(data.round.majorThresholds || []).filter((entry) => entry.cutoff != null).length}`} color="primary" sx={{ borderRadius: "4px" }} />
          <Chip label={`Hồ sơ: ${data.rows.length}`} variant="outlined" sx={{ borderRadius: "4px" }} />
          <Chip label={`Đạt ngưỡng: ${data.rows.filter((row) => !row.stale && row.meetsCutoff === true).length}`} color="success" variant="outlined" sx={{ borderRadius: "4px" }} />
          <Chip label={`Đã duyệt: ${data.admittedCount}`} variant="outlined" sx={{ borderRadius: "4px" }} />
        </Stack>
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
          <FilterSearchField label="Tìm kiếm" placeholder="Tìm họ tên / mã hồ sơ..." value={search} onChange={(event) => setSearch(event.target.value)} sx={{ width: { xs: "100%", sm: 320 }, maxWidth: "100%" }} />
          <FilterSelectField label="Lọc ngành" value={majorFilter} onChange={(event) => setMajorFilter(event.target.value)} sx={{ width: { xs: "100%", sm: 240 }, maxWidth: "100%" }}>
            <MenuItem value="all">Tất cả ngành</MenuItem>{majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
          </FilterSelectField>
          <FilterSelectField label="Lọc hồ sơ" value={filter} onChange={(event) => setFilter(event.target.value)} sx={{ width: { xs: "100%", sm: 220 }, maxWidth: "100%" }}>
            {[["all", "Tất cả"], ["eligible", "Đạt ngưỡng"], ["below", "Dưới ngưỡng"], ["unscored", "Chưa nhập điểm"], ["pending", "Chưa duyệt"], ["admitted", "Đã trúng tuyển"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </FilterSelectField>
        </Stack>
        <BulkAdmissionWorkflow data={data} visibleRows={rows} paginationKey={`${roundId}:${search}:${filter}:${majorFilter}:${showEligible}`} admin={admin} loading={loading || saving} thresholdsDirty={thresholdsDirty} onRefresh={loadRanking} onDirtyChange={setScoresDirty} onBusyChange={setWorkflowBusy}
          recordViewControl={<FormControlLabel sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
            label={showEligible ? "Hồ sơ đủ điều kiện" : "Hồ sơ chờ xét tuyển"}
            control={<Switch checked={showEligible} disabled={loading || saving || workflowBusy}
              onChange={(event) => setShowEligible(event.target.checked)} inputProps={{ role: "switch", "aria-label": "Hiển thị hồ sơ đủ điều kiện" }}
              sx={{ "& .MuiSwitch-switchBase": { color: "#c62828" }, "& .MuiSwitch-track": { backgroundColor: "#c62828", opacity: 0.45 },
                "& .MuiSwitch-switchBase.Mui-checked": { color: "#16803c" },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#16803c", opacity: 0.5 } }} />} />} />
      </>}
    </Stack>
    <AppDialog
      open={Boolean(form)}
      onClose={() => !saving && setForm(null)}
      maxWidth="xs"
      PaperProps={{ sx: { width: 480, maxWidth: "calc(100vw - 32px)" } }}
      title={form?.id ? "SỬA ĐỢT XÉT TUYỂN TOÀN VIỆN" : "TẠO ĐỢT XÉT TUYỂN TOÀN VIỆN"}
      confirmText={form?.id ? "Lưu thay đổi" : "Lưu đợt xét tuyển"}
      cancelText="Hủy"
      onConfirm={saveRound}
      confirmDisabled={saving || !form?.name?.trim() || !form?.academicYear}
      saving={saving}
    >
      {form && (
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" sx={{ borderRadius: "4px" }}>{error}</Alert>}
          <Box sx={{ p: 2, border: "1px solid #D6E0EA", borderRadius: "4px", bgcolor: "#F8FAFC" }}>
            <Stack spacing={2}>
              <Box>
                <Typography component="label" htmlFor="round-name" sx={compactFieldLabelSx}>
                  TÊN ĐỢT XÉT TUYỂN
                </Typography>
                <TextField
                  id="round-name"
                  size="small"
                  fullWidth
                  placeholder="Nhập tên đợt (VD: Đợt 1 / 2026)..."
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  inputProps={{ "aria-label": "Tên đợt xét tuyển" }}
                  sx={compactControlSx}
                />
              </Box>
              <Box>
                <Typography component="label" htmlFor="round-year" sx={compactFieldLabelSx}>
                  NĂM TUYỂN SINH
                </Typography>
                <TextField
                  id="round-year"
                  size="small"
                  fullWidth
                  placeholder="VD: 2026"
                  value={form.academicYear}
                  onChange={(event) => setForm({ ...form, academicYear: event.target.value })}
                  inputProps={{ "aria-label": "Năm tuyển sinh" }}
                  sx={compactControlSx}
                />
              </Box>
            </Stack>
          </Box>
          <Box sx={{ p: 1.25, bgcolor: "#EFF6FB", border: "1px solid #CDE0F0", borderRadius: "4px", display: "flex", gap: 1.25, alignItems: "flex-start" }}>
            <InfoOutlined sx={{ fontSize: 18, color: "#0788B8", mt: "1px", flexShrink: 0 }} />
            <Typography sx={{ fontSize: "12px", color: "#244360", lineHeight: "17px" }}>
              Đợt áp dụng cho tất cả ngành thạc sĩ trong năm. Nhập điểm ngưỡng từng ngành ở bảng sau khi tạo đợt.
            </Typography>
          </Box>
        </Stack>
      )}
    </AppDialog>

    <ConfirmDialog
      open={Boolean(discardAction)}
      onClose={() => setDiscardAction(null)}
      onConfirm={() => {
        const fn = discardAction;
        setDiscardAction(null);
        fn?.();
      }}
      title="XÁC NHẬN BỎ THAY ĐỔI"
      content="Điểm hồ sơ hoặc điểm ngưỡng ngành đang sửa chưa lưu. Bỏ các thay đổi để tiếp tục?"
      severity="warning"
      confirmText="Bỏ thay đổi"
    />
  </FeatureLayout>;
}
