import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, InputAdornment, Radio, RadioGroup, TextField, Tooltip } from "@mui/material";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { ReactComponent as PdfFileIcon } from "../../assets/icons/filetype-pdf.svg";
import { ReactComponent as WordFileIcon } from "../../assets/icons/filetype-docx.svg";
import { API_BASE_URL } from "../../config/http";
import { learnerTranscriptFilename, normalizeLearnerTranscript } from "./learnerTranscript";
import { openLearnerTranscriptPdfPreview } from "./learnerTranscriptPdfPreview";
import { createLearnerTranscriptWord } from "./learnerTranscriptWord";
import { downloadDocumentFile, sanitizeDocumentFilenamePart } from "../../utils/documentFiles";
import { createLearnerTranscriptPdf } from "./learnerTranscriptPdf";
import { fetchClassTranscripts, generateTranscriptDocuments, selectTranscriptScorecards } from "./learnerTranscriptBatch";
import { packTranscriptZip } from "./learnerTranscriptZip";
import "./learnerTranscript.css";

const missingProfile = "Chưa có hồ sơ học viên phù hợp để tạo bảng điểm.";
const message = (error) => error.response?.data?.message || error.message || "Không tải được dữ liệu.";

export default function LearnerTranscriptDialog({ classGroupId, onClose }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("word");
  const [selected, setSelected] = useState(() => new Set());
  const [previewing, setPreviewing] = useState("");
  const pending = useRef(null);
  const exportRequest = useRef(null);

  useEffect(() => {
    let active = true;
    setRoster(null); setLoading(true); setError(""); setSelected(new Set()); setSearch("");
    setPreviewError(""); setPreviewing("");
    setExportError(""); setExporting(false);
    axios.get(`${API_BASE_URL}/reports/class-score-summary/roster`, { params: { classGroupId } })
      .then(({ data }) => { if (active) setRoster(data); })
      .catch(failure => { if (active) setError(message(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [classGroupId, reload]);

  useEffect(() => () => {
    if (pending.current) { pending.current.active = false; pending.current.tab?.close(); pending.current = null; }
    if (exportRequest.current) { exportRequest.current.active = false; exportRequest.current = null; }
  }, [classGroupId]);

  const students = roster?.students || [];
  const selectedStudent = selected.size === 1 ? students.find(student => selected.has(student.participantId)) : null;
  const canExportSingle = !!selectedStudent?.admissionRecordId && selectedStudent.canPreview !== false;
  const canExport = selected.size > 1 || canExportSingle;
  const query = search.trim().toLocaleLowerCase("vi");
  const visible = students.filter(student => [student.code, student.fullName, student.lastName, student.firstName]
    .join(" ").toLocaleLowerCase("vi").includes(query));
  const toggle = (id) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const preview = async (student) => {
    if (!student.admissionRecordId || student.canPreview === false || pending.current || exportRequest.current) return;
    setPreviewError("");
    const request = { active: true, tab: window.open("about:blank", "_blank") };
    if (!request.tab) { setPreviewError("Trình duyệt đã chặn tab xem trước. Vui lòng cho phép mở tab mới và thử lại."); return; }
    request.tab.opener = null;
    pending.current = request;
    setPreviewing(student.participantId);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/reports/learner-scorecard/${student.admissionRecordId}`, { params: { classGroupId } });
      if (request.active) {
        await openLearnerTranscriptPdfPreview(normalizeLearnerTranscript(data), request.tab,
          { isCancelled: () => !request.active });
      }
    } catch (failure) {
      request.tab.close();
      if (request.active) setPreviewError(message(failure));
    } finally {
      if (request.active) { pending.current = null; setPreviewing(""); }
    }
  };

  const exportSingle = async () => {
    if (!canExport || exportRequest.current || pending.current) return;
    const request = { active: true };
    exportRequest.current = request;
    setExporting(true); setExportError("");
    try {
      if (selected.size > 1) {
        const selectedIds = new Set(selected);
        const data = await fetchClassTranscripts(classGroupId);
        if (!request.active) return;
        const scorecards = selectTranscriptScorecards(data.scorecards, selectedIds);
        const documents = await generateTranscriptDocuments(scorecards, format, { isCancelled: () => !request.active });
        if (!request.active) return;
        const zip = await packTranscriptZip(documents, format);
        if (request.active) downloadDocumentFile(zip, `Bang-diem-${sanitizeDocumentFilenamePart(data.classGroup.code || classGroupId)}-${format === "pdf" ? "PDF" : "Word"}.zip`);
        return;
      }
      // Fetch a fresh scorecard rather than reusing a potentially stale preview.
      const { data } = await axios.get(`${API_BASE_URL}/reports/learner-scorecard/${selectedStudent.admissionRecordId}`, { params: { classGroupId } });
      if (!request.active) return;
      const transcript = normalizeLearnerTranscript(data);
      const generate = format === "pdf" ? createLearnerTranscriptPdf : createLearnerTranscriptWord;
      const blob = await generate(transcript);
      if (request.active) downloadDocumentFile(blob, learnerTranscriptFilename(transcript, format));
    } catch (failure) {
      if (request.active) setExportError(message(failure));
    } finally {
      if (request.active) { exportRequest.current = null; setExporting(false); }
    }
  };

  return <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="transcript-dialog-title" className="transcript-dialog">
    <DialogTitle id="transcript-dialog-title" className="transcript-dialog-heading">
      <span>XUẤT BẢNG ĐIỂM CÁ NHÂN</span>
      <p className="transcript-class"><strong>{roster?.classGroup?.code || roster?.classGroup?.name || "Lớp hiện tại"}</strong>
        <span aria-hidden="true"> · </span><span>{students.length} học viên</span></p>
    </DialogTitle>
    <DialogContent className="transcript-dialog-content">
      <div className="transcript-controls">
        <div className="transcript-export-settings">
          <span className="transcript-section-label">Định dạng xuất</span>
          <RadioGroup row className="transcript-format-options" aria-label="Định dạng bảng điểm" value={format} onChange={event => setFormat(event.target.value)}>
            <FormControlLabel className={`transcript-format-option${format === "pdf" ? " is-selected" : ""}`} value="pdf" control={<Radio size="small" />}
              label={<span className="transcript-format-label"><PdfFileIcon className="transcript-file-icon transcript-file-icon-pdf" aria-hidden="true" focusable="false" />PDF</span>} disabled={exporting} />
            <FormControlLabel className={`transcript-format-option${format === "word" ? " is-selected" : ""}`} value="word" control={<Radio size="small" />}
              label={<span className="transcript-format-label"><WordFileIcon className="transcript-file-icon transcript-file-icon-word" aria-hidden="true" focusable="false" />Word</span>} disabled={exporting} />
          </RadioGroup>
          <p className="transcript-format-note">1 học viên: tải file trực tiếp · Nhiều học viên: tải gói ZIP</p>
        </div>
        <div className="transcript-selection-controls">
          <FormControlLabel control={<Checkbox disabled={loading || !!error || !students.length || exporting}
            checked={students.length > 0 && selected.size === students.length}
            indeterminate={selected.size > 0 && selected.size < students.length}
            onChange={event => setSelected(event.target.checked ? new Set(students.map(student => student.participantId)) : new Set())} />} label="Chọn tất cả học viên" />
          <span className="transcript-selection-count" role="status">Đã chọn <strong>{selected.size} / {students.length}</strong> học viên</span>
          <Button variant="contained" disabled={!canExport || loading || !!error || exporting || !!previewing}
            className="transcript-export-button" disableElevation startIcon={<DownloadRounded />} aria-busy={exporting} onClick={exportSingle}>{exporting ? "Đang xuất..." : selected.size ? `Xuất ${selected.size} bảng điểm` : "Xuất bảng điểm"}</Button>
        </div>
        {selectedStudent && !canExportSingle && <p className="transcript-format-note">{missingProfile}</p>}
        <TextField className="transcript-search" fullWidth size="small" placeholder="Tìm theo mã HV, họ tên..." value={search} disabled={loading || !!error || exporting}
          onChange={event => setSearch(event.target.value)} inputProps={{ maxLength: 200, "aria-label": "Tìm theo mã HV, họ tên..." }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded aria-hidden="true" /></InputAdornment> }} />
      </div>
      {loading && <div className="transcript-empty" role="status"><CircularProgress size={24} /> Đang tải danh sách học viên...</div>}
      {error && <Alert severity="error" action={<Button onClick={() => setReload(value => value + 1)}>Thử lại</Button>}>{error}</Alert>}
      {previewError && <Alert severity="error">{previewError}</Alert>}
      {exportError && <Alert severity="error">{exportError}</Alert>}
      {!loading && !error && <div className="transcript-roster" aria-label="Danh sách học viên của lớp">
        {visible.map(student => {
          const canPreview = !!student.admissionRecordId && student.canPreview !== false;
          return <div className={`transcript-roster-row${selected.has(student.participantId) ? " is-selected" : ""}`} key={student.participantId}>
            <FormControlLabel control={<Checkbox disabled={exporting} checked={selected.has(student.participantId)} onChange={() => toggle(student.participantId)} />}
              label={<span className="transcript-student-label"><strong>{student.code || "—"}</strong><span>{student.fullName || [student.lastName, student.firstName].filter(Boolean).join(" ") || "—"}</span></span>} />
            <Tooltip title={canPreview ? "" : missingProfile}><span className="transcript-preview-action"><Button className="transcript-preview-button" startIcon={<VisibilityOutlined />} disabled={!canPreview || !!previewing || exporting}
              onClick={() => preview(student)} aria-label={`Xem trước ${student.code || student.fullName}`}>
              {previewing === student.participantId ? "Đang mở..." : "Xem trước"}
            </Button></span></Tooltip>
            {!canPreview && <small>{missingProfile}</small>}
          </div>;
        })}
        {!visible.length && <p className="transcript-empty">{students.length ? "Không có học viên phù hợp với tìm kiếm." : "Lớp chưa có học viên."}</p>}
      </div>}
    </DialogContent>
    <DialogActions className="transcript-dialog-footer"><Button onClick={onClose}>Đóng</Button></DialogActions>
  </Dialog>;
}
