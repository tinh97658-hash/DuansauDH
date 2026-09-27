import { QueryInterface } from "sequelize";

/**
 * 008 — VIEW BÁO CÁO (danh mục BÁO CÁO).
 * Báo cáo chuẩn production dùng database view tổng hợp từ dữ liệu có sẵn.
 */
export async function up({ context: queryInterface }: any) {
  const qi = queryInterface as QueryInterface;
  const q = (sql: string) => qi.sequelize.query(sql);

  // Danh sách lớp: nhóm học phần + thành viên + thông tin học viên
  await q(`
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
  `);

  // Bảng điểm tạm thời Thạc sĩ
  await q(`
    CREATE VIEW v_temp_score_masters AS
    SELECT
      es.id AS session_id, es.code AS session_code, es.name AS session_name,
      cg.id AS class_group_id, cg.name AS class_name,
      s.id AS student_id, s.full_name, s.reg_no,
      er.score, er.grade, er.result,
      er.created_at AS recorded_at
    FROM exam_sessions es
    LEFT JOIN class_groups cg ON cg.id = es.class_group_id
    LEFT JOIN exam_results er ON er.session_id = es.id
    LEFT JOIN students s ON s.id = er.student_id
    WHERE es.program = 'masters'
  `);

  // Bảng điểm tạm thời Tiến sĩ
  await q(`
    CREATE VIEW v_temp_score_doctoral AS
    SELECT
      es.id AS session_id, es.code AS session_code, es.name AS session_name,
      cg.id AS class_group_id, cg.name AS class_name,
      s.id AS student_id, s.full_name, s.reg_no,
      er.score, er.grade, er.result,
      er.created_at AS recorded_at
    FROM exam_sessions es
    LEFT JOIN class_groups cg ON cg.id = es.class_group_id
    LEFT JOIN exam_results er ON er.session_id = es.id
    LEFT JOIN students s ON s.id = er.student_id
    WHERE es.program = 'doctoral'
  `);

  // Tổng hợp hồ sơ tốt nghiệp (thạc sĩ + tiến sĩ)
  await q(`
    CREATE VIEW v_graduation_summary AS
    SELECT
      s.id AS student_id, s.full_name, s.reg_no, s.email, s.degree,
      gd.id AS defense_id, gd.thesis_title, gd.defense_date, gd.result AS defense_result,
      gr.status AS record_status, gr.submitted_at, gr.approved_at
    FROM students s
    LEFT JOIN graduation_defenses gd ON gd.student_id = s.id
    LEFT JOIN graduation_records gr ON gr.student_id = s.id
  `);
}

export async function down({ context: queryInterface }: any) {
  const qi = queryInterface as QueryInterface;
  for (const view of ["v_class_lists", "v_temp_score_masters", "v_temp_score_doctoral", "v_graduation_summary"]) {
    await qi.sequelize.query(`DROP VIEW IF EXISTS ${view}`);
  }
}
