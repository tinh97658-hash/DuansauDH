import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Subject } from "./subject.model.js";
import { Curriculum } from "./curriculum.model.js";
import { CurriculumBlock } from "./curriculum-block.model.js";
import { CurriculumElectiveGroup } from "./curriculum-elective-group.model.js";

/**
 * Một học phần nằm trong CTĐT: thuộc khối kiến thức nào, bắt buộc hay tự chọn,
 * thuộc nhóm tự chọn nào, và số tín chỉ ghi trong CTĐT.
 */
@Table({ tableName: "curriculum_subjects", underscored: true, timestamps: true })
export class CurriculumSubject extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => Curriculum) @Column({ type: DataType.UUID, allowNull: false }) declare curriculumId: string;
  @BelongsTo(() => Curriculum) declare curriculum: any;
  @ForeignKey(() => CurriculumBlock) @Column({ type: DataType.UUID, allowNull: false }) declare blockId: string;
  @BelongsTo(() => CurriculumBlock, { foreignKey: "blockId", as: "block" }) declare block: any;
  @ForeignKey(() => CurriculumElectiveGroup) @Column({ type: DataType.UUID, allowNull: true }) declare electiveGroupId: string | null;
  @BelongsTo(() => CurriculumElectiveGroup, { foreignKey: "electiveGroupId", as: "electiveGroup" }) declare electiveGroup: any;
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare subjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "subjectId", as: "subject" }) declare subject: Subject;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isRequired: boolean;
  @Default(3) @Column({ type: DataType.INTEGER, allowNull: false }) declare credits: number;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare sortOrder: number;
}
