import { calculateExamGrade } from "../../src/masters/exam-grade-calculation.js";

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
  [7.4, 3.6, 5.6, 5.6, "C", "failed"],
  [5, 6.9, 5.8, 5.9, "C", "passed"],
  [0, 4, 6, 4, "D", "failed"],
  [4, 10, 10, 8.5, "A", "passed"],
  [3.9, 10, 10, 8.5, "A", "failed"],
  [10, 3.9, 10, 8.5, "A", "failed"],
])("requires every component >= 4 and rounded total >= 5.5 (%s, %s, %s)", (testScore, assignmentScore, examScore, courseScore, letterGrade, result) => {
  expect(calculateExamGrade({ testScore: testScore as number, assignmentScore: assignmentScore as number, examScore: examScore as number, examExempt: false })).toMatchObject({ courseScore, letterGrade, result });
});

it("uses 25/25/50 weights and rounds to one decimal", () => {
  expect(calculateExamGrade({ testScore: 8, assignmentScore: 9, examScore: 10, examExempt: false })).toEqual({ courseScore: 9.3, grade4: 4, letterGrade: "A+", result: "passed" });
});

it("requires three valid components and preserves exemption", () => {
  expect(calculateExamGrade({ testScore: 10, assignmentScore: 10, examScore: null, examExempt: false })).toEqual({ courseScore: null, grade4: null, letterGrade: "", result: "pending" });
  expect(calculateExamGrade({ testScore: 10, assignmentScore: 10, examScore: 10, examExempt: true }).result).toBe("exempt");
});
