import type { CourseExamGrade } from "../database/models/training/course-exam-gradebook.model.js";
import { COMPONENT_KEYS, GradingPolicy, LEGACY_GRADING_POLICY } from "./grading-policy.js";

export const roundExamScore = (score?: number | null): number | null => score == null ? null : Math.round((score + Number.EPSILON * 10) * 10) / 10;

// Read projections must resolve component scores exactly as the entry screen does.
// Older imported rows can contain only a final score and must retain that evidence.
export function resolveSavedExamGrade(grade: Partial<CourseExamGrade>, eligibilityPolicy?: GradingPolicy | null) {
  if (grade.finalized) return { courseScore: grade.courseScore ?? null, grade4: grade.grade4 ?? null,
    letterGrade: grade.letterGrade || "", result: grade.result || "pending" };
  if (grade.studyLeaveFailure) return { courseScore: null, grade4: null, letterGrade: "", result: "failed" as const };
  if (grade.profileForeignLanguageExempt) return { courseScore: null, grade4: null, letterGrade: "", result: "passed" as const };
  if(grade.workflowPhase==='components'||(grade.eligibilityFrozen&&grade.eligible===false))return {courseScore:null,grade4:null,letterGrade:'',result:grade.examExempt?'exempt' as const:'pending' as const};
  if (!grade.examExempt && !COMPONENT_KEYS.some(key => Object.prototype.hasOwnProperty.call(grade, key))) {
    return { courseScore: grade.courseScore ?? null, grade4: grade.grade4 ?? null,
      letterGrade: grade.letterGrade || "", result: grade.result || "pending" };
  }
  return calculateExamGrade({ testScore: null, assignmentScore: null, examScore: null, examExempt: false, ...grade },
    grade.gradingPolicy || LEGACY_GRADING_POLICY, (grade.eligibilityFrozen?grade.eligibilityPolicy:eligibilityPolicy) || LEGACY_GRADING_POLICY);
}

export function calculateExamGrade(row: Pick<CourseExamGrade, "testScore" | "assignmentScore" | "examScore" | "examExempt" | "profileForeignLanguageExempt" | "studyLeaveFailure">, policy: GradingPolicy = LEGACY_GRADING_POLICY, eligibilityPolicy: GradingPolicy = policy): Pick<CourseExamGrade, "courseScore" | "grade4" | "letterGrade" | "result"> {
  if (row.studyLeaveFailure) return { courseScore: null, grade4: null, letterGrade: "", result: "failed" };
  if (row.profileForeignLanguageExempt) return { courseScore: null, grade4: null, letterGrade: "", result: "passed" };
  const ineligible = !row.examExempt && calculateExamEligibility(row, eligibilityPolicy) === false;
  if (ineligible) return { courseScore: 0, grade4: 0, letterGrade: "F", result: "failed" };
  const activeKeys = COMPONENT_KEYS.filter(key => policy.weights[key] > 0);
  const scores = activeKeys.map(key => row[key]);
  if (row.examScore == null || !Number.isFinite(row.examScore) || row.examScore < 0 || row.examScore > 10 || scores.some(score => score == null || !Number.isFinite(score) || score < 0 || score > 10)) {
    return { courseScore: null, grade4: null, letterGrade: "", result: row.examExempt ? "exempt" : ineligible ? "failed" : "pending" };
  }
  const courseScore = roundExamScore(activeKeys.reduce((sum, key) => sum + row[key]! * policy.weights[key] / 100, 0))!;
  const { letter: letterGrade, grade4 } = [...policy.bands].sort((a, b) => b.minimum - a.minimum).find(band => courseScore >= band.minimum)!;
  const passed = !ineligible && activeKeys.every(key => row[key]! >= policy.minimums[key]) && courseScore >= policy.courseMinimum;
  return { courseScore, grade4, letterGrade, result: row.examExempt ? "exempt" : passed ? "passed" : "failed" };
}

export function calculateExamEligibility(row: Pick<CourseExamGrade, "testScore" | "assignmentScore" | "examExempt" | "studyLeaveFailure">, policy: GradingPolicy = LEGACY_GRADING_POLICY): boolean | null {
  if (row.studyLeaveFailure) return false;
  if (row.examExempt) return false;
  const keys = ["testScore", "assignmentScore"] as const;
  if (keys.some(key => row[key] == null || !Number.isFinite(row[key]) || row[key]! < 0 || row[key]! > 10)) return null;
  return keys.every(key => roundExamScore(row[key])! >= policy.minimums[key]);
}
