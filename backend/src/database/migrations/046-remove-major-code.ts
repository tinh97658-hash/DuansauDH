import { DataTypes } from "sequelize";

/** Chuyên ngành không có mã nghiệp vụ; chỉ ngành (disciplines) có mã. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("majors", "is_common", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }, { transaction });
    await qi.sequelize.query(
      `UPDATE majors SET is_common = TRUE WHERE code = 'CHUYEN-NGANH-CHUNG'`,
      { transaction },
    );
    await qi.sequelize.query(`DROP INDEX IF EXISTS majors_discipline_code_unique`, { transaction });
    await qi.sequelize.query(`DROP INDEX IF EXISTS majors_code_unique`, { transaction });
    await qi.removeColumn("majors", "code", { transaction });
    await qi.addIndex("majors", ["is_common"], { name: "majors_is_common_idx", transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeIndex("majors", "majors_is_common_idx", { transaction });
    await qi.addColumn("majors", "code", { type: DataTypes.STRING(20), allowNull: true }, { transaction });
    await qi.sequelize.query(
      `UPDATE majors SET code = CASE WHEN is_common THEN 'CHUYEN-NGANH-CHUNG'
        ELSE 'CN-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 12)) END`,
      { transaction },
    );
    await qi.sequelize.query(`ALTER TABLE majors ALTER COLUMN code SET NOT NULL`, { transaction });
    await qi.addIndex("majors", ["discipline_id", "code"], {
      name: "majors_discipline_code_unique", unique: true, transaction,
    });
    await qi.removeColumn("majors", "is_common", { transaction });
  });
}
