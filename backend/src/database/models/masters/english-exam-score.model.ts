import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { EnglishExamSession } from "./english-exam-session.model.js";

@Table({ tableName: "english_exam_scores", underscored: true, timestamps: true })
export class EnglishExamScore extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => EnglishExamSession) @Column({ type: DataType.UUID, allowNull: false }) declare sessionId: string;
  @BelongsTo(() => EnglishExamSession) declare session: any;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @Column(DataType.DECIMAL(5, 2)) declare score: number | null;
  @Default("failed") @Column({ type: DataType.ENUM("passed", "failed"), allowNull: false }) declare result: string;
  @Column(DataType.TEXT) declare note: string | null;
}
