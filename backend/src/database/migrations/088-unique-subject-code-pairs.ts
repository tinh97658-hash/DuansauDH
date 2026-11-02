import { QueryTypes, type QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    // Hold writes across preflight and index creation; never rewrite referenced catalog records.
    await qi.sequelize.query("LOCK TABLE subjects IN SHARE ROW EXCLUSIVE MODE", { transaction });
    const duplicates = await qi.sequelize.query(`
      SELECT program, major_id, code_number, upper(btrim(code_text)) AS code_text,
        count(*)::int AS duplicate_count, array_agg(id ORDER BY id) AS subject_ids
      FROM subjects WHERE code_number IS NOT NULL AND code_text IS NOT NULL
      GROUP BY program, major_id, code_number, upper(btrim(code_text)) HAVING count(*) > 1
      ORDER BY program, major_id, code_number LIMIT 20
    `, { type: QueryTypes.SELECT, transaction });
    if (duplicates.length) throw new Error(
      `SUBJECT_IDENTITY_DUPLICATES: Không thể tạo unique index vì có học phần trùng tổ hợp mã. Không có dữ liệu bị sửa hoặc xóa. Đối soát các ID và tham chiếu CTĐT/lớp trước khi chạy lại. Tối đa 20 nhóm: ${JSON.stringify(duplicates)}`,
    );
    await qi.sequelize.query(`CREATE UNIQUE INDEX subjects_identity_unique
      ON subjects (program, major_id, code_number, upper(btrim(code_text)))`, { transaction });
  });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query("DROP INDEX IF EXISTS subjects_identity_unique");
}
