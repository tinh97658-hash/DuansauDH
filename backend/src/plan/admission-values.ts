export const STUDY_STATUS_VALUES = ["Nộp hồ sơ đầu vào", "Đủ điều kiện dự tuyển", "Đã trúng tuyển", "Không trúng tuyển",
  "Đang học", "Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học", "Đã thôi học", "Tạm hoãn", "Từ chối",
  "Tạm dừng", "Hoàn thành", "Tốt nghiệp", "Đã tốt nghiệp"];

export const STUDY_MANAGEMENT_STATUSES = [
  "Bảo lưu", "Đang bảo lưu", "Bảo lưu quá hạn", "Thôi học", "Đã thôi học", "Tạm hoãn", "Từ chối",
];

export function normalizeTrainingLevel(value: unknown) {
  if (typeof value !== "string") return value;
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim().toLowerCase();
  if (["masters", "master", "thac si"].includes(key)) return "Thạc sĩ";
  if (["doctoral", "doctor", "phd", "tien si"].includes(key)) return "Tiến sĩ";
  return value.trim();
}
