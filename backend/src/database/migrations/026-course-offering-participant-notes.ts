import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("course_offerings", "participant_notes", {
    type: DataTypes.JSONB, allowNull: false, defaultValue: [],
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.removeColumn("course_offerings", "participant_notes");
}
