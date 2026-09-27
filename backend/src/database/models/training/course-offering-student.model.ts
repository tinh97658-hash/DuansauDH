import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { CourseOffering } from "./course-offering.model.js";
import { AdmissionRecord } from "../plan/admission-record.model.js";

@Table({ tableName: "course_offering_students", underscored: true, timestamps: true })
export class CourseOfferingStudent extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => CourseOffering) @Column({ type: DataType.UUID, allowNull: false }) declare courseOfferingId: string;
  @BelongsTo(() => CourseOffering) declare courseOffering: any;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false }) declare admissionRecordId: string;
  @BelongsTo(() => AdmissionRecord) declare admissionRecord: AdmissionRecord;
}
