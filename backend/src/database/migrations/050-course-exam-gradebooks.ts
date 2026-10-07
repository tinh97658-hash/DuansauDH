import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: query }: { context: QueryInterface }) {
  await query.createTable("course_exam_gradebooks", {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    class_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
    course_offering_id: { type: DataTypes.UUID, allowNull: false, references: { model: "course_offerings", key: "id" }, onDelete: "CASCADE" },
    revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    grades: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await query.addIndex("course_exam_gradebooks", ["class_group_id", "course_offering_id"], {
    unique: true, name: "course_exam_gradebooks_group_offering_unique",
  });
}

export async function down({ context: query }: { context: QueryInterface }) {
  await query.dropTable("course_exam_gradebooks");
}
