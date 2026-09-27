/** Keep stored totals aligned with the complete subject list of each curriculum. */
export async function up({ context: qi }: any) {
  await qi.sequelize.query(`
    UPDATE curriculums c
    SET total_credits = totals.total_credits,
        updated_at = NOW()
    FROM (
      SELECT c2.id, COALESCE(SUM(cs.credits), 0)::integer AS total_credits
      FROM curriculums c2
      LEFT JOIN curriculum_subjects cs ON cs.curriculum_id = c2.id
      GROUP BY c2.id
    ) totals
    WHERE totals.id = c.id
  `);
}

export async function down() {
  // The previous aggregate cannot be reconstructed safely.
}
