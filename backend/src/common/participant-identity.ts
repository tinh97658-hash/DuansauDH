/** Application-owned SQL expressions only. Keep indexed UUID columns unchanged so
 * PostgreSQL can look up one learner before evaluating row-level access policies.
 * Malformed or unknown identities resolve to NULL rather than raising a cast error.
 */
export function participantUuidSql(expression: string, kind: 'admission' | 'student') {
  const start = kind === 'admission' ? 11 : 9;
  return `CASE WHEN ${expression} ~ '^${kind}:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN substring(${expression} from ${start})::uuid END`;
}

export function participantRecordMatchSql(record: string, participant: string) {
  return `(${record}.id = ${participantUuidSql(participant, 'admission')}
    OR ${record}.student_id = ${participantUuidSql(participant, 'student')})`;
}
