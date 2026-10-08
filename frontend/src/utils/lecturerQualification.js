// Nguồn Đơn vị hiện tại là Discipline. Picker chỉ sử dụng Unit;
// không suy đoán từ faculty, mã hoặc chuyên ngành của giảng viên.
export const lecturerUnitOf = (lecturer) => {
  const id = lecturer?.disciplineId || lecturer?.discipline?.id;
  const name = lecturer?.discipline?.name;
  return id && name ? { id, name, code: lecturer.discipline.code } : null;
};

export const recommendedUnitForOffering = (offering) => {
  const major = offering?.subject?.major;
  const id = major?.disciplineId || major?.discipline?.id;
  return id ? { id, name: major.discipline?.name, code: major.discipline?.code } : null;
};

export const lecturerBelongsToRecommendedUnit = (lecturer, offering) => {
  const unit = lecturerUnitOf(lecturer);
  return !!unit && unit.id === recommendedUnitForOffering(offering)?.id;
};

export const lecturerGroupsForOffering = (lecturers, offering) => {
  const groups = new Map();
  lecturers.forEach((lecturer) => {
    const unit = lecturerUnitOf(lecturer);
    const key = unit ? `unit:${unit.id}` : "unassigned";
    if (!groups.has(key)) groups.set(key, { key, name: unit?.name || "Chưa có đơn vị", recommended: false, lecturers: [] });
    const group = groups.get(key);
    group.recommended ||= lecturerBelongsToRecommendedUnit(lecturer, offering);
    group.lecturers.push(lecturer);
  });
  return [...groups.values()].map((group) => ({
    ...group, lecturers: group.lecturers.sort((left, right) => (left.name || "").localeCompare(right.name || "", "vi")),
  })).sort((left, right) => Number(right.recommended) - Number(left.recommended)
    || Number(left.key === "unassigned") - Number(right.key === "unassigned")
    || left.name.localeCompare(right.name, "vi"));
};
