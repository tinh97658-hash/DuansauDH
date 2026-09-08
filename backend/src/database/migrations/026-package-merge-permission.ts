import { DataTypes } from "sequelize";
import type { QueryInterface } from "sequelize";
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn("subject_packages", "can_merge", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
}
export async function down() {
  throw new Error("Preserve package merge permissions; roll back only with a reviewed data backup.");
}
