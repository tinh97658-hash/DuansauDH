import { Column, DataType, Default, HasMany, Model, Table } from "sequelize-typescript";
import { EnglishExamScore } from "./english-exam-score.model.js";

@Table({ tableName: "english_exam_sessions", underscored: true, timestamps: true })
export class EnglishExamSession extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Column(DataType.DATEONLY) declare examDate: string | null;
  @Default("scheduled") @Column({ type: DataType.ENUM("scheduled", "completed", "cancelled"), allowNull: false }) declare status: string;
  @Column(DataType.TEXT) declare note: string | null;
  @HasMany(() => EnglishExamScore) declare scores: EnglishExamScore[];
}
