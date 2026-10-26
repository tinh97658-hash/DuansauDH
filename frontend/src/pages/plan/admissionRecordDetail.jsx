import { usePermissions } from "../../features/accounts/usePermissions";
import { formatDateTime } from "../../utils/dateFormat";
import DateField from "../../components/DateField";
import AdmissionEvaluationPanel from "../../features/admission/AdmissionEvaluationPanel";
import { PROFILE_CATEGORIES, profileCategoryLabel } from "../../features/admission/profileCategories";
import AdmissionTuitionCheckbox from "../../features/admission/AdmissionTuitionCheckbox";
import LearnerScorecard from "../../features/learners/LearnerScorecard";
import LearningTables from "../../features/learners/LearningTables";
import StudyLeavePanel from "../../features/learners/StudyLeavePanel";
import { RESULT_LABELS } from "../../features/exams/gradebook";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress,
  Divider, FormControlLabel,
  IconButton, MenuItem, Paper, Select,
  Stack, TextField, Tooltip, Typography, Tabs, Tab,
} from "@mui/material";
import AddPhotoAlternateRounded from "@mui/icons-material/AddPhotoAlternateRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import FolderSpecialRounded from "@mui/icons-material/FolderSpecialRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import SchoolRounded from "@mui/icons-material/SchoolRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import { API_BASE_URL } from "../../config/http";
import { getSelectableMajors, normalizeMajorsResponse, selectMajorForLevel } from "../../utils/majors";
import {
  disciplineOptionLabel, disciplinesFromMajors, majorDisciplineId, majorsForDiscipline,
} from "../../utils/disciplineScope";
import FeatureLayout from "../../components/FeatureLayout";
import DocumentExportMenu from "../../components/DocumentExportMenu";
import AdmissionPrintTemplate from "../../features/admission/AdmissionPrintTemplate";
import { buildAdmissionDocument } from "../../features/admission/admissionDocument";
import AppDialog from "../../components/AppDialog";
import PopupFormField from "../../components/PopupFormField";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getMockConfirmResult } from "../../utils/confirmHelper";
import { useSubjectCatalogRevision } from "../../utils/subjectCatalog";
import { notifyGradebookSaved, useGradebookRevision } from "../../utils/gradebookRevision";
import { downloadAdmissionWord, openAdmissionPreview } from "../../features/admission/admissionDocumentExport";

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


const emptyLearningForm = () => ({
  catalogType: "subject",
  subjectId: "",
  bridgeKnowledgeSubjectId: "",
  sourceType: "pre_masters",
  academicYear: "",
  status: "completed",
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


const STUDY_STATUSES = [
  "Nộp hồ sơ đầu vào",
  "Đủ điều kiện dự tuyển",
  "Đã trúng tuyển",
  "Không trúng tuyển",
  "Đang học",
  "Bảo lưu",
  "Đang bảo lưu",
  "Bảo lưu quá hạn",
  "Thôi học",
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
    profileCategory: profileCategoryLabel(data.profileCategory),
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

const AdmissionRecordDetail = ({ returnPath: defaultReturnPath = "/plan/admission-records" }) => {
  const catalogRevision = useSubjectCatalogRevision();
  const gradebookRevision = useGradebookRevision();
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const fromStudyManagement = defaultReturnPath === "/masters/study-leaves";
  const returnPath = fromStudyManagement && searchParams.get("returnView") === "records"
    ? "/masters/study-leaves?view=records" : defaultReturnPath;
  const [loading, setLoading] = useState(true);
  const profileRequest = useRef(0);
  const [saving, setSaving] = useState(false);
  const { can } = usePermissions();
  const isAdmin = can("admission.manage");
  const [record, setRecord] = useState(null);
  const showStudyTabs = returnPath === "/masters/admitted-records" || fromStudyManagement;
  const requestedTab = searchParams.get("tab");
  const detailTab = (showStudyTabs && ["learning", "grades", "leave"].includes(requestedTab)) || (requestedTab === "admission" && record?.trainingLevel === "Thạc sĩ") ? requestedTab : "profile";
  const changeDetailScope = (key, value) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    setSearchParams(params, { replace: true });
  };
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
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    content: "",
    confirmLabel: "Xác nhận",
    cancelLabel: "Hủy",
    confirmColor: "primary",
    onConfirm: null,
  });

  const requestConfirm = ({ title, content, confirmLabel, cancelLabel, confirmColor, onConfirm }) => {
    const mockResult = getMockConfirmResult(content);
    if (mockResult !== null) {
      if (mockResult && onConfirm) {
        onConfirm();
      }
      return;
    }
    setConfirmState({
      open: true,
      title,
      content,
      confirmLabel: confirmLabel || "Xác nhận",
      cancelLabel: cancelLabel || "Hủy",
      confirmColor: confirmColor || "primary",
      onConfirm,
    });
  };

  // ===== Kết quả học phần cá nhân (tiền thạc sĩ / học trước / chính khóa) =====
  const [learningResults, setLearningResults] = useState([]);
  const [studiedSubjects, setStudiedSubjects] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const displayedRecognitions = recognitions.filter((row) => {
    const learning = row.learningResult || learningResults.find((result) => result.id === row.learningResultId);
    return Boolean(learning?.bridgeKnowledgeSubjectId || learning?.bridgeKnowledgeSubject)
      || ["pre_masters", "early_enrollment", "external"].includes(learning?.sourceType || row.sourceType);
  });
  const approvalRows = [...displayedRecognitions, ...learningResults.filter(row =>
    (["pre_masters", "early_enrollment", "external"].includes(row.sourceType) || row.bridgeKnowledgeSubjectId)
    && !recognitions.some(recognition => recognition.learningResultId === row.id || recognition.learningResult?.id === row.id)
  ).map(row => ({ id: `learning-${row.id}`, learningResultId: row.id, learningResult: row,
    sourceType: row.sourceType, status: "pending", unsubmitted: true }))];
  const approvalLearningIds = new Set(approvalRows.flatMap(row => [row.learningResultId, row.learningResult?.id]).filter(Boolean));
  // A prior-learning decision is separate evidence from a regular exam result.
  const visibleStudiedSubjects = studiedSubjects.filter(row => row.sourceType === "regular"
    || !approvalLearningIds.has(row.id));
  // Approved prior learning also belongs in the completed curriculum summary.
  for (const recognition of displayedRecognitions) {
    const learning = recognition.learningResult
      || learningResults.find(row => row.id === recognition.learningResultId);
    const subject = recognition.targetSubject;
    if (recognition.status !== "approved" || !subject?.id
      || learning?.status !== "completed" || !["passed", "exempt"].includes(learning.result)) continue;
    if (visibleStudiedSubjects.some(row => (row.subject?.id || row.subjectId) === subject.id)) continue;
    visibleStudiedSubjects.push({ ...learning, id: `recognition-${recognition.id}`, subject, subjectId: subject.id,
      sourceType: learning.sourceType || recognition.sourceType });
  }
  const [recognizedCredits, setRecognizedCredits] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [bridgeSubjects, setBridgeSubjects] = useState([]);
  const [learningOpen, setLearningOpen] = useState(false);
  const [editingLearning, setEditingLearning] = useState(null);
  const [learningForm, setLearningForm] = useState(null);
  const [learningSaving, setLearningSaving] = useState(false);
  const [learningLoading, setLearningLoading] = useState(true);
  const [learningError, setLearningError] = useState('');

  const { availableSubjects, availableBridgeSubjects } = useMemo(() => {
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const rootId = (subjectId, subject) => subject?.canonicalSubjectId || subjectById.get(subjectId)?.canonicalSubjectId || subjectId;
    const completedRows = [...studiedSubjects, ...learningResults.filter((row) => ["passed", "failed", "exempt"].includes(row.result))];
    const completedSubjects = new Set();
    const completedBridgeSubjects = new Set();
    completedRows.forEach((row) => {
      const subjectId = row.subjectId || row.subject?.id;
      if (subjectId) completedSubjects.add(rootId(subjectId, row.subject));
      const bridgeId = row.bridgeKnowledgeSubjectId || row.bridgeKnowledgeSubject?.id;
      if (bridgeId) completedBridgeSubjects.add(bridgeId);
    });
    return {
      availableSubjects: subjects.filter((subject) => subject.id === (editingLearning?.subjectId || editingLearning?.subject?.id)
        || !completedSubjects.has(rootId(subject.id, subject))),
      availableBridgeSubjects: bridgeSubjects.filter((subject) => subject.id === (editingLearning?.bridgeKnowledgeSubjectId || editingLearning?.bridgeKnowledgeSubject?.id)
        || !completedBridgeSubjects.has(subject.id)),
    };
  }, [subjects, bridgeSubjects, studiedSubjects, learningResults, editingLearning]);

  useEffect(() => {
    if (!learningOpen || !learningForm) return;
    const key = learningForm.catalogType === "bridge" ? "bridgeKnowledgeSubjectId" : "subjectId";
    const options = learningForm.catalogType === "bridge" ? availableBridgeSubjects : availableSubjects;
    if (learningForm[key] && !options.some((subject) => subject.id === learningForm[key])) {
      setLearningForm((previous) => ({ ...previous, [key]: "" }));
    }
  }, [learningOpen, learningForm, availableSubjects, availableBridgeSubjects]);

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
    const request = ++profileRequest.current;
    setLoading(true);
    try {
      const [resRec, resMajors, resTransfers] = await Promise.all([
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/system/majors`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/admission-records/${id}/major-transfers`, { withCredentials: true }),
      ]);
      if (request !== profileRequest.current) return;

      const data = resRec.data;
      const majorList = normalizeMajorsResponse(resMajors.data);
      setRecord(data);
      setMajors(majorList);
      setTransferHistory(Array.isArray(resTransfers.data) ? resTransfers.data : []);

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
      if (request === profileRequest.current) toast.error(err.response?.data?.message || "Không thể tải chi tiết hồ sơ tuyển sinh");
    } finally {
      if (request === profileRequest.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    return () => { profileRequest.current += 1; };
  }, [fetchData]);



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
    if (!/^[0-9]{10}$/.test(formData.phone || "")) {
      toast.error("Số điện thoại bắt buộc gồm đúng 10 chữ số");
      return;
    }
    if (!/^[0-9]{13}$/.test(formData.idCard || "")) {
      toast.error("CCCD bắt buộc gồm đúng 13 chữ số");
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
      notifyGradebookSaved("profile");

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

  const documentActions = {
    disabled: loading || saving || !formData,
    onWord: () => downloadAdmissionWord(buildAdmissionDocument(formData)),
    onPdf: () => openAdmissionPreview(buildAdmissionDocument(formData)),
    onError: (error) => toast.error(error.message || "Không thể xuất hồ sơ. Vui lòng thử lại."),
  };

  const submitTransfer = async () => {
    if (!transferForm.toMajorId) return toast.error("Vui lòng chọn chuyên ngành mới.");
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/major-transfers`, transferForm, { withCredentials: true });
      toast.success("Đã gửi yêu cầu chuyển chuyên ngành, chờ xử lý.");
      setTransferOpen(false);
      setTransferForm({ toMajorId: "", reason: "" });
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lập yêu cầu chuyển chuyên ngành.");
    } finally { setSaving(false); }
  };

  const openDecision = async (transfer, decision) => {
    if (decision === "rejected") {
      const executeReject = async () => {
        setSaving(true);
        try {
          await axios.put(`${API_BASE_URL}/plan/major-transfers/${transfer.id}/decision`, { decision: "rejected" }, { withCredentials: true });
          toast.success("Đã từ chối và khôi phục thông tin trước khi chuyển ngành.");
          await fetchData();
        } catch (err) { toast.error(err.response?.data?.message || "Không thể xử lý yêu cầu."); }
        finally { setSaving(false); }
      };

      requestConfirm({
        title: "Từ chối yêu cầu chuyển chuyên ngành",
        content: "Từ chối yêu cầu và khôi phục chuyên ngành, lớp cùng trạng thái cũ của học viên?",
        confirmLabel: "Từ chối",
        confirmColor: "error",
        onConfirm: executeReject,
      });
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
        status: "completed",
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

  const reloadRecognitionData = useCallback(async (signal) => {
    const options = { withCredentials: true, ...(signal ? { signal } : {}) };
    const [resResults, resRecognitions, resCredits, resStudied] = await Promise.all([
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/learning-results`, options),
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/subject-recognitions`, options),
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/recognized-credits`, options),
      axios.get(`${API_BASE_URL}/plan/admission-records/${id}/studied-subjects`, options),
    ]);
    if (signal?.aborted) return;
    setLearningResults(Array.isArray(resResults.data) ? resResults.data : []);
    setStudiedSubjects(Array.isArray(resStudied.data) ? resStudied.data : []);
    setRecognitions(Array.isArray(resRecognitions.data) ? resRecognitions.data : []);
    setRecognizedCredits(Number(resCredits.data?.credits ?? resCredits.data ?? 0) || 0);
  }, [id]);

  useEffect(() => {
    if (detailTab !== 'learning' || record?.id !== id) return;
    const controller = new AbortController();
    const options = { withCredentials: true, signal: controller.signal };
    setLearningLoading(true); setLearningError('');
    Promise.all([
      reloadRecognitionData(controller.signal),
      axios.get(`${API_BASE_URL}/system/bridge-knowledge`, options),
      record.majorId ? axios.get(`${API_BASE_URL}/plan/subjects?majorId=${record.majorId}&program=${record.trainingLevel === "Tiến sĩ" ? "doctoral" : "masters"}&includeCommon=true`, options) : Promise.resolve({ data: [] }),
    ]).then(([, bridge, catalog]) => {
      if (controller.signal.aborted) return;
      setBridgeSubjects(Array.isArray(bridge.data) ? bridge.data : []);
      setSubjects(Array.isArray(catalog.data) ? catalog.data : []);
    }).catch(error => {
      if (!controller.signal.aborted) setLearningError(error.response?.data?.message || 'Không thể tải dữ liệu học tập. Vui lòng mở lại tab để thử lại.');
    }).finally(() => { if (!controller.signal.aborted) setLearningLoading(false); });
    return () => controller.abort();
  }, [detailTab, id, record?.id, record?.majorId, record?.trainingLevel, catalogRevision, gradebookRevision, reloadRecognitionData]);

  const submitLearningResult = async () => {
    if (!learningForm) return;
    const isBridge = learningForm.catalogType === "bridge";
    if (isBridge && !learningForm.bridgeKnowledgeSubjectId) return toast.error("Vui lòng chọn học phần bổ sung kiến thức.");
    if (!isBridge && !learningForm.subjectId) return toast.error("Vui lòng chọn học phần.");
    const options = isBridge ? availableBridgeSubjects : availableSubjects;
    const selectedId = isBridge ? learningForm.bridgeKnowledgeSubjectId : learningForm.subjectId;
    if (!options.some((subject) => subject.id === selectedId)) {
      return toast.error("Học phần này đã có kết quả. Vui lòng chọn học phần khác.");
    }
    if (learningForm.score === "" || !Number.isFinite(Number(learningForm.score)) || Number(learningForm.score) < 0 || Number(learningForm.score) > 10) {
      return toast.error("Vui lòng nhập điểm học phần từ 0 đến 10.");
    }
    if (learningForm.status === "completed" && !learningForm.completedAt) {
      return toast.error("Kết quả đã hoàn thành phải có ngày hoàn thành.");
    }
    if (learningForm.sourceType !== "regular") {
      if (learningForm.status !== "completed" && learningForm.score !== "") {
        return toast.error("Đã nhập điểm: vui lòng chọn trạng thái Đã hoàn thành, kết quả và ngày hoàn thành.");
      }
      if (learningForm.status === "completed" && learningForm.result === "pending") {
        return toast.error("Vui lòng chọn Đạt, Không đạt hoặc Miễn học cho học phần đã hoàn thành.");
      }
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
        toast.success(learningForm.status === "completed" ? "Đã cập nhật kết quả học phần." : "Đã lưu đăng ký học phần; chưa đủ điều kiện công nhận.");
      } else {
        await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/learning-results`, payload, { withCredentials: true });
        toast.success(learningForm.status === "completed" ? "Đã lưu kết quả học phần cá nhân." : "Đã lưu đăng ký học phần; chưa đủ điều kiện công nhận.");
      }
      setLearningOpen(false);
      setEditingLearning(null);
      await reloadRecognitionData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể lưu kết quả học phần.");
    } finally { setLearningSaving(false); }
  };

  const submitPendingLearning = async (row, decision) => {
    const learning = row.learningResult || learningResults.find(item => item.id === row.learningResultId);
    if (decision === "approved" && (learning?.status !== "completed" || !["passed", "exempt"].includes(learning?.result))) {
      toast.info("Cập nhật trạng thái Đã hoàn thành và kết quả Đạt hoặc Miễn học trước khi duyệt.");
      if (learning) openLearningDialog(learning, { complete: true });
      return;
    }
    setLearningSaving(true);
    try {
      let proposal = row;
      if (row.unsubmitted) {
        const { data } = await axios.post(`${API_BASE_URL}/plan/admission-records/${id}/subject-recognitions/propose`, { requireReview: true }, { withCredentials: true });
        proposal = (data.recognitions || []).find(item => item.learningResultId === learning.id || item.learningResult?.id === learning.id);
      }
      if (!proposal) {
        toast.error("Chưa tìm thấy học phần tương đương trong CTĐT để xử lý công nhận.");
        return;
      }
      await persistRecognitionDecision(proposal, { decision, decisionNo: proposal.decisionNo || "", note: proposal.note || "" });
      toast.success(decision === "approved" ? "Đã duyệt công nhận học phần." : "Đã từ chối công nhận học phần.");
    } catch (err) { toast.error(err.response?.data?.message || "Không thể lưu quyết định công nhận."); }
    finally { setLearningSaving(false); }
  };

  const persistRecognitionDecision = async (row, values) => {
    const { data } = await axios.put(`${API_BASE_URL}/plan/subject-recognitions/${row.id}/decision`, values, { withCredentials: true });
    const updated = { ...row, ...data, status: data?.status || values.decision, unsubmitted: false };
    const showSavedDecision = () => setRecognitions(current => current.some(item => item.id === updated.id)
      ? current.map(item => item.id === updated.id ? { ...item, ...updated } : item)
      : [...current, updated]);
    showSavedDecision();
    try { await reloadRecognitionData(); }
    catch { toast.info("Quyết định đã lưu. Chưa tải lại được toàn bộ thông tin học tập."); }
    // Preserve the confirmed save even if a refresh returns an older snapshot.
    showSavedDecision();
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
      desc="Chỉnh sửa toàn bộ thông tin hồ sơ tuyển sinh trực tiếp trên một trang và xuất Word hoặc PDF khổ A4."
      maxWidth={1260}
    >
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />

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
            <span><IconButton size="small" onClick={fetchData} disabled={loading} sx={{ border: "1px solid #DFE4E8", borderRadius: "4px", p: "6px" }}>
              <RefreshRounded fontSize="small" sx={{ color: "#607486" }} />
            </IconButton></span>
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

          <DocumentExportMenu {...documentActions} />

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
            <Tabs value={detailTab} onChange={(_, value) => changeDetailScope("tab", value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 2, bgcolor: "white", border: "1px solid #DFE4E8", borderRadius: 1 }}>
              <Tab value="profile" label="Thông tin hồ sơ" />
              {record.trainingLevel === "Thạc sĩ" && <Tab value="admission" label="Xét tuyển" />}
              {showStudyTabs && <Tab value="learning" label="Học tập" />}
              {showStudyTabs && <Tab value="grades" label="Bảng điểm" />}
              {showStudyTabs && <Tab value="leave" label="Bảo lưu" />}
            </Tabs>
            {detailTab === "admission" && <AdmissionEvaluationPanel record={record} isAdmin={isAdmin} disabled={isDirty || saving} onBusyChange={setSaving} onDecided={fetchData} />}
            {detailTab === "grades" && <LearnerScorecard admissionRecordId={id} classGroupId={searchParams.get("classGroupId")} onClassChange={value => changeDetailScope("classGroupId", value)} />}
            {detailTab === "leave" && <StudyLeavePanel record={record} isAdmin={isAdmin} disabled={isDirty || saving} onChanged={fetchData} />}
          <Box sx={{ display: detailTab === "profile" ? "block" : "none" }}>
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
                      {formatDateTime(item.requestedAt)} · Mã học viên được giữ nguyên: {record?.code || "—"}
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
          </Box>

          <Box role="tabpanel" aria-label="Học tập" hidden={detailTab !== "learning"}>

          {/* =================================================================== */}
          {/* SECTION 0B: KẾT QUẢ HỌC PHẦN CÁ NHÂN & CÔNG NHẬN                    */}
          {/* =================================================================== */}
          <Paper variant="outlined" sx={{ ...sectionCardSx, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              <Typography sx={{ ...sectionTitleSx, mb: 0 }}>
                <MenuBookRounded sx={{ color: "#0788B8", fontSize: 20 }} />
                Học phần đã học trong chương trình đào tạo ({visibleStudiedSubjects.length})
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" color="success" variant="outlined" label={`Đã tích lũy: ${recognizedCredits} tín chỉ`} />
                <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => openLearningDialog(null)} disabled={learningSaving || learningLoading || !!learningError}>
                  Thêm kết quả học phần
                </Button>
              </Stack>
            </Stack>
            <Typography sx={{ fontSize: 12, color: "#64748B", mb: 1.5 }}>
              Hiển thị các học phần đã có kết quả trong chương trình đào tạo hiện tại.
              Học phần đã được duyệt công nhận có kết quả Đạt hoặc Miễn học cũng hiển thị tại đây. Chi tiết quyết định ở bảng bên dưới; kết quả chính khóa của cùng học phần được giữ nguyên.
            </Typography>

            {learningLoading ? <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 3 }}><CircularProgress size={22} />Đang tải dữ liệu học tập...</Box> : learningError ? <Alert severity="error">{learningError}</Alert> : <LearningTables studied={visibleStudiedSubjects} approvals={approvalRows} learningResults={learningResults}
              sourceLabel={value => LEARNING_SOURCES.find(item => item.value === value)?.label || value || "—"}
              statusLabel={value => LEARNING_STATUSES.find(item => item.value === value)?.label || value}
              resultLabel={value => RESULT_LABELS[value] || RESULT_LABELS.pending} subjectLabel={subjectLabel}
              onEdit={openLearningDialog}
              onSubmitDecision={submitPendingLearning} busy={learningSaving} />}
          </Paper>
          </Box>

          <Box sx={{ display: detailTab === "profile" ? "block" : "none" }}>

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
                  <DateField
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
                    onChange={(e) => setFormData((p) => ({ ...p, idCard: e.target.value.replace(/[^0-9]/g, "").slice(0, 13) }))}
                    required
                    inputProps={{ inputMode: "numeric", maxLength: 13, pattern: "[0-9]{13}", "aria-label": "CCCD" }}
                    error={Boolean(formData.idCard) && !/^[0-9]{13}$/.test(formData.idCard)}
                    sx={inputSx}
                    placeholder="0312000000000"
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
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) }))}
                    required
                    inputProps={{ inputMode: "numeric", maxLength: 10, pattern: "[0-9]{10}", "aria-label": "Số điện thoại" }}
                    error={Boolean(formData.phone) && !/^[0-9]{10}$/.test(formData.phone)}
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
                <Typography component="label" id="admission-detail-category-label" sx={fieldLabelSx}>Phân loại hồ sơ</Typography>
                <Select
                  labelId="admission-detail-category-label"
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
                    <MenuItem key={s} value={s} disabled={(["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học"].includes(s)
                      || ["Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học"].includes(record.studyStatus)
                      || (formData.trainingLevel === "Thạc sĩ" && ["Đã trúng tuyển", "Không trúng tuyển", "Đang học"].includes(s))) && s !== record.studyStatus}>{s}</MenuItem>
                  ))}
                </Select>
                {formData.trainingLevel === "Thạc sĩ" && <Typography variant="caption" color="text.secondary">Duyệt trúng tuyển tại mục Điểm xét tuyển. Xác nhận đã nộp học phí nhập học mới chuyển sang Đang học; chưa đóng tiền muốn nghỉ thì rút hồ sơ để trở về Nộp hồ sơ đầu vào.</Typography>}
              </Box>

              <Box>
                <Typography component="label" htmlFor="admission-detail-year" sx={fieldLabelSx}>Năm nhập học</Typography>
                <TextField
                  id="admission-detail-year"
                  size="small"
                  fullWidth
                  value={formData.academicYear}
                  InputProps={{ readOnly: true }}
                  sx={inputSx}
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>Ngày nộp / Tiếp nhận</Typography>
                <DateField
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
            <DocumentExportMenu {...documentActions} />
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

      <AppDialog
        open={transferOpen}
        onClose={() => !saving && setTransferOpen(false)}
        maxWidth="sm"
        title="Chuyển chuyên ngành"
        confirmText="Gửi chờ hội đồng"
        cancelText="Hủy"
        onConfirm={submitTransfer}
        confirmDisabled={saving}
        saving={saving}
      >
        <Stack spacing={2}>
          <Typography variant="body2">Mã học viên và toàn bộ lịch sử học tập được giữ nguyên. Sau khi yêu cầu được duyệt, hồ sơ sẽ trở về trạng thái nộp hồ sơ, chờ hội đồng xét.</Typography>
          <PopupFormField label="Ngành" htmlFor="transfer-discipline">
          <Select
            id="transfer-discipline"
            inputProps={{ "aria-label": "Ngành" }}
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
          </PopupFormField>
          <PopupFormField label="Chuyên ngành mới" htmlFor="transfer-major">
          <Select id="transfer-major" inputProps={{ "aria-label": "Chuyên ngành mới" }} fullWidth size="small" displayEmpty value={transferForm.toMajorId} onChange={(e) => setTransferForm((p) => ({ ...p, toMajorId: e.target.value }))}>
            <MenuItem value="">Chọn chuyên ngành mới</MenuItem>
            {visibleTransferMajors.filter((major) => major.id !== record?.majorId).map((major) => <MenuItem key={major.id} value={major.id}>{major.name}</MenuItem>)}
          </Select>
          </PopupFormField>
          <PopupFormField label="Lý do chuyển" htmlFor="transfer-reason">
            <TextField id="transfer-reason" fullWidth placeholder="Nhập lý do chuyển chuyên ngành..." multiline minRows={3} value={transferForm.reason} onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))} />
          </PopupFormField>
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(decisionTransfer)}
        onClose={() => !saving && setDecisionTransfer(null)}
        maxWidth="sm"
        title="Duyệt chuyển chuyên ngành"
        confirmText="Duyệt chuyển ngành"
        cancelText="Hủy"
        onConfirm={submitDecision}
        confirmDisabled={saving || !decisionForm.toCurriculumId}
        saving={saving}
      >
        <Stack spacing={2}>
          <Typography variant="body2">Chọn CTĐT hoàn chỉnh của chuyên ngành mới. Hệ thống chỉ tự động công nhận các môn đã hoàn thành có cùng học phần gốc.</Typography>
          <PopupFormField label="Chương trình đào tạo mới" htmlFor="transfer-curriculum">
          <Select id="transfer-curriculum" inputProps={{ "aria-label": "Chương trình đào tạo mới" }} fullWidth size="small" displayEmpty value={decisionForm.toCurriculumId} onChange={(e) => setDecisionForm((p) => ({ ...p, toCurriculumId: e.target.value }))}>
            <MenuItem value="">Chọn chương trình đào tạo</MenuItem>
            {decisionCurriculums.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
          </Select>
          </PopupFormField>
          {decisionCurriculums.length === 0 && <Typography color="error" variant="body2">Chưa có CTĐT phù hợp cho chuyên ngành và khóa này.</Typography>}
          <PopupFormField label="Ghi chú quyết định" htmlFor="transfer-decision-note">
            <TextField id="transfer-decision-note" fullWidth multiline minRows={2} value={decisionForm.note} onChange={(e) => setDecisionForm((p) => ({ ...p, note: e.target.value }))} />
          </PopupFormField>
        </Stack>
      </AppDialog>

      <AppDialog
        open={learningOpen}
        onClose={() => !learningSaving && setLearningOpen(false)}
        maxWidth="sm"
        title={editingLearning ? "Cập nhật kết quả học phần" : "Thêm kết quả học phần cá nhân"}
        confirmText={learningSaving ? "Đang lưu..." : "Lưu kết quả"}
        cancelText="Hủy"
        onConfirm={submitLearningResult}
        confirmDisabled={learningSaving}
        saving={learningSaving}
      >
        {learningForm && (
          <Stack spacing={2}>
            {learningForm.sourceType !== "regular" && <Alert severity="info">
              Để được duyệt công nhận, chọn Đã hoàn thành, kết quả Đạt hoặc Miễn học và ngày hoàn thành.
              Lưu kết quả, sau đó bấm Duyệt trong bảng.
            </Alert>}
            <PopupFormField label="Loại học phần" htmlFor="learning-catalog-type">
            <Select id="learning-catalog-type" inputProps={{ "aria-label": "Loại học phần" }} fullWidth size="small" value={learningForm.catalogType} onChange={(e) => setLearningForm((p) => ({ ...p, catalogType: e.target.value, subjectId: "", bridgeKnowledgeSubjectId: "" }))}>
              <MenuItem value="subject">Học phần CTĐT</MenuItem>
              <MenuItem value="bridge">Học phần bổ sung kiến thức</MenuItem>
            </Select>
            </PopupFormField>
            <PopupFormField label="Học phần" htmlFor="learning-subject">
            {learningForm.catalogType === "bridge" ? (
              <Select id="learning-subject" inputProps={{ "aria-label": "Học phần" }} fullWidth size="small" displayEmpty value={learningForm.bridgeKnowledgeSubjectId} onChange={(e) => setLearningForm((p) => ({ ...p, bridgeKnowledgeSubjectId: e.target.value }))}>
                <MenuItem value="">Chọn học phần bổ sung kiến thức</MenuItem>
                {availableBridgeSubjects.map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {row.code} — {row.name}{row.equivalentSubject ? ` (tương đương ${subjectLabel(row.equivalentSubject)})` : " (chưa khai báo tương đương)"}
                  </MenuItem>
                ))}
                {!availableBridgeSubjects.length && <MenuItem disabled>Không còn học phần chưa có kết quả.</MenuItem>}
              </Select>
            ) : (
              <Select id="learning-subject" inputProps={{ "aria-label": "Học phần" }} fullWidth size="small" displayEmpty value={learningForm.subjectId} onChange={(e) => setLearningForm((p) => ({ ...p, subjectId: e.target.value }))}>
                <MenuItem value="">Chọn học phần</MenuItem>
                {availableSubjects.map((row) => <MenuItem key={row.id} value={row.id}>{subjectLabel(row)}</MenuItem>)}
                {!availableSubjects.length && <MenuItem disabled>Không còn học phần chưa có kết quả.</MenuItem>}
              </Select>
            )}
            </PopupFormField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <PopupFormField label="Nguồn học phần" htmlFor="learning-source">
              <Select id="learning-source" inputProps={{ "aria-label": "Nguồn học phần" }} fullWidth size="small" value={learningForm.sourceType} onChange={(e) => setLearningForm((p) => ({ ...p, sourceType: e.target.value }))}>
                {LEARNING_SOURCES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </Select>
              </PopupFormField>
              <PopupFormField label="Năm học" htmlFor="learning-year">
                <TextField id="learning-year" size="small" fullWidth value={learningForm.academicYear} onChange={(e) => setLearningForm((p) => ({ ...p, academicYear: e.target.value }))} placeholder="2026" />
              </PopupFormField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <PopupFormField label="Trạng thái" htmlFor="learning-status">
              <TextField id="learning-status" inputProps={{ "aria-label": "Trạng thái", readOnly: true }} fullWidth size="small" value="Đã hoàn thành" />
              </PopupFormField>
              <PopupFormField label="Kết quả" htmlFor="learning-result">
              <Select id="learning-result" inputProps={{ "aria-label": "Kết quả" }} fullWidth size="small"
                disabled={learningForm.sourceType === "regular" || learningForm.status !== "completed"}
                required={learningForm.sourceType !== "regular" && learningForm.status === "completed"}
                value={learningForm.result} onChange={event => setLearningForm(previous => ({ ...previous, result: event.target.value }))}>
                {LEARNING_RESULTS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </Select>
              {learningForm.sourceType !== "regular" && learningForm.status === "completed" && <Typography variant="caption" color="text.secondary">
                Chọn kết quả theo hồ sơ học phần; nhập điểm chưa thay thế bước này.
              </Typography>}
              </PopupFormField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <PopupFormField label="Điểm (0–10)" htmlFor="learning-score">
                <TextField id="learning-score" size="small" fullWidth type="number" required value={learningForm.score} onChange={(e) => setLearningForm((p) => ({ ...p, score: e.target.value }))} inputProps={{ min: 0, max: 10, step: 0.25 }} />
              </PopupFormField>
              <PopupFormField label="Ngày hoàn thành" htmlFor="learning-completed-at">
                <DateField id="learning-completed-at" size="small" fullWidth disabled={learningForm.status !== "completed"}
                  required={learningForm.status === "completed"} helperText={learningForm.status === "completed" ? "Bắt buộc nhập ngày hoàn thành học phần." : undefined}
                  value={learningForm.completedAt} onChange={(e) => setLearningForm((p) => ({ ...p, completedAt: e.target.value }))} />
              </PopupFormField>
            </Stack>
            {learningForm.sourceType === "external" && (
              <PopupFormField label="Đơn vị đào tạo" htmlFor="learning-institution">
                <TextField id="learning-institution" size="small" fullWidth value={learningForm.institution} onChange={(e) => setLearningForm((p) => ({ ...p, institution: e.target.value }))} />
              </PopupFormField>
            )}
            <PopupFormField label="Số quyết định / văn bằng" htmlFor="learning-decision-no">
              <TextField id="learning-decision-no" size="small" fullWidth value={learningForm.decisionNo} onChange={(e) => setLearningForm((p) => ({ ...p, decisionNo: e.target.value }))} />
            </PopupFormField>
            <PopupFormField label="Ghi chú" htmlFor="learning-note">
              <TextField id="learning-note" fullWidth placeholder="Nhập ghi chú nếu cần..." multiline minRows={2} value={learningForm.note} onChange={(e) => setLearningForm((p) => ({ ...p, note: e.target.value }))} />
            </PopupFormField>
          </Stack>
        )}
      </AppDialog>



      {/* ========================================================================= */}
      {/* 3. HIDDEN PRINT CONTAINER (EXACT 210mm x 297mm A4 TEMPLATE FOR PRINT / PDF)*/}
      {/* ========================================================================= */}
      {formData && <div className="a4-print-only-container" style={{ display: "none" }}>
        <AdmissionPrintTemplate document={buildAdmissionDocument(formData)} />
      </div>}

      {/* ========================================================================= */}
      {/* 4. UNSAVED CHANGES CONFIRMATION DIALOG                                    */}
      {/* ========================================================================= */}
      <ConfirmDialog
        open={showConfirmLeave}
        onClose={() => setShowConfirmLeave(false)}
        onConfirm={() => {
          setShowConfirmLeave(false);
          navigate(returnPath);
        }}
        title="Thay đổi chưa được lưu!"
        content="Bạn đang có các thay đổi chưa được lưu lại. Nếu rời khỏi trang bây giờ, mọi dữ liệu vừa nhập sẽ bị mất. Bạn có chắc chắn muốn rời đi?"
        confirmLabel="Rời đi (Không lưu)"
        cancelLabel="Ở lại chỉnh sửa"
        confirmColor="error"
      />

      <ConfirmDialog
        open={confirmState.open}
        onClose={() => setConfirmState((s) => ({ ...s, open: false }))}
        onConfirm={() => {
          const action = confirmState.onConfirm;
          setConfirmState((s) => ({ ...s, open: false }));
          if (action) action();
        }}
        title={confirmState.title}
        content={confirmState.content}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        confirmColor={confirmState.confirmColor}
      />
    </FeatureLayout>
  );
};

export default AdmissionRecordDetail;
