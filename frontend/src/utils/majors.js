export const getProgramForTrainingLevel = (trainingLevel) => {
  const normalized = String(trainingLevel || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();

  if (normalized === "doctoral" || normalized.includes("tien si")) return "doctoral";
  if (normalized === "masters" || normalized.includes("thac si")) return "masters";
  return "";
};

export const normalizeMajorsResponse = (payload) => {
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
  return rows
    .filter((major) => major && major.id)
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
};

export const getSelectableMajors = (majors, trainingLevel) => {
  const program = getProgramForTrainingLevel(trainingLevel);
  return normalizeMajorsResponse(majors).filter((major) => (
    major.active !== false && (!program || !major.program || major.program === program)
  ));
};

export const selectMajorForLevel = (majors, trainingLevel, preferredId = "") => {
  const selectable = getSelectableMajors(majors, trainingLevel);
  return selectable.find((major) => major.id === preferredId) || selectable[0] || null;
};
