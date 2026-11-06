import { DataTypes } from "sequelize";

export async function up({ context: qi }: any) {
  await qi.addColumn("class_groups", "subject_requirements", {
    type: DataTypes.JSONB, allowNull: false, defaultValue: [],
  });
}

export async function down({ context: qi }: any) {
  await qi.removeColumn("class_groups", "subject_requirements");
}
