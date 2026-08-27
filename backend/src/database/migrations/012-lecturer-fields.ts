import { DataTypes } from "sequelize";

/**
 * 012 — BỔ SUNG TRƯỜNG CHO BẢNG lecturers (Giảng viên):
 * Chức danh -> Học hàm, Học vị; thêm Loại giảng dạy; thêm Số điện thoại; email nullable.
 */
export async function up({ context: queryInterface }: any) {
  const table = "lecturers";
  const columns: Array<{ name: string; spec: any }> = [
    { name: "phone", spec: { type: DataTypes.STRING(30), allowNull: true } },
    { name: "academic_rank", spec: { type: DataTypes.STRING(50), allowNull: true } },
    { name: "academic_degree", spec: { type: DataTypes.STRING(50), allowNull: true } },
    { name: "teaching_type", spec: { type: DataTypes.STRING(50), allowNull: true } },
  ];

  for (const col of columns) {
    try {
      await queryInterface.addColumn(table, col.name, col.spec);
    } catch {
      // Column might already exist
    }
  }

  try {
    await queryInterface.changeColumn(table, "email", {
      type: DataTypes.STRING(150),
      allowNull: true,
    });
  } catch {}

  try {
    await queryInterface.removeIndex(table, "lecturers_email_lower_unique");
  } catch {}
}

export async function down({ context: queryInterface }: any) {
  const table = "lecturers";
  const columns = ["teaching_type", "academic_degree", "academic_rank", "phone"];

  for (const col of columns) {
    try {
      await queryInterface.removeColumn(table, col);
    } catch {}
  }
}
