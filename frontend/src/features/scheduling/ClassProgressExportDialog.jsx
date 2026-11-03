import React, { useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  InputAdornment, Radio, RadioGroup, TextField } from "@mui/material";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { ReactComponent as PdfFileIcon } from "../../assets/icons/filetype-pdf.svg";
import { ReactComponent as WordFileIcon } from "../../assets/icons/filetype-docx.svg";
import { ReactComponent as ExcelFileIcon } from "../../assets/icons/filetype-xlsx.svg";
import "../learners/learnerTranscript.css";

const formats = [
  { value: "pdf", label: "PDF", Icon: PdfFileIcon },
  { value: "word", label: "Word", Icon: WordFileIcon },
  { value: "excel", label: "Excel", Icon: ExcelFileIcon },
];
const searchable = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

export default function ClassProgressExportDialog({ classes, selectedIds, onSelectionChange, format, onFormatChange,
  exporting, error, disabled, onClose, onExport, onPreview }) {
  const [search, setSearch] = useState("");
  const selected = classes.filter(group => selectedIds.includes(group.id));
  const visible = classes.filter(group => searchable([group.code, group.name, group.academicYear].join(" ")).includes(searchable(search.trim())));
  const toggle = id => onSelectionChange(selectedIds.includes(id) ? selectedIds.filter(value => value !== id) : [...selectedIds, id]);
  return <Dialog open onClose={exporting ? undefined : onClose} fullWidth maxWidth="md"
    aria-labelledby="progress-export-dialog-title" className="transcript-dialog app-popup">
    <DialogTitle id="progress-export-dialog-title" className="transcript-dialog-heading">
      <span>XUẤT BÁO CÁO TIẾN ĐỘ</span>
      <p className="transcript-class">{classes.length} lớp học viên trong phạm vi đã chọn</p>
    </DialogTitle>
    <DialogContent className="transcript-dialog-content">
      <div className="transcript-controls">
        <div className="transcript-export-settings">
          <span className="transcript-section-label">Định dạng xuất</span>
          <RadioGroup row className="transcript-format-options" aria-label="Định dạng báo cáo tiến độ" value={format}
            onChange={event => onFormatChange(event.target.value)}>
            {formats.map(({ value, label, Icon }) => <FormControlLabel key={value}
              className={`transcript-format-option${format === value ? " is-selected" : ""}`} value={value}
              control={<Radio size="small" />} disabled={exporting}
              label={<span className="transcript-format-label"><Icon className={`transcript-file-icon transcript-file-icon-${value}`} aria-hidden="true" />{label}</span>} />)}
          </RadioGroup>
          <p className="transcript-format-note">Mỗi lớp một file riêng. Chọn nhiều lớp: tải gói ZIP. Chọn một lớp: PDF xem trước để in hoặc lưu; Word, Excel tải trực tiếp.</p>
        </div>
        <div className="transcript-selection-controls">
          <FormControlLabel control={<Checkbox disabled={!classes.length || exporting}
            checked={!!classes.length && selected.length === classes.length} indeterminate={selected.length > 0 && selected.length < classes.length}
            onChange={event => onSelectionChange(event.target.checked ? classes.map(group => group.id) : [])} />} label="Chọn tất cả lớp" />
          <span className="transcript-selection-count" role="status">Đã chọn <strong>{selected.length} / {classes.length}</strong> lớp</span>
          <Button variant="contained" className="transcript-export-button" disableElevation startIcon={<DownloadRounded />}
            disabled={!selected.length || disabled || exporting} aria-busy={exporting} onClick={onExport}>
            {exporting ? "Đang xuất..." : selected.length ? `Xuất ${selected.length} báo cáo` : "Xuất báo cáo"}
          </Button>
        </div>
        <TextField className="transcript-search" fullWidth size="small" placeholder="Tìm theo mã lớp, tên lớp..." value={search} disabled={exporting}
          onChange={event => setSearch(event.target.value)} inputProps={{ maxLength: 200, "aria-label": "Tìm lớp cần xuất" }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded aria-hidden="true" /></InputAdornment> }} />
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="transcript-roster" aria-label="Danh sách lớp cần xuất">
        {visible.map(group => <div className={`transcript-roster-row${selectedIds.includes(group.id) ? " is-selected" : ""}`} key={group.id}>
          <FormControlLabel control={<Checkbox disabled={exporting} checked={selectedIds.includes(group.id)} onChange={() => toggle(group.id)} />}
            label={<span className="transcript-student-label"><strong>{group.code || group.name}</strong><span>Khóa {group.academicYear || "—"}</span></span>} />
          <Button className="transcript-preview-button" startIcon={<VisibilityOutlined />} disabled={disabled || exporting}
            onClick={() => onPreview(group)} aria-label={`Xem trước ${group.code || group.name}`}>Xem trước</Button>
        </div>)}
        {!visible.length && <p className="transcript-empty">Không có lớp phù hợp với tìm kiếm.</p>}
      </div>
    </DialogContent>
    <DialogActions className="transcript-dialog-footer"><Button onClick={onClose} disabled={exporting}>Đóng</Button></DialogActions>
  </Dialog>;
}
