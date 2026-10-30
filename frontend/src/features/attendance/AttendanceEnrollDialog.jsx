import React, { useEffect, useState } from "react";
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
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddPhotoAlternate from "@mui/icons-material/AddPhotoAlternate";
import Close from "@mui/icons-material/Close";
import DeleteForever from "@mui/icons-material/DeleteForever";
import Face from "@mui/icons-material/Face";
import History from "@mui/icons-material/History";
import {
  enrollParticipant,
  getParticipantEnrollment,
  listParticipantAudit,
  withdrawParticipantEnrollment,
} from "./attendanceApi";
import { formatEnrollmentError } from "./enrollmentError";
import { errorMessage } from "./attendanceDisplay";
import GuidedEnrollmentCapture from "./GuidedEnrollmentCapture";

export default function AttendanceEnrollDialog({ participant, open, onClose }) {
  const participantId = participant?.id || participant?.studentId || participant?.learnerId;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [enrollmentInfo, setEnrollmentInfo] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAudit, setShowAudit] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [replace, setReplace] = useState(true);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // Nạp thông tin đăng ký khuôn mặt hiện tại
  useEffect(() => {
    if (!open || !participantId) return;

    let active = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setEnrollmentInfo(null);
    setAuditLogs([]);
    setShowAudit(false);
    setReplace(true);
    setSelectedFiles([]);
    setPreviews([]);

    Promise.all([
      getParticipantEnrollment(participantId),
      listParticipantAudit(participantId, 10),
    ])
      .then(([enrollRes, auditRes]) => {
        if (!active) return;
        setEnrollmentInfo(enrollRes?.subject || null);
        setAuditLogs(auditRes?.events || []);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Không tải được thông tin đăng ký khuôn mặt."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, participantId]);

  // Xử lý chọn ảnh
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    if (files.length < 3 || files.length > 5) {
      setSelectedFiles([]);
      setPreviews([]);
      setError("Vui lòng chọn từ 3 đến 5 ảnh chân dung rõ mặt.");
      return;
    }

    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10_000_000 || file.size === 0)) {
      setSelectedFiles([]);
      setPreviews([]);
      setError("Mỗi ảnh phải là JPEG, PNG hoặc WebP, không rỗng và không quá 10 MB.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSelectedFiles(files);

    // Tạo preview URL
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
  };

  // Gửi đăng ký
  const handleEnrollSubmit = async () => {
    if (selectedFiles.length < 3 || selectedFiles.length > 5) {
      setError("Vui lòng chọn đủ 3 đến 5 ảnh để đăng ký khuôn mặt.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });
      formData.append("replace", String(replace));

      const res = await enrollParticipant(participantId, formData);
      setSuccess(`Đăng ký thành công ${res.templates_added} mẫu khuôn mặt.`);
      setSelectedFiles([]);
      setPreviews([]);

      // Tải lại thông tin
      const updated = await getParticipantEnrollment(participantId);
      setEnrollmentInfo(updated?.subject || null);
      const audit = await listParticipantAudit(participantId, 10);
      setAuditLogs(audit?.events || []);
    } catch (err) {
      const detail = errorMessage(err, "Lỗi đăng ký khuôn mặt");
      setError(formatEnrollmentError(detail));
    } finally {
      setSubmitting(false);
    }
  };

  // Thu hồi mẫu sinh trắc (Rút consent)
  const handleWithdraw = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ mẫu sinh trắc học của học viên này? Thao tác này sẽ xóa vĩnh viễn vector khuôn mặt.")) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await withdrawParticipantEnrollment(participantId);
      setSuccess(`Đã xóa ${res.templates_deleted} mẫu khuôn mặt. Dữ liệu sinh trắc học đã được thu hồi.`);
      setEnrollmentInfo(null);
      const audit = await listParticipantAudit(participantId, 10);
      setAuditLogs(audit?.events || []);
    } catch (err) {
      const detail = errorMessage(err, "Lỗi thu hồi sinh trắc");
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Face color="primary" />
          <Typography component="span" variant="h6" fontWeight="bold">
            Đăng ký khuôn mặt: {participant?.fullName || participant?.id}
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={submitting} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Trạng thái hiện tại */}
            <Box sx={{ p: 2, bgcolor: "#f9f9f9", borderRadius: 2, border: "1px solid #e0e0e0" }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Trạng thái sinh trắc học hiện tại:
              </Typography>
              {enrollmentInfo?.active && enrollmentInfo?.template_count > 0 ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip label={`Đã đăng ký ${enrollmentInfo.template_count} template`} color="success" size="small" />
                    <Typography variant="body2" color="text.secondary">
                      Đăng ký lúc: {new Date(enrollmentInfo.created_at).toLocaleString("vi-VN")}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteForever />}
                    onClick={handleWithdraw}
                    disabled={submitting}
                  >
                    Thu hồi / Xóa mẫu
                  </Button>
                </Box>
              ) : (
                <Chip label="Chưa có dữ liệu khuôn mặt" color="default" size="small" />
              )}
            </Box>

            {error && <Alert severity="error" sx={{ whiteSpace: "pre-line" }}>{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {/* Chọn ảnh mới */}
            <Box>
              <GuidedEnrollmentCapture participantId={participantId} disabled={loading || submitting} onActiveChange={setCapturing} onComplete={(files) => {
                setSelectedFiles(files); setPreviews(files.map((file) => URL.createObjectURL(file))); setError(null); setSuccess(null);
              }} />
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Đăng ký / Cập nhật mẫu mới (Yêu cầu 3–5 ảnh):
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Chụp ảnh rõ mặt, các góc nghiêng nhẹ khác nhau (thẳng, nghiêng trái, nghiêng phải 10–15 độ), đủ sáng.
                Mỗi khuôn mặt chỉ được đăng ký cho một học viên; hệ thống sẽ kiểm tra trùng với các mẫu đã có trước khi lưu.
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AddPhotoAlternate />}
                  disabled={submitting || loading || capturing}
                >
                  Chọn 3–5 ảnh chân dung
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={handleFileChange}
                  />
                </Button>

                <FormControlLabel
                  control={
                    <Switch
                      disabled={submitting}
                      checked={replace}
                      onChange={(e) => setReplace(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Ghi đè template cũ"
                />
              </Box>

              {/* Thumbnails preview */}
              {previews.length > 0 && (
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
                  {previews.map((src, index) => (
                    <Box
                      key={index}
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: 2,
                        overflow: "hidden",
                        border: "2px solid #1976d2",
                        position: "relative",
                      }}
                    >
                      <img
                        src={src}
                        alt={`Ảnh ${index + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 0,
                          width: "100%",
                          bgcolor: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          textAlign: "center",
                          fontSize: 11,
                          py: 0.2,
                        }}
                      >
                        #{index + 1}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Divider />

            {/* Nhật ký Audit */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <History fontSize="small" /> Lịch sử đăng ký & thu hồi sinh trắc (Audit):
                </Typography>
                <Button size="small" onClick={() => setShowAudit(!showAudit)}>
                  {showAudit ? "Ẩn lịch sử" : "Xem lịch sử"}
                </Button>
              </Box>

              {showAudit && (
                <Box sx={{ mt: 1, maxHeight: 180, overflowY: "auto" }}>
                  {auditLogs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", p: 1 }}>
                      Chưa có lịch sử audit.
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hành động</TableCell>
                          <TableCell>Mẫu thêm/xóa</TableCell>
                          <TableCell>Thời gian</TableCell>
                          <TableCell>Actor</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.audit_id}>
                            <TableCell>
                              <Chip
                                label={log.action}
                                size="small"
                                color={log.action === "WITHDRAW" ? "error" : "primary"}
                              />
                            </TableCell>
                            <TableCell>
                              +{log.templates_added} / -{log.templates_deleted} (Tổng: {log.templates_after})
                            </TableCell>
                            <TableCell>{new Date(log.created_at).toLocaleString("vi-VN")}</TableCell>
                            <TableCell>{log.actor || "Hệ thống"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Đóng
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleEnrollSubmit}
          disabled={loading || submitting || capturing || selectedFiles.length < 3 || selectedFiles.length > 5}
        >
          {submitting ? "Đang xử lý..." : "Lưu mẫu khuôn mặt"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
