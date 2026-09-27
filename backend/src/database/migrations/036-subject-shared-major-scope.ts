import { DataTypes } from "sequelize";

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("subjects", "shared_major_ids", {
      type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [],
    }, { transaction });
    await qi.sequelize.query(`
      UPDATE subjects s
      SET shared_major_ids = ARRAY(
        SELECT m.id FROM majors m
        WHERE m.program::text = s.program::text
          AND m.id <> s.major_id
          AND m.code <> 'CHUNG'
          AND m.active = TRUE
      )::uuid[]
      WHERE s.allow_cross_major = TRUE
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.removeColumn("subjects", "shared_major_ids");
}
