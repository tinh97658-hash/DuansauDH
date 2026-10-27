import axios from "axios";
import { API_BASE_URL } from "../../config/http";

const url = (path) => `${API_BASE_URL}${path}`;
const config = (extra = {}) => ({ withCredentials: true, ...extra });

/** Lấy danh sách điểm danh của một buổi học */
export const listSessionAttendance = (sessionId) =>
  axios.get(url(`/attendance/sessions/${sessionId}/attendance`), config()).then(({ data }) => data);

/** Gửi frame ảnh từ kiosk để nhận diện và điểm danh */
export const recognizeAttendance = (sessionId, formData) =>
  axios.post(url(`/attendance/sessions/${sessionId}/recognize`), formData, config({
    headers: { "Content-Type": "multipart/form-data" },
  })).then(({ data }) => data);

/** Lấy danh sách ca nghi vấn (Review Queue) của buổi học */
export const listSessionReviews = (sessionId, status = "PENDING") =>
  axios.get(url(`/attendance/sessions/${sessionId}/reviews?status=${status}`), config()).then(({ data }) => data);

/** Xử lý ca nghi vấn trong Review Queue */
export const resolveReview = (reviewId, payload) =>
  axios.post(url(`/attendance/reviews/${reviewId}/resolve`), payload, config()).then(({ data }) => data);

/** Kiểm tra thông tin đăng ký khuôn mặt của học viên */
export const getParticipantEnrollment = (participantId) =>
  axios.get(url(`/attendance/participants/${encodeURIComponent(participantId)}/enrollment`), config()).then(({ data }) => data);

/** Đăng ký 3-5 ảnh khuôn mặt cho học viên */
export const enrollParticipant = (participantId, formData) =>
  axios.post(url(`/attendance/participants/${encodeURIComponent(participantId)}/enrollment`), formData, config({
    headers: { "Content-Type": "multipart/form-data" },
  })).then(({ data }) => data);

/** Xóa / thu hồi mẫu sinh trắc học khi học viên rút consent */
export const withdrawParticipantEnrollment = (participantId) =>
  axios.delete(url(`/attendance/participants/${encodeURIComponent(participantId)}/enrollment`), config()).then(({ data }) => data);

/** Xem lịch sử audit sinh trắc của học viên */
export const listParticipantAudit = (participantId, limit = 50) =>
  axios.get(url(`/attendance/participants/${encodeURIComponent(participantId)}/enrollment/audit?limit=${limit}`), config()).then(({ data }) => data);
