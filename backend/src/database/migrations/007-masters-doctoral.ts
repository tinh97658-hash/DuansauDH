import { DataTypes, Op } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };

/**
 * 007 — BẢNG RIÊNG: ĐÀO TẠO THẠC SĨ + ĐÀO TẠO TIẾN SĨ.
 */
export async function up({ context: queryInterface }: any) {
  // ===== ĐÀO TẠO THẠC SĨ =====
  await queryInterface.createTable("masters_admission_scores", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: true, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    admission_record_id: { type: DataTypes.UUID, allowNull: true, references: { model: "admission_records", key: "id" }, onDelete: "SET NULL" },
    subject: { type: DataTypes.STRING(120), allowNull: false }, score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    max_score: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 10 }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("masters_admission_scores", ["student_id"], { name: "masters_admission_scores_student_idx" });
  await queryInterface.addConstraint("masters_admission_scores", { fields: ["score"], type: "check", where: { score: { [Op.between]: [0, 10] } }, name: "masters_admission_scores_range" });

  await queryInterface.createTable("english_exam_sessions", {
    id: uuid, code: { type: DataTypes.STRING(30), allowNull: false }, name: { type: DataTypes.STRING(200), allowNull: false },
    exam_date: { type: DataTypes.DATEONLY }, status: { type: DataTypes.ENUM("scheduled", "completed", "cancelled"), allowNull: false, defaultValue: "scheduled" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("english_exam_sessions", ["code"], { name: "english_exam_sessions_code_unique", unique: true });

  await queryInterface.createTable("english_exam_scores", {
    id: uuid, session_id: { type: DataTypes.UUID, allowNull: false, references: { model: "english_exam_sessions", key: "id" }, onDelete: "CASCADE" },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    score: { type: DataTypes.DECIMAL(5, 2) }, result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false, defaultValue: "failed" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addConstraint("english_exam_scores", { fields: ["session_id", "student_id"], type: "unique", name: "english_exam_scores_session_student_unique" });
  await queryInterface.addIndex("english_exam_scores", ["student_id"], { name: "english_exam_scores_student_idx" });
  await queryInterface.addConstraint("english_exam_scores", { fields: ["score"], type: "check", where: { score: { [Op.between]: [0, 10] } }, name: "english_exam_scores_range" });

  await queryInterface.createTable("english_certifications", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    certificate_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "ielts" },
    certificate_number: { type: DataTypes.STRING(80) }, cert_date: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.ENUM("registered", "approved", "rejected"), allowNull: false, defaultValue: "registered" },
    approved_at: { type: DataTypes.DATE }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("english_certifications", ["student_id"], { name: "english_certifications_student_idx" });

  await queryInterface.createTable("graduation_defenses", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    thesis_title: { type: DataTypes.TEXT, allowNull: false }, defense_date: { type: DataTypes.DATEONLY },
    result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false, defaultValue: "failed" },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("graduation_defenses", ["student_id"], { name: "graduation_defenses_student_idx" });

  await queryInterface.createTable("graduation_records", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    defense_id: { type: DataTypes.UUID, allowNull: true, references: { model: "graduation_defenses", key: "id" }, onDelete: "SET NULL" },
    status: { type: DataTypes.ENUM("in_progress", "submitted", "approved"), allowNull: false, defaultValue: "in_progress" },
    submitted_at: { type: DataTypes.DATE }, approved_at: { type: DataTypes.DATE }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("graduation_records", ["student_id"], { name: "graduation_records_student_idx" });

  // ===== ĐÀO TẠO TIẾN SĨ =====
  await queryInterface.createTable("doctoral_admission_scores", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: true, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    subject: { type: DataTypes.STRING(120), allowNull: false }, score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    max_score: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 10 }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("doctoral_admission_scores", ["student_id"], { name: "doctoral_admission_scores_student_idx" });
  await queryInterface.addConstraint("doctoral_admission_scores", { fields: ["score"], type: "check", where: { score: { [Op.between]: [0, 10] } }, name: "doctoral_admission_scores_range" });

  await queryInterface.createTable("doctoral_thesis_topics", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    topic_type: { type: DataTypes.ENUM("overview", "chuyen_de"), allowNull: false, defaultValue: "overview" },
    title: { type: DataTypes.TEXT, allowNull: false }, supervisor_id: { type: DataTypes.UUID, allowNull: true, references: { model: "staff", key: "id" }, onDelete: "SET NULL" },
    approved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, approved_at: { type: DataTypes.DATE },
    note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("doctoral_thesis_topics", ["student_id"], { name: "doctoral_thesis_topics_student_idx" });
  await queryInterface.addIndex("doctoral_thesis_topics", ["supervisor_id"], { name: "doctoral_thesis_topics_supervisor_idx" });

  await queryInterface.createTable("doctoral_workshops", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    title: { type: DataTypes.TEXT, allowNull: false }, workshop_date: { type: DataTypes.DATEONLY }, venue: { type: DataTypes.STRING(150) },
    result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false, defaultValue: "failed" }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("doctoral_workshops", ["student_id"], { name: "doctoral_workshops_student_idx" });

  await queryInterface.createTable("doctoral_defenses", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    defense_level: { type: DataTypes.ENUM("co_so", "truong"), allowNull: false, defaultValue: "co_so" },
    thesis_title: { type: DataTypes.TEXT, allowNull: false }, defense_date: { type: DataTypes.DATEONLY },
    result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false, defaultValue: "failed" }, note: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("doctoral_defenses", ["student_id"], { name: "doctoral_defenses_student_idx" });

  await queryInterface.createTable("doctoral_reviews", {
    id: uuid, student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    reviewer_id: { type: DataTypes.UUID, allowNull: false, references: { model: "staff", key: "id" }, onDelete: "RESTRICT" },
    review_type: { type: DataTypes.ENUM("closed", "two_reviewers"), allowNull: false, defaultValue: "closed" },
    review_date: { type: DataTypes.DATEONLY }, result: { type: DataTypes.ENUM("approved", "rejected"), allowNull: false, defaultValue: "approved" },
    comment: { type: DataTypes.TEXT }, ...ts(),
  });
  await queryInterface.addIndex("doctoral_reviews", ["student_id"], { name: "doctoral_reviews_student_idx" });
  await queryInterface.addIndex("doctoral_reviews", ["reviewer_id"], { name: "doctoral_reviews_reviewer_idx" });
}

export async function down({ context: queryInterface }: any) {
  const tables = [
    "doctoral_reviews", "doctoral_defenses", "doctoral_workshops", "doctoral_thesis_topics", "doctoral_admission_scores",
    "graduation_records", "graduation_defenses", "english_certifications", "english_exam_scores", "english_exam_sessions", "masters_admission_scores",
  ];
  for (const table of tables) await queryInterface.dropTable(table);
  const types = [
    "english_exam_sessions_status", "english_exam_scores_result", "english_certifications_status",
    "graduation_defenses_result", "graduation_records_status", "doctoral_thesis_topics_topic_type",
    "doctoral_workshops_result", "doctoral_defenses_defense_level", "doctoral_defenses_result", "doctoral_reviews_review_type", "doctoral_reviews_result",
  ];
  for (const type of types) await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_${type}"`);
}
