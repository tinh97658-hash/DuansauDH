import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.createTable("course_offering_students", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      course_offering_id: { type: DataTypes.UUID, allowNull: false, references: { model: "course_offerings", key: "id" }, onDelete: "CASCADE" },
      admission_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: "admission_records", key: "id" }, onDelete: "RESTRICT" },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, { transaction });
    await queryInterface.addIndex("course_offering_students", ["course_offering_id", "admission_record_id"], { unique: true, transaction });
    await queryInterface.addIndex("course_offering_students", ["admission_record_id"], { transaction });
  });
}
export async function down({ context: queryInterface }: any) {
  await queryInterface.dropTable("course_offering_students");
}
