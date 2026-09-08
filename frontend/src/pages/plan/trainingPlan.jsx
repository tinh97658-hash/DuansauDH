import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControl, FormControlLabel,
  IconButton, InputAdornment, MenuItem, Paper, Select, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, CheckBoxOutlineBlankRounded, CheckBoxRounded, CheckRounded,
  CloseRounded, DeleteRounded, EditRounded, LibraryBooksRounded, RefreshRounded,
  SaveRounded, SearchRounded, ClassRounded, StarRounded, StarOutlineRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import TeachingLoadFields, { teachingLoadPayload } from "../../components/TeachingLoadFields";
import SubjectIdentityFields, {
  buildSubjectIdentityPayload,
  emptySubjectIdentity,
  normalizeSubjectIdentity,
} from "../../components/SubjectIdentityFields";

const SUBJECT_TYPES = [
  { value: "CS", label: "Cơ sở (CS)", color: "#0788B8" },
  { value: "CN", label: "Chuyên ngành (CN)", color: "#137B3B" },
  { value: "TC", label: "Tự chọn (TC)", color: "#B86216" },
  { value: "CH", label: "Chuyên đề (CH)", color: "#68737D" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const LEVELS = [
  { value: "masters", label: "Thạc sĩ" },
  { value: "doctoral", label: "Tiến sĩ" },
];

const initialSubjectDraft = (nextSortOrder = 1) => ({
  codeNumber: "",
  codeText: "",
  name: "",
  credits: 3,
  majorAssignment: false,
  subjectType: "CN",
  isRequired: true,
  sortOrder: nextSortOrder,
  active: true,
  ...emptySubjectIdentity(),
});

const initialClassDraft = (year) => ({
  code: "",
  name: "",
  academicYear: year,
  term: "HK1",
  note: "",
});

const initialPkgDraft = () => ({
  code: "",
  name: "",
});

const cellInputSx = {
  "& .MuiInputBase-root": {
    height: 32,
    fontSize: 13,
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

const TrainingPlan = () => {
  // Global Filters
  const [majors, setMajors] = useState([]);
  const [year, setYear] = useState(String(currentYear));
  const [level, setLevel] = useState("masters");
  const [majorId, setMajorId] = useState("");
  const [tab, setTab] = useState(0); // 0: Học phần chuyên ngành, 1: Lớp học & Gói học phần
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [packages, setPackages] = useState([]);

  // Subject Table State (Excel-like)
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectTypeFilter, setSubjectTypeFilter] = useState("ALL");
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(initialSubjectDraft(1));
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectForm, setEditingSubjectForm] = useState(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState(null);
  const [programSubjects, setProgramSubjects] = useState([]);
  const [programSubjectsLoading, setProgramSubjectsLoading] = useState(false);
  const [programSubjectsError, setProgramSubjectsError] = useState("");
  const firstDraftInputRef = useRef(null);

  // Class Table State (Excel-like)
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [classDraft, setClassDraft] = useState(initialClassDraft(String(currentYear)));
  const [editingClassId, setEditingClassId] = useState(null);
  const [editingClassForm, setEditingClassForm] = useState(null);
  const [deletingClassId, setDeletingClassId] = useState(null);

  // Package State
  const [isAddingPkg, setIsAddingPkg] = useState(false);
  const [pkgDraft, setPkgDraft] = useState(initialPkgDraft());
  const [editingPkgId, setEditingPkgId] = useState(null);
  const [editingPkgForm, setEditingPkgForm] = useState(null);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Load Majors
  const loadMajors = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/training-plan?program=${level}`, { withCredentials: true });
      const list = Array.isArray(data) ? data : data.data || [];
      setMajors(list);
      if (list.length > 0) {
        if (!majorId || !list.some((m) => m.id === majorId)) {
          setMajorId(list[0].id);
        }
      } else {
        setMajorId("");
        setSubjects([]);
        setClasses([]);
        setClassId("");
        setPackages([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải danh sách chuyên ngành");
    }
  }, [majorId, level]);

  useEffect(() => {
    loadMajors();
  }, [loadMajors]);

  // Auth Check
  useEffect(() => {
    let mounted = true;
    axios.get(`${API_BASE_URL}/auth/isStaff`, { withCredentials: true })
      .then(({ data }) => mounted && setIsAdmin(data.message === "admin"))
      .catch(() => mounted && setIsAdmin(false));
    return () => { mounted = false; };
  }, []);

  // Load Subjects and Classes when major/level/year changes
  const loadData = useCallback(async () => {
    if (!majorId) return;
    setLoading(true);
    try {
      const [subjectsRes, classesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/plan/subjects?majorId=${majorId}&program=${level}`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/classes?majorId=${majorId}&program=${level}&year=${year}`, { withCredentials: true }),
      ]);
      const fetchedSubjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
      const fetchedClasses = Array.isArray(classesRes.data) ? classesRes.data : [];
      setSubjects(fetchedSubjects);
      setClasses(fetchedClasses);
      if (fetchedClasses.length > 0) {
        setClassId(fetchedClasses[0].id);
      } else {
        setClassId("");
        setPackages([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải dữ liệu kế hoạch đào tạo");
    } finally {
      setLoading(false);
    }
  }, [majorId, level, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadProgramSubjects = useCallback(async () => {
    setProgramSubjectsLoading(true);
    setProgramSubjectsError("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/subjects?program=${level}`, { withCredentials: true });
      setProgramSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setProgramSubjects([]);
      setProgramSubjectsError(err.response?.data?.message || "Không thể tải danh sách học phần gốc dùng chung");
    } finally {
      setProgramSubjectsLoading(false);
    }
  }, [level]);

  useEffect(() => {
    if (isAdmin && (isAddingSubject || editingSubjectId)) {
      loadProgramSubjects();
    }
  }, [editingSubjectId, isAddingSubject, isAdmin, loadProgramSubjects]);

  // Load Packages for active class
  const loadPackages = useCallback(async (targetClassId) => {
    const cId = targetClassId || classId;
    if (!cId) {
      setPackages([]);
      return;
    }
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/subject-packages?classGroupId=${cId}`, { withCredentials: true });
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải gói học phần của lớp");
    }
  }, [classId]);

  useEffect(() => {
    if (classId) {
      loadPackages(classId);
    } else {
      setPackages([]);
    }
  }, [classId, loadPackages]);

  // Auto focus first input when adding draft row
  useEffect(() => {
    if (isAddingSubject && firstDraftInputRef.current) {
      firstDraftInputRef.current.focus();
    }
  }, [isAddingSubject]);

  const selectedMajor = useMemo(() => majors.find((m) => m.id === majorId), [majors, majorId]);
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjects.filter((s) => {
      const matchQuery = !q || (s.name || "").toLowerCase().includes(q) ||
        (s.codeText || "").toLowerCase().includes(q) ||
        String(s.codeNumber || "").includes(q);
      const matchType = subjectTypeFilter === "ALL" || s.subjectType === subjectTypeFilter;
      return matchQuery && matchType;
    });
  }, [subjects, subjectSearch, subjectTypeFilter]);

  // Subject Stats
  const subjectStats = useMemo(() => {
    const total = subjects.length;
    const totalCredits = subjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
    const required = subjects.filter((s) => s.isRequired).length;
    const optional = total - required;
    const active = subjects.filter((s) => s.active).length;
    return { total, totalCredits, required, optional, active };
  }, [subjects]);

  // ==========================================
  // SUBJECT ACTIONS (EXCEL-LIKE INLINE WORKFLOW)
  // ==========================================
  const handleStartAddSubject = () => {
    const nextOrder = subjects.length > 0 ? Math.max(...subjects.map((s) => Number(s.sortOrder) || 0)) + 1 : 1;
    setSubjectDraft(initialSubjectDraft(nextOrder));
    setIsAddingSubject(true);
  };

  const handleCancelAddSubject = () => {
    setIsAddingSubject(false);
  };

  const handleSaveSubjectDraft = async (keepOpenForNext = false) => {
    if (!subjectDraft.codeNumber) {
      toast.error("Vui lòng nhập mã học phần số");
      return;
    }
    if (!subjectDraft.codeText?.trim()) {
      toast.error("Vui lòng nhập mã học phần chữ");
      return;
    }
    if (!subjectDraft.name?.trim()) {
      toast.error("Vui lòng nhập tên học phần");
      return;
    }

    const payload = {
      codeNumber: Number(subjectDraft.codeNumber),
      codeText: subjectDraft.codeText.trim().toUpperCase(),
      name: subjectDraft.name.trim(),
      majorId,
      program: level,
      credits: Number(subjectDraft.credits || 0),
      majorAssignment: Boolean(subjectDraft.majorAssignment),
      subjectType: subjectDraft.subjectType || "CN",
      isRequired: Boolean(subjectDraft.isRequired),
      sortOrder: Number(subjectDraft.sortOrder || 0),
      active: Boolean(subjectDraft.active),
      ...buildSubjectIdentityPayload(subjectDraft),
      ...teachingLoadPayload(subjectDraft),
    };

    try {
      const { data: created } = await axios.post(`${API_BASE_URL}/plan/subjects`, payload, { withCredentials: true });
      toast.success(`Đã thêm học phần "${created.name}"`);
      setSubjects((prev) => [...prev, created]);
      loadMajors();
      loadProgramSubjects();

      if (keepOpenForNext) {
        setSubjectDraft(initialSubjectDraft(Number(subjectDraft.sortOrder || 0) + 1));
        if (firstDraftInputRef.current) firstDraftInputRef.current.focus();
      } else {
        setIsAddingSubject(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể thêm học phần");
    }
  };

  const handleStartEditSubject = (s) => {
    const identity = normalizeSubjectIdentity(s);
    setEditingSubjectId(s.id);
    setEditingSubjectForm({
      id: s.id,
      codeNumber: s.codeNumber,
      codeText: s.codeText || "",
      name: s.name,
      credits: s.credits ?? 3,
      teachingUnits: s.teachingUnits,
      teachingUnitType: s.teachingUnitType,
      majorAssignment: Boolean(s.majorAssignment),
      subjectType: s.subjectType || "CN",
      isRequired: s.isRequired !== false,
      sortOrder: s.sortOrder ?? 0,
      active: Boolean(s.active),
      ...identity,
    });
  };

  const handleCancelEditSubject = () => {
    setEditingSubjectId(null);
    setEditingSubjectForm(null);
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubjectForm.codeNumber) return toast.error("Vui lòng nhập mã học phần số");
    if (!editingSubjectForm.codeText?.trim()) return toast.error("Vui lòng nhập mã học phần chữ");
    if (!editingSubjectForm.name?.trim()) return toast.error("Vui lòng nhập tên học phần");

    const payload = {
      codeNumber: Number(editingSubjectForm.codeNumber),
      codeText: editingSubjectForm.codeText.trim().toUpperCase(),
      name: editingSubjectForm.name.trim(),
      majorId,
      program: level,
      credits: Number(editingSubjectForm.credits || 0),
      majorAssignment: Boolean(editingSubjectForm.majorAssignment),
      subjectType: editingSubjectForm.subjectType,
      isRequired: Boolean(editingSubjectForm.isRequired),
      sortOrder: Number(editingSubjectForm.sortOrder || 0),
      active: Boolean(editingSubjectForm.active),
      ...buildSubjectIdentityPayload(editingSubjectForm),
      ...teachingLoadPayload(editingSubjectForm),
    };

    try {
      const { data: updated } = await axios.put(
        `${API_BASE_URL}/plan/subjects/${editingSubjectForm.id}`,
        payload,
        { withCredentials: true }
      );
      toast.success("Cập nhật học phần thành công");
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      loadProgramSubjects();
      setEditingSubjectId(null);
      setEditingSubjectForm(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật học phần");
    }
  };

  // Fast 1-click toggle for boolean flags
  const handleQuickToggleSubject = async (subject, field) => {
    if (!isAdmin) return;
    const newValue = !subject[field];
    try {
      await axios.put(
        `${API_BASE_URL}/plan/subjects/${subject.id}`,
        { [field]: newValue },
        { withCredentials: true }
      );
      setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, [field]: newValue } : s)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật trạng thái");
    }
  };

  const handleDeleteSubject = async (subject) => {
    try {
      await axios.delete(`${API_BASE_URL}/plan/subjects/${subject.id}`, { withCredentials: true });
      toast.success(`Đã xóa học phần "${subject.name}"`);
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
      setDeletingSubjectId(null);
      loadMajors();
      if (classId) loadPackages(classId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa học phần");
    }
  };

  // Keyboard helper for Subject Draft Row (Enter -> Save & Continue, Esc -> Cancel)
  const handleSubjectKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveSubjectDraft(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelAddSubject();
    }
  };

  const handleSubjectEditKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEditSubject();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEditSubject();
    }
  };

  // ==========================================
  // CLASS ACTIONS (INLINE WORKFLOW)
  // ==========================================
  const handleStartAddClass = () => {
    setClassDraft(initialClassDraft(year));
    setIsAddingClass(true);
  };

  const handleSaveClassDraft = async () => {
    if (!classDraft.code?.trim()) return toast.error("Vui lòng nhập mã lớp");
    if (!classDraft.name?.trim()) return toast.error("Vui lòng nhập tên lớp");

    const payload = {
      code: classDraft.code.trim().toUpperCase(),
      name: classDraft.name.trim(),
      program: level,
      majorId,
      academicYear: classDraft.academicYear.trim() || year,
      term: classDraft.term.trim(),
      note: classDraft.note.trim(),
    };

    try {
      const { data: created } = await axios.post(`${API_BASE_URL}/plan/classes`, payload, { withCredentials: true });
      toast.success(`Đã tạo lớp "${created.name}"`);
      setClasses((prev) => [...prev, created]);
      setClassId(created.id);
      setIsAddingClass(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể thêm lớp học");
    }
  };

  const handleStartEditClass = (c) => {
    setEditingClassId(c.id);
    setEditingClassForm({
      id: c.id,
      code: c.code,
      name: c.name,
      academicYear: c.academicYear || year,
      term: c.term || "",
      note: c.note || "",
    });
  };

  const handleSaveEditClass = async () => {
    if (!editingClassForm.code?.trim()) return toast.error("Vui lòng nhập mã lớp");
    if (!editingClassForm.name?.trim()) return toast.error("Vui lòng nhập tên lớp");

    const payload = {
      code: editingClassForm.code.trim().toUpperCase(),
      name: editingClassForm.name.trim(),
      majorId,
      academicYear: editingClassForm.academicYear.trim(),
      term: editingClassForm.term.trim(),
      note: editingClassForm.note.trim(),
    };

    try {
      const { data: updated } = await axios.put(
        `${API_BASE_URL}/plan/classes/${editingClassForm.id}`,
        payload,
        { withCredentials: true }
      );
      toast.success("Cập nhật lớp học thành công");
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setEditingClassId(null);
      setEditingClassForm(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật lớp học");
    }
  };

  const handleDeleteClass = async (c) => {
    try {
      await axios.delete(`${API_BASE_URL}/plan/classes/${c.id}`, { withCredentials: true });
      toast.success(`Đã xóa lớp "${c.name}"`);
      setClasses((prev) => prev.filter((item) => item.id !== c.id));
      setDeletingClassId(null);
      if (classId === c.id) {
        const remaining = classes.filter((item) => item.id !== c.id);
        setClassId(remaining.length > 0 ? remaining[0].id : "");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa lớp học");
    }
  };

  // ==========================================
  // PACKAGE MATRIX ACTIONS (SPREADSHEET MULTI-SELECT)
  // ==========================================
  const handleSavePkgDraft = async () => {
    if (!classId) return toast.error("Chưa chọn lớp học");
    if (!pkgDraft.code?.trim()) return toast.error("Vui lòng nhập mã gói");
    if (!pkgDraft.name?.trim()) return toast.error("Vui lòng nhập tên gói");

    const defaultSubjectIds = subjects.slice(0, 21).map((s) => s.id);
    if (defaultSubjectIds.length === 0) return toast.error("Chuyên ngành chưa có học phần nào");

    const payload = {
      code: pkgDraft.code.trim().toUpperCase(),
      name: pkgDraft.name.trim(),
      classGroupId: classId,
      subjectIds: defaultSubjectIds,
    };

    try {
      await axios.post(`${API_BASE_URL}/plan/subject-packages`, payload, { withCredentials: true });
      toast.success(`Đã tạo gói "${pkgDraft.name}"`);
      setIsAddingPkg(false);
      setPkgDraft(initialPkgDraft());
      loadPackages(classId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tạo gói học phần");
    }
  };

  // Quick 1-click create standard Package 1 and Package 2
  const handleCreateDefaultPackages = async () => {
    if (!classId) return;
    if (subjects.length === 0) {
      toast.error("Vui lòng thêm học phần cho chuyên ngành trước");
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/plan/classes/${classId}/default-packages`, {}, { withCredentials: true });
      toast.success("Đã tạo nhanh 2 gói học phần chuẩn cho lớp (Gói 1 là gói chính thức)");
      loadPackages(classId);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tạo gói mặc định");
    }
  };

  const handleSetOfficialPackage = async (pkg) => {
    if (!isAdmin) return;
    try {
      await axios.put(`${API_BASE_URL}/plan/subject-packages/${pkg.id}/set-official`, {}, { withCredentials: true });
      toast.success(`Đã đặt "${pkg.name}" làm gói chính thức cho lớp`);
      loadPackages(classId);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể đặt gói chính thức");
    }
  };

  const handleMergePermission = async (pkg, canMerge) => {
    try {
      const { data } = await axios.put(API_BASE_URL + "/plan/subject-packages/" + pkg.id, { canMerge }, { withCredentials: true });
      setPackages((rows) => rows.map((p) => p.id === pkg.id ? data : p));
    } catch (error) { toast.error(error.response?.data?.message || "Không lưu được quyền ghép lớp."); }
  };

  const handleStartEditPkg = (pkg) => {
    setEditingPkgId(pkg.id);
    setEditingPkgForm({
      id: pkg.id,
      code: pkg.code,
      name: pkg.name,
    });
  };

  const handleSaveEditPkg = async () => {
    if (!editingPkgForm.code?.trim()) return toast.error("Vui lòng nhập mã gói");
    if (!editingPkgForm.name?.trim()) return toast.error("Vui lòng nhập tên gói");

    try {
      await axios.put(
        `${API_BASE_URL}/plan/subject-packages/${editingPkgForm.id}`,
        { code: editingPkgForm.code.trim().toUpperCase(), name: editingPkgForm.name.trim() },
        { withCredentials: true }
      );
      toast.success("Cập nhật thông tin gói thành công");
      setEditingPkgId(null);
      setEditingPkgForm(null);
      loadPackages(classId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật gói học phần");
    }
  };

  const handleDeletePkg = async (pkg) => {
    try {
      await axios.delete(`${API_BASE_URL}/plan/subject-packages/${pkg.id}`, { withCredentials: true });
      toast.success(`Đã xóa gói "${pkg.name}"`);
      loadPackages(classId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa gói học phần");
    }
  };

  // Toggle a single subject in a package (Excel Matrix Checkbox)
  const handleToggleSubjectInPackage = async (pkg, subjectId) => {
    if (!isAdmin) return;
    if (matrixSaving) return;
    if (pkg.isOfficial) {
      toast.warning("Hãy chọn một gói khác làm chính thức trước khi sửa gói này");
      return;
    }
    const currentSubjectIds = (pkg.entries || []).map((e) => e.subjectId);
    const hasSubject = currentSubjectIds.includes(subjectId);
    if (!hasSubject && currentSubjectIds.length >= 21) {
      toast.warning("Mỗi gói chỉ được có tối đa 21 học phần");
      return;
    }
    const newSubjectIds = hasSubject
      ? currentSubjectIds.filter((id) => id !== subjectId)
      : [...currentSubjectIds, subjectId];

    if (newSubjectIds.length === 0) {
      toast.warning("Gói học phần phải có ít nhất 1 môn học");
      return;
    }

    // Optimistic UI update
    setPackages((prev) =>
      prev.map((p) => {
        if (p.id !== pkg.id) return p;
        const newEntries = hasSubject
          ? (p.entries || []).filter((e) => e.subjectId !== subjectId)
          : [...(p.entries || []), { subjectId, subject: subjects.find((s) => s.id === subjectId) }];
        return { ...p, entries: newEntries, totalSubjects: newEntries.length };
      })
    );

    try {
      setMatrixSaving(true);
      await axios.put(
        `${API_BASE_URL}/plan/subject-packages/${pkg.id}`,
        { subjectIds: newSubjectIds },
        { withCredentials: true }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể cập nhật môn học trong gói");
      loadPackages(classId);
    } finally {
      setMatrixSaving(false);
    }
  };

  return (
    <FeatureLayout
      title="Kế hoạch đào tạo"
      group="Kế hoạch khóa mới"
      desc="Lập và quản lý kế hoạch đào tạo theo từng chuyên ngành: danh mục học phần, lớp học và ma trận phân gói học phần (2 gói / lớp, 21 học phần / gói)."
      maxWidth={1440}
    >
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />

      {/* 1. TOP TOOLBAR: YEAR, LEVEL, MAJOR & GLOBAL STATS */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          bgcolor: "#FFFFFF",
          borderColor: "#DFE4E8",
          borderRadius: "4px",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ width: { xs: "100%", md: "auto" }, flexGrow: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140, width: { xs: "100%", sm: "auto" } }}>
              <Select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                displayEmpty
                sx={{ height: 36, fontSize: 13, bgcolor: "#F7F9FA" }}
              >
                {YEARS.map((y) => (
                  <MenuItem key={y} value={y} sx={{ fontSize: 13 }}>
                    Năm: <strong>{y}</strong>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140, width: { xs: "100%", sm: "auto" } }}>
              <Select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                sx={{ height: 36, fontSize: 13, bgcolor: "#F7F9FA" }}
              >
                {LEVELS.map((l) => (
                  <MenuItem key={l.value} value={l.value} sx={{ fontSize: 13 }}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 280, flexGrow: 1, width: { xs: "100%", sm: "auto" } }}>
              <Select
                value={majorId}
                onChange={(e) => setMajorId(e.target.value)}
                displayEmpty
                sx={{ height: 36, fontSize: 13, fontWeight: 600, color: "#173B70", bgcolor: "#F7F9FA" }}
              >
                {majors.map((m) => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
                    {m.code} — {m.name} ({m.subjectCount} học phần)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Refresh button */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Tải lại dữ liệu">
              <IconButton
                size="small"
                onClick={loadData}
                disabled={loading}
                sx={{ border: "1px solid #DFE4E8", borderRadius: "4px", p: "6px" }}
              >
                <RefreshRounded fontSize="small" sx={{ color: "#68737D" }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* 2. TAB CONTROLS */}
      <Box sx={{ borderBottom: "1px solid #DFE4E8", mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 38,
            "& .MuiTab-root": {
              minHeight: 38,
              py: 0.8,
              px: 2.5,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "none",
              color: "#68737D",
              "&.Mui-selected": {
                color: "#0788B8",
              },
            },
            "& .MuiTabs-indicator": {
              bgcolor: "#0788B8",
              height: 3,
            },
          }}
        >
          <Tab
            icon={<LibraryBooksRounded sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`1. Danh mục học phần ${level === "doctoral" ? "Tiến sĩ" : "Thạc sĩ"} (${subjects.length} môn)`}
          />
          <Tab
            icon={<ClassRounded sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`2. Lớp học & Gói học phần (${classes.length} lớp)`}
          />
        </Tabs>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress size={32} sx={{ color: "#0788B8" }} />
        </Box>
      )}

      {!loading && !majorId && (
        <Alert severity="info" sx={{ borderRadius: "4px" }}>
          Vui lòng chọn chuyên ngành để xem và thiết lập kế hoạch đào tạo.
        </Alert>
      )}

      {!loading && majorId && tab === 0 && (
        /* TAB 1: DANH MỤC HỌC PHẦN CHUYÊN NGÀNH (SPREADSHEET VIEW) */
        <Box>
          {/* Table Toolbar & Stats */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <TextField
                size="small"
                placeholder="Tìm kiếm mã HP, tên học phần..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" sx={{ color: "#8a94a3" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: "100%", sm: 260 }, ...cellInputSx }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={subjectTypeFilter}
                  onChange={(e) => setSubjectTypeFilter(e.target.value)}
                  sx={{ height: 32, fontSize: 12, bgcolor: "#ffffff" }}
                >
                  <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả loại HP</MenuItem>
                  {SUBJECT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Typography variant="caption" sx={{ color: "#68737D", fontWeight: 600, mr: 1 }}>
                Tổng: <strong style={{ color: "#20262C" }}>{subjectStats.total}</strong> HP (
                <strong style={{ color: "#0788B8" }}>{subjectStats.totalCredits}</strong> TC) · Bắt buộc:{" "}
                <strong style={{ color: "#137B3B" }}>{subjectStats.required}</strong> · Tự chọn:{" "}
                <strong style={{ color: "#B86216" }}>{subjectStats.optional}</strong>
              </Typography>

              {isAdmin && !isAddingSubject && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddRounded />}
                  onClick={handleStartAddSubject}
                  sx={{
                    height: 32,
                    bgcolor: "#137B3B",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "none",
                    borderRadius: "2px",
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#0f612f", boxShadow: "none" },
                  }}
                >
                  Thêm dòng mới (Excel)
                </Button>
              )}
            </Stack>
          </Stack>

          {isAdmin && isAddingSubject && (
            <Box sx={{ mb: 1.5 }}>
              <TeachingLoadFields value={subjectDraft} onChange={setSubjectDraft} />
              <SubjectIdentityFields
                subject={subjectDraft}
                identity={subjectDraft}
                onChange={(identity) => setSubjectDraft((current) => ({ ...current, ...identity }))}
                program={level}
                subjects={programSubjects}
                loading={programSubjectsLoading}
                error={programSubjectsError}
              />
            </Box>
          )}

          {isAdmin && editingSubjectForm && (
            <Box sx={{ mb: 1.5 }}>
              <TeachingLoadFields value={editingSubjectForm} onChange={setEditingSubjectForm} />
              <SubjectIdentityFields
                subject={editingSubjectForm}
                identity={editingSubjectForm}
                onChange={(identity) => setEditingSubjectForm((current) => ({ ...current, ...identity }))}
                program={level}
                subjects={programSubjects}
                loading={programSubjectsLoading}
                error={programSubjectsError}
              />
            </Box>
          )}

          {/* Spreadsheet Table */}
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderColor: "#DFE4E8",
              borderRadius: "4px",
              maxHeight: "calc(100vh - 280px)",
              overflowY: "auto",
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", color: "#20262C", fontWeight: 700, fontSize: 12, py: "8px", borderBottom: "2px solid #DFE4E8" } }}>
                  <TableCell sx={{ width: 44, textAlign: "center" }}>STT</TableCell>
                  <TableCell sx={{ width: 95 }}>Mã số</TableCell>
                  <TableCell sx={{ width: 95 }}>Mã chữ</TableCell>
                  <TableCell>Tên môn học</TableCell>
                  <TableCell sx={{ width: 70, textAlign: "center" }}>Số TC</TableCell>
                  <TableCell sx={{ width: 100, textAlign: "center" }}>Loại HP</TableCell>
                  <TableCell sx={{ width: 95, textAlign: "center" }}>Bài tập lớn</TableCell>
                  <TableCell sx={{ width: 90, textAlign: "center" }}>Bắt buộc</TableCell>
                  <TableCell sx={{ width: 70, textAlign: "center" }}>Thứ tự</TableCell>
                  <TableCell sx={{ width: 90, textAlign: "center" }}>Trạng thái</TableCell>
                  {isAdmin && <TableCell sx={{ width: 110, textAlign: "center" }}>Thao tác</TableCell>}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredSubjects.length === 0 && !isAddingSubject ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 11 : 10} align="center" sx={{ py: 5, color: "#68737D" }}>
                      Chưa có học phần nào cho chuyên ngành <strong>{selectedMajor?.name}</strong>.
                      {isAdmin && (
                        <Box sx={{ mt: 1 }}>
                          <Button size="small" variant="outlined" startIcon={<AddRounded />} onClick={handleStartAddSubject}>
                            Bấm để nhập dòng đầu tiên
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubjects.map((row, index) => {
                    const isEditing = editingSubjectId === row.id;

                    if (isEditing) {
                      return (
                        <TableRow
                          key={row.id}
                          sx={{ bgcolor: "#F2F9FC", "& td": { py: "4px", px: "6px" } }}
                          onKeyDown={handleSubjectEditKeyDown}
                        >
                          <TableCell align="center" sx={{ fontSize: 12, fontWeight: 700, color: "#0788B8" }}>
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={editingSubjectForm.codeNumber}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, codeNumber: e.target.value }))}
                              sx={cellInputSx}
                              autoFocus
                              placeholder="101"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={editingSubjectForm.codeText}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, codeText: e.target.value.toUpperCase() }))}
                              sx={cellInputSx}
                              placeholder="CS01"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={editingSubjectForm.name}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, name: e.target.value }))}
                              sx={{ ...cellInputSx, width: "100%" }}
                              placeholder="Tên học phần..."
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={editingSubjectForm.credits}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, credits: e.target.value }))}
                              sx={{ ...cellInputSx, width: 55 }}
                              inputProps={{ min: 0 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Select
                              size="small"
                              value={editingSubjectForm.subjectType}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, subjectType: e.target.value }))}
                              sx={{ height: 32, fontSize: 12, bgcolor: "#fff", width: "100%" }}
                            >
                              {SUBJECT_TYPES.map((t) => (
                                <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                                  {t.value}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              size="small"
                              checked={editingSubjectForm.majorAssignment}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, majorAssignment: e.target.checked }))}
                              sx={{ p: 0.5 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Checkbox
                              size="small"
                              checked={editingSubjectForm.isRequired}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, isRequired: e.target.checked }))}
                              sx={{ p: 0.5 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={editingSubjectForm.sortOrder}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, sortOrder: e.target.value }))}
                              sx={{ ...cellInputSx, width: 55 }}
                              inputProps={{ min: 0 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              size="small"
                              checked={editingSubjectForm.active}
                              onChange={(e) => setEditingSubjectForm((p) => ({ ...p, active: e.target.checked }))}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Lưu (Enter)">
                                <IconButton size="small" color="primary" onClick={handleSaveEditSubject}>
                                  <SaveRounded fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Hủy (Esc)">
                                <IconButton size="small" color="inherit" onClick={handleCancelEditSubject}>
                                  <CloseRounded fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow
                        key={row.id}
                        hover
                        onDoubleClick={() => isAdmin && handleStartEditSubject(row)}
                        sx={{
                          cursor: isAdmin ? "pointer" : "default",
                          "&:hover": { bgcolor: "#F7F9FA" },
                          "& td": { py: "6px", fontSize: 13 },
                        }}
                      >
                        <TableCell align="center" sx={{ color: "#68737D", fontSize: 12 }}>
                          {index + 1}
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace", color: "#20262C" }}>
                          {row.codeNumber}
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: "#173B70" }}>
                          {row.codeText}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {row.name}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {row.credits}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={row.subjectType}
                            variant="outlined"
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              height: 22,
                              borderColor: SUBJECT_TYPES.find((t) => t.value === row.subjectType)?.color || "#68737D",
                              color: SUBJECT_TYPES.find((t) => t.value === row.subjectType)?.color || "#68737D",
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={isAdmin ? "Bấm để chuyển trạng thái Bài tập lớn" : ""}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleQuickToggleSubject(row, "majorAssignment"); }}
                              disabled={!isAdmin}
                              sx={{ p: 0.5 }}
                            >
                              {row.majorAssignment ? (
                                <CheckBoxRounded fontSize="small" sx={{ color: "#0788B8" }} />
                              ) : (
                                <CheckBoxOutlineBlankRounded fontSize="small" sx={{ color: "#DFE4E8" }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={isAdmin ? "Bấm để chuyển Bắt buộc / Tự chọn" : ""}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleQuickToggleSubject(row, "isRequired"); }}
                              disabled={!isAdmin}
                              sx={{ p: 0.5 }}
                            >
                              {row.isRequired ? (
                                <CheckRounded fontSize="small" sx={{ color: "#137B3B", fontWeight: 900 }} />
                              ) : (
                                <Typography variant="caption" sx={{ color: "#8a94a3" }}>—</Typography>
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" sx={{ color: "#68737D", fontSize: 12 }}>
                          {row.sortOrder ?? 0}
                        </TableCell>
                        <TableCell align="center">
                          {isAdmin ? (
                            <Tooltip title="Bật/Tắt kích hoạt">
                              <Switch
                                size="small"
                                checked={Boolean(row.active)}
                                onChange={(e) => { e.stopPropagation(); handleQuickToggleSubject(row, "active"); }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              size="small"
                              label={row.active ? "Bật" : "Ẩn"}
                              sx={{
                                height: 20,
                                fontSize: 10,
                                bgcolor: row.active ? "#E6F4EA" : "#F1F3F4",
                                color: row.active ? "#137B3B" : "#68737D",
                              }}
                            />
                          )}
                        </TableCell>

                        {isAdmin && (
                          <TableCell align="center">
                            {deletingSubjectId === row.id ? (
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSubject(row); }}
                                  sx={{ minWidth: 40, px: 1, py: 0.2, fontSize: 11 }}
                                >
                                  Xóa
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => { e.stopPropagation(); setDeletingSubjectId(null); }}
                                  sx={{ minWidth: 40, px: 1, py: 0.2, fontSize: 11 }}
                                >
                                  Hủy
                                </Button>
                              </Stack>
                            ) : (
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <Tooltip title="Sửa (Double-click)">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => { e.stopPropagation(); handleStartEditSubject(row); }}
                                  >
                                    <EditRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Xóa">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => { e.stopPropagation(); setDeletingSubjectId(row.id); }}
                                  >
                                    <DeleteRounded fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}

                {/* DRAFT ROW (INLINE ADD ROW FOR EXCEL-LIKE FAST ENTRY) */}
                {isAddingSubject && (
                  <TableRow
                    sx={{
                      bgcolor: "#EBF5FB",
                      border: "2px solid #0788B8",
                      "& td": { py: "6px", px: "6px" },
                    }}
                    onKeyDown={handleSubjectKeyDown}
                  >
                    <TableCell align="center" sx={{ fontSize: 12, fontWeight: 700, color: "#0788B8" }}>
                      {subjects.length + 1}
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        placeholder="Mã số (101)"
                        value={subjectDraft.codeNumber}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, codeNumber: e.target.value }))}
                        sx={cellInputSx}
                        inputRef={firstDraftInputRef}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Mã chữ (CS01)"
                        value={subjectDraft.codeText}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, codeText: e.target.value.toUpperCase() }))}
                        sx={cellInputSx}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Nhập tên học phần..."
                        value={subjectDraft.name}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, name: e.target.value }))}
                        sx={{ ...cellInputSx, width: "100%" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={subjectDraft.credits}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, credits: e.target.value }))}
                        sx={{ ...cellInputSx, width: 55 }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Select
                        size="small"
                        value={subjectDraft.subjectType}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, subjectType: e.target.value }))}
                        sx={{ height: 32, fontSize: 12, bgcolor: "#fff", width: "100%" }}
                      >
                        {SUBJECT_TYPES.map((t) => (
                          <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                            {t.value}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={subjectDraft.majorAssignment}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, majorAssignment: e.target.checked }))}
                        sx={{ p: 0.5 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        size="small"
                        checked={subjectDraft.isRequired}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, isRequired: e.target.checked }))}
                        sx={{ p: 0.5 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        size="small"
                        type="number"
                        value={subjectDraft.sortOrder}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, sortOrder: e.target.value }))}
                        sx={{ ...cellInputSx, width: 55 }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={subjectDraft.active}
                        onChange={(e) => setSubjectDraft((p) => ({ ...p, active: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Lưu & Thêm tiếp (Enter)">
                          <IconButton size="small" color="primary" onClick={() => handleSaveSubjectDraft(true)}>
                            <SaveRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Hủy (Esc)">
                          <IconButton size="small" color="inherit" onClick={handleCancelAddSubject}>
                            <CloseRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Table Footer Instructions */}
          <Stack direction="row" spacing={3} sx={{ mt: 1.5, color: "#68737D", fontSize: 12 }}>
            <Typography variant="caption">
              💡 <strong>Mẹo thao tác Excel:</strong> Bấm <strong>Tab</strong> để chuyển ô · Bấm <strong>Enter</strong> để lưu và tạo dòng tiếp theo · Bấm <strong>Esc</strong> để hủy · Bấm đúp vào dòng để sửa.
            </Typography>
          </Stack>
        </Box>
      )}

      {!loading && majorId && tab === 1 && (
        /* TAB 2: LỚP HỌC & MA TRẬN GÓI HỌC PHẦN (EXCEL MATRIX GRID) */
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems="flex-start">
          {/* LEFT PANE: CLASS GROUPS LIST */}
          <Box sx={{ width: { xs: "100%", lg: "38%" } }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: "#DFE4E8",
                borderRadius: "4px",
                bgcolor: "#FFFFFF",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173B70" }}>
                  Danh sách lớp học ({classes.length})
                </Typography>

                {isAdmin && !isAddingClass && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddRounded />}
                    onClick={handleStartAddClass}
                    sx={{
                      height: 28,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: "2px",
                      borderColor: "#0788B8",
                      color: "#0788B8",
                    }}
                  >
                    Thêm lớp
                  </Button>
                )}
              </Stack>

              <TableContainer sx={{ maxHeight: 450, overflowY: "auto", border: "1px solid #DFE4E8", borderRadius: "2px" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", fontWeight: 700, fontSize: 11, py: "6px" } }}>
                      <TableCell sx={{ width: 36 }}>#</TableCell>
                      <TableCell>Mã & Tên lớp</TableCell>
                      <TableCell sx={{ width: 60 }}>Niên khóa</TableCell>
                      {isAdmin && <TableCell sx={{ width: 80, textAlign: "center" }}>Thao tác</TableCell>}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {/* Inline Add Class */}
                    {isAddingClass && (
                      <TableRow sx={{ bgcolor: "#EBF5FB" }}>
                        <TableCell align="center" sx={{ fontSize: 11, fontWeight: 700, color: "#0788B8" }}>
                          +
                        </TableCell>
                        <TableCell colSpan={isAdmin ? 3 : 2}>
                          <Stack spacing={1} sx={{ py: 1 }}>
                            <Stack direction="row" spacing={1}>
                              <TextField
                                size="small"
                                placeholder="Mã lớp (VD: CH24A)"
                                value={classDraft.code}
                                onChange={(e) => setClassDraft((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                sx={cellInputSx}
                                autoFocus
                              />
                              <TextField
                                size="small"
                                placeholder="Tên lớp..."
                                value={classDraft.name}
                                onChange={(e) => setClassDraft((p) => ({ ...p, name: e.target.value }))}
                                sx={{ ...cellInputSx, flexGrow: 1 }}
                              />
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <TextField
                                size="small"
                                placeholder="Học kỳ"
                                value={classDraft.term}
                                onChange={(e) => setClassDraft((p) => ({ ...p, term: e.target.value }))}
                                sx={{ ...cellInputSx, width: 100 }}
                              />
                              <TextField
                                size="small"
                                placeholder="Ghi chú"
                                value={classDraft.note}
                                onChange={(e) => setClassDraft((p) => ({ ...p, note: e.target.value }))}
                                sx={{ ...cellInputSx, flexGrow: 1 }}
                              />
                              <Button
                                size="small"
                                variant="contained"
                                onClick={handleSaveClassDraft}
                                sx={{ height: 30, fontSize: 11, bgcolor: "#137B3B" }}
                              >
                                Lưu
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setIsAddingClass(false)}
                                sx={{ height: 30, fontSize: 11 }}
                              >
                                Hủy
                              </Button>
                            </Stack>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}

                    {classes.length === 0 && !isAddingClass ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} align="center" sx={{ py: 4, color: "#68737D", fontSize: 12 }}>
                          Chưa có lớp học nào trong niên khóa {year}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      classes.map((c, index) => {
                        const isSelected = c.id === classId;
                        const isEditing = editingClassId === c.id;

                        if (isEditing) {
                          return (
                            <TableRow key={c.id} sx={{ bgcolor: "#F2F9FC" }}>
                              <TableCell align="center" sx={{ fontSize: 11 }}>{index + 1}</TableCell>
                              <TableCell colSpan={isAdmin ? 3 : 2}>
                                <Stack spacing={1} sx={{ py: 0.5 }}>
                                  <Stack direction="row" spacing={1}>
                                    <TextField
                                      size="small"
                                      value={editingClassForm.code}
                                      onChange={(e) => setEditingClassForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                      sx={cellInputSx}
                                    />
                                    <TextField
                                      size="small"
                                      value={editingClassForm.name}
                                      onChange={(e) => setEditingClassForm((p) => ({ ...p, name: e.target.value }))}
                                      sx={{ ...cellInputSx, flexGrow: 1 }}
                                    />
                                  </Stack>
                                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button size="small" variant="contained" onClick={handleSaveEditClass} sx={{ height: 26, fontSize: 11 }}>
                                      Lưu
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={() => setEditingClassId(null)} sx={{ height: 26, fontSize: 11 }}>
                                      Hủy
                                    </Button>
                                  </Stack>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return (
                          <TableRow
                            key={c.id}
                            hover
                            selected={isSelected}
                            onClick={() => setClassId(c.id)}
                            sx={{
                              cursor: "pointer",
                              bgcolor: isSelected ? "#EBF5FB !important" : "inherit",
                              borderLeft: isSelected ? "4px solid #0788B8" : "4px solid transparent",
                              "& td": { py: "6px", fontSize: 12 },
                            }}
                          >
                            <TableCell align="center" sx={{ color: "#68737D", fontSize: 11 }}>
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: "#173B70", fontFamily: "monospace", fontSize: 12 }}>
                                {c.code}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#20262C", display: "block" }}>
                                {c.name}
                              </Typography>
                              {(() => {
                                const official = (c.packages || []).find((p) => p.isOfficial);
                                return (
                                  <Box sx={{ mt: 0.5 }}>
                                    {official ? (
                                      <Chip
                                        size="small"
                                        icon={<StarRounded sx={{ fontSize: "12px !important", color: "#137B3B !important" }} />}
                                        label={official.name}
                                        sx={{
                                          height: 18,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          bgcolor: "#E6F4EA",
                                          color: "#137B3B",
                                          border: "1px solid #137B3B",
                                        }}
                                      />
                                    ) : (
                                      <Chip
                                        size="small"
                                        label="⚠ Chưa chốt gói"
                                        sx={{
                                          height: 18,
                                          fontSize: 10,
                                          fontWeight: 600,
                                          bgcolor: "#FEF7E0",
                                          color: "#B86216",
                                          border: "1px solid #B86216",
                                        }}
                                      />
                                    )}
                                  </Box>
                                );
                              })()}
                            </TableCell>
                            <TableCell sx={{ color: "#68737D", fontSize: 11 }}>
                              {c.academicYear || year}
                            </TableCell>

                            {isAdmin && (
                              <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                {deletingClassId === c.id ? (
                                  <Stack direction="row" spacing={0.5} justifyContent="center">
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="error"
                                      onClick={() => handleDeleteClass(c)}
                                      sx={{ minWidth: 32, px: 0.5, py: 0.2, fontSize: 10 }}
                                    >
                                      Xóa
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => setDeletingClassId(null)}
                                      sx={{ minWidth: 32, px: 0.5, py: 0.2, fontSize: 10 }}
                                    >
                                      Hủy
                                    </Button>
                                  </Stack>
                                ) : (
                                  <Stack direction="row" spacing={0.5} justifyContent="center">
                                    <Tooltip title="Sửa thông tin lớp">
                                      <IconButton size="small" color="primary" onClick={() => handleStartEditClass(c)}>
                                        <EditRounded sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Xóa lớp">
                                      <IconButton size="small" color="error" onClick={() => setDeletingClassId(c.id)}>
                                        <DeleteRounded sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* RIGHT PANE: SUBJECT PACKAGE MATRIX GRID */}
          <Box sx={{ width: { xs: "100%", lg: "62%" } }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderColor: "#DFE4E8",
                borderRadius: "4px",
                bgcolor: "#FFFFFF",
              }}
            >
              {!classId ? (
                <Alert severity="info" sx={{ borderRadius: "2px" }}>
                  Vui lòng chọn một lớp học ở bảng bên trái để quản lý gói học phần.
                </Alert>
              ) : (
                <Box>
                  {/* Header info */}
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173B70" }}>
                        Ma trận gói học phần: Lớp <strong>{selectedClass?.name}</strong> ({selectedClass?.code})
                      </Typography>
                      {matrixSaving && <CircularProgress size={14} sx={{ color: "#0788B8" }} />}
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      {packages.length === 0 && isAdmin && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleCreateDefaultPackages}
                          sx={{
                            height: 28,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: "#0788B8",
                            textTransform: "none",
                            borderRadius: "2px",
                            boxShadow: "none",
                          }}
                        >
                          + Tạo nhanh Gói 1 & Gói 2 (chuẩn 21 HP)
                        </Button>
                      )}

                      {isAdmin && !isAddingPkg && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddRounded />}
                          onClick={() => setIsAddingPkg(true)}
                          sx={{
                            height: 28,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: "2px",
                            borderColor: "#0788B8",
                            color: "#0788B8",
                          }}
                        >
                          Thêm gói
                        </Button>
                      )}
                    </Stack>
                  </Stack>

                  {/* Inline Add Package */}
                  {isAddingPkg && (
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: "#EBF5FB", borderColor: "#0788B8", borderRadius: "2px" }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#0788B8", display: "block", mb: 1 }}>
                        Thêm gói học phần mới:
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          placeholder="Mã gói (VD: G1-CH24)"
                          value={pkgDraft.code}
                          onChange={(e) => setPkgDraft((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                          sx={{ ...cellInputSx, width: 160 }}
                          autoFocus
                        />
                        <TextField
                          size="small"
                          placeholder="Tên gói (VD: Gói học phần 1)"
                          value={pkgDraft.name}
                          onChange={(e) => setPkgDraft((p) => ({ ...p, name: e.target.value }))}
                          sx={{ ...cellInputSx, flexGrow: 1 }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSavePkgDraft}
                          sx={{ height: 32, fontSize: 12, bgcolor: "#137B3B" }}
                        >
                          Lưu
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setIsAddingPkg(false)}
                          sx={{ height: 32, fontSize: 12 }}
                        >
                          Hủy
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {packages.length === 0 ? (
                    <Alert severity="warning" sx={{ borderRadius: "2px", fontSize: 13 }}>
                      Lớp này chưa có gói học phần. Hãy bấm nút <strong>"Tạo nhanh Gói 1 & Gói 2"</strong> ở trên để tự động khởi tạo ma trận chọn 21 học phần.
                    </Alert>
                  ) : (
                    <Box>
                      {!packages.some((p) => p.isOfficial) && (
                        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: "2px", fontSize: 12 }}>
                          <strong>Lưu ý:</strong> Lớp <strong>{selectedClass?.name}</strong> chưa có <strong>Gói học phần chính thức</strong>. Lớp sẽ không thể xếp lịch học và không thể lưu trữ điểm thi. Vui lòng bấm <strong>"Đặt làm chính thức"</strong> ở gói bạn muốn áp dụng cho lớp.
                        </Alert>
                      )}

                      {/* Matrix Table */}
                      <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto", border: "1px solid #DFE4E8", borderRadius: "2px" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", color: "#20262C", fontWeight: 700, fontSize: 12, py: "6px" } }}>
                              <TableCell sx={{ width: 36, textAlign: "center" }}>STT</TableCell>
                              <TableCell sx={{ width: 80 }}>Mã HP</TableCell>
                              <TableCell>Tên môn học</TableCell>
                              <TableCell sx={{ width: 50, textAlign: "center" }}>TC</TableCell>

                              {/* Dynamic Package Columns */}
                              {packages.map((pkg) => {
                                const entriesCount = (pkg.entries || []).length;
                                const isTarget21 = entriesCount === 21;
                                const isEditing = editingPkgId === pkg.id;
                                const isOfficial = Boolean(pkg.isOfficial);

                                return (
                                  <TableCell
                                    key={pkg.id}
                                    sx={{
                                      width: 155,
                                      textAlign: "center",
                                      bgcolor: isOfficial ? "#EAF5EA !important" : "#EBF5FB !important",
                                      borderLeft: "1px solid #DFE4E8",
                                      borderTop: isOfficial ? "3px solid #137B3B !important" : "3px solid transparent",
                                      verticalAlign: "top",
                                    }}
                                  >
                                    <FormControlLabel sx={{ m: 0 }} label="Có thể ghép lớp" control={<Checkbox size="small" checked={pkg.canMerge === true} disabled={!isAdmin}
                                      inputProps={{ "aria-label": "Có thể ghép lớp " + pkg.code }}
                                      onChange={(e) => handleMergePermission(pkg, e.target.checked)} />} />
                                    {isEditing ? (
                                      <Stack spacing={0.5} sx={{ py: 0.5 }}>
                                        <TextField
                                          size="small"
                                          value={editingPkgForm.code}
                                          onChange={(e) => setEditingPkgForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                                          sx={cellInputSx}
                                        />
                                        <TextField
                                          size="small"
                                          value={editingPkgForm.name}
                                          onChange={(e) => setEditingPkgForm((p) => ({ ...p, name: e.target.value }))}
                                          sx={cellInputSx}
                                        />
                                        <Stack direction="row" spacing={0.5} justifyContent="center">
                                          <Button size="small" variant="contained" onClick={handleSaveEditPkg} sx={{ height: 22, fontSize: 10, minWidth: 36 }}>
                                            Lưu
                                          </Button>
                                          <Button size="small" variant="outlined" onClick={() => setEditingPkgId(null)} sx={{ height: 22, fontSize: 10, minWidth: 36 }}>
                                            Hủy
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    ) : (
                                      <Box sx={{ py: 0.5 }}>
                                        {/* Official Badge or Set Official Button */}
                                        {isOfficial ? (
                                          <Chip
                                            size="small"
                                            icon={<StarRounded sx={{ fontSize: "13px !important", color: "#FFFFFF !important" }} />}
                                            label="GÓI CHÍNH THỨC"
                                            sx={{
                                              height: 20,
                                              fontSize: 9.5,
                                              fontWeight: 700,
                                              bgcolor: "#137B3B",
                                              color: "#FFFFFF",
                                              mb: 0.8,
                                              boxShadow: "0 1px 2px rgba(19,123,59,0.3)",
                                            }}
                                          />
                                        ) : (
                                          isAdmin && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              startIcon={<StarOutlineRounded sx={{ fontSize: 13 }} />}
                                              onClick={() => handleSetOfficialPackage(pkg)}
                                              sx={{
                                                height: 20,
                                                fontSize: 9.5,
                                                fontWeight: 700,
                                                textTransform: "none",
                                                color: "#475467",
                                                borderColor: "#BAC7D5",
                                                bgcolor: "#FFFFFF",
                                                mb: 0.8,
                                                py: 0,
                                                px: 0.8,
                                                "&:hover": {
                                                  borderColor: "#137B3B",
                                                  color: "#137B3B",
                                                  bgcolor: "#E6F4EA",
                                                },
                                              }}
                                            >
                                              Đặt làm chính thức
                                            </Button>
                                          )
                                        )}

                                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                          <Typography variant="body2" sx={{ fontWeight: 700, color: isOfficial ? "#137B3B" : "#173B70", fontSize: 12 }}>
                                            {pkg.name}
                                          </Typography>
                                          {isAdmin && (
                                            <Tooltip title="Sửa tên gói">
                                              <IconButton size="small" onClick={() => handleStartEditPkg(pkg)} sx={{ p: 0.2 }}>
                                                <EditRounded sx={{ fontSize: 13, color: "#68737D" }} />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          {isAdmin && (
                                            <Tooltip title="Xóa gói">
                                              <IconButton size="small" onClick={() => handleDeletePkg(pkg)} sx={{ p: 0.2 }}>
                                                <DeleteRounded sx={{ fontSize: 13, color: "#B52D2D" }} />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Stack>

                                        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#68737D", display: "block" }}>
                                          {pkg.code}
                                        </Typography>

                                        {/* Counter Badge */}
                                        <Chip
                                          size="small"
                                          label={`${entriesCount} / 21 HP`}
                                          sx={{
                                            height: 19,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            mt: 0.5,
                                            bgcolor: isTarget21 ? "#E6F4EA" : "#FEF7E0",
                                            color: isTarget21 ? "#137B3B" : "#B86216",
                                            border: isTarget21 ? "1px solid #137B3B" : "1px solid #B86216",
                                          }}
                                        />
                                      </Box>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          </TableHead>

                        <TableBody>
                          {subjects.map((s, index) => (
                            <TableRow key={s.id} hover sx={{ "& td": { py: "4px", fontSize: 12 } }}>
                              <TableCell align="center" sx={{ color: "#68737D", fontSize: 11 }}>
                                {index + 1}
                              </TableCell>
                              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, color: "#173B70" }}>
                                {s.codeText || s.code}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>
                                {s.name}
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>
                                {s.credits}
                              </TableCell>

                              {/* Matrix Checkbox for each package */}
                              {packages.map((pkg) => {
                                const isChecked = (pkg.entries || []).some((e) => e.subjectId === s.id);
                                return (
                                  <TableCell
                                    key={pkg.id}
                                    align="center"
                                    onClick={() => !matrixSaving && handleToggleSubjectInPackage(pkg, s.id)}
                                    sx={{
                                      borderLeft: "1px solid #DFE4E8",
                                      cursor: isAdmin ? "pointer" : "default",
                                      bgcolor: isChecked ? "#F2F9FC" : "inherit",
                                      "&:hover": isAdmin ? { bgcolor: "#E1F0F8" } : {},
                                    }}
                                  >
                                    <Checkbox
                                      size="small"
                                      checked={isChecked}
                                      disabled={!isAdmin || matrixSaving}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={() => handleToggleSubjectInPackage(pkg, s.id)}
                                      sx={{
                                        p: 0.5,
                                        color: isChecked ? "#0788B8" : "#DFE4E8",
                                        "&.Mui-checked": { color: "#0788B8" },
                                      }}
                                    />
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Box>
        </Stack>
      )}
    </FeatureLayout>
  );
};

export default TrainingPlan;
