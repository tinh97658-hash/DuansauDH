import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Typography } from "@mui/material";
import CameraAlt from "@mui/icons-material/CameraAlt";
import { analyzeEnrollmentFrame } from "./attendanceApi";
import { captureStableFace, waitForFrame } from "./faceCapture";
import { errorMessage } from "./attendanceDisplay";

const steps = ["Nhìn thẳng vào camera", "Quay nhẹ sang một bên", "Quay nhẹ sang bên còn lại"];

export default function GuidedEnrollmentCapture({ participantId, disabled, onComplete, onActiveChange }) {
  const videoRef = useRef(null), canvasRef = useRef(null), completedRef = useRef(onComplete);
  completedRef.current = onComplete;
  const [started, setStarted] = useState(false), [step, setStep] = useState(0);
  const [guide, setGuide] = useState(""), [error, setError] = useState("");
  useEffect(() => { onActiveChange?.(started); return () => onActiveChange?.(false); }, [started, onActiveChange]);
  useEffect(() => {
    if (!started || disabled) return;
    const controller = new AbortController();
    let stream;
    setStep(0); setError(""); setGuide("Đang mở camera…");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Hãy dùng trình duyệt hỗ trợ camera trên HTTPS hoặc localhost.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (controller.signal.aborted || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream;
        const images = [];
        let side = 0;
        while (images.length < 3 && !controller.signal.aborted) {
          const index = images.length;
          const sample = await captureStableFace({
            video: videoRef.current, canvas: canvasRef.current, signal: controller.signal, onGuide: setGuide,
            analyze: (blob, signal) => analyzeEnrollmentFrame(participantId, blob, signal),
            poseMatches: (yaw) => Number.isFinite(yaw) && (index === 0 ? Math.abs(yaw) <= 0.07 : index === 1 ? Math.abs(yaw) >= 0.08 && Math.abs(yaw) <= 0.25 : Math.sign(yaw) === -side && Math.abs(yaw) >= 0.08 && Math.abs(yaw) <= 0.25),
          });
          if (controller.signal.aborted) return;
          if (sample) {
            if (index === 1) side = Math.sign(sample.analysis.yaw_signed);
            images.push(new File([sample.blob], `camera-${index + 1}.jpg`, { type: "image/jpeg" }));
            setStep(images.length);
          }
          if (images.length < 3) await waitForFrame(450, controller.signal);
        }
        if (!controller.signal.aborted) { completedRef.current(images); setStarted(false); setGuide("Đã chọn đủ 3 ảnh đạt yêu cầu. Bấm Lưu mẫu khuôn mặt để đăng ký."); }
      } catch (err) {
        if (!controller.signal.aborted) { setError(err.name === "NotAllowedError" ? "Bạn chưa cho phép truy cập camera." : errorMessage(err)); setStarted(false); }
      }
    })();
    return () => { controller.abort(); stream?.getTracks().forEach((track) => track.stop()); };
  }, [started, disabled, participantId]);

  return <Box sx={{ p: 2, border: "1px solid #c7dbe3", bgcolor: "#f4fafc", mb: 2 }}>
    <Typography fontWeight={700}>Chụp mẫu bằng camera có hướng dẫn</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Hệ thống tự chọn ảnh rõ nét ở 3 góc. Chỉ một người trong khung hình.</Typography>
    {started ? <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>{steps.map((label, i) => <Chip key={label} size="small" label={`${i < step ? "✓" : i + 1} ${label}`} color={i === step ? "primary" : i < step ? "success" : "default"} />)}</Box>
      <Typography fontWeight={700}>{steps[step] || "Đã chụp đủ ảnh"}</Typography>
      <video ref={videoRef} autoPlay playsInline muted aria-label="Camera chụp mẫu khuôn mặt" style={{ width: "100%", maxHeight: 320, background: "#102333", transform: "scaleX(-1)", objectFit: "contain" }} />
      <canvas ref={canvasRef} hidden />
      <Button onClick={() => setStarted(false)}>Dừng camera</Button>
    </> : <Button startIcon={<CameraAlt />} variant="contained" onClick={() => setStarted(true)} disabled={disabled}>Mở camera chụp mẫu</Button>}
    {guide && <Typography role="status" variant="body2" sx={{ mt: 1 }}>{guide}</Typography>}
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
  </Box>;
}
