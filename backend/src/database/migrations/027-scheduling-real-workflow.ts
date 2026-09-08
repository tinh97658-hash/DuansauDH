import { DataTypes } from "sequelize";

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("course_offerings", "retake_weekdays", { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false, defaultValue: [1, 2, 3, 4, 5, 6, 0] }, { transaction });
    await qi.addColumn("class_groups", "allowed_weekdays", { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false, defaultValue: [1, 2, 3, 4, 5, 6, 0] }, { transaction });
    await qi.addColumn("class_groups", "group_type", { type: DataTypes.STRING(30), allowNull: false, defaultValue: "ADMINISTRATIVE" }, { transaction });
    await qi.createTable("scheduling_retakes", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      admission_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: "admission_records", key: "id" }, onDelete: "RESTRICT" },
      subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "RESTRICT" },
      source_course_offering_id: { type: DataTypes.UUID, allowNull: false, references: { model: "course_offerings", key: "id" }, onDelete: "RESTRICT" },
      assigned_course_offering_id: { type: DataTypes.UUID, allowNull: true, references: { model: "course_offerings", key: "id" }, onDelete: "RESTRICT" },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, { transaction });
    await qi.addIndex("scheduling_retakes", ["admission_record_id", "subject_id", "source_course_offering_id"], { unique: true, transaction });
  });
}
export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.dropTable("scheduling_retakes", { transaction });
    await qi.removeColumn("course_offerings", "retake_weekdays", { transaction });
    await qi.removeColumn("class_groups", "group_type", { transaction });
    await qi.removeColumn("class_groups", "allowed_weekdays", { transaction });
  });
}
