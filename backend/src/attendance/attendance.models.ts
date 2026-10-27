// Sequelize models for the PGSMS attendance tables.
// Source of truth: migrations/080-attendance-face.ts.

import {
  Column,
  DataType,
  Default,
  Model,
  Table,
} from "sequelize-typescript";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "EXCUSED"
  | "LEFT_EARLY"
  | "LATE_EARLY";

export type AttendanceSource = "FACE" | "MANUAL" | "REVIEW";
export type RecognitionDecision = "ACCEPT" | "REVIEW" | "UNKNOWN" | "ERROR";
export type ReviewStatus = "PENDING" | "RESOLVED" | "DISMISSED";
export type ReviewResolution =
  | "ACCEPT_SUGGESTED"
  | "ASSIGN_OTHER"
  | "REJECT"
  | "DISMISS";

@Table({ tableName: "teaching_session_attendance", underscored: true, timestamps: true })
export class TeachingSessionAttendance extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare teachingSessionId: string;

  @Column({ type: DataType.STRING(80), allowNull: false })
  declare participantId: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare displayName: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare status: AttendanceStatus;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare source: AttendanceSource;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare faceEventId: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare confidence: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare policyVersion: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare note: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare recordedByStaffId: string | null;

  @Column({ type: DataType.DATE, allowNull: false })
  declare recordedAt: Date;
}

@Table({
  tableName: "attendance_recognition_events",
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class AttendanceRecognitionEvent extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare teachingSessionId: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare participantId: string | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare faceEventId: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare decision: RecognitionDecision;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare reason: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare top1SubjectId: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare top1Score: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare top2SubjectId: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare top2Score: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare margin: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare thresholdAccept: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare thresholdReview: string | null;

  @Column({ type: DataType.DECIMAL(6, 5), allowNull: true })
  declare qualityScore: string | null;

  @Default({})
  @Column({ type: DataType.JSONB, allowNull: false })
  declare quality: Record<string, number>;

  @Default([])
  @Column({ type: DataType.JSONB, allowNull: false })
  declare candidates: Array<Record<string, unknown>>;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare modelVersion: string;

  @Column({ type: DataType.STRING(64), allowNull: true })
  declare policyVersion: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare latencyMs: number | null;
}

@Table({ tableName: "attendance_review_queue", underscored: true, timestamps: true })
export class AttendanceReviewQueue extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare teachingSessionId: string;

  @Column({ type: DataType.UUID, allowNull: false, unique: true })
  declare eventId: string;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare participantId: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare suggestedSubjectId: string | null;

  @Default("PENDING")
  @Column({ type: DataType.STRING(16), allowNull: false })
  declare status: ReviewStatus;

  @Column({ type: DataType.STRING(32), allowNull: true })
  declare resolution: ReviewResolution | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare resolvedSubjectId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare reviewedAttendanceId: string | null;

  @Column({ type: DataType.UUID, allowNull: true })
  declare resolvedByStaffId: string | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare resolvedAt: Date | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare note: string | null;
}
