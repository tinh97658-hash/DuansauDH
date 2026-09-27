import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { AdmissionRecord } from "../plan/admission-record.model.js";
import { Subject } from "../plan/subject.model.js";
import { CourseOffering } from "./course-offering.model.js";
import { MajorTransfer } from "./major-transfer.model.js";
import { LearnerSubjectResult } from "./learner-subject-result.model.js";

@Table({ tableName: "subject_recognitions", underscored: true, timestamps: true })
export class SubjectRecognition extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false }) declare admissionRecordId: string;
  @BelongsTo(() => AdmissionRecord) declare admissionRecord: AdmissionRecord;
  @ForeignKey(() => MajorTransfer) @Column({ type: DataType.UUID, allowNull: true }) declare majorTransferId: string | null;
  @BelongsTo(() => MajorTransfer) declare majorTransfer: MajorTransfer | null;
  @ForeignKey(() => LearnerSubjectResult) @Column(DataType.UUID) declare learningResultId: string | null;
  @BelongsTo(() => LearnerSubjectResult, { foreignKey: "learningResultId", as: "learningResult" }) declare learningResult: LearnerSubjectResult | null;
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare sourceSubjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "sourceSubjectId", as: "sourceSubject" }) declare sourceSubject: Subject;
  @ForeignKey(() => Subject) @Column({ type: DataType.UUID, allowNull: false }) declare targetSubjectId: string;
  @BelongsTo(() => Subject, { foreignKey: "targetSubjectId", as: "targetSubject" }) declare targetSubject: Subject;
  @ForeignKey(() => CourseOffering) @Column(DataType.UUID) declare sourceCourseOfferingId: string | null;
  @BelongsTo(() => CourseOffering) declare sourceCourseOffering: CourseOffering | null;
  @Default("approved") @Column({ type: DataType.STRING(20), allowNull: false }) declare status: "pending" | "approved" | "rejected";
  @Default("canonical_subject") @Column({ type: DataType.STRING(30), allowNull: false }) declare basis: string;
  @Default("major_transfer") @Column({ type: DataType.STRING(30), allowNull: false }) declare sourceType: string;
  @Column(DataType.STRING(100)) declare decisionNo: string | null;
  @Column(DataType.DATE) declare decidedAt: Date | null;
  @Column(DataType.TEXT) declare note: string | null;
}
