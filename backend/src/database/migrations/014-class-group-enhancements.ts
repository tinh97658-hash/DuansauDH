import { DataTypes } from "sequelize";

/**
 * 014 — BỔ SUNG TRƯỜNG CHO class_groups & class_group_members:
 * max_students cho class_groups; admission_record_id và note cho class_group_members; cho phép student_id nullable.
 */
export async function up({ context: queryInterface }: any) {
  try {
    await queryInterface.addColumn("class_groups", "max_students", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 40,
    });
  } catch {}

  try {
    await queryInterface.addColumn("class_group_members", "admission_record_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "admission_records", key: "id" },
      onDelete: "CASCADE",
    });
  } catch {}

  try {
    await queryInterface.addColumn("class_group_members", "note", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  } catch {}

  try {
    await queryInterface.changeColumn("class_group_members", "student_id", {
      type: DataTypes.UUID,
      allowNull: true,
    });
  } catch {}

  try {
    await queryInterface.addIndex("class_group_members", ["admission_record_id"], {
      name: "class_group_members_admission_idx",
    });
  } catch {}
}

export async function down({ context: queryInterface }: any) {
  try {
    await queryInterface.removeColumn("class_groups", "max_students");
  } catch {}
  try {
    await queryInterface.removeColumn("class_group_members", "admission_record_id");
  } catch {}
  try {
    await queryInterface.removeColumn("class_group_members", "note");
  } catch {}
}
