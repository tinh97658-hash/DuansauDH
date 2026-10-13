import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: query }: { context: QueryInterface }) {
  await query.sequelize.transaction(async transaction => {
    await query.createTable("course_grading_policies", {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "CASCADE" },
      academic_year: { type: DataTypes.STRING(20), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false },
      policy: { type: DataTypes.JSONB, allowNull: false },
      created_by: { type: DataTypes.STRING(80), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, { transaction });
    const indexes = await query.showIndex("course_grading_policies", { transaction }) as Array<{ name: string; unique: boolean; fields: Array<{ attribute: string }> }>;
    const existing = indexes.find(index => index.name === "course_grading_policies_scope_version");
    if (existing) {
      if (!existing.unique || existing.fields.map(field => field.attribute).join(",") !== "subject_id,academic_year,version") {
        throw new Error("Existing grading-policy index does not match the required unique scope.");
      }
    } else await query.addIndex("course_grading_policies", ["subject_id", "academic_year", "version"], { unique: true, name: "course_grading_policies_scope_version", transaction });
  });
}
export async function down({ context: query }: { context: QueryInterface }) { await query.dropTable("course_grading_policies"); }
