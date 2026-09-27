import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("lecturers", "faculty", {
    type: DataTypes.STRING(150),
    allowNull: true,
  });
  await queryInterface.sequelize.query(
    `UPDATE lecturers SET faculty = department WHERE faculty IS NULL AND department IS NOT NULL`,
  );
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeColumn("lecturers", "faculty");
}
