import { DataTypes } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

/**
 * 009 — KẾ HOẠCH ĐÀO TẠO: HỌC PHẦN THEO CHUYÊN NGÀNH + GÓI HỌC PHẦN THEO LỚP.
 * - subjects: học phần của mỗi chuyên ngành (~30 học phần).
 * - subject_packages: gói học phần gắn vào từng lớp (mỗi lớp 2 gói, mỗi gói chọn 21 học phần).
 * - subject_package_subjects: bảng nối học phần thuộc gói.
 */
export async function up({ context: queryInterface }: any) {
  await queryInterface.createTable("subjects", {
    id: uuid, code: { type: DataTypes.STRING(20), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    major_id: { type: DataTypes.UUID, allowNull: false, references: { model: "majors", key: "id" }, onDelete: "CASCADE" },
    credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("subjects", ["code"], { name: "subjects_code_unique", unique: true });
  await queryInterface.addIndex("subjects", ["major_id"], { name: "subjects_major_idx" });

  await queryInterface.createTable("subject_packages", {
    id: uuid, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    class_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
    major_id: { type: DataTypes.UUID, allowNull: true, references: { model: "majors", key: "id" }, onDelete: "SET NULL" },
    total_subjects: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 21 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, ...ts(),
  });
  await queryInterface.addIndex("subject_packages", ["code"], { name: "subject_packages_code_unique", unique: true });
  await queryInterface.addIndex("subject_packages", ["class_group_id"], { name: "subject_packages_class_idx" });

  await queryInterface.createTable("subject_package_subjects", {
    id: uuid, package_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subject_packages", key: "id" }, onDelete: "CASCADE" },
    subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "CASCADE" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 }, ...ts(),
  });
  await queryInterface.addConstraint("subject_package_subjects", { fields: ["package_id", "subject_id"], type: "unique", name: "subject_package_subjects_pkg_subj_unique" });
  await queryInterface.addIndex("subject_package_subjects", ["subject_id"], { name: "subject_package_subjects_subject_idx" });
}

export async function down({ context: queryInterface }: any) {
  const tables = ["subject_package_subjects", "subject_packages", "subjects"];
  for (const table of tables) await queryInterface.dropTable(table);
}
