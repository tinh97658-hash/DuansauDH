import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("rooms", "floor", { type: DataTypes.STRING(30), allowNull: true });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeColumn("rooms", "floor");
}
