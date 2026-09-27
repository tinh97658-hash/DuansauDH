import { DataTypes, Op } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };
const program = { type: DataTypes.ENUM("masters", "doctoral"), allowNull: false };

/**
 * 006 — BẢNG RIÊNG: KẾ HOẠCH KHÓA MỚI + nhóm học phần/thi (dùng chung thạc sĩ & tiến sĩ).
 */
export async function up({ context: queryInterface }: any) {
  // KẾ HOẠCH KHÓA MỚI -----------------------------------------------
  await queryInterface.createTable("training_plans", {
    id: uuid, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    program_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_programs", key: "id" }, onDelete: "RESTRICT" },
    academic_year: { type: DataTypes.STRING(20), allowNull: false }, semester: { type: DataTypes.STRING(20) },
    start_date: { type: DataTypes.DATEONLY }, end_date: { type: DataTypes.DATEONLY },
    target_students: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM("draft", "active", "closed"), allowNull: false, defaultValue: "draft" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("training_plans", ["code"], { name: "training_plans_code_unique", unique: true });
  await queryInterface.addIndex("training_plans", ["program_id"], { name: "training_plans_program_idx" });
  await queryInterface.addIndex("training_plans", ["academic_year"], { name: "training_plans_year_idx" });

  await queryInterface.createTable("admission_targets", {
    id: uuid, plan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_plans", key: "id" }, onDelete: "CASCADE" },
    major_id: { type: DataTypes.UUID, allowNull: false, references: { model: "majors", key: "id" }, onDelete: "RESTRICT" },
    training_mode_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_modes", key: "id" }, onDelete: "RESTRICT" },
    quota: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addConstraint("admission_targets", { fields: ["plan_id", "major_id", "training_mode_id"], type: "unique", name: "admission_targets_plan_major_mode_unique" });
  await queryInterface.addIndex("admission_targets", ["major_id"], { name: "admission_targets_major_idx" });

  await queryInterface.createTable("annual_fees", {
    id: uuid, plan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_plans", key: "id" }, onDelete: "CASCADE" },
    name: { type: DataTypes.STRING(200), allowNull: false }, amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    due_date: { type: DataTypes.DATEONLY }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("annual_fees", ["plan_id"], { name: "annual_fees_plan_idx" });

  await queryInterface.createTable("admission_records", {
    id: uuid, plan_id: { type: DataTypes.UUID, allowNull: false, references: { model: "training_plans", key: "id" }, onDelete: "CASCADE" },
    student_id: { type: DataTypes.UUID, allowNull: true, references: { model: "students", key: "id" }, onDelete: "SET NULL" },
    full_name: { type: DataTypes.STRING(150), allowNull: false }, email: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(30) }, major_id: { type: DataTypes.UUID, allowNull: true, references: { model: "majors", key: "id" }, onDelete: "SET NULL" },
    training_mode_id: { type: DataTypes.UUID, allowNull: true, references: { model: "training_modes", key: "id" }, onDelete: "SET NULL" },
    status: { type: DataTypes.ENUM("pending", "approved", "rejected"), allowNull: false, defaultValue: "pending" },
    submitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("admission_records", ["plan_id"], { name: "admission_records_plan_idx" });
  await queryInterface.addIndex("admission_records", ["status"], { name: "admission_records_status_idx" });
  await queryInterface.addIndex("admission_records", ["email"], { name: "admission_records_email_idx" });

  // NHÓM HỌC PHẦN + THI (dùng chung thạc sĩ / tiến sĩ) ------------------
  await queryInterface.createTable("class_groups", {
    id: uuid, program, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    major_id: { type: DataTypes.UUID, allowNull: true, references: { model: "majors", key: "id" }, onDelete: "SET NULL" },
    academic_year: { type: DataTypes.STRING(20) }, term: { type: DataTypes.STRING(20) },
    status: { type: DataTypes.ENUM("open", "closed"), allowNull: false, defaultValue: "open" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addConstraint("class_groups", { fields: ["program", "code"], type: "unique", name: "class_groups_program_code_unique" });
  await queryInterface.addIndex("class_groups", ["major_id"], { name: "class_groups_major_idx" });

  await queryInterface.createTable("class_group_members", {
    id: uuid, class_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    enrolled_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, ...ts(),
  });
  await queryInterface.addConstraint("class_group_members", { fields: ["class_group_id", "student_id"], type: "unique", name: "class_group_members_group_student_unique" });
  await queryInterface.addIndex("class_group_members", ["student_id"], { name: "class_group_members_student_idx" });

  await queryInterface.createTable("exam_sessions", {
    id: uuid, program, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    class_group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "class_groups", key: "id" }, onDelete: "SET NULL" },
    exam_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "final" },
    exam_date: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.ENUM("scheduled", "completed", "cancelled"), allowNull: false, defaultValue: "scheduled" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addConstraint("exam_sessions", { fields: ["program", "code"], type: "unique", name: "exam_sessions_program_code_unique" });
  await queryInterface.addIndex("exam_sessions", ["class_group_id"], { name: "exam_sessions_group_idx" });

  await queryInterface.createTable("exam_eligibilities", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    class_group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
    session_id: { type: DataTypes.UUID, allowNull: true, references: { model: "exam_sessions", key: "id" }, onDelete: "SET NULL" },
    eligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, decided_by: { type: DataTypes.UUID, allowNull: true, references: { model: "staff", key: "id" }, onDelete: "SET NULL" },
    decided_at: { type: DataTypes.DATE }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("exam_eligibilities", ["student_id"], { name: "exam_eligibilities_student_idx" });
  await queryInterface.addIndex("exam_eligibilities", ["session_id"], { name: "exam_eligibilities_session_idx" });

  await queryInterface.createTable("exam_results", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    session_id: { type: DataTypes.UUID, allowNull: false, references: { model: "exam_sessions", key: "id" }, onDelete: "CASCADE" },
    class_group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "class_groups", key: "id" }, onDelete: "SET NULL" },
    score: { type: DataTypes.DECIMAL(5, 2) }, grade: { type: DataTypes.STRING(10) },
    result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false, defaultValue: "failed" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addConstraint("exam_results", { fields: ["student_id", "session_id"], type: "unique", name: "exam_results_student_session_unique" });
  await queryInterface.addIndex("exam_results", ["session_id"], { name: "exam_results_session_idx" });
  await queryInterface.addConstraint("exam_results", { fields: ["score"], type: "check", where: { score: { [Op.between]: [0, 10] } }, name: "exam_results_score_range" });
}

export async function down({ context: queryInterface }: any) {
  const tables = ["exam_results", "exam_eligibilities", "exam_sessions", "class_group_members", "class_groups", "admission_records", "annual_fees", "admission_targets", "training_plans"];
  for (const table of tables) await queryInterface.dropTable(table);
  for (const type of ["program", "training_plans_status", "admission_records_status", "class_groups_status", "exam_sessions_status", "exam_results_result"]) {
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_${type}"`);
  }
}
