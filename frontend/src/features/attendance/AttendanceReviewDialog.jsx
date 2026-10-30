import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Warning from "@mui/icons-material/Warning";
import { listSessionReviews, resolveReview } from "./attendanceApi";
import { errorMessage, participantId } from "./attendanceDisplay";

export default function AttendanceReviewDialog({ session, roster, open, onClose, onReviewResolved }) {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [selectedReview, setSelectedReview] = useState(null);
  const [resolution, setResolution] = useState("ACCEPT_SUGGESTED");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("PRESENT");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const loadVersion = useRef(0);
  const formId = useId();

  const selectReview = (review) => {
    setSelectedReview(review);
    setSelectedParticipantId("");
    setResolution(review?.suggestedSubjectId ? "ACCEPT_SUGGESTED" : "ASSIGN_OTHER");
    setAttendanceStatus("PRESENT");
    setNote("");
  };

  const loadReviews = useCallback(async () => {
    if (!session?.id) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setReviews([]);
    selectReview(null);
    try {
      const data = await listSessionReviews(session.id, "PENDING");
      if (version !== loadVersion.current) return;
      const items = Array.isArray(data) ? data : [];
      setReviews(items);
      selectReview(items[0] || null);
    } catch (err) {
      if (version === loadVersion.current) setError(errorMessage(err, "Lỗi tải hàng đợi duyệt"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (open) {
      setSuccess(null);
      loadReviews();
    }
    return () => { ++loadVersion.current; };
  }, [open, loadReviews]);

  const handleResolve = async () => {
    if (!selectedReview) return;
    if (resolution === "ASSIGN_OTHER" && !(roster || []).some((person) => participantId(person) === selectedParticipantId)) {
      setError("Vui lòng chọn học viên trong danh sách lớp.");
      return;
    }
    if (resolution === "ACCEPT_SUGGESTED" && !selectedReview.suggestedSubjectId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        resolution,
        status: attendanceStatus,
        note: note.trim() || undefined,
        participantId:
          resolution === "ACCEPT_SUGGESTED"
            ? selectedReview.suggestedSubjectId
            : resolution === "ASSIGN_OTHER"
            ? selectedParticipantId
            : undefined,
      };

      await resolveReview(selectedReview.id, payload);
      setSuccess("Đã xử lý ca nghi vấn thành công.");
      setNote("");
      if (onReviewResolved) onReviewResolved();
      await loadReviews();
    } catch (err) {
      setError(errorMessage(err, "Lỗi duyệt ca"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Warning color="warning" />
        <Typography component="span" variant="h6" fontWeight="bold">
          Hàng Đợi Duyệt Điểm Danh (Review Queue)
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : reviews.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              Không có ca nào đang chờ duyệt trong buổi học này.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Danh sách ca chờ duyệt ({reviews.length} ca):
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mã ca</TableCell>
                  <TableCell>Gợi ý AI</TableCell>
                  <TableCell>Thời gian quét</TableCell>
                  <TableCell>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviews.map((rev) => (
                  <TableRow
                    key={rev.id}
                    selected={selectedReview?.id === rev.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => {
                      if (!submitting) selectReview(rev);
                    }}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {rev.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {rev.suggestedSubjectId ? (
                        <Chip
                          label={roster?.find((r) => participantId(r) === rev.suggestedSubjectId)?.fullName || rev.suggestedSubjectId}
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Chip label="Không có gợi ý" size="small" />
                      )}
                    </TableCell>
                    <TableCell>{new Date(rev.createdAt).toLocaleTimeString("vi-VN")}</TableCell>
                    <TableCell>
                      <Button
                        disabled={submitting}
                        size="small"
                        variant={selectedReview?.id === rev.id ? "contained" : "outlined"}
                      >
                        Chọn
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {selectedReview && (
              <Box sx={{ mt: 2, p: 2, bgcolor: "#fafafa", borderRadius: 2, border: "1px solid #ddd" }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Xử lý ca: {selectedReview.id.slice(0, 8)}...
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`${formId}-resolution`}>Quyết định xử lý</InputLabel>
                    <Select
                      labelId={`${formId}-resolution`}
                      disabled={submitting}
                      value={resolution}
                      label="Quyết định xử lý"
                      onChange={(e) => setResolution(e.target.value)}
                    >
                      {selectedReview.suggestedSubjectId && (
                        <MenuItem value="ACCEPT_SUGGESTED">
                          Chấp nhận gợi ý: {roster?.find((r) => participantId(r) === selectedReview.suggestedSubjectId)?.fullName || selectedReview.suggestedSubjectId}
                        </MenuItem>
                      )}
                      <MenuItem value="ASSIGN_OTHER">Gán cho học viên khác trong lớp</MenuItem>
                      <MenuItem value="REJECT">Từ chối (Không phải học viên lớp này)</MenuItem>
                      <MenuItem value="DISMISS">Bỏ qua / Hủy bỏ ca</MenuItem>
                    </Select>
                  </FormControl>

                  {resolution === "ASSIGN_OTHER" && (
                    <FormControl fullWidth size="small">
                      <InputLabel id={`${formId}-participant`}>Chọn học viên trong lớp</InputLabel>
                      <Select
                        labelId={`${formId}-participant`}
                        disabled={submitting}
                        value={selectedParticipantId}
                        label="Chọn học viên trong lớp"
                        onChange={(e) => setSelectedParticipantId(e.target.value)}
                      >
                        {(roster || []).map((student) => (
                          <MenuItem key={participantId(student)} value={participantId(student)}>
                            {student.fullName} ({student.code || student.studentCode || participantId(student)})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {(resolution === "ACCEPT_SUGGESTED" || resolution === "ASSIGN_OTHER") && (
                    <FormControl fullWidth size="small">
                      <InputLabel id={`${formId}-status`}>Trạng thái điểm danh</InputLabel>
                      <Select
                        labelId={`${formId}-status`}
                        disabled={submitting}
                        value={attendanceStatus}
                        label="Trạng thái điểm danh"
                        onChange={(e) => setAttendanceStatus(e.target.value)}
                      >
                        <MenuItem value="PRESENT">Có mặt (Đúng giờ)</MenuItem>
                        <MenuItem value="LATE">Đi muộn</MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  <TextField
                    disabled={submitting}
                    label="Ghi chú xử lý"
                    size="small"
                    multiline
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Lý do chấp nhận hoặc từ chối..."
                  />

                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleResolve}
                      disabled={submitting || (resolution === "ASSIGN_OTHER" && !selectedParticipantId)}
                      startIcon={<Check />}
                    >
                      {submitting ? "Đang lưu..." : "Xác nhận duyệt"}
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
