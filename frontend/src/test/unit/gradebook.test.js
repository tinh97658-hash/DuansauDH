import { draftOf, gradebookColumns, gradebookCsv, gradebookRowValues, gradePayload, rowError, visibleGradeRows } from "../../features/exams/gradebook";

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

it("omits score columns from exam CSV without erasing stored data", () => {
  const input = row({ courseScore: 8.75, letterGrade: "A", grade4: 3.7 });
  const csv = gradebookCsv([input], true);
  expect(csv).toContain('"Nguyễn Văn","An"');
  expect(csv).not.toContain("8.75");
  expect(csv).not.toContain("Điểm học phần");
  expect(csv).not.toContain("Thang điểm chữ");
  expect(csv).not.toContain("Điểm các lần thi hết môn");
  expect(csv.split("\r\n")[0].split(",")).toHaveLength(9);
  expect(gradebookCsv([input])).toContain("Điểm học phần");
  expect(input.courseScore).toBe("8.75");
});

it("escapes CSV quotes, commas, and spreadsheet formulas", () => {
  const csv = gradebookCsv([row({ code: '=HYPERLINK("x")', fullName: 'Nguyễn, Văn An' })]);
  expect(csv).toContain("'=HYPERLINK(\"\"x\"\")");
  expect(csv).toContain('"Nguyễn, Văn"');
});

it("exports the screen's column order and date format for each tab", () => {
  const input = { ...row({ dob: "1990-01-02", eligible: true, courseScore: 8.5, result: "passed" }), courseScore: "8,5" };
  for (const exam of [false, true]) {
    const csv = gradebookCsv([input], exam).replace(/^\uFEFF/, "");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(gradebookColumns(exam).map(({ label }) => `"${label}"`).join(","));
    expect(gradebookRowValues(input, 0, exam)).toHaveLength(gradebookColumns(exam).length);
    expect(lines[1]).toContain('"02/01/1990"');
    expect(lines[1]).toContain('"Đủ tư cách"');
  }
  expect(gradebookCsv([input])).toContain('"8,5"');
  expect(gradebookCsv([input], true)).not.toContain('"8,5"');
  expect(gradebookCsv([input], true)).not.toContain('"Đạt"');
});
