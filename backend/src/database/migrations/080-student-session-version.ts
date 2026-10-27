import { DataTypes, type QueryInterface } from "sequelize";

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.addColumn("students", "session_version", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.removeColumn("students", "session_version");
}
