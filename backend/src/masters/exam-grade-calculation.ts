import type { CourseExamGrade } from "../database/models/training/course-exam-gradebook.model.js";
import { COMPONENT_KEYS, GradingPolicy, LEGACY_GRADING_POLICY } from "./grading-policy.js";

export const roundExamScore = (score?: number | null): number | null => score == null ? null : Math.round((score + Number.EPSILON * 10) * 10) / 10;

export function calculateExamGrade(row: Pick<CourseExamGrade, "testScore" | "assignmentScore" | "examScore" | "examExempt">, policy: GradingPolicy = LEGACY_GRADING_POLICY): Pick<CourseExamGrade, "courseScore" | "grade4" | "letterGrade" | "result"> {
  const activeKeys = COMPONENT_KEYS.filter(key => policy.weights[key] > 0);
  const scores = activeKeys.map(key => row[key]);
  if (scores.some(score => score == null || !Number.isFinite(score) || score < 0 || score > 10)) {
    return { courseScore: null, grade4: null, letterGrade: "", result: row.examExempt ? "exempt" : "pending" };
  }
  const courseScore = roundExamScore(activeKeys.reduce((sum, key) => sum + row[key]! * policy.weights[key] / 100, 0))!;
  const { letter: letterGrade, grade4 } = [...policy.bands].sort((a, b) => b.minimum - a.minimum).find(band => courseScore >= band.minimum)!;
  const passed = activeKeys.every(key => row[key]! >= policy.minimums[key]) && courseScore >= policy.courseMinimum;
  return { courseScore, grade4, letterGrade, result: row.examExempt ? "exempt" : passed ? "passed" : "failed" };
}
