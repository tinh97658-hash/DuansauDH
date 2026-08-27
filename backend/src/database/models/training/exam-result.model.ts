import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { ClassGroup } from "./class-group.model.js";
import { ExamSession } from "./exam-session.model.js";

@Table({ tableName: "exam_results", underscored: true, timestamps: true })
export class ExamResult extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @ForeignKey(() => ExamSession) @Column({ type: DataType.UUID, allowNull: false }) declare sessionId: string;
  @BelongsTo(() => ExamSession) declare session: any;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: true }) declare classGroupId: string | null;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @Column(DataType.DECIMAL(5, 2)) declare score: number | null;
  @Column(DataType.STRING(10)) declare grade: string | null;
  @Default("failed") @Column({ type: DataType.ENUM("passed", "failed"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare note: string | null;
}
