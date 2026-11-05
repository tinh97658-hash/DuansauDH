import React, { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, XMarkIcon } from "../../components/AppIcons";
import { formatDateTime } from "../../utils/dateFormat";
import { formatScore, RESULT_LABELS } from "./gradebook";
import "./gradebookHistory.css";

const ACTION_LABELS = {
  save: "Lưu điểm", submit: "Gửi duyệt", approve: "Duyệt và khóa", reopen: "Mở lại",
  "eligibility.save": "Lưu điểm thành phần", "eligibility.submit": "Gửi duyệt tư cách thi",
  "eligibility.approve": "Duyệt tư cách thi", "eligibility.reopen": "Mở lại tư cách thi",
  "eligibility.request_reopen": "Xin mở lại tư cách thi", "eligibility.reject_reopen": "Từ chối mở lại tư cách thi",
  "final.save": "Lưu điểm thi", "final.submit": "Gửi duyệt kết quả",
  "final.approve": "Duyệt kết quả", "final.reopen": "Mở lại kết quả",
  "exam.schedule": "Xếp buổi thi", "exam.reschedule": "Đổi lịch thi",
  "exam.held": "Xác nhận đã thi", "exam.cancel": "Hủy lịch thi",
};

const ROLE_LABELS = { admin: "Quản trị viên", supervisor: "Giảng viên hướng dẫn", examiner: "Giám khảo" };
const actionTone = action => {
  const name = String(action || "").split(".").pop();
  if (["approve", "held"].includes(name)) return "success";
  if (["submit", "request_reopen"].includes(name)) return "warning";
  if (["cancel", "reject_reopen"].includes(name)) return "danger";
  return ["reopen", "reschedule"].includes(name) ? "violet" : "blue";
};

function recordedRows(event) {
  const after = event.after;
  const rows = Array.isArray(after) ? after : after?.grades || after?.snapshot?.rows
    || (event.action?.startsWith("eligibility.") ? after?.eligibility_submission?.rows
      : event.action?.startsWith("final.") ? after?.result_snapshot?.rows : null);
  return Array.isArray(rows) ? rows : [];
}

function HistoryEntry({ event, index }) {
  const [expanded, setExpanded] = useState(false);
  const rows = recordedRows(event);
  const detailId = `gradebook-history-${event.id}`;
  return <>
    <TableRow hover className={`gh-entry${expanded ? " gh-entry-expanded" : ""}`}>
      <TableCell align="center" className="gh-number">{index + 1}</TableCell>
      <TableCell className="gh-datetime">{formatDateTime(event.createdAt)}</TableCell>
      <TableCell><span className="gh-actor">{event.actor?.name || event.actor?.email || "—"}</span>
        {ROLE_LABELS[event.actor?.role] && <span className="gh-role">{ROLE_LABELS[event.actor.role]}</span>}</TableCell>
      <TableCell><span className={`gh-action gh-action-${actionTone(event.action)}`}>{ACTION_LABELS[event.action] || event.action || "—"}</span></TableCell>
      <TableCell className="gh-note">{event.note || <span className="gh-muted">—</span>}</TableCell>
      <TableCell>{rows.length ? <Button size="small" className="gh-expand" aria-expanded={expanded} aria-controls={detailId}
        endIcon={expanded ? <ChevronUpIcon /> : <ChevronDownIcon />} onClick={() => setExpanded(value => !value)}>
        {expanded ? "Thu gọn" : `Xem kết quả (${rows.length})`}
      </Button> : <span className="gh-muted gh-no-grades">Không có bản ghi điểm</span>}</TableCell>
    </TableRow>
    {expanded && <TableRow className="gh-detail-row"><TableCell colSpan={6}>
      <Box id={detailId} className="gh-detail">
        <div className="gh-detail-heading"><strong>Kết quả tại thời điểm xử lý</strong><span>{rows.length} học viên</span></div>
        <TableContainer className="gh-results-scroll">
          <Table stickyHeader size="small" className="gh-results" aria-label={`Kết quả lịch sử lần ${index + 1}`}>
            <TableHead><TableRow>{["Mã HV", "Họ tên", "Điểm kiểm tra", "Điểm BTL/TL/KT", "Điểm thi", "Điểm học phần", "Kết quả"].map((label, index) => <TableCell key={label} align={index >= 2 ? "center" : "left"}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>{rows.map((row, rowIndex) => <TableRow key={row.participantId || rowIndex}>
              <TableCell sx={{ overflowWrap: "anywhere" }}>{row.code || row.participantId || "—"}</TableCell>
              <TableCell>{row.fullName || "—"}</TableCell>
              {["testScore", "assignmentScore", "examScore", "courseScore"].map(key => <TableCell key={key} align="center">{formatScore(row[key]) || "—"}</TableCell>)}
              <TableCell align="center"><span className={`gh-outcome gh-outcome-${row.result}`}>{RESULT_LABELS[row.result] || row.result || "—"}</span></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </Box>
    </TableCell></TableRow>}
  </>;
}

export default function GradebookHistoryDialog({ events, onClose }) {
  return <Dialog open onClose={onClose} fullWidth maxWidth={false} className="gradebook-history-dialog"
    aria-labelledby="gradebook-history-title" aria-describedby="gradebook-history-description">
    <DialogTitle className="gh-titlebar" component="div">
      <div className="gh-title-copy"><h2 id="gradebook-history-title">Lịch sử bảng điểm</h2>
        <p id="gradebook-history-description">Theo dõi thay đổi điểm và các lần gửi duyệt, mở lại bảng điểm.</p></div>
      <IconButton aria-label="Đóng lịch sử bảng điểm" onClick={onClose} size="small"><XMarkIcon /></IconButton>
    </DialogTitle>
    <div className="gh-summary"><span><strong>{events.length}</strong> hoạt động được ghi nhận</span><span>Thời gian · Người thực hiện · Nội dung thay đổi</span></div>
    <DialogContent className="gh-content">
      <TableContainer className="gh-scroll">
        <Table stickyHeader size="small" className="gh-log" aria-label="Lịch sử bảng điểm">
          <colgroup>{["5%", "15%", "20%", "20%", "25%", "15%"].map((width,index)=><col key={index} style={{width}}/>)}</colgroup>
          <TableHead><TableRow>{["STT", "Thời gian", "Người thực hiện", "Thao tác", "Ghi chú / Lý do", "Chi tiết điểm"].map(label => <TableCell key={label} scope="col" align={label === "STT" ? "center" : "left"}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{events.length ? events.map((event, index) => <HistoryEntry key={event.id} event={event} index={index} />)
            : <TableRow><TableCell colSpan={6}><div className="gh-empty"><ClockIcon aria-hidden="true" /><strong>Chưa có lịch sử bảng điểm.</strong><span>Các thay đổi và thao tác duyệt sẽ được ghi nhận tại đây.</span></div></TableCell></TableRow>}</TableBody>
        </Table>
      </TableContainer>
    </DialogContent>
    <DialogActions className="gh-footer"><span>Chọn “Xem kết quả” để xem điểm tại từng thời điểm.</span><Button variant="contained" onClick={onClose} disableElevation>Đóng</Button></DialogActions>
  </Dialog>;
}
