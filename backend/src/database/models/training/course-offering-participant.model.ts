import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { CourseOffering } from "./course-offering.model.js";
import { Student } from "../student.model.js";
import { AdmissionRecord } from "../plan/admission-record.model.js";

// A confirmed class roster is independent of later edits to source group membership.
@Table({ tableName: "course_offering_participants", underscored: true, timestamps: true })
export class CourseOfferingParticipant extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => CourseOffering) @Column({ type: DataType.UUID, allowNull: false }) declare courseOfferingId: string;
  @BelongsTo(() => CourseOffering, { foreignKey: "courseOfferingId", as: "courseOffering" }) declare courseOffering: any;
  @Column({ type: DataType.STRING(50), allowNull: false }) declare identity: string;
  @ForeignKey(() => Student) @Column({ type: DataType.UUID, allowNull: true }) declare studentId: string | null;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: true }) declare admissionRecordId: string | null;
  @Column({ type: DataType.STRING(255), allowNull: false }) declare regNo: string;
  @Column({ type: DataType.STRING(255), allowNull: false }) declare fullName: string;
  @Column({ type: DataType.TEXT, allowNull: true }) declare note: string | null;
}
