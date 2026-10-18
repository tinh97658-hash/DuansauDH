/** Nhãn hiển thị dùng chung cho module tài khoản & phân quyền. */

export const ROLE_LABELS = {
  admin: "Quản trị hệ thống",
  supervisor: "Giảng viên hướng dẫn",
  examiner: "Giám khảo chấm thi",
  student: "Học viên",
};

export const ACCOUNT_STATUS_LABELS = {
  active: "Đang hoạt động",
  disabled: "Đã khóa",
};

export const AUDIT_ACTION_LABELS = {
  "account.create": "Tạo tài khoản",
  "account.update": "Cập nhật tài khoản",
  "account.disable": "Khóa tài khoản",
  "account.enable": "Mở khóa tài khoản",
  "account.password.reset": "Đặt lại mật khẩu",
  "account.password.change": "Đổi mật khẩu",
  "account.sessions.revoke": "Buộc đăng xuất",
  "role.create": "Tạo vai trò",
  "role.update": "Cập nhật vai trò",
  "role.permissions.update": "Cập nhật quyền vai trò",
  "role.delete": "Xóa vai trò",
};

export const roleLabel = (code, name) => name || ROLE_LABELS[code] || code || "—";

export const auditActionLabel = (action) => AUDIT_ACTION_LABELS[action] || action || "—";

/** Nhãn thao tác cho nhật ký thay đổi dữ liệu. */
export const CHANGE_OPERATION_LABELS = {
  INSERT: "Thêm mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
};

/** Nhãn tiếng Việt cho tên bảng nghiệp vụ. */
export const TABLE_LABELS = {
  staff: "Nhân sự",
  roles: "Vai trò",
  permissions: "Quyền",
  role_permissions: "Quyền của vai trò",
  staff_roles: "Vai trò của nhân sự",
  auth_audit_logs: "Nhật ký thao tác",
  db_change_logs: "Nhật ký thay đổi dữ liệu",
  students: "Học viên",
  staff_students: "Phân công nhân sự - học viên",
  submissions: "Bài nộp",
  units: "Đơn vị",
  lecturers: "Giảng viên",
  rooms: "Phòng học",
  majors: "Ngành",
  disciplines: "Bộ môn",
  training_programs: "Chương trình đào tạo",
  training_levels: "Trình độ đào tạo",
  training_modes: "Hình thức đào tạo",
  training_mode_groups: "Nhóm hình thức đào tạo",
  study_statuses: "Trạng thái học tập",
  ethnicities: "Dân tộc",
  nationalities: "Quốc tịch",
  cities: "Tỉnh/Thành phố",
  districts: "Quận/Huyện",
  wards: "Phường/Xã",
  bridge_knowledge_subjects: "Học phần bổ túc kiến thức",
  training_plans: "Kế hoạch đào tạo",
  admission_targets: "Chỉ tiêu tuyển sinh",
  annual_fees: "Học phí theo năm",
  admission_records: "Hồ sơ tuyển sinh",
  admission_rounds: "Đợt tuyển sinh",
  admission_evaluations: "Đánh giá xét tuyển",
  admission_evaluation_history: "Lịch sử đánh giá xét tuyển",
  subjects: "Học phần",
  curriculums: "Chương trình khung",
  curriculum_blocks: "Khối kiến thức",
  curriculum_elective_groups: "Nhóm tự chọn",
  curriculum_subjects: "Học phần trong CTĐT",
  class_groups: "Lớp học phần",
  class_group_members: "Thành viên lớp",
  class_group_electives: "Lớp tự chọn",
  class_membership_history: "Lịch sử thành viên lớp",
  course_offerings: "Lớp học phần mở",
  course_offering_class_groups: "Lớp học phần - nhóm lớp",
  course_offering_students: "Học viên lớp học phần",
  course_offering_withdrawals: "Rút học phần",
  major_transfers: "Chuyển ngành",
  subject_recognitions: "Công nhận học phần",
  learner_subject_results: "Kết quả học phần",
  learner_transcript_issues: "Vấn đề bảng điểm",
  teaching_sessions: "Buổi giảng dạy",
  scheduling_retakes: "Lịch thi lại",
  exam_sessions: "Ca thi",
  exam_eligibilities: "Điều kiện dự thi",
  exam_results: "Kết quả thi",
  exam_pass_conditions: "Điều kiện đạt",
  course_exam_gradebooks: "Bảng điểm thi",
  course_grading_policies: "Quy chế chấm điểm học phần",
  shared_grading_rules: "Quy tắc chấm điểm dùng chung",
  gradebook_events: "Sự kiện bảng điểm",
  masters_admission_scores: "Điểm xét tuyển Thạc sĩ",
  english_exam_sessions: "Ca thi tiếng Anh",
  english_exam_scores: "Điểm thi tiếng Anh",
  english_certifications: "Chứng chỉ tiếng Anh",
  graduation_defenses: "Bảo vệ tốt nghiệp",
  graduation_records: "Hồ sơ tốt nghiệp",
  doctoral_admission_scores: "Điểm xét tuyển Tiến sĩ",
  doctoral_thesis_topics: "Đề tài luận án",
  doctoral_workshops: "Chuyên đề Tiến sĩ",
  doctoral_defenses: "Bảo vệ luận án",
  doctoral_reviews: "Phản biện luận án",
  study_leaves: "Bảo lưu",
  sessions: "Phiên đăng nhập",
  sequelize_meta: "Metadata migration",
};

export const changeOperationLabel = (operation) => CHANGE_OPERATION_LABELS[operation] || operation || "—";

export const tableLabel = (name) => TABLE_LABELS[name] || name || "—";
