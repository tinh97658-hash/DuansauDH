/**
 * 060 — BỔ SUNG CÁC CHỈ MỤC HIỆU NĂNG CHO POSTGRESQL (PHASE 2 PERFORMANCE INDEXES)
 *
 * 1. admission_records:
 *    - student_id: Khóa ngoại nối với students và correlated subquery trong learnerStudyStatusSql.
 *    - (training_level, academic_year, status): Bộ lọc phân trang và thống kê số lượng học viên.
 *    - major_id: Bộ lọc ngành và đếm theo ngành.
 *    - code, id_card: Tăng tốc độ tìm kiếm theo mã học viên / CCCD.
 *
 * 2. course_exam_gradebooks:
 *    - course_offering_id: Hỗ trợ truy vấn tra cứu điểm theo lớp học phần hoàn thành.
 *    - grades (GIN index): Tăng tốc xử lý mảng JSONB trong LATERAL JOIN.
 *
 * 3. curriculum_subjects:
 *    - (curriculum_id, sort_order): Tải cây học phần của CTĐT theo thứ tự chuẩn.
 *    - subject_id: Tra cứu ngược học phần thuộc CTĐT nào khi cập nhật số tín chỉ.
 */
export async function up({ context: qi }: any) {
  // 1. Chỉ mục bảng admission_records
  await qi.sequelize.query(`
    CREATE INDEX IF NOT EXISTS admission_records_student_id_idx ON admission_records (student_id);
    CREATE INDEX IF NOT EXISTS admission_records_filter_idx ON admission_records (training_level, academic_year, status);
    CREATE INDEX IF NOT EXISTS admission_records_major_id_idx ON admission_records (major_id);
    CREATE INDEX IF NOT EXISTS admission_records_code_idx ON admission_records (code);
    CREATE INDEX IF NOT EXISTS admission_records_id_card_idx ON admission_records (id_card);
  `);

  // 2. Chỉ mục bảng course_exam_gradebooks
  await qi.sequelize.query(`
    CREATE INDEX IF NOT EXISTS course_exam_gradebooks_offering_idx ON course_exam_gradebooks (course_offering_id);
    CREATE INDEX IF NOT EXISTS course_exam_gradebooks_grades_gin_idx ON course_exam_gradebooks USING gin (grades);
  `);

  // 3. Chỉ mục bảng curriculum_subjects
  await qi.sequelize.query(`
    CREATE INDEX IF NOT EXISTS curriculum_subjects_curriculum_idx ON curriculum_subjects (curriculum_id, sort_order);
    CREATE INDEX IF NOT EXISTS curriculum_subjects_subject_idx ON curriculum_subjects (subject_id);
  `);
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query(`
    DROP INDEX IF EXISTS admission_records_student_id_idx;
    DROP INDEX IF EXISTS admission_records_filter_idx;
    DROP INDEX IF EXISTS admission_records_major_id_idx;
    DROP INDEX IF EXISTS admission_records_code_idx;
    DROP INDEX IF EXISTS admission_records_id_card_idx;
    DROP INDEX IF EXISTS course_exam_gradebooks_offering_idx;
    DROP INDEX IF EXISTS course_exam_gradebooks_grades_gin_idx;
    DROP INDEX IF EXISTS curriculum_subjects_curriculum_idx;
    DROP INDEX IF EXISTS curriculum_subjects_subject_idx;
  `);
}
