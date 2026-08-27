import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { ClassGroup } from "./class-group.model.js";
import { Student } from "../student.model.js";
import { AdmissionRecord } from "../plan/admission-record.model.js";

@Table({ tableName: "class_group_members", underscored: true, timestamps: true })
export class ClassGroupMember extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => ClassGroup) @Column({ type: DataType.UUID, allowNull: false }) declare classGroupId: string;
  @BelongsTo(() => ClassGroup) declare classGroup: any;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: true }) declare studentId: string | null;
  @BelongsTo(() => Student) declare student: any;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: true }) declare admissionRecordId: string | null;
  @BelongsTo(() => AdmissionRecord) declare admissionRecord: any;
  @Default(DataType.NOW) @Column({ type: DataType.DATE }) declare enrolledAt: Date;
  @Column(DataType.TEXT) declare note: string | null;
}
