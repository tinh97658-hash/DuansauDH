// Enrolled, unfinished courses fail on leave approval even without a timetable.
// Exclude classes opened during leave: these learners were never enrolled.
export async function up({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE course_offering_withdrawals
    SET snapshot = snapshot || jsonb_build_object(
      'snapshotBeforeEnrollmentRule', snapshot,
      'phase', 'studying', 'result', 'failed', 'studyLeaveFailure', true)
    WHERE snapshot->>'phase' = 'not_started'
      AND COALESCE(snapshot->>'notEnrolled', 'false') <> 'true'`);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`UPDATE course_offering_withdrawals
    SET snapshot = snapshot->'snapshotBeforeEnrollmentRule'
    WHERE snapshot ? 'snapshotBeforeEnrollmentRule'`);
}
