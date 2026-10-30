import React from "react";
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Paper, Switch, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import CameraAlt from "@mui/icons-material/CameraAlt";
import CheckCircle from "@mui/icons-material/CheckCircle";
import HelpOutline from "@mui/icons-material/HelpOutline";
import VideocamOff from "@mui/icons-material/VideocamOff";
import Warning from "@mui/icons-material/Warning";
import { courseLabel, recognitionMessage, roomLabel, sessionTime } from "./attendanceDisplay";

const timeLabel = (value) => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const attendanceLabel = (status) => ({ PRESENT: "Có mặt · Đúng giờ", LATE: "Có mặt · Đi muộn", EXCUSED: "Vắng có phép", ABSENT: "Vắng mặt", LEFT_EARLY: "Về sớm", LATE_EARLY: "Đi muộn · Về sớm" }[status] || "Đã ghi nhận");

export default function AttendanceScanView({ session, onClose, videoRef, canvasRef, cameraError, streamActive, autoScan, setAutoScan, processing, result, recentScans, captureFrame, onCameraReady, captureGuide, awaitingDeparture }) {
  const latest = result || recentScans[0];
  const accepted = latest?.decision === "ACCEPT";
  const needsReview = latest?.decision === "REVIEW";
  const color = accepted ? "#16804a" : needsReview ? "#b66a08" : latest ? "#c43d3d" : "#087e9d";
  const scanAllowed = session?.attendanceState === "OPEN" && session?.status !== "not_held";
  const cameraStatus = !scanAllowed ? "Điểm danh đã dừng" : cameraError ? "Camera gặp lỗi" : !streamActive ? "Đang mở camera…" : processing ? "Đang nhận diện…" : "Camera sẵn sàng";

  return <Box component="section" aria-label="Kiosk điểm danh khuôn mặt" sx={{ p: { xs: 1, md: 2 }, display: "flex", flexDirection: "column", gap: 2 }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      <Box>
        <Button startIcon={<ArrowBack />} onClick={onClose} size="small" sx={{ mb: 0.5 }}>Quay lại danh sách điểm danh</Button>
        <Typography variant="h5" component="h1" fontWeight={750}>Kiosk Điểm Danh Khuôn Mặt</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{courseLabel(session)}</Typography>
        <Typography variant="body2" color="text.secondary">Buổi: {session?.sessionDate} ({sessionTime(session)}) | Phòng: {roomLabel(session?.room)}</Typography>
      </Box>
      <Chip label={cameraStatus} color={cameraError ? "error" : streamActive ? "success" : "default"} variant="outlined" />
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.6fr) minmax(320px, 1fr)" }, gap: 2, alignItems: "start" }}>
      <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", borderRadius: 3 }}>
        <Box sx={{ position: "relative", aspectRatio: "16 / 10", minHeight: { xs: 270, md: 380 }, bgcolor: "#0b1726", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {cameraError ? <Box sx={{ p: 3, textAlign: "center", maxWidth: 520 }}>
            <VideocamOff sx={{ fontSize: 54, color: "#ff9292", mb: 2 }} />
            <Alert severity="error">{cameraError}</Alert>
            <Button variant="outlined" onClick={() => window.location.reload()} sx={{ mt: 2, color: "white", borderColor: "#92a2b4" }}>Tải lại trang</Button>
          </Box> : <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={onCameraReady} onCanPlay={onCameraReady} aria-label="Hình ảnh camera điểm danh" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: "scaleX(-1)" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <Box component="svg" viewBox="0 0 200 280" aria-hidden="true" sx={{ position: "absolute", width: "32%", height: "70%", minWidth: 150, pointerEvents: "none" }}>
              <ellipse cx="100" cy="140" rx="96" ry="136" fill="none" stroke={result?.decision === "ACCEPT" ? "#55e79d" : "#d0e2f0"} strokeWidth="3" strokeDasharray={processing ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
            </Box>
            {!processing && result?.decision === "ACCEPT" && <Box sx={{ position: "absolute", top: 14, left: 14, right: 14, bgcolor: "#16804a", color: "white", p: 2, borderRadius: 2, display: "flex", gap: 1.5, alignItems: "center", boxShadow: 4 }}>
              <CheckCircle sx={{ fontSize: 38 }} /><Box><Typography fontWeight={800} fontSize={{ xs: 18, md: 22 }}>{result.attendance?.alreadyRecorded ? "Đã có điểm danh của bạn" : "Đã điểm danh thành công"}</Typography><Typography variant="body2">{result.participant?.displayName} · {timeLabel(result.attendance?.recordedAt)}</Typography></Box>
            </Box>}
            {!streamActive && <Box sx={{ zIndex: 1, color: "white", textAlign: "center" }}>{scanAllowed && <CircularProgress size={32} color="inherit" />}<Typography sx={{ mt: 1 }}>{scanAllowed ? "Đang chờ hình ảnh từ camera" : "Buổi học chưa mở hoặc đã dừng điểm danh."}</Typography></Box>}
            <Box sx={{ position: "absolute", bottom: 14, left: 12, right: 12, textAlign: "center" }}>
              <Box role="status" sx={{ bgcolor: "rgba(6,18,31,0.85)", color: "white", p: 1, fontSize: 13 }}>{captureGuide || "Nhìn thẳng · Đủ sáng · Một người trong khung"}</Box>
            </Box>
          </>}
        </Box>
        <Box sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <Box><FormControlLabel control={<Switch checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} />} label="Quét tự động" />
            <Typography variant="caption" color="text.secondary" display="block">{awaitingDeparture ? "Rời khung camera để sẵn sàng cho lượt tiếp theo." : autoScan ? "Tự quét khi sẵn sàng; giữ yên khuôn mặt đến khi có kết quả." : "Bấm Quét ngay khi khuôn mặt đã ở trong khung."}</Typography>
          </Box>
          <Button variant="contained" size="large" startIcon={processing ? <CircularProgress size={18} color="inherit" /> : <CameraAlt />} onClick={captureFrame} disabled={processing || awaitingDeparture || !streamActive || !session?.id || session?.attendanceState !== "OPEN" || session?.status === "not_held"}>{processing ? "Đang nhận diện..." : "Quét ngay"}</Button>
        </Box>
      </Paper>

      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, borderTop: `5px solid ${color}`, bgcolor: accepted ? "#f0faf4" : "white", minHeight: 280 }}>
          <Typography variant="overline" color="text.secondary">{!result && latest ? "Lần điểm danh gần nhất" : "Kết quả điểm danh"}</Typography>
          <Box role="status" aria-live="polite" aria-atomic="true">
            {processing ? <Box sx={{ pt: 2 }}><CircularProgress size={36} /><Typography variant="h6" component="h2" sx={{ mt: 2 }}>Đang kiểm tra khuôn mặt</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Vui lòng giữ yên và chờ hệ thống xác nhận kết quả điểm danh.</Typography></Box> : latest ? <>
              {accepted ? <CheckCircle sx={{ fontSize: 48, color }} /> : needsReview ? <Warning sx={{ fontSize: 42, color }} /> : <HelpOutline sx={{ fontSize: 42, color }} />}
              <Typography variant="h5" component="h2" fontWeight={800} sx={{ color, mt: 1 }}>{accepted ? latest.attendance?.alreadyRecorded ? "BẠN ĐÃ ĐIỂM DANH" : "ĐIỂM DANH THÀNH CÔNG" : needsReview ? "Chờ xác nhận thủ công" : latest.decision === "ERROR" ? "Lỗi quét điểm danh" : "Chưa nhận diện được"}</Typography>
              {accepted ? <>
                <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 700 }}>{latest.participant?.displayName || "Học viên"}</Typography>
                <Typography variant="body2" color="text.secondary">Mã học viên: {latest.participant?.code || latest.participant?.id || "—"}</Typography>
                <Box sx={{ display: "flex", gap: 1, my: 1.5, flexWrap: "wrap" }}><Chip size="small" color={latest.attendance?.status === "LATE" ? "warning" : "success"} label={attendanceLabel(latest.attendance?.status)} />
                  {latest.similarity != null && <Chip size="small" variant="outlined" label={`Độ tương đồng: ${(latest.similarity * 100).toFixed(1)}%`} />}
                </Box>
                <Typography variant="body2">Thời gian ghi nhận: <strong>{timeLabel(latest.attendance?.recordedAt)}</strong></Typography>
                <Typography variant="body2" sx={{ mt: 1.5 }}>{latest.attendance?.alreadyRecorded ? "Hệ thống giữ nguyên lần điểm danh trước đó. Bạn không cần quét lại." : "Điểm danh của bạn đã được lưu. Bạn có thể rời khung để người tiếp theo thực hiện."}</Typography>
              </> : <>
                <Typography variant="body2" sx={{ mt: 1.5 }}>{recognitionMessage(latest)}</Typography>
                {needsReview && <Alert severity="warning" sx={{ mt: 1.5 }}>{latest.reviewId ? "Đã đưa vào hàng đợi duyệt. Điểm danh chưa được xác nhận thành công." : "Điểm danh chưa được ghi nhận. Vui lòng quét lại."}</Alert>}
              </>}
            </> : <Box sx={{ pt: 2 }}><CameraAlt sx={{ fontSize: 42, color }} /><Typography variant="h6" component="h2" sx={{ mt: 1 }}>Sẵn sàng điểm danh</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Đưa khuôn mặt vào khung. Chờ thông báo “ĐIỂM DANH THÀNH CÔNG” trước khi rời camera.</Typography></Box>}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="subtitle2" component="h2" fontWeight={700}>Vừa ghi nhận tại máy này</Typography>
          {!recentScans.length ? <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Chưa có lượt điểm danh thành công trong lần mở này.</Typography> : recentScans.map((item) => <Box key={item.attendanceId} sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.25, borderBottom: "1px solid #edf0f3", "&:last-child": { borderBottom: 0 } }}>
            <CheckCircle color="success" fontSize="small" /><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={600}>{item.participant?.displayName || "Học viên"}</Typography><Typography variant="caption" color="text.secondary">{item.participant?.code || item.participant?.id} · {attendanceLabel(item.attendance?.status)}</Typography></Box><Typography variant="caption" color="text.secondary">{timeLabel(item.attendance?.recordedAt)}</Typography>
          </Box>)}
        </Paper>
      </Box>
    </Box>
  </Box>;
}
