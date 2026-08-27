import { DataTypes, Op } from "sequelize";

export async function up({ context: queryInterface }: any) {
  await queryInterface.createTable("students", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name_with_initials: { type: DataTypes.STRING, allowNull: false },
    full_name: { type: DataTypes.STRING, allowNull: false },
    postal_address: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    tel_no: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("admin", "student", "supervisor"), allowNull: false, defaultValue: "student" },
    account_type: { type: DataTypes.ENUM("prospective", "registered"), allowNull: false },
    approval_state: { type: DataTypes.ENUM("approved", "not approved"), allowNull: false, defaultValue: "not approved" },
    registered_date: { type: DataTypes.DATE },
    reg_no: { type: DataTypes.STRING, allowNull: false, defaultValue: "Not Set" },
    date_of_registration: { type: DataTypes.DATE },
    degree: { type: DataTypes.ENUM("phd", "mphill", "msc", "meng", "provisional") },
    study_mode: { type: DataTypes.ENUM("fullTime", "partTime", "Not Set"), allowNull: false, defaultValue: "Not Set" },
    research_area: { type: DataTypes.TEXT },
    research_program: { type: DataTypes.STRING },
    completion_year: { type: DataTypes.INTEGER },
    progress_level: { type: DataTypes.ENUM("halfYearReportSubmitted", "annualProgressReportSubmitted", "annualOralPresentationSubmitted", "vivaCompleted", "thesisSubmittedForReview", "finalThesisSubmitted") },
    date_of_last_submission: { type: DataTypes.DATE },
    website_url: { type: DataTypes.TEXT },
    password_reset_token: { type: DataTypes.STRING },
    password_reset_expires: { type: DataTypes.DATE },
    photo: { type: DataTypes.STRING },
    document_path: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex("students", [queryInterface.sequelize.fn("lower", queryInterface.sequelize.col("email"))], { name: "students_email_lower_unique", unique: true });
  await queryInterface.addIndex("students", ["approval_state"], { name: "students_approval_state_idx" });

  await queryInterface.createTable("staff", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM("admin", "supervisor", "examiner"), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex("staff", [queryInterface.sequelize.fn("lower", queryInterface.sequelize.col("email"))], { name: "staff_email_lower_unique", unique: true });
  await queryInterface.addIndex("staff", ["role"], { name: "staff_role_idx" });

  await queryInterface.createTable("staff_students", {
    staff_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, references: { model: "staff", key: "id" }, onDelete: "CASCADE" },
    student_id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex("staff_students", ["student_id"], { name: "staff_students_student_idx" });

  await queryInterface.createTable("submissions", {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    student_id: { type: DataTypes.UUID, allowNull: false, references: { model: "students", key: "id" }, onDelete: "CASCADE" },
    submission_number: { type: DataTypes.SMALLINT, allowNull: false },
    file_name: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addConstraint("submissions", { fields: ["student_id", "submission_number"], type: "unique", name: "submissions_student_number_unique" });
  await queryInterface.addConstraint("submissions", { fields: ["submission_number"], type: "check", where: { submission_number: { [Op.between]: [1, 7] } }, name: "submissions_number_range" });
}

export async function down({ context: queryInterface }: any) {
  await queryInterface.dropTable("submissions");
  await queryInterface.dropTable("staff_students");
  await queryInterface.dropTable("staff");
  await queryInterface.dropTable("students");
  for (const type of ["progress_level", "study_mode", "degree", "approval_state", "account_type", "role"]) {
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_students_${type}"`);
  }
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_staff_role"');
}
