import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "../common/major.model.js";
import { ClassGroup } from "../training/class-group.model.js";
import { SubjectPackageSubject } from "./subject-package-subject.model.js";

@Table({ tableName: "subject_packages", underscored: true, timestamps: true })
export class SubjectPackage extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare code: string;
  @Column({ type: DataType.STRING(200), allowNull: false }) declare name: string;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: false }) declare classGroupId: string;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: true }) declare majorId: string | null;
  @BelongsTo(() => Major) declare major: any;
  @Default(21) @Column({ type: DataType.INTEGER, allowNull: false }) declare totalSubjects: number;
  @Default(true) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare active: boolean;
  @Default(false) @Column({ type: DataType.BOOLEAN, allowNull: false }) declare isOfficial: boolean;
  @HasMany(() => SubjectPackageSubject, { foreignKey: "packageId", as: "entries" }) declare entries: SubjectPackageSubject[];
}
