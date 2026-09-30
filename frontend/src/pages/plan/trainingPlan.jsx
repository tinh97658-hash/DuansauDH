import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel,
  IconButton, MenuItem, Paper, Select, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, CheckBoxOutlineBlankRounded, CheckBoxRounded, CheckRounded,
  CloseRounded, DeleteOutlineRounded, DeleteRounded, EditRounded, LibraryBooksRounded,
  PlaylistAddRounded, SaveRounded, ClassRounded,
} from "@mui/icons-material";
import { API_BASE_URL } from "../../config/http";
import FeatureLayout from "../../components/FeatureLayout";
import FilterSearchField from "../../components/FilterSearchField";
import FilterSelectField from "../../components/FilterSelectField";
import SubjectSharingCheckbox from "../../components/SubjectSharingCheckbox";
import { disciplineOptionLabel, disciplinesFromMajors, majorsForDiscipline } from "../../utils/disciplineScope";
import {
  compactClassCodes, countGroupClasses, groupCurriculumsByYear, suggestCurriculumCode,
} from "./trainingPlan.logic";

const SUBJECT_TYPES = [
  { value: "KC", label: "Khối kiến thức chung", color: "#173E75" },
  { value: "CS", label: "Khối kiến thức cơ sở", color: "#0788B8" },
  { value: "CN", label: "Khối kiến thức chuyên ngành", color: "#137B3B" },
  { value: "TC", label: "Khối kiến thức tự chọn", color: "#B86216" },
  { value: "CH", label: "Khối chuyên đề", color: "#607486" },
];

const currentYear = new Date().getFullYear();
// Used by the curriculum creation dialog; the top-level year filter is intentionally hidden.
const YEARS = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));
const LEVELS = [
  { value: "masters", label: "Thạc sĩ" },
  { value: "doctoral", label: "Tiến sĩ" },
];

const initialSubjectDraft = (nextSortOrder = 1, isCommon = false) => ({
  codeNumber: "",
  codeText: "",
  name: "",
  credits: 3,
  majorAssignment: false,
  subjectType: isCommon ? "KC" : "CN",
  isRequired: true,
  sortOrder: nextSortOrder,
  active: true,
  allowCrossMajor: isCommon,
  sharedMajorIds: [],
  canonicalSubjectId: null,
});

const initialCurriculumForm = (year = String(currentYear), major = null) => ({
  applicableFromYear: year,
  code: major ? `CT-${major.code || "NGANH"}-${year}` : `CT-NGANH-${year}`,
  name: major ? `Chương trình đào tạo ${major.name || ""} - Khóa ${year}` : `Chương trình đào tạo - Khóa ${year}`,
  autoPopulateFromCatalog: true,
  note: "",
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
  const year = String(currentYear);
  const [level, setLevel] = useState("masters");
  const [disciplineId, setDisciplineId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [tab, setTab] = useState(0); // 0: Học phần chuyên ngành, 1: Lớp học & Chương trình đào tạo
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Data
  const [subjects, setSubjects] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [curriculumId, setCurriculumId] = useState("");
  // CTĐT của khóa đang chọn
  const [curriculum, setCurriculum] = useState(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState([]);

  // Subject Table State (Excel-like)
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectTypeFilter, setSubjectTypeFilter] = useState("ALL");
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(initialSubjectDraft(1));
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectForm, setEditingSubjectForm] = useState(null);
  const [updatingSubjectTypeId, setUpdatingSubjectTypeId] = useState(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState(null);
  const [sharedCodesOpen, setSharedCodesOpen] = useState(false);
  const [sharedCodes, setSharedCodes] = useState([]);
  const [sharedKeepOpen, setSharedKeepOpen] = useState(false);
  const firstDraftInputRef = useRef(null);

  // Curriculum Creation Dialog State
  const [isCreateCurriculumOpen, setIsCreateCurriculumOpen] = useState(false);
  const [createCurriculumForm, setCreateCurriculumForm] = useState(initialCurriculumForm(String(currentYear)));

  // Curriculum State
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [isAddSubjectsOpen, setIsAddSubjectsOpen] = useState(false);
  const [addSubjectSearch, setAddSubjectSearch] = useState("");
  const [addSubjectTypeFilter, setAddSubjectTypeFilter] = useState("ALL");
  const [selectedCatalogSubjectIds, setSelectedCatalogSubjectIds] = useState([]);
  const [catalogSubjects, setCatalogSubjects] = useState([]);

  // Load Majors
  const loadMajors = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/training-plan?program=${level}`, { withCredentials: true });
      const list = Array.isArray(data) ? data : data.data || [];
      setMajors(list);
      if (list.length > 0) {
        const selected = list.find((m) => m.id === majorId) || list[0];
        setDisciplineId((previous) => (
          previous && list.some((major) => (major.disciplineId || major.discipline?.id) === previous)
            ? previous
            : ""
        ));
        setMajorId(selected.id);
      } else {
        setDisciplineId("");
        setMajorId("");
        setSubjects([]);
        setCurriculums([]);
        setCurriculumId("");
        setCurriculum(null);
        setCurriculumSubjects([]);
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

  // Load each resource independently. A missing curriculum endpoint must not hide
  // a valid subject catalog (the scheduling module consumes that catalog too).
  const loadData = useCallback(async () => {
    if (!majorId) return;
    setLoading(true);
    try {
      const [subjectsResult, curriculumsResult] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/plan/subjects?majorId=${majorId}&program=${level}`, { withCredentials: true }),
        axios.get(`${API_BASE_URL}/plan/curriculums?majorId=${majorId}&program=${level}`, { withCredentials: true }),
      ]);

      const fetchedSubjects = subjectsResult.status === "fulfilled" && Array.isArray(subjectsResult.value.data)
        ? subjectsResult.value.data
        : [];
      const fetchedCurriculums = curriculumsResult.status === "fulfilled" && Array.isArray(curriculumsResult.value.data)
        ? curriculumsResult.value.data
        : [];
      setSubjects(fetchedSubjects);
      setCurriculums(fetchedCurriculums);
      setCatalogSubjects(fetchedSubjects);

      if (subjectsResult.status === "rejected") {
        const err = subjectsResult.reason;
        toast.error(err.response?.status === 404
          ? "Máy chủ chưa có API danh mục học phần (/plan/subjects). Vui lòng cập nhật và khởi động lại backend."
          : err.response?.data?.message || "Không thể tải danh mục học phần");
      }
      if (curriculumsResult.status === "rejected") {
        const err = curriculumsResult.reason;
        toast.error(err.response?.status === 404
          ? "Máy chủ chưa có API chương trình đào tạo (/plan/curriculums). Danh mục học phần vẫn có thể sử dụng."
          : err.response?.data?.message || "Không thể tải chương trình đào tạo");
      }
      if (fetchedCurriculums.length > 0) {
        setCurriculumId((prev) => {
          if (prev && fetchedCurriculums.some((c) => c.id === prev)) return prev;
          const matchYear = fetchedCurriculums.find((c) => String(c.applicableFromYear) === String(year));
          return matchYear ? matchYear.id : fetchedCurriculums[0].id;
        });
      } else {
        setCurriculumId("");
        setCurriculum(null);
        setCurriculumSubjects([]);
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

  // Load detailed curriculum
  const loadCurriculumDetail = useCallback(async (targetCurriculumId) => {
    const cId = targetCurriculumId || curriculumId;
    if (!cId) {
      setCurriculum(null);
      setCurriculumSubjects([]);
      return;
    }
    try {
      const { data } = await axios.get(`${API_BASE_URL}/plan/curriculums/${cId}`, { withCredentials: true });
      setCurriculum(data || null);
      setCurriculumSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải chương trình đào tạo của khóa");
    }
  }, [curriculumId]);

  useEffect(() => {
    loadCurriculumDetail(curriculumId);
  }, [curriculumId, loadCurriculumDetail]);

  // Auto focus first input when adding draft row
  useEffect(() => {
    if (isAddingSubject && firstDraftInputRef.current) {
      firstDraftInputRef.current.focus();
    }
  }, [isAddingSubject]);

  const selectedMajor = useMemo(() => majors.find((m) => m.id === majorId), [majors, majorId]);
  const disciplines = useMemo(() => disciplinesFromMajors(majors), [majors]);
  const filteredMajors = useMemo(
    () => majorsForDiscipline(majors, disciplineId),
    [majors, disciplineId]
  );

  const handleDisciplineChange = (nextDisciplineId) => {
    setDisciplineId(nextDisciplineId);
    const nextMajors = majorsForDiscipline(majors, nextDisciplineId);
    if (!nextMajors.some((major) => major.id === majorId)) setMajorId(nextMajors[0]?.id || "");
  };

  // Nhóm CTĐT theo khóa áp dụng để phân biệt rõ chương trình của từng khóa.
  const curriculumGroups = useMemo(() => groupCurriculumsByYear(curriculums), [curriculums]);

  const requiredCredits = useMemo(
    () => curriculumSubjects.filter((s) => s.isRequired).reduce((total, s) => total + (Number(s.credits) || 0), 0),
    [curriculumSubjects]
  );
  const electiveCredits = useMemo(
    () => curriculumSubjects
      .filter((s) => !s.isRequired)
      .reduce((total, s) => total + (Number(s.credits) || 0), 0),
    [curriculumSubjects]
  );

  // Available subjects in catalog that are not yet in the active curriculum
  const existingCurriculumSubjectIds = useMemo(
    () => new Set(curriculumSubjects.map((s) => s.subjectId)),
    [curriculumSubjects]
  );
  const availableCatalogSubjects = useMemo(
    () => (catalogSubjects.length > 0 ? catalogSubjects : subjects).filter((s) => !existingCurriculumSubjectIds.has(s.id)),
    [catalogSubjects, subjects, existingCurriculumSubjectIds]
  );
  const filteredAvailableSubjects = useMemo(() => {
    const q = addSubjectSearch.trim().toLowerCase();
    return availableCatalogSubjects.filter((s) => {
      const matchQuery = !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.codeText || "").toLowerCase().includes(q) ||
        String(s.codeNumber || "").includes(q);
      const matchType = addSubjectTypeFilter === "ALL" || s.subjectType === addSubjectTypeFilter;
      return matchQuery && matchType;
    });
  }, [availableCatalogSubjects, addSubjectSearch, addSubjectTypeFilter]);

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

  const handleSaveSubjectDraft = async (keepOpenForNext = false, counterpartCodes = null) => {
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

    if ((subjectDraft.sharedMajorIds || []).length > 0 && counterpartCodes === null) {
      setSharedCodes((subjectDraft.sharedMajorIds || []).map((targetMajorId) => ({
        majorId: targetMajorId, codeNumber: "", codeText: "",
      })));
      setSharedKeepOpen(keepOpenForNext);
      setSharedCodesOpen(true);
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
      allowCrossMajor: Boolean(subjectDraft.allowCrossMajor),
      sharedMajorIds: subjectDraft.sharedMajorIds || [],
      canonicalSubjectId: null,
    };

    try {
      const response = counterpartCodes
        ? await axios.post(`${API_BASE_URL}/plan/subjects/shared`, {
          source: payload,
          counterparts: counterpartCodes.map((item) => ({
            majorId: item.majorId,
            codeNumber: Number(item.codeNumber),
            codeText: item.codeText.trim().toUpperCase(),
          })),
        }, { withCredentials: true })
        : await axios.post(`${API_BASE_URL}/plan/subjects`, payload, { withCredentials: true });
      const createdRows = counterpartCodes ? response.data.subjects : [response.data];
      const created = createdRows.find((item) => item.majorId === majorId) || createdRows[0];
      toast.success(counterpartCodes
        ? `Đã tạo học phần "${created.name}" cho ${createdRows.length} chuyên ngành`
        : `Đã thêm học phần "${created.name}"`);
      setSubjects((prev) => [...prev, created]);
      setSharedCodesOpen(false);
      loadMajors();

      if (keepOpenForNext) {
        setSubjectDraft(initialSubjectDraft(Number(subjectDraft.sortOrder || 0) + 1));
        if (firstDraftInputRef.current) firstDraftInputRef.current.focus();
      } else {
        setIsAddingSubject(false);
      }
    } catch (err) {
      toast.error(err.response?.status === 404
        ? "Máy chủ chưa có đường dẫn tạo học phần (POST /plan/subjects). Vui lòng cập nhật và khởi động lại backend."
        : err.response?.data?.message || "Không thể thêm học phần");
    }
  };

  const handleStartEditSubject = (s) => {
    setEditingSubjectId(s.id);
    setEditingSubjectForm({
      id: s.id,
      codeNumber: s.codeNumber,
      codeText: s.codeText || "",
      name: s.name,
      credits: s.credits ?? 3,
      majorAssignment: Boolean(s.majorAssignment),
      subjectType: s.subjectType || "CN",
      isRequired: s.isRequired !== false,
      sortOrder: s.sortOrder ?? 0,
      active: Boolean(s.active),
      canonicalSubjectId: null,
      allowCrossMajor: Array.isArray(s.sharedMajorIds) && s.sharedMajorIds.length > 0,
      sharedMajorIds: s.sharedMajorIds || [],
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
      allowCrossMajor: Boolean(editingSubjectForm.allowCrossMajor),
      sharedMajorIds: editingSubjectForm.sharedMajorIds || [],
      canonicalSubjectId: null,
    };

    try {
      const { data: updated } = await axios.put(
        `${API_BASE_URL}/plan/subjects/${editingSubjectForm.id}`,
        payload,
        { withCredentials: true }
      );
      toast.success("Cập nhật học phần thành công");
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
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

  // Loại học phần được chỉnh ngay tại Danh mục, không tải lại trang.
  const handleSubjectTypeChange = async (subject, subjectType) => {
    if (!isAdmin || subjectType === subject.subjectType || updatingSubjectTypeId) return;
    const previousType = subject.subjectType;
    setUpdatingSubjectTypeId(subject.id);
    setSubjects((current) => current.map((item) => (
      item.id === subject.id ? { ...item, subjectType } : item
    )));
    try {
      await axios.put(
        `${API_BASE_URL}/plan/subjects/${subject.id}`,
        { subjectType },
        { withCredentials: true }
      );
    } catch (err) {
      setSubjects((current) => current.map((item) => (
        item.id === subject.id ? { ...item, subjectType: previousType } : item
      )));
      toast.error(err.response?.data?.message || "Không thể cập nhật loại học phần");
    } finally {
      setUpdatingSubjectTypeId(null);
    }
  };

  const handleConfirmSharedCodes = () => {
    if (sharedCodes.some((item) => !item.codeNumber || !item.codeText?.trim())) {
      toast.error("Vui lòng nhập đủ mã số và mã chữ cho tất cả chuyên ngành");
      return;
    }
    handleSaveSubjectDraft(sharedKeepOpen, sharedCodes);
  };

  const handleSubjectSharingChange = async (subject, identity) => {
    const { data: updated } = await axios.put(
      `${API_BASE_URL}/plan/subjects/${subject.id}`,
      identity,
      { withCredentials: true }
    );
    setSubjects((prev) => prev.map((item) => (item.id === subject.id ? { ...item, ...updated } : item)));
  };

  const handleDeleteSubject = async (subject) => {
    try {
      await axios.delete(`${API_BASE_URL}/plan/subjects/${subject.id}`, { withCredentials: true });
      toast.success(`Đã xóa học phần "${subject.name}"`);
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
      setDeletingSubjectId(null);
      loadMajors();
      if (curriculumId) loadCurriculumDetail(curriculumId);
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
  // CURRICULUM ACTIONS
  // ==========================================
  const handleOpenCreateCurriculum = () => {
    const defaultYear = year || String(currentYear);
    const mCode = selectedMajor?.code || "NGANH";
    const mName = selectedMajor?.name || "";
    setCreateCurriculumForm({
      applicableFromYear: defaultYear,
      code: suggestCurriculumCode(mCode, defaultYear, curriculums),
      name: `Chương trình đào tạo ${mName} - Khóa ${defaultYear}`,
      autoPopulateFromCatalog: true,
      note: "",
    });
    setIsCreateCurriculumOpen(true);
  };

  const handleCreateCurriculum = async () => {
    if (!createCurriculumForm.code?.trim()) return toast.error("Vui lòng nhập mã chương trình đào tạo");
    if (!createCurriculumForm.name?.trim()) return toast.error("Vui lòng nhập tên chương trình đào tạo");
    if (!createCurriculumForm.applicableFromYear?.trim()) return toast.error("Vui lòng nhập khóa áp dụng");

    const newCode = createCurriculumForm.code.trim().toUpperCase();
    if (curriculums.some((c) => String(c.code || "").toUpperCase() === newCode)) {
      return toast.error(`Mã CTĐT "${newCode}" đã tồn tại. Mỗi CTĐT cần một mã riêng.`);
    }

    try {
      setMatrixSaving(true);
      const payload = {
        code: createCurriculumForm.code.trim().toUpperCase(),
        name: createCurriculumForm.name.trim(),
        majorId,
        program: level,
        applicableFromYear: createCurriculumForm.applicableFromYear.trim(),
        note: createCurriculumForm.note?.trim() || undefined,
        subjects: createCurriculumForm.autoPopulateFromCatalog ? undefined : [],
      };
      const { data: created } = await axios.post(`${API_BASE_URL}/plan/curriculums`, payload, { withCredentials: true });
      toast.success(`Đã lập thành công CTĐT cho khóa ${createCurriculumForm.applicableFromYear}`);
      setIsCreateCurriculumOpen(false);
      await loadData();
      setCurriculumId(created.id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tạo chương trình đào tạo");
    } finally {
      setMatrixSaving(false);
    }
  };

  const handleDeleteCurriculum = async (c) => {
    if (!isAdmin || matrixSaving) return;
    const linkedCount = (c.classGroups || []).length;
    if (linkedCount > 0) {
      return toast.warning(`Không thể xóa: Còn ${linkedCount} lớp đang theo học CTĐT này (${c.classGroups.map((g) => g.code).join(", ")})`);
    }
    if (!window.confirm(`Bạn có chắc muốn xóa chương trình đào tạo "${c.name}" (${c.code}) của Khóa ${c.applicableFromYear} không?`)) {
      return;
    }
    try {
      setMatrixSaving(true);
      await axios.delete(`${API_BASE_URL}/plan/curriculums/${c.id}`, { withCredentials: true });
      toast.success(`Đã xóa CTĐT "${c.name}"`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa chương trình đào tạo");
    } finally {
      setMatrixSaving(false);
    }
  };

  // Loại bỏ 1 học phần khỏi CTĐT của khóa
  const handleRemoveSubjectFromCurriculum = async (entry) => {
    if (!isAdmin || matrixSaving || !curriculum) return;
    if (!window.confirm(`Bạn có chắc muốn loại học phần "${entry.name}" (${entry.code}) khỏi chương trình đào tạo của khóa này không?\n(Học phần vẫn được lưu an toàn trong Danh mục học phần chung của ngành)`)) {
      return;
    }
    const nextEntries = curriculumSubjects
      .filter((row) => row.id !== entry.id)
      .map((row) => ({
        subjectId: row.subjectId,
        blockCode: row.blockCode || undefined,
        electiveGroupCode: row.electiveGroupCode || undefined,
        isRequired: Boolean(row.isRequired),
        credits: row.credits,
      }));
    try {
      setMatrixSaving(true);
      await axios.put(
        `${API_BASE_URL}/plan/curriculums/${curriculum.id}/subjects`,
        { subjects: nextEntries },
        { withCredentials: true }
      );
      toast.success(`Đã loại bỏ học phần "${entry.name}" khỏi CTĐT`);
      await loadCurriculumDetail(curriculum.id);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể loại bỏ học phần khỏi CTĐT");
    } finally {
      setMatrixSaving(false);
    }
  };

  // Làm sạch toàn bộ môn trong CTĐT để chọn lại từ đầu
  const handleClearAllSubjectsFromCurriculum = async () => {
    if (!isAdmin || matrixSaving || !curriculum) return;
    if (!window.confirm(`Bạn có chắc muốn làm sạch toàn bộ học phần trong CTĐT (${curriculum.code}) của khóa này để tự chọn lại từ đầu từ danh mục không?`)) {
      return;
    }
    try {
      setMatrixSaving(true);
      await axios.put(
        `${API_BASE_URL}/plan/curriculums/${curriculum.id}/subjects`,
        { subjects: [] },
        { withCredentials: true }
      );
      toast.success("Đã làm sạch CTĐT. Bạn có thể bấm 'Thêm học phần từ danh mục' để chọn các môn cần học!");
      await loadCurriculumDetail(curriculum.id);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể làm sạch CTĐT");
    } finally {
      setMatrixSaving(false);
    }
  };

  // Mở Dialog thêm môn từ danh mục
  const handleOpenAddSubjects = () => {
    setSelectedCatalogSubjectIds([]);
    setAddSubjectSearch("");
    setAddSubjectTypeFilter("ALL");
    setIsAddSubjectsOpen(true);
  };

  const handleToggleSelectSubject = (id) => {
    setSelectedCatalogSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllAvailable = () => {
    if (selectedCatalogSubjectIds.length === filteredAvailableSubjects.length) {
      setSelectedCatalogSubjectIds([]);
    } else {
      setSelectedCatalogSubjectIds(filteredAvailableSubjects.map((s) => s.id));
    }
  };

  const handleAddSubjectsToCurriculum = async () => {
    if (!curriculum || selectedCatalogSubjectIds.length === 0) return;
    const existingEntries = curriculumSubjects.map((row) => ({
      subjectId: row.subjectId,
      blockCode: row.blockCode || undefined,
      electiveGroupCode: row.electiveGroupCode || undefined,
      isRequired: Boolean(row.isRequired),
      credits: row.credits,
    }));

    const newEntries = selectedCatalogSubjectIds.map((id) => {
      const s = (catalogSubjects.length > 0 ? catalogSubjects : subjects).find((sub) => sub.id === id);
      return {
        subjectId: id,
        blockCode: s?.subjectType || "CN",
        isRequired: s?.isRequired !== false,
        credits: s?.credits ?? 3,
      };
    });

    try {
      setMatrixSaving(true);
      await axios.put(
        `${API_BASE_URL}/plan/curriculums/${curriculum.id}/subjects`,
        { subjects: [...existingEntries, ...newEntries] },
        { withCredentials: true }
      );
      toast.success(`Đã thêm ${newEntries.length} học phần vào chương trình đào tạo`);
      setIsAddSubjectsOpen(false);
      setSelectedCatalogSubjectIds([]);
      await loadCurriculumDetail(curriculum.id);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể thêm học phần vào CTĐT");
    } finally {
      setMatrixSaving(false);
    }
  };

  return (
    <FeatureLayout
      title="Kế hoạch đào tạo"
      group="Kế hoạch khóa mới"
      desc="Lập và quản lý kế hoạch đào tạo theo từng chuyên ngành: danh mục học phần, CTĐT theo khóa (khối kiến thức, bắt buộc/tự chọn) và lớp học — mỗi lớp chọn CTĐT mà lớp theo học."
      maxWidth={1440}
    >
      <ToastContainer position="top-right" newestOnTop autoClose={2500} limit={3} />

      {/* 1. TOP TOOLBAR: LEVEL, DISCIPLINE & MAJOR */}
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
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end" sx={{ width: { xs: "100%", md: "auto" }, flexGrow: 1 }}>
            <FilterSelectField label="Trình độ" sx={{ flex: "1 1 160px", minWidth: 160, width: { xs: "100%", sm: "auto" } }}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                {LEVELS.map((l) => (
                  <MenuItem key={l.value} value={l.value} sx={{ fontSize: 13 }}>
                    {l.label}
                  </MenuItem>
                ))}
            </FilterSelectField>

            <FilterSelectField label="Ngành" sx={{ flex: "1 1 250px", minWidth: 250, width: { xs: "100%", sm: "auto" } }}
                value={disciplineId}
                onChange={(e) => handleDisciplineChange(e.target.value)}
              >
                <MenuItem value="" sx={{ fontSize: 13 }}>Tất cả ngành</MenuItem>
                {disciplines.map((discipline) => (
                  <MenuItem key={discipline.id} value={discipline.id} sx={{ fontSize: 13 }}>
                    {disciplineOptionLabel(discipline)}
                  </MenuItem>
                ))}
            </FilterSelectField>

            <FilterSelectField label="Chuyên ngành" sx={{ flex: "2 1 320px", minWidth: 320, width: { xs: "100%", sm: "auto" } }}
                value={majorId}
                onChange={(e) => setMajorId(e.target.value)}
              >
                {filteredMajors.map((m) => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
                    {m.code} — {m.name} ({m.subjectCount} học phần)
                  </MenuItem>
                ))}
            </FilterSelectField>
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
                maxWidth: "none",
                py: 0.8,
                px: 2.5,
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                textTransform: "none",
                color: "#607486",
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
              label={`1. Danh mục học phần chuyên ngành (${subjects.length} môn)`}
            />
            <Tab
              icon={<ClassRounded sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={`2. Chương trình đào tạo theo khóa (${curriculumGroups.length} khóa · ${curriculums.length} CTĐT)`}
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
            alignItems={{ xs: "stretch", sm: "flex-end" }}
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-end" flexWrap="wrap">
              <FilterSearchField
                placeholder="Tìm kiếm mã HP, tên học phần..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                sx={{ width: { xs: "100%", sm: 260 } }}
              />

              <FilterSelectField label="Loại học phần" sx={{ minWidth: 150 }}
                  value={subjectTypeFilter}
                  onChange={(e) => setSubjectTypeFilter(e.target.value)}
                >
                  <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả loại HP</MenuItem>
                  {SUBJECT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                      {t.label}
                    </MenuItem>
                  ))}
              </FilterSelectField>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Typography variant="caption" sx={{ color: "#607486", fontWeight: 600, mr: 1 }}>
                Tổng: <strong style={{ color: "#172B3A" }}>{subjectStats.total}</strong> HP (
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
                  Thêm dòng mới
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Spreadsheet Table */}
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderColor: "#DFE4E8",
              borderRadius: "4px",
            }}
          >
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", color: "#172B3A", fontWeight: 700, fontSize: 12, py: "8px", borderBottom: "2px solid #DFE4E8" } }}>
                  <TableCell sx={{ width: 44, textAlign: "center" }}>STT</TableCell>
                  <TableCell sx={{ width: 95 }}>Mã số</TableCell>
                  <TableCell sx={{ width: 95 }}>Mã chữ</TableCell>
                  <TableCell>Tên môn học</TableCell>
                  <TableCell sx={{ width: 70, textAlign: "center" }}>Số TC</TableCell>
                  <TableCell sx={{ width: 100, textAlign: "center" }}>Loại HP</TableCell>
                  <TableCell sx={{ width: 120, textAlign: "center" }}>Học chung</TableCell>
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
                    <TableCell colSpan={isAdmin ? 12 : 11} align="center" sx={{ py: 5, color: "#607486" }}>
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
                            <SubjectSharingCheckbox
                              subject={{ ...editingSubjectForm, majorId, program: level }}
                              majors={majors}
                              disabled={!isAdmin}
                              onChange={(identity) => setEditingSubjectForm((current) => ({ ...current, ...identity }))}
                            />
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
                        <TableCell align="center" sx={{ color: "#607486", fontSize: 12 }}>
                          {index + 1}
                        </TableCell>
                        <TableCell sx={{ fontFamily: "inherit", color: "#172B3A" }}>
                          {row.codeNumber}
                        </TableCell>
                        <TableCell sx={{ fontFamily: "inherit", fontWeight: 700, color: "#173E75" }}>
                          {row.codeText}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {row.name}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {row.credits}
                        </TableCell>
                        <TableCell align="center">
                          <Select
                            size="small"
                            value={row.subjectType || "CN"}
                            disabled={!isAdmin || updatingSubjectTypeId === row.id}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => handleSubjectTypeChange(row, event.target.value)}
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              width: 72,
                              height: 28,
                              color: SUBJECT_TYPES.find((t) => t.value === row.subjectType)?.color || "#607486",
                              bgcolor: "#fff",
                              borderRadius: "14px",
                              "& .MuiSelect-select": { py: 0, pl: 1.25, pr: "24px !important" },
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: SUBJECT_TYPES.find((t) => t.value === row.subjectType)?.color || "#607486",
                              },
                              "&:hover .MuiOutlinedInput-notchedOutline": {
                                borderColor: SUBJECT_TYPES.find((t) => t.value === row.subjectType)?.color || "#607486",
                              },
                            }}
                          >
                            {SUBJECT_TYPES.map((type) => (
                              <MenuItem key={type.value} value={type.value} sx={{ fontSize: 12 }}>
                                {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell align="center">
                          <SubjectSharingCheckbox
                            subject={row}
                            majors={majors}
                            disabled={!isAdmin}
                            onChange={(identity) => handleSubjectSharingChange(row, identity)}
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
                                <Typography variant="caption" sx={{ color: "#8A9AAA" }}>—</Typography>
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" sx={{ color: "#607486", fontSize: 12 }}>
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
                                color: row.active ? "#137B3B" : "#607486",
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
                      <SubjectSharingCheckbox
                        subject={{ ...subjectDraft, majorId, program: level }}
                        majors={majors}
                        disabled={!isAdmin}
                        onChange={(identity) => setSubjectDraft((current) => ({ ...current, ...identity }))}
                      />
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
          <Stack direction="row" spacing={3} sx={{ mt: 1.5, color: "#607486", fontSize: 12 }}>
            <Typography variant="caption">
              💡 <strong>Mẹo thao tác Excel:</strong> Bấm <strong>Tab</strong> để chuyển ô · Bấm <strong>Enter</strong> để lưu và tạo dòng tiếp theo · Bấm <strong>Esc</strong> để hủy · Bấm đúp vào dòng để sửa.
            </Typography>
          </Stack>
        </Box>
      )}


      {!loading && majorId && tab === 1 && (
        /* TAB 2: CHƯƠNG TRÌNH ĐÀO TẠO THEO KHÓA */
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.25}
          alignItems="stretch"
          sx={{ minHeight: { xs: "auto", lg: 360 } }}
        >
          {/* LEFT PANE: CURRICULUMS LIST */}
          <Box sx={{ width: { xs: "100%", lg: "32%" }, display: "flex" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                width: "100%",
                minHeight: { xs: 320, lg: 360 },
                borderColor: "#D7E4EE",
                borderRadius: "10px",
                bgcolor: "#FFFFFF",
                boxShadow: "none",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173E75", fontSize: 12 }}>
                  CTĐT theo từng khóa
                  <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "#607486", fontWeight: 600 }}>
                    ({curriculumGroups.length} khóa · {curriculums.length} CTĐT)
                  </Typography>
                </Typography>

                {isAdmin && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddRounded />}
                    onClick={handleOpenCreateCurriculum}
                    sx={{
                      height: 28,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "none",
                      borderRadius: "8px",
                      bgcolor: "#0788B8",
                      boxShadow: "none",
                      "&:hover": { bgcolor: "#06729b", boxShadow: "none" },
                    }}
                  >
                   Lập CTĐT mới
                  </Button>
                )}
              </Stack>

              <TableContainer sx={{ maxHeight: 480, overflowY: "auto", border: "1px solid #D7E4EE", borderRadius: "8px", boxShadow: "none !important" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", fontWeight: 700, fontSize: 11, py: "6px" } }}>
                      <TableCell>Chương trình đào tạo</TableCell>
                      <TableCell sx={{ width: 62, textAlign: "center" }}>Tín chỉ</TableCell>
                      <TableCell sx={{ width: 110 }}>Lớp áp dụng</TableCell>
                      {isAdmin && <TableCell sx={{ width: 45, textAlign: "center" }}>Xóa</TableCell>}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {curriculums.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} align="center" sx={{ py: 4, color: "#607486", fontSize: 12 }}>
                          Chưa có chương trình đào tạo nào cho chuyên ngành này. Bấm <strong>"+ Lập CTĐT mới"</strong> để tạo khung CTĐT cho từng khóa học.
                        </TableCell>
                      </TableRow>
                    ) : (
                      curriculumGroups.map((group) => {
                        const groupClasses = countGroupClasses(group.items);

                        return (
                          <React.Fragment key={group.year}>
                            <TableRow>
                              <TableCell
                                colSpan={isAdmin ? 4 : 3}
                                sx={{
                                  bgcolor: "#E8F1F8",
                                  borderTop: "1px solid #C9DAE8",
                                  borderBottom: "1px solid #C9DAE8",
                                  py: "5px !important",
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#0F4C75", letterSpacing: 0.3 }}>
                                    KHÓA {group.year}
                                  </Typography>
                                  <Typography sx={{ fontSize: 10.5, color: "#5A7086" }}>
                                    · {group.items.length} CTĐT
                                  </Typography>
                                  <Typography sx={{ fontSize: 10.5, color: "#5A7086" }}>
                                    · {groupClasses} lớp
                                  </Typography>
                                </Stack>
                              </TableCell>
                            </TableRow>

                            {group.items.map((c) => {
                              const isSelected = c.id === curriculumId;
                              const linkedClasses = c.classGroups || [];
                              const classCodes = compactClassCodes(linkedClasses);

                              return (
                                <TableRow
                                  key={c.id}
                                  hover
                                  selected={isSelected}
                                  onClick={() => setCurriculumId(c.id)}
                                  sx={{
                                    cursor: "pointer",
                                    bgcolor: isSelected ? "#EBF5FB !important" : "inherit",
                                    borderLeft: isSelected ? "4px solid #0788B8" : "4px solid transparent",
                                    "& td": { py: "8px", fontSize: 12 },
                                  }}
                                >
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: "inherit", fontWeight: 700, color: "#173E75", display: "block" }}>
                                      {c.code}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#172B3A", display: "block", mt: 0.25, fontWeight: 500 }}>
                                      {c.name}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#137B3B", fontSize: 12 }}>
                                      {c.totalCredits || 0} TC
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {linkedClasses.length > 0 ? (
                                      <Tooltip title={`Lớp áp dụng: ${linkedClasses.map((g) => g.code).join(", ")}`}>
                                        <Chip
                                          size="small"
                                          label={`${linkedClasses.length} lớp: ${classCodes}`}
                                          sx={{
                                            height: 18,
                                            maxWidth: 104,
                                            fontSize: 10,
                                            fontWeight: 600,
                                            bgcolor: "#E6F4EA",
                                            color: "#137B3B",
                                            border: "1px solid #137B3B",
                                            "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" },
                                          }}
                                        />
                                      </Tooltip>
                                    ) : (
                                      <Chip
                                        size="small"
                                        label="Chưa gán lớp"
                                        sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: "#F1F5F9", color: "#8095A8" }}
                                      />
                                    )}
                                  </TableCell>

                                  {isAdmin && (
                                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                      <Tooltip title={linkedClasses.length > 0 ? "Không thể xóa khi còn lớp học áp dụng" : "Xóa CTĐT này"}>
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="error"
                                            disabled={linkedClasses.length > 0 || matrixSaving}
                                            onClick={() => handleDeleteCurriculum(c)}
                                            sx={{ p: 0.5 }}
                                          >
                                            <DeleteRounded sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* RIGHT PANE: CHƯƠNG TRÌNH ĐÀO TẠO CỦA KHÓA */}
          <Box sx={{ width: { xs: "100%", lg: "68%" }, display: "flex" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                width: "100%",
                minHeight: { xs: 360, lg: 360 },
                display: "flex",
                flexDirection: "column",
                borderColor: "#D7E4EE",
                borderRadius: "10px",
                bgcolor: "#FFFFFF",
                boxShadow: "none",
              }}
            >
              {!curriculumId || !curriculum ? (
                <Box sx={{ py: 6, textAlign: "center" }}>
                  <Alert severity="info" sx={{ borderRadius: "2px", mb: 2, maxWidth: 500, mx: "auto" }}>
                    Vui lòng chọn một chương trình đào tạo ở bảng bên trái hoặc bấm nút <strong>"+ Lập CTĐT mới"</strong> để bắt đầu.
                  </Alert>
                  {isAdmin && curriculums.length === 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddRounded />}
                      onClick={handleOpenCreateCurriculum}
                      sx={{
                        height: 32,
                        fontSize: 12,
                        fontWeight: 700,
                        bgcolor: "#0788B8",
                        textTransform: "none",
                        borderRadius: "2px",
                      }}
                    >
                      Lập CTĐT đầu tiên cho ngành
                    </Button>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: "flex", minHeight: 0, flex: 1, flexDirection: "column" }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    sx={{ mb: 0.75 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#173E75", fontSize: 14 }}>
                        {curriculum.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={curriculum.code}
                        sx={{ height: 24, fontSize: 11, fontWeight: 700, bgcolor: "#E6F4EA", color: "#137B3B", border: "1px solid #137B3B" }}
                      />
                      <Chip
                        size="small"
                        label={`Khóa ${curriculum.applicableFromYear || "—"}`}
                        sx={{ height: 24, fontSize: 11, fontWeight: 700, bgcolor: "#E1F0F8", color: "#0788B8", border: "1px solid #0788B8" }}
                      />
                      {matrixSaving && <CircularProgress size={14} sx={{ color: "#0788B8" }} />}
                      {(curriculum.classGroups || []).length > 0 && (
                        <Box sx={{ flexBasis: "100%", mt: "2px !important" }}>
                          <Tooltip title={`Các lớp áp dụng CTĐT này: ${curriculum.classGroups.map((g) => g.code).join(", ")}`}>
                            <Typography component="span" sx={{ color: "#607486", fontSize: 12, fontWeight: 500 }}>
                              {curriculum.classGroups.length} lớp đang áp dụng
                            </Typography>
                          </Tooltip>
                        </Box>
                      )}
                    </Stack>

                    {isAdmin && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AddRounded />}
                          onClick={handleOpenAddSubjects}
                          disabled={matrixSaving}
                          sx={{
                            height: 28,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: "8px",
                            bgcolor: "#0788B8",
                            boxShadow: "none",
                            whiteSpace: "nowrap",
                            "&:hover": { bgcolor: "#06729b", boxShadow: "none" },
                          }}
                        >
                          Thêm học phần từ danh mục
                        </Button>

                        {curriculumSubjects.length > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineRounded />}
                            onClick={handleClearAllSubjectsFromCurriculum}
                            disabled={matrixSaving}
                            sx={{
                              height: 28,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "none",
                              borderRadius: "8px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Làm sạch CTĐT
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={0.75} sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={`Bắt buộc: ${requiredCredits} TC`}
                      sx={{ height: 24, bgcolor: "#E6F4EA", color: "#137B3B", fontSize: 11, fontWeight: 700 }}
                    />
                    <Chip
                      size="small"
                      label={`Tự chọn: ${electiveCredits} TC`}
                      sx={{ height: 24, bgcolor: "#FEF3E2", color: "#B86216", fontSize: 11, fontWeight: 700 }}
                    />
                    <Chip
                      size="small"
                      label={`Tổng: ${requiredCredits + electiveCredits} TC / Chuẩn 60 TC`}
                      sx={{ height: 24, bgcolor: "#EAF4FB", color: "#0788B8", fontSize: 11, fontWeight: 700 }}
                    />
                    <Chip
                      size="small"
                      label={`${curriculumSubjects.length} học phần`}
                      sx={{ height: 24, bgcolor: "#F0F4F8", color: "#607486", fontSize: 11, fontWeight: 600 }}
                    />
                  </Stack>

                  <Alert
                    severity="info"
                    sx={{
                      mb: 0.75,
                      minHeight: 32,
                      py: 0,
                      px: 1,
                      border: "1px solid #DCE7EF",
                      borderRadius: "8px",
                      bgcolor: "#F8FAFC",
                      color: "#607486",
                      fontSize: 11,
                      alignItems: "center",
                      "& .MuiAlert-icon": { mr: 0.75, py: 0, fontSize: 15 },
                      "& .MuiAlert-message": { py: 0.5 },
                    }}
                  >
                    Loại học phần và trạng thái Bắt buộc / Tự chọn được chỉnh tại tab <strong>Danh mục học phần chuyên ngành</strong>. Dùng nút xóa để loại học phần khỏi CTĐT.
                  </Alert>

                  <TableContainer sx={{ border: "1px solid #D7E4EE", borderRadius: "8px", boxShadow: "none !important" }}>
                    <Table size="small" sx={{ minWidth: 640 }}>
                      <TableHead>
                        <TableRow sx={{ height: 42, "& th": { bgcolor: "#F0F4F8", color: "#172B3A", fontWeight: 700, fontSize: 13, py: "8px" } }}>
                          <TableCell sx={{ width: 36, textAlign: "center" }}>STT</TableCell>
                          <TableCell sx={{ width: 80 }}>Mã HP</TableCell>
                          <TableCell>Tên môn học</TableCell>
                          <TableCell sx={{ width: 50, textAlign: "center" }}>TC</TableCell>
                          <TableCell sx={{ width: 140 }}>Khối kiến thức</TableCell>
                          <TableCell sx={{ width: 95, textAlign: "center" }}>Loại</TableCell>
                          {isAdmin && <TableCell sx={{ width: 45, textAlign: "center" }}>Xóa</TableCell>}
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {curriculumSubjects.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 4, color: "#607486", fontSize: 12 }}>
                              Chương trình đào tạo hiện chưa có môn học nào. Hãy bấm <strong>"Thêm học phần từ danh mục"</strong> ở trên để chọn các môn học cho khóa này.
                            </TableCell>
                          </TableRow>
                        ) : (
                          curriculumSubjects.map((entry, index) => (
                            <TableRow key={entry.id} hover sx={{ height: 56, "& td": { py: "7px", fontSize: 13, verticalAlign: "middle" } }}>
                              <TableCell align="center" sx={{ color: "#607486", fontSize: 12 }}>
                                {index + 1}
                              </TableCell>
                              <TableCell sx={{ fontFamily: "inherit", fontWeight: 700, color: "#173E75" }}>
                                {entry.code}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>{entry.name}</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>{entry.credits}</TableCell>
                              <TableCell sx={{ color: "#607486", fontSize: 12 }}>
                                {SUBJECT_TYPES.find((type) => type.value === entry.blockCode)?.label
                                  || entry.blockName
                                  || entry.blockCode
                                  || "—"}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={entry.isRequired ? "Bắt buộc" : "Tự chọn"}
                                  sx={{
                                    height: 24,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "default",
                                    borderColor: entry.isRequired ? "#137B3B" : "#B86216",
                                    color: entry.isRequired ? "#137B3B" : "#B86216",
                                  }}
                                />
                              </TableCell>
                              {isAdmin && (
                                <TableCell align="center">
                                  <Tooltip title="Loại học phần khỏi CTĐT này">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      disabled={matrixSaving}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSubjectFromCurriculum(entry);
                                      }}
                                      sx={{ p: 0.5 }}
                                    >
                                      <DeleteRounded sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {(curriculum.electiveGroups || []).length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", display: "block", mb: 0.5 }}>
                        Nhóm tự chọn và số tín chỉ phải chọn
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(curriculum.electiveGroups || []).map((group) => (
                          <Chip
                            key={group.id}
                            size="small"
                            label={`${group.name}: tối thiểu ${group.minCredits} TC${group.maxCredits > 0 ? `, tối đa ${group.maxCredits} TC` : ""}`}
                            sx={{ height: 22, fontSize: 10, bgcolor: "#F7F9FA", color: "#172B3A", border: "1px solid #DFE4E8" }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          </Box>
        </Stack>
      )}

      {/* DIALOG: NHẬP MÃ RIÊNG CHO HỌC PHẦN LIÊN NGÀNH */}
      <Dialog open={sharedCodesOpen} onClose={() => setSharedCodesOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700, color: "#173E75" }}>
          Mã học phần theo từng chuyên ngành
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Thông tin tên môn, số tín chỉ và loại học phần được dùng chung; mỗi chuyên ngành phải có mã học phần riêng.
          </Alert>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography sx={{ flex: 1, fontWeight: 700 }}>{selectedMajor?.code} — {selectedMajor?.name}</Typography>
              <TextField size="small" label="Mã số" value={subjectDraft.codeNumber} disabled sx={{ width: 120 }} />
              <TextField size="small" label="Mã chữ" value={subjectDraft.codeText} disabled sx={{ width: 180 }} />
            </Stack>
            {sharedCodes.map((item, index) => {
              const targetMajor = majors.find((major) => major.id === item.majorId);
              return (
                <Stack key={item.majorId} direction="row" spacing={1.5} alignItems="center">
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>{targetMajor?.code} — {targetMajor?.name}</Typography>
                  <TextField size="small" type="number" label="Mã số" value={item.codeNumber}
                    inputProps={{ min: 1 }} sx={{ width: 120 }}
                    onChange={(event) => setSharedCodes((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, codeNumber: event.target.value } : row))} />
                  <TextField size="small" label="Mã chữ" value={item.codeText} sx={{ width: 180 }}
                    inputProps={{ maxLength: 20 }}
                    onChange={(event) => setSharedCodes((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, codeText: event.target.value.toUpperCase() } : row))} />
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSharedCodesOpen(false)}>Quay lại</Button>
          <Button variant="contained" onClick={handleConfirmSharedCodes}>Tạo cho tất cả chuyên ngành</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: THÊM HỌC PHẦN TỪ DANH MỤC VÀO CTĐT */}
      <Dialog
        open={isAddSubjectsOpen}
        onClose={() => setIsAddSubjectsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#173E75", fontSize: 16, pb: 1 }}>
          Thêm học phần vào CTĐT: {curriculum?.name || curriculum?.code}
          <Typography variant="caption" sx={{ display: "block", color: "#607486", fontWeight: 400, mt: 0.5 }}>
            Chọn các học phần từ Danh mục học phần chung của Viện hoặc học phần của ngành để đưa vào khung chương trình đào tạo của khóa {curriculum?.applicableFromYear || year}.
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 2 }}>
          {/* Search & Filter */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end" sx={{ mb: 2 }}>
            <FilterSearchField
              placeholder="Tìm theo mã hoặc tên học phần..."
              value={addSubjectSearch}
              onChange={(e) => setAddSubjectSearch(e.target.value)}
              sx={{ flexGrow: 1, width: { xs: "100%", sm: "auto" } }}
            />
            <FilterSelectField label="Khối học phần" sx={{ minWidth: 150, width: { xs: "100%", sm: "auto" } }}
                value={addSubjectTypeFilter}
                onChange={(e) => setAddSubjectTypeFilter(e.target.value)}
              >
                <MenuItem value="ALL" sx={{ fontSize: 12 }}>Tất cả khối HP</MenuItem>
                {SUBJECT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value} sx={{ fontSize: 12 }}>
                    {t.label}
                  </MenuItem>
                ))}
            </FilterSelectField>
          </Stack>

          {/* List of available subjects */}
          {availableCatalogSubjects.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: "2px" }}>
              Tất cả học phần trong Danh mục ngành đã có mặt trong CTĐT này. Nếu cần thêm môn mới, hãy khai báo tại Tab 1 (Danh mục học phần).
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 380, border: "1px solid #DFE4E8", borderRadius: "2px" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "#F0F4F8", fontWeight: 700, fontSize: 11, py: "6px" } }}>
                    <TableCell sx={{ width: 40, textAlign: "center" }}>
                      <Checkbox
                        size="small"
                        checked={
                          filteredAvailableSubjects.length > 0 &&
                          selectedCatalogSubjectIds.length === filteredAvailableSubjects.length
                        }
                        indeterminate={
                          selectedCatalogSubjectIds.length > 0 &&
                          selectedCatalogSubjectIds.length < filteredAvailableSubjects.length
                        }
                        onChange={handleToggleSelectAllAvailable}
                        sx={{ p: 0.2 }}
                      />
                    </TableCell>
                    <TableCell sx={{ width: 90 }}>Mã HP</TableCell>
                    <TableCell>Tên học phần</TableCell>
                    <TableCell sx={{ width: 50, textAlign: "center" }}>TC</TableCell>
                    <TableCell sx={{ width: 130 }}>Khối kiến thức</TableCell>
                    <TableCell sx={{ width: 110, textAlign: "center" }}>Phân loại</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAvailableSubjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: "#607486", fontSize: 12 }}>
                        Không tìm thấy học phần nào khớp với từ khóa tìm kiếm.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAvailableSubjects.map((s) => {
                      const isSelected = selectedCatalogSubjectIds.includes(s.id);
                      const typeObj = SUBJECT_TYPES.find((t) => t.value === s.subjectType) || {
                        label: s.subjectType || "CN",
                        color: "#173E75",
                      };
                      return (
                        <TableRow
                          key={s.id}
                          hover
                          selected={isSelected}
                          onClick={() => handleToggleSelectSubject(s.id)}
                          sx={{ cursor: "pointer", "& td": { py: "5px", fontSize: 12 } }}
                        >
                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSubject(s.id)}
                              sx={{ p: 0.2 }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: "inherit", fontWeight: 700, color: "#173E75" }}>
                            {s.codeText || s.codeNumber}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>{s.credits}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={typeObj.label}
                              sx={{
                                height: 22,
                                fontSize: 11,
                                fontWeight: 600,
                                bgcolor: `${typeObj.color}15`,
                                color: typeObj.color,
                                border: `1px solid ${typeObj.color}40`,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {s.isRequired !== false ? (
                              <Chip
                                size="small"
                                label="Bắt buộc"
                                sx={{
                                  height: 22,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  bgcolor: "#EAF7EE",
                                  color: "#137B3B",
                                  border: "1px solid #137B3B40",
                                }}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="Tự chọn"
                                sx={{
                                  height: 22,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  bgcolor: "#FFF4E5",
                                  color: "#B86216",
                                  border: "1px solid #B8621640",
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5, justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#173E75" }}>
            Đã chọn: <strong>{selectedCatalogSubjectIds.length}</strong> môn (
            {selectedCatalogSubjectIds
              .map((id) => subjects.find((s) => s.id === id)?.credits || 0)
              .reduce((a, b) => a + Number(b), 0)}{" "}
            TC)
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setIsAddSubjectsOpen(false)}
              sx={{ height: 32, fontSize: 12 }}
            >
              Hủy
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlaylistAddRounded />}
              disabled={selectedCatalogSubjectIds.length === 0 || matrixSaving}
              onClick={handleAddSubjectsToCurriculum}
              sx={{
                height: 32,
                fontSize: 12,
                fontWeight: 700,
                bgcolor: "#0788B8",
                textTransform: "none",
                "&:hover": { bgcolor: "#06729b" },
              }}
            >
              Thêm vào CTĐT ({selectedCatalogSubjectIds.length})
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* DIALOG: LẬP CTĐT KHÓA MỚI */}
      <Dialog
        open={isCreateCurriculumOpen}
        onClose={() => setIsCreateCurriculumOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#173E75", fontSize: 16, pb: 1 }}>
          Lập chương trình đào tạo theo khóa
          <Typography variant="caption" sx={{ display: "block", color: "#607486", fontWeight: 400, mt: 0.5 }}>
            Ngành: <strong>{selectedMajor?.name}</strong> ({selectedMajor?.code}) — Trình độ: {level === "doctorate" ? "Tiến sĩ" : "Thạc sĩ"}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "#607486", fontWeight: 400, mt: 0.25 }}>
            Một khóa có thể có nhiều CTĐT; mỗi lớp sẽ chọn CTĐT của mình ở trang “Tạo nhóm học viên”.
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ width: 150 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", mb: 0.5 }}>
                  Khóa áp dụng *
                </Typography>
                <Select
                  value={createCurriculumForm.applicableFromYear}
                  onChange={(e) => {
                    const y = e.target.value;
                    const mCode = selectedMajor?.code || "NGANH";
                    const mName = selectedMajor?.name || "";
                    setCreateCurriculumForm((p) => ({
                      ...p,
                      applicableFromYear: y,
                      code: suggestCurriculumCode(mCode, y, curriculums),
                      name: `Chương trình đào tạo ${mName} - Khóa ${y}`,
                    }));
                  }}
                  sx={{ height: 36, fontSize: 13 }}
                >
                  {YEARS.map((y) => (
                    <MenuItem key={y} value={y} sx={{ fontSize: 13 }}>
                      Khóa {y}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", mb: 0.5, display: "block" }}>
                  Mã CTĐT *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={createCurriculumForm.code}
                  onChange={(e) => setCreateCurriculumForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="VD: CT-KTPM-2025"
                  sx={cellInputSx}
                />
              </Box>
            </Stack>

            {(() => {
              const sameYear = curriculums.filter((c) => String(c.applicableFromYear) === String(createCurriculumForm.applicableFromYear));
              if (sameYear.length === 0) return null;
              return (
                <Alert severity="info" sx={{ borderRadius: "4px", py: 0.5 }}>
                  Khóa <strong>{createCurriculumForm.applicableFromYear}</strong> hiện đã có {sameYear.length} CTĐT:{" "}
                  {sameYear.map((c) => c.code).join(", ")}. Hệ thống cho phép một khóa có nhiều CTĐT — hãy đặt <strong>mã CTĐT khác nhau</strong> để phân biệt.
                </Alert>
              );
            })()}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", mb: 0.5, display: "block" }}>
                Tên chương trình đào tạo *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={createCurriculumForm.name}
                onChange={(e) => setCreateCurriculumForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="VD: Chương trình đào tạo Kỹ thuật phần mềm - Khóa 2025"
                sx={cellInputSx}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#173E75", mb: 0.5, display: "block" }}>
                Ghi chú
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={createCurriculumForm.note}
                onChange={(e) => setCreateCurriculumForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ghi chú về quyết định ban hành, thời gian áp dụng..."
                sx={cellInputSx}
              />
            </Box>

            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#F8FAFC", borderColor: "#E2E8F0", borderRadius: "4px" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createCurriculumForm.autoPopulateFromCatalog}
                    onChange={(e) => setCreateCurriculumForm((p) => ({ ...p, autoPopulateFromCatalog: e.target.checked }))}
                    size="small"
                    sx={{ color: "#0788B8", "&.Mui-checked": { color: "#0788B8" } }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#173E75" }}>
                      Tự động nạp sẵn các học phần từ Danh mục môn học của ngành
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#607486" }}>
                      Nếu bỏ chọn, CTĐT ban đầu sẽ trống và bạn có thể tự chọn từng môn từ danh mục vào sau.
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setIsCreateCurriculumOpen(false)}
            sx={{ height: 32, fontSize: 12 }}
          >
            Hủy
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={matrixSaving || !createCurriculumForm.code?.trim() || !createCurriculumForm.name?.trim()}
            onClick={handleCreateCurriculum}
            sx={{
              height: 32,
              fontSize: 12,
              fontWeight: 700,
              bgcolor: "#0788B8",
              textTransform: "none",
              "&:hover": { bgcolor: "#06729b" },
            }}
          >
            Lập chương trình đào tạo
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureLayout>
  );
};

export default TrainingPlan;
