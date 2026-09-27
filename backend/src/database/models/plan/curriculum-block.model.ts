import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Curriculum } from "./curriculum.model.js";
import { CurriculumSubject } from "./curriculum-subject.model.js";

/** Khối kiến thức trong một CTĐT (cơ sở ngành, chuyên ngành, tự chọn, chuyên đề…). */
@Table({ tableName: "curriculum_blocks", underscored: true, timestamps: true })
export class CurriculumBlock extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Curriculum) @Column({ type: DataType.UUID, allowNull: false }) declare curriculumId: string;
  @BelongsTo(() => Curriculum) declare curriculum: any;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare minCredits: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare sortOrder: number;

  @HasMany(() => CurriculumSubject, { foreignKey: "blockId", as: "subjectEntries" }) declare subjectEntries: CurriculumSubject[];
}
