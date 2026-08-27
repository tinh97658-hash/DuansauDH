import { DataTypes } from "sequelize";

/**
 * 010 — BỔ SUNG TRƯỜNG CHO BẢNG subjects (học phần) theo mẫu kế hoạch đào tạo:
 * mã số / mã chữ, bài tập lớn, loại học phần (CS/CN/TC/CH), bắt buộc.
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.addColumn("subjects", "code_number", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await queryInterface.addColumn("subjects", "code_text", { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" });
  await queryInterface.addColumn("subjects", "major_assignment", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  await queryInterface.addColumn("subjects", "subject_type", { type: DataTypes.STRING(10), allowNull: false, defaultValue: "CN" });
  await queryInterface.addColumn("subjects", "is_required", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
}

export async function down({ context: queryInterface }: any) {
  for (const column of ["is_required", "subject_type", "major_assignment", "code_text", "code_number"]) {
    await queryInterface.removeColumn("subjects", column);
  }
}
