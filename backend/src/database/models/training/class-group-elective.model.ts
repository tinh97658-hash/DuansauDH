import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { ClassGroup } from "./class-group.model.js";
import { CurriculumSubject } from "../plan/curriculum-subject.model.js";

/**
 * Học phần tự chọn mà Viện chỉ định cho một lớp/nhóm học viên.
 * Cả lớp học chung một danh sách tự chọn, nên lựa chọn này nằm ở cấp lớp.
 */
@Table({ tableName: "class_group_electives", underscored: true, timestamps: true })
export class ClassGroupElective extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: false }) declare classGroupId: string;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @ForeignKey(() => CurriculumSubject) @Column({ type: DataType.UUID, allowNull: false }) declare curriculumSubjectId: string;
  @BelongsTo(() => CurriculumSubject, { foreignKey: "curriculumSubjectId", as: "curriculumSubject" }) declare curriculumSubject: CurriculumSubject;
}
