import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Typography,
  Chip,
} from "@mui/material";
import {
  ArrowBack,
  CameraAlt,
  CheckCircle,
  HelpOutline,
  VideocamOff,
  Warning,
} from "@mui/icons-material";
import { recognizeAttendance } from "./attendanceApi";

export default function AttendanceKiosk({ session, onClose, onAttendanceRecorded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [autoScan, setAutoScan] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  // Khởi động webcam
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
          setCameraError(null);
        }
      } catch (err) {
        console.error("Lỗi truy cập camera:", err);
        setCameraError(
          err.name === "NotAllowedError"
            ? "Quyền truy cập camera bị từ chối. Vui lòng cho phép trình duyệt truy cập camera."
            : `Không thể mở camera: ${err.message || err.name}`
        );
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Chụp frame từ video và gửi đến backend
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setProcessing(true);
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setProcessing(false);
          return;
        }

        try {
          const formData = new FormData();
          formData.append("image", blob, "probe.jpg");
          formData.append("deviceId", "kiosk-web");

          const response = await recognizeAttendance(session.id, formData);
          setResult(response);

          if (response.decision === "ACCEPT" && onAttendanceRecorded) {
            onAttendanceRecorded();
          }
        } catch (err) {
          const detail = err.response?.data?.message || err.message || "Lỗi nhận diện";
          setResult({
            decision: "ERROR",
            reason: detail,
          });
        } finally {
          setProcessing(false);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [processing, session.id, onAttendanceRecorded]);

  // Quét tự động định kỳ nếu autoScan bật
  useEffect(() => {
    if (!autoScan || !streamActive || processing) return;

    const timer = setInterval(() => {
      // Chỉ chụp nếu chưa có kết quả hiển thị hoặc kết quả đã hiển thị quá 3s
      if (!processing) {
        captureFrame();
      }
    }, 2800);

    return () => clearInterval(timer);
  }, [autoScan, streamActive, processing, captureFrame]);

  // Tự động xóa kết quả sau 4 giây để sẵn sàng cho người tiếp theo
  useEffect(() => {
    if (!result) return;
    const timeout = setTimeout(() => {
      setResult(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [result]);

  return (
    <Dialog fullScreen open onClose={onClose}>
      <Box
        sx={{
          bgcolor: "#121212",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header Kiosk */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            borderBottom: "1px solid #333",
            bgcolor: "#1e1e1e",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton onClick={onClose} sx={{ color: "#fff" }} title="Thoát Kiosk">
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Kiosk Điểm Danh Khuôn Mặt
              </Typography>
              <Typography variant="body2" sx={{ color: "#aaa" }}>
                Buổi: {session?.sessionDate} ({session?.startTime} - {session?.endTime || "..."}) | Phòng: {session?.room || "Chưa xếp"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoScan}
                  onChange={(e) => setAutoScan(e.target.checked)}
                  color="primary"
                />
              }
              label="Quét tự động (2.8s)"
              sx={{ color: "#ccc" }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <CameraAlt />}
              onClick={captureFrame}
              disabled={processing || !streamActive}
            >
              {processing ? "Đang nhận diện..." : "Quét ngay"}
            </Button>
          </Box>
        </Box>

        {/* Khung Camera & Canvas */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            bgcolor: "#000",
          }}
        >
          {cameraError ? (
            <Box sx={{ textAlign: "center", p: 4, maxWidth: 500 }}>
              <VideocamOff sx={{ fontSize: 64, color: "#f44336", mb: 2 }} />
              <Alert severity="error">{cameraError}</Alert>
              <Button
                variant="outlined"
                sx={{ mt: 3, color: "#fff", borderColor: "#fff" }}
                onClick={() => window.location.reload()}
              >
                Tải lại trang
              </Button>
            </Box>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: "scaleX(-1)", // Gương selfie tự nhiên
                }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Khung hướng dẫn định vị khuôn mặt */}
              <Box
                sx={{
                  position: "absolute",
                  width: { xs: 260, sm: 320 },
                  height: { xs: 340, sm: 420 },
                  borderRadius: "50%",
                  border: processing
                    ? "4px dashed #2196f3"
                    : result?.decision === "ACCEPT"
                    ? "4px solid #4caf50"
                    : result?.decision === "REVIEW"
                    ? "4px solid #ff9800"
                    : "3px dashed rgba(255,255,255,0.4)",
                  pointerEvents: "none",
                  boxShadow: processing ? "0 0 30px rgba(33, 150, 243, 0.4)" : "none",
                  transition: "all 0.3s ease",
                }}
              />

              {/* Thông báo kết quả ngay trên màn hình */}
              {result && (
                <Card
                  sx={{
                    position: "absolute",
                    bottom: 40,
                    width: { xs: "90%", sm: 500 },
                    bgcolor:
                      result.decision === "ACCEPT"
                        ? "rgba(46, 125, 50, 0.95)"
                        : result.decision === "REVIEW"
                        ? "rgba(237, 108, 2, 0.95)"
                        : "rgba(211, 47, 47, 0.95)",
                    color: "#fff",
                    boxShadow: 8,
                    borderRadius: 3,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 2 }}>
                    {result.decision === "ACCEPT" ? (
                      <CheckCircle sx={{ fontSize: 48, color: "#fff" }} />
                    ) : result.decision === "REVIEW" ? (
                      <Warning sx={{ fontSize: 48, color: "#fff" }} />
                    ) : (
                      <HelpOutline sx={{ fontSize: 48, color: "#fff" }} />
                    )}

                    <Box sx={{ flex: 1 }}>
                      {result.decision === "ACCEPT" ? (
                        <>
                          <Typography variant="h6" fontWeight="bold">
                            {result.participant?.displayName || "Học viên"}
                          </Typography>
                          <Typography variant="body2">
                            Mã: {result.participant?.id || "N/A"}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                            <Chip
                              label="ĐIỂM DANH THÀNH CÔNG"
                              size="small"
                              sx={{ bgcolor: "#fff", color: "#2e7d32", fontWeight: "bold" }}
                            />
                            {result.similarity && (
                              <Chip
                                label={`Độ tin cậy: ${(result.similarity * 100).toFixed(1)}%`}
                                size="small"
                                sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "#fff" }}
                              />
                            )}
                          </Box>
                        </>
                      ) : result.decision === "REVIEW" ? (
                        <>
                          <Typography variant="h6" fontWeight="bold">
                            Chờ xác nhận thủ công
                          </Typography>
                          <Typography variant="body2">
                            Độ tương đồng nằm trong vùng cần xem xét. Đã đẩy vào hàng đợi duyệt.
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h6" fontWeight="bold">
                            Không nhận diện được
                          </Typography>
                          <Typography variant="body2">
                            {result.reason === "empty_roster"
                              ? "Lớp chưa có học viên trong danh sách."
                              : result.reason === "subject_not_in_roster"
                              ? "Khuôn mặt không thuộc danh sách lớp học phần này."
                              : "Vui lòng nhìn thẳng vào camera hoặc điểm danh thủ công."}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
