const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

export const teachingUnits: Record<string, { faculty: string; departments: [string, string, string] }> = {
  ATM: { faculty: "Khoa Ngoại ngữ", departments: ["Bộ môn Tiếng Anh chuyên ngành", "Bộ môn Ngôn ngữ Anh", "Bộ môn Biên - Phiên dịch"] },
  CHUNG: { faculty: "Viện Đào tạo Sau đại học", departments: ["Bộ môn Lý luận chính trị", "Bộ môn Khoa học cơ bản", "Bộ môn Phương pháp nghiên cứu"] },
  CKTB: { faculty: "Khoa Cơ khí", departments: ["Bộ môn Kỹ thuật cơ khí", "Bộ môn Động lực tàu thủy", "Bộ môn Máy và Tự động thủy khí"] },
  CNT: { faculty: "Khoa Công nghệ thông tin", departments: ["Bộ môn Kỹ thuật máy tính", "Bộ môn Hệ thống thông tin", "Bộ môn Công nghệ phần mềm"] },
  DKTB: { faculty: "Khoa Hàng hải", departments: ["Bộ môn Điều khiển tàu biển", "Bộ môn Máy tàu biển", "Bộ môn An toàn hàng hải"] },
  DTDD: { faculty: "Khoa Điện - Điện tử", departments: ["Bộ môn Kỹ thuật điện", "Bộ môn Điện tử - Viễn thông", "Bộ môn Tự động hóa"] },
  KMT: { faculty: "Viện Môi trường", departments: ["Bộ môn Kỹ thuật môi trường", "Bộ môn Hóa môi trường", "Bộ môn Quản lý môi trường"] },
  KTHH: { faculty: "Khoa Hàng hải", departments: ["Bộ môn Khai thác hàng hải", "Bộ môn Luật hàng hải", "Bộ môn An toàn hàng hải"] },
  "KTHH-TS": { faculty: "Khoa Hàng hải", departments: ["Bộ môn Khai thác hàng hải", "Bộ môn Luật hàng hải", "Bộ môn An toàn hàng hải"] },
  KTK: { faculty: "Khoa Kinh tế", departments: ["Bộ môn Kế toán", "Bộ môn Kiểm toán", "Bộ môn Tài chính"] },
  KTVB: { faculty: "Khoa Kinh tế", departments: ["Bộ môn Kinh tế vận tải biển", "Bộ môn Logistics", "Bộ môn Kinh tế hàng hải"] },
  QKD: { faculty: "Khoa Kinh tế", departments: ["Bộ môn Quản trị kinh doanh", "Bộ môn Marketing", "Bộ môn Logistics"] },
  XDCT: { faculty: "Khoa Công trình", departments: ["Bộ môn Công trình thủy", "Bộ môn Công trình biển", "Bộ môn Kỹ thuật xây dựng"] },
  "CTB-TS": { faculty: "Khoa Công trình", departments: ["Bộ môn Công trình thủy", "Bộ môn Công trình biển", "Bộ môn Kỹ thuật xây dựng"] },
  "KTTC-TS": { faculty: "Khoa Cơ khí", departments: ["Bộ môn Kỹ thuật tàu thủy", "Bộ môn Đóng tàu", "Bộ môn Máy tàu thủy"] },
  "TDH-TS": { faculty: "Khoa Điện - Điện tử", departments: ["Bộ môn Tự động hóa", "Bộ môn Điều khiển", "Bộ môn Điện công nghiệp"] },
};

const keywordDepartment = (majorCode: string, name: string) => {
  if (majorCode === "CNT") {
    if (/(python|nhung|may tinh|lap trinh huong doi tuong)/.test(name)) return 0;
    if (/(co so du lieu|he thong thong tin|web|du lieu)/.test(name)) return 1;
    if (/(phan mem|phat trien ung dung|bao mat|an toan)/.test(name)) return 2;
  }
  if (majorCode === "DTDD" || majorCode === "TDH-TS") {
    if (/(dien nang|may dien|luoi dien|dien cong nghiep|nang luong)/.test(name)) return 0;
    if (/(dien tu|tin hieu|iot|mang cam bien|nhung)/.test(name)) return 1;
    if (/(dieu khien|tu dong|robot|ai)/.test(name)) return 2;
  }
  if (majorCode === "QKD") {
    if (/(quan tri|hanh vi|lanh dao|du an|rui ro)/.test(name)) return 0;
    if (/(marketing|dam phan|kinh doanh quoc te)/.test(name)) return 1;
    if (/(chuoi cung ung|van hanh|logistics|he thong thong tin)/.test(name)) return 2;
  }
  if (majorCode === "XDCT" || majorCode === "CTB-TS") {
    if (/(thuy luc|cong trinh thuy|cang|song)/.test(name)) return 0;
    if (/(bien|bo|de|ngoai khoi)/.test(name)) return 1;
    if (/(xay dung|ket cau|be tong|nen|mong|thi cong|vat lieu)/.test(name)) return 2;
  }
  return -1;
};

export function teachingUnitForSubject(majorCode: string, subject: { id?: string; name?: string; subjectType?: string }) {
  const name = normalize(subject.name);
  if (/(tieng anh|ngoai ngu)/.test(name)) return { faculty: teachingUnits.ATM.faculty, department: teachingUnits.ATM.departments[0], common: true };
  if (/(triet|ly luan chinh tri)/.test(name)) return { faculty: teachingUnits.CHUNG.faculty, department: teachingUnits.CHUNG.departments[0], common: true };
  if (subject.subjectType === "KC" || /(khoa hoc chung)/.test(name)) return { faculty: teachingUnits.CHUNG.faculty, department: teachingUnits.CHUNG.departments[1], common: true };
  const unit = teachingUnits[majorCode];
  if (!unit) return null;
  const keywordIndex = keywordDepartment(majorCode, name);
  const fallbackIndex = [...String(subject.id || subject.name || majorCode)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return { faculty: unit.faculty, department: unit.departments[keywordIndex >= 0 ? keywordIndex : fallbackIndex], common: false };
}

export function lecturerMatchesTeachingUnit(lecturer: { faculty?: string | null; department?: string | null }, unit: { faculty: string; department: string } | null) {
  if (!unit || (!lecturer.faculty && !lecturer.department)) return true;
  return normalize(lecturer.faculty) === normalize(unit.faculty) && normalize(lecturer.department) === normalize(unit.department);
}
