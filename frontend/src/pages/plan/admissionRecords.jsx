import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Avatar, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel,
  IconButton, MenuItem, Paper, Radio, RadioGroup, Select,
  Pagination, Stack, TableBody, TableCell, TableContainer, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddPhotoAlternateRounded, AddRounded, CheckCircleRounded, CloseRounded,
  DeleteRounded, EditRounded, PersonRounded, PrintRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import ResizableTable from "../../components/ResizableTable";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import { getSelectableMajors, normalizeMajorsResponse, selectMajorForLevel } from "../../utils/majors";
import { personNameParts } from "../../utils/personName";
import {
  disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline,
} from "../../utils/disciplineScope";

const currentYear = new Date().getFullYear();
const PAGE_SIZE = 15;
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));

const TRAINING_LEVELS = [
  { value: "Thạc sĩ", label: "Thạc sĩ" },
  { value: "Tiến sĩ", label: "Tiến sĩ" },
];

const TRAINING_MODE_GROUPS = [
  "Chính quy",
  "Vừa làm vừa học",
  "Vừa học vừa làm",
  "Đào tạo từ xa",
];

const TRAINING_MODES = [
  "Đào tạo thông thường",
  "Định hướng nghiên cứu",
  "Định hướng ứng dụng",
];

const RECEIPT_TYPES = [
  "Trực tiếp",
  "Qua bưu điện",
  "Trực tuyến",
  "Đại diện nộp",
];

const PROFILE_CATEGORIES = [
  "Đầy đủ",
  "Bổ sung sau",
  "Chờ thẩm định",
  "Thiếu giấy tờ",
];

const STUDY_STATUSES = [
  "Nộp hồ sơ đầu vào",
  "Đủ điều kiện dự tuyển",
  "Đã trúng tuyển",
  "Không trúng tuyển",
  "Đang học",
  "Tạm hoãn",
  "Từ chối",
];

const DOCUMENT_ITEMS = [
  { key: "docDecision", label: "Quyết định cử đi học" },
  { key: "docApplication", label: "Đơn xin dự thi" },
  { key: "docCurriculumVitae", label: "Sơ yếu lý lịch" },
  { key: "docDegree", label: "Bằng tốt nghiệp" },
  { key: "docHealthCert", label: "Giấy khám sức khoẻ" },
  { key: "docPhoto", label: "Ảnh hồ sơ" },
  { key: "docSupplement", label: "Học bổ sung" },
  { key: "docTranscript", label: "Bảng điểm" },
];

const CITIES = [
  "Thành phố Hải Phòng",
  "Thành phố Hà Nội",
  "Thành phố Hồ Chí Minh",
  "Thành phố Đà Nẵng",
  "Tỉnh Quảng Ninh",
  "Tỉnh Hải Dương",
  "Tỉnh Thái Bình",
  "Tỉnh Nam Định",
  "Tỉnh Hưng Yên",
  "Tỉnh Bắc Ninh",
  "Tỉnh Ninh Bình",
  "Khác",
];

const DEGREE_TYPES = [
  "Chính quy",
  "Vừa làm vừa học",
  "Tại chức",
  "Liên thông",
  "Văn bằng 2",
  "Du học / Nước ngoài",
];

const GRAD_CLASSIFICATIONS = [
  "Xuất sắc",
  "Giỏi",
  "Khá",
  "Trung bình khá",
  "Trung bình",
];

const createEmptyForm = (defaultYear = String(currentYear)) => ({
  id: null,
  code: "",
  lastName: "",
  firstName: "",
  fullName: "",
  dob: "2000-01-01",
  idCard: "",
  gender: "Nam",
  phone: "",
  email: "",
  pob: "Hải Phòng",
  receiptType: "Trực tiếp",
  profileCategory: "Đầy đủ",
  admissionDate: new Date().toISOString().split("T")[0],
  photo: "",

  isExemptForeignLanguage: false,
  trainingModeGroup: "Chính quy",
  trainingLevel: "Thạc sĩ",
  trainingModeName: "Đào tạo thông thường",
  majorId: "",
  majorName: "",
  language: "Tiếng Việt",
  studyStatus: "Nộp hồ sơ đầu vào",
  academicYear: defaultYear,

  nationality: "Việt Nam",
  ethnicity: "Kinh",
  religion: "Không",
  city: "Thành phố Hải Phòng",
  ward: "",

  documents: {
    docDecision: false,
    docApplication: true,
    docCurriculumVitae: true,
    docDegree: true,
    docHealthCert: true,
    docPhoto: true,
    docSupplement: false,
    docTranscript: true,
  },

  priorityObject: "",
  workplace: "",
  job: "",
  supplementSubjectsCount: 0,
  gradSchool: "Trường Đại học Hàng hải Việt Nam",
  gradDegreeType: "Chính quy",
  gradYear: "2022",
  gpa: "3.20",
  gradMajor: "",
  gradClassification: "Khá",
  diplomaNumber: "",
  registryBookNumber: "",
  note: "",
});

const cellInputSx = {
  "& .MuiInputBase-root": {
    height: 32,
    fontSize: 12.5,
    bgcolor: "#ffffff",
    borderRadius: "2px",
  },
  "& .MuiOutlinedInput-input": {
    py: "4px",
    px: "8px",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    top: 0,
  },
  "& .MuiOutlinedInput-notchedOutline legend": {
    display: "none",
  },
};

const AdmissionRecords = ({ mode = "applications" }) => {
  const navigate = useNavigate();
  const isAdmittedMasters = mode === "admitted-masters";
  const recordDetailBase = isAdmittedMasters ? "/masters/admitted-records" : "/plan/admission-records";
  const columns = [
    { key: "index", label: "STT", width: 50, minWidth: 40, align: "center" },
    { key: "photo", label: "Ảnh", width: 60, minWidth: 50, align: "center" },
    { key: "code", label: "Mã HV", width: 140 },
    ...(isAdmittedMasters ? [
      { key: "groupName", label: "Nhóm học phần", width: 180 },
      { key: "groupCode", label: "Mã nhóm", width: 140 },
    ] : []),
    { key: "lastName", label: "Họ đệm", width: 160 },
    { key: "firstName", label: "Tên", width: 90 },
    { key: "email", label: "Email", width: 240 },
    { key: "dob", label: "Ngày sinh", width: 120, align: "center" },
    { key: "gender", label: "Giới tính", width: 90, align: "center" },
    { key: "idCard", label: "Số CMND/CCCD", width: 150 },
    { key: "major", label: "Trình độ & Ngành", width: 210 },
    { key: "phone", label: "Điện thoại", width: 130 },
    { key: "status", label: "Trạng thái", width: 160 },
    { key: "actions", label: "Thao tác", width: 130, minWidth: 120, align: "center" },
  ];

  // Global Filter State
  const [year, setYear] = useState(String(currentYear));
  const [levelFilter, setLevelFilter] = useState(isAdmittedMasters ? "Thạc sĩ" : "ALL");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [majorFilter, setMajorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState(isAdmittedMasters ? "Đã trúng tuyển" : "ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Data State
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, mastersCount: 0, doctoralCount: 0, eligibleCount: 0 });
  const [majors, setMajors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(createEmptyForm(String(currentYear)));
  const [formDisciplineId, setFormDisciplineId] = useState("");
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);

  const selectableMajors = useMemo(
    () => getSelectableMajors(majors, formData.trainingLevel),
    [majors, formData.trainingLevel],
  );
  const filterMajors = useMemo(
    () => levelFilter === "ALL"
      ? normalizeMajorsResponse(majors).filter((major) => major.active !== false)
      : getSelectableMajors(majors, levelFilter),
    [majors, levelFilter],
  );
  const filterDisciplines = useMemo(() => disciplinesFromMajors(filterMajors), [filterMajors]);
  const visibleFilterMajors = useMemo(
    () => majorsForDiscipline(filterMajors, disciplineFilter),
    [filterMajors, disciplineFilter],
  );
  const formDisciplines = useMemo(() => disciplinesFromMajors(selectableMajors), [selectableMajors]);
  const visibleSelectableMajors = useMemo(
    () => majorsForDiscipline(selectableMajors, formDisciplineId),
    [selectableMajors, formDisciplineId],
  );

  const fileInputRef = useRef(null);

  // Load Majors
  useEffect(() => {
    axios.get(`${API_BASE_URL}/system/majors`, { withCredentials: true })
      .then(({ data }) => {
        setMajors(normalizeMajorsResponse(data));
      })
      .catch((error) => {
        setMajors([]);
        toast.error(error.response?.data?.message || "Không thể tải danh mục chuyên ngành");
      });
  }, []);

  // Auth Check
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/auth/isStaff`, { withCredentials: true })
      .then(({ data }) => mounted && setIsAdmin(data.message === "admin"))
      .catch(() => mounted && setIsAdmin(false));
    return () => { mounted = false; };
  }, []);

  // Load Records
  const loadRecords = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.append("academicYear", year);
      if (levelFilter !== "ALL") params.append("trainingLevel", levelFilter);
      if (majorFilter !== "ALL") params.append("majorId", majorFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (!isAdmittedMasters) params.append("excludeStatus", "Đã trúng tuyển");
      if (isAdmittedMasters) params.append("includeGroup", "true");
      if (disciplineFilter) params.append("disciplineId", disciplineFilter);
      if (debouncedSearch) params.append("search", debouncedSearch);
      params.append("page", String(page));
      params.append("pageSize", String(PAGE_SIZE));

      const { data } = await axios.get(`${API_BASE_URL}/plan/admission-records?${params.toString()}`, {
        withCredentials: true,
        signal,
      });
      setRecords(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || { page, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setStats(data?.stats || { total: 0, mastersCount: 0, doctoralCount: 0, eligibleCount: 0 });
    } catch (err) {
      if (axios.isCancel(err) || err.code === "ERR_CANCELED") return;
      toast.error(err.response?.data?.message || "Không thể tải danh sách hồ sơ tuyển sinh");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [year, levelFilter, majorFilter, statusFilter, disciplineFilter, debouncedSearch, page, isAdmittedMasters]);

  useEffect(() => {
    const controller = new AbortController();
    loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [year, levelFilter, disciplineFilter, majorFilter, statusFilter, debouncedSearch]);

  // Handle Photo Upload (Base64)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Vui lòng chọn ảnh dung lượng dưới 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, photo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, photo: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    const nextForm = createEmptyForm(year);
    const defaultMajor = selectMajorForLevel(majors, nextForm.trainingLevel);
    if (defaultMajor) {
      nextForm.majorId = defaultMajor.id;
      nextForm.majorName = defaultMajor.name;
    }
    setFormDisciplineId(majorDisciplineId(defaultMajor));
    nextForm.code = `HV${year.slice(-2)}${String(stats.total + 1).padStart(3, "0")}`;
    setFormData(nextForm);
    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (rec) => {
    const docs = rec.documents || {};
    const trainingLevel = rec.trainingLevel || "Thạc sĩ";
    const selectedMajor = selectMajorForLevel(majors, trainingLevel, rec.majorId);
    setFormDisciplineId(majorDisciplineId(selectedMajor));
    setFormData({
      id: rec.id,
      code: rec.code || "",
      lastName: rec.lastName || "",
      firstName: rec.firstName || "",
      fullName: rec.fullName || "",
      dob: rec.dob || "2000-01-01",
      idCard: rec.idCard || "",
      gender: rec.gender || "Nam",
      phone: rec.phone || "",
      email: rec.email || "",
      pob: rec.pob || "Hải Phòng",
      receiptType: rec.receiptType || "Trực tiếp",
      profileCategory: rec.profileCategory || "Đầy đủ",
      admissionDate: rec.admissionDate || new Date().toISOString().split("T")[0],
      photo: rec.photo || "",

      isExemptForeignLanguage: Boolean(rec.isExemptForeignLanguage),
      trainingModeGroup: rec.trainingModeGroup || "Chính quy",
      trainingLevel,
      trainingModeName: rec.trainingModeName || "Đào tạo thông thường",
      majorId: selectedMajor?.id || "",
      majorName: selectedMajor?.name || "",
      language: rec.language || "Tiếng Việt",
      studyStatus: rec.studyStatus || "Nộp hồ sơ đầu vào",
      academicYear: rec.academicYear || year,

      nationality: rec.nationality || "Việt Nam",
      ethnicity: rec.ethnicity || "Kinh",
      religion: rec.religion || "Không",
      city: rec.city || "Thành phố Hải Phòng",
      ward: rec.ward || "",

      documents: {
        docDecision: Boolean(docs.docDecision),
        docApplication: docs.docApplication !== false,
        docCurriculumVitae: docs.docCurriculumVitae !== false,
        docDegree: docs.docDegree !== false,
        docHealthCert: docs.docHealthCert !== false,
        docPhoto: docs.docPhoto !== false,
        docSupplement: Boolean(docs.docSupplement),
        docTranscript: docs.docTranscript !== false,
      },

      priorityObject: rec.priorityObject || "",
      workplace: rec.workplace || "",
      job: rec.job || "",
      supplementSubjectsCount: rec.supplementSubjectsCount ?? 0,
      gradSchool: rec.gradSchool || "Trường Đại học Hàng hải Việt Nam",
      gradDegreeType: rec.gradDegreeType || "Chính quy",
      gradYear: rec.gradYear || "2022",
      gpa: rec.gpa || "3.20",
      gradMajor: rec.gradMajor || "",
      gradClassification: rec.gradClassification || "Khá",
      diplomaNumber: rec.diplomaNumber || "",
      registryBookNumber: rec.registryBookNumber || "",
      note: rec.note || "",
    });
    setIsFormOpen(true);
  };

  // Save Form
  const handleSaveForm = async () => {
    if (!formData.lastName?.trim() && !formData.firstName?.trim() && !formData.fullName?.trim()) {
      toast.error("Vui lòng nhập Họ tên học viên");
      return;
    }

    const calculatedFullName = formData.lastName && formData.firstName
      ? `${formData.lastName.trim()} ${formData.firstName.trim()}`
      : (formData.fullName?.trim() || "Chưa có tên");

    const selectedMajor = selectableMajors.find((m) => m.id === formData.majorId);
    if (!selectedMajor) {
      toast.error("Vui lòng chọn chuyên ngành phù hợp với trình độ đào tạo");
      return;
    }
    const majorName = selectedMajor?.name || formData.majorName || "";

    const payload = {
      ...formData,
      fullName: calculatedFullName,
      majorName,
      supplementSubjectsCount: Number(formData.supplementSubjectsCount || 0),
    };

    setSaving(true);
    try {
      if (formData.id) {
        await axios.put(`${API_BASE_URL}/plan/admission-records/${formData.id}`, payload, { withCredentials: true });
        toast.success("Cập nhật hồ sơ thành công");
      } else {
        await axios.post(`${API_BASE_URL}/plan/admission-records`, payload, { withCredentials: true });
        toast.success("Thêm mới hồ sơ học viên thành công");
      }
      setIsFormOpen(false);
      await loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu hồ sơ học viên");
    } finally {
      setSaving(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    try {
      await axios.delete(`${API_BASE_URL}/plan/admission-records/${deletingRecord.id}`, { withCredentials: true });
      toast.success(`Đã xóa hồ sơ "${deletingRecord.fullName}"`);
      setDeletingRecord(null);
      if (records.length === 1 && page > 1) setPage((current) => current - 1);
      else await loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa hồ sơ");
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <FeatureLayout
      title={isAdmittedMasters ? "Danh sách học viên" : "Nhập hồ sơ tuyển sinh"}
      group={isAdmittedMasters ? "Thủ tục đầu vào" : "Kế hoạch khóa mới"}
      desc={isAdmittedMasters
        ? "Quản lý hồ sơ học viên Thạc sĩ đã trúng tuyển và thực hiện các thủ tục đầu vào."
        : "Quản lý hồ sơ thí sinh đang dự tuyển, nhập liệu theo form A4 và xuất phiếu hồ sơ chi tiết."}
      maxWidth={1880}
    >
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />

      {/* 1. TOP FILTER BAR */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 1.5,
          bgcolor: "#FFF",
          borderColor: "#C6D5E1",
          borderRadius: "10px",
          boxShadow: "0 2px 6px rgba(18, 59, 98, 0.07)",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end" justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-end" sx={{ width: { xs: "100%", md: "auto" }, flexGrow: 1 }} flexWrap="wrap">
            <FilterSelectField label="Năm" value={year} onChange={(e) => setYear(e.target.value)} sx={{ flex: "1 1 108px", minWidth: 108 }}>
                {YEARS.map((y) => (
                  <MenuItem key={y} value={y} sx={{ fontSize: 12 }}>
                    {y}
                  </MenuItem>
                ))}
            </FilterSelectField>

            {!isAdmittedMasters && <FilterSelectField label="Trình độ" sx={{ flex: "1 1 150px", minWidth: 150 }}
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setDisciplineFilter("");
                  setMajorFilter("ALL");
                }}
              >
                <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả trình độ</MenuItem>
                {TRAINING_LEVELS.map((l) => (
                  <MenuItem key={l.value} value={l.value} sx={{ fontSize: 12 }}>{l.label}</MenuItem>
                ))}
            </FilterSelectField>}

            <FilterSelectField label="Ngành" sx={{ flex: "1 1 190px", minWidth: 190 }}
                value={disciplineFilter}
                onChange={(e) => {
                  setDisciplineFilter(e.target.value);
                  setMajorFilter("ALL");
                }}
              >
                <MenuItem value="" sx={{ fontSize: 12 }}>Tất cả ngành</MenuItem>
                {filterDisciplines.map((discipline) => (
                  <MenuItem key={discipline.id} value={discipline.id} sx={{ fontSize: 12 }}>
                    {disciplineOptionLabel(discipline)}
                  </MenuItem>
                ))}
            </FilterSelectField>

            <FilterSelectField label="Chuyên ngành" value={majorFilter} onChange={(e) => setMajorFilter(e.target.value)} sx={{ flex: "1 1 220px", minWidth: 220 }}>
                <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả chuyên ngành ({visibleFilterMajors.length})</MenuItem>
                {visibleFilterMajors.map((m) => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontSize: 12 }}>{m.name}</MenuItem>
                ))}
            </FilterSelectField>

            {!isAdmittedMasters && <FilterSelectField label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ flex: "1 1 150px", minWidth: 150 }}>
                <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả trạng thái</MenuItem>
                {STUDY_STATUSES.filter((s) => s !== "Đã trúng tuyển").map((s) => (
                  <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{s}</MenuItem>
                ))}
            </FilterSelectField>}

            {!isAdmittedMasters && (
              <FilterSearchField
                placeholder="Tìm theo họ tên, mã HV, CCCD, điện thoại, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{
                  width: { xs: "100%", sm: 360 },
                  flexGrow: 1,
                }}
              />
            )}

            {isAdmittedMasters && (
              <FilterSearchField
                placeholder="Tìm theo họ tên, mã HV, CCCD, điện thoại, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{
                  width: { xs: "100%", sm: 430 },
                  flexGrow: 1,
                }}
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="flex-end">
            {isAdmin && !isAdmittedMasters && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddRounded />}
                onClick={handleOpenAdd}
                sx={{
                  height: 40,
                  bgcolor: "#0788B8",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "none",
                  borderRadius: "8px",
                  boxShadow: "none",
                  "&:hover": { bgcolor: "#056A8F" },
                }}
              >
                Thêm hồ sơ mới
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* 3. MAIN TABLE GRID */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={32} sx={{ color: "#0788B8" }} />
        </Box>
      ) : (
        <Stack spacing={1.25}>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderColor: "#D7E4EE",
            borderRadius: "12px",
            overflowX: "auto",
            boxShadow: "0 5px 18px rgba(23, 62, 117, 0.06)",
          }}
        >
          <ResizableTable key={mode} columns={columns} storageKey={`admission-records-columns:${mode}`}>

            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: "#607486", fontSize: 13 }}>
                    Chưa có hồ sơ tuyển sinh nào theo điều kiện lọc.
                    {isAdmin && !isAdmittedMasters && (
                      <Box sx={{ mt: 1.5 }}>
                        <Button size="small" variant="outlined" startIcon={<AddRounded />} onClick={handleOpenAdd}>
                          Nhập hồ sơ mới ngay
                        </Button>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r, index) => (
                  <TableRow
                    key={r.id}
                    hover
                    sx={{
                      "&:hover": { bgcolor: "#F5FAFE" },
                      "& td": {
                        py: "7px",
                        fontSize: 12.5,
                        borderColor: "#E2EBF2",
                      },
                    }}
                  >
                    <TableCell align="center" sx={{ color: "#607486", fontSize: 11 }}>
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </TableCell>

                    <TableCell align="center">
                      <Avatar
                        src={r.photo || ""}
                        sx={{
                          width: 28,
                          height: 36,
                          borderRadius: "8px",
                          fontSize: 10,
                          bgcolor: "#EEF3F8",
                          color: "#607486",
                          margin: "0 auto",
                          border: "1px solid #E1EAF1",
                        }}
                        variant="rounded"
                      >
                        {r.firstName ? r.firstName.slice(0, 1) : <PersonRounded sx={{ fontSize: 16 }} />}
                      </Avatar>
                    </TableCell>

                    <TableCell sx={{ fontFamily: "inherit", fontWeight: 700, color: "#173E75" }}>
                      {r.code || "—"}
                    </TableCell>

                    {isAdmittedMasters && (
                      <TableCell sx={{ color: r.assignedGroup ? "#173E75" : "#8A9AAA", fontWeight: 600 }}>
                        {r.assignedGroup?.name || "Chưa phân nhóm"}
                      </TableCell>
                    )}

                    {isAdmittedMasters && (
                      <TableCell sx={{ color: r.assignedGroup ? "#172B3A" : "#8A9AAA", fontWeight: 700 }}>
                        {r.assignedGroup?.code || "—"}
                      </TableCell>
                    )}

                    <TableCell>
                      <Typography
                        variant="body2"
                        component={Link}
                        to={`${recordDetailBase}/${r.id}`}
                        sx={{
                          fontWeight: 700,
                          color: "#173E75",
                          fontSize: 12.5,
                          cursor: "pointer",
                          textDecoration: "none",
                          "&:hover": { color: "#0788B8", textDecoration: "underline" },
                        }}
                      >
                        {personNameParts(r).familyAndMiddle}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        component={Link}
                        to={`${recordDetailBase}/${r.id}`}
                        sx={{ fontWeight: 700, color: "#173E75", fontSize: 12.5, textDecoration: "none", "&:hover": { color: "#0788B8", textDecoration: "underline" } }}
                      >
                        {personNameParts(r).givenName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: "#607486" }}>{r.email || "—"}</TableCell>

                    <TableCell align="center" sx={{ color: "#172B3A" }}>
                      {r.dob || "—"}
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={r.gender || "Nam"}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 600,
                          bgcolor: r.gender === "Nữ" ? "#FCE8E6" : "#EBF5FB",
                          color: r.gender === "Nữ" ? "#B52D2D" : "#0788B8",
                          borderRadius: "999px",
                        }}
                      />
                    </TableCell>

                    <TableCell sx={{ fontFamily: "inherit", color: "#172B3A" }}>
                      {r.idCard || "—"}
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      <Chip
                        size="small"
                        label={r.trainingLevel || "Thạc sĩ"}
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: r.trainingLevel === "Tiến sĩ" ? "#FEF7E0" : "#E6F4EA",
                          color: r.trainingLevel === "Tiến sĩ" ? "#B86216" : "#137B3B",
                          borderRadius: "999px",
                          mr: 0.5,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="caption" title={r.majorName || r.major?.name || ""} sx={{ fontWeight: 600, color: "#173E75", minWidth: 0 }}>
                        {r.majorName || r.major?.name || "—"}
                      </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell sx={{ color: "#172B3A", fontSize: 12 }}>
                      {r.phone || "—"}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={r.studyStatus || "Nộp hồ sơ"}
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 600,
                          borderRadius: "999px",
                          bgcolor:
                            r.studyStatus === "Đã trúng tuyển" || r.studyStatus === "Đang học"
                              ? "#E6F4EA"
                              : r.studyStatus === "Đủ điều kiện dự tuyển"
                              ? "#EBF5FB"
                              : "#F1F3F4",
                          color:
                            r.studyStatus === "Đã trúng tuyển" || r.studyStatus === "Đang học"
                              ? "#137B3B"
                              : r.studyStatus === "Đủ điều kiện dự tuyển"
                              ? "#0788B8"
                              : "#607486",
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {isAdmin && (
                          <Tooltip title="Sửa hồ sơ">
                            <IconButton size="small" color="inherit" onClick={() => handleOpenEdit(r)}>
                              <EditRounded sx={{ fontSize: 17, color: "#607486" }} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {isAdmin && (
                          <Tooltip title="Xóa hồ sơ">
                            <IconButton size="small" color="error" onClick={() => setDeletingRecord(r)}>
                              <DeleteRounded sx={{ fontSize: 17, color: "#B52D2D" }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </ResizableTable>
        </TableContainer>
        {pagination.totalPages > 1 && (
          <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, px: 0.5, pb: 0.5 }}>
            <Typography variant="caption" sx={{ position: "absolute", left: 4, color: "#607486", fontWeight: 600 }}>
              Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} trên {pagination.total} hồ sơ
            </Typography>
            <Pagination
              page={page}
              count={pagination.totalPages}
              onChange={(_event, nextPage) => setPage(nextPage)}
              color="primary"
              size="medium"
              showFirstButton
              showLastButton
              sx={{
                "& .MuiPaginationItem-root": {
                  minWidth: 38,
                  height: 38,
                  fontSize: 14,
                  fontWeight: 600,
                },
              }}
            />
          </Box>
        )}
        </Stack>
      )}

      {/* ========================================================================= */}
      {/* 4. A4 ENTRY / EDIT FORM MODAL (FORMATTED EXACTLY AS REFERENCE SCREENSHOT) */}
      {/* ========================================================================= */}
      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "4px",
            border: "1px solid #DFE4E8",
            width: "calc(100vw - 32px)",
            maxWidth: "1800px",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#F0F4F8",
            borderBottom: "1px solid #DFE4E8",
            py: 1.2,
            px: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonRounded sx={{ color: "#173E75", fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173E75", fontSize: 14 }}>
              {formData.id ? "SỬA HỒ SƠ HỌC VIÊN" : "HỒ SƠ HỌC VIÊN - QUẢN LÝ HỌC VIÊN [MPS - VMU]"}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={() => setIsFormOpen(false)}>
            <CloseRounded fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, bgcolor: "#F5F7F8" }}>
          {/* Main 3-Column A4 Layout Grid */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}>
            {/* COLUMN 1: THÔNG TIN CÁ NHÂN + ẢNH 3x4 */}
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "3px", borderColor: "#DFE4E8" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block", mb: 1, textTransform: "uppercase" }}>
                Thông tin cá nhân
              </Typography>

              {/* Photo Upload Box 3x4 */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, p: 1, bgcolor: "#F7F9FA", border: "1px dashed #DFE4E8", borderRadius: "2px" }}>
                <Box
                  sx={{
                    width: 60,
                    height: 80,
                    border: "1px solid #CBD5E1",
                    borderRadius: "2px",
                    bgcolor: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {formData.photo ? (
                    <img src={formData.photo} alt="Avatar 3x4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: 10, textAlign: "center" }}>
                      Ảnh 3x4
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: "none" }} />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddPhotoAlternateRounded sx={{ fontSize: 14 }} />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ height: 26, fontSize: 11, fontWeight: 600, textTransform: "none", mb: 0.5, width: "100%" }}
                  >
                    Tải ảnh 3x4
                  </Button>
                  {formData.photo && (
                    <Button
                      size="small"
                      color="error"
                      onClick={handleRemovePhoto}
                      sx={{ height: 22, fontSize: 10, p: 0, textTransform: "none", width: "100%" }}
                    >
                      Xóa ảnh
                    </Button>
                  )}
                </Box>
              </Box>

              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Mã học viên / SBD</Typography>
                  <TextField
                    size="small"
                    value={formData.code}
                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    fullWidth
                    sx={cellInputSx}
                    placeholder="VD: HV26001"
                  />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 2 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Họ đệm *</Typography>
                    <TextField
                      size="small"
                      value={formData.lastName}
                      onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                      fullWidth
                      sx={cellInputSx}
                      placeholder="Nguyễn Văn"
                      autoFocus
                    />
                  </Box>
                  <Box sx={{ flex: 1.2 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Tên *</Typography>
                    <TextField
                      size="small"
                      value={formData.firstName}
                      onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                      fullWidth
                      sx={cellInputSx}
                      placeholder="An"
                    />
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Ngày sinh</Typography>
                    <TextField
                      size="small"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData((p) => ({ ...p, dob: e.target.value }))}
                      fullWidth
                      sx={cellInputSx}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Số CMND/CCCD</Typography>
                    <TextField
                      size="small"
                      value={formData.idCard}
                      onChange={(e) => setFormData((p) => ({ ...p, idCard: e.target.value }))}
                      fullWidth
                      sx={cellInputSx}
                      placeholder="031090001234"
                    />
                  </Box>
                </Stack>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.2 }}>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Giới tính:</Typography>
                  <RadioGroup
                    row
                    value={formData.gender}
                    onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <FormControlLabel value="Nam" control={<Radio size="small" sx={{ p: 0.3 }} />} label={<Typography sx={{ fontSize: 12 }}>Nam</Typography>} />
                    <FormControlLabel value="Nữ" control={<Radio size="small" sx={{ p: 0.3 }} />} label={<Typography sx={{ fontSize: 12 }}>Nữ</Typography>} />
                  </RadioGroup>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Điện thoại</Typography>
                  <TextField
                    size="small"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    fullWidth
                    sx={cellInputSx}
                    placeholder="0912345678"
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Email</Typography>
                  <TextField
                    size="small"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    fullWidth
                    sx={cellInputSx}
                    placeholder="hocvien@gmail.com"
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Nơi sinh</Typography>
                  <TextField
                    size="small"
                    value={formData.pob}
                    onChange={(e) => setFormData((p) => ({ ...p, pob: e.target.value }))}
                    fullWidth
                    sx={cellInputSx}
                    placeholder="Tỉnh / Thành phố"
                  />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Hình thức nhận hồ sơ</Typography>
                    <Select
                      size="small"
                      value={formData.receiptType}
                      onChange={(e) => setFormData((p) => ({ ...p, receiptType: e.target.value }))}
                      fullWidth
                      sx={{ height: 32, fontSize: 12, bgcolor: "#fff" }}
                    >
                      {RECEIPT_TYPES.map((t) => (
                        <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>{t}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Phân loại hồ sơ</Typography>
                    <Select
                      size="small"
                      value={formData.profileCategory}
                      onChange={(e) => setFormData((p) => ({ ...p, profileCategory: e.target.value }))}
                      fullWidth
                      sx={{ height: 32, fontSize: 12, bgcolor: "#fff" }}
                    >
                      {PROFILE_CATEGORIES.map((c) => (
                        <MenuItem key={c} value={c} sx={{ fontSize: 12 }}>{c}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                </Stack>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Ngày nhập học</Typography>
                  <TextField
                    size="small"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => setFormData((p) => ({ ...p, admissionDate: e.target.value }))}
                    fullWidth
                    sx={cellInputSx}
                  />
                </Box>
              </Stack>
            </Paper>

            {/* COLUMN 2: THỂ THỨC ĐÀO TẠO & CHỖ Ở & GIẤY TỜ BỔ SUNG */}
            <Stack spacing={1.5}>
              {/* THỂ THỨC ĐÀO TẠO */}
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "3px", borderColor: "#DFE4E8" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", textTransform: "uppercase" }}>
                    Thể thức đào tạo
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={formData.isExemptForeignLanguage}
                        onChange={(e) => setFormData((p) => ({ ...p, isExemptForeignLanguage: e.target.checked }))}
                        sx={{ p: 0.3 }}
                      />
                    }
                    label={<Typography sx={{ fontSize: 11, fontWeight: 600, color: "#0788B8" }}>Miễn thi ngoại ngữ</Typography>}
                    sx={{ m: 0 }}
                  />
                </Box>

                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Nhóm HT đào tạo</Typography>
                      <Select
                        size="small"
                        value={formData.trainingModeGroup}
                        onChange={(e) => setFormData((p) => ({ ...p, trainingModeGroup: e.target.value }))}
                        fullWidth
                        sx={{ height: 30, fontSize: 12, bgcolor: "#fff" }}
                      >
                        {TRAINING_MODE_GROUPS.map((g) => (
                          <MenuItem key={g} value={g} sx={{ fontSize: 12 }}>{g}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Trình độ đào tạo</Typography>
                      <Select
                        size="small"
                        value={formData.trainingLevel}
                        onChange={(e) => {
                          const trainingLevel = e.target.value;
                          const selected = selectMajorForLevel(majors, trainingLevel, formData.majorId);
                          setFormDisciplineId(majorDisciplineId(selected));
                          setFormData((previous) => {
                            return {
                              ...previous,
                              trainingLevel,
                              majorId: selected?.id || "",
                              majorName: selected?.name || "",
                            };
                          });
                        }}
                        fullWidth
                        sx={{ height: 30, fontSize: 12, bgcolor: "#fff", fontWeight: 700, color: "#173E75" }}
                      >
                        {TRAINING_LEVELS.map((l) => (
                          <MenuItem key={l.value} value={l.value} sx={{ fontSize: 12 }}>{l.label}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Stack>

                  <Box>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Hình thức đào tạo</Typography>
                    <Select
                      size="small"
                      value={formData.trainingModeName}
                      onChange={(e) => setFormData((p) => ({ ...p, trainingModeName: e.target.value }))}
                      fullWidth
                      sx={{ height: 30, fontSize: 12, bgcolor: "#fff" }}
                    >
                      {TRAINING_MODES.map((m) => (
                        <MenuItem key={m} value={m} sx={{ fontSize: 12 }}>{m}</MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Ngành</Typography>
                    <Select
                      size="small"
                      value={formDisciplineId}
                      onChange={(e) => {
                        const nextDisciplineId = e.target.value;
                        setFormDisciplineId(nextDisciplineId);
                        if (nextDisciplineId && majorDisciplineId(
                          selectableMajors.find((major) => major.id === formData.majorId),
                        ) !== nextDisciplineId) {
                          setFormData((previous) => ({ ...previous, majorId: "", majorName: "" }));
                        }
                      }}
                      displayEmpty
                      fullWidth
                      sx={{ height: 30, fontSize: 12, bgcolor: "#fff" }}
                    >
                      <MenuItem value="">Tất cả ngành</MenuItem>
                      {formDisciplines.map((discipline) => (
                        <MenuItem key={discipline.id} value={discipline.id} sx={{ fontSize: 12 }}>
                          {disciplineOptionLabel(discipline)}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Chuyên ngành *</Typography>
                    <Select
                      size="small"
                      value={formData.majorId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        const target = majors.find((m) => m.id === mId);
                        setFormData((p) => ({ ...p, majorId: mId, majorName: target?.name || "" }));
                      }}
                      fullWidth
                      sx={{ height: 30, fontSize: 12, bgcolor: "#fff", fontWeight: 600, color: "#173E75" }}
                    >
                      <MenuItem value="" disabled>-- Chọn chuyên ngành --</MenuItem>
                      {visibleSelectableMajors.map((m) => (
                        <MenuItem key={m.id} value={m.id} sx={{ fontSize: 12 }}>
                          {m.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Ngôn ngữ đào tạo</Typography>
                      <Select
                        size="small"
                        value={formData.language}
                        onChange={(e) => setFormData((p) => ({ ...p, language: e.target.value }))}
                        fullWidth
                        sx={{ height: 30, fontSize: 12, bgcolor: "#fff" }}
                      >
                        <MenuItem value="Tiếng Việt" sx={{ fontSize: 12 }}>Tiếng Việt</MenuItem>
                        <MenuItem value="Tiếng Anh" sx={{ fontSize: 12 }}>Tiếng Anh</MenuItem>
                      </Select>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Trạng thái học</Typography>
                      <Select
                        size="small"
                        value={formData.studyStatus}
                        onChange={(e) => setFormData((p) => ({ ...p, studyStatus: e.target.value }))}
                        fullWidth
                        sx={{ height: 30, fontSize: 12, bgcolor: "#fff" }}
                      >
                        {STUDY_STATUSES.map((s) => (
                          <MenuItem key={s} value={s} disabled={formData.trainingLevel === "Thạc sĩ" && ["Đã trúng tuyển", "Không trúng tuyển"].includes(s) && s !== records.find((record) => record.id === formData.id)?.studyStatus} sx={{ fontSize: 12 }}>{s}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                  </Stack>
                </Stack>
              </Paper>

              {/* THÔNG TIN CHỖ Ở & GIẤY TỜ BỔ SUNG */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 1 }}>
                {/* THÔNG TIN CHỖ Ở */}
                <Paper variant="outlined" sx={{ p: 1.2, bgcolor: "#FFFFFF", borderRadius: "3px", borderColor: "#DFE4E8" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block", mb: 0.8, textTransform: "uppercase" }}>
                    Thông tin chỗ ở
                  </Typography>
                  <Stack spacing={0.8}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 10.5 }}>Quốc tịch</Typography>
                      <TextField size="small" value={formData.nationality} onChange={(e) => setFormData((p) => ({ ...p, nationality: e.target.value }))} fullWidth sx={cellInputSx} />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 10.5 }}>Dân tộc</Typography>
                      <TextField size="small" value={formData.ethnicity} onChange={(e) => setFormData((p) => ({ ...p, ethnicity: e.target.value }))} fullWidth sx={cellInputSx} />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 10.5 }}>Tôn giáo</Typography>
                      <TextField size="small" value={formData.religion} onChange={(e) => setFormData((p) => ({ ...p, religion: e.target.value }))} fullWidth sx={cellInputSx} />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 10.5 }}>Thành phố</Typography>
                      <Select size="small" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} fullWidth sx={{ height: 28, fontSize: 11, bgcolor: "#fff" }}>
                        {CITIES.map((c) => (<MenuItem key={c} value={c} sx={{ fontSize: 11 }}>{c}</MenuItem>))}
                      </Select>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#607486", fontSize: 10.5 }}>Phường xã / Đ/c</Typography>
                      <TextField size="small" value={formData.ward} onChange={(e) => setFormData((p) => ({ ...p, ward: e.target.value }))} fullWidth sx={cellInputSx} placeholder="Số nhà, đường, phường..." />
                    </Box>
                  </Stack>
                </Paper>

                {/* GIẤY TỜ BỔ SUNG */}
                <Paper variant="outlined" sx={{ p: 1.2, bgcolor: "#FFFFFF", borderRadius: "3px", borderColor: "#DFE4E8" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block", mb: 0.8, textTransform: "uppercase" }}>
                    Giấy tờ nộp
                  </Typography>
                  <Stack spacing={0.2}>
                    {DOCUMENT_ITEMS.map((doc) => (
                      <FormControlLabel
                        key={doc.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={Boolean(formData.documents?.[doc.key])}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData((p) => ({
                                ...p,
                                documents: { ...(p.documents || {}), [doc.key]: checked },
                              }));
                            }}
                            sx={{ p: 0.3 }}
                          />
                        }
                        label={<Typography sx={{ fontSize: 11, color: "#172B3A" }}>{doc.label}</Typography>}
                        sx={{ m: 0 }}
                      />
                    ))}
                  </Stack>
                </Paper>
              </Box>
            </Stack>

            {/* COLUMN 3: VĂN BẰNG ĐẠI HỌC (NĂNG LỰC ĐẦU VÀO) */}
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#FFFFFF", borderRadius: "3px", borderColor: "#DFE4E8" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block", mb: 1, textTransform: "uppercase" }}>
                Văn bằng đại học (Đầu vào)
              </Typography>

              <Stack spacing={0.9}>
                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>ĐT Ưu tiên</Typography>
                  <TextField size="small" value={formData.priorityObject} onChange={(e) => setFormData((p) => ({ ...p, priorityObject: e.target.value }))} fullWidth sx={cellInputSx} placeholder="VD: Con liệt sĩ, dân tộc thiểu số..." />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Nơi làm việc</Typography>
                  <TextField size="small" value={formData.workplace} onChange={(e) => setFormData((p) => ({ ...p, workplace: e.target.value }))} fullWidth sx={cellInputSx} placeholder="Cơ quan, đơn vị công tác..." />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1.5 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Nghề nghiệp</Typography>
                    <TextField size="small" value={formData.job} onChange={(e) => setFormData((p) => ({ ...p, job: e.target.value }))} fullWidth sx={cellInputSx} placeholder="Kỹ sư, giảng viên..." />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Số môn BSKT</Typography>
                    <TextField size="small" type="number" value={formData.supplementSubjectsCount} onChange={(e) => setFormData((p) => ({ ...p, supplementSubjectsCount: e.target.value }))} fullWidth sx={cellInputSx} inputProps={{ min: 0 }} />
                  </Box>
                </Stack>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Trường TN</Typography>
                  <TextField size="small" value={formData.gradSchool} onChange={(e) => setFormData((p) => ({ ...p, gradSchool: e.target.value }))} fullWidth sx={cellInputSx} />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1.3 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Hệ ĐT</Typography>
                    <Select size="small" value={formData.gradDegreeType} onChange={(e) => setFormData((p) => ({ ...p, gradDegreeType: e.target.value }))} fullWidth sx={{ height: 30, fontSize: 11.5, bgcolor: "#fff" }}>
                      {DEGREE_TYPES.map((d) => (<MenuItem key={d} value={d} sx={{ fontSize: 11.5 }}>{d}</MenuItem>))}
                    </Select>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Năm TN</Typography>
                    <TextField size="small" value={formData.gradYear} onChange={(e) => setFormData((p) => ({ ...p, gradYear: e.target.value }))} fullWidth sx={cellInputSx} />
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Điểm TB ĐH</Typography>
                    <TextField size="small" value={formData.gpa} onChange={(e) => setFormData((p) => ({ ...p, gpa: e.target.value }))} fullWidth sx={cellInputSx} placeholder="VD: 3.20" />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Loại TN</Typography>
                    <Select size="small" value={formData.gradClassification} onChange={(e) => setFormData((p) => ({ ...p, gradClassification: e.target.value }))} fullWidth sx={{ height: 30, fontSize: 11.5, bgcolor: "#fff" }}>
                      {GRAD_CLASSIFICATIONS.map((c) => (<MenuItem key={c} value={c} sx={{ fontSize: 11.5 }}>{c}</MenuItem>))}
                    </Select>
                  </Box>
                </Stack>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Chuyên Ngành ĐH</Typography>
                  <TextField size="small" value={formData.gradMajor} onChange={(e) => setFormData((p) => ({ ...p, gradMajor: e.target.value }))} fullWidth sx={cellInputSx} placeholder="VD: Công nghệ thông tin..." />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Số Văn bằng</Typography>
                    <TextField size="small" value={formData.diplomaNumber} onChange={(e) => setFormData((p) => ({ ...p, diplomaNumber: e.target.value }))} fullWidth sx={cellInputSx} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Số vào sổ gốc</Typography>
                    <TextField size="small" value={formData.registryBookNumber} onChange={(e) => setFormData((p) => ({ ...p, registryBookNumber: e.target.value }))} fullWidth sx={cellInputSx} />
                  </Box>
                </Stack>

                <Box>
                  <Typography variant="caption" sx={{ color: "#607486", fontSize: 11 }}>Ghi chú</Typography>
                  <TextField size="small" value={formData.note} onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))} fullWidth sx={cellInputSx} />
                </Box>
              </Stack>
            </Paper>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, bgcolor: "#F0F4F8", borderTop: "1px solid #DFE4E8", justifyContent: "center", gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<CheckCircleRounded />}
            onClick={handleSaveForm}
            disabled={saving}
            sx={{
              height: 36,
              px: 3,
              bgcolor: "#137B3B",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "3px",
              boxShadow: "none",
              "&:hover": { bgcolor: "#0E5E2D" },
            }}
          >
            {saving ? "Đang lưu..." : "Chấp nhận (Enter)"}
          </Button>

          {formData.id && (
            <Button
              variant="outlined"
              startIcon={<VisibilityRounded />}
              onClick={() => {
                setIsFormOpen(false);
                navigate(`${recordDetailBase}/${formData.id}`);
              }}
              sx={{
                height: 36,
                px: 2,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "none",
                borderRadius: "3px",
                borderColor: "#0788B8",
                color: "#0788B8",
                bgcolor: "#FFFFFF",
                "&:hover": { bgcolor: "#EBF5FB" },
              }}
            >
              Xem chi tiết
            </Button>
          )}

          <Button
            variant="outlined"
            color="error"
            startIcon={<CloseRounded />}
            onClick={() => setIsFormOpen(false)}
            sx={{
              height: 36,
              px: 2.5,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "3px",
              bgcolor: "#FFFFFF",
            }}
          >
            Huỷ bỏ (Esc)
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. A4 PRINTABLE STUDENT PROFILE SHEET (PRINT PREVIEW MODAL)               */}
      {/* ========================================================================= */}
      <Dialog
        open={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "4px",
            border: "1px solid #DFE4E8",
            maxWidth: 860,
          },
        }}
      >
        <DialogTitle sx={{ py: 1, px: 2, bgcolor: "#F0F4F8", borderBottom: "1px solid #DFE4E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173E75" }}>
            XEM TRƯỚC PHIẾU HỒ SƠ HỌC VIÊN (KHỔ A4)
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<PrintRounded />}
              onClick={handleTriggerPrint}
              sx={{ bgcolor: "#0788B8", fontSize: 12, fontWeight: 700, height: 28 }}
            >
              In hồ sơ (Print / PDF)
            </Button>
            <IconButton size="small" onClick={() => setIsPrintOpen(false)}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: { xs: 2, md: 3 }, bgcolor: "#94A3B8" }}>
          {printRecord && (
            <Box
              id="printable-a4-sheet"
              sx={{
                fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
                color: "#000000",
                lineHeight: 1.35,
                fontSize: "12.5px",
                width: "210mm",
                height: "297mm",
                maxHeight: "297mm",
                margin: "0 auto",
                bgcolor: "#FFFFFF",
                p: "10mm 13mm",
                border: "1.5px solid #173E75",
                borderRadius: "1px",
                boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                pageBreakInside: "avoid",
                breakInside: "avoid",
                "@media (max-width: 850px)": {
                  width: "100%",
                  height: "auto",
                  maxHeight: "none",
                  p: 2,
                },
              }}
            >
              {/* National & University Header */}
              <Box sx={{ pb: 0.5 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", textAlign: "center" }}>
                  <Box>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px", lineHeight: 1.25 }}>
                      BỘ XÂY DỰNG
                    </Typography>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1.2px solid #000", display: "inline-block", pb: 0.1, lineHeight: 1.25 }}>
                      TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM
                    </Typography>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontWeight: 700, mt: 0.3, color: "#1E293B", lineHeight: 1.2 }}>
                      VIỆN ĐÀO TẠO SAU ĐẠI HỌC
                    </Typography>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", color: "#475569", lineHeight: 1.2 }}>
                      Số HS: <strong>{printRecord.code || "VMU-SDH-000"}</strong>
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2px", lineHeight: 1.25 }}>
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </Typography>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontWeight: 700, borderBottom: "1.2px solid #000", display: "inline-block", pb: 0.1, lineHeight: 1.25 }}>
                      Độc lập - Tự do - Hạnh phúc
                    </Typography>
                    <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", mt: 0.3, color: "#475569", lineHeight: 1.2 }}>
                      Hải Phòng, ngày {new Date().getDate().toString().padStart(2, "0")} tháng {(new Date().getMonth() + 1).toString().padStart(2, "0")} năm {new Date().getFullYear()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Title */}
              <Box sx={{ textAlign: "center", my: 0.5 }}>
                <Typography sx={{ fontFamily: "inherit", fontSize: "17px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1.2 }}>
                  PHIẾU THÔNG TIN HỒ SƠ TUYỂN SINH
                </Typography>
                <Typography sx={{ fontFamily: "inherit", fontSize: "12px", fontStyle: "italic", fontWeight: 600, color: "#334155", lineHeight: 1.2 }}>
                  (Bậc đào tạo: {printRecord.trainingLevel?.toUpperCase()} - Niên khóa: {printRecord.academicYear || year})
                </Typography>
              </Box>

              {/* Section I: Thông tin cá nhân & Ảnh 3x4 */}
              <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                {/* 3x4 Photo Frame */}
                <Box
                  sx={{
                    width: 90,
                    height: 120,
                    border: "1px solid #173E75",
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                    bgcolor: "#F8FAFC",
                    textAlign: "center",
                  }}
                >
                  {printRecord.photo ? (
                    <img src={printRecord.photo} alt="Ảnh 3x4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Box sx={{ p: 0.5 }}>
                      <PersonRounded sx={{ fontSize: 24, color: "#94A3B8", mb: 0.3 }} />
                      <Typography sx={{ fontFamily: "inherit", fontSize: "9.5px", fontStyle: "italic", color: "#64748B", lineHeight: 1.15 }}>
                        Ảnh 3x4<br />(Đóng dấu giáp lai)
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Personal Info Grid */}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                    I. THÔNG TIN CÁ NHÂN & LIÊN LẠC
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                    <div><strong>Họ và tên:</strong> <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{printRecord.fullName}</span></div>
                    <div><strong>Mã học viên/SBD:</strong> <span>{printRecord.code || "—"}</span></div>
                    <div><strong>Ngày sinh:</strong> <span>{printRecord.dob || "—"}</span></div>
                    <div><strong>Giới tính:</strong> <span>{printRecord.gender || "Nam"}</span></div>
                    <div><strong>Số CMND/CCCD:</strong> <span>{printRecord.idCard || "—"}</span></div>
                    <div><strong>Nơi sinh:</strong> <span>{printRecord.pob || "—"}</span></div>
                    <div><strong>Điện thoại:</strong> <span>{printRecord.phone || "—"}</span></div>
                    <div><strong>Email:</strong> <span>{printRecord.email || "—"}</span></div>
                    <div><strong>Dân tộc:</strong> <span>{printRecord.ethnicity || "Kinh"}</span></div>
                    <div><strong>Quốc tịch:</strong> <span>{printRecord.nationality || "Việt Nam"}</span></div>
                  </Box>
                  <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
                    <strong>Địa chỉ thường trú / Hộ khẩu:</strong> <span>{[printRecord.ward, printRecord.city].filter(Boolean).join(", ") || "—"}</span>
                  </div>
                </Box>
              </Box>

              {/* Section II: Thể thức đào tạo */}
              <Box>
                <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                  II. THỂ THỨC & CHƯƠNG TRÌNH ĐÀO TẠO
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                  <div><strong>Chuyên ngành đăng ký:</strong> <span style={{ fontWeight: 700 }}>{printRecord.majorName || printRecord.major?.name || "—"}</span></div>
                  <div><strong>Trình độ đào tạo:</strong> <span>{printRecord.trainingLevel || "Thạc sĩ"}</span></div>
                  <div><strong>Nhóm hình thức đào tạo:</strong> <span>{printRecord.trainingModeGroup || "Chính quy"}</span></div>
                  <div><strong>Hình thức đào tạo:</strong> <span>{printRecord.trainingModeName || "Đào tạo thông thường"}</span></div>
                  <div><strong>Ngôn ngữ giảng dạy:</strong> <span>{printRecord.language || "Tiếng Việt"}</span></div>
                  <div><strong>Miễn thi môn Ngoại ngữ:</strong> <span>{printRecord.isExemptForeignLanguage ? "Được miễn thi (Đạt chuẩn chứng chỉ)" : "Không"}</span></div>
                  <div><strong>Hình thức nhận hồ sơ:</strong> <span>{printRecord.receiptType || "Trực tiếp"}</span></div>
                  <div><strong>Phân loại hồ sơ:</strong> <span>{printRecord.profileCategory || "Đầy đủ"}</span></div>
                  <div><strong>Trạng thái hồ sơ:</strong> <span>{printRecord.studyStatus || "Nộp hồ sơ đầu vào"}</span></div>
                  <div><strong>Ngày nộp / tiếp nhận:</strong> <span>{printRecord.admissionDate || "—"}</span></div>
                </Box>
              </Box>

              {/* Section III: Văn bằng đại học đầu vào */}
              <Box>
                <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                  III. VĂN BẰNG ĐẠI HỌC / NĂNG LỰC ĐẦU VÀO
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                  <div><strong>Trường tốt nghiệp ĐH:</strong> <span>{printRecord.gradSchool || "—"}</span></div>
                  <div><strong>Chuyên ngành tốt nghiệp ĐH:</strong> <span>{printRecord.gradMajor || "—"}</span></div>
                  <div><strong>Hệ đào tạo ĐH:</strong> <span>{printRecord.gradDegreeType || "Chính quy"}</span></div>
                  <div><strong>Năm tốt nghiệp:</strong> <span>{printRecord.gradYear || "—"}</span></div>
                  <div><strong>Điểm TB tích lũy ĐH:</strong> <span>{printRecord.gpa || "—"}</span></div>
                  <div><strong>Xếp loại tốt nghiệp:</strong> <span>{printRecord.gradClassification || "—"}</span></div>
                  <div><strong>Số hiệu văn bằng ĐH:</strong> <span>{printRecord.diplomaNumber || "—"}</span></div>
                  <div><strong>Số vào sổ cấp bằng:</strong> <span>{printRecord.registryBookNumber || "—"}</span></div>
                  <div><strong>Đơn vị công tác hiện nay:</strong> <span>{printRecord.workplace || "—"}</span></div>
                  <div><strong>Nghề nghiệp:</strong> <span>{printRecord.job || "—"}</span></div>
                  <div><strong>Đối tượng ưu tiên:</strong> <span>{printRecord.priorityObject || "Không"}</span></div>
                  <div><strong>Số môn học BSKT:</strong> <span>{printRecord.supplementSubjectsCount || 0} môn</span></div>
                </Box>
                {printRecord.note && (
                  <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
                    <strong>Ghi chú thêm:</strong> <span>{printRecord.note}</span>
                  </div>
                )}
              </Box>

              {/* Section IV: Danh mục hồ sơ giấy tờ kèm theo */}
              <Box>
                <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                  IV. DANH MỤC HỒ SƠ & GIẤY TỜ ĐÍNH KÈM
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", rowGap: 0.35, columnGap: 1, fontSize: "11.5px", lineHeight: 1.2 }}>
                  {DOCUMENT_ITEMS.map((doc) => {
                    const isChecked = Boolean(printRecord.documents?.[doc.key]);
                    return (
                      <div key={doc.key} style={{ display: "flex", alignItems: "center" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 12,
                            height: 12,
                            border: "1.2px solid #000000",
                            borderRadius: 2,
                            marginRight: 5,
                            fontSize: 9,
                            fontWeight: "bold",
                            lineHeight: 1,
                            backgroundColor: "#fff",
                            color: "#000",
                            flexShrink: 0,
                          }}
                        >
                          {isChecked ? "✓" : ""}
                        </span>
                        <span>{doc.label}</span>
                      </div>
                    );
                  })}
                </Box>
              </Box>

              {/* Signatures */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", textAlign: "center", pt: 0.5, pageBreakInside: "avoid", breakInside: "avoid" }}>
                <Box>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
                    Hải Phòng, ngày ... tháng ... năm 20...
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
                    NGƯỜI KHAI HỒ SƠ
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>(Ký và ghi rõ họ tên)</Typography>
                  <Box sx={{ height: 42 }} />
                  <Typography sx={{ fontFamily: "inherit", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>{printRecord.fullName}</Typography>
                </Box>

                <Box>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
                    Ngày ... tháng ... năm 20...
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
                    CÁN BỘ TIẾP NHẬN
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>(Ký và ghi rõ họ tên)</Typography>
                  <Box sx={{ height: 42 }} />
                </Box>

                <Box>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "11px", fontStyle: "italic", color: "#334155", lineHeight: 1.2 }}>
                    Ngày ... tháng ... năm 20...
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", mt: 0.2, lineHeight: 1.2 }}>
                    VIỆN TRƯỞNG
                  </Typography>
                  <Typography sx={{ fontFamily: "inherit", fontSize: "10.5px", fontStyle: "italic", lineHeight: 1.2 }}>(Ký tên, đóng dấu)</Typography>
                  <Box sx={{ height: 42 }} />
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deletingRecord)} onClose={() => setDeletingRecord(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "#B52D2D" }}>Xác nhận xóa hồ sơ</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Bạn có chắc chắn muốn xóa hồ sơ thí sinh <strong>{deletingRecord?.fullName}</strong> (Mã: <strong>{deletingRecord?.code}</strong>) không?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeletingRecord(null)} color="inherit">Hủy</Button>
          <Button variant="contained" color="error" onClick={handleDeleteRecord}>Xóa vĩnh viễn</Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default AdmissionRecords;
