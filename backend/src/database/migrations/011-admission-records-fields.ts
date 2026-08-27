import { DataTypes } from "sequelize";

/**
 * 011 — BỔ SUNG TRƯỜNG CHO BẢNG admission_records (Hồ sơ tuyển sinh):
 * Thông tin cá nhân, ảnh 3x4, thể thức đào tạo, chỗ ở, giấy tờ nộp, văn bằng ĐH.
 */
export async function up({ context: queryInterface }: any) {
  const table = "admission_records";
  const columns: Array<{ name: string; spec: any }> = [
    { name: "code", spec: { type: DataTypes.STRING(50) } },
    { name: "last_name", spec: { type: DataTypes.STRING(100) } },
    { name: "first_name", spec: { type: DataTypes.STRING(50) } },
    { name: "dob", spec: { type: DataTypes.STRING(30) } },
    { name: "id_card", spec: { type: DataTypes.STRING(30) } },
    { name: "gender", spec: { type: DataTypes.STRING(10), defaultValue: "Nam" } },
    { name: "pob", spec: { type: DataTypes.STRING(150) } },
    { name: "receipt_type", spec: { type: DataTypes.STRING(50) } },
    { name: "profile_category", spec: { type: DataTypes.STRING(50) } },
    { name: "admission_date", spec: { type: DataTypes.STRING(30) } },
    { name: "photo", spec: { type: DataTypes.TEXT } },
    { name: "is_exempt_foreign_language", spec: { type: DataTypes.BOOLEAN, defaultValue: false } },
    { name: "training_mode_group", spec: { type: DataTypes.STRING(100) } },
    { name: "training_level", spec: { type: DataTypes.STRING(50), defaultValue: "Thạc sĩ" } },
    { name: "training_mode_name", spec: { type: DataTypes.STRING(100) } },
    { name: "major_name", spec: { type: DataTypes.STRING(150) } },
    { name: "language", spec: { type: DataTypes.STRING(50), defaultValue: "Tiếng Việt" } },
    { name: "study_status", spec: { type: DataTypes.STRING(50), defaultValue: "Nộp hồ sơ đầu vào" } },
    { name: "academic_year", spec: { type: DataTypes.STRING(10), defaultValue: "2026" } },
    { name: "nationality", spec: { type: DataTypes.STRING(100), defaultValue: "Việt Nam" } },
    { name: "ethnicity", spec: { type: DataTypes.STRING(50), defaultValue: "Kinh" } },
    { name: "religion", spec: { type: DataTypes.STRING(50), defaultValue: "Không" } },
    { name: "city", spec: { type: DataTypes.STRING(100) } },
    { name: "ward", spec: { type: DataTypes.STRING(150) } },
    { name: "documents", spec: { type: DataTypes.JSONB, defaultValue: {} } },
    { name: "priority_object", spec: { type: DataTypes.STRING(100) } },
    { name: "workplace", spec: { type: DataTypes.STRING(200) } },
    { name: "job", spec: { type: DataTypes.STRING(100) } },
    { name: "supplement_subjects_count", spec: { type: DataTypes.INTEGER } },
    { name: "grad_school", spec: { type: DataTypes.STRING(200) } },
    { name: "grad_degree_type", spec: { type: DataTypes.STRING(100) } },
    { name: "grad_year", spec: { type: DataTypes.STRING(10) } },
    { name: "gpa", spec: { type: DataTypes.STRING(20) } },
    { name: "grad_major", spec: { type: DataTypes.STRING(150) } },
    { name: "grad_classification", spec: { type: DataTypes.STRING(50) } },
    { name: "diploma_number", spec: { type: DataTypes.STRING(50) } },
    { name: "registry_book_number", spec: { type: DataTypes.STRING(50) } },
    { name: "extra_data", spec: { type: DataTypes.JSONB, defaultValue: {} } },
  ];

  for (const col of columns) {
    try {
      await queryInterface.addColumn(table, col.name, col.spec);
    } catch {
      // Column might already exist
    }
  }

  try {
    await queryInterface.changeColumn(table, "plan_id", {
      type: DataTypes.UUID,
      allowNull: true,
    });
  } catch {}

  try {
    await queryInterface.changeColumn(table, "email", {
      type: DataTypes.STRING(150),
      allowNull: true,
    });
  } catch {}
}

export async function down({ context: queryInterface }: any) {
  const table = "admission_records";
  const columns = [
    "extra_data", "registry_book_number", "diploma_number", "grad_classification",
    "grad_major", "gpa", "grad_year", "grad_degree_type", "grad_school",
    "supplement_subjects_count", "job", "workplace", "priority_object",
    "documents", "ward", "city", "religion", "ethnicity", "nationality",
    "academic_year", "study_status", "language", "major_name", "training_mode_name",
    "training_level", "training_mode_group", "is_exempt_foreign_language",
    "photo", "admission_date", "profile_category", "receipt_type", "pob",
    "gender", "id_card", "dob", "first_name", "last_name", "code",
  ];

  for (const col of columns) {
    try {
      await queryInterface.removeColumn(table, col);
    } catch {}
  }
}
