import { calculateGrade, draftOf, formatAttemptScores, formatScore, gradebookColumns, gradebookCsv, gradebookRowValues, gradePayload, rowError, updateGradeDraft, visibleGradeRows } from "../../features/exams/gradebook";

it("formats exam attempts as comma-separated scores with one decimal place", () => {
  expect(formatAttemptScores([1, 4, 6])).toBe("1.0, 4.0, 6.0");
  expect(formatAttemptScores([0, 7.9])).toBe("0.0, 7.9");
  expect(formatAttemptScores("1; 4; 6")).toBe("1.0, 4.0, 6.0");
  expect(formatAttemptScores([])).toBe("");
  expect(formatAttemptScores(null)).toBe("");
});

const row = (overrides = {}) => draftOf({ participantId: "student:one", code: "HV001", fullName: "Nguyễn Văn An", eligible: null, examExempt: false, result: "pending", ...overrides });

it("keeps an interrupted study-leave attempt failed without inventing final marks", () => {
  const failed = row({ studyLeaveFailure: true, testScore: 8, assignmentScore: 9, result: "pending" });
  expect(failed).toMatchObject({ result: "failed", eligible: false, testScore: "8.0", assignmentScore: "9.0",
    examScore: "", courseScore: "", grade4: "", letterGrade: "", attemptScores: "" });
  expect(rowError(failed)).toBe("");
  expect(visibleGradeRows([failed], "all", "")).toHaveLength(1);
  expect(visibleGradeRows([failed], "exam", "")).toHaveLength(0);
  expect(gradebookRowValues(failed, 0).slice(-7)).toEqual(["9.0", "", "", "", "", "", "Không đạt"]);
  expect(calculateGrade({ ...failed, profileForeignLanguageExempt: true })).toMatchObject({ result: "failed", courseScore: null });
});

it("keeps profile language exemptions passed with empty marks in drafts and exports", () => {
  const exempt = updateGradeDraft(row({ examExempt: true, profileForeignLanguageExempt: true, result: "passed" }));
  expect(exempt).toMatchObject({ examExempt: true, result: "passed", courseScore: "", grade4: "", letterGrade: "" });
  expect(rowError(exempt)).toBe("");
  expect(gradebookCsv([exempt])).toContain('"Đạt"');
  expect(gradebookCsv([exempt])).toContain('"Có"');
  expect(visibleGradeRows([exempt], "exam", "")).toEqual([]);
});

it("fails immediately after both prerequisite scores disqualify the learner without requiring an exam score", () => {
  expect(row({ testScore: 6, assignmentScore: 3, result: "pending" })).toMatchObject({ eligible: false, result: "failed" });
  const failed = updateGradeDraft(row({ testScore: 6, assignmentScore: 3 }));
  expect(failed).toMatchObject({ eligible: false, result: "failed", courseScore: "0.0", grade4: "0.0", letterGrade: "F", attemptScores: "0.0" });
  expect(rowError(failed)).toBe("");
  expect(gradePayload(failed)).toMatchObject({ result: "failed", examScore: null, courseScore: 0, grade4: 0, letterGrade: "F" });
  expect(gradebookRowValues(failed, 0).slice(-7)).toEqual(["3.0", "0.0", "0.0", "0.0", "F", "0.0", "Không đạt"]);
  expect(updateGradeDraft({ ...failed, assignmentScore: "6" })).toMatchObject({ eligible: true, result: "pending" });
  expect(row({ testScore: 3 })).toMatchObject({ eligible: null });
  expect(calculateGrade(row({ testScore: 3 }))).toMatchObject({ result: "pending" });
  expect(calculateGrade(row({ testScore: 6, assignmentScore: 3, examExempt: true }))).toMatchObject({ result: "exempt" });
});

it("distinguishes a missing score from zero and accepts Vietnamese decimal input", () => {
  expect(gradePayload(row()).courseScore).toBeNull();
  expect(gradePayload(row({ testScore: 0, assignmentScore: 0, examScore: 0 })).courseScore).toBe(0);
  expect(gradePayload({ ...row(), testScore: "8,5", assignmentScore: "8,5", examScore: "8,5", attemptScores: "7,5; 9" })).toMatchObject({ courseScore: 8.5, attemptScores: [8.5] });
  expect(rowError({ ...row(), testScore: "11" })).toMatch(/0 đến 10/);
  expect(rowError({ ...row(), grade4: "5" })).toMatch(/0 đến 4/);
});

it("includes eligible students before the exam and excludes missing scores, failed prerequisites and exemptions", () => {
  const rows = [row(), row({ result: "pending", testScore: 4, assignmentScore: 4 }), row({ result: "failed", testScore: 6, assignmentScore: 6 }), row({ testScore: 8, assignmentScore: 8, examExempt: true }), row({ result: "passed", eligible: true, testScore: 3.9, assignmentScore: 8 })];
  expect(visibleGradeRows(rows, "exam", "")).toEqual([rows[1], rows[2]]);
  expect(visibleGradeRows(rows, "all", "")).toHaveLength(5);
});

it("weights components and replaces manually supplied derived grades", () => {
  expect(gradePayload(row({ testScore: 8, assignmentScore: 9, examScore: 10, courseScore: 0, grade4: 0, letterGrade: "F" }))).toMatchObject({ courseScore: 9.3, grade4: 4, letterGrade: "A+", result: "passed" });
  expect(calculateGrade(row({ testScore: 10, assignmentScore: 10 }))).toMatchObject({ courseScore: null, grade4: null, letterGrade: "", result: "pending" });
  expect(updateGradeDraft(row({ testScore: 8, assignmentScore: 8, examScore: 8 })).courseScore).toBe("8.0");
});

it.each([[0, "F", 0], [3.9, "F", 0], [4, "D", 1], [4.9, "D", 1], [5, "D+", 1.5], [5.4, "D+", 1.5], [5.5, "C", 2], [6.4, "C", 2], [6.5, "C+", 2.5], [6.9, "C+", 2.5], [7, "B", 3], [7.9, "B", 3], [8, "B+", 3.5], [8.4, "B+", 3.5], [8.5, "A", 4], [8.9, "A", 4], [9, "A+", 4], [10, "A+", 4], [8.91, "A", 4], [8.34, "B+", 3.5], [8.95, "A+", 4], [3.95, "D", 1]])("converts rounded score %s to %s", (score, letterGrade, grade4) => {
  const rounded = Math.round((score + Number.EPSILON * 10) * 10) / 10;
  expect(calculateGrade({ testScore: score, assignmentScore: score, examScore: score })).toMatchObject({ courseScore: rounded < 4 ? 0 : rounded, letterGrade, grade4, result: grade4 < 2 ? "failed" : "passed" });
});

it.each([
  [10, 10, 3.9, 7, "B", "failed"],
  [7, 7, 4, 5.5, "C", "passed"],
  [5.5, 5.5, 4, 4.8, "D", "failed"],
  [5.4, 10, 10, 8.9, "A", "passed"],
  [10, 5.4, 10, 8.9, "A", "passed"],
  [5.49, 10, 10, 8.9, "A", "passed"],
  [6.8, 6.8, 4, 5.4, "D+", "failed"],
  [6.9, 6.9, 4, 5.5, "C", "passed"],
  [7.4, 3.6, 5.6, 0, "F", "failed"],
  [5, 6.9, 5.8, 5.9, "C", "passed"],
  [0, 4, 6, 0, "F", "failed"],
  [4, 10, 10, 8.5, "A", "passed"],
  [3.9, 10, 10, 0, "F", "failed"],
  [10, 3.9, 10, 0, "F", "failed"],
])("requires every component >= 4 and rounded total >= 5.5 (%s, %s, %s)", (testScore, assignmentScore, examScore, courseScore, letterGrade, result) => {
  expect(calculateGrade({ testScore, assignmentScore, examScore })).toMatchObject({ courseScore, letterGrade, result });
});

it("clears derived grades when a component is removed and retains exam exemption", () => {
  const complete = updateGradeDraft(row({ testScore: 9, assignmentScore: 9, examScore: 9 }));
  expect(updateGradeDraft({ ...complete, examScore: "" })).toMatchObject({ courseScore: "", grade4: "", letterGrade: "", result: "pending" });
  expect(calculateGrade({ ...complete, examExempt: true }).result).toBe("exempt");
});

it("mirrors the final exam score in drafts, payloads and exported rows", () => {
  const draft = row({ examScore: 7.5, attemptScores: [1, 2] });
  expect(draft.attemptScores).toBe("7.5");
  const changed = updateGradeDraft({ ...draft, examScore: "8,5" });
  expect(changed.attemptScores).toBe("8.5");
  expect(gradePayload(changed).attemptScores).toEqual([8.5]);
  expect(gradebookRowValues(changed, 0).slice(-2)[0]).toBe("8.5");
  expect(updateGradeDraft({ ...changed, examScore: "" }).attemptScores).toBe("");
  expect(gradePayload({ ...changed, examScore: "" }).attemptScores).toEqual([]);
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
  expect(csv).not.toContain("Kết quả điểm");
  expect(gradebookCsv([input])).toContain("Điểm học phần");
  expect(input.courseScore).toBe("8.8");
});

it("escapes CSV quotes, commas, and spreadsheet formulas", () => {
  const csv = gradebookCsv([row({ code: '=HYPERLINK("x")', fullName: 'Nguyễn, Văn An' })]);
  expect(csv).toContain("'=HYPERLINK(\"\"x\"\")");
  expect(csv).toContain('"Nguyễn, Văn"');
});

it("exports the screen's column order and date format for each tab", () => {
  const input = { ...row({ dob: "1990-01-02", testScore: 6, assignmentScore: 6, eligible: true, courseScore: 8.5, result: "passed" }), courseScore: "8,5" };
  for (const exam of [false, true]) {
    const csv = gradebookCsv([input], exam).replace(/^\uFEFF/, "");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(gradebookColumns(exam).map(({ label }) => `"${label}"`).join(","));
    expect(gradebookRowValues(input, 0, exam)).toHaveLength(gradebookColumns(exam).length);
    expect(lines[1]).toContain('"02/01/1990"');
    expect(lines[1]).toContain('"Đủ tư cách"');
  }
  expect(gradebookCsv([input])).toContain('"8.5"');
  expect(gradebookCsv([input], true)).not.toContain('"8,5"');
  expect(gradebookCsv([input], true)).not.toContain('"Đạt"');
  expect(gradebookCsv([input])).toContain('"Đạt"');
});

it("keeps a saved outcome when opening a gradebook instead of recalculating it", () => {
  expect(row({ testScore: 9, assignmentScore: 9, examScore: 9, result: "failed", courseScore: 9 }))
    .toMatchObject({ result: "failed", courseScore: "9.0" });
});

it.each([[6, "6.0"], [0, "0.0"], [5.76, "5.8"], [5.54, "5.5"], [5.55, "5.6"], ["5,76", "5.8"], ["", ""], [null, ""], ["abc", "abc"], ["10.1", "10.1"]])("formats score %s as %s", (input, expected) => {
  expect(formatScore(input)).toBe(expected);
});

it("saves rounded components and calculates results from the rounded scores", () => {
  expect(gradePayload({ ...row(), testScore: "5.54", assignmentScore: "6", examScore: "5.76" })).toMatchObject({ testScore: 5.5, assignmentScore: 6, examScore: 5.8, attemptScores: [5.8], courseScore: 5.8, result: "passed" });
  expect(row({ testScore: 6, grade4: 2 })).toMatchObject({ testScore: "6.0", grade4: "2.0" });
});
