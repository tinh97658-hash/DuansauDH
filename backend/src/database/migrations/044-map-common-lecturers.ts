import { QueryTypes } from "sequelize";

/** Ánh xạ nhóm GV-CHUNG cũ sang chuyên ngành dùng chung được đổi tên ở migration 042. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    const [major] = await qi.sequelize.query(
      `SELECT id, discipline_id
       FROM majors
       WHERE code = 'CHUYEN-NGANH-CHUNG'
       ORDER BY active DESC, created_at ASC
       LIMIT 1`,
      { type: QueryTypes.SELECT, transaction },
    ) as Array<{ id: string; discipline_id: string }>;
    if (!major) return;
    await qi.sequelize.query(
      `UPDATE lecturers
       SET major_id = :majorId, discipline_id = :disciplineId, updated_at = NOW()
       WHERE major_id IS NULL AND code ~* '^GV-CHUNG-[0-9]+$'`,
      { replacements: { majorId: major.id, disciplineId: major.discipline_id }, transaction },
    );
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(
    `UPDATE lecturers
     SET major_id = NULL, discipline_id = NULL, updated_at = NOW()
     WHERE code ~* '^GV-CHUNG-[0-9]+$'
       AND major_id = (SELECT id FROM majors WHERE code = 'CHUYEN-NGANH-CHUNG' LIMIT 1)`,
  );
}
