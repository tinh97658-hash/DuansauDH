import { gradebookStage } from '../../src/masters/exam-tracking.js';
import { LEGACY_GRADING_POLICY } from '../../src/masters/grading-policy.js';

const completed = { status: 'completed' };
const person = (id: string) => ({ participantId: id, eligible: true, examExempt: false,
  testScore: 8, assignmentScore: 8, gradingPolicy: LEGACY_GRADING_POLICY, eligibilityPolicy: LEGACY_GRADING_POLICY });
const approved = { mode: 'new', eligibility_status: 'approved', result_status: 'draft',
  approvedRows: [person('one'), person('two')], heldIds: [], books: [] };

it('classifies teaching, missing components, ready and submitted eligibility separately', () => {
  expect(gradebookStage({ status: 'active' })).toBe('teaching');
  expect(gradebookStage(completed, { componentsEntered: false })).toBe('components_missing');
  expect(gradebookStage(completed, { componentsEntered: true })).toBe('awaiting_exam');
  expect(gradebookStage(completed, { componentsEntered: true, eligibility_status: 'submitted' })).toBe('awaiting_exam');
});

it('keeps partly held sessions awaiting exams and deduplicates learners across sessions', () => {
  expect(gradebookStage(completed, approved)).toBe('awaiting_exam');
  expect(gradebookStage(completed, { ...approved, heldIds: ['one', 'one'] })).toBe('awaiting_exam');
  expect(gradebookStage(completed, { ...approved, heldIds: ['one', 'one', 'two'] })).toBe('exam_missing');
});

it('distinguishes complete marks, submitted results and locked results', () => {
  const state = { ...approved, heldIds: ['one', 'two'], books: [{ grades: approved.approvedRows.map(row => ({ ...row, examScore: 8 })) }] };
  expect(gradebookStage(completed, state)).toBe('result_ready');
  expect(gradebookStage(completed, { ...state, result_status: 'submitted' })).toBe('result_pending');
  expect(gradebookStage(completed, { ...state, result_status: 'approved' })).toBe('completed');
});

it('does not require exam marks for exemptions, disqualifications and special statuses', () => {
  const approvedRows = [{ participantId: 'exempt', eligible: true, examExempt: true },
    { participantId: 'failed', eligible: false }, { participantId: 'leave', eligible: false, studyLeaveFailure: true },
    { participantId: 'foreign', eligible: false, profileForeignLanguageExempt: true }];
  expect(gradebookStage(completed, { ...approved, approvedRows })).toBe('result_ready');
});

it('separates unknown and empty historical metadata from missing component marks', () => {
  expect(gradebookStage(completed)).toBe('review');
  expect(gradebookStage(completed, { ...approved, approvedRows: [] })).toBe('review');
  expect(gradebookStage(completed, { ...approved, approvedRows: [{ participantId: 'unknown' }] })).toBe('components_missing');
  expect(gradebookStage(completed, { mode: 'legacy_preserved', legacyGradebookStatus: 'draft' })).toBe('review');
  expect(gradebookStage(completed, { mode: 'legacy_preserved', legacyGradebookStatus: 'approved', legacyGradebookSnapshot: { rows: [{}] } })).toBe('completed');
});
