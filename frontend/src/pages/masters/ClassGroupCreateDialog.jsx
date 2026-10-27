import { ResponsibleStaffSelect } from "../../features/accounts/GroupResponsibleStaff";
import { usePermissions } from "../../features/accounts/usePermissions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Alert, Box, Button, Chip, FormControl, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import AppDialog from "../../components/AppDialog";
import { API_BASE_URL } from "../../config/http";
import { disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline } from "../../utils/disciplineScope";
import { formatGroupName, getAvailableGroupIndexes, validateNameTemplate } from "./createClassGroups.logic";
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const majorShortName = (major) => String(major?.code || "").trim().toUpperCase();
const DEFAULT_MAX_STUDENTS = 20;

export const initialClassGroupForm = (year = String(currentYear)) => ({
  code: "",
  nameTemplate: null,
  count: 1,
  majorId: "",
  curriculumId: "",
  academicYear: year,
  intakeRound: 1,
  maxStudents: DEFAULT_MAX_STUDENTS,
  status: "open",
  note: "",
});

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
    padding: "9px 11px",
    lineHeight: "20px",
  },
  "& .MuiSelect-select": {
    minHeight: "0!important",
    padding: "9px 32px 9px 11px!important",
    lineHeight: "20px",
  },
};

const compactSectionLabelSx = {
  color: "#435b72",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "15px",
  whiteSpace: "nowrap",
};

const compactChipSx = {
  height: 30,
  borderColor: "#bfd0dd",
  borderRadius: "4px",
  backgroundColor: "#f7fbfd",
  color: "var(--secondary, #173E75)",
  fontSize: "12px",
  fontWeight: 600,
  "& .MuiChip-label": { px: 1.25 },
};

const compactAlertSx = {
  minHeight: 32,
  px: 1.25,
  py: 0.25,
  borderRadius: "4px",
  fontSize: "11.5px",
  lineHeight: "17px",
  "& .MuiAlert-icon": { mr: 0.75, py: "5px", fontSize: 18 },
  "& .MuiAlert-message": { py: "5px" },
};

const CompactField = ({ label, htmlFor, helper, error = false, children, sx }) => (
  <Box sx={{ minWidth: 0, ...sx }}>
    <Typography component="label" htmlFor={htmlFor} sx={compactFieldLabelSx}>{label}</Typography>
    {children}
    {helper && (
      <Typography variant="caption" component="p" sx={{ mt: "4px", mb: 0, color: error ? "error.main" : "#607486", fontSize: "13px", fontWeight: 400, lineHeight: 1.45 }}>
        {helper}
      </Typography>
    )}
  </Box>
);

// Mounted per create/edit session. Both callers share this form, validation and API writes.
const ClassGroupCreateDialog = ({ majors, initialValues, initialDisciplineId = "", editingId = null, lockedScope = false, isScopeCurrent, onClose, onSaved }) => {
  const { can } = usePermissions();
  const canAssign = can("groups.assign");
  const dialogOpen = true;
  const [form, setForm] = useState(() => ({ ...initialClassGroupForm(), ...initialValues }));
  const [dialogDisciplineId, setDialogDisciplineId] = useState(initialDisciplineId);
  const [curriculums, setCurriculums] = useState([]);
  const [curriculumsLoading, setCurriculumsLoading] = useState(true);
  const [dialogScopeGroups, setDialogScopeGroups] = useState([]);
  const [dialogScopeLoading, setDialogScopeLoading] = useState(!editingId);
  const [dialogScopeError, setDialogScopeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveInFlight = useRef(false);
  const disciplines = useMemo(() => disciplinesFromMajors(majors), [majors]);
  const dialogMajors = useMemo(() => majorsForDiscipline(majors, dialogDisciplineId), [majors, dialogDisciplineId]);
  const selectedFormMajor = useMemo(
    () => majors.find((item) => item.id === form.majorId),
    [form.majorId, majors],
  );
  const defaultNameTemplate = selectedFormMajor?.code && form.academicYear
    ? `${majorShortName(selectedFormMajor)} ${form.academicYear}.${form.intakeRound}.{n}` : "";
  const nameTemplate = form.nameTemplate ?? defaultNameTemplate;
  const nameTemplateError = useMemo(
    () => !selectedFormMajor?.code
      ? "Chuyên ngành chưa có mã. Hãy cập nhật mã chuyên ngành trước."
      : validateNameTemplate(nameTemplate),
    [nameTemplate, selectedFormMajor?.code],
  );
  const nameIndexes = useMemo(
    () => getAvailableGroupIndexes(dialogScopeGroups.map((group) => ({ name: group.code })), nameTemplate, form.count),
    [dialogScopeGroups, nameTemplate, form.count],
  );
  const automaticNames = useMemo(
    () => (nameTemplateError ? [] : nameIndexes.map((index) => formatGroupName(nameTemplate, index, 1))),
    [nameTemplate, nameTemplateError, nameIndexes],
  );
  useEffect(() => {
    if (!dialogOpen || editingId || !form.majorId || !form.academicYear) return undefined;
    let active = true;
    setDialogScopeLoading(true);
    setDialogScopeError("");
    // Codes are unique across the masters program, including other majors and years.
    axios.get(`${API_BASE_URL}/masters/class-groups`, {
      withCredentials: true,
    }).then(({ data }) => {
      if (active) {
        const rows = Array.isArray(data) ? data : data.data || [];
        setDialogScopeGroups(rows.filter((group) => (
          group.majorId === form.majorId && String(group.academicYear) === String(form.academicYear)
        )));
      }
    }).catch(() => {
      if (active) {
        setDialogScopeGroups([]);
        setDialogScopeError("Không thể kiểm tra các nhóm đã tồn tại trong phạm vi này.");
      }
    }).finally(() => {
      if (active) setDialogScopeLoading(false);
    });
    return () => { active = false; };
  }, [dialogOpen, editingId, form.academicYear, form.majorId]);

  useEffect(() => {
    if (!dialogOpen || !form.majorId || !form.academicYear) {
      setCurriculums([]);
      return undefined;
    }
    let active = true;
    setCurriculumsLoading(true);
    axios.get(`${API_BASE_URL}/plan/curriculums?majorId=${form.majorId}&program=masters`, { withCredentials: true })
      .then(({ data }) => {
        if (!active) return;
        const rows = (Array.isArray(data) ? data : data.data || [])
          .filter((item) => String(item.applicableFromYear) === String(form.academicYear) && item.active !== false);
        setCurriculums(rows);
        setForm((previous) => {
          if (rows.some((item) => item.id === previous.curriculumId)) return previous;
          return { ...previous, curriculumId: rows.length === 1 ? rows[0].id : "" };
        });
      })
      .catch(() => active && setCurriculums([]))
      .finally(() => active && setCurriculumsLoading(false));
    return () => { active = false; };
  }, [dialogOpen, form.academicYear, form.majorId]);

  const handleCreateMajorChange = (majorId) => {
    setForm((previous) => ({
      ...previous,
      majorId,
      curriculumId: "",
    }));
  };

  const handleDialogDisciplineChange = (disciplineId) => {
    setDialogDisciplineId(disciplineId);
    const currentMajor = majors.find((item) => item.id === form.majorId);
    if (!disciplineId || majorDisciplineId(currentMajor) === disciplineId) return;
    setForm((previous) => ({ ...previous, majorId: "", curriculumId: "" }));
  };

  const handleCreateYearChange = (academicYear) => {
    setForm((previous) => ({
      ...previous,
      academicYear,
      curriculumId: "",
    }));
  };

  const handleSave = async () => {
    if (editingId && !form.code?.trim()) return toast.error("Vui lòng nhập mã nhóm học phần.");
    if (!editingId && !form.majorId) return toast.error("Vui lòng chọn chuyên ngành.");
    if (!form.curriculumId) return toast.error("Vui lòng chọn chương trình đào tạo cho lớp.");
    if (!editingId && canAssign && !form.responsibleStaffId) return toast.error("Vui lòng chọn chuyên viên phụ trách.");
    const count = Number(form.count || 0);
    if (!editingId && (count < 1 || count > 10)) return toast.error("Số lượng nhóm cần tạo từ 1 đến 10.");
    if (!editingId && nameTemplateError) return toast.error(nameTemplateError);
    if (!editingId && automaticNames.some((code) => !code || code.length > 100)) return toast.error("Quy tắc mã nhóm sinh ra mã không hợp lệ.");
    if (!editingId && new Set(automaticNames).size !== automaticNames.length) return toast.error("Quy tắc mã nhóm sinh ra các mã bị trùng nhau.");
    if (!editingId && (!Number.isInteger(Number(form.intakeRound)) || Number(form.intakeRound) < 1 || Number(form.intakeRound) > 99)) return toast.error("Đợt phải là số nguyên từ 1 đến 99.");
    if (!editingId && dialogScopeGroups.some((group) => automaticNames.includes(group.code))) return toast.error("Mã nhóm đã tồn tại trong chuyên ngành và khóa này.");
    if (!editingId && dialogScopeError) return toast.error(dialogScopeError);
    if (!editingId && dialogScopeLoading) return toast.error("Đang kiểm tra các nhóm đã tồn tại.");
    if (saveInFlight.current || (isScopeCurrent && !isScopeCurrent())) return;
    saveInFlight.current = true;
    setSaveError("");
    setSaving(true);
    try {
      let createdGroups = [];
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.code.trim().toUpperCase(),
        majorId: form.majorId || null,
        curriculumId: form.curriculumId,
        academicYear: form.academicYear,
        maxStudents: Number(form.maxStudents || DEFAULT_MAX_STUDENTS),
        status: form.status,
        note: form.note?.trim() || null,
      };

      if (editingId) {
        if (canAssign && form.responsibleStaffId && form.responsibleStaffId !== initialValues.responsibleStaffId) {
          payload.responsibleStaffId = form.responsibleStaffId;
        }
        await axios.put(`${API_BASE_URL}/masters/class-groups/${editingId}`, payload, { withCredentials: true });
        toast.success("Cập nhật nhóm học phần thành công.");
      } else {
        const major = majors.find((item) => item.id === form.majorId);
        const shortName = majorShortName(major);
        if (!shortName) throw new Error("Chuyên ngành chưa có mã.");
        const { data } = await axios.post(`${API_BASE_URL}/masters/class-groups/batch`, {
          count,
          ...(canAssign ? { responsibleStaffId: form.responsibleStaffId } : {}),
          nameTemplate,
          nameIndexes,
          intakeRound: Number(form.intakeRound),
          majorId: form.majorId,
          curriculumId: form.curriculumId,
          academicYear: form.academicYear,
          maxStudents: Number(form.maxStudents || DEFAULT_MAX_STUDENTS),
          status: form.status,
          note: form.note?.trim() || undefined,
        }, { withCredentials: true });
        toast.success(`Đã tạo thành công ${count} nhóm học viên.`);
        createdGroups = Array.isArray(data?.groups) ? data.groups : [];
      }
      await onSaved(createdGroups);
    } catch (err) {
      const message = err.response?.data?.message || "Không thể lưu nhóm học phần.";
      setSaveError(message);
      toast.error(message);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  return (
      <AppDialog
        open={dialogOpen}
        onClose={saving ? undefined : onClose}
        maxWidth="md"
        fullWidth
        saving={saving}
        title={editingId ? "CHỈNH SỬA NHÓM HỌC VIÊN" : lockedScope ? "Tạo nhóm học viên mới" : "THÊM NHÓM HỌC VIÊN MỚI"}
        PaperProps={{
          sx: {
            width: 800,
            maxWidth: "calc(100vw - 32px)",
          },
        }}
        actions={
          <>
            <Button disabled={saving} onClick={onClose} color="inherit" sx={{ minHeight: 36, px: 2, py: 0.75, border: "1px solid #c5d1db", borderRadius: "4px", color: "#435b72", fontSize: "12.5px", fontWeight: 600 }}>Hủy</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || (editingId ? (!form.code?.trim() || !form.curriculumId) : (
                (canAssign && !form.responsibleStaffId)
                || !form.majorId
                || !form.curriculumId
                || Number(form.count) < 1
                || Number(form.count) > 10
                || Boolean(nameTemplateError)
                || Boolean(dialogScopeError)
                || dialogScopeLoading
              ))}
              sx={{ minHeight: 36, px: 2, py: 0.75, borderRadius: "4px", bgcolor: "#0788B8", boxShadow: "none", fontSize: "12.5px", fontWeight: 700, "&:hover": { bgcolor: "#056A8F", boxShadow: "none" } }}
            >
              {saving ? "Đang lưu..." : editingId ? "Lưu nhóm" : `Tạo ${form.count || 0} nhóm`}
            </Button>
          </>
        }
      >
        {saveError && <Alert severity="error" sx={{ mb: 1 }}>{saveError}</Alert>}
        {lockedScope && <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>Thạc sĩ · {initialValues.academicYear} · {selectedFormMajor?.name}</Typography>}
        {editingId ? (
            <Stack spacing="14px">
              {canAssign ? <ResponsibleStaffSelect value={form.responsibleStaffId} onChange={responsibleStaffId => setForm(previous => ({ ...previous, responsibleStaffId }))} disabled={saving} />
                : <Typography variant="body2">Chuyên viên phụ trách: {initialValues.responsibleStaff?.name || "Chưa phân công"}</Typography>}
              <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                <Stack spacing="13px">
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(120px, .7fr)" }, gap: 1.5 }}>
                    <CompactField label="NGÀNH" htmlFor="edit-discipline">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="edit-discipline" value={dialogDisciplineId} inputProps={{ "aria-label": "Ngành" }} onChange={(e) => handleDialogDisciplineChange(e.target.value)}>
                          <MenuItem value="">Tất cả ngành</MenuItem>
                          {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="CHUYÊN NGÀNH" htmlFor="edit-major">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select
                          id="edit-major"
                          value={form.majorId}
                          inputProps={{ "aria-label": "Chuyên ngành" }}
                          onChange={(e) => setForm((p) => ({ ...p, majorId: e.target.value, curriculumId: "" }))}
                        >
                          {dialogMajors.map((major) => (
                            <MenuItem key={major.id} value={major.id}>
                              {major.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="NĂM / KHÓA" htmlFor="edit-year">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select
                          id="edit-year"
                          value={form.academicYear}
                          inputProps={{ "aria-label": "Năm / khóa" }}
                          onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value, curriculumId: "" }))}
                        >
                          {YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                  </Box>

                  <CompactField
                    label="CHƯƠNG TRÌNH ĐÀO TẠO ÁP DỤNG"
                    htmlFor="edit-curriculum"
                    helper={!curriculumsLoading && curriculums.length === 0 ? "Chưa có CTĐT cho chuyên ngành và khóa này. Hãy lập CTĐT trước." : undefined}
                    error={!curriculumsLoading && curriculums.length === 0}
                  >
                    <FormControl fullWidth size="small" sx={compactControlSx} required>
                      <Select
                        id="edit-curriculum"
                        value={form.curriculumId}
                        inputProps={{ "aria-label": "Chương trình đào tạo" }}
                        onChange={(e) => setForm((p) => ({ ...p, curriculumId: e.target.value }))}
                        disabled={curriculumsLoading || curriculums.length === 0}
                      >
                        {curriculums.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.code} — {item.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </CompactField>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, gap: 1.5, alignItems: "start" }}>
                    <CompactField label="MÃ NHÓM" htmlFor="edit-code">
                      <TextField
                        id="edit-code"
                        value={form.code}
                        onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                        fullWidth
                        size="small"
                        required
                        inputProps={{ "aria-label": "Mã nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>

                    <CompactField label="SĨ SỐ TỐI ĐA / NHÓM" htmlFor="edit-max-students">
                      <TextField
                        id="edit-max-students"
                        type="number"
                        value={form.maxStudents}
                        onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))}
                        fullWidth
                        size="small"
                        inputProps={{ min: 1, max: 200, "aria-label": "Sĩ số tối đa / nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="TRẠNG THÁI" htmlFor="edit-status">
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select
                      id="edit-status"
                      value={form.status}
                      inputProps={{ "aria-label": "Trạng thái" }}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <MenuItem value="open">Đang mở</MenuItem>
                      <MenuItem value="closed">Đã đóng</MenuItem>
                    </Select>
                  </FormControl>
                </CompactField>
                <CompactField label="GHI CHÚ" htmlFor="edit-note">
                  <TextField
                    id="edit-note"
                    placeholder="Nhập ghi chú nếu cần..."
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                    inputProps={{ "aria-label": "Ghi chú" }}
                    fullWidth
                    size="small"
                    sx={compactControlSx}
                  />
                </CompactField>
              </Box>
            </Stack>
          ) : (
            <Stack spacing="14px">
              <Box sx={{ p: 1.75, border: "1px solid #d7e1e8", borderRadius: "8px", backgroundColor: "#fbfcfd" }}>
                <Stack spacing="13px">
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 1.4fr) minmax(120px, .7fr)" }, gap: 1.5 }}>
                    <CompactField label="NGÀNH" htmlFor="create-discipline">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-discipline" disabled={lockedScope} value={dialogDisciplineId} inputProps={{ "aria-label": "Ngành" }} onChange={(e) => handleDialogDisciplineChange(e.target.value)}>
                          <MenuItem value="">Tất cả ngành</MenuItem>
                          {disciplines.map((item) => <MenuItem key={item.id} value={item.id}>{disciplineOptionLabel(item)}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="CHUYÊN NGÀNH" htmlFor="create-major">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-major" disabled={lockedScope} value={form.majorId} inputProps={{ "aria-label": "Chuyên ngành" }} onChange={(e) => handleCreateMajorChange(e.target.value)}>
                          {dialogMajors.map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                    <CompactField label="NĂM / KHÓA" htmlFor="create-year">
                      <FormControl fullWidth size="small" sx={compactControlSx}>
                        <Select id="create-year" disabled={lockedScope} value={form.academicYear} inputProps={{ "aria-label": "Năm / khóa" }} onChange={(e) => handleCreateYearChange(e.target.value)}>
                          {YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </CompactField>
                  </Box>

                  <CompactField
                    label="CHƯƠNG TRÌNH ĐÀO TẠO ÁP DỤNG"
                    htmlFor="create-curriculum"
                    helper={!curriculumsLoading && curriculums.length === 0 ? "Chưa có CTĐT cho chuyên ngành và khóa này. Hãy lập CTĐT trước." : undefined}
                    error={!curriculumsLoading && curriculums.length === 0}
                  >
                    <FormControl fullWidth size="small" sx={compactControlSx} required>
                      <Select id="create-curriculum" value={form.curriculumId} inputProps={{ "aria-label": "Chương trình đào tạo" }} onChange={(e) => setForm((p) => ({ ...p, curriculumId: e.target.value }))} disabled={curriculumsLoading || curriculums.length === 0}>
                        {curriculums.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CompactField>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "minmax(0, .8fr) minmax(0, 1fr) minmax(0, .6fr) minmax(0, 1.6fr)" }, gap: 1.5, alignItems: "start" }}>
                    <CompactField label="SỐ NHÓM CẦN TẠO" htmlFor="create-group-count">
                      <TextField id="create-group-count" type="number" value={form.count} onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 10, "aria-label": "Số nhóm cần tạo" }} sx={compactControlSx} />
                    </CompactField>
                    <CompactField label="SĨ SỐ TỐI ĐA / NHÓM" htmlFor="create-group-capacity">
                      <TextField id="create-group-capacity" type="number" value={form.maxStudents} onChange={(e) => setForm((p) => ({ ...p, maxStudents: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 200, "aria-label": "Sĩ số tối đa / nhóm" }} sx={compactControlSx} />
                    </CompactField>
                    <CompactField label="ĐỢT" htmlFor="create-intake-round">
                      <TextField id="create-intake-round" type="number" value={form.intakeRound} onChange={(e) => setForm((p) => ({ ...p, intakeRound: e.target.value }))} fullWidth size="small" inputProps={{ min: 1, max: 99, "aria-label": "Đợt" }} sx={compactControlSx} />
                    </CompactField>
                    <CompactField label="QUY TẮC MÃ NHÓM" htmlFor="create-name-template" helper={nameTemplateError || "{n}: số nhóm nhỏ nhất chưa sử dụng trong đợt"} error={Boolean(nameTemplateError)}>
                      <TextField
                        id="create-name-template"
                        value={nameTemplate}
                        onChange={(e) => setForm((previous) => ({ ...previous, nameTemplate: e.target.value }))}
                        fullWidth
                        size="small"
                        error={Boolean(nameTemplateError)}
                        inputProps={{ "aria-label": "Quy tắc mã nhóm" }}
                        sx={compactControlSx}
                      />
                    </CompactField>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Typography sx={compactSectionLabelSx}>XEM TRƯỚC</Typography>
                    {automaticNames.map((name) => <Chip key={name} label={name} size="small" variant="outlined" sx={compactChipSx} />)}
                  </Box>
                </Stack>
              </Box>

              {!editingId && canAssign && <ResponsibleStaffSelect value={form.responsibleStaffId} onChange={responsibleStaffId => setForm(previous => ({ ...previous, responsibleStaffId }))} disabled={saving} />}
              {!editingId && !canAssign && <Typography variant="body2" color="text.secondary">Bạn sẽ được ghi nhận là chuyên viên phụ trách các nhóm mới.</Typography>}
              {dialogScopeError && <Alert severity="error" sx={compactAlertSx}>{dialogScopeError}</Alert>}


              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" }, gap: 1.5 }}>
                <CompactField label="TRẠNG THÁI" htmlFor="create-status">
                  <FormControl fullWidth size="small" sx={compactControlSx}>
                    <Select id="create-status" value={form.status} inputProps={{ "aria-label": "Trạng thái" }} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                      <MenuItem value="open">Đang mở</MenuItem>
                      <MenuItem value="closed">Đã đóng</MenuItem>
                    </Select>
                  </FormControl>
                </CompactField>
                <CompactField label="GHI CHÚ" htmlFor="create-note">
                  <TextField id="create-note" placeholder="Nhập ghi chú nếu cần..." value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} inputProps={{ "aria-label": "Ghi chú" }} fullWidth size="small" sx={compactControlSx} />
                </CompactField>
              </Box>
            </Stack>
          )}
      </AppDialog>
  );
};
export default ClassGroupCreateDialog;
