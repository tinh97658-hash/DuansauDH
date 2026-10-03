import {
  compactClassCodes,
  countGroupClasses,
  findSimilarSubjects,
  groupCurriculumsByYear,
  normalizeSubjectName,
  suggestCurriculumCode,
} from "../../pages/plan/trainingPlan.logic";

const curriculum = (code, year, classCodes = []) => ({
  id: code,
  code,
  name: `CTĐT ${code}`,
  applicableFromYear: year,
  classGroups: classCodes.map((groupCode) => ({ id: groupCode, code: groupCode })),
});

describe("subject name suggestions", () => {
  const subjects = [
    { id: "1", name: "Cơ sở dữ liệu" },
    { id: "2", name: "Khoa học chung" },
    { id: "3", name: "Hệ thống nhúng" },
  ];

  test("matches partial names without requiring accents", () => {
    expect(findSimilarSubjects(subjects, "co").map((subject) => subject.id)).toContain("1");
    expect(findSimilarSubjects(subjects, "khoa hoc").map((subject) => subject.id)).toContain("2");
  });

  test("matches small typing mistakes", () => {
    expect(findSimilarSubjects(subjects, "khoa hoq").map((subject) => subject.id)).toContain("2");
  });

  test("can exclude the subject currently being edited", () => {
    expect(findSimilarSubjects(subjects, "co", { excludeId: "1" })).toEqual([]);
  });

  test("normalizes Vietnamese names consistently", () => {
    expect(normalizeSubjectName("  CƠ  SỞ dữ liệu ")).toBe("co so du lieu");
  });
});

describe("training plan curriculum grouping", () => {
  test("groups curriculums by intake year with the newest cohort first", () => {
    const groups = groupCurriculumsByYear([
      curriculum("CT-CNTT-2024", "2024"),
      curriculum("CT-CNTT-2026", "2026"),
      curriculum("CT-CNTT-2025", "2025"),
    ]);

    expect(groups.map((group) => group.year)).toEqual(["2026", "2025", "2024"]);
  });

  test("keeps several curriculums of one cohort in the same group", () => {
    const groups = groupCurriculumsByYear([
      curriculum("CT-CNTT-2026-B", "2026"),
      curriculum("CT-CNTT-2026-A", "2026"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].year).toBe("2026");
    expect(groups[0].items.map((item) => item.code)).toEqual(["CT-CNTT-2026-A", "CT-CNTT-2026-B"]);
  });

  test("pushes curriculums without an intake year to the end", () => {
    const groups = groupCurriculumsByYear([
      curriculum("CT-NA", ""),
      curriculum("CT-CNTT-2025", "2025"),
    ]);

    expect(groups.map((group) => group.year)).toEqual(["2025", "—"]);
  });

  test("counts the classes of every curriculum inside one cohort group", () => {
    const items = [
      curriculum("CT-CNTT-2026-A", "2026", ["CNTT2026.01", "CNTT2026.02"]),
      curriculum("CT-CNTT-2026-B", "2026", ["CNTT2026.03"]),
    ];

    expect(countGroupClasses(items)).toBe(3);
  });

  test("summarises long class lists instead of printing every code", () => {
    expect(compactClassCodes([{ code: "A" }, { code: "B" }])).toBe("A, B");
    expect(compactClassCodes([{ code: "A" }, { code: "B" }, { code: "C" }, { code: "D" }])).toBe("A, B +2");
    expect(compactClassCodes([])).toBe("");
  });

  test("suggests an unused curriculum code when the cohort already has one", () => {
    expect(suggestCurriculumCode("CNTT", "2026", [])).toBe("CT-CNTT-2026");
    expect(suggestCurriculumCode("CNTT", "2026", [curriculum("CT-CNTT-2026", "2026")])).toBe("CT-CNTT-2026-2");
    expect(suggestCurriculumCode("CNTT", "2026", [
      curriculum("CT-CNTT-2026", "2026"),
      curriculum("CT-CNTT-2026-2", "2026"),
    ])).toBe("CT-CNTT-2026-3");
  });

  test("falls back to a generic major token when the major code is missing", () => {
    expect(suggestCurriculumCode("", "2026", [])).toBe("CT-NGANH-2026");
  });
});
