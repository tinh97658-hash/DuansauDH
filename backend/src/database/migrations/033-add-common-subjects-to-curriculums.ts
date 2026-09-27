import { QueryTypes } from "sequelize";
import { randomUUID } from "node:crypto";

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // 1. Tìm các học phần chung cấp Viện (KC)
    const commonSubjects: Array<{ id: string; code: string; name: string; credits: number }> = await qi.sequelize.query(
      `SELECT id, code, name, credits FROM subjects WHERE subject_type = 'KC' AND active = true`,
      { type: QueryTypes.SELECT, transaction }
    );
    if (!commonSubjects.length) return;

    // 2. Tìm tất cả các chương trình đào tạo
    const curriculums: Array<{ id: string; code: string }> = await qi.sequelize.query(
      `SELECT id, code FROM curriculums`,
      { type: QueryTypes.SELECT, transaction }
    );

    for (const cur of curriculums) {
      // Tìm hoặc tạo khối kiến thức chung (KC)
      const kcBlocks: Array<{ id: string }> = await qi.sequelize.query(
        `SELECT id FROM curriculum_blocks WHERE curriculum_id = :curId AND code = 'KC'`,
        { replacements: { curId: cur.id }, type: QueryTypes.SELECT, transaction }
      );

      let blockId = kcBlocks[0]?.id;
      if (!blockId) {
        blockId = randomUUID();
        await qi.sequelize.query(
          `INSERT INTO curriculum_blocks (id, curriculum_id, code, name, min_credits, sort_order, created_at, updated_at)
           VALUES (:id, :curId, 'KC', 'Khối kiến thức chung', 0, 0, NOW(), NOW())`,
          { replacements: { id: blockId, curId: cur.id }, transaction }
        );
      }

      // Đưa các môn chung vào CTĐT nếu chưa có
      for (const subj of commonSubjects) {
        const existing: Array<{ id: string }> = await qi.sequelize.query(
          `SELECT id FROM curriculum_subjects WHERE curriculum_id = :curId AND subject_id = :subjId`,
          { replacements: { curId: cur.id, subjId: subj.id }, type: QueryTypes.SELECT, transaction }
        );
        if (!existing.length) {
          await qi.sequelize.query(
            `INSERT INTO curriculum_subjects (id, curriculum_id, block_id, subject_id, is_required, credits, sort_order, created_at, updated_at)
             VALUES (:id, :curId, :blockId, :subjId, true, :credits, 0, NOW(), NOW())`,
            {
              replacements: {
                id: randomUUID(),
                curId: cur.id,
                blockId,
                subjId: subj.id,
                credits: subj.credits || 3,
              },
              transaction,
            }
          );
        }
      }
    }
  });
}

export async function down({ context: qi }: any) {
  // rollback
}
