import { DataTypes } from "sequelize";

/**
 * 013 — BỔ SUNG TRƯỜNG CHO BẢNG majors (Ngành học):
 * Xét tuyển đầu vào (is_admission_screening), Thời gian đào tạo (duration_years), Thời gian vượt khung (max_overtime_years).
 */
export async function up({ context: queryInterface }: any) {
  const table = "majors";
  const columns: Array<{ name: string; spec: any }> = [
    { name: "is_admission_screening", spec: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false } },
    { name: "duration_years", spec: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 2 } },
    { name: "max_overtime_years", spec: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 2 } },
  ];

  for (const col of columns) {
    try {
      await queryInterface.addColumn(table, col.name, col.spec);
    } catch {
      // Column might already exist
    }
  }
}

export async function down({ context: queryInterface }: any) {
  const table = "majors";
  const columns = ["max_overtime_years", "duration_years", "is_admission_screening"];

  for (const col of columns) {
    try {
      await queryInterface.removeColumn(table, col);
    } catch {}
  }
}
