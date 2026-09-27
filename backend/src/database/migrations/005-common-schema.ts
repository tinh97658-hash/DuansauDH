import { DataTypes } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

/**
 * 005 — BẢNG CHUNG (danh mục dùng chung + chương trình đào tạo).
 * Nguồn: danh mục HỆ THỐNG trên header.
 */
export async function up({ context: queryInterface }: any) {
  // Dân tộc
  await queryInterface.createTable("ethnicities", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("ethnicities", ["code"], { name: "ethnicities_code_unique", unique: true });

  // Quốc tịch
  await queryInterface.createTable("nationalities", {
    id: uuid, code: { type: DataTypes.STRING(10), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("nationalities", ["code"], { name: "nationalities_code_unique", unique: true });

  // Thành phố
  await queryInterface.createTable("cities", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("cities", ["code"], { name: "cities_code_unique", unique: true });

  // Quận huyện (FK -> cities)
  await queryInterface.createTable("districts", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    city_id: { type: DataTypes.UUID, allowNull: false, references: { model: "cities", key: "id" }, onDelete: "CASCADE" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("districts", ["city_id"], { name: "districts_city_idx" });
  await queryInterface.addIndex("districts", ["code"], { name: "districts_code_unique", unique: true });

  // Phường xã (FK -> districts)
  await queryInterface.createTable("wards", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    district_id: { type: DataTypes.UUID, allowNull: false, references: { model: "districts", key: "id" }, onDelete: "CASCADE" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("wards", ["district_id"], { name: "wards_district_idx" });
  await queryInterface.addIndex("wards", ["code"], { name: "wards_code_unique", unique: true });

  // Nhóm hình thức đào tạo
  await queryInterface.createTable("training_mode_groups", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("training_mode_groups", ["code"], { name: "training_mode_groups_code_unique", unique: true });

  // Hình thức đào tạo (FK -> training_mode_groups)
  await queryInterface.createTable("training_modes", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "training_mode_groups", key: "id" }, onDelete: "SET NULL" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("training_modes", ["code"], { name: "training_modes_code_unique", unique: true });
  await queryInterface.addIndex("training_modes", ["group_id"], { name: "training_modes_group_idx" });

  // Trình độ đào tạo (thạc sĩ, tiến sĩ...)
  await queryInterface.createTable("training_levels", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    duration_years: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 2 },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("training_levels", ["code"], { name: "training_levels_code_unique", unique: true });

  // Ngành học (FK -> training_levels)
  await queryInterface.createTable("majors", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    training_level_id: { type: DataTypes.UUID, allowNull: true, references: { model: "training_levels", key: "id" }, onDelete: "SET NULL" },
    description: { type: DataTypes.TEXT }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("majors", ["code"], { name: "majors_code_unique", unique: true });
  await queryInterface.addIndex("majors", ["training_level_id"], { name: "majors_level_idx" });

  // Trạng thái học
  await queryInterface.createTable("study_statuses", {
    id: uuid, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("study_statuses", ["code"], { name: "study_statuses_code_unique", unique: true });

  // Học phần bổ sung kiến thức
  await queryInterface.createTable("bridge_knowledge_subjects", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("bridge_knowledge_subjects", ["code"], { name: "bridge_knowledge_subjects_code_unique", unique: true });

  // Giảng viên (liên kết staff, hoặc nhập thủ công)
  await queryInterface.createTable("lecturers", {
    id: uuid, staff_id: { type: DataTypes.UUID, allowNull: true, references: { model: "staff", key: "id" }, onDelete: "SET NULL" },
    code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false }, title: { type: DataTypes.STRING(50) },
    department: { type: DataTypes.STRING(150) }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("lecturers", [queryInterface.sequelize.fn("lower", queryInterface.sequelize.col("email"))], { name: "lecturers_email_lower_unique", unique: true });
  await queryInterface.addIndex("lecturers", ["staff_id"], { name: "lecturers_staff_idx" });

  // Chương trình đào tạo (liên kết level + mode + major)
  await queryInterface.createTable("training_programs", {
    id: uuid, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    training_level_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_levels", key: "id" }, onDelete: "RESTRICT" },
    training_mode_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_modes", key: "id" }, onDelete: "RESTRICT" },
    major_id: { type: DataTypes.UUID, allowNull: true, references: { model: "majors", key: "id" }, onDelete: "SET NULL" },
    duration_years: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 2 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("training_programs", ["code"], { name: "training_programs_code_unique", unique: true });
  await queryInterface.addIndex("training_programs", ["training_level_id"], { name: "training_programs_level_idx" });
  await queryInterface.addIndex("training_programs", ["training_mode_id"], { name: "training_programs_mode_idx" });
  await queryInterface.addIndex("training_programs", ["major_id"], { name: "training_programs_major_idx" });
}

export async function down({ context: queryInterface }: any) {
  const tables = [
    "training_programs", "lecturers", "bridge_knowledge_subjects", "study_statuses", "majors",
    "training_levels", "training_modes", "training_mode_groups", "wards", "districts", "cities",
    "nationalities", "ethnicities",
  ];
  for (const table of tables) await queryInterface.dropTable(table);
}
