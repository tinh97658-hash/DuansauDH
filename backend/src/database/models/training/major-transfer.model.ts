import { BelongsTo, Column, DataType, Default, ForeignKey, HasMany, Model, Table } from "sequelize-typescript";
import { Major } from "../common/major.model.js";
import { AdmissionRecord } from "../plan/admission-record.model.js";
import { Curriculum } from "../plan/curriculum.model.js";
import { ClassGroup } from "./class-group.model.js";
import { SubjectRecognition } from "./subject-recognition.model.js";

@Table({ tableName: "major_transfers", underscored: true, timestamps: true })
export class MajorTransfer extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false }) declare admissionRecordId: string;
  @BelongsTo(() => AdmissionRecord) declare admissionRecord: AdmissionRecord;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: false }) declare fromMajorId: string;
  @BelongsTo(() => Major, { foreignKey: "fromMajorId", as: "fromMajor" }) declare fromMajor: Major;
  @ForeignKey(() => Major) @Column({ type: DataType.UUID, allowNull: false }) declare toMajorId: string;
  @BelongsTo(() => Major, { foreignKey: "toMajorId", as: "toMajor" }) declare toMajor: Major;
  @ForeignKey(() => ClassGroup) @Column(DataType.UUID) declare fromClassGroupId: string | null;
  @BelongsTo(() => ClassGroup, { foreignKey: "fromClassGroupId", as: "fromClassGroup" }) declare fromClassGroup: ClassGroup | null;
  @ForeignKey(() => Curriculum) @Column(DataType.UUID) declare fromCurriculumId: string | null;
  @BelongsTo(() => Curriculum, { foreignKey: "fromCurriculumId", as: "fromCurriculum" }) declare fromCurriculum: Curriculum | null;
  @ForeignKey(() => Curriculum) @Column(DataType.UUID) declare toCurriculumId: string | null;
  @BelongsTo(() => Curriculum, { foreignKey: "toCurriculumId", as: "toCurriculum" }) declare toCurriculum: Curriculum | null;
  @Default("pending") @Column({ type: DataType.STRING(20), allowNull: false }) declare status: "pending" | "approved" | "rejected";
  @Column(DataType.TEXT) declare reason: string | null;
  @Column(DataType.TEXT) declare decisionNote: string | null;
  @Column(DataType.STRING(30)) declare previousAdmissionStatus: string | null;
  @Column(DataType.STRING(50)) declare previousStudyStatus: string | null;
  @Default(DataType.NOW) @Column({ type: DataType.DATE, allowNull: false }) declare requestedAt: Date;
  @Column(DataType.DATE) declare decidedAt: Date | null;
  @HasMany(() => SubjectRecognition) declare recognitions: SubjectRecognition[];
}
