import { DataTypes } from "sequelize";

/**
 * 016 — GÓI HỌC PHẦN CHÍNH THỨC (1 GÓI / LỚP):
 * Bổ sung trường is_official cho subject_packages.
 */
export async function up({ context: queryInterface }: any) {
  try {
    await queryInterface.addColumn("subject_packages", "is_official", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  } catch {}

  try {
    await queryInterface.addIndex("subject_packages", ["class_group_id", "is_official"], {
      name: "subject_packages_class_official_idx",
    });
  } catch {}
}

export async function down({ context: queryInterface }: any) {
  try {
    await queryInterface.removeIndex("subject_packages", "subject_packages_class_official_idx");
  } catch {}
  try {
    await queryInterface.removeColumn("subject_packages", "is_official");
  } catch {}
}
