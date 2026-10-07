import AdmissionEvaluationPanel from "../../features/admission/AdmissionEvaluationPanel";
import AdmissionTuitionCheckbox from "../../features/admission/AdmissionTuitionCheckbox";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel,
  IconButton, MenuItem, Paper, Select,
  Stack, TextField, Tooltip, Typography, Tabs, Tab,
} from "@mui/material";
import {
  AddPhotoAlternateRounded, ArrowBackRounded, CheckCircleRounded,
  DeleteRounded, FolderSpecialRounded, PersonRounded, PictureAsPdfRounded,
  RefreshRounded, SaveRounded, SchoolRounded, WarningAmberRounded, WorkspacePremiumRounded,
  SwapHorizRounded, HistoryRounded,
  AddRounded, DeleteOutlineRounded, EditRounded, FactCheckRounded, MenuBookRounded, RuleRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import { getSelectableMajors, normalizeMajorsResponse, selectMajorForLevel } from "../../utils/majors";
import {
  disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline,
} from "../../utils/disciplineScope";
import FeatureLayout from "../../components/FeatureLayout";

const DOCUMENT_ITEMS = [
  { key: "docDecision", label: "Quyết định cử đi học" },
  { key: "docApplication", label: "Đơn xin dự thi" },
  { key: "docCurriculumVitae", label: "Sơ yếu lý lịch" },
  { key: "docDegree", label: "Bằng tốt nghiệp ĐH" },
  { key: "docHealthCert", label: "Giấy khám sức khoẻ" },
  { key: "docPhoto", label: "Ảnh hồ sơ (3x4)" },
  { key: "docSupplement", label: "Học bổ sung kiến thức" },
  { key: "docTranscript", label: "Bảng điểm đại học" },
];

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

// Nguồn học của kết quả học phần cá nhân
const LEARNING_SOURCES = [
  { value: "pre_masters", label: "Tiền thạc sĩ" },
  { value: "early_enrollment", label: "Học trước" },
  { value: "regular", label: "Chính khóa" },
  { value: "external", label: "Ngoài trường" },
];

const LEARNING_STATUSES = [
  { value: "registered", label: "Mới đăng ký" },
  { value: "studying", label: "Đang học" },
  { value: "completed", label: "Đã hoàn thành" },
];

const LEARNING_RESULTS = [
  { value: "pending", label: "Chưa có kết quả" },
  { value: "passed", label: "Đạt" },
  { value: "failed", label: "Không đạt" },
  { value: "exempt", label: "Miễn học" },
];

const RECOGNITION_BASIS_LABELS = {
  canonical_subject: "Cùng học phần gốc",
  declared_equivalence: "Đã khai báo tương đương",
  same_name: "Chỉ trùng tên — chờ hội đồng",
};

const emptyLearningForm = () => ({
  catalogType: "subject",
  subjectId: "",
  bridgeKnowledgeSubjectId: "",
  sourceType: "pre_masters",
  academicYear: "",
  status: "registered",
  result: "pending",
  score: "",
  completedAt: "",
  decisionNo: "",
  institution: "",
  note: "",
});

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

const fieldLabelSx = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  mb: 0.5,
  display: "block",
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#FFFFFF",
    borderRadius: "4px",
    fontSize: "13px",
    "& fieldset": { borderColor: "#CBD5E1" },
    "&:hover fieldset": { borderColor: "#94A3B8" },
    "&.Mui-focused fieldset": { borderColor: "#0788B8", borderWidth: "1.5px" },
  },
  "& .MuiInputBase-input": {
    py: "7px",
    px: "10px",
  },
};

const selectSx = {
  bgcolor: "#FFFFFF",
  borderRadius: "4px",
  fontSize: "13px",
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#CBD5E1" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#94A3B8" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#0788B8", borderWidth: "1.5px" },
  "& .MuiSelect-select": { py: "7px", px: "10px" },
};

const sectionCardSx = {
  p: { xs: 2, md: 2.5 },
  bgcolor: "#FFFFFF",
  borderColor: "#DFE4E8",
  borderRadius: "6px",
  mb: 2.5,
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
};

const sectionTitleSx = {
  fontSize: 14,
  fontWeight: 800,
  color: "#1E293B",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  display: "flex",
  alignItems: "center",
  gap: 1,
  mb: 2,
  pb: 1,
  borderBottom: "1.5px solid #F1F5F9",
};

const mapRecordToFormState = (data, majorList = []) => {
  if (!data) return null;
  const majorId = data.majorId || data.major?.id || "";
  const foundMajor = Array.isArray(majorList) ? majorList.find((m) => m.id === majorId) : null;
  const majorName = data.majorName || data.major?.name || foundMajor?.name || "";

  return {
    id: data.id,
    academicYear: data.academicYear || String(new Date().getFullYear()),
    code: data.code || "",
    fullName: data.fullName || "",
    lastName: data.lastName || "",
    firstName: data.firstName || "",
    dob: data.dob || "",
    gender: data.gender || "Nam",
    idCard: data.idCard || "",
    pob: data.pob || "",
    ward: data.ward || "",
    city: data.city || "Thành phố Hải Phòng",
    phone: data.phone || "",
    email: data.email || "",
    nationality: data.nationality || "Việt Nam",
    ethnicity: data.ethnicity || "Kinh",
    photo: data.photo || "",

    trainingLevel: data.trainingLevel || "Thạc sĩ",
    majorId,
    majorName,
    trainingModeGroup: data.trainingModeGroup || "Chính quy",
    trainingModeName: data.trainingModeName || "Đào tạo thông thường",
    language: data.language || "Tiếng Việt",
    isExemptForeignLanguage: Boolean(data.isExemptForeignLanguage),
    receiptType: data.receiptType || "Trực tiếp",
    profileCategory: data.profileCategory || "Đầy đủ",
    studyStatus: data.studyStatus || "Nộp hồ sơ đầu vào",
    admissionDate: data.admissionDate || "",

    gradSchool: data.gradSchool || "Trường Đại học Hàng hải Việt Nam",
    gradMajor: data.gradMajor || "",
    gradDegreeType: data.gradDegreeType || "Chính quy",
    gradYear: data.gradYear || "",
    gpa: data.gpa || "",
    gradClassification: data.gradClassification || "Khá",
    diplomaNumber: data.diplomaNumber || "",
    registryBookNumber: data.registryBookNumber || "",
    workplace: data.workplace || "",
    job: data.job || "",
    priorityObject: data.priorityObject || "Không",
    supplementSubjectsCount: Number(data.supplementSubjectsCount || 0),
    note: data.note || "",

    documents: {
      docDecision: Boolean(data.documents?.docDecision),
      docApplication: Boolean(data.documents?.docApplication),
      docCurriculumVitae: Boolean(data.documents?.docCurriculumVitae),
      docDegree: Boolean(data.documents?.docDegree),
      docHealthCert: Boolean(data.documents?.docHealthCert),
      docPhoto: Boolean(data.documents?.docPhoto),
      docSupplement: Boolean(data.documents?.docSupplement),
      docTranscript: Boolean(data.documents?.docTranscript),
    },
  };
};

const AdmissionRecordDetail = ({ returnPath = "/plan/admission-records" }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [detailTab, setDetailTab] = useState(new URLSearchParams(window.location.search).get("tab") === "admission" ? "admission" : "profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [record, setRecord] = useState(null);
  const [formData, setFormData] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [majors, setMajors] = useState([]);
  const [disciplineId, setDisciplineId] = useState("");
  const [transferHistory, setTransferHistory] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ toMajorId: "", reason: "" });
  const [transferDisciplineId, setTransferDisciplineId] = useState("");
  const [decisionTransfer, setDecisionTransfer] = useState(null);
  const [decisionForm, setDecisionForm] = useState({ decision: "approved", toCurriculumId: "", note: "" });
  const [decisionCurriculums, setDecisionCurriculums] = useState([]);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  // ===== Kết quả học phần cá nhân (tiền thạc sĩ / học trước / chính khóa) =====
  const [learningResults, setLearningResults] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [recognizedCredits, setRecognizedCredits] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [bridgeSubjects, setBridgeSubjects] = useState([]);
  const [learningOpen, setLearningOpen] = useState(false);
  const [editingLearning, setEditingLearning] = useState(null);
  const [learningForm, setLearningForm] = useState(null);
  const [learningSaving, setLearningSaving] = useState(false);
  const [decisionRecognition, setDecisionRecognition] = useState(null);
  const [recognitionDecision, setRecognitionDecision] = useState({ decision: "approved", decisionNo: "", note: "" });

  const selectableMajors = useMemo(
    () => getSelectableMajors(majors, formData?.trainingLevel),
    [majors, formData?.trainingLevel],
  );
  const disciplines = useMemo(() => disciplinesFromMajors(selectableMajors), [selectableMajors]);
  const visibleSelectableMajors = useMemo(
    () => majorsForDiscipline(selectableMajors, disciplineId),
    [selectableMajors, disciplineId],
  );
  const visibleTransferMajors = useMemo(
    () => majorsForDiscipline(selectableMajors, transferDisciplineId),
    [selectableMajors, transferDisciplineId],
  );

  // Check for unsaved changes
  const isDirty = useMemo(() => {
    if (!initialData || !formData) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  // Window beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Fetch record & majors list
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resRec, resMajors, resTransfers, resResults, resRecognitions, resCredits, resBridge] = await Promise.all([
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/system/majors`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}/major-transfers`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}/learning-results`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}/subject-recognitions`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}/recognized-credits`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/system/bridge-knowledge`, { withCredentials: true }),
      ]);

      const data = resRec.data;
      const majorList = normalizeMajorsResponse(resMajors.data);
      setRecord(data);
      setMajors(majorList);
      setTransferHistory(Array.isArray(resTransfers.data) ? resTransfers.data : []);
      setLearningResults(Array.isArray(resResults.data) ? resResults.data : []);
      setRecognitions(Array.isArray(resRecognitions.data) ? resRecognitions.data : []);
      setRecognizedCredits(Number(resCredits.data?.credits ?? resCredits.data ?? 0) || 0);
      setBridgeSubjects(Array.isArray(resBridge.data) ? resBridge.data : []);
      if (data.majorId) {
        const { data: subjectRows } = await axios.get(
          `${API_BASE_URL}/plan/subjects?majorId=${data.majorId}&program=${data.trainingLevel === "Tiến sĩ" ? "doctoral" : "masters"}&includeCommon=true`,
          { withCredentials: true },
        );
        setSubjects(Array.isArray(subjectRows) ? subjectRows : []);
      }

      const mappedState = mapRecordToFormState(data, majorList);
      const selectedMajor = selectMajorForLevel(majorList, mappedState.trainingLevel, mappedState.majorId);
      const formState = {
        ...mappedState,
        majorId: selectedMajor?.id || "",
        majorName: selectedMajor?.name || "",
      };
      setDisciplineId(majorDisciplineId(selectedMajor));
      setFormData(formState);
      setInitialData(JSON.parse(JSON.stringify(formState)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải chi tiết hồ sơ tuyển sinh");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/auth/session`, { withCredentials: true })
      .then(({ data }) => { if (mounted) setIsAdmin(data.user?.role === "admin"); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, []);

  // Handle Photo Upload
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

  // Save changes
  const handleSave = async () => {
    if (!formData) return;
    if (!formData.fullName?.trim() && !formData.lastName?.trim() && !formData.firstName?.trim()) {
      toast.error("Vui lòng nhập họ và tên học viên");
      return;
    }
    const selectedMajor = selectableMajors.find((major) => major.id === formData.majorId);
    if (!selectedMajor) {
      toast.error("Vui lòng chọn chuyên ngành phù hợp với trình độ đào tạo");
      return;
    }

    const payload = {
      ...mapRecordToFormState(formData, majors),
      majorId: selectedMajor.id,
      majorName: selectedMajor.name,
    };
    setSaving(true);
    try {
      const { data: updated } = await axios.put(`${API_BASE_URL}/plan/admission-records/${id}`, payload, { withCredentials: true });
      toast.success("Lưu thay đổi hồ sơ thành công!");
      setRecord(updated);

      const syncedState = mapRecordToFormState(updated, majors);
      setDisciplineId(majorDisciplineId(majors.find((major) => major.id === syncedState.majorId)));
      setFormData(syncedState);
      setInitialData(JSON.parse(JSON.stringify(syncedState)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu thông tin hồ sơ tuyển sinh");
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Handle Back Click
  const handleBackClick = () => {
    if (isDirty) {
      setShowConfirmLeave(true);
    } else {
      navigate(returnPath);
    }
  };

  // Handle Print / PDF Export
  const handlePrint = () => {
    window.print();
  };

  const submitTransfer = async () => {
    if (!transferForm.toMajorId) return toast.error("Vui lòng chọn chuyên ngành mới.");
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/major-transfers`, transferForm, { withCredentials: true });
      toast.success("Đã lập yêu cầu chuyển chuyên ngành và đưa hồ sơ về trạng thái chờ xét.");
      setTransferOpen(false);
      setTransferForm({ toMajorId: "", reason: "" });
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lập yêu cầu chuyển chuyên ngành.");
    } finally { setSaving(false); }
  };

  const openDecision = async (transfer, decision) => {
    if (decision === "rejected") {
      if (!window.confirm("Từ chối yêu cầu và khôi phục chuyên ngành, lớp cùng trạng thái cũ của học viên?")) return;
      setSaving(true);
      try {
        await axios.put(`${API_BASE_URL}/plan/major-transfers/${transfer.id}/decision`, { decision: "rejected" }, { withCredentials: true });
        toast.success("Đã từ chối và khôi phục thông tin trước khi chuyển ngành.");
        await fetchData();
      } catch (err) { toast.error(err.response?.data?.message || "Không thể xử lý yêu cầu."); }
      finally { setSaving(false); }
      return;
    }
    try {
      const program = formData?.trainingLevel === "Tiến sĩ" ? "doctoral" : "masters";
      const { data } = await axios.get(`${API_BASE_URL}/plan/curriculums?majorId=${transfer.toMajorId}&program=${program}`, { withCredentials: true });
      const rows = (Array.isArray(data) ? data : []).filter((item) => String(item.applicableFromYear) === String(formData?.academicYear) && item.active !== false);
      setDecisionCurriculums(rows);
      setDecisionForm({ decision: "approved", toCurriculumId: rows.length === 1 ? rows[0].id : "", note: "" });
      setDecisionTransfer(transfer);
    } catch (err) { toast.error(err.response?.data?.message || "Không thể tải chương trình đào tạo mới."); }
  };

  const submitDecision = async () => {
    if (!decisionForm.toCurriculumId) return toast.error("Vui lòng chọn chương trình đào tạo mới.");
    setSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/plan/major-transfers/${decisionTransfer.id}/decision`, decisionForm, { withCredentials: true });
      toast.success("Đã duyệt chuyển chuyên ngành và đối chiếu học phần được công nhận.");
      setDecisionTransfer(null);
      await fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Không thể duyệt chuyển chuyên ngành."); }
    finally { setSaving(false); }
  };

  // ===== Kết quả học phần cá nhân =====
  const openLearningDialog = (row) => {
    if (row) {
      setEditingLearning(row);
      setLearningForm({
        catalogType: row.bridgeKnowledgeSubjectId ? "bridge" : "subject",
        subjectId: row.subjectId || "",
        bridgeKnowledgeSubjectId: row.bridgeKnowledgeSubjectId || "",
        sourceType: row.sourceType || "pre_masters",
        academicYear: row.academicYear || "",
        status: row.status || "registered",
        result: row.result || "pending",
        score: row.score === null || row.score === undefined ? "" : String(row.score),
        completedAt: row.completedAt ? String(row.completedAt).slice(0, 10) : "",
        decisionNo: row.decisionNo || "",
        institution: row.institution || "",
        note: row.note || "",
      });
    } else {
      setEditingLearning(null);
      setLearningForm({ ...emptyLearningForm(), academicYear: formData?.academicYear || "" });
    }
    setLearningOpen(true);
  };

  const reloadRecognitionData = async () => {
    const [resResults, resRecognitions, resCredits] = await Promise.all([
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/learning-results`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/subject-recognitions`, { withCredentials: true }),
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/recognized-credits`, { withCredentials: true }),
    ]);
    setLearningResults(Array.isArray(resResults.data) ? resResults.data : []);
    setRecognitions(Array.isArray(resRecognitions.data) ? resRecognitions.data : []);
    setRecognizedCredits(Number(resCredits.data?.credits ?? resCredits.data ?? 0) || 0);
  };

  const submitLearningResult = async () => {
    if (!learningForm) return;
    const isBridge = learningForm.catalogType === "bridge";
    if (isBridge && !learningForm.bridgeKnowledgeSubjectId) return toast.error("Vui lòng chọn học phần bổ sung kiến thức.");
    if (!isBridge && !learningForm.subjectId) return toast.error("Vui lòng chọn học phần.");
    if (learningForm.status === "completed" && !learningForm.completedAt) {
      return toast.error("Kết quả đã hoàn thành phải có ngày hoàn thành.");
    }
    const payload = {
      sourceType: learningForm.sourceType,
      status: learningForm.status,
      result: learningForm.status === "completed" ? learningForm.result : "pending",
      academicYear: learningForm.academicYear || null,
      score: learningForm.score === "" ? null : Number(learningForm.score),
      completedAt: learningForm.status === "completed" ? learningForm.completedAt : null,
      decisionNo: learningForm.decisionNo || null,
      institution: learningForm.institution || null,
      note: learningForm.note || null,
      ...(isBridge
        ? { bridgeKnowledgeSubjectId: learningForm.bridgeKnowledgeSubjectId }
        : { subjectId: learningForm.subjectId }),
    };
    setLearningSaving(true);
    try {
      if (editingLearning) {
        await axios.put(`${API_BASE_URL}/plan/learning-results/${editingLearning.id}`, payload, { withCredentials: true });
        toast.success("Đã cập nhật kết quả học phần.");
      } else {
        await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/learning-results`, payload, { withCredentials: true });
        toast.success("Đã lưu kết quả học phần cá nhân.");
      }
      setLearningOpen(false);
      setEditingLearning(null);
      await reloadRecognitionData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu kết quả học phần.");
    } finally { setLearningSaving(false); }
  };

  const removeLearningResult = async (row) => {
    if (!window.confirm("Xóa kết quả học phần này? Các đề xuất công nhận liên quan sẽ không còn căn cứ.")) return;
    setLearningSaving(true);
    try {
      await axios.delete(`${API_BASE_URL}/plan/learning-results/${row.id}`, { withCredentials: true });
      toast.success("Đã xóa kết quả học phần.");
      await reloadRecognitionData();
    } catch (err) { toast.error(err.response?.data?.message || "Không thể xóa kết quả học phần."); }
    finally { setLearningSaving(false); }
  };

  const proposeRecognitions = async () => {
    setLearningSaving(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/subject-recognitions/propose`, {}, { withCredentials: true });
      const parts = [];
      if (data.autoApproved) parts.push(`${data.autoApproved} tự động công nhận`);
      if (data.pendingReview) parts.push(`${data.pendingReview} chờ hội đồng`);
      if (data.carriedOver) parts.push(`${data.carriedOver} kế thừa đăng ký`);
      toast.success(parts.length ? `Đã đối chiếu CTĐT: ${parts.join(", ")}.` : "Không có học phần nào đủ điều kiện công nhận.");
      await reloadRecognitionData();
    } catch (err) { toast.error(err.response?.data?.message || "Không thể đối chiếu công nhận học phần."); }
    finally { setLearningSaving(false); }
  };

  const openRecognitionDecision = (row) => {
    setDecisionRecognition(row);
    setRecognitionDecision({
      // Giữ nguyên quyết định đã chốt để "Sửa quyết định" không vô tình đảo kết quả khi chỉ muốn sửa ghi chú.
      decision: row.status === "rejected" ? "rejected" : "approved",
      decisionNo: row.decisionNo || "",
      note: row.note || "",
    });
  };

  const submitRecognitionDecision = async () => {
    if (!decisionRecognition) return;
    setLearningSaving(true);
    try {
      const editingDecided = decisionRecognition.status !== "pending";
      await axios.put(`${API_BASE_URL}/plan/subject-recognitions/${decisionRecognition.id}/decision`, recognitionDecision, { withCredentials: true });
      toast.success(editingDecided
        ? "Đã cập nhật quyết định công nhận học phần."
        : recognitionDecision.decision === "approved" ? "Đã duyệt công nhận học phần." : "Đã từ chối công nhận học phần.");
      setDecisionRecognition(null);
      await reloadRecognitionData();
    } catch (err) { toast.error(err.response?.data?.message || "Không thể xử lý quyết định công nhận."); }
    finally { setLearningSaving(false); }
  };

  /**
   * Hủy quyết định công nhận để sửa lại. Xóa hẳn bản ghi thay vì đặt "rejected" vì
   * `proposeForRecord()` chỉ tạo lại đề xuất cho học phần chưa có quyết định — một dòng
   * `rejected` sẽ bị bỏ qua vĩnh viễn.
   */
  const removeRecognition = async (row) => {
    if (!window.confirm(`Hủy công nhận học phần "${subjectLabel(row.targetSubject)}"?\nSau đó bấm "Đối chiếu CTĐT & đề xuất công nhận" để hệ thống đề xuất lại theo dữ liệu hiện hành.`)) return;
    setLearningSaving(true);
    try {
      await axios.delete(`${API_BASE_URL}/plan/subject-recognitions/${row.id}`, { withCredentials: true });
      toast.success("Đã hủy công nhận học phần.");
      await reloadRecognitionData();
    } catch (err) { toast.error(err.response?.data?.message || "Không thể hủy công nhận học phần."); }
    finally { setLearningSaving(false); }
  };

  const subjectLabel = (row) => {
    if (!row) return "—";
    const code = row.codeText || row.codeNumber || row.code || "";
    return code ? `${code} — ${row.name}` : row.name;
  };

  return (
    <FeatureLayout
      title={record ? `Hồ sơ: ${record.fullName}` : "Chi tiết hồ sơ tuyển sinh"}
      group="Kế hoạch khóa mới"
      desc="Chỉnh sửa toàn bộ thông tin hồ sơ tuyển sinh trực tiếp trên một trang và xuất file PDF khổ A4."
      maxWidth={1260}
    >
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />

      {/* Global Styles for PDF / Print Output */}
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, nav, footer, .MuiAppBar-root, .Toastify, #root > div > header, #root > div > nav, .screen-only-form {
            display: none !important;
          }
          .a4-print-only-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            inset: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-print-only-container * {
            visibility: visible !important;
          }
          .a4-paper-sheet {
            box-shadow: none !important;
            border: 1.5px solid #173E75 !important;
            margin: 0 !important;
            padding: 10mm 13mm !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            break-inside: avoid !important;
            break-after: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER TOOLBAR (SCREEN ONLY)                                       */}
      {/* ========================================================================= */}
      <Paper
        variant="outlined"
        className="no-print"
        sx={{
          p: 1.5,
          mb: 2.5,
          bgcolor: "#FFFFFF",
          borderColor: "#DFE4E8",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackRounded />}
            onClick={handleBackClick}
            sx={{
              height: 34,
              fontSize: 12.5,
              fontWeight: 600,
              textTransform: "none",
              borderRadius: "4px",
              borderColor: "#CBD5E1",
              color: "#334155",
              bgcolor: "#F8FAFC",
              "&:hover": { bgcolor: "#F1F5F9", borderColor: "#94A3B8" },
            }}
          >
            Quay lại danh sách
          </Button>

          <Tooltip title="Tải lại dữ liệu">
            <IconButton size="small" onClick={fetchData} disabled={loading} sx={{ border: "1px solid #DFE4E8", borderRadius: "4px", p: "6px" }}>
              <RefreshRounded fontSize="small" sx={{ color: "#607486" }} />
            </IconButton>
          </Tooltip>

          {record && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#173E75", fontSize: 15, ml: 0.5 }}>
                {formData?.fullName || record.fullName}
              </Typography>
              {record.code && (
                <Chip
                  label={record.code}
                  size="small"
                  sx={{
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 12,
                    bgcolor: "#EBF5FB",
                    color: "#0788B8",
                    borderRadius: "3px",
                    height: 24,
                  }}
                />
              )}
              <Chip
                label={formData?.trainingLevel || record.trainingLevel || "Thạc sĩ"}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: 11,
                  bgcolor: (formData?.trainingLevel || record.trainingLevel) === "Tiến sĩ" ? "#FEF7E0" : "#E6F4EA",
                  color: (formData?.trainingLevel || record.trainingLevel) === "Tiến sĩ" ? "#B86216" : "#137B3B",
                  borderRadius: "3px",
                  height: 24,
                }}
              />
              <Chip
                label={formData?.studyStatus || record.studyStatus || "Nộp hồ sơ"}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: 11,
                  bgcolor: "#F1F5F9",
                  color: "#475569",
                  borderRadius: "3px",
                  height: 24,
                }}
              />
            </>
          )}

          {isDirty ? (
            <Chip
              icon={<WarningAmberRounded sx={{ fontSize: "16px !important", color: "#B45309" }} />}
              label="Có thay đổi chưa lưu"
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: 11.5,
                bgcolor: "#FEF3C7",
                color: "#92400E",
                border: "1px solid #FCD34D",
                borderRadius: "3px",
                height: 24,
              }}
            />
          ) : (
            <Chip
              icon={<CheckCircleRounded sx={{ fontSize: "16px !important", color: "#16A34A" }} />}
              label="Đã lưu tất cả"
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 600,
                fontSize: 11.5,
                color: "#16A34A",
                borderColor: "#86EFAC",
                bgcolor: "#F0FDF4",
                borderRadius: "3px",
                height: 24,
              }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1.2} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<SwapHorizRounded />}
            onClick={() => {
              setTransferForm({ toMajorId: "", reason: "" });
              setTransferDisciplineId("");
              setTransferOpen(true);
            }}
            disabled={saving || transferHistory.some((item) => item.status === "pending")}
            sx={{ height: 34, textTransform: "none", fontWeight: 700 }}
          >
            Chuyển chuyên ngành
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<PictureAsPdfRounded />}
            onClick={handlePrint}
            sx={{
              height: 34,
              px: 2,
              bgcolor: "#DC2626",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "4px",
              boxShadow: "none",
              "&:hover": { bgcolor: "#B91C1C" },
            }}
          >
            PDF (Khổ A4)
          </Button>

          <Button
            variant="contained"
            size="small"
            startIcon={<SaveRounded />}
            onClick={handleSave}
            disabled={saving || !isDirty}
            sx={{
              height: 34,
              px: 2.5,
              bgcolor: isDirty ? "#16A34A" : "#2563EB",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "4px",
              boxShadow: "none",
              "&:hover": { bgcolor: isDirty ? "#15803D" : "#1D4ED8" },
            }}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi (Ctrl+S)"}
          </Button>
        </Stack>
      </Paper>

      {/* ========================================================================= */}
      {/* 2. LOADING STATE & CONTINUOUS SINGLE-PAGE EDIT FORM                       */}
      {/* ========================================================================= */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 14, bgcolor: "#FFFFFF", borderRadius: "6px", border: "1px solid #DFE4E8" }}>
          <CircularProgress size={38} sx={{ color: "#0788B8", mr: 2 }} />
          <Typography variant="body2" sx={{ color: "#607486", fontWeight: 600 }}>Đang tải dữ liệu hồ sơ tuyển sinh...</Typography>
        </Box>
      ) : !formData ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: "6px", borderColor: "#DFE4E8" }}>
          <Typography variant="h6" sx={{ color: "#B52D2D", fontWeight: 700, mb: 1 }}>
            Không tìm thấy thông tin hồ sơ tuyển sinh!
          </Typography>
          <Button variant="contained" size="small" onClick={() => navigate(returnPath)} sx={{ bgcolor: "#0788B8", mt: 1 }}>
            Trở về danh sách hồ sơ
          </Button>
        </Paper>
      ) : (
        <Box className="screen-only-form">
          {record.trainingLevel === "Thạc sĩ" && <>
            <Tabs value={detailTab} onChange={(_, value) => {
              setDetailTab(value);
            }} sx={{ mb: 2, bgcolor: "white", border: "1px solid #DFE4E8", borderRadius: 1 }}>
              <Tab value="profile" label="Thông tin hồ sơ & học tập" />
              <Tab value="admission" label="Xét tuyển" />
            </Tabs>
            {detailTab === "admission" && <AdmissionEvaluationPanel record={record} />}
          </>}
          <Box sx={{ display: detailTab === "profile" || record.trainingLevel !== "Thạc sĩ" ? "block" : "none" }}>
          <Paper variant="outlined" sx={{ ...sectionCardSx, mb: 2 }}>
            <Typography sx={sectionTitleSx}>
              <HistoryRounded sx={{ color: "#0788B8", fontSize: 20 }} />
              Lịch sử chuyển chuyên ngành
            </Typography>
            {transferHistory.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#64748B" }}>Học viên chưa có lần chuyển chuyên ngành nào.</Typography>
            ) : transferHistory.map((item) => (
              <Box key={item.id} sx={{ py: 1.25, borderTop: "1px solid #E2E8F0" }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                      {item.fromMajor?.name || "—"} → {item.toMajor?.name || "—"}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                      {new Date(item.requestedAt).toLocaleString("vi-VN")} · Mã học viên được giữ nguyên: {record?.code || "—"}
                    </Typography>
                    {item.reason && <Typography sx={{ fontSize: 12.5, mt: 0.5 }}>Lý do: {item.reason}</Typography>}
                    {item.toCurriculum && <Typography sx={{ fontSize: 12.5 }}>CTĐT mới: {item.toCurriculum.code} — {item.toCurriculum.name}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={item.status === "pending" ? "Chờ hội đồng" : item.status === "approved" ? "Đã duyệt" : "Từ chối"} color={item.status === "approved" ? "success" : item.status === "rejected" ? "error" : "warning"} />
                    {item.status === "pending" && <>
                      <Button size="small" variant="contained" onClick={() => openDecision(item, "approved")}>Duyệt</Button>
                      <Button size="small" color="error" onClick={() => openDecision(item, "rejected")}>Từ chối</Button>
                    </>}
                  </Stack>
                </Stack>
                {(item.recognitions || []).length > 0 && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: "#F8FAFC", borderRadius: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Học phần được công nhận, không phải xếp học lại</Typography>
                    {(item.recognitions || []).map((row) => (
                      <Typography key={row.id} sx={{ fontSize: 12 }}>
                        {row.sourceSubject?.codeText || row.sourceSubject?.codeNumber} — {row.sourceSubject?.name}
                        {" → "}{row.targetSubject?.codeText || row.targetSubject?.codeNumber} — {row.targetSubject?.name}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Paper>

          {/* =================================================================== */}
          {/* SECTION 0B: KẾT QUẢ HỌC PHẦN CÁ NHÂN & CÔNG NHẬN                    */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={{ ...sectionCardSx, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              <Typography sx={{ ...sectionTitleSx, mb: 0 }}>
                <MenuBookRounded sx={{ color: "#0788B8", fontSize: 20 }} />
                Kết quả học phần cá nhân & công nhận ({learningResults.length})
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" color="success" variant="outlined" label={`Đã công nhận: ${recognizedCredits} tín chỉ`} />
                <Button size="small" variant="outlined" startIcon={<FactCheckRounded />} onClick={proposeRecognitions} disabled={learningSaving}>
                  Đối chiếu CTĐT & đề xuất công nhận
                </Button>
                <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => openLearningDialog(null)} disabled={learningSaving}>
                  Thêm kết quả học phần
                </Button>
              </Stack>
            </Stack>
            <Typography sx={{ fontSize: 12, color: "#64748B", mb: 1.5 }}>
              Ghi nhận mọi lần học (tiền thạc sĩ, học trước, chính khóa, học bổ sung kiến thức). Chỉ học phần
              <strong> đã hoàn thành và đạt</strong> mới được công nhận; mới đăng ký hoặc đang học chỉ được kế thừa đăng ký, chưa tính tín chỉ.
              Học bổ sung kiến thức chỉ được công nhận khi danh mục đã khai báo tương đương với một học phần CTĐT.
            </Typography>

            {learningResults.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#64748B" }}>Học viên chưa có kết quả học phần cá nhân nào.</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,2.4fr) 1.1fr 1fr 0.8fr 0.8fr auto", gap: 1, minWidth: 860 }}>
                  {["Học phần", "Nguồn học", "Trạng thái", "Điểm", "Kết quả", ""].map((header) => (
                    <Typography key={header} sx={{ fontSize: 11.5, fontWeight: 800, color: "#475569", textTransform: "uppercase", pb: 0.5, borderBottom: "1px solid #E2E8F0" }}>
                      {header}
                    </Typography>
                  ))}
                  {learningResults.map((row) => {
                    const source = LEARNING_SOURCES.find((item) => item.value === row.sourceType);
                    const status = LEARNING_STATUSES.find((item) => item.value === row.status);
                    const result = LEARNING_RESULTS.find((item) => item.value === row.result);
                    const eligible = row.status === "completed" && (row.result === "passed" || row.result === "exempt");
                    return (
                      <React.Fragment key={row.id}>
                        <Typography sx={{ fontSize: 12.5, py: 0.5 }}>
                          {row.subject ? subjectLabel(row.subject) : row.bridgeKnowledgeSubject ? `[BSKT] ${subjectLabel(row.bridgeKnowledgeSubject)}` : "—"}
                          {row.academicYear ? <span style={{ color: "#64748B" }}> · {row.academicYear}</span> : null}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, py: 0.5 }}>{source?.label || row.sourceType}</Typography>
                        <Typography sx={{ fontSize: 12.5, py: 0.5 }}>
                          <Chip
                            size="small"
                            label={status?.label || row.status}
                            color={row.status === "completed" ? (eligible ? "success" : "warning") : "default"}
                            variant={eligible ? "filled" : "outlined"}
                          />
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, py: 0.5 }}>{row.score ?? "—"}</Typography>
                        <Typography sx={{ fontSize: 12.5, py: 0.5 }}>{result?.label || row.result}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{ py: 0.5 }}>
                          <Tooltip title="Sửa kết quả"><span><IconButton size="small" onClick={() => openLearningDialog(row)}><EditRounded fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="Xóa kết quả"><span><IconButton size="small" color="error" onClick={() => removeLearningResult(row)}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
                        </Stack>
                      </React.Fragment>
                    );
                  })}
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>
              <RuleRounded sx={{ fontSize: 17, mr: 0.5, verticalAlign: "text-bottom", color: "#0788B8" }} />
              Quyết định công nhận học phần ({recognitions.length})
            </Typography>
            {recognitions.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#64748B" }}>
                Chưa có đề xuất công nhận. Nhấn “Đối chiếu CTĐT & đề xuất công nhận” để hệ thống tự so khớp.
              </Typography>
            ) : recognitions.map((row) => (
              <Stack
                key={row.id}
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                gap={1}
                sx={{ py: 1, borderTop: "1px solid #E2E8F0" }}
              >
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {subjectLabel(row.sourceSubject)} → {subjectLabel(row.targetSubject)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                    {RECOGNITION_BASIS_LABELS[row.basis] || row.basis}
                    {row.sourceType ? ` · nguồn: ${LEARNING_SOURCES.find((item) => item.value === row.sourceType)?.label || row.sourceType}` : ""}
                    {row.majorTransferId ? "" : " · không gắn chuyển chuyên ngành"}
                    {row.decisionNo ? ` · QĐ: ${row.decisionNo}` : ""}
                  </Typography>
                  {row.note && <Typography sx={{ fontSize: 12, mt: 0.25 }}>{row.note}</Typography>}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    label={row.status === "approved" ? "Đã công nhận" : row.status === "rejected" ? "Từ chối" : "Chờ hội đồng"}
                    color={row.status === "approved" ? "success" : row.status === "rejected" ? "error" : "warning"}
                  />
                  {row.status === "pending" ? (
                    <Button size="small" variant="contained" onClick={() => openRecognitionDecision(row)}>Xử lý</Button>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditRounded fontSize="small" />}
                        onClick={() => openRecognitionDecision(row)}
                        disabled={learningSaving}
                      >
                        Sửa quyết định
                      </Button>
                      <Tooltip title="Hủy công nhận để đối chiếu lại theo dữ liệu hiện hành">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            data-testid={`cancel-recognition-${row.id}`}
                            onClick={() => removeRecognition(row)}
                            disabled={learningSaving}
                          >
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              </Stack>
            ))}
          </Paper>

          {/* =================================================================== */}
          {/* SECTION 1: THÔNG TIN CÁ NHÂN & LIÊN LẠC                             */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={sectionCardSx}>
            <Typography sx={sectionTitleSx}>
              <PersonRounded sx={{ color: "#0788B8", fontSize: 20 }} />
              I. Thông tin cá nhân & liên lạc
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 240px" }, gap: 3 }}>
              {/* Left Fields Grid */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
                <Box>
                  <Typography sx={fieldLabelSx}>Họ và tên *</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.fullName}
                    onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                    sx={inputSx}
                    placeholder="Nguyễn Văn A"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Mã học viên / SBD</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.code}
                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                    sx={inputSx}
                    placeholder="HV26001"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Giới tính</Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={formData.gender}
                    onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                    sx={selectSx}
                  >
                    <MenuItem value="Nam">Nam</MenuItem>
                    <MenuItem value="Nữ">Nữ</MenuItem>
                  </Select>
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Ngày sinh</Typography>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    value={formData.dob}
                    onChange={(e) => setFormData((p) => ({ ...p, dob: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    sx={inputSx}
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Số CMND / CCCD</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.idCard}
                    onChange={(e) => setFormData((p) => ({ ...p, idCard: e.target.value }))}
                    sx={inputSx}
                    placeholder="031200000000"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Nơi sinh (Tỉnh / TP)</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.pob}
                    onChange={(e) => setFormData((p) => ({ ...p, pob: e.target.value }))}
                    sx={inputSx}
                    placeholder="Hải Phòng"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Số điện thoại</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    sx={inputSx}
                    placeholder="0912345678"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Email</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    sx={inputSx}
                    placeholder="hocvien@vimaru.edu.vn"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Dân tộc</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.ethnicity}
                    onChange={(e) => setFormData((p) => ({ ...p, ethnicity: e.target.value }))}
                    sx={inputSx}
                    placeholder="Kinh"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Quốc tịch</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.nationality}
                    onChange={(e) => setFormData((p) => ({ ...p, nationality: e.target.value }))}
                    sx={inputSx}
                    placeholder="Việt Nam"
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Tỉnh / TP thường trú</Typography>
                  <Select
                    size="small"
                    fullWidth
                    value={formData.city || "Thành phố Hải Phòng"}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    sx={selectSx}
                  >
                    {CITIES.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Địa chỉ / Quận / Huyện</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={formData.ward}
                    onChange={(e) => setFormData((p) => ({ ...p, ward: e.target.value }))}
                    sx={inputSx}
                    placeholder="Số nhà, Phường/Xã..."
                  />
                </Box>
              </Box>

              {/* Right Photo Box */}
              <Box
                sx={{
                  border: "1px dashed #CBD5E1",
                  borderRadius: "6px",
                  p: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  bgcolor: "#F8FAFC",
                }}
              >
                <Typography sx={{ ...fieldLabelSx, textAlign: "center", mb: 1 }}>Ảnh thẻ (3x4)</Typography>
                <Box
                  sx={{
                    width: 105,
                    height: 140,
                    border: "1.5px solid #94A3B8",
                    borderRadius: "4px",
                    overflow: "hidden",
                    bgcolor: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                    mb: 1.5,
                  }}
                >
                  {formData.photo ? (
                    <img src={formData.photo} alt="Ảnh 3x4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Stack alignItems="center" spacing={0.5}>
                      <PersonRounded sx={{ fontSize: 36, color: "#CBD5E1" }} />
                      <Typography variant="caption" sx={{ color: "#94A3B8", fontSize: 10.5 }}>Chưa có ảnh</Typography>
                    </Stack>
                  )}
                </Box>

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: "none" }} />

                <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "center" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddPhotoAlternateRounded />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "none",
                      borderColor: "#0788B8",
                      color: "#0788B8",
                      height: 28,
                    }}
                  >
                    Chọn ảnh
                  </Button>
                  {formData.photo && (
                    <IconButton size="small" color="error" onClick={handleRemovePhoto} sx={{ border: "1px solid #FCA5A5", borderRadius: "4px", p: "3px" }}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </Box>
          </Paper>

          {/* =================================================================== */}
          {/* SECTION 2: THỂ THỨC & CHƯƠNG TRÌNH ĐÀO TẠO                          */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={sectionCardSx}>
            <Typography sx={sectionTitleSx}>
              <SchoolRounded sx={{ color: "#0788B8", fontSize: 20 }} />
              II. Thể thức & chương trình đào tạo
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2.5 }}>
              <Box>
                <Typography sx={fieldLabelSx}>Trình độ đào tạo</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.trainingLevel}
                  onChange={(e) => {
                    const trainingLevel = e.target.value;
                    const selected = selectMajorForLevel(majors, trainingLevel, formData.majorId);
                    setDisciplineId(majorDisciplineId(selected));
                    setFormData((previous) => {
                      return {
                        ...previous,
                        trainingLevel,
                        majorId: selected?.id || "",
                        majorName: selected?.name || "",
                      };
                    });
                  }}
                  sx={selectSx}
                >
                  {TRAINING_LEVELS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Ngành</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={disciplineId}
                  onChange={(e) => {
                    const nextDisciplineId = e.target.value;
                    setDisciplineId(nextDisciplineId);
                    if (nextDisciplineId && majorDisciplineId(
                      selectableMajors.find((major) => major.id === formData.majorId),
                    ) !== nextDisciplineId) {
                      setFormData((previous) => ({ ...previous, majorId: "", majorName: "" }));
                    }
                  }}
                  sx={selectSx}
                  displayEmpty
                >
                  <MenuItem value="">Tất cả ngành</MenuItem>
                  {disciplines.map((discipline) => (
                    <MenuItem key={discipline.id} value={discipline.id}>
                      {disciplineOptionLabel(discipline)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Chuyên ngành đăng ký tuyển sinh *</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.majorId || ""}
                  onChange={(e) => {
                    const selected = selectableMajors.find((m) => m.id === e.target.value);
                    setFormData((p) => ({
                      ...p,
                      majorId: e.target.value,
                      majorName: selected?.name || p.majorName,
                    }));
                  }}
                  sx={selectSx}
                  displayEmpty
                >
                  <MenuItem value="" disabled>-- Chọn chuyên ngành --</MenuItem>
                  {visibleSelectableMajors.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Nhóm hình thức đào tạo</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.trainingModeGroup}
                  onChange={(e) => setFormData((p) => ({ ...p, trainingModeGroup: e.target.value }))}
                  sx={selectSx}
                >
                  {TRAINING_MODE_GROUPS.map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Hình thức đào tạo cụ thể</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.trainingModeName}
                  onChange={(e) => setFormData((p) => ({ ...p, trainingModeName: e.target.value }))}
                  sx={selectSx}
                >
                  {TRAINING_MODES.map((m) => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Ngôn ngữ giảng dạy</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.language}
                  onChange={(e) => setFormData((p) => ({ ...p, language: e.target.value }))}
                  sx={inputSx}
                  placeholder="Tiếng Việt"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Hình thức nhận hồ sơ</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.receiptType}
                  onChange={(e) => setFormData((p) => ({ ...p, receiptType: e.target.value }))}
                  sx={selectSx}
                >
                  {RECEIPT_TYPES.map((r) => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Phân loại hồ sơ</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.profileCategory}
                  onChange={(e) => setFormData((p) => ({ ...p, profileCategory: e.target.value }))}
                  sx={selectSx}
                >
                  {PROFILE_CATEGORIES.map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Trạng thái hồ sơ</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.studyStatus}
                  onChange={(e) => setFormData((p) => ({ ...p, studyStatus: e.target.value }))}
                  sx={selectSx}
                >
                  {STUDY_STATUSES.map((s) => (
                    <MenuItem key={s} value={s} disabled={formData.trainingLevel === "Thạc sĩ" && ["Đã trúng tuyển", "Không trúng tuyển"].includes(s) && s !== record.studyStatus}>{s}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Ngày nộp / Tiếp nhận</Typography>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={formData.admissionDate}
                  onChange={(e) => setFormData((p) => ({ ...p, admissionDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={inputSx}
                />
              </Box>

              {record.trainingLevel === "Thạc sĩ" && <Box sx={{ gridColumn: "1 / -1", p: 1.5, border: "1px solid #D7E4EE", borderRadius: "8px" }}>
                <Typography fontWeight={700} mb={0.5}>Xác nhận học phí nhập học</Typography>
                <AdmissionTuitionCheckbox record={record} showDetails disabled={!isAdmin || saving || isDirty} onBusyChange={setSaving} onSaved={(updated) => {
                  setRecord(updated);
                  setFormData((previous) => ({ ...previous, studyStatus: updated.studyStatus }));
                  setInitialData((previous) => ({ ...previous, studyStatus: updated.studyStatus }));
                }} />
                {isDirty && <Typography variant="caption" color="warning.main">Lưu thay đổi hồ sơ trước khi xác nhận học phí.</Typography>}
              </Box>}

              <Box sx={{ gridColumn: { xs: "1fr", sm: "span 2", md: "span 3" }, bgcolor: "#F8FAFC", p: 1.5, borderRadius: "4px", border: "1px solid #E2E8F0" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isExemptForeignLanguage}
                      onChange={(e) => setFormData((p) => ({ ...p, isExemptForeignLanguage: e.target.checked }))}
                      sx={{ color: "#0788B8", "&.Mui-checked": { color: "#0788B8" } }}
                    />
                  }
                  label={<Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Thí sinh được miễn thi môn Ngoại ngữ (Có chứng chỉ quốc tế đạt chuẩn)</Typography>}
                />
              </Box>
            </Box>
          </Paper>

          {/* =================================================================== */}
          {/* SECTION 3: VĂN BẰNG ĐẠI HỌC / NĂNG LỰC ĐẦU VÀO                     */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={sectionCardSx}>
            <Typography sx={sectionTitleSx}>
              <WorkspacePremiumRounded sx={{ color: "#0788B8", fontSize: 20 }} />
              III. Văn bằng đại học & năng lực đầu vào
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 2.5 }}>
              <Box>
                <Typography sx={fieldLabelSx}>Trường tốt nghiệp Đại học</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.gradSchool}
                  onChange={(e) => setFormData((p) => ({ ...p, gradSchool: e.target.value }))}
                  sx={inputSx}
                  placeholder="Trường Đại học Hàng hải Việt Nam"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Chuyên ngành tốt nghiệp ĐH</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.gradMajor}
                  onChange={(e) => setFormData((p) => ({ ...p, gradMajor: e.target.value }))}
                  sx={inputSx}
                  placeholder="Kỹ thuật Điện"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Hệ đào tạo Đại học</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.gradDegreeType}
                  onChange={(e) => setFormData((p) => ({ ...p, gradDegreeType: e.target.value }))}
                  sx={selectSx}
                >
                  {DEGREE_TYPES.map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Năm tốt nghiệp</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.gradYear}
                  onChange={(e) => setFormData((p) => ({ ...p, gradYear: e.target.value }))}
                  sx={inputSx}
                  placeholder="2022"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Điểm TB tích lũy ĐH (GPA)</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.gpa}
                  onChange={(e) => setFormData((p) => ({ ...p, gpa: e.target.value }))}
                  sx={inputSx}
                  placeholder="3.50"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Xếp loại tốt nghiệp</Typography>
                <Select
                  size="small"
                  fullWidth
                  value={formData.gradClassification}
                  onChange={(e) => setFormData((p) => ({ ...p, gradClassification: e.target.value }))}
                  sx={selectSx}
                >
                  {GRAD_CLASSIFICATIONS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Số hiệu văn bằng ĐH</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.diplomaNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, diplomaNumber: e.target.value }))}
                  sx={inputSx}
                  placeholder="A123456"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Số vào sổ cấp bằng gốc</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.registryBookNumber}
                  onChange={(e) => setFormData((p) => ({ ...p, registryBookNumber: e.target.value }))}
                  sx={inputSx}
                  placeholder="0123/2022"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Đơn vị công tác hiện nay</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.workplace}
                  onChange={(e) => setFormData((p) => ({ ...p, workplace: e.target.value }))}
                  sx={inputSx}
                  placeholder="Công ty / Trường học..."
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Nghề nghiệp / Vị trí</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.job}
                  onChange={(e) => setFormData((p) => ({ ...p, job: e.target.value }))}
                  sx={inputSx}
                  placeholder="Kỹ sư / Giảng viên..."
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Đối tượng ưu tiên</Typography>
                <TextField
                  size="small"
                  fullWidth
                  value={formData.priorityObject}
                  onChange={(e) => setFormData((p) => ({ ...p, priorityObject: e.target.value }))}
                  sx={inputSx}
                  placeholder="Không"
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Số môn học bổ sung kiến thức</Typography>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={formData.supplementSubjectsCount}
                  onChange={(e) => setFormData((p) => ({ ...p, supplementSubjectsCount: Number(e.target.value || 0) }))}
                  sx={inputSx}
                  placeholder="0"
                />
              </Box>
            </Box>
          </Paper>

          {/* =================================================================== */}
          {/* SECTION 4: DANH MỤC HỒ SƠ & GIẤY TỜ ĐÍNH KÈM                        */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={sectionCardSx}>
            <Typography sx={sectionTitleSx}>
              <FolderSpecialRounded sx={{ color: "#0788B8", fontSize: 20 }} />
              IV. Danh mục hồ sơ & giấy tờ đính kèm
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }, gap: 1.5, mb: 3 }}>
              {DOCUMENT_ITEMS.map((doc) => {
                const isChecked = Boolean(formData.documents?.[doc.key]);
                return (
                  <Box
                    key={doc.key}
                    sx={{
                      p: 1.2,
                      borderRadius: "4px",
                      border: isChecked ? "1px solid #86EFAC" : "1px solid #E2E8F0",
                      bgcolor: isChecked ? "#F0FDF4" : "#F8FAFC",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setFormData((p) => ({
                              ...p,
                              documents: {
                                ...p.documents,
                                [doc.key]: val,
                              },
                            }));
                          }}
                          sx={{ color: "#0788B8", "&.Mui-checked": { color: "#16A34A" }, py: 0.5 }}
                        />
                      }
                      label={<Typography sx={{ fontSize: 12.5, fontWeight: isChecked ? 700 : 500, color: isChecked ? "#15803D" : "#334155" }}>{doc.label}</Typography>}
                    />
                  </Box>
                );
              })}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography sx={fieldLabelSx}>Ghi chú thêm về hồ sơ</Typography>
              <TextField
                multiline
                rows={3}
                fullWidth
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                sx={inputSx}
                placeholder="Ghi chú thẩm định, giấy tờ còn thiếu hoặc cần bổ sung..."
              />
            </Box>
          </Paper>

          {/* BOTTOM ACTION BAR */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 3, mb: 5 }}>
            <Button
              variant="outlined"
              onClick={handleBackClick}
              sx={{ textTransform: "none", fontWeight: 600, color: "#334155", borderColor: "#CBD5E1", px: 2.5 }}
            >
              Quay lại danh sách
            </Button>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfRounded />}
              onClick={handlePrint}
              sx={{ bgcolor: "#DC2626", textTransform: "none", fontWeight: 700, px: 2.5, "&:hover": { bgcolor: "#B91C1C" } }}
            >
              PDF (Khổ A4)
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRounded />}
              onClick={handleSave}
              disabled={saving || !isDirty}
              sx={{
                bgcolor: isDirty ? "#16A34A" : "#2563EB",
                textTransform: "none",
                fontWeight: 700,
                px: 3,
                "&:hover": { bgcolor: isDirty ? "#15803D" : "#1D4ED8" },
              }}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi (Ctrl+S)"}
            </Button>
          </Box>
          </Box>
        </Box>
      )}

      <Dialog open={transferOpen} onClose={() => !saving && setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chuyển chuyên ngành</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">Mã học viên và toàn bộ lịch sử học tập được giữ nguyên. Hồ sơ sẽ trở về trạng thái nộp hồ sơ, chờ hội đồng xét.</Typography>
          <Select
            fullWidth
            size="small"
            displayEmpty
            value={transferDisciplineId}
            onChange={(e) => {
              setTransferDisciplineId(e.target.value);
              setTransferForm((previous) => ({ ...previous, toMajorId: "" }));
            }}
          >
            <MenuItem value="">Tất cả ngành</MenuItem>
            {disciplines.map((discipline) => (
              <MenuItem key={discipline.id} value={discipline.id}>{disciplineOptionLabel(discipline)}</MenuItem>
            ))}
          </Select>
          <Select fullWidth size="small" displayEmpty value={transferForm.toMajorId} onChange={(e) => setTransferForm((p) => ({ ...p, toMajorId: e.target.value }))}>
            <MenuItem value="">Chọn chuyên ngành mới</MenuItem>
            {visibleTransferMajors.filter((major) => major.id !== record?.majorId).map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
          </Select>
          <TextField label="Lý do chuyển" multiline minRows={3} value={transferForm.reason} onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setTransferOpen(false)}>Hủy</Button><Button variant="contained" onClick={submitTransfer} disabled={saving}>Gửi chờ hội đồng</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(decisionTransfer)} onClose={() => !saving && setDecisionTransfer(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Duyệt chuyển chuyên ngành</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">Chọn CTĐT hoàn chỉnh của chuyên ngành mới. Hệ thống chỉ tự động công nhận các môn đã hoàn thành có cùng học phần gốc.</Typography>
          <Select fullWidth size="small" displayEmpty value={decisionForm.toCurriculumId} onChange={(e) => setDecisionForm((p) => ({ ...p, toCurriculumId: e.target.value }))}>
            <MenuItem value="">Chọn chương trình đào tạo</MenuItem>
            {decisionCurriculums.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
          </Select>
          {decisionCurriculums.length === 0 && <Typography color="error" variant="body2">Chưa có CTĐT phù hợp cho chuyên ngành và khóa này.</Typography>}
          <TextField label="Ghi chú quyết định" multiline minRows={2} value={decisionForm.note} onChange={(e) => setDecisionForm((p) => ({ ...p, note: e.target.value }))} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setDecisionTransfer(null)}>Hủy</Button><Button variant="contained" onClick={submitDecision} disabled={saving || !decisionForm.toCurriculumId}>Duyệt chuyển ngành</Button></DialogActions>
      </Dialog>

      <Dialog open={learningOpen} onClose={() => !learningSaving && setLearningOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLearning ? "Cập nhật kết quả học phần" : "Thêm kết quả học phần cá nhân"}</DialogTitle>
        <DialogContent>
          {learningForm && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Select fullWidth size="small" value={learningForm.catalogType} onChange={(e) => setLearningForm((p) => ({ ...p, catalogType: e.target.value, subjectId: "", bridgeKnowledgeSubjectId: "" }))}>
                <MenuItem value="subject">Học phần CTĐT</MenuItem>
                <MenuItem value="bridge">Học phần bổ sung kiến thức</MenuItem>
              </Select>
              {learningForm.catalogType === "bridge" ? (
                <Select fullWidth size="small" displayEmpty value={learningForm.bridgeKnowledgeSubjectId} onChange={(e) => setLearningForm((p) => ({ ...p, bridgeKnowledgeSubjectId: e.target.value }))}>
                  <MenuItem value="">Chọn học phần bổ sung kiến thức</MenuItem>
                  {bridgeSubjects.map((row) => (
                    <MenuItem key={row.id} value={row.id}>
                      {row.code} — {row.name}{row.equivalentSubject ? ` (tương đương ${subjectLabel(row.equivalentSubject)})` : " (chưa khai báo tương đương)"}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Select fullWidth size="small" displayEmpty value={learningForm.subjectId} onChange={(e) => setLearningForm((p) => ({ ...p, subjectId: e.target.value }))}>
                  <MenuItem value="">Chọn học phần</MenuItem>
                  {subjects.map((row) => <MenuItem key={row.id} value={row.id}>{subjectLabel(row)}</MenuItem>)}
                </Select>
              )}
              <Stack direction="row" spacing={2}>
                <Select fullWidth size="small" value={learningForm.sourceType} onChange={(e) => setLearningForm((p) => ({ ...p, sourceType: e.target.value }))}>
                  {LEARNING_SOURCES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </Select>
                <TextField size="small" fullWidth label="Năm học" value={learningForm.academicYear} onChange={(e) => setLearningForm((p) => ({ ...p, academicYear: e.target.value }))} placeholder="2026" />
              </Stack>
              <Stack direction="row" spacing={2}>
                <Select fullWidth size="small" value={learningForm.status} onChange={(e) => setLearningForm((p) => ({ ...p, status: e.target.value, result: e.target.value === "completed" ? (p.result === "pending" ? "passed" : p.result) : "pending" }))}>
                  {LEARNING_STATUSES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </Select>
                <Select fullWidth size="small" disabled={learningForm.status !== "completed"} value={learningForm.result} onChange={(e) => setLearningForm((p) => ({ ...p, result: e.target.value }))}>
                  {LEARNING_RESULTS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </Select>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField size="small" fullWidth type="number" label="Điểm (0–10)" value={learningForm.score} onChange={(e) => setLearningForm((p) => ({ ...p, score: e.target.value }))} inputProps={{ min: 0, max: 10, step: 0.25 }} />
                <TextField size="small" fullWidth type="date" label="Ngày hoàn thành" InputLabelProps={{ shrink: true }} disabled={learningForm.status !== "completed"} value={learningForm.completedAt} onChange={(e) => setLearningForm((p) => ({ ...p, completedAt: e.target.value }))} />
              </Stack>
              {learningForm.sourceType === "external" && (
                <TextField size="small" fullWidth label="Đơn vị đào tạo" value={learningForm.institution} onChange={(e) => setLearningForm((p) => ({ ...p, institution: e.target.value }))} />
              )}
              <TextField size="small" fullWidth label="Số quyết định / văn bằng" value={learningForm.decisionNo} onChange={(e) => setLearningForm((p) => ({ ...p, decisionNo: e.target.value }))} />
              <TextField label="Ghi chú" multiline minRows={2} value={learningForm.note} onChange={(e) => setLearningForm((p) => ({ ...p, note: e.target.value }))} />
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                Trạng thái <strong>Mới đăng ký</strong> hoặc <strong>Đang học</strong> chỉ được kế thừa đăng ký và tiếp tục học
                trong lớp đang đăng ký, chưa tính tín chỉ công nhận.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLearningOpen(false)} disabled={learningSaving}>Hủy</Button>
          <Button variant="contained" onClick={submitLearningResult} disabled={learningSaving}>{learningSaving ? "Đang lưu..." : "Lưu kết quả"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(decisionRecognition)} onClose={() => !learningSaving && setDecisionRecognition(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{decisionRecognition?.status === "pending" ? "Quyết định công nhận học phần" : "Sửa quyết định công nhận học phần"}</DialogTitle>
        <DialogContent>
          {decisionRecognition && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                {subjectLabel(decisionRecognition.sourceSubject)} → {subjectLabel(decisionRecognition.targetSubject)}
              </Typography>
              <Typography variant="body2" sx={{ color: "#64748B" }}>
                {RECOGNITION_BASIS_LABELS[decisionRecognition.basis] || decisionRecognition.basis}. Quyết định này độc lập,
                không bắt buộc phải gắn với một lần chuyển chuyên ngành.
              </Typography>
              {decisionRecognition.status !== "pending" && (
                <Typography variant="body2" sx={{ color: "#B86216", fontWeight: 600 }}>
                  Quyết định này đã được lưu trước đó
                  {decisionRecognition.decidedAt ? ` (${new Date(decisionRecognition.decidedAt).toLocaleString("vi-VN")})` : ""}.
                  Lưu lần nữa sẽ ghi đè kết quả cũ. Muốn hệ thống đề xuất lại theo dữ liệu mới, hãy dùng nút hủy công nhận.
                </Typography>
              )}
              <Select fullWidth size="small" value={recognitionDecision.decision} onChange={(e) => setRecognitionDecision((p) => ({ ...p, decision: e.target.value }))}>
                <MenuItem value="approved">Công nhận học phần</MenuItem>
                <MenuItem value="rejected">Không công nhận</MenuItem>
              </Select>
              {recognitionDecision.decision === "approved" && (
                <TextField size="small" fullWidth label="Số quyết định công nhận" value={recognitionDecision.decisionNo} onChange={(e) => setRecognitionDecision((p) => ({ ...p, decisionNo: e.target.value }))} />
              )}
              <TextField label="Ghi chú của hội đồng" multiline minRows={2} value={recognitionDecision.note} onChange={(e) => setRecognitionDecision((p) => ({ ...p, note: e.target.value }))} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecisionRecognition(null)} disabled={learningSaving}>Hủy</Button>
          <Button variant="contained" onClick={submitRecognitionDecision} disabled={learningSaving}>Lưu quyết định</Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. HIDDEN PRINT CONTAINER (EXACT 210mm x 297mm A4 TEMPLATE FOR PRINT / PDF)*/}
      {/* ========================================================================= */}
      {formData && (
        <Box className="a4-print-only-container" sx={{ display: "none" }}>
          <Paper
            className="a4-paper-sheet"
            sx={{
              width: "210mm",
              height: "297mm",
              maxHeight: "297mm",
              bgcolor: "#FFFFFF",
              p: "10mm 13mm",
              borderRadius: "1px",
              fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
              color: "#000000",
              lineHeight: 1.35,
              fontSize: "12.5px",
              position: "relative",
              boxSizing: "border-box",
              border: "1.5px solid #173E75",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* Header */}
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
                    Số HS: <strong>{formData.code || "VMU-SDH-000"}</strong>
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
                (Bậc đào tạo: {formData.trainingLevel?.toUpperCase()} - Niên khóa: {formData.academicYear || new Date().getFullYear()})
              </Typography>
            </Box>

            {/* Section I: Personal Info & Photo */}
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
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
                {formData.photo ? (
                  <img src={formData.photo} alt="Ảnh 3x4" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Box sx={{ p: 0.5 }}>
                    <PersonRounded sx={{ fontSize: 24, color: "#94A3B8", mb: 0.3 }} />
                    <Typography sx={{ fontFamily: "inherit", fontSize: "9.5px", fontStyle: "italic", color: "#64748B", lineHeight: 1.15 }}>
                      Ảnh 3x4<br />(Đóng dấu giáp lai)
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                  I. THÔNG TIN CÁ NHÂN & LIÊN LẠC
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                  <div><strong>Họ và tên:</strong> <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{formData.fullName}</span></div>
                  <div><strong>Mã học viên/SBD:</strong> <span>{formData.code || "—"}</span></div>
                  <div><strong>Ngày sinh:</strong> <span>{formData.dob || "—"}</span></div>
                  <div><strong>Giới tính:</strong> <span>{formData.gender || "Nam"}</span></div>
                  <div><strong>Số CMND/CCCD:</strong> <span>{formData.idCard || "—"}</span></div>
                  <div><strong>Nơi sinh:</strong> <span>{formData.pob || "—"}</span></div>
                  <div><strong>Điện thoại:</strong> <span>{formData.phone || "—"}</span></div>
                  <div><strong>Email:</strong> <span>{formData.email || "—"}</span></div>
                  <div><strong>Dân tộc:</strong> <span>{formData.ethnicity || "Kinh"}</span></div>
                  <div><strong>Quốc tịch:</strong> <span>{formData.nationality || "Việt Nam"}</span></div>
                </Box>
                <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
                  <strong>Địa chỉ thường trú / Hộ khẩu:</strong> <span>{[formData.ward, formData.city].filter(Boolean).join(", ") || "—"}</span>
                </div>
              </Box>
            </Box>

            {/* Section II: Training Mode & Program */}
            <Box>
              <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                II. THỂ THỨC & CHƯƠNG TRÌNH ĐÀO TẠO
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                <div><strong>Chuyên ngành đăng ký:</strong> <span style={{ fontWeight: 700 }}>{formData.majorName || "—"}</span></div>
                <div><strong>Trình độ đào tạo:</strong> <span>{formData.trainingLevel || "Thạc sĩ"}</span></div>
                <div><strong>Nhóm hình thức đào tạo:</strong> <span>{formData.trainingModeGroup || "Chính quy"}</span></div>
                <div><strong>Hình thức đào tạo:</strong> <span>{formData.trainingModeName || "Đào tạo thông thường"}</span></div>
                <div><strong>Ngôn ngữ giảng dạy:</strong> <span>{formData.language || "Tiếng Việt"}</span></div>
                <div><strong>Miễn thi môn Ngoại ngữ:</strong> <span>{formData.isExemptForeignLanguage ? "Được miễn thi (Đạt chuẩn chứng chỉ)" : "Không"}</span></div>
                <div><strong>Hình thức nhận hồ sơ:</strong> <span>{formData.receiptType || "Trực tiếp"}</span></div>
                <div><strong>Phân loại hồ sơ:</strong> <span>{formData.profileCategory || "Đầy đủ"}</span></div>
                <div><strong>Trạng thái hồ sơ:</strong> <span>{formData.studyStatus || "Nộp hồ sơ đầu vào"}</span></div>
                <div><strong>Ngày nộp / tiếp nhận:</strong> <span>{formData.admissionDate || "—"}</span></div>
              </Box>
            </Box>

            {/* Section III: Undergraduate Qualifications */}
            <Box>
              <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                III. VĂN BẰNG ĐẠI HỌC / NĂNG LỰC ĐẦU VÀO
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", rowGap: 0.25, fontSize: "12px", lineHeight: 1.3 }}>
                <div><strong>Trường tốt nghiệp ĐH:</strong> <span>{formData.gradSchool || "—"}</span></div>
                <div><strong>Chuyên ngành tốt nghiệp ĐH:</strong> <span>{formData.gradMajor || "—"}</span></div>
                <div><strong>Hệ đào tạo ĐH:</strong> <span>{formData.gradDegreeType || "Chính quy"}</span></div>
                <div><strong>Năm tốt nghiệp:</strong> <span>{formData.gradYear || "—"}</span></div>
                <div><strong>Điểm TB tích lũy ĐH:</strong> <span>{formData.gpa || "—"}</span></div>
                <div><strong>Xếp loại tốt nghiệp:</strong> <span>{formData.gradClassification || "—"}</span></div>
                <div><strong>Số hiệu văn bằng ĐH:</strong> <span>{formData.diplomaNumber || "—"}</span></div>
                <div><strong>Số vào sổ cấp bằng:</strong> <span>{formData.registryBookNumber || "—"}</span></div>
                <div><strong>Đơn vị công tác hiện nay:</strong> <span>{formData.workplace || "—"}</span></div>
                <div><strong>Nghề nghiệp:</strong> <span>{formData.job || "—"}</span></div>
                <div><strong>Đối tượng ưu tiên:</strong> <span>{formData.priorityObject || "Không"}</span></div>
                <div><strong>Số môn học BSKT:</strong> <span>{formData.supplementSubjectsCount || 0} môn</span></div>
              </Box>
              {formData.note && (
                <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.3 }}>
                  <strong>Ghi chú thêm:</strong> <span>{formData.note}</span>
                </div>
              )}
            </Box>

            {/* Section IV: Attached Documents Checklist */}
            <Box>
              <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: "12.5px", mb: 0.3, textTransform: "uppercase", pb: 0.2 }}>
                IV. DANH MỤC HỒ SƠ & GIẤY TỜ ĐÍNH KÈM
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", rowGap: 0.35, columnGap: 1, fontSize: "11.5px", lineHeight: 1.2 }}>
                {DOCUMENT_ITEMS.map((doc) => {
                  const isChecked = Boolean(formData.documents?.[doc.key]);
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

            {/* Section V: Signatures */}
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
                <Typography sx={{ fontFamily: "inherit", fontWeight: 700, textTransform: "uppercase", fontSize: "12px" }}>{formData.fullName}</Typography>
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
          </Paper>
        </Box>
      )}

      {/* ========================================================================= */}
      {/* 4. UNSAVED CHANGES CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <Dialog
        open={showConfirmLeave}
        onClose={() => setShowConfirmLeave(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "6px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#B45309", display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberRounded color="warning" />
          Thay đổi chưa được lưu!
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#334155", lineHeight: 1.5 }}>
            Bạn đang có các thay đổi chưa được lưu lại. Nếu rời khỏi trang bây giờ, mọi dữ liệu vừa nhập sẽ bị mất. Bạn có chắc chắn muốn rời đi?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 1.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setShowConfirmLeave(false)}
            sx={{ textTransform: "none", fontWeight: 600, color: "#334155", borderColor: "#CBD5E1" }}
          >
            Ở lại chỉnh sửa
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setShowConfirmLeave(false);
              navigate(returnPath);
            }}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Rời đi (Không lưu)
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default AdmissionRecordDetail;
