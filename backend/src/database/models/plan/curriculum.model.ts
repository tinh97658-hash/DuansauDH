import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "../common/major.model.js";
import { CurriculumBlock } from "./curriculum-block.model.js";
import { CurriculumElectiveGroup } from "./curriculum-elective-group.model.js";
import { CurriculumSubject } from "./curriculum-subject.model.js";

/**
 * Chương trình đào tạo (CTĐT) của một ngành + bậc + khóa áp dụng.
 * Mỗi lớp/nhóm học viên kế thừa đúng một CTĐT theo ngành và khóa của mình.
 */
@Table({ tableName: "curriculums", underscored: true, timestamps: true })
export class Curriculum extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(60), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: false }) declare majorId: string;
  @BelongsTo(() => Major) declare major: any;
  @Column({ type: DataType.ENUM("masters", "doctoral"), allowNull: false }) declare program: string;
  @Column({ type: DataType.STRING(20), allowNull: false }) declare applicableFromYear: string;
  @Default(0) @Column({ type: DataType.INTEGER, allowNull: false }) declare totalCredits: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
  @Column(DataType.TEXT) declare note: string | null;

  @HasMany(() => CurriculumBlock, { foreignKey: "curriculumId", as: "blocks" }) declare blocks: CurriculumBlock[];
  @HasMany(() => CurriculumElectiveGroup, { foreignKey: "curriculumId", as: "electiveGroups" }) declare electiveGroups: CurriculumElectiveGroup[];
  @HasMany(() => CurriculumSubject, { foreignKey: "curriculumId", as: "subjectEntries" }) declare subjectEntries: CurriculumSubject[];
}
