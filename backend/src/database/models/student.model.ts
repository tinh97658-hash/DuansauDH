import {
  BelongsToMany,
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  Table,
} from "sequelize-typescript";
import { StaffStudent } from "./staff-student.model.js";
import { Staff } from "./staff.model.js";
import { Submission } from "./submission.model.js";

@Table({ tableName: "students", underscored: true, timestamps: true })
export class Student extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.STRING, allowNull: false, field: "name_with_initials" }) declare nameWithInitials: string;
  @Column({ type: DataType.STRING, allowNull: false, field: "full_name" }) declare fullName: string;
  @Column({ type: DataType.TEXT, allowNull: false, field: "postal_address" }) declare postalAddress: string;
  @Column({ type: DataType.STRING, allowNull: false }) declare email: string;
  @Column({ type: DataType.STRING, allowNull: false, field: "tel_no" }) declare telNo: string;
  @Column({ type: DataType.STRING, allowNull: false }) declare password: string;
  @Default("student")
  @Column(DataType.ENUM("admin", "student", "supervisor")) declare role: string;
  @Column({ type: DataType.ENUM("prospective", "registered"), allowNull: false, field: "account_type" }) declare accountType: string;
  @Default("not approved")
  @Column({ type: DataType.ENUM("approved", "not approved"), field: "approval_state" }) declare approvalState: string;
  @Column({ type: DataType.DATE, field: "registered_date" }) declare registeredDate: Date | null;
  @Default("Not Set")
  @Column({ type: DataType.STRING, field: "reg_no" }) declare regNo: string;
  @Column({ type: DataType.DATE, field: "date_of_registration" }) declare dateOfRegistration: Date | null;
  @Column(DataType.STRING) declare degree: string | null;
  @Default("Not Set")
  @Column({ type: DataType.STRING, field: "study_mode" }) declare studyMode: string;
  @Column({ type: DataType.TEXT, field: "research_area" }) declare researchArea: string | null;
  @Column({ type: DataType.STRING, field: "research_program" }) declare researchProgram: string | null;
  @Column({ type: DataType.INTEGER, field: "completion_year" }) declare completionYear: number | null;
  @Column({ type: DataType.STRING, field: "progress_level" }) declare progressLevel: string | null;
  @Column({ type: DataType.DATE, field: "date_of_last_submission" }) declare dateOfLastSubmission: Date | null;
  @Column({ type: DataType.TEXT, field: "website_url" }) declare websiteUrl: string | null;
  @Column({ type: DataType.STRING, field: "password_reset_token" }) declare passwordResetToken: string | null;
  @Column({ type: DataType.DATE, field: "password_reset_expires" }) declare passwordResetExpires: Date | null;
  @Column(DataType.STRING) declare photo: string | null;
  @Column({ type: DataType.STRING, field: "document_path" }) declare documentPath: string | null;

  @BelongsToMany(() => Staff, () => StaffStudent)
  declare supervisors: Staff[];

  @HasMany(() => Submission)
  declare submissions: Submission[];
}
