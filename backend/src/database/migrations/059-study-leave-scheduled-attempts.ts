// A first session scheduled before approval counts as an attempted course,
// including future sessions and sessions confirmed as not held.
export async function up({ context: qi }: any) {
  await qi.sequelize.query(`
    UPDATE course_offering_withdrawals withdrawal SET snapshot = withdrawal.snapshot || jsonb_build_object(
      'snapshotBeforeSchedulingRule', withdrawal.snapshot,
      'phase', 'studying', 'result', 'failed', 'studyLeaveFailure', true)
    FROM study_leaves leave
    WHERE leave.id = withdrawal.study_leave_id AND withdrawal.snapshot->>'phase' = 'not_started'
      AND COALESCE(withdrawal.snapshot->>'notEnrolled', 'false') <> 'true'
      AND EXISTS (SELECT 1 FROM teaching_sessions session WHERE session.course_offering_id = withdrawal.course_offering_id
        AND session.created_at <= COALESCE((SELECT (event->>'at')::timestamptz
            FROM jsonb_array_elements(leave.history) WITH ORDINALITY history(event, position)
            WHERE event->>'action' = 'approve' ORDER BY position LIMIT 1), leave.created_at));
  `);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE course_offering_withdrawals
    SET snapshot = snapshot->'snapshotBeforeSchedulingRule'
    WHERE snapshot ? 'snapshotBeforeSchedulingRule'`);
}
