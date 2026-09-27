import { BelongsTo, Column, DataType, Default, ForeignKey, Model, Table } from "sequelize-typescript";
import { BridgeKnowledgeSubject } from "../common/bridge-knowledge-subject.model.js";
import { AdmissionRecord } from "../plan/admission-record.model.js";
import { Subject } from "../plan/subject.model.js";
import { CourseOffering } from "./course-offering.model.js";

/**
 * Kết quả học phần cá nhân — nguồn dữ liệu duy nhất cho mọi lần học của một học viên
 * (tiền thạc sĩ, học trước, chính khóa, hoặc học bổ sung kiến thức).
 *
 * Quy ước trạng thái:
 * - `status = registered | studying`: mới đăng ký/đang học, KHÔNG tính tín chỉ.
 *   Khi hồ sơ chuyển sang CTĐT chính thức thì chỉ kế thừa đăng ký, chưa công nhận.
 * - `status = completed` và `result = passed | exempt`: đủ điều kiện công nhận.
 * - `result = failed`: phải học lại, không công nhận.
 */
@Table({ tableName: "learner_subject_results", underscored: true, timestamps: true })
export class LearnerSubjectResult extends Model {
  @Default(DataType.UUIDV4) @Column({ type: DataType.UUID, primaryKey: true }) declare id: string;
  @ForeignKey(() => AdmissionRecord) @Column({ type: DataType.UUID, allowNull: false }) declare admissionRecordId: string;
  @BelongsTo(() => AdmissionRecord) declare admissionRecord: AdmissionRecord;
  @ForeignKey(() => Subject) @Column(DataType.UUID) declare subjectId: string | null;
  @BelongsTo(() => Subject, { foreignKey: "subjectId", as: "subject" }) declare subject: Subject | null;
  @ForeignKey(() => BridgeKnowledgeSubject) @Column(DataType.UUID) declare bridgeKnowledgeSubjectId: string | null;
  @BelongsTo(() => BridgeKnowledgeSubject, { foreignKey: "bridgeKnowledgeSubjectId", as: "bridgeKnowledgeSubject" })
  declare bridgeKnowledgeSubject: BridgeKnowledgeSubject | null;
  @ForeignKey(() => CourseOffering) @Column(DataType.UUID) declare courseOfferingId: string | null;
  @BelongsTo(() => CourseOffering, { foreignKey: "courseOfferingId", as: "courseOffering" }) declare courseOffering: CourseOffering | null;
  @Column({ type: DataType.STRING(30), allowNull: false }) declare sourceType: "pre_masters" | "early_enrollment" | "regular" | "external";
  @Column(DataType.STRING(20)) declare academicYear: string | null;
  @Default("registered") @Column({ type: DataType.STRING(20), allowNull: false }) declare status: "registered" | "studying" | "completed";
  @Default("pending") @Column({ type: DataType.STRING(20), allowNull: false }) declare result: "pending" | "passed" | "failed" | "exempt";
  @Column(DataType.DECIMAL(5, 2)) declare score: number | null;
  @Column(DataType.DATEONLY) declare completedAt: string | null;
  @Column(DataType.STRING(100)) declare decisionNo: string | null;
  /** Đơn vị/tổ chức đào tạo khi `sourceType = external`. */
  @Column(DataType.STRING(200)) declare institution: string | null;
  @Column(DataType.TEXT) declare note: string | null;
}
