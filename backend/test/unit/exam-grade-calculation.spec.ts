import { calculateExamGrade, resolveSavedExamGrade } from "../../src/masters/exam-grade-calculation.js";
import { LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";

it('keeps study-leave failures authoritative despite saved component scores or exemptions', () => {
  const grade = { studyLeaveFailure: true, participantId: 'student:one', testScore: 8, assignmentScore: 8,
    examScore: null, examExempt: false, result: 'pending' };
  expect(calculateExamGrade(grade)).toEqual({ courseScore: null, grade4: null, letterGrade: '', result: 'failed' });
  expect(resolveSavedExamGrade({ ...grade, profileForeignLanguageExempt: true, result: 'passed' }))
    .toEqual({ courseScore: null, grade4: null, letterGrade: '', result: 'failed' });
});

it.each([
  [0, "F", 0], [3.9, "F", 0], [4, "D", 1], [4.9, "D", 1],
  [5, "D+", 1.5], [5.4, "D+", 1.5], [5.5, "C", 2], [6.4, "C", 2],
  [6.5, "C+", 2.5], [6.9, "C+", 2.5], [7, "B", 3], [7.9, "B", 3],
  [8, "B+", 3.5], [8.4, "B+", 3.5], [8.5, "A", 4], [8.9, "A", 4],
  [9, "A+", 4], [10, "A+", 4], [8.91, "A", 4], [8.34, "B+", 3.5],
  [8.95, "A+", 4], [3.95, "D", 1],
])("converts rounded score %s to %s", (score, letterGrade, grade4) => {
  expect(calculateExamGrade({ testScore: score as number, assignmentScore: score as number, examScore: score as number, examExempt: false })).toMatchObject({ letterGrade, grade4, result: (grade4 as number) < 2 ? "failed" : "passed" });
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
  expect(calculateExamGrade({ testScore: testScore as number, assignmentScore: assignmentScore as number, examScore: examScore as number, examExempt: false })).toMatchObject({ courseScore, letterGrade, result });
});

it("uses 25/25/50 weights and rounds to one decimal", () => {
  expect(calculateExamGrade({ testScore: 8, assignmentScore: 9, examScore: 10, examExempt: false })).toEqual({ courseScore: 9.3, grade4: 4, letterGrade: "A+", result: "passed" });
});

it("resolves stale stored outcomes using frozen weights and current eligibility rules", () => {
  const grade = { testScore: 6, assignmentScore: 6, examScore: 8, courseScore: 1, result: "failed" as const,
    gradingPolicy: { ...LEGACY_GRADING_POLICY, weights: { testScore: 0, assignmentScore: 0, examScore: 100 } } };
  expect(resolveSavedExamGrade(grade)).toMatchObject({ courseScore: 8, result: "passed", letterGrade: "B+" });
  expect(resolveSavedExamGrade(grade, null)).toMatchObject({ courseScore: 8, result: "passed" });
  expect(resolveSavedExamGrade(grade, { ...LEGACY_GRADING_POLICY, minimums: { testScore: 7, assignmentScore: 4, examScore: 4 } }))
    .toMatchObject({ courseScore: 0, result: "failed", letterGrade: "F" });
  expect(resolveSavedExamGrade({ courseScore: 7, result: "passed" })).toMatchObject({ courseScore: 7, result: "passed" });
  expect(resolveSavedExamGrade({ examExempt: true, result: "pending" })).toMatchObject({ courseScore: null, result: "exempt" });
});

it("requires three valid components and preserves exemption", () => {
  expect(calculateExamGrade({ testScore: 10, assignmentScore: 10, examScore: null, examExempt: false })).toEqual({ courseScore: null, grade4: null, letterGrade: "", result: "pending" });
  expect(calculateExamGrade({ testScore: 10, assignmentScore: 10, examScore: 10, examExempt: true }).result).toBe("exempt");
});
