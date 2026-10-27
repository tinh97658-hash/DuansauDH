import { calculateExamEligibility, calculateExamGrade, resolveSavedExamGrade } from './exam-grade-calculation.js';

const emptyResult = { examScore: null, courseScore: null, grade4: null, letterGrade: '', attemptScores: [], result: 'pending' };

export function gradebookCompletionStatus(state: any, examGradesComplete: boolean) {
  const locked = state.mode === 'legacy_preserved'
    ? state.legacyGradebookStatus === 'approved' : state.result_status === 'approved';
  return locked ? 'completed' : examGradesComplete ? 'needs_lock' : 'incomplete';
}

// The gradebook and tracking summaries resolve the same frozen roster and held exams.
export function resolveApprovedExamRows(frozenRows: any[], books: any[], heldIds: string[], state: any) {
  const saved = new Map<string, any>();
  for (const book of books) for (const row of book.grades) if (!saved.has(row.participantId)) saved.set(row.participantId, row);
  const held = new Set(heldIds);
  return frozenRows.map(frozen => {
    const previous = saved.get(frozen.participantId);
    const examScore = held.has(frozen.participantId) ? previous?.examScore ?? null : null;
    const calculated = state.result_status === 'approved' && previous?.finalized
      ? resolveSavedExamGrade({ ...previous, eligibilityFrozen: true, eligible: frozen.eligible,
        examExempt: frozen.examExempt, profileForeignLanguageExempt: frozen.profileForeignLanguageExempt })
      : frozen.eligible === true && held.has(frozen.participantId)
      ? calculateExamGrade({ ...frozen, examScore }, frozen.gradingPolicy, frozen.eligibilityPolicy)
      : { ...emptyResult, ...(frozen.studyLeaveFailure ? { result: 'failed' } : frozen.profileForeignLanguageExempt ? { result: 'passed' } : frozen.examExempt ? { result: 'exempt' } : frozen.eligible === false ? { result: 'failed' } : {}) };
    return { ...frozen, ...calculated, examScore: frozen.eligible === true ? examScore : null, attemptScores: examScore == null ? [] : [examScore],
      notes: previous?.notes ?? frozen.notes, eligibilityFrozen: true,
      examScoreEditable: frozen.eligible === true && held.has(frozen.participantId) && state.result_status === 'draft',
      workflowPhase: 'final', finalized: state.result_status === 'approved' };
  });
}

export const unresolvedExamRows = (rows: any[]) => rows.filter(row => row.eligible === true && !row.examExempt && (row.examScore == null || row.result === 'pending'));

// An approved historical gradebook can prove finished marks, but cannot supply a missing exam date.
export function legacyExamGradesComplete(status: string, snapshot: any) {
  if (status !== 'approved' || !Array.isArray(snapshot?.rows) || !snapshot.rows.length) return false;
  const candidates = snapshot.rows.filter((row: any) => !row.examExempt && calculateExamEligibility(row, row.eligibilityPolicy || row.gradingPolicy) === true);
  return candidates.length > 0 && candidates.every((row: any) => row.examScore != null && resolveSavedExamGrade(row, row.eligibilityPolicy || row.gradingPolicy).result !== 'pending');
}
