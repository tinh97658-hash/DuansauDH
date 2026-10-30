export function captureHint(analysis) {
  if (analysis.face_count > 1) return "Có nhiều khuôn mặt. Chỉ một người đứng trong khung camera.";
  if (!analysis.face_count || analysis.status === "no_face") return "Chưa thấy khuôn mặt. Hãy nhìn vào camera.";
  const q = analysis.quality || {};
  if (analysis.status === "face_too_small" || q.face_area_ratio < 0.04) return "Hãy đến gần camera hơn để thấy rõ khuôn mặt.";
  if (q.brightness < 0.18) return "Ảnh thiếu sáng. Hãy hướng mặt về phía nguồn sáng.";
  if (q.brightness > 0.88) return "Ảnh quá sáng. Hãy tránh ánh sáng chiếu thẳng vào camera.";
  if (q.blur < 20) return "Ảnh chưa nét. Hãy giữ yên khuôn mặt và camera.";
  if (!analysis.quality_ok) return "Hãy nhìn rõ vào camera, giữ đầu ngay ngắn và đủ sáng.";
  return "";
}

export function stableBoxes(first, next) {
  if (!Array.isArray(first) || !Array.isArray(next) || first.length !== 4 || next.length !== 4 || ![...first, ...next].every(Number.isFinite)) return false;
  const area = (box) => Math.max(0, box[2] - box[0]) * Math.max(0, box[3] - box[1]);
  const intersection = Math.max(0, Math.min(first[2], next[2]) - Math.max(first[0], next[0])) * Math.max(0, Math.min(first[3], next[3]) - Math.max(first[1], next[1]));
  return intersection / Math.max(area(first) + area(next) - intersection, 1e-6) >= 0.82;
}

export const waitForFrame = (ms, signal) => new Promise((resolve) => {
  const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
  const timer = setTimeout(finish, ms);
  if (signal.aborted) finish(); else signal.addEventListener("abort", finish, { once: true });
});

export async function captureAnalyzedFrame({ video, canvas, analyze, signal }) {
  if (signal.aborted) return null;
  if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không thể chụp ảnh từ camera.");
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (signal.aborted) return null;
  if (!blob) throw new Error("Không thể chụp ảnh từ camera. Vui lòng thử lại.");
  const analysis = await analyze(blob, signal);
  return signal.aborted ? null : { blob, analysis, at: performance.now() };
}

export async function captureStableFace({ video, canvas, analyze, signal, onGuide, poseMatches = () => true }) {
  let samples = [];
  for (let attempt = 0; attempt < 6 && !signal.aborted; attempt++) {
    if (attempt) await waitForFrame(350, signal);
    if (signal.aborted) return null;
    const sample = await captureAnalyzedFrame({ video, canvas, analyze, signal });
    if (!sample) return null;
    const { analysis } = sample;
    const hint = captureHint(analysis);
    if (hint || analysis.face_count !== 1 || !analysis.quality_ok) { onGuide(hint || "Chưa đủ điều kiện chụp."); return null; }
    if (!poseMatches(analysis.yaw_signed)) { onGuide("Quay đầu nhẹ theo hướng dẫn; giữ yên khi đúng góc."); return null; }
    if (!analysis.bbox || !stableBoxes(analysis.bbox, analysis.bbox)) { onGuide("Chưa xác định được vị trí khuôn mặt."); return null; }
    if (samples.length && !stableBoxes(samples[0].analysis.bbox, analysis.bbox)) samples = [];
    samples.push(sample);
    onGuide(`Giữ yên khuôn mặt (${Math.min(samples.length, 3)}/3 khung ổn định).`);
    if (samples.length >= 3 && samples.at(-1).at - samples[0].at >= 650) {
      return samples.reduce((best, item) => (item.analysis.quality_score ?? 0) > (best.analysis.quality_score ?? 0) ? item : best);
    }
  }
  onGuide("Khuôn mặt đang di chuyển. Hãy giữ yên một chút.");
  return null;
}
