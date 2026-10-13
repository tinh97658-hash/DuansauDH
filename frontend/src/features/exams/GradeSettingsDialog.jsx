import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TableBody, TableCell, TableContainer, TableRow, TextField, Typography } from "@mui/material";
import AppDialog from "../../components/AppDialog";
import FilterSelectField from "../../components/FilterSelectField";
import FilterSearchField from "../../components/FilterSearchField";
import ResizableTable from "../../components/ResizableTable";
import { API_BASE_URL } from "../../config/http";
import { gradebookColumns, SCORE_FIELDS } from "./gradebook";
import { useSubjectCatalogRevision } from "../../utils/subjectCatalog";
import ConfirmDialog from "../../components/ConfirmDialog";
import GradingPolicyEditor from "./GradingPolicyEditor";
import { announcePolicyChange, clonePolicy, DEFAULT_GRADING_POLICY, numericPolicy, policyError } from "./gradingPolicy";

const scoreKeys = new Set([...SCORE_FIELDS.map(([key]) => key).filter(key => key !== "grade4"), "result"]);
const scoreColumns = gradebookColumns().filter((column) => scoreKeys.has(column.key));
const weightKeys = new Set(["testScore", "assignmentScore", "examScore"]);
const columns = [
  { key: "index", label: "STT", width: 55, minWidth: 45, align: "center" },
  { key: "code", label: "Mã học phần", width: 120, minWidth: 90 },
  { key: "subject", label: "Tên học phần", width: 290, minWidth: 180 },
  { key: "credits", label: "Số TC", width: 75, align: "center" },
  ...scoreColumns,
];
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi").trim();

export default function GradeSettingsDialog({ initialMajorId = "", initialYear = "", groups = [], onClose, canEdit = true }) {
  const catalogRevision = useSubjectCatalogRevision();
  const [majorId, setMajorId] = useState(initialMajorId || groups[0]?.majorId || "");
  const [year, setYear] = useState(String(initialYear || new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [policies, setPolicies] = useState({});
  const [drafts, setDrafts] = useState({});
  const [policyLoading, setPolicyLoading] = useState(false);
  const [loadedPolicyScope, setLoadedPolicyScope] = useState("");
  const [policyLoadError, setPolicyLoadError] = useState("");
  const [policyReload, setPolicyReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const [editor, setEditor] = useState(null);
  const [sharedPolicy, setSharedPolicy] = useState(null);
  const [sharedDraft, setSharedDraft] = useState(null);
  const [sharedError, setSharedError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [focusedWeight, setFocusedWeight] = useState("");
  useEffect(() => {
    let active = true;
    setSharedError("");
    axios.get(`${API_BASE_URL}/masters/grading-rules`).then(({ data }) => active && setSharedPolicy(data))
      .catch(() => active && setSharedError("Không thể tải điều kiện đạt và bảng quy đổi chung. Vui lòng thử lại."));
    return () => { active = false; };
  }, [policyReload]);

  useEffect(() => {
    let active = true;
    setData(null); setLoading(true); setError("");
    const config = { params: { program: "masters" }, withCredentials: true };
    Promise.all([
      axios.get(`${API_BASE_URL}/plan/training-plan`, config),
      axios.get(`${API_BASE_URL}/plan/subjects`, config),
    ]).then(([majors, catalog]) => {
      if (active) setData({ majors: majors.data, catalog: catalog.data });
    }).catch(() => {
      if (active) { setError("Không thể tải danh sách học phần. Vui lòng thử lại."); setLoading(false); }
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [retry, catalogRevision]);

  const majors = useMemo(() => {
    const unique = new Map(groups.filter((group) => group.majorId).map((group) =>
      [group.majorId, { id: group.majorId, name: group.major?.name || group.major?.code || group.majorId }]));
    (data?.majors || []).forEach((major) => unique.set(major.id, major));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [data, groups]);
  const selectedMajorId = majors.some((major) => major.id === majorId) ? majorId : majors[0]?.id || "";
  useEffect(() => {
    if (!data || !selectedMajorId || !year) { setPolicyLoading(false); return undefined; }
    let active = true;
    setPolicyLoading(true); setPolicyLoadError(""); setLoadedPolicyScope("");
    axios.get(`${API_BASE_URL}/masters/grading-policies`, { params: { majorId: selectedMajorId, year } })
      .then(({ data }) => { if (active) {
        setPolicies(current => ({ ...current, ...Object.fromEntries(data.map(row => [`${year}:${row.subjectId}`, row.policy])) }));
        setLoadedPolicyScope(`${selectedMajorId}:${year}`);
      } })
      .catch(failure => active && setPolicyLoadError(failure.response?.data?.message || "Không thể tải cấu hình tính điểm. Vui lòng thử lại."))
      .finally(() => active && setPolicyLoading(false));
    return () => { active = false; };
  }, [data, selectedMajorId, year, policyReload]);
  const years = useMemo(() => [...new Set([
    year,
    initialYear,
    ...groups.filter((group) => group.majorId === selectedMajorId).map((group) => group.academicYear),
    String(new Date().getFullYear()),
  ].filter(Boolean).map(String))].sort((a, b) => b.localeCompare(a, "vi", { numeric: true })), [groups, initialYear, selectedMajorId, year]);
  const items = useMemo(() => {
    const query = normalize(search);
    return (data?.catalog || []).filter((subject) => subject.majorId === selectedMajorId
      && (!query || normalize(`${subject.name} ${subject.codeText || subject.code || subject.codeNumber || ""}`).includes(query)))
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || a.name.localeCompare(b.name, "vi"));
  }, [data, selectedMajorId, search]);
  const count = items.length;
  const policyUnavailable = !year || policyLoading || loadedPolicyScope !== `${selectedMajorId}:${year}` || Boolean(policyLoadError);
  const sharedLocked = !canEdit || !sharedPolicy || Boolean(sharedError) || saving;
  const locked = sharedLocked || loading || policyUnavailable || Boolean(error);
  const common = sharedDraft || sharedPolicy || DEFAULT_GRADING_POLICY;
  const dirtyCount = Object.keys(drafts).length + (sharedDraft ? 1 : 0);
  const policyOf = subject => {
    const course = drafts[`${year}:${subject.id}`]?.policy || policies[`${year}:${subject.id}`] || DEFAULT_GRADING_POLICY;
    return { ...common, version: course.version, weights: course.weights, rulesVersion: common.version };
  };
  const updatePolicy = (subject, update) => {
    const scope = `${year}:${subject.id}`;
    setDrafts(current => {
      const base = policies[scope] || DEFAULT_GRADING_POLICY;
      const policy = update(clonePolicy(current[scope]?.policy || base));
      const next = { ...current };
      if (JSON.stringify(numericPolicy(policy).weights) === JSON.stringify(numericPolicy(base).weights)) delete next[scope];
      else next[scope] = { subjectId: subject.id, name: subject.name, year, policy };
      return next;
    });
    setSaveError(""); setSuccess("");
  };
  const savePolicies = async () => {
    const entries = Object.values(drafts);
    for (const entry of entries) {
      const invalid = policyError({ ...common, weights: entry.policy.weights });
      if (invalid) { setSaveError(`${entry.name} (${entry.year}): ${invalid}`); return; }
    }
    if (sharedDraft && policyError(sharedDraft)) { setSaveError(policyError(sharedDraft)); return; }
    setSaving(true); setSaveError(""); setSuccess("");
    try {
      const { data: saved } = await axios.put(`${API_BASE_URL}/masters/grading-policies`, { rows: entries.map(entry => {
        const { version, rulesVersion, ...policy } = numericPolicy({ ...common, version: entry.policy.version, weights: entry.policy.weights });
        return { subjectId: entry.subjectId, year: entry.year, revision: version, ...policy };
      }), ...(sharedDraft ? { shared: { revision: sharedPolicy.version, minimums: numericPolicy(common).minimums, courseMinimum: Number(common.courseMinimum), useDefaultBands: common.useDefaultBands, bands: numericPolicy(common).bands } } : {}) });
      setPolicies(current => ({ ...current, ...Object.fromEntries(saved.map(row => [`${row.year}:${row.subjectId}`, row.policy])) }));
      setDrafts({});
      if (sharedDraft) { setSharedPolicy({ ...numericPolicy(sharedDraft), version: sharedPolicy.version + 1 }); setSharedDraft(null); }
      setSuccess(`Đã lưu cấu hình${sharedDraft ? " chung" : ""}${saved.length ? ` và tỷ trọng ${saved.length} môn` : ""}. Các điểm đã cập nhật trước đó giữ nguyên cách tính cũ.`);
      announcePolicyChange();
    } catch (failure) {
      const message = failure.response?.data?.message;
      setSaveError(Array.isArray(message) ? message.join(" ") : message || "Không thể lưu cấu hình. Các thay đổi đang nhập vẫn được giữ lại.");
    } finally { setSaving(false); }
  };
  const requestClose = () => { if (dirtyCount) setConfirmClose(true); else onClose(); };

  return <><AppDialog open onClose={requestClose} title="Cài đặt điểm số" maxWidth={false} cancelText="Đóng"
    onConfirm={canEdit ? savePolicies : undefined} confirmText={`Lưu cấu hình${dirtyCount ? ` (${dirtyCount})` : ""}`}
    confirmDisabled={!dirtyCount || sharedLocked || (Object.keys(drafts).length > 0 && locked)} saving={saving}
    closeButtonAriaLabel="Đóng cài đặt điểm số"
    aria-label="Cài đặt điểm số" PaperProps={{ sx: {
      width: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
      height: { xs: "calc(100dvh - 32px)", sm: "calc(100dvh - 64px)" },
      maxHeight: { xs: "calc(100dvh - 32px)", sm: "calc(100dvh - 64px)" },
      m: { xs: 2, sm: 4 },
    } }}
    contentSx={{ bgcolor: "var(--page-bg, #F5F7F8)", display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, flex: 1 }}>
    <Paper variant="outlined" sx={{ p: 1.5, borderColor: "var(--table-border-color, #D7E4EE)", borderRadius: "10px", flexShrink: 0 }}>
      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
        <FilterSelectField label="Năm" value={year} disabled={!data || saving} sx={{ flex: "1 1 130px" }} onChange={(event) => setYear(event.target.value)}>
          <MenuItem value="">Tất cả năm</MenuItem>
          {years.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </FilterSelectField>
        <FilterSelectField label="Chuyên ngành" value={selectedMajorId} disabled={!data || !majors.length || saving} sx={{ flex: "2 1 260px" }} onChange={(event) => setMajorId(event.target.value)}>
          {!majors.length && <MenuItem value="">{loading ? "Đang tải chuyên ngành..." : "Chưa có chuyên ngành"}</MenuItem>}
          {majors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
        </FilterSelectField>
        <FilterSearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên học phần..." sx={{ flex: "2 1 260px" }} />
      </Stack>
    </Paper>
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ flexShrink: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "var(--secondary, #173E75)" }}>Danh sách học phần</Typography>
      <Chip size="small" label={loading ? "Đang tải..." : `${count} học phần`} sx={{ bgcolor: "var(--table-header-bg, #EDF4FA)", color: "var(--secondary, #173E75)" }} />
      <Button size="small" variant={!editor ? "contained" : "outlined"} disabled={saving} aria-pressed={!editor} onClick={() => setEditor(null)}>Cài đặt điểm</Button>
      <Button size="small" variant={editor === "conversion" ? "contained" : "outlined"} disabled={saving || !sharedPolicy || Boolean(sharedError)}
        aria-pressed={editor === "conversion"} aria-controls="grading-policy-panel" onClick={() => setEditor("conversion")}>Quy đổi thang điểm</Button>
      <Button size="small" variant={editor === "conditions" ? "contained" : "outlined"} disabled={saving || !sharedPolicy || Boolean(sharedError)}
        aria-pressed={editor === "conditions"} aria-controls="grading-policy-panel" onClick={() => setEditor("conditions")}>Điều kiện đạt</Button>
      {Object.keys(drafts).length > 0 && <Chip size="small" color="warning" variant="outlined" label={`${Object.keys(drafts).length} môn chưa lưu`} />}
      {sharedDraft && <Chip size="small" color="warning" variant="outlined" label="Cấu hình chung chưa lưu" />}
      {policyLoading && <CircularProgress size={16} aria-label="Đang tải cấu hình tính điểm" />}
    </Stack>
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setRetry((value) => value + 1)}>Thử lại</Button>}>{error}</Alert>}
    {policyLoadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setPolicyReload(value => value + 1)}>Thử lại cấu hình</Button>}>{policyLoadError}</Alert>}
    {saveError && <Alert severity="error">{saveError}</Alert>}
    {sharedError && <Alert severity="error" action={<Button onClick={() => setPolicyReload(value => value + 1)}>Thử lại</Button>}>{sharedError}</Alert>}
    {success && <Alert severity="success">{success}</Alert>}
    {!year && <Alert severity="info">Chọn một năm cụ thể để cấu hình cách tính điểm.</Alert>}
    {editor && <Paper id="grading-policy-panel" variant="outlined" sx={{ p: 1.5, borderRadius: "4px", flex: 1, minHeight: 0, overflow: "auto" }}>
      <GradingPolicyEditor key={editor} policy={common} mode={editor} shared readOnly={sharedLocked}
        onApply={policy => { setSharedDraft(JSON.stringify(numericPolicy(policy)) === JSON.stringify(numericPolicy(sharedPolicy)) ? null : policy); setSaveError(""); setSuccess(""); }} />
    </Paper>}
    {!editor && <TableContainer sx={{ flex: 1, minHeight: 0 }}>
      <ResizableTable columns={columns} storageKey="masters-grade-settings-columns" freezeThrough="code" aria-label="Học phần theo chuyên ngành">
        <TableBody>
          {loading ? <TableRow><TableCell colSpan={columns.length} align="center"><CircularProgress size={28} aria-label="Đang tải học phần" /></TableCell></TableRow>
            : error ? <TableRow><TableCell colSpan={columns.length} align="center">Chưa tải được danh sách học phần.</TableCell></TableRow>
            : !count ? <TableRow><TableCell colSpan={columns.length} align="center" sx={{ color: "var(--text-secondary, #607486)" }}>
              {search.trim() ? "Không tìm thấy học phần phù hợp." : "Chưa có học phần trong danh mục của chuyên ngành đã chọn."}
            </TableCell></TableRow>
            : items.map((subject, index) => <TableRow key={subject.id} hover>
                <TableCell align="center">{index + 1}</TableCell>
                <TableCell title={subject.codeText || subject.code || String(subject.codeNumber || "")} sx={{ fontWeight: 600 }}>{subject.codeText || subject.code || subject.codeNumber || "—"}</TableCell>
                <TableCell title={subject.name}>{subject.name}</TableCell>
                <TableCell align="center">{subject.credits ?? "—"}</TableCell>
                {scoreColumns.map((column) => {
                  const policy = policyOf(subject);
                  if (column.key === "courseScore") return <TableCell key={column.key} align="center">≥ {policy.courseMinimum}</TableCell>;
                  if (column.key === "result") return <TableCell key={column.key} align="center" title={`Kiểm tra ≥ ${policy.minimums.testScore}; BTL/TL/KT ≥ ${policy.minimums.assignmentScore}; Thi ≥ ${policy.minimums.examScore}; Học phần ≥ ${policy.courseMinimum}`}>Theo điều kiện môn</TableCell>;
                  if (!weightKeys.has(column.key)) return <TableCell key={column.key} align="center" sx={{ color: "var(--text-secondary, #607486)" }}>—</TableCell>;
                  const key = `${year}:${subject.id}:${column.key}`;
                  const value = String(policy.weights[column.key] ?? "");
                  return <TableCell key={column.key} align="center" sx={{ bgcolor: "#F7FAFC" }}>
                    <TextField fullWidth size="small" placeholder="—" disabled={locked}
                      value={value !== "" && focusedWeight !== key ? `${value}%` : value}
                      onFocus={() => setFocusedWeight(key)}
                      onChange={(event) => {
                        const next = event.target.value.replace(/%$/, "").replace(",", ".");
                        if (next === "" || (/^\d*(?:\.\d*)?$/.test(next) && Number.isFinite(Number(next)) && Number(next) >= 0 && Number(next) <= 100)) {
                          updatePolicy(subject, current => ({ ...current, weights: { ...current.weights, [column.key]: next } }));
                        }
                      }}
                      onBlur={() => {
                        if (value !== "") updatePolicy(subject, current => ({ ...current, weights: { ...current.weights, [column.key]: String(Number(value)) } }));
                        setFocusedWeight("");
                      }}
                      inputProps={{ "aria-label": `Tỷ trọng ${column.label.toLocaleLowerCase("vi")} ${subject.codeText || subject.code || subject.name}`, inputMode: "decimal" }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          height: 30, fontSize: 12, borderRadius: 0, bgcolor: "transparent",
                          "& fieldset, &:hover fieldset, &.Mui-focused fieldset": { border: 0 },
                          "&.Mui-focused": { bgcolor: "transparent", boxShadow: "none" },
                        },
                        "& input": { textAlign: "center", px: 0.75, py: 0.5 },
                      }} />
                  </TableCell>;
                })}
              </TableRow>)}
        </TableBody>
      </ResizableTable>
    </TableContainer>}
  </AppDialog>
    <ConfirmDialog open={confirmClose} title="Cấu hình chưa lưu" content="Các thay đổi cách tính điểm chưa được lưu. Bạn có muốn đóng và bỏ các thay đổi này?"
      cancelText="Ở lại" confirmText="Bỏ thay đổi và đóng" onClose={() => setConfirmClose(false)} onConfirm={onClose} />
  </>;
}
