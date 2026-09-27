import { groupsOf, normalize } from "../features/scheduling/shared";

// Khoa/Viện phụ trách được suy ra từ chuyên ngành của học phần. Đây chỉ là
// tiêu chí ưu tiên hiển thị; giảng viên thuộc khoa khác vẫn luôn được chọn.
export const teachingFaculties = {
  ATM: "Khoa Ngoại ngữ",
  CHUNG: "Viện Đào tạo Sau đại học",
  CKTB: "Khoa Cơ khí",
  CNT: "Khoa Công nghệ thông tin",
  CNTT: "Khoa Công nghệ thông tin",
  DKTB: "Khoa Hàng hải",
  DTDD: "Khoa Điện - Điện tử",
  KMT: "Viện Môi trường",
  KTHH: "Khoa Hàng hải",
  "KTHH-TS": "Khoa Hàng hải",
  "KHHH-TS": "Khoa Hàng hải",
  KTK: "Khoa Kinh tế",
  KTVB: "Khoa Kinh tế",
  QKD: "Khoa Kinh tế",
  QTKD: "Khoa Kinh tế",
  "QLVT-TS": "Khoa Kinh tế",
  XDCT: "Khoa Công trình",
  "CTB-TS": "Khoa Công trình",
  "KTTC-TS": "Khoa Cơ khí",
  "CKDL-TS": "Khoa Cơ khí",
  "TDH-TS": "Khoa Điện - Điện tử",
};

export const teachingMajorCodeForOffering = (offering) => {
  const subject = offering?.subject || {};
  const name = normalize(subject.name);
  if (/(tieng anh|ngoai ngu)/.test(name)) return "ATM";
  if (subject.subjectType === "KC" || /(triet|ly luan chinh tri|khoa hoc chung)/.test(name)) return "CHUNG";
  return groupsOf(offering)[0]?.major?.code || subject.major?.code || null;
};

export const teachingFacultyForOffering = (offering) => {
  return teachingFaculties[teachingMajorCodeForOffering(offering)] || null;
};

export const lecturerBelongsToOfferingFaculty = (lecturer, offering) => {
  const teachingMajorCode = teachingMajorCodeForOffering(offering);
  if (teachingMajorCode && lecturerTeachingGroup(lecturer) === teachingMajorCode) return true;
  const teachingFaculty = teachingFacultyForOffering(offering);
  return Boolean(teachingFaculty && normalize(lecturer.faculty) === normalize(teachingFaculty));
};

export const lecturerTeachingGroup = (lecturer) => {
  const code = String(lecturer?.code || "").trim().toUpperCase();
  const majorCode = code.match(/^GV-(.+)-\d+$/)?.[1];
  return majorCode || lecturer?.faculty || "Chưa phân nhóm";
};
