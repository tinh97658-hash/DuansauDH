import { calculateExamEligibility, calculatePolicyGrade, clonePolicy, numericPolicy, policyError } from "../../features/exams/gradingPolicy";
import { calculateGrade, draftOf, gradePayload } from "../../features/exams/gradebook";

it("uses the row's frozen policy for calculations and sends its version to the server", () => {
  const policy = { ...clonePolicy(), version: 3, weights: { testScore: 0, assignmentScore: 50, examScore: 50 },
    minimums: { testScore: 10, assignmentScore: 4, examScore: 6 }, courseMinimum: 5,
    useDefaultBands: false, bands: [{ minimum: 8, letter: "X", grade4: 3.8 }, { minimum: 0, letter: "Y", grade4: 1 }] };
  const row = { participantId: "p1", gradingPolicy: policy, testScore: null, assignmentScore: 10, examScore: 5, examExempt: false, letterGrade: "Y" };
  expect(calculateGrade(row)).toEqual({ courseScore: 7.5, grade4: 1, letterGrade: "Y", result: "failed" });
  expect(calculateGrade({ ...row, examScore: 6 })).toEqual({ courseScore: 8, grade4: 3.8, letterGrade: "X", result: "passed" });
  expect(gradePayload(row)).toMatchObject({ policyVersion: 3, courseScore: 7.5, result: "failed" });
  expect(draftOf({ ...row, courseScore: 5, grade4: 0, result: "failed" })).toMatchObject({ courseScore: "5.0", grade4: "0.0", result: "failed" });
});

it("checks minimums against rounded components and converts the rounded total", () => {
  const policy = clonePolicy();
  policy.minimums = { testScore: 0, assignmentScore: 0, examScore: 5.8 };
  const row = { participantId: "p1", testScore: "5.54", assignmentScore: "6", examScore: "5.76", examExempt: false, letterGrade: "", gradingPolicy: policy };
  expect(gradePayload(row)).toMatchObject({ testScore: 5.5, examScore: 5.8, courseScore: 5.8, letterGrade: "C", grade4: 2, result: "passed" });
});

it("does not accept incomplete or contradictory configuration", () => {
  const policy = clonePolicy();
  policy.weights.testScore = "";
  expect(policyError(policy)).toContain("Tỷ trọng");
  policy.weights.testScore = 25;
  policy.useDefaultBands = false;
  policy.bands = [{ minimum: 0, letter: "F", grade4: 4 }, { minimum: 5, letter: "A", grade4: 1 }];
  expect(policyError(policy)).toContain("không được giảm");
  policy.bands = [{ minimum: 5, letter: "C", grade4: 2 }, { minimum: 0, letter: "F", grade4: 0 }];
  expect(policyError(policy)).toBe("");
  const normalized = numericPolicy(policy);
  expect(calculatePolicyGrade({ testScore: 5, assignmentScore: 5, examScore: 5 }, normalized)).toMatchObject({ letterGrade: "C", grade4: 2, result: "failed" });
});

it("derives exam eligibility from both current configured minimums and never qualifies exemptions", () => {
  const policy = { ...clonePolicy(), minimums: { testScore: 6, assignmentScore: 7, examScore: 4 } };
  const row = { testScore: 6, assignmentScore: 7, examExempt: false, eligible: false };
  expect(calculateExamEligibility(row, policy)).toBe(true);
  expect(calculateExamEligibility({ ...row, assignmentScore: 6.9, eligible: true }, policy)).toBe(false);
  expect(calculateExamEligibility({ ...row, testScore: "" }, policy)).toBeNull();
  expect(calculateExamEligibility({ ...row, assignmentScore: "abc" }, policy)).toBeNull();
  expect(calculateExamEligibility({ ...row, testScore: 0 }, policy)).toBe(false);
  expect(calculateExamEligibility({ ...row, examExempt: true }, policy)).toBe(false);
  expect(calculateExamEligibility({ ...row, eligibilityPolicy: policy, gradingPolicy: clonePolicy(), assignmentScore: 6 })).toBe(false);
});

it("keeps the outcome pending until an exam score is entered even when its weight is zero", () => {
  const policy = { ...clonePolicy(), weights: { testScore: 50, assignmentScore: 50, examScore: 0 } };
  expect(calculatePolicyGrade({ testScore: 8, assignmentScore: 8, examScore: null }, policy)).toMatchObject({ result: "pending", courseScore: null });
  expect(calculatePolicyGrade({ testScore: 8, assignmentScore: 8, examScore: 0 }, policy)).toMatchObject({ result: "passed", courseScore: 8 });
});
