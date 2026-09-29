export const majorDisciplineId = (major) => major?.disciplineId || major?.discipline?.id || "";

export const disciplinesFromMajors = (majors = []) => {
  const byId = new Map();
  majors.forEach((major) => {
    const id = majorDisciplineId(major);
    if (!id || byId.has(id)) return;
    byId.set(id, {
      id,
      code: major.discipline?.code || "",
      name: major.discipline?.name || "Ngành chưa xác định",
    });
  });
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "vi"));
};

export const majorsForDiscipline = (majors = [], disciplineId = "") => (
  disciplineId ? majors.filter((major) => majorDisciplineId(major) === disciplineId) : majors
);

export const disciplineOptionLabel = (discipline) => (
  discipline?.code ? `${discipline.code} — ${discipline.name}` : discipline?.name || ""
);
