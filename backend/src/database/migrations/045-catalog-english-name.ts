import { DataTypes } from "sequelize";

/** Bổ sung tên tiếng Anh cho danh mục ngành và chuyên ngành. */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("disciplines", "english_name", { type: DataTypes.STRING(200), allowNull: true }, { transaction });
    await qi.addColumn("majors", "english_name", { type: DataTypes.STRING(200), allowNull: true }, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeColumn("majors", "english_name", { transaction });
    await qi.removeColumn("disciplines", "english_name", { transaction });
  });
}
