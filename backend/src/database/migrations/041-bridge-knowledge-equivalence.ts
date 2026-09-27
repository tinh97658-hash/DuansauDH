import { DataTypes } from "sequelize";

/**
 * Khai báo tương đương cho học phần bổ sung kiến thức.
 *
 * Học bổ sung kiến thức không mặc nhiên là học phần trong CTĐT thạc sĩ: chỉ được
 * công nhận khi danh mục đã khai báo nó tương đương với một học phần của CTĐT.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.addColumn("bridge_knowledge_subjects", "equivalent_subject_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "subjects", key: "id" },
      onDelete: "SET NULL",
    }, { transaction });
    await qi.addIndex("bridge_knowledge_subjects", ["equivalent_subject_id"], {
      name: "bridge_knowledge_subjects_equivalent_idx",
      transaction,
    });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.removeIndex("bridge_knowledge_subjects", "bridge_knowledge_subjects_equivalent_idx", { transaction });
    await qi.removeColumn("bridge_knowledge_subjects", "equivalent_subject_id", { transaction });
  });
}
