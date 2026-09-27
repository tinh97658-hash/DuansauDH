import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.addColumn("subjects", "canonical_subject_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "subjects", key: "id" },
      onDelete: "RESTRICT",
    }, { transaction });
    await queryInterface.addColumn("subjects", "allow_cross_major", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }, { transaction });
    await queryInterface.addConstraint("subjects", {
      fields: ["id", "canonical_subject_id"],
      type: "check",
      where: queryInterface.sequelize.literal("canonical_subject_id IS NULL OR canonical_subject_id <> id"),
      name: "subjects_canonical_not_self_check",
      transaction,
    });
    await queryInterface.addConstraint("subjects", {
      fields: ["canonical_subject_id", "allow_cross_major"],
      type: "check",
      where: queryInterface.sequelize.literal("canonical_subject_id IS NULL OR allow_cross_major = FALSE"),
      name: "subjects_alias_not_cross_major_root_check",
      transaction,
    });
    await queryInterface.addIndex("subjects", ["canonical_subject_id"], {
      name: "subjects_canonical_subject_idx",
      transaction,
    });
  });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.sequelize.transaction(async (transaction: any) => {
    await queryInterface.removeIndex("subjects", "subjects_canonical_subject_idx", { transaction });
    await queryInterface.removeConstraint("subjects", "subjects_alias_not_cross_major_root_check", { transaction });
    await queryInterface.removeConstraint("subjects", "subjects_canonical_not_self_check", { transaction });
    await queryInterface.removeColumn("subjects", "allow_cross_major", { transaction });
    await queryInterface.removeColumn("subjects", "canonical_subject_id", { transaction });
  });
}
