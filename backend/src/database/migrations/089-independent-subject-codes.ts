import { QueryTypes, type QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query("LOCK TABLE subjects IN SHARE ROW EXCLUSIVE MODE", { transaction });
    const conflicts = await qi.sequelize.query(`
      SELECT 'codeNumber' AS field, program, major_id, code_number::text AS code,
        array_agg(id ORDER BY id) AS subject_ids FROM subjects WHERE code_number IS NOT NULL
      GROUP BY program, major_id, code_number HAVING count(*) > 1
      UNION ALL
      SELECT 'codeText', program, major_id, upper(btrim(code_text)), array_agg(id ORDER BY id)
      FROM subjects WHERE code_text IS NOT NULL
      GROUP BY program, major_id, upper(btrim(code_text)) HAVING count(*) > 1
    `, { type: QueryTypes.SELECT, transaction });
    if (conflicts.length) throw new Error(`SUBJECT_CODE_CONFLICTS: Dừng migration; không thay đổi dữ liệu. Đối soát ID và tham chiếu trước khi chạy lại: ${JSON.stringify(conflicts)}`);
    await qi.sequelize.query("CREATE UNIQUE INDEX subjects_code_number_unique ON subjects(program, major_id, code_number)", { transaction });
    await qi.sequelize.query("CREATE UNIQUE INDEX subjects_code_text_unique ON subjects(program, major_id, upper(btrim(code_text)))", { transaction });
    // Preserve 088 and its index so down restores the preceding guarantee without rewriting history.
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    await qi.sequelize.query("DROP INDEX IF EXISTS subjects_code_number_unique", { transaction });
    await qi.sequelize.query("DROP INDEX IF EXISTS subjects_code_text_unique", { transaction });
  });
}
