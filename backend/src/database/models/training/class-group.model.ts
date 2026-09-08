import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "../common/major.model.js";
import { ClassGroupMember } from "./class-group-member.model.js";
import { SubjectPackage } from "../plan/subject-package.model.js";

@Table({ tableName: "class_groups", underscored: true, timestamps: true })
export class ClassGroup extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.ENUM("masters", "doctoral"), allowNull: false }) declare program: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: true }) declare majorId: string | null;
  @BelongsTo(() => Major) declare major: any;
  @Column(DataType.STRING(20)) declare academicYear: string | null;
  @Column(DataType.STRING(20)) declare term: string | null;
  @Default(40) @Column({ type: DataType.INTEGER, allowNull: false }) declare maxStudents: number;
  @Default("open") @Column({ type: DataType.ENUM("open", "closed"), allowNull: false }) declare status: string;
  @Column(DataType.TEXT) declare note: string | null;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: true }) declare parentGroupId: string | null;
  @BelongsTo(() => ClassGroup, { foreignKey: "parentGroupId", as: "parentGroup" }) declare parentGroup: ClassGroup | null;
  @HasMany(() => ClassGroup, { foreignKey: "parentGroupId", as: "classes" }) declare classes: ClassGroup[];
  @HasMany(() => ClassGroupMember) declare members: ClassGroupMember[];
  @HasMany(() => SubjectPackage) declare packages: SubjectPackage[];
}
