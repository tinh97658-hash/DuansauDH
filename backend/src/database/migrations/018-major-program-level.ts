import { DataTypes } from "sequelize";

/**
 * 018 — BẬC ĐÀO TẠO CHO NGÀNH HỌC (THẠC SĨ vs TIẾN SĨ):
 * Bổ sung trường program cho bảng majors, đồng bộ hóa danh mục ngành theo bậc đào tạo.
 */
export async function up({ context: queryInterface }: any) {
  try {
    await queryInterface.addColumn("majors", "program", {
      type: DataTypes.ENUM("masters", "doctoral"),
      allowNull: false,
      defaultValue: "masters",
    });
  } catch {}

  try {
    await queryInterface.addIndex("majors", ["program"], {
      name: "majors_program_idx",
    });
  } catch {}

  // Cập nhật các ngành đã gắn với Trình độ Tiến sĩ thành doctoral
  try {
    await queryInterface.sequelize.query(`
      UPDATE majors
      SET program = 'doctoral'
      WHERE training_level_id IN (
        SELECT id FROM training_levels WHERE code = 'DOCTOR' OR name ILIKE '%Tiến sĩ%'
      )
    `);
  } catch {}

  // Thêm các chuyên ngành Tiến sĩ chuẩn nếu chưa có
  const doctoralMajors = [
    { code: "KHHH-TS", name: "Khoa học hàng hải (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
    { code: "KTTC-TS", name: "Kỹ thuật tàu thủy (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
    { code: "TDH-TS", name: "Kỹ thuật điều khiển & Tự động hóa (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
    { code: "QLVT-TS", name: "Tổ chức và quản lý vận tải (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
    { code: "CTB-TS", name: "Kỹ thuật xây dựng công trình thủy & biển (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
    { code: "CKDL-TS", name: "Kỹ thuật cơ khí động lực (Tiến sĩ)", program: "doctoral", duration_years: 3, max_overtime_years: 2 },
  ];

  for (const m of doctoralMajors) {
    try {
      await queryInterface.sequelize.query(`
        INSERT INTO majors (id, code, name, program, duration_years, max_overtime_years, is_admission_screening, active, created_at, updated_at)
        VALUES (gen_random_uuid(), '${m.code}', '${m.name}', 'doctoral', ${m.duration_years}, ${m.max_overtime_years}, true, true, NOW(), NOW())
        ON CONFLICT (code) DO UPDATE SET program = 'doctoral';
      `);
    } catch {}
  }
}

export async function down({ context: queryInterface }: any) {
  try {
    await queryInterface.removeIndex("majors", "majors_program_idx");
  } catch {}
  try {
    await queryInterface.removeColumn("majors", "program");
  } catch {}
}
