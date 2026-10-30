import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { analyzeAttendanceFrame, recognizeAttendance, reportAttendanceTelemetry } from "./attendanceApi";
import { errorMessage } from "./attendanceDisplay";
import AttendanceScanView from "./AttendanceScanView";
import { captureStableFace, captureAnalyzedFrame } from "./faceCapture";

export default function AttendanceKiosk({ session, onClose, onAttendanceRecorded }) {
  const scanAllowed = Boolean(session?.id) && session?.attendanceState === "OPEN" && session?.status !== "not_held";
  const scanAllowedRef = useRef(scanAllowed);
  scanAllowedRef.current = scanAllowed;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const requestRef = useRef(null);
  const metricsRef = useRef(null);
  const departureRequiredRef = useRef(false);
  const nextScanDelayRef = useRef(300);
  const recordedRef = useRef(onAttendanceRecorded);
  recordedRef.current = onAttendanceRecorded;
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [autoScan, setAutoScan] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [captureGuide, setCaptureGuide] = useState("Đưa một khuôn mặt vào khung và giữ yên.");
  const [awaitingDeparture, setAwaitingDeparture] = useState(false);

  const reportMetrics = useCallback((metrics, outcome, eventId) => {
    const committedAt = performance.now();
    // Diagnostics must never delay or change the attendance result.
    void reportAttendanceTelemetry(session.id, {
      ...(eventId ? { eventId } : {}), outcome,
      captureMs: metrics.captureMs, recognitionHttpMs: metrics.recognitionHttpMs,
      uiCommitMs: Math.max(0, committedAt - metrics.finishedAt),
      totalMs: Math.max(0, committedAt - metrics.startedAt), frameCount: metrics.frameCount,
    }).catch(() => {});
  }, [session?.id]);

  useLayoutEffect(() => {
    if (!result || !metricsRef.current) return;
    const metrics = metricsRef.current;
    metricsRef.current = null;
    reportMetrics(metrics, result.decision, result.eventId);
  }, [result, reportMetrics]);

  // Khởi động webcam
  useEffect(() => {
    let stream = null;
    let disposed = false;
    activeRef.current = scanAllowed;
    processingRef.current = false;
    departureRequiredRef.current = false;
    nextScanDelayRef.current = 300;
    metricsRef.current = null;
    setAwaitingDeparture(false);
    setProcessing(false);
    setStreamActive(false);
    setResult(null);
    setRecentScans([]);
    setCameraError(null);
    setCaptureGuide(scanAllowed ? "Đưa một khuôn mặt vào khung và giữ yên." : "Buổi học chưa mở hoặc đã dừng điểm danh. Vui lòng quay lại danh sách.");
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Trình duyệt không hỗ trợ camera. Hãy mở bằng HTTPS hoặc localhost.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (disposed || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraError(null);
        }
      } catch (err) {
        if (disposed) return;
        setCameraError(
          err.name === "NotAllowedError"
            ? "Quyền truy cập camera bị từ chối. Vui lòng cho phép trình duyệt truy cập camera."
            : `Không thể mở camera: ${err.message || err.name}`
        );
      }
    };

    if (scanAllowed) startCamera();

    return () => {
      disposed = true;
      activeRef.current = false;
      requestRef.current?.abort();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
      }
    };
  }, [session?.id, scanAllowed]);

  // Chụp frame từ video và gửi đến backend
  const captureFrame = useCallback(async () => {
    if (!activeRef.current || !scanAllowedRef.current || departureRequiredRef.current || !session?.id || session.attendanceState !== "OPEN" || session.status === "not_held" || !videoRef.current || !canvasRef.current || processingRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    processingRef.current = true;
    setProcessing(true);
    setResult(null);
    const controller = new AbortController();
    requestRef.current = controller;
    const metrics = { startedAt: performance.now(), finishedAt: 0, captureMs: 0, recognitionHttpMs: 0, frameCount: 0 };
    let recognitionStartedAt = null;
    try {
      const sample = await captureStableFace({ video, canvas: canvasRef.current, signal: controller.signal,
        analyze: (blob, signal) => { metrics.frameCount++; return analyzeAttendanceFrame(session.id, blob, signal); }, onGuide: setCaptureGuide });
      if (controller.signal.aborted || !scanAllowedRef.current) return;
      metrics.captureMs = performance.now() - metrics.startedAt;
      if (!sample) {
        nextScanDelayRef.current = 1000;
        metrics.finishedAt = performance.now();
        reportMetrics(metrics, "NO_CAPTURE");
        return;
      }
      nextScanDelayRef.current = 300;
      setCaptureGuide("Khuôn mặt đã ổn định. Đang đối chiếu danh sách lớp…");
      const formData = new FormData();
      formData.append("image", sample.blob, "probe.jpg");
      formData.append("deviceId", "kiosk-web");
      if (sample.analysis.capture_token) formData.append("captureToken", sample.analysis.capture_token);

      recognitionStartedAt = performance.now();
      const response = await recognizeAttendance(session.id, formData, { signal: controller.signal });
      if (controller.signal.aborted || !activeRef.current || !scanAllowedRef.current) return;
      if (response.decision === "ACCEPT" && !response.attendanceId) {
        throw new Error("Chưa xác nhận được việc lưu điểm danh. Vui lòng quét lại hoặc liên hệ cán bộ phụ trách.");
      }
      metrics.finishedAt = performance.now();
      metrics.recognitionHttpMs = metrics.finishedAt - recognitionStartedAt;
      metricsRef.current = metrics;
      if (["ACCEPT", "REVIEW"].includes(response.decision)) {
        departureRequiredRef.current = true;
        setAwaitingDeparture(true);
        setCaptureGuide("Vui lòng rời khung camera để người tiếp theo điểm danh.");
      }
      setResult(response);
      if (response.decision === "ACCEPT") {
        setRecentScans((items) => [response, ...items.filter((item) => item.attendanceId !== response.attendanceId)].slice(0, 5));
      }

      if (["ACCEPT", "REVIEW"].includes(response.decision)) {
        recordedRef.current?.();
      }
    } catch (err) {
      if (controller.signal.aborted || !activeRef.current || !scanAllowedRef.current) return;
      if (err.response?.status === 409) setAutoScan(false);
      metrics.finishedAt = performance.now();
      if (recognitionStartedAt === null) metrics.captureMs = metrics.finishedAt - metrics.startedAt;
      else metrics.recognitionHttpMs = metrics.finishedAt - recognitionStartedAt;
      metricsRef.current = metrics;
      setResult({ decision: "ERROR", reason: errorMessage(err, "Lỗi nhận diện") });
    } finally {
      if (requestRef.current === controller) {
        processingRef.current = false;
        requestRef.current = null;
        if (activeRef.current) setProcessing(false);
      }
    }
  }, [session?.id, session?.status, session?.attendanceState, reportMetrics]);

  // Quét tự động định kỳ nếu autoScan bật
  useEffect(() => {
    if (!autoScan || !streamActive || processing || result || awaitingDeparture || session?.attendanceState !== "OPEN" || session?.status === "not_held") return;

    const timer = setTimeout(() => {
      captureFrame();
    }, nextScanDelayRef.current);

    return () => clearTimeout(timer);
  }, [autoScan, streamActive, processing, result, awaitingDeparture, captureFrame, session?.attendanceState, session?.status]);

  // Two consecutive empty frames re-arm capture; a face staying in view never does.
  useEffect(() => {
    if (!awaitingDeparture || !streamActive || session?.attendanceState !== "OPEN" || session?.status === "not_held") return;
    const controller = new AbortController();
    let timer;
    let emptyFrames = 0;
    const poll = async () => {
      if (controller.signal.aborted || !activeRef.current) return;
      if (processingRef.current) { timer = setTimeout(poll, 500); return; }
      processingRef.current = true;
      requestRef.current = controller;
      try {
        const sample = await captureAnalyzedFrame({ video: videoRef.current, canvas: canvasRef.current,
          signal: controller.signal, analyze: (blob, signal) => analyzeAttendanceFrame(session.id, blob, signal) });
        if (controller.signal.aborted) return;
        emptyFrames = sample?.analysis.status === "no_face" && sample.analysis.face_count === 0 ? emptyFrames + 1 : 0;
        if (emptyFrames >= 2) {
          departureRequiredRef.current = false;
          nextScanDelayRef.current = 300;
          setAwaitingDeparture(false);
          setResult(null);
          setCaptureGuide("Sẵn sàng cho người tiếp theo. Nhìn vào camera và giữ yên.");
          return;
        }
        setCaptureGuide("Vui lòng rời khung camera để người tiếp theo điểm danh.");
      } catch (err) {
        if (controller.signal.aborted) return;
        emptyFrames = 0;
        if (err.response?.status === 409) {
          setAutoScan(false);
          setCaptureGuide("Buổi điểm danh đã đóng. Vui lòng quay lại danh sách điểm danh.");
          return;
        }
        setCaptureGuide("Chưa kiểm tra được camera. Vui lòng chờ hoặc quay lại danh sách điểm danh.");
      } finally {
        if (requestRef.current === controller) {
          processingRef.current = false;
          requestRef.current = null;
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 500);
    };
    // Give the confirmation a brief readable interval; it stays in recent results.
    timer = setTimeout(poll, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [awaitingDeparture, streamActive, session?.id, session?.attendanceState, session?.status]);

  // Failed attempts may retry without requiring the person to leave the frame.
  useEffect(() => {
    if (!result || awaitingDeparture) return;
    const timeout = setTimeout(() => {
      setResult(null);
    }, 1800);
    return () => clearTimeout(timeout);
  }, [result, awaitingDeparture]);

  return <AttendanceScanView
    session={session} onClose={onClose} videoRef={videoRef} canvasRef={canvasRef}
    cameraError={cameraError} streamActive={streamActive} autoScan={autoScan}
    setAutoScan={setAutoScan} processing={processing} result={result}
    recentScans={recentScans} captureFrame={captureFrame}
    captureGuide={captureGuide}
    awaitingDeparture={awaitingDeparture}
    onCameraReady={() => setStreamActive(true)}
  />;
}
