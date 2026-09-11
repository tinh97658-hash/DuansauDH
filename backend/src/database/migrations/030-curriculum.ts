import { DataTypes } from "sequelize";

const ts = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
const uuid = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };
const program = { type: DataTypes.ENUM("masters", "doctoral"), allowNull: false };

/**
 * 030 — CHƯƠNG TRÌNH ĐÀO TẠO (CTĐT) THAY CHO "GÓI HỌC PHẦN THEO LỚP".
 *
 * Nghiệp vụ đúng: danh mục học phần thuộc **CTĐT của ngành + bậc + khóa**, không thuộc
 * từng lớp/nhóm học viên. Chia lớp/nhóm chỉ để quản lý và xếp lịch; học phần tự chọn do
 * Viện chỉ định **cho cả lớp** nên vẫn cần một bảng chọn ở cấp lớp.
 *
 * - curriculums:              một CTĐT cho mỗi (ngành, bậc, khóa áp dụng).
 * - curriculum_blocks:        khối kiến thức (cơ sở ngành, chuyên ngành, tự chọn, chuyên đề…).
 * - curriculum_elective_groups: nhóm tự chọn kèm số tín chỉ tối thiểu/tối đa phải chọn.
 * - curriculum_subjects:      học phần trong CTĐT (bắt buộc/tự chọn, thuộc khối, nhóm tự chọn).
 * - class_group_electives:    học phần tự chọn mà Viện chọn cho từng lớp.
 * - class_groups.curriculum_id: lớp kế thừa CTĐT của ngành + khóa.
 *
 * Bảng cũ subject_packages / subject_package_subjects bị loại bỏ.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.createTable("curriculums", {
      id: uuid,
      code: { type: DataTypes.STRING(60), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      major_id: { type: DataTypes.UUID, allowNull: false, references: { model: "majors", key: "id" }, onDelete: "CASCADE" },
      program,
      applicable_from_year: { type: DataTypes.STRING(20), allowNull: false },
      total_credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      ...ts(),
    }, { transaction });
    await qi.addConstraint("curriculums", {
      fields: ["major_id", "program", "applicable_from_year"],
      type: "unique",
      name: "curriculums_major_program_year_unique",
      transaction,
    });
    await qi.addIndex("curriculums", ["major_id"], { name: "curriculums_major_idx", transaction });

    await qi.createTable("curriculum_blocks", {
      id: uuid,
      curriculum_id: { type: DataTypes.UUID, allowNull: false, references: { model: "curriculums", key: "id" }, onDelete: "CASCADE" },
      code: { type: DataTypes.STRING(30), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      min_credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...ts(),
    }, { transaction });
    await qi.addConstraint("curriculum_blocks", {
      fields: ["curriculum_id", "code"],
      type: "unique",
      name: "curriculum_blocks_curriculum_code_unique",
      transaction,
    });

    await qi.createTable("curriculum_elective_groups", {
      id: uuid,
      curriculum_id: { type: DataTypes.UUID, allowNull: false, references: { model: "curriculums", key: "id" }, onDelete: "CASCADE" },
      code: { type: DataTypes.STRING(30), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      min_credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      max_credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...ts(),
    }, { transaction });
    await qi.addConstraint("curriculum_elective_groups", {
      fields: ["curriculum_id", "code"],
      type: "unique",
      name: "curriculum_elective_groups_curriculum_code_unique",
      transaction,
    });

    await qi.createTable("curriculum_subjects", {
      id: uuid,
      curriculum_id: { type: DataTypes.UUID, allowNull: false, references: { model: "curriculums", key: "id" }, onDelete: "CASCADE" },
      block_id: { type: DataTypes.UUID, allowNull: false, references: { model: "curriculum_blocks", key: "id" }, onDelete: "CASCADE" },
      elective_group_id: { type: DataTypes.UUID, allowNull: true, references: { model: "curriculum_elective_groups", key: "id" }, onDelete: "SET NULL" },
      subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "CASCADE" },
      is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      credits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...ts(),
    }, { transaction });
    await qi.addConstraint("curriculum_subjects", {
      fields: ["curriculum_id", "subject_id"],
      type: "unique",
      name: "curriculum_subjects_curriculum_subject_unique",
      transaction,
    });
    await qi.addIndex("curriculum_subjects", ["subject_id"], { name: "curriculum_subjects_subject_idx", transaction });
    await qi.addIndex("curriculum_subjects", ["elective_group_id"], { name: "curriculum_subjects_elective_idx", transaction });

    await qi.addColumn("class_groups", "curriculum_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "curriculums", key: "id" },
      onDelete: "SET NULL",
    }, { transaction });
    await qi.addIndex("class_groups", ["curriculum_id"], { name: "class_groups_curriculum_idx", transaction });

    await qi.createTable("class_group_electives", {
      id: uuid,
      class_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
      curriculum_subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "curriculum_subjects", key: "id" }, onDelete: "CASCADE" },
      ...ts(),
    }, { transaction });
    await qi.addConstraint("class_group_electives", {
      fields: ["class_group_id", "curriculum_subject_id"],
      type: "unique",
      name: "class_group_electives_group_subject_unique",
      transaction,
    });

    // ===== CHUYỂN DỮ LIỆU CŨ =====
    // 1) Mỗi (ngành, bậc, khóa) có dữ liệu lớp → một CTĐT.
    await qi.sequelize.query(`
      INSERT INTO curriculums (id, code, name, major_id, program, applicable_from_year, total_credits, active, created_at, updated_at)
      SELECT gen_random_uuid(),
             'CT-' || m.code || '-' || source.academic_year,
             'Chương trình đào tạo ' || m.name || ' - Khóa ' || source.academic_year,
             source.major_id,
             source.program::text::enum_curriculums_program,
             source.academic_year,
             COALESCE((SELECT SUM(CASE WHEN s.is_required THEN s.credits ELSE 0 END) FROM subjects s
                       WHERE s.major_id = source.major_id AND s.program::text = source.program::text), 0),
             TRUE, NOW(), NOW()
      FROM (
        SELECT DISTINCT major_id, program, COALESCE(academic_year, '') AS academic_year
        FROM class_groups
        WHERE major_id IS NOT NULL
      ) AS source
      JOIN majors m ON m.id = source.major_id
    `, { transaction });

    // 2) Khối kiến thức chuẩn cho mọi CTĐT.
    await qi.sequelize.query(`
      INSERT INTO curriculum_blocks (id, curriculum_id, code, name, min_credits, sort_order, created_at, updated_at)
      SELECT gen_random_uuid(), c.id, block.code, block.name, 0, block.sort_order, NOW(), NOW()
      FROM curriculums c
      CROSS JOIN (
        VALUES ('CS', 'Kiến thức cơ sở ngành', 1),
               ('CN', 'Kiến thức chuyên ngành', 2),
               ('TC', 'Học phần tự chọn', 3),
               ('CH', 'Chuyên đề', 4)
      ) AS block(code, name, sort_order)
    `, { transaction });

    // 3) Toàn bộ học phần của ngành/bậc vào CTĐT, xếp theo loại học phần.
    await qi.sequelize.query(`
      INSERT INTO curriculum_subjects
        (id, curriculum_id, block_id, elective_group_id, subject_id, is_required, credits, sort_order, created_at, updated_at)
      SELECT gen_random_uuid(), c.id, b.id, NULL, s.id,
             COALESCE(s.is_required, TRUE), s.credits, COALESCE(s.sort_order, 0), NOW(), NOW()
      FROM curriculums c
      JOIN subjects s ON s.major_id = c.major_id AND s.program::text = c.program::text
      JOIN curriculum_blocks b
        ON b.curriculum_id = c.id
       AND b.code = CASE s.subject_type
                      WHEN 'CS' THEN 'CS' WHEN 'CN' THEN 'CN'
                      WHEN 'TC' THEN 'TC' WHEN 'CH' THEN 'CH'
                      ELSE 'CN'
                    END
    `, { transaction });

    // 4) Học phần tự chọn nằm trong gói chính thức của lớp → phương án tự chọn của lớp đó.
    await qi.sequelize.query(`
      INSERT INTO class_group_electives (id, class_group_id, curriculum_subject_id, created_at, updated_at)
      SELECT DISTINCT gen_random_uuid(), pkg.class_group_id, cs.id, NOW(), NOW()
      FROM subject_packages pkg
      JOIN class_groups cg ON cg.id = pkg.class_group_id
      JOIN subject_package_subjects entry ON entry.package_id = pkg.id
      JOIN curriculums c
        ON c.major_id = cg.major_id AND c.program::text = cg.program::text
       AND c.applicable_from_year = COALESCE(cg.academic_year, '')
      JOIN curriculum_subjects cs ON cs.curriculum_id = c.id AND cs.subject_id = entry.subject_id
      WHERE pkg.is_official = TRUE AND cs.is_required = FALSE
    `, { transaction });

    // 5) Lớp kế thừa CTĐT của ngành + khóa.
    await qi.sequelize.query(`
      UPDATE class_groups cg
      SET curriculum_id = c.id
      FROM curriculums c
      WHERE c.major_id = cg.major_id
        AND c.program::text = cg.program::text
        AND c.applicable_from_year = COALESCE(cg.academic_year, '')
    `, { transaction });

    // ===== LOẠI BỎ MÔ HÌNH "GÓI HỌC PHẦN THEO LỚP" =====
    await qi.dropTable("subject_package_subjects", { transaction });
    await qi.dropTable("subject_packages", { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    // Khôi phục bảng cũ (rỗng) để có thể chạy tiếp các migration trước đó theo chiều down.
    await qi.createTable("subject_packages", {
      id: uuid,
      code: { type: DataTypes.STRING(30), allowNull: false },
      name: { type: DataTypes.STRING(200), allowNull: false },
      class_group_id: { type: DataTypes.UUID, allowNull: false, references: { model: "class_groups", key: "id" }, onDelete: "CASCADE" },
      major_id: { type: DataTypes.UUID, allowNull: true, references: { model: "majors", key: "id" }, onDelete: "SET NULL" },
      total_subjects: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 21 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      is_official: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...ts(),
    }, { transaction });

    await qi.createTable("subject_package_subjects", {
      id: uuid,
      package_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subject_packages", key: "id" }, onDelete: "CASCADE" },
      subject_id: { type: DataTypes.UUID, allowNull: false, references: { model: "subjects", key: "id" }, onDelete: "CASCADE" },
      sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
      ...ts(),
    }, { transaction });

    // Gói chính thức của mỗi lớp = học phần bắt buộc + học phần tự chọn đã chọn.
    await qi.sequelize.query(`
      INSERT INTO subject_packages (id, code, name, class_group_id, major_id, total_subjects, active, is_official, created_at, updated_at)
      SELECT gen_random_uuid(), 'G1-' || cg.code, 'Gói học phần 1', cg.id, cg.major_id, 0, TRUE, TRUE, NOW(), NOW()
      FROM class_groups cg
      WHERE cg.curriculum_id IS NOT NULL
    `, { transaction });

    await qi.sequelize.query(`
      INSERT INTO subject_package_subjects (id, package_id, subject_id, sort_order, created_at, updated_at)
      SELECT gen_random_uuid(), pkg.id, cs.subject_id, COALESCE(cs.sort_order, 0), NOW(), NOW()
      FROM subject_packages pkg
      JOIN class_groups cg ON cg.id = pkg.class_group_id
      JOIN curriculum_subjects cs ON cs.curriculum_id = cg.curriculum_id
      WHERE cs.is_required = TRUE
         OR EXISTS (
           SELECT 1 FROM class_group_electives cge
           WHERE cge.class_group_id = cg.id AND cge.curriculum_subject_id = cs.id
         )
    `, { transaction });

    await qi.sequelize.query(`
      UPDATE subject_packages pkg
      SET total_subjects = (SELECT COUNT(*)::integer FROM subject_package_subjects e WHERE e.package_id = pkg.id)
    `, { transaction });

    await qi.addConstraint("subject_package_subjects", {
      fields: ["package_id", "subject_id"], type: "unique", name: "subject_package_subjects_pkg_subj_unique", transaction,
    });
    await qi.addIndex("subject_package_subjects", ["subject_id"], { name: "subject_package_subjects_subject_idx", transaction });
    await qi.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subject_packages_class_code_unique ON subject_packages (class_group_id, code)
    `, { transaction });
    await qi.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subject_packages_one_official_per_class
      ON subject_packages (class_group_id) WHERE is_official = TRUE
    `, { transaction });

    await qi.sequelize.query(`
      UPDATE class_groups
      SET curriculum_id = NULL
    `, { transaction });
    await qi.removeIndex("class_groups", "class_groups_curriculum_idx", { transaction });
    await qi.removeColumn("class_groups", "curriculum_id", { transaction });

    await qi.dropTable("class_group_electives", { transaction });
    await qi.dropTable("curriculum_subjects", { transaction });
    await qi.dropTable("curriculum_elective_groups", { transaction });
    await qi.dropTable("curriculum_blocks", { transaction });
    await qi.dropTable("curriculums", { transaction });
  });
}
