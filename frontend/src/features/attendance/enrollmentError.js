function translateReason(reason) {
  return reason
    .replace(/low_quality:\s*/g, "")
    .replace(/no_face: no face detected/g, "Không phát hiện được khuôn mặt")
    .replace(/multiple_faces: exactly one face is required/g, "Có nhiều khuôn mặt; chỉ một người trong ảnh")
    .replace(/face_too_small: /g, "Khuôn mặt quá nhỏ: ")
    .replace(/largest face is ([\d.]+)px; minimum is ([\d.]+)px/g, "kích thước $1 px, tối thiểu $2 px")
    .replace(/alignment_failed: /g, "Không căn chỉnh được khuôn mặt: ")
    .replace(/missing embedding/g, "Không trích xuất được đặc trưng khuôn mặt")
    .replace(/missing quality/g, "Không tính được chất lượng ảnh")
    .replace(/blur ([\d.]+) < ([\d.]+)/g, "Độ nét $1 thấp hơn ngưỡng $2")
    .replace(/face_area_ratio ([\d.]+) < ([\d.]+)/g, "Tỷ lệ khuôn mặt $1 thấp hơn ngưỡng $2")
    .replace(/brightness ([\d.]+) outside \[([\d.]+), ([\d.]+)\]/g, "Độ sáng $1 ngoài khoảng $2–$3")
    .replace(/contrast ([\d.]+) < ([\d.]+)/g, "Độ tương phản $1 thấp hơn ngưỡng $2")
    .replace(/yaw_proxy ([\d.]+) > ([\d.]+)/g, "Độ nghiêng trái/phải $1 vượt ngưỡng $2")
    .replace(/roll (-?[\d.]+) deg exceeds \+\/-([\d.]+)/g, "Góc nghiêng đầu $1° vượt ngưỡng ±$2°");
}

export function formatEnrollmentError(detail) {
  if (Array.isArray(detail)) return detail.map(formatEnrollmentError).join("\n");
  if (typeof detail !== "string") return "Không đăng ký được khuôn mặt. Vui lòng thử lại.";

  const match = detail.match(/^only (\d+) of (\d+) images passed quality; need at least (\d+)(?:; (.*))?$/s);
  if (!match) return detail;
  const [, accepted, total, required, reasons] = match;
  const summary = `Có ${accepted}/${total} ảnh đạt yêu cầu, cần ít nhất ${required} ảnh đạt.`;
  if (!reasons) return `${summary}\nDịch vụ chưa trả lý do loại từng ảnh.`;
  return [summary, ...reasons.split(" | ").map((item) => {
    const image = item.match(/^image (\d+): (.*)$/s);
    return image ? `Ảnh #${image[1]}: ${translateReason(image[2])}` : translateReason(item);
  })].join("\n");
}
