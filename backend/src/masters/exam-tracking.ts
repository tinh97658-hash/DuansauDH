import { calculateExamEligibility, calculateExamGrade, resolveSavedExamGrade } from './exam-grade-calculation.js';

const emptyResult = { examScore: null, courseScore: null, grade4: null, letterGrade: '', attemptScores: [], result: 'pending' };

// One primary next action, shared by the dashboard and gradebook options.
// Null component completeness means insufficient evidence, not missing marks.
export function gradebookStage(offering: any, state: any = {}) {
  if (offering.status === 'active') return 'teaching';
  if (offering.status !== 'completed') return 'review';
  if (state.mode === 'legacy_preserved') {
    return state.legacyGradebookStatus === 'approved' && state.legacyGradebookSnapshot?.rows?.length
      ? 'completed' : 'review';
  }
  if (state.result_status === 'approved') return 'completed';
  if (state.result_status === 'submitted') return 'result_pending';
  if (state.eligibility_status === 'approved') {
    if (!Array.isArray(state.approvedRows) || !state.approvedRows.length) return 'review';
    if (state.approvedRows.some((row: any) => row.eligible == null
      && !row.examExempt && !row.profileForeignLanguageExempt && !row.studyLeaveFailure)) return 'components_missing';
    const candidates = state.approvedRows.filter((row: any) => row.eligible === true && !row.examExempt);
    const held = new Set(state.heldIds || []);
    // A partly held offering still needs exams for its remaining candidates.
    // Sets prevent duplicate assignments across sessions inflating completion.
    const savedGrades=(state.books||[]).flatMap((book:any)=>book.grades||[]);
    if (candidates.some((row: any) => !held.has(row.participantId)||savedGrades.find((g:any)=>g.participantId===row.participantId)?.examAttendanceStatus==='absent_excused')) return 'awaiting_exam';
    const rows = resolveApprovedExamRows(state.approvedRows, state.books || [], state.heldIds || [], state);
    return unresolvedExamRows(rows).length ? 'exam_missing' : 'result_ready';
  }
  if (state.componentsEntered === true) return 'awaiting_exam';
  if (state.componentsEntered === false) return 'components_missing';
  return 'review';
}

export function gradebookCompletionStatus(state: any, examGradesComplete: boolean) {
  const locked = state.mode === 'legacy_preserved'
    ? state.legacyGradebookStatus === 'approved' : state.result_status === 'approved';
  return locked ? 'completed' : examGradesComplete ? 'needs_lock' : 'incomplete';
}

// The gradebook and tracking summaries resolve the same frozen roster and held exams.
export function resolveApprovedExamRows(frozenRows: any[], books: any[], heldIds: string[], state: any, attempts?: any[]) {
  const saved = new Map<string, any>();
  for (const book of books) for (const row of book.grades) if (!saved.has(row.participantId)) saved.set(row.participantId, row);
  const held = new Set(heldIds);
  return frozenRows.map(frozen => {
    const previous = saved.get(frozen.participantId);
    const attempt=attempts?.find(a=>a.participant_id===frozen.participantId);
    const examAttendanceStatus=attempts ? (attempt?.makeup_for_session_id&&attempt.status!=='held'&&attempt.attendance==='present'?'absent_excused':attempt?.attendance||'present') : previous?.examAttendanceStatus||'present';
    const absent=examAttendanceStatus!=='present';
    const currentHeld=attempts ? attempt?.status==='held' : held.has(frozen.participantId);
    const sameAttempt=!attempt||previous?.examSessionId===attempt.session_id||(!previous?.examSessionId&&!attempt.makeup_for_session_id);
    const examScore = !absent&&currentHeld&&sameAttempt ? previous?.examScore ?? null : null;
    const calculated = state.result_status === 'approved' && previous?.finalized
      ? resolveSavedExamGrade({ ...previous, eligibilityFrozen: true, eligible: frozen.eligible,
        examExempt: frozen.examExempt, profileForeignLanguageExempt: frozen.profileForeignLanguageExempt })
      : absent ? calculateExamGrade({...frozen,examScore:null,examAttendanceStatus},frozen.gradingPolicy,frozen.eligibilityPolicy)
      : frozen.eligible === true && currentHeld
      ? calculateExamGrade({ ...frozen, examScore, examAttendanceStatus }, frozen.gradingPolicy, frozen.eligibilityPolicy)
      : { ...emptyResult, ...(frozen.studyLeaveFailure ? { result: 'failed' } : frozen.profileForeignLanguageExempt ? { result: 'passed' } : frozen.examExempt ? { result: 'exempt' } : frozen.eligible === false ? { result: 'failed' } : {}) };
    return { ...frozen, ...calculated, examScore: frozen.eligible === true ? examScore : null, attemptScores: examScore == null ? [] : [examScore],
      examAttendanceStatus,examSessionId:attempts?attempt?.session_id||null:previous?.examSessionId,isMakeup:attempts?!!attempt?.makeup_for_session_id:!!previous?.isMakeup,
      makeupScheduled:!!(attempt?.makeup_for_session_id&&attempt.status==='scheduled'&&attempt.attendance==='present'),
      notes: previous?.notes ?? frozen.notes, eligibilityFrozen: ['submitted','approved'].includes(state.result_status),
      examScoreEditable: !absent&&frozen.eligible === true && currentHeld && state.result_status === 'draft',
      workflowPhase: 'final', finalized: state.result_status === 'approved' };
  });
}

export const unresolvedExamRows = (rows: any[]) => rows.filter(row => !row.examExempt && !row.profileForeignLanguageExempt && !row.studyLeaveFailure
  && row.examAttendanceStatus!=='absent_unexcused'
  && (row.eligible == null || (row.eligible === true && (row.examScore == null || row.result === 'pending'))));

// An approved historical gradebook can prove finished marks, but cannot supply a missing exam date.
export function legacyExamGradesComplete(status: string, snapshot: any) {
  if (status !== 'approved' || !Array.isArray(snapshot?.rows) || !snapshot.rows.length) return false;
  const candidates = snapshot.rows.filter((row: any) => !row.examExempt && calculateExamEligibility(row, row.eligibilityPolicy || row.gradingPolicy) === true);
  return candidates.length > 0 && candidates.every((row: any) => row.examScore != null && resolveSavedExamGrade(row, row.eligibilityPolicy || row.gradingPolicy).result !== 'pending');
}
