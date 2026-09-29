import { groupsOf } from "../features/scheduling/shared";

// Học phần thuộc một chuyên ngành, và chuyên ngành thuộc một ngành. Gợi ý giảng viên
// dựa trực tiếp trên các khóa ngoại này, không suy đoán từ mã giảng viên hay tên Khoa/Viện.
export const teachingMajorForOffering = (offering) => {
  const subject = offering?.subject || {};
  if (subject.major || subject.majorId) return subject.major || { id: subject.majorId };
  return groupsOf(offering)[0]?.major || null;
};

export const lecturerRecommendationRank = (lecturer, offering) => {
  const teachingMajor = teachingMajorForOffering(offering);
  const teachingMajorId = teachingMajor?.id || offering?.subject?.majorId;
  const teachingDisciplineId = teachingMajor?.disciplineId || teachingMajor?.discipline?.id;
  if (teachingMajorId && lecturer?.majorId === teachingMajorId) return 2;
  if (teachingDisciplineId && lecturer?.disciplineId === teachingDisciplineId) return 1;
  return 0;
};

export const lecturerBelongsToOfferingMajor = (lecturer, offering) => lecturerRecommendationRank(lecturer, offering) === 2;

export const lecturerTeachingGroup = (lecturer) => {
  if (lecturer?.major) return `${lecturer.major.code} · ${lecturer.major.name}`;
  if (lecturer?.discipline) return `${lecturer.discipline.code} · ${lecturer.discipline.name}`;
  return "Chưa phân ngành / chuyên ngành";
};
