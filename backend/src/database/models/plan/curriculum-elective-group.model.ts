import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Curriculum } from "./curriculum.model.js";

/**
 * Nhóm học phần tự chọn trong CTĐT (ví dụ: "Chọn 2 trong 5 học phần").
 * `minCredits` là số tín chỉ tối thiểu học viên phải tích lũy trong nhóm.
 */
@Table({ tableName: "curriculum_elective_groups", underscored: true, timestamps: true })
export class CurriculumElectiveGroup extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Curriculum) @Column({ type: DataType.UUID, allowNull: false }) declare curriculumId: string;
  @BelongsTo(() => Curriculum) declare curriculum: any;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare minCredits: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare maxCredits: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare sortOrder: number;
}
