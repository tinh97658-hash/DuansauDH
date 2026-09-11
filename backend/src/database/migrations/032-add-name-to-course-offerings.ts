import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("course_offerings", "name", {
    type: DataTypes.STRING(255),
    allowNull: true,
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeColumn("course_offerings", "name");
}
