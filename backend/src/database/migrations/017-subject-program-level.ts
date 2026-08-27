import { DataTypes } from "sequelize";

/**
 * 017 — BẬC ĐÀO TẠO CHO HỌC PHẦN (THẠC SĨ vs TIẾN SĨ):
 * Thêm trường program (masters / doctoral) cho bảng subjects.
 */
export async function up({ context: queryInterface }: any) {
  try {
    await queryInterface.addColumn("subjects", "program", {
      type: DataTypes.ENUM("masters", "doctoral"),
      allowNull: false,
      defaultValue: "masters",
    });
  } catch {}

  try {
    await queryInterface.addIndex("subjects", ["major_id", "program"], {
      name: "subjects_major_program_idx",
    });
  } catch {}

  try {
    await queryInterface.removeIndex("subjects", "subjects_code_unique");
  } catch {}
}

export async function down({ context: queryInterface }: any) {
  try {
    await queryInterface.removeIndex("subjects", "subjects_major_program_idx");
  } catch {}
  try {
    await queryInterface.removeColumn("subjects", "program");
  } catch {}
}
