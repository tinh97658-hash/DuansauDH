import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Student } from "../student.model.js";
import { GraduationDefense } from "./graduation-defense.model.js";

@Table({ tableName: "graduation_records", underscored: true, timestamps: true })
export class GraduationRecord extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: false }) declare studentId: string;
  @BelongsTo(() => Student) declare student: any;
  @ForeignKey(() => GraduationDefense) @Column({ type: DataType.UUID, allowNull: true }) declare defenseId: string | null;
  @BelongsTo(() => GraduationDefense) declare defense: any;
  @Default("in_progress") @Column({ type: DataType.ENUM("in_progress", "submitted", "approved"), allowNull: false }) declare status: string;
  @Column(DataType.DATE) declare submittedAt: Date | null;
  @Column(DataType.DATE) declare approvedAt: Date | null;
  @Column(DataType.TEXT) declare note: string | null;
}
