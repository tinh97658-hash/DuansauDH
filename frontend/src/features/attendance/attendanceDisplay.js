export const participantId = (participant) => participant?.id || participant?.studentId || participant?.learnerId || "";

export function roomLabel(room) {
  return typeof room === "string" ? room : room?.code || room?.name || "Chưa xếp phòng";
}

export function courseLabel(session) {
  return session?.courseOffering?.subjectName || session?.courseOffering?.name ||
    session?.courseOffering?.subject?.name || session?.courseOfferingName || "Điểm Danh Buổi Học";
}

export function sessionTime(session) {
  if (session?.startTime) return `${session.startTime} - ${session.endTime || "..."}`;
  return session?.period === "MORNING" ? "Sáng 07:30 - 11:30" :
    session?.period === "AFTERNOON" ? "Chiều 13:30 - 17:00" : "Chưa có giờ học";
}

export function errorMessage(error, fallback = "Không thể xử lý yêu cầu. Vui lòng thử lại.") {
  const detail = error?.response?.data?.message || error?.message;
  if (Array.isArray(detail)) return detail.filter((item) => typeof item === "string").join("; ") || fallback;
  return typeof detail === "string" ? detail : fallback;
}

export function recognitionMessage(result) {
  if (result?.decision === "ERROR") return result.reason || "Dịch vụ nhận diện gặp lỗi. Vui lòng thử lại.";
  const reasons = {
    empty_roster: "Lớp chưa có học viên trong danh sách.",
    empty_gallery: "Chưa có mẫu khuôn mặt đã đăng ký để đối chiếu.",
    subject_not_in_roster: "Khuôn mặt không thuộc danh sách lớp học phần này.",
    outside_roster: "Khuôn mặt không thuộc danh sách lớp học phần này.",
    no_face: "Chưa phát hiện khuôn mặt. Vui lòng đưa mặt vào khung camera.",
    multiple_faces: "Có nhiều khuôn mặt. Chỉ một người đứng trong khung camera.",
    face_too_small: "Khuôn mặt quá nhỏ. Vui lòng đến gần camera hơn.",
    alignment_failed: "Chưa căn chỉnh được khuôn mặt. Vui lòng nhìn thẳng vào camera.",
    below_review_threshold: "Chưa tìm được khuôn mặt phù hợp với mẫu đã đăng ký.",
    margin_too_low: "Kết quả gần giống nhiều học viên, cần xác nhận thủ công.",
    ambiguous_identity: "Khuôn mặt khớp với nhiều học viên trong lớp. Cán bộ cần xác nhận thủ công.",
    face_service_error: "Dịch vụ nhận diện gặp lỗi. Vui lòng thử lại.",
  };
  if (result?.reason?.startsWith("low_quality:")) return "Ảnh camera chưa đạt yêu cầu về độ nét, ánh sáng hoặc góc mặt. Vui lòng điều chỉnh và quét lại.";
  return reasons[result?.reason] || "Vui lòng nhìn thẳng vào camera hoặc điểm danh thủ công.";
}
