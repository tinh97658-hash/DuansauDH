import { DataTypes } from "sequelize";

const id = { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 };
const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

/**
 * Nguồn dữ liệu duy nhất cho mọi lần học của một học viên — dùng chung cho tiền thạc sĩ,
 * học trước, chính khóa và học bổ sung kiến thức.
 *
 * Quy ước trạng thái:
 * - `status = registered | studying`: mới đăng ký/đang học, KHÔNG tính tín chỉ; khi vào CTĐT
 *   chính thức chỉ được kế thừa đăng ký.
 * - `status = completed` và `result = passed | exempt`: đủ điều kiện được công nhận.
 * - `result = failed`: phải học lại, không công nhận.
 *
 * Bảng `subject_recognitions` đã được tạo ở migration 039; ở đây chỉ bổ sung khoá ngoại
 * trỏ tới bảng kết quả này sau khi bảng tồn tại.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.createTable("learner_subject_results", {
      id,
      admission_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: "admission_records", key: "id" }, onDelete: "CASCADE" },
      subject_id: { type: DataTypes.UUID, allowNull: true, references: { model: "subjects", key: "id" }, onDelete: "RESTRICT" },
      bridge_knowledge_subject_id: { type: DataTypes.UUID, allowNull: true, references: { model: "bridge_knowledge_subjects", key: "id" }, onDelete: "RESTRICT" },
      course_offering_id: { type: DataTypes.UUID, allowNull: true, references: { model: "course_offerings", key: "id" }, onDelete: "SET NULL" },
      source_type: { type: DataTypes.STRING(30), allowNull: false },
      academic_year: { type: DataTypes.STRING(20), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "registered" },
      result: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
      score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      completed_at: { type: DataTypes.DATEONLY, allowNull: true },
      decision_no: { type: DataTypes.STRING(100), allowNull: true },
      institution: { type: DataTypes.STRING(200), allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps,
    }, { transaction });

    // Đúng một trong hai nguồn danh mục: học phần CTĐT hoặc học phần bổ sung kiến thức.
    await qi.addConstraint("learner_subject_results", {
      type: "check",
      fields: ["subject_id", "bridge_knowledge_subject_id"],
      where: qi.sequelize.literal("(subject_id IS NOT NULL) <> (bridge_knowledge_subject_id IS NOT NULL)"),
      name: "learner_subject_results_single_catalog_check",
      transaction,
    });
    await qi.addConstraint("learner_subject_results", {
      fields: ["score"], type: "check",
      where: qi.sequelize.literal("score IS NULL OR (score >= 0 AND score <= 10)"),
      name: "learner_subject_results_score_range",
      transaction,
    });
    // Dùng SQL trực tiếp: addConstraint của Sequelize không truyền transaction cho khoá ngoại,
    // nên câu lệnh sẽ chạy ngoài transaction và không thấy bảng vừa tạo.
    await qi.sequelize.query(
      'ALTER TABLE "subject_recognitions" ADD CONSTRAINT "subject_recognitions_learning_result_id_fkey"'
      + ' FOREIGN KEY ("learning_result_id") REFERENCES "learner_subject_results" ("id") ON DELETE SET NULL',
      { transaction },
    );
    await qi.addIndex("learner_subject_results", ["admission_record_id", "status", "result"], { name: "learner_subject_results_record_outcome_idx", transaction });
    await qi.sequelize.query(`
      CREATE UNIQUE INDEX learner_subject_results_record_subject_source_idx
        ON learner_subject_results (admission_record_id, subject_id, source_type)
        WHERE subject_id IS NOT NULL
    `, { transaction });
    await qi.sequelize.query(`
      CREATE UNIQUE INDEX learner_subject_results_record_bridge_source_idx
        ON learner_subject_results (admission_record_id, bridge_knowledge_subject_id, source_type)
        WHERE bridge_knowledge_subject_id IS NOT NULL
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(
      'ALTER TABLE "subject_recognitions" DROP CONSTRAINT IF EXISTS "subject_recognitions_learning_result_id_fkey"',
      { transaction },
    );
    await qi.dropTable("learner_subject_results", { transaction });
  });
}
