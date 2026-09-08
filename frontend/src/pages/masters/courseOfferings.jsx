import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import "./courseOfferings.css";
import FeatureLayout from "../../components/FeatureLayout";
import CourseOfferingRoster, { participantKey } from "../../components/CourseOfferingRoster";
import { API_BASE_URL } from "../../config/http";

const rowsFrom = (data) => Array.isArray(data) ? data : data?.data || [];
const messageFrom = (error, fallback) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(". ") : message || fallback;
};
const textMatches = (text, search) => String(text || "").toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"));
const offeringGroups = (offering) => (offering?.groupLinks || []).map((link) => link.classGroup).filter(Boolean);
const SectionHeading = ({ number, children, count }) => <div className="co-section-heading"><span className="co-number">{number}</span><h2>{children}</h2>{count != null && <span className="co-count">{count}</span>}</div>;

export default function CourseOfferings() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const offeringId = params.get("offeringId") || "";
  const [step, setStep] = useState(offeringId ? 3 : 1);
  const [majors, setMajors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [majorId, setMajorId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewedId, setViewedId] = useState("");
  const [viewedRoster, setViewedRoster] = useState({ id: "", participants: [] });
  const [preview, setPreview] = useState({ key: "", participants: [] });
  const [notes, setNotes] = useState({});
  const [created, setCreated] = useState(null);
  const [savedName, setSavedName] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [successLoading, setSuccessLoading] = useState(Boolean(offeringId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const writing = useRef(false);
  const loadedOfferingId = useRef("");

  useEffect(() => {
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: "instant" });
  }, [step]);

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(API_BASE_URL + "/plan/training-plan?program=masters"),
      axios.get(API_BASE_URL + "/masters/class-groups"),
      axios.get(API_BASE_URL + "/auth/session"),
    ]).then(([majorResponse, groupResponse, authResponse]) => {
      if (!active) return;
      setMajors(rowsFrom(majorResponse.data).filter((major) => major.active !== false));
      setGroups(rowsFrom(groupResponse.data));
      setCanManage(authResponse.data?.user?.canManageScheduling === true);
    }).catch((failure) => { if (active) setError(messageFrom(failure, "Không tải được phạm vi tổ chức.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSubjects([]);
    if (!majorId || !academicYear) { setSubjectsLoading(false); return () => { active = false; }; }
    setSubjectsLoading(true);
    axios.get(API_BASE_URL + "/scheduling/course-offering-candidates?" + new URLSearchParams({ program: "masters", majorId, academicYear }))
      .then(({ data }) => { if (active) setSubjects(data.subjects || []); })
      .catch((failure) => { if (active) setError(messageFrom(failure, "Không tải được môn / học phần.")); })
      .finally(() => { if (active) setSubjectsLoading(false); });
    return () => { active = false; };
  }, [majorId, academicYear]);

  const selectionKey = selectedIds.slice().sort().join(",");
  useEffect(() => {
    let active = true;
    if (!selectionKey) { setPreview({ key: "", participants: [] }); return () => { active = false; }; }
    axios.post(API_BASE_URL + "/scheduling/course-offerings/participant-preview", { classGroupIds: selectionKey.split(",") })
      .then(({ data }) => { if (active) setPreview({ key: selectionKey, participants: data.participants || [] }); })
      .catch((failure) => { if (active) setError(messageFrom(failure, "Không tổng hợp được học viên.")); });
    return () => { active = false; };
  }, [selectionKey]);

  useEffect(() => {
    let active = true;
    if (!viewedId) { setViewedRoster({ id: "", participants: [] }); return () => { active = false; }; }
    axios.post(API_BASE_URL + "/scheduling/course-offerings/participant-preview", { classGroupIds: [viewedId] })
      .then(({ data }) => { if (active) setViewedRoster({ id: viewedId, participants: data.participants || [] }); })
      .catch((failure) => { if (active) setError(messageFrom(failure, "Không tải được học viên của lớp / nhóm.")); });
    return () => { active = false; };
  }, [viewedId]);

  useEffect(() => {
    let active = true;
    if (!offeringId || loadedOfferingId.current === offeringId) return () => { active = false; };
    setStep(3); setSuccessLoading(true);
    axios.get(API_BASE_URL + "/scheduling/course-offerings/" + offeringId)
      .then(({ data }) => {
        if (!active) return;
        loadedOfferingId.current = data.id;
        setCreated(data); setSavedName(data.name || ""); setNotes({});
      })
      .catch((failure) => { if (active) setError(messageFrom(failure, "Không tải được lớp học phần đã tạo.")); })
      .finally(() => { if (active) setSuccessLoading(false); });
    return () => { active = false; };
  }, [offeringId]);

  const years = useMemo(() => [...new Set(groups.filter((group) => group.majorId === majorId).map((group) => group.academicYear).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a), "vi", { numeric: true })), [groups, majorId]);
  const major = majors.find((item) => item.id === majorId);
  const candidate = subjects.find((item) => item.subject.id === subjectId);
  const sourceGroups = candidate?.eligibleClassGroups || [];
  const selectedGroups = sourceGroups.filter((group) => selectedIds.includes(group.id));
  const viewedGroup = sourceGroups.find((group) => group.id === viewedId);
  const previewReady = preview.key === selectionKey;
  const participants = previewReady ? preview.participants : [];
  const resetSelection = () => { setSubjectId(""); setSelectedIds([]); setViewedId(""); setNotes({}); setGroupSearch(""); };
  const reset = () => {
    setMajorId(""); setAcademicYear(""); resetSelection(); setSubjectSearch(""); setName("");
    setStep(1); setCreated(null); setSavedName(""); setError(""); setNotice(""); setParams({}, { replace: true });
  };
  const selectSubject = (id) => {
    setSubjectId(id); setSelectedIds([]); setNotes({}); setGroupSearch(""); setError("");
    setViewedId(subjects.find((item) => item.subject.id === id)?.eligibleClassGroups[0]?.id || "");
  };
  const toggleGroup = (group, checked) => {
    setError("");
    setSelectedIds((current) => checked ? [...current, group.id] : current.filter((id) => id !== group.id));
  };
  const continueToConfirmation = () => {
    setError(""); setNotice("");
    if (!majorId || !academicYear || !subjectId || !name.trim() || !selectedIds.length) {
      setError("Chọn chuyên ngành, khóa / năm, môn học, nhập tên lớp và chọn ít nhất một lớp / nhóm."); return;
    }
    if (!previewReady) { setError("Đang tổng hợp danh sách học viên, vui lòng chờ."); return; }
    setName(name.trim()); setStep(2);
  };
  const create = async () => {
    if (writing.current || !canManage) return;
    writing.current = true; setSaving(true); setError("");
    try {
      const participantNotes = participants.map((participant) => ({
        ...(participant.studentId ? { studentId: participant.studentId } : {}),
        ...(participant.admissionRecordId ? { admissionRecordId: participant.admissionRecordId } : {}),
        note: notes[participantKey(participant)] || "",
      }));
      const { data } = await axios.post(API_BASE_URL + "/scheduling/course-offerings", { name: name.trim(), subjectId, classGroupIds: selectedIds, participantNotes });
      loadedOfferingId.current = data.id;
      setCreated(data); setSavedName(data.name); setNotes({}); setStep(3);
      setParams({ offeringId: data.id }, { replace: true });
    } catch (failure) { setError(messageFrom(failure, "Không tạo được lớp học phần. Vui lòng kiểm tra và thử lại.")); }
    finally { writing.current = false; setSaving(false); }
  };
  const rename = async () => {
    if (!canManage || writing.current || !savedName.trim()) return;
    writing.current = true; setSaving(true); setError(""); setNotice("");
    try {
      await axios.put(API_BASE_URL + "/scheduling/course-offerings/" + created.id + "/name", { name: savedName.trim() });
      setCreated((current) => ({ ...current, name: savedName.trim() })); setSavedName(savedName.trim()); setNotice("Đã lưu tên lớp học phần.");
    } catch (failure) { setError(messageFrom(failure, "Không đổi được tên lớp học phần.")); }
    finally { writing.current = false; setSaving(false); }
  };
  const saveNotes = async () => {
    if (!canManage || writing.current) return;
    writing.current = true; setSaving(true); setError(""); setNotice("");
    try {
      for (const participant of created.participants || []) {
        const note = notes[participantKey(participant)];
        if (note === undefined || note === (participant.note || "")) continue;
        await axios.put(API_BASE_URL + "/scheduling/course-offerings/" + created.id + "/participants/" + participant.id + "/note", { note });
        setCreated((current) => ({ ...current, participants: current.participants.map((row) => row.id === participant.id ? { ...row, note } : row) }));
      }
      setNotes({}); setNotice("Đã lưu ghi chú học viên.");
    } catch (failure) { setError(messageFrom(failure, "Không lưu được toàn bộ ghi chú. Vui lòng thử lại.")); }
    finally { writing.current = false; setSaving(false); }
  };
  const changeNote = (identity, value) => setNotes((current) => ({ ...current, [identity]: value }));
  const savedGroups = offeringGroups(created);
  const displayGroups = step === 3 ? savedGroups : selectedGroups;
  const displaySubject = step === 3 ? created?.subject : candidate?.subject;
  const displayMajors = step === 3 ? [...new Set(savedGroups.map((group) => group.major?.name).filter(Boolean))].join(", ") : major?.name;
  const displayYears = step === 3 ? [...new Set(savedGroups.map((group) => group.academicYear).filter(Boolean))].join(", ") : academicYear;
  const dirtyNotes = (created?.participants || []).some((participant) => notes[participantKey(participant)] !== undefined
    && notes[participantKey(participant)] !== (participant.note || ""));


  const classSummary = <Box className="co-class-summary">
    <div className="co-muted-label">LỚP HỌC PHẦN</div>
    <h2 className="co-class-name">{step === 3 ? created?.name : name}</h2>
    <div className="co-metadata">
      <div><span>Học phần</span><p>{displaySubject?.name || "—"}</p></div>
      <div><span>Số tín chỉ</span><p>{displaySubject?.credits ?? "—"}</p></div>
      <div><span>Năm</span><p>{displayYears || "—"}</p></div>
      <div><span>Chuyên ngành</span><p>{displayMajors || "—"}</p></div>
    </div>
    <div className="co-muted-label">Lớp / Khóa tham gia</div>
    <div className="co-tags">{displayGroups.map((group) => <Chip key={group.id} label={group.name} />)}</div>
  </Box>;

  return <FeatureLayout title="Tạo lớp học phần">
    <Box className="course-offering-flow">
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {!loading && !canManage && <Alert severity="info">Bạn có thể xem thông tin. Cần quyền quản lý xếp lịch để tạo hoặc chỉnh sửa lớp học phần.</Alert>}
      {loading && <Typography role="status">Đang tải phạm vi tổ chức...</Typography>}
      {step === 1 && <div className="co-create-grid">
        <Paper component="aside" variant="outlined" className="co-scope co-panel">
          <div className="co-scope-filters">
            <h2 className="co-small-heading">PHẠM VI TỔ CHỨC</h2>
            <SectionHeading number="1">CHUYÊN NGÀNH</SectionHeading>
            <TextField select fullWidth className="co-scope-field" label="Chuyên ngành" value={majorId} disabled={loading} onChange={(event) => {
              setMajorId(event.target.value); setAcademicYear(""); resetSelection(); setError("");
            }}><MenuItem value="">Chọn chuyên ngành</MenuItem>{majors.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name}</MenuItem>)}</TextField>
            <SectionHeading number="2">KHÓA / NĂM HỌC</SectionHeading>
            <TextField select fullWidth className="co-scope-field" label="Khóa / Năm học" value={academicYear} disabled={!majorId} onChange={(event) => {
              setAcademicYear(event.target.value); resetSelection(); setError("");
            }}><MenuItem value="">Chọn khóa / năm</MenuItem>{years.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}</TextField>
          </div>
          <div className="co-subjects">
            <SectionHeading number="3" count={subjects.length}>HỌC PHẦN CÒN CẦN TỔ CHỨC</SectionHeading>
            <TextField fullWidth placeholder="Tìm học phần..." inputProps={{ "aria-label": "Tìm môn / học phần" }}
              InputProps={{ startAdornment: <SearchIcon className="co-search-icon" /> }} value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} />
            {subjectsLoading && <Typography role="status" sx={{ mt: 2 }}>Đang tải môn học...</Typography>}
            {!subjectsLoading && !academicYear && <p className="co-empty">Chọn chuyên ngành và khóa / năm để xem môn học.</p>}
            {!subjectsLoading && academicYear && !subjects.length && <p className="co-empty">Chưa có môn cần tổ chức trong phạm vi này. Kiểm tra gói học phần chính thức của các lớp / nhóm.</p>}
            <div className="co-subject-list" role="list" aria-label="Môn / học phần còn cần tổ chức">
              {subjects.filter((item) => textMatches(item.subject.code + " " + item.subject.name, subjectSearch)).map((item) => <Button key={item.subject.id}
                className="co-subject-card" aria-pressed={subjectId === item.subject.id} variant="outlined" onClick={() => selectSubject(item.subject.id)}>
                <span><strong className="co-subject-code">{item.subject.code}</strong>
                  <span className="co-subject-name">{item.subject.name}</span>
                  <span className="co-caption">{item.eligibleClassGroups.length} lớp / nhóm có thể chọn</span></span>
              </Button>)}
            </div>
          </div>
        </Paper>
        <Paper component="section" variant="outlined" className="co-organize co-panel">
          <div className="co-name-block">
            <h1 className="co-small-heading">TẠO LỚP HỌC PHẦN</h1>
            <label className="co-name-label" htmlFor="course-offering-name">Tên lớp học phần *</label>
            <TextField id="course-offering-name" fullWidth required value={name} disabled={!canManage}
              inputProps={{ maxLength: 200 }} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="co-participation-grid">
            <div className="co-groups">
              <SectionHeading number="1">LỚP / NHÓM THAM GIA</SectionHeading>
              <TextField fullWidth inputProps={{ "aria-label": "Tìm lớp / nhóm" }} placeholder="Tìm lớp / nhóm..." value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} />
              {!candidate && <p className="co-empty">Chọn một môn học ở phạm vi tổ chức.</p>}
              <div className="co-group-list">
                {sourceGroups.filter((group) => textMatches(group.code + " " + group.name, groupSearch)).map((group) => {
                  const selected = selectedIds.includes(group.id);
                  const blockedMerge = !selected && selectedGroups.length > 0 && (!group.canMerge || selectedGroups.some((item) => !item.canMerge));
                  return <div key={group.id} className={"co-group-row" + (viewedId === group.id ? " is-viewed" : "")}>
                    <Checkbox checked={selected} inputProps={{ "aria-label": "Chọn " + group.name }} disabled={!canManage || blockedMerge}
                      onChange={(event) => toggleGroup(group, event.target.checked)} />
                    <Button className="co-group-preview-button" onClick={() => setViewedId(group.id)} aria-label={"Xem " + group.name} aria-pressed={viewedId === group.id}>
                      <span className="co-group-description"><strong>{group.name}</strong><span>{group.major?.name || major?.name}{group.canMerge ? "" : " · Xếp riêng"}</span></span>
                      <span className="co-group-status"><span>{group.memberCount || 0} học viên</span>{viewedId === group.id && <span className="co-viewed-badge">ĐANG XEM</span>}</span>
                    </Button>
                  </div>;
                })}
              </div>
              {selectedGroups.some((group) => !group.canMerge) && <p className="co-caption">Lớp / nhóm này xếp riêng. Chỉ chọn nhiều lớp khi các gói học phần đều cho phép ghép.</p>}
            </div>
            <div className="co-preview" data-testid="source-roster">
              <SectionHeading number="2">HỌC VIÊN CỦA LỚP / NHÓM</SectionHeading>
              {viewedGroup ? <>
                <div className="co-preview-heading"><strong>{viewedGroup.name}</strong><span>{viewedRoster.id === viewedId ? viewedRoster.participants.length + " học viên" : "Đang tải..."}</span></div>
                {viewedRoster.id !== viewedId ? <Typography role="status">Đang tải học viên...</Typography> : <>
                  <div className="co-preview-list">
                    {viewedRoster.participants.map((participant, index) => <div key={participantKey(participant)} className="co-preview-learner">
                      <span className="co-ordinal">{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{participant.fullName}</strong><span>{participant.regNo || "—"}</span></div>
                    </div>)}
                  </div>
                  {!viewedRoster.participants.length && <p className="co-empty">Lớp / nhóm chưa có học viên.</p>}
                </>}
              </> : <p className="co-empty">Bấm tên lớp / nhóm để xem học viên. Việc xem giữ nguyên các lớp đã chọn.</p>}
            </div>
          </div>
          <div className="co-selection-footer">
            <div aria-label="Tổng hợp lớp đã chọn">
              <div className="co-totals"><strong>{selectedIds.length} LỚP / NHÓM ĐÃ CHỌN</strong><strong>{previewReady ? participants.length + " HỌC VIÊN" : "Đang tổng hợp học viên..."}</strong></div>
              <div className="co-tags">{selectedGroups.map((group) => <Chip key={group.id} label={group.name + " · " + (group.memberCount || 0) + " HV"} />)}</div>
            </div>
            <div className="co-actions">
              <Button variant="outlined" onClick={reset}>LÀM LẠI</Button>
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={continueToConfirmation} disabled={!canManage || loading || !previewReady}>TIẾP TỤC</Button>
            </div>
          </div>
        </Paper>
      </div>}
      {step === 2 && <Paper variant="outlined" className="co-confirm co-panel">
        <header className="co-confirm-header"><h1>XÁC NHẬN LỚP HỌC PHẦN</h1><p>Kiểm tra thông tin trước khi tạo</p></header>
        {classSummary}
        <div className="co-confirm-roster"><CourseOfferingRoster participants={participants} notes={notes} onNoteChange={changeNote} disabled={!canManage || saving} /></div>
        <div className="co-actions co-confirm-actions">
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => { setStep(1); setError(""); }} disabled={saving}>QUAY LẠI CHỈNH SỬA</Button>
          <Button variant="contained" onClick={create} disabled={!canManage || saving}>XÁC NHẬN TẠO LỚP HỌC PHẦN</Button>
        </div>
      </Paper>}
      {step === 3 && <div className="co-success-stage">
        <Paper variant="outlined" className="co-success co-panel">
          {successLoading ? <Typography role="status">Đang tải lớp học phần đã tạo...</Typography> : created ? <>
            <div className="co-success-icon"><CheckIcon /></div>
            <h1 className="co-success-label">ĐÃ TẠO LỚP HỌC PHẦN</h1>
            <h2 className="co-class-name">{created.name}</h2>
            <p className="co-success-subtitle">{displayMajors || "—"} · Năm {displayYears || "—"}</p>
            <div className="co-success-summary">
              <div className="co-totals"><strong>{savedGroups.length} lớp / nhóm</strong><strong>{created.participants?.length ?? created.participantCount ?? 0} học viên</strong></div>
              <div className="co-success-groups">{savedGroups.map((group) => <span key={group.id}>{group.name}</span>)}</div>
            </div>
            <div className="co-actions co-success-actions">
              <Button variant="outlined" onClick={reset} disabled={saving}>TẠO LỚP HỌC PHẦN KHÁC</Button>
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate("/masters/schedule?offeringId=" + created.id)} disabled={saving}>SANG XẾP LỊCH</Button>
            </div>
          </> : <Button onClick={reset}>QUAY LẠI TẠO LỚP HỌC PHẦN</Button>}
        </Paper>
        {created && !successLoading && <details className="co-saved-details">
          <summary>Xem danh sách học viên / Đổi tên lớp</summary>
          <Paper variant="outlined" className="co-panel co-details-panel">
            {classSummary}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ my: 3 }}>
              <TextField fullWidth size="small" label="Tên lớp học phần" value={savedName} inputProps={{ maxLength: 200 }} disabled={!canManage || saving} onChange={(event) => setSavedName(event.target.value)} />
              {canManage && <Button onClick={rename} disabled={saving || !savedName.trim() || savedName.trim() === created.name} sx={{ minWidth: 115 }}>Đổi tên</Button>}
            </Stack>
            <CourseOfferingRoster participants={created.participants || []} notes={notes} onNoteChange={changeNote} disabled={!canManage || saving} />
            {canManage && <Button onClick={saveNotes} disabled={saving || !dirtyNotes} sx={{ mt: 1 }}>Lưu ghi chú</Button>}
          </Paper>
        </details>}
      </div>}
    </Box>
  </FeatureLayout>;
}
