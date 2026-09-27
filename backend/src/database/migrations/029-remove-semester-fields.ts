export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query("DROP VIEW IF EXISTS v_class_lists", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS training_plans DROP COLUMN IF EXISTS semester", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS class_groups DROP COLUMN IF EXISTS term", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS masters_bridge_courses DROP COLUMN IF EXISTS term", { transaction });
    await qi.sequelize.query(`
      CREATE VIEW v_class_lists AS
      SELECT
        cg.id AS class_group_id, cg.program, cg.code AS class_code, cg.name AS class_name,
        cg.academic_year, cg.status AS class_status,
        m.name AS major_name,
        cgm.id AS member_id, s.id AS student_id,
        s.full_name, s.reg_no, s.email, s.study_mode
      FROM class_groups cg
      LEFT JOIN majors m ON m.id = cg.major_id
      LEFT JOIN class_group_members cgm ON cgm.class_group_id = cg.id
      LEFT JOIN students s ON s.id = cgm.student_id
    `, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query("DROP VIEW IF EXISTS v_class_lists", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS training_plans ADD COLUMN IF NOT EXISTS semester VARCHAR(20)", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS class_groups ADD COLUMN IF NOT EXISTS term VARCHAR(20)", { transaction });
    await qi.sequelize.query("ALTER TABLE IF EXISTS masters_bridge_courses ADD COLUMN IF NOT EXISTS term VARCHAR(20) NOT NULL DEFAULT 'HK1'", { transaction });
    await qi.sequelize.query(`
      CREATE VIEW v_class_lists AS
      SELECT
        cg.id AS class_group_id, cg.program, cg.code AS class_code, cg.name AS class_name,
        cg.academic_year, cg.term, cg.status AS class_status,
        m.name AS major_name,
        cgm.id AS member_id, s.id AS student_id,
        s.full_name, s.reg_no, s.email, s.study_mode
      FROM class_groups cg
      LEFT JOIN majors m ON m.id = cg.major_id
      LEFT JOIN class_group_members cgm ON cgm.class_group_id = cg.id
      LEFT JOIN students s ON s.id = cgm.student_id
    `, { transaction });
  });
}
