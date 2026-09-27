import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("staff", "password", { type: DataTypes.STRING(60), allowNull: true });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeColumn("staff", "password");
}
