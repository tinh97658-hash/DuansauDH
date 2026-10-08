// Presentation data for the existing A4 sheet. No admission rules or record writes.
const DETAIL_DOCUMENT_ITEMS = [
  ["docDecision", "Quyết định cử đi học"], ["docApplication", "Đơn xin dự thi"],
  ["docCurriculumVitae", "Sơ yếu lý lịch"], ["docDegree", "Bằng tốt nghiệp ĐH"],
  ["docHealthCert", "Giấy khám sức khoẻ"], ["docPhoto", "Ảnh hồ sơ (3x4)"],
  ["docSupplement", "Học bổ sung kiến thức"], ["docTranscript", "Bảng điểm đại học"],
];
const LIST_DOCUMENT_LABELS = { docDegree: "Bằng tốt nghiệp", docPhoto: "Ảnh hồ sơ", docSupplement: "Học bổ sung", docTranscript: "Bảng điểm" };
const filenamePart = (value) => Array.from(String(value), (character) =>
  character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "-" : character).join("");

export function buildAdmissionDocument(record, { year = new Date().getFullYear(), variant = "detail", now = new Date() } = {}) {
  const field = (label, value, options = {}) => ({ label, value: String(value ?? ""), ...options });
  return {
    version: 1,
    filename: `ho-so-${filenamePart(record.code || record.id || record.fullName)}.docx`,
    masthead: ["BỘ XÂY DỰNG", "TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM", "VIỆN ĐÀO TẠO SAU ĐẠI HỌC"],
    nationalHeading: ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"],
    displayCode: record.code || "VMU-SDH-000",
    dateLine: `Hải Phòng, ngày ${String(now.getDate()).padStart(2, "0")} tháng ${String(now.getMonth() + 1).padStart(2, "0")} năm ${now.getFullYear()}`,
    title: "PHIẾU THÔNG TIN HỒ SƠ TUYỂN SINH",
    subtitle: `(Bậc đào tạo: ${record.trainingLevel?.toUpperCase() || ""} - Niên khóa: ${record.academicYear || year})`,
    fullName: record.fullName || "",
    photo: record.photo || "",
    sections: [
      { title: "I. THÔNG TIN CÁ NHÂN & LIÊN LẠC", fields: [
        field("Họ và tên:", record.fullName, { bold: true, uppercase: true }), field("Mã học viên/SBD:", record.code || "—"),
        field("Ngày sinh:", record.dob || "—"), field("Giới tính:", record.gender || "Nam"),
        field("Số CMND/CCCD:", record.idCard || "—"), field("Nơi sinh:", record.pob || "—"),
        field("Điện thoại:", record.phone || "—"), field("Email:", record.email || "—"),
        field("Dân tộc:", record.ethnicity || "Kinh"), field("Quốc tịch:", record.nationality || "Việt Nam"),
      ], extra: field("Địa chỉ thường trú / Hộ khẩu:", [record.ward, record.city].filter(Boolean).join(", ") || "—") },
      { title: "II. THỂ THỨC & CHƯƠNG TRÌNH ĐÀO TẠO", fields: [
        field("Chuyên ngành đăng ký:", record.majorName || (variant === "list" ? record.major?.name : "") || "—", { bold: true }),
        field("Trình độ đào tạo:", record.trainingLevel || "Thạc sĩ"),
        field("Nhóm hình thức đào tạo:", record.trainingModeGroup || "Chính quy"),
        field("Hình thức đào tạo:", record.trainingModeName || "Đào tạo thông thường"),
        field("Ngôn ngữ giảng dạy:", record.language || "Tiếng Việt"),
        field("Miễn thi môn Ngoại ngữ:", record.isExemptForeignLanguage ? "Được miễn thi (Đạt chuẩn chứng chỉ)" : "Không"),
        field("Hình thức nhận hồ sơ:", record.receiptType || "Trực tiếp"), field("Phân loại hồ sơ:", record.profileCategory || "Đầy đủ"),
        field("Trạng thái hồ sơ:", record.studyStatus || "Nộp hồ sơ đầu vào"), field("Ngày nộp / tiếp nhận:", record.admissionDate || "—"),
      ] },
      { title: "III. VĂN BẰNG ĐẠI HỌC / NĂNG LỰC ĐẦU VÀO", fields: [
        field("Trường tốt nghiệp ĐH:", record.gradSchool || "—"), field("Chuyên ngành tốt nghiệp ĐH:", record.gradMajor || "—"),
        field("Hệ đào tạo ĐH:", record.gradDegreeType || "Chính quy"), field("Năm tốt nghiệp:", record.gradYear || "—"),
        field("Điểm TB tích lũy ĐH:", record.gpa || "—"), field("Xếp loại tốt nghiệp:", record.gradClassification || "—"),
        field("Số hiệu văn bằng ĐH:", record.diplomaNumber || "—"), field("Số vào sổ cấp bằng:", record.registryBookNumber || "—"),
        field("Đơn vị công tác hiện nay:", record.workplace || "—"), field("Nghề nghiệp:", record.job || "—"),
        field("Đối tượng ưu tiên:", record.priorityObject || "Không"), field("Số môn học BSKT:", `${record.supplementSubjectsCount || 0} môn`),
      ], ...(record.note ? { extra: field("Ghi chú thêm:", record.note) } : {}) },
    ],
    checklistTitle: "IV. DANH MỤC HỒ SƠ & GIẤY TỜ ĐÍNH KÈM",
    documents: DETAIL_DOCUMENT_ITEMS.map(([key, label]) => ({ key,
      label: (variant === "list" && LIST_DOCUMENT_LABELS[key]) || label, checked: Boolean(record.documents?.[key]) })),
    signatures: [
      { date: "Hải Phòng, ngày ... tháng ... năm 20...", title: "NGƯỜI KHAI HỒ SƠ", instruction: "(Ký và ghi rõ họ tên)", name: record.fullName || "" },
      { date: "Ngày ... tháng ... năm 20...", title: "CÁN BỘ TIẾP NHẬN", instruction: "(Ký và ghi rõ họ tên)", name: "" },
      { date: "Ngày ... tháng ... năm 20...", title: "VIỆN TRƯỞNG", instruction: "(Ký tên, đóng dấu)", name: "" },
    ],
  };
}
