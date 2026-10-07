import { draftOf, gradebookCsv, gradePayload, rowError, visibleGradeRows } from "../../features/exams/gradebook";

const row = (overrides = {}) => draftOf({ participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", eligible: null, examExempt: false, result: "pending", ...overrides });

it("distinguishes a missing score from zero and accepts Vietnamese decimal input", () => {
  expect(gradePayload(row()).courseScore).toBeNull();
  expect(gradePayload(row({ courseScore: 0 })).courseScore).toBe(0);
  expect(gradePayload({ ...row(), courseScore: "8,5", attemptScores: "7,5; 9" })).toMatchObject({ courseScore: 8.5, attemptScores: [7.5, 9] });
  expect(rowError({ ...row(), testScore: "11" })).toMatch(/0 đến 10/);
  expect(rowError({ ...row(), grade4: "5" })).toMatch(/0 đến 4/);
});

it("includes only confirmed eligible examinees in DS thi and everyone in the full gradebook", () => {
  const rows = [row(), row({ eligible: false }), row({ eligible: true }), row({ eligible: true, examExempt: true })];
  expect(visibleGradeRows(rows, "exam", "")).toEqual([rows[2]]);
  expect(visibleGradeRows(rows, "all", "")).toHaveLength(4);
});

it("does not calculate deferred grades", () => {
  expect(gradePayload(row({ testScore: 8, assignmentScore: 9, examScore: 10 })).courseScore).toBeNull();
});

it("exports blank score columns without erasing stored data", () => {
  const input = row({ courseScore: 8.75, letterGrade: "A", grade4: 3.7 });
  const csv = gradebookCsv([input], true);
  expect(csv).toContain('"Nguyễn Văn","An"');
  expect(csv).not.toContain("8.75");
  expect(input.courseScore).toBe("8.75");
});

it("escapes CSV quotes, commas, and spreadsheet formulas", () => {
  const csv = gradebookCsv([row({ code: '=HYPERLINK("x")', fullName: 'Nguyễn, Văn An' })]);
  expect(csv).toContain("'=HYPERLINK(\"\"x\"\")");
  expect(csv).toContain('"Nguyễn, Văn"');
});
