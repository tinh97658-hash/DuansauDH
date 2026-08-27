import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { ClassGroup } from "./class-group.model.js";
import { ExamSession } from "./exam-session.model.js";
import { Staff } from "../staff.model.js";

@Table({ tableName: "exam_eligibilities", underscored: true, timestamps: true })
export class ExamEligibility extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: true }) declare classGroupId: string | null;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @ForeignKey(() => ExamSession) @Column({ type: DataType.UUID, allowNull: true }) declare sessionId: string | null;
  @BelongsTo(() => ExamSession) declare session: any;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare eligible: boolean;
  @ForeignKey(() => Staff) @Column({ type: DataType.UUID, allowNull: true }) declare decidedBy: string | null;
  @BelongsTo(() => Staff) declare decider: any;
  @Column(DataType.DATE) declare decidedAt: Date | null;
  @Column(DataType.TEXT) declare note: string | null;
}
