import { DataTypes, QueryInterface } from "sequelize";

// Rules are shared by all Masters subjects; saved grade snapshots stay untouched.
export async function up({ context: query }: { context: QueryInterface }) {
  await query.createTable("shared_grading_rules", {
    version: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    policy: { type: DataTypes.JSONB, allowNull: false },
    created_by: { type: DataTypes.STRING(80), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
}
export async function down({ context: query }: { context: QueryInterface }) { await query.dropTable("shared_grading_rules"); }
