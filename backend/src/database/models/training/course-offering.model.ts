import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Staff } from "../staff.model.js";
import { Subject } from "../plan/subject.model.js";
import { CourseOfferingClassGroup } from "./course-offering-class-group.model.js";
import { CourseOfferingStudent } from "./course-offering-student.model.js";

@Table({ tableName: "course_offerings", underscored: true, timestamps: true })
export class CourseOffering extends Model {
  @HasMany(() => CourseOfferingStudent) declare individualStudents: CourseOfferingStudent[];
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;

  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare subjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "subjectId", as: "subject" }) declare subject: Subject;

  @Column({ type: DataType.STRING(255), allowNull: true }) declare name: string | null;

  @Default("active")
  @Column({ type: DataType.ENUM("active", "completed"), allowNull: false })
  declare status: "active" | "completed";

  @Column({ type: DataType.DATE, allowNull: true }) declare completedAt: Date | null;

  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare completedByStaffId: string | null;
  @BelongsTo(() => Staff, { foreignKey: "completedByStaffId", as: "completedBy" }) declare completedBy: Staff | null;

  @Column(DataType.TEXT) declare note: string | null;
  @Default([]) @Column({ type: DataType.JSONB, allowNull: false })
  declare participantNotes: Array<{ participantId: string; note: string }>;
  @Default([1, 2, 3, 4, 5, 6, 0]) @Column({ type: DataType.ARRAY(DataType.INTEGER), allowNull: false }) declare retakeWeekdays: number[];
  @Column({ type: DataType.VIRTUAL }) declare allowedWeekdays: number[];

  @Column({ type: DataType.VIRTUAL }) declare participantCount: number;
  @Column({ type: DataType.VIRTUAL }) declare sessionSummary: {
    totalCount: number;
    heldCount: number;
    notHeldCount: number;
    plannedCount: number;
    pendingCount: number;
    futurePlannedCount: number;
    firstPlannedSessionDate: string | null;
  };

  @HasMany(() => CourseOfferingClassGroup, { foreignKey: "courseOfferingId", as: "groupLinks" })
  declare groupLinks: CourseOfferingClassGroup[];
}
