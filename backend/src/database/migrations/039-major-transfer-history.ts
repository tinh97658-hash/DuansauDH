import { DataTypes } from "sequelize";

const id = { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 };
const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

/**
 * Lịch sử chuyển chuyên ngành.
 *
 * `subject_recognitions` được tạo ở đây với đầy đủ cột của cơ chế công nhận dùng chung:
 * - `major_transfer_id` cho phép NULL để quyết định công nhận dùng được cho cả tiền thạc sĩ
 *   và học trước, không bắt buộc phải gắn với một lần chuyển chuyên ngành.
 * - `learning_result_id` trỏ về kết quả học phần cá nhân (`learner_subject_results`, tạo ở 040).
 * - `source_type` phân biệt nguồn công nhận; `decision_no`/`decided_at` ghi nhận quyết định.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.createTable("major_transfers", {
      id,
      admission_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: "admission_records", key: "id" }, onDelete: "RESTRICT" },
      from_major_id: { type: DataTypes.UUID, allowNull: false, references: { model: "majors", key: "id" }, onDelete: "RESTRICT" },
      to_major_id: { type: DataTypes.UUID, allowNull: false, references: { model: "majors", key: "id" }, onDelete: "RESTRICT" },
      from_class_group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "class_groups", key: "id" }, onDelete: "SET NULL" },
      from_curriculum_id: { type: DataTypes.UUID, allowNull: true, references: { model: "curriculums", key: "id" }, onDelete: "SET NULL" },
      to_curriculum_id: { type: DataTypes.UUID, allowNull: true, references: { model: "curriculums", key: "id" }, onDelete: "SET NULL" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
      reason: { type: DataTypes.TEXT, allowNull: true },
      decision_note: { type: DataTypes.TEXT, allowNull: true },
      previous_admission_status: { type: DataTypes.STRING(30), allowNull: true },
      previous_study_status: { type: DataTypes.STRING(50), allowNull: true },
      requested_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      decided_at: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    }, { transaction });
    await qi.addIndex("major_transfers", ["admission_record_id", "requested_at"], { name: "major_transfers_record_history_idx", transaction });
    await qi.sequelize.query("CREATE UNIQUE INDEX major_transfers_one_pending_idx ON major_transfers (admission_record_id) WHERE status = 'pending'", { transaction });

    await qi.createTable("subject_recognitions", {
      id,
      admission_record_id: { type: DataTypes.UUID, allowNull: false, references: { model: "admission_records", key: "id" }, onDelete: "RESTRICT" },
      major_transfer_id: { type: DataTypes.UUID, allowNull: true, references: { model: "major_transfers", key: "id" }, onDelete: "SET NULL" },
      learning_result_id: { type: DataTypes.UUID, allowNull: true },
      source_subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "RESTRICT" },
      target_subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "RESTRICT" },
      source_course_offering_id: { type: DataTypes.UUID, allowNull: true, references: { model: "course_offerings", key: "id" }, onDelete: "SET NULL" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "approved" },
      basis: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "canonical_subject" },
      source_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "regular" },
      decision_no: { type: DataTypes.STRING(100), allowNull: true },
      decided_at: { type: DataTypes.DATE, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps,
    }, { transaction });
    await qi.addConstraint("subject_recognitions", {
      fields: ["admission_record_id", "target_subject_id"], type: "unique",
      name: "subject_recognitions_record_target_unique", transaction,
    });
    await qi.addIndex("subject_recognitions", ["target_subject_id", "status"], { name: "subject_recognitions_target_status_idx", transaction });
    await qi.addIndex("subject_recognitions", ["major_transfer_id"], { name: "subject_recognitions_major_transfer_idx", transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.dropTable("subject_recognitions", { transaction });
    await qi.dropTable("major_transfers", { transaction });
  });
}
