import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { ClassGroup } from "./class-group.model.js";
import { ExamResult } from "./exam-result.model.js";
import { ExamEligibility } from "./exam-eligibility.model.js";

@Table({ tableName: "exam_sessions", underscored: true, timestamps: true })
export class ExamSession extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.ENUM("masters", "doctoral"), allowNull: false }) declare program: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: true }) declare classGroupId: string | null;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @Default("final") @Column({ type: DataType.STRING(50), allowNull: false }) declare examType: string;
  @Column(DataType.DATEONLY) declare examDate: string | null;
  @Default("scheduled") @Column({ type: DataType.ENUM("scheduled", "completed", "cancelled"), allowNull: false }) declare status: string;
  @Column(DataType.TEXT) declare note: string | null;
  @HasMany(() => ExamResult) declare results: ExamResult[];
  @HasMany(() => ExamEligibility) declare eligibilities: ExamEligibility[];
}
