import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { Subject } from "./subject.model.js";
import { SubjectPackage } from "./subject-package.model.js";

@Table({ tableName: "subject_package_subjects", underscored: true, timestamps: true })
export class SubjectPackageSubject extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => SubjectPackage) @Column({ type: DataType.UUID, allowNull: false }) declare packageId: string;
  @BelongsTo(() => SubjectPackage, { foreignKey: "packageId", as: "subjectPackage" }) declare subjectPackage: any;
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare subjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "subjectId", as: "subject" }) declare subject: any;
  @Default(0) @Column(DataType.INTEGER) declare sortOrder: number;
}
