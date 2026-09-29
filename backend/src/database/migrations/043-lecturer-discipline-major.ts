import { DataTypes } from "sequelize";

/** Gắn giảng viên với danh mục Ngành -> Chuyên ngành thay cho tên Khoa/Viện nhập tự do. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("lecturers", "discipline_id", { type: DataTypes.UUID, allowNull: true }, { transaction });
    await qi.addColumn("lecturers", "major_id", { type: DataTypes.UUID, allowNull: true }, { transaction });

    // Dữ liệu cũ dùng mã GV-<MÃ CHUYÊN NGÀNH>-<SỐ>; tận dụng mã này để chuyển đổi.
    await qi.sequelize.query(
      `WITH matched AS (
         SELECT DISTINCT ON (lecturer.id)
           lecturer.id AS lecturer_id,
           major.id AS major_id,
           major.discipline_id
         FROM lecturers AS lecturer
         JOIN majors AS major
           ON UPPER(major.code) = regexp_replace(UPPER(lecturer.code), '^GV-(.*)-[0-9]+$', '\\1')
         WHERE lecturer.code ~* '^GV-.+-[0-9]+$'
         ORDER BY lecturer.id, major.active DESC, major.created_at ASC
       )
       UPDATE lecturers AS lecturer
       SET major_id = matched.major_id,
           discipline_id = matched.discipline_id,
           updated_at = NOW()
       FROM matched
       WHERE lecturer.id = matched.lecturer_id`,
      { transaction },
    );

    await qi.addIndex("lecturers", ["discipline_id"], { name: "lecturers_discipline_idx", transaction });
    await qi.addIndex("lecturers", ["major_id"], { name: "lecturers_major_idx", transaction });
    await qi.addConstraint("lecturers", {
      fields: ["discipline_id"], type: "foreign key", name: "lecturers_discipline_id_fkey",
      references: { table: "disciplines", field: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE", transaction,
    });
    await qi.addConstraint("lecturers", {
      fields: ["major_id"], type: "foreign key", name: "lecturers_major_id_fkey",
      references: { table: "majors", field: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE", transaction,
    });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeConstraint("lecturers", "lecturers_major_id_fkey", { transaction });
    await qi.removeConstraint("lecturers", "lecturers_discipline_id_fkey", { transaction });
    await qi.removeIndex("lecturers", "lecturers_major_idx", { transaction });
    await qi.removeIndex("lecturers", "lecturers_discipline_idx", { transaction });
    await qi.removeColumn("lecturers", "major_id", { transaction });
    await qi.removeColumn("lecturers", "discipline_id", { transaction });
  });
}
