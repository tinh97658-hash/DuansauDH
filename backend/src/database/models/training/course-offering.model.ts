import { CourseOfferingParticipant } from "./course-offering-participant.model.js";
import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Staff } from "../staff.model.js";
import { Subject } from "../plan/subject.model.js";
import { CourseOfferingClassGroup } from "./course-offering-class-group.model.js";

@Table({ tableName: "course_offerings", underscored: true, timestamps: true })
export class CourseOffering extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;

  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare subjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "subjectId", as: "subject" }) declare subject: Subject;

  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column({ type: DataType.INTEGER, allowNull: true }) declare plannedUnits: number | null;
  @Column({ type: DataType.STRING(10), allowNull: true }) declare unitType: "hours" | "periods" | null;

  @Default("active")
  @Column({ type: DataType.ENUM("active", "completed"), allowNull: false })
  declare status: "active" | "completed";

  @Column({ type: DataType.DATE, allowNull: true }) declare completedAt: Date | null;

  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare completedByStaffId: string | null;
  @BelongsTo(() => Staff, { foreignKey: "completedByStaffId", as: "completedBy" }) declare completedBy: Staff | null;

  @Column(DataType.TEXT) declare note: string | null;

  @Column({ type: DataType.VIRTUAL }) declare participantCount: number;
  @Column({ type: DataType.VIRTUAL }) declare sessionSummary: {
    totalCount: number;
    unscheduledCount: number;
    heldCount: number;
    notHeldCount: number;
    plannedCount: number;
    pendingCount: number;
    futurePlannedCount: number;
    firstPlannedSessionDate: string | null;
  };

  @HasMany(() => CourseOfferingParticipant, { foreignKey: "courseOfferingId", as: "participants" })
  declare participants: CourseOfferingParticipant[];

  @HasMany(() => CourseOfferingClassGroup, { foreignKey: "courseOfferingId", as: "groupLinks" })
  declare groupLinks: CourseOfferingClassGroup[];
}
