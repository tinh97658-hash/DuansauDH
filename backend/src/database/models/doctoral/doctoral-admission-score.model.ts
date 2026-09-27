import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";

@Table({ tableName: "doctoral_admission_scores", underscored: true, timestamps: true })
export class DoctoralAdmissionScore extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: true }) declare studentId: string | null;
  @BelongsTo(() => Student) declare student: any;
  @Column({ type: DataType.STRING(120), allowNull: false }) declare subject: string;
  @Column({ type: DataType.DECIMAL(5, 2), allowNull: false }) declare score: number;
  @Default(10) @Column({ type: DataType.DECIMAL(5, 2), allowNull: false }) declare maxScore: number;
  @Column(DataType.TEXT) declare note: string | null;
}
