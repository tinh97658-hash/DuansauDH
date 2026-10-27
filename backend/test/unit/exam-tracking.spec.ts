import { gradebookCompletionStatus, resolveApprovedExamRows, unresolvedExamRows } from "../../src/masters/exam-tracking.js";
import { LEGACY_GRADING_POLICY } from "../../src/masters/grading-policy.js";

it.each(['not_available', 'draft', 'submitted', 'approved'])('resolves a frozen ineligible learner as failed without exam marks in %s', result_status => {
  const frozen = { participantId: 'student:ineligible', eligible: false, examExempt: false, testScore: 3.9, assignmentScore: 5 };
  const old = { ...frozen, result: 'pending', finalized: result_status === 'approved' };
  const rows = resolveApprovedExamRows([frozen], [{ grades: [old] }], [], { result_status });
  expect(rows[0]).toMatchObject({ result: 'failed', examScore: null, courseScore: null, grade4: null,
    letterGrade: '', attemptScores: [], examScoreEditable: false });
  expect(unresolvedExamRows(rows)).toEqual([]);
});

it('distinguishes a confirmed disqualification from exemptions and an eligible learner awaiting an exam', () => {
  const rows = resolveApprovedExamRows([
    { participantId: 'exempt', eligible: false, examExempt: true },
    { participantId: 'foreign', eligible: false, profileForeignLanguageExempt: true },
    { participantId: 'waiting', eligible: true },
  ], [], [], { result_status: 'not_available' });
  expect(rows.map(row => row.result)).toEqual(['exempt', 'passed', 'pending']);
  expect(unresolvedExamRows(rows).map(row => row.participantId)).toEqual(['waiting']);
});

it.each(['draft', 'submitted'])('requires locking after saved exam marks in the %s stage, including reopening', result_status => {
  expect(gradebookCompletionStatus({ mode: 'new', result_status }, true)).toBe('needs_lock');
  expect(gradebookCompletionStatus({ mode: 'new', result_status }, false)).toBe('incomplete');
});

it('marks only approved results complete, including classes with no exam candidates and preserved legacy results', () => {
  expect(gradebookCompletionStatus({ mode: 'new', result_status: 'approved' }, true)).toBe('completed');
  expect(gradebookCompletionStatus({ mode: 'new', result_status: 'approved' }, false)).toBe('completed');
  expect(gradebookCompletionStatus({ mode: 'legacy_preserved', legacyGradebookStatus: 'approved' }, true)).toBe('completed');
  expect(gradebookCompletionStatus({ mode: 'legacy_preserved', legacyGradebookStatus: 'draft' }, false)).toBe('incomplete');
});

it("preserves a finalized decision and applies strict exam thresholds when reopened", () => {
  const person = { participantId: "student:one", eligible: true, testScore: 10, assignmentScore: 10,
    examExempt: false, gradingPolicy: LEGACY_GRADING_POLICY, eligibilityPolicy: LEGACY_GRADING_POLICY };
  const grade = { ...person, examScore: 3.99, courseScore: 7.7, grade4: 3, letterGrade: "B", result: "passed", finalized: true };
  const books = [{ grades: [grade] }];
  expect(resolveApprovedExamRows([person], books, [person.participantId], { result_status: "approved" })[0])
    .toMatchObject({ finalized: true, examScore: 3.99, result: "passed", courseScore: 7.7 });
  expect(resolveApprovedExamRows([person], books, [person.participantId], { result_status: "draft" })[0])
    .toMatchObject({ finalized: false, examScore: 3.99, result: "failed", courseScore: 7 });
});
