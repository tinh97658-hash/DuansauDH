// Reclassify already approved interrupted attempts using the same start evidence
// as new approvals. Preserve original component marks and the previous phase.
export async function up({ context: qi }: any) {
  await qi.sequelize.query(`
    WITH affected AS (
      SELECT withdrawal.id, GREATEST(
        leave.start_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
        COALESCE((SELECT (event->>'at')::timestamptz
          FROM jsonb_array_elements(leave.history) WITH ORDINALITY history(event, position)
          WHERE event->>'action' = 'approve' ORDER BY position LIMIT 1), leave.created_at)
      ) effective_at
      FROM course_offering_withdrawals withdrawal
      JOIN study_leaves leave ON leave.id = withdrawal.study_leave_id
      WHERE COALESCE(withdrawal.snapshot->>'notEnrolled', 'false') <> 'true'
    )
    UPDATE course_offering_withdrawals withdrawal SET snapshot = withdrawal.snapshot || jsonb_build_object(
      'phaseBeforeFailureRule', withdrawal.snapshot->>'phase',
      'phase', 'studying', 'result', 'failed', 'studyLeaveFailure', true)
    FROM affected WHERE affected.id = withdrawal.id AND (
      withdrawal.snapshot->>'phase' = 'studying'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(withdrawal.snapshot->'grades', '[]'::jsonb)) grade
        WHERE jsonb_typeof(grade->'testScore') = 'number'
          OR jsonb_typeof(grade->'assignmentScore') = 'number' OR jsonb_typeof(grade->'examScore') = 'number')
      OR EXISTS (SELECT 1 FROM teaching_sessions session WHERE session.course_offering_id = withdrawal.course_offering_id
        AND session.status <> 'not_held'
        AND (session.session_date + session.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' < affected.effective_at)
    );
  `);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE course_offering_withdrawals
    SET snapshot = (snapshot - 'phaseBeforeFailureRule' - 'studyLeaveFailure' - 'result')
      || jsonb_build_object('phase', snapshot->>'phaseBeforeFailureRule')
    WHERE snapshot ? 'phaseBeforeFailureRule'`);
}
