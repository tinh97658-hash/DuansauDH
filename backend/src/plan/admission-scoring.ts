export const ADMISSION_SOURCE = "https://www.sdh.vimaru.edu.vn/sites/sdh.vimaru.edu.vn/files/3._Thong_bao_tuyen_sinh_ThS_dot_2_nam_2026_final-up.pdf";
export const DEFAULT_ADMISSION_RULES = {
  direct: 10, bridge: 8, priority: 1,
  excellent: 6, veryGood: 5, good: 4.5, fairlyGood: 4, average: 3,
  englishDegree: 3, certificateB3: 2, certificateB4: 3,
  exam5: 1, exam7: 1.5, exam8: 2,
};
export type AdmissionRules = typeof DEFAULT_ADMISSION_RULES;
export interface AdmissionInputs {
  manualTotal?: number;
  degreeVerified?: boolean;
  documentsVerified?: boolean;
  healthVerified?: boolean;
  majorFit?: "direct" | "bridge" | "unsuitable";
  fitEvidence?: string;
  bridgeCompleted?: boolean;
  bridgeEvidence?: string;
  priorityVerified?: boolean;
  priorityEvidence?: string;
  englishType?: "exam" | "certificate_b3" | "certificate_b4" | "english_degree" | "vmu_degree" | "none";
  englishVerified?: boolean;
  englishEvidence?: string;
  englishValidUntil?: string;
  englishDegreeDate?: string;
  applicationDate?: string;
  englishScore?: number;
  gpa10?: number;
  graduationScore?: number;
}
export const ADMISSION_CORE_FIELDS = ["majorId", "trainingLevel", "academicYear", "gradClassification", "gpa", "gender", "priorityObject", "supplementSubjectsCount", "documents", "gradYear", "gradMajor", "gradSchool", "diplomaNumber"];
export function normalizedAdmissionValue(key: string, value: any) {
  if (key === "documents") return Object.fromEntries(Object.entries(value || {}).filter(([, checked]) => checked === true));
  if (key === "supplementSubjectsCount") return Number(value || 0);
  return value === "" || value === undefined ? null : value;
}
export function admissionRecordSnapshot(record: any) {
  return Object.fromEntries(ADMISSION_CORE_FIELDS.map((key) => [key, normalizedAdmissionValue(key, record[key] ?? null)]));
}
const classifications: Record<string, keyof AdmissionRules> = {
  "Xuất sắc": "excellent", "Giỏi": "veryGood", "Khá": "good", "Trung bình khá": "fairlyGood", "Trung bình": "average",
};
export function admissionCutoff(round: any, majorId: string): number | null {
  const value = Array.isArray(round.majorThresholds)
    ? round.majorThresholds.find((entry: any) => entry.majorId === majorId)?.cutoff
    : round.majorId === majorId ? round.cutoff : null;
  return value == null ? null : Number(value);
}
export function admissionBirthYear(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const value = dob.trim();
  const match = value.match(/^(\d{4})(?:[-/]|$)/) || value.match(/[-/](\d{4})$/);
  return match ? Number(match[1]) : null;
}
export function scoreAdmission(record: any, input: AdmissionInputs, round: any) {
  const rules: AdmissionRules = round.rules || DEFAULT_ADMISSION_RULES;
  const missing: string[] = [];
  const failed: string[] = [];
  if (record.trainingLevel !== "Thạc sĩ") failed.push("Bộ tiêu chí này chỉ áp dụng cho thạc sĩ.");
  if (record.academicYear !== round.academicYear) failed.push("Năm tuyển sinh không khớp đợt xét tuyển.");
  // Tổng điểm do cán bộ nhập từ bảng điểm đã chốt, độc lập với cách tính thành phần.
  if (input.manualTotal !== undefined && input.manualTotal !== null) {
    const valid = Number.isFinite(input.manualTotal) && input.manualTotal >= 0 && input.manualTotal <= 20;
    if (!valid) failed.push("Tổng điểm phải từ 0 đến 20.");
    const cutoff = admissionCutoff(round, record.majorId);
    if (cutoff === null) missing.push("Chưa nhập điểm xét tuyển của ngành.");
    else if (valid && input.manualTotal < cutoff) failed.push("Tổng điểm chưa đạt điểm xét tuyển của ngành.");
    const eligibility = failed.length ? "ineligible" : missing.length ? "pending" : "eligible";
    return { components: { fit: null, priority: null, degree: null, english: null }, total: valid ? input.manualTotal : null,
      eligibility, missing, failed, cutoff, meetsCutoff: valid && cutoff !== null ? !failed.length : null,
      tieBreak: { gpa10: input.gpa10 ?? null, female: record.gender === "Nữ", graduationScore: input.graduationScore ?? null } };
  }
  if (!input.degreeVerified) missing.push("Chưa xác minh văn bằng hoặc điều kiện công nhận tốt nghiệp đại học.");
  if (!input.documentsVerified) missing.push("Chưa xác minh hồ sơ dự tuyển đầy đủ, hợp lệ.");
  if (!input.healthVerified) missing.push("Chưa xác minh điều kiện sức khỏe.");
  let fit: number | null = null;
  if (!input.majorFit || !input.fitEvidence?.trim()) missing.push("Chưa xác minh mức độ phù hợp ngành theo danh mục của Viện.");
  else if (input.majorFit === "unsuitable") failed.push("Ngành tốt nghiệp không phù hợp.");
  else {
    fit = rules[input.majorFit];
    if (input.majorFit === "bridge" && (!input.bridgeCompleted || !input.bridgeEvidence?.trim())) missing.push("Chưa xác minh hoàn thành các học phần bổ sung kiến thức.");
  }
  const classification = classifications[record.gradClassification];
  const degree = classification ? rules[classification] : null;
  if (degree === null) missing.push("Chưa có xếp loại tốt nghiệp hợp lệ.");
  const hasPriority = Boolean(record.priorityObject?.trim() && record.priorityObject !== "Không");
  let priority = 0;
  if (hasPriority) {
    if (!input.priorityVerified || !input.priorityEvidence?.trim()) missing.push("Đối tượng ưu tiên chưa có minh chứng được xác minh.");
    else priority = rules.priority;
  }
  let english: number | null = null;
  if (!input.englishType || !input.englishVerified || !input.englishEvidence?.trim()) missing.push("Chưa xác minh minh chứng hoặc kết quả tiếng Anh đầu vào.");
  else if (input.englishType === "none") failed.push("Chưa đáp ứng tiếng Anh từ bậc 3.");
  else if (input.englishType === "exam") {
    if (input.englishScore === undefined || input.englishScore === null) missing.push("Chưa nhập điểm thi tiếng Anh.");
    else if (input.englishScore < 5) failed.push("Điểm thi tiếng Anh dưới 5/10.");
    else english = input.englishScore >= 8 ? rules.exam8 : input.englishScore >= 7 ? rules.exam7 : rules.exam5;
  } else if (["certificate_b3", "certificate_b4"].includes(input.englishType)) {
    if (!input.applicationDate || !input.englishValidUntil) missing.push("Chưa có ngày đăng ký dự tuyển hoặc hạn hiệu lực chứng chỉ.");
    else if (input.englishValidUntil < input.applicationDate) failed.push("Chứng chỉ tiếng Anh hết hiệu lực tại ngày đăng ký dự tuyển.");
    else english = input.englishType === "certificate_b4" ? rules.certificateB4 : rules.certificateB3;
  } else if (input.englishType === "english_degree") english = rules.englishDegree;
  else if (input.englishType === "vmu_degree") {
    if (!input.englishDegreeDate || !input.applicationDate) missing.push("Chưa có ngày cấp bằng và ngày đăng ký để kiểm tra thời hạn 2 năm.");
    else {
      const limit = new Date(input.englishDegreeDate + "T00:00:00Z");
      limit.setUTCFullYear(limit.getUTCFullYear() + 2);
      if (input.englishDegreeDate > input.applicationDate || input.applicationDate > limit.toISOString().slice(0, 10)) failed.push("Bằng do Trường cấp không nằm trong thời hạn 2 năm.");
      // Phụ lục 03 chưa xác định rõ điểm cho riêng loại bằng này.
      missing.push("Bằng ĐHHHVN đáp ứng ngoại ngữ: cần Viện xác nhận căn cứ quy đổi điểm trước khi xét trúng tuyển.");
    }
  }
  const components = { fit, priority, degree, english };
  const total = Object.values(components).every((value) => value !== null)
    ? Math.round(Object.values(components).reduce<number>((sum, value) => sum + (value ?? 0), 0) * 100) / 100 : null;
  const eligibility = failed.length ? "ineligible" : missing.length ? "pending" : "eligible";
  const cutoff = admissionCutoff(round, record.majorId);
  return { components, total, eligibility, missing, failed, cutoff,
    meetsCutoff: eligibility === "eligible" && total !== null && cutoff !== null ? total >= cutoff : null,
    tieBreak: { gpa10: input.gpa10 ?? null, female: record.gender === "Nữ", graduationScore: input.graduationScore ?? null },
  };
}
export function compareAdmissions(a: any, b: any) {
  const number = (value: any) => value === null || value === undefined ? -1 : Number(value);
  return number(b.total) - number(a.total)
    || number(b.tieBreak.gpa10) - number(a.tieBreak.gpa10)
    || Number(b.tieBreak.female) - Number(a.tieBreak.female)
    || number(b.tieBreak.graduationScore) - number(a.tieBreak.graduationScore);
}

/** Missing tie-break evidence must never give another applicant a silent advantage. */
export function rankAdmissions(rows: any[]) {
  rows.sort(compareAdmissions);
  let start = 0;
  while (start < rows.length) {
    let end = start + 1;
    while (end < rows.length && rows[end].total === rows[start].total) end++;
    const group = rows.slice(start, end);
    if (group.length > 1 && group.some((row) => row.tieBreak.gpa10 === null)) {
      group.forEach((row) => { row.rank = start + 1; row.tieBreakPending = true; });
    } else {
      let position = start;
      while (position < end) {
        let next = position + 1;
        while (next < end && rows[next].tieBreak.gpa10 === rows[position].tieBreak.gpa10 && rows[next].tieBreak.female === rows[position].tieBreak.female) next++;
        const tied = rows.slice(position, next);
        if (tied.length > 1 && tied.some((row) => row.tieBreak.graduationScore === null)) {
          tied.forEach((row) => { row.rank = position + 1; row.tieBreakPending = true; });
        } else tied.forEach((row, index) => { row.rank = index && compareAdmissions(row, tied[index - 1]) === 0 ? tied[index - 1].rank : position + index + 1; row.tieBreakPending = false; });
        position = next;
      }
    }
    start = end;
  }
  return rows;
}
