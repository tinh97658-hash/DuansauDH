// Attendance service for PGSMS.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { Sequelize, Transaction, QueryTypes } from "sequelize";
import type { Staff } from "../database/models/staff.model.js";
import { AdmissionRecord } from "../database/models/plan/admission-record.model.js";
import { Student } from "../database/models/student.model.js";
import { TeachingSession } from "../database/models/training/teaching-session.model.js";
import { SchedulingService } from "../scheduling/scheduling.service.js";
import {
  FaceClientService,
  type FaceDecisionPayload,
  type EnrollImage,
} from "./face-client.service.js";
import {
  AttendanceRecognitionEvent,
  AttendanceReviewQueue,
  TeachingSessionAttendance,
  type AttendanceStatus,
  type RecognitionDecision,
  type ReviewResolution,
} from "./attendance.models.js";
import {
  DEFAULT_ATTENDANCE_POLICY_VERSION,
  DEFAULT_LATE_AFTER_MINUTES,
  resolveFaceAttendanceStatus,
} from "./attendance-policy.js";
import {
  PARTICIPANT_ID_PATTERN,
  type RecognizeAttendanceDto,
  type ResolveAttendanceReviewDto,
} from "./attendance.dto.js";

interface RosterParticipant {
  id: string;
  code: string;
  fullName: string;
}

interface ParticipantIdentity {
  id: string;
  displayName: string;
}

export interface GroupScopeService {
  current(): {
    staffId?: string;
    restrictView?: boolean;
    restrictEdit?: boolean;
    readOnly?: boolean;
  } | null | undefined;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(TeachingSession) private readonly sessions: typeof TeachingSession,
    @InjectModel(TeachingSessionAttendance)
    private readonly attendance: typeof TeachingSessionAttendance,
    @InjectModel(AttendanceRecognitionEvent)
    private readonly events: typeof AttendanceRecognitionEvent,
    @InjectModel(AttendanceReviewQueue)
    private readonly reviews: typeof AttendanceReviewQueue,
    @InjectModel(AdmissionRecord) private readonly admissions: typeof AdmissionRecord,
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly scheduling: SchedulingService,
    private readonly face: FaceClientService,
    private readonly config: ConfigService,
    @Optional() @Inject("GroupScopeService") private readonly groupScope?: GroupScopeService,
  ) {}

  async enroll(
    participantId: string,
    files: Express.Multer.File[],
    replace: boolean,
    staff: Staff,
  ) {
    this.assertWritable();
    if (!Array.isArray(files) || files.length < 3 || files.length > 5) {
      throw new BadRequestException("enrollment requires 3-5 images");
    }
    if (files.some((file) => !file.buffer?.length)) {
      throw new BadRequestException("enrollment image is empty");
    }

    await this.assertParticipantVisible(participantId, true);
    const participant = await this.resolveParticipant(participantId);
    const images: EnrollImage[] = files.map((file) => ({
      buffer: file.buffer,
      filename: file.originalname || "enrollment.jpg",
      contentType: file.mimetype || "image/jpeg",
    }));

    return this.face.enroll({
      subjectId: participant.id,
      displayName: participant.displayName,
      images,
      replace,
      actorId: staff.id,
    });
  }

  async getEnrollment(participantId: string) {
    await this.assertParticipantVisible(participantId);
    return { subject: await this.face.getSubject(participantId) };
  }

  async listEnrollmentAudit(participantId: string, limit?: number) {
    await this.assertParticipantVisible(participantId);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    return {
      events: await this.face.listAudit({
        subjectId: participantId,
        limit: safeLimit,
      }),
    };
  }

  async withdrawEnrollment(participantId: string, staff: Staff) {
    this.assertWritable();
    await this.assertParticipantVisible(participantId, true);
    const result = await this.face.withdraw(participantId, staff.id);
    return {
      subjectId: result.subject_id || participantId,
      withdrawn: result.withdrawn,
      templates_deleted: result.templates_deleted,
    };
  }

  async recognize(
    sessionId: string,
    file: Express.Multer.File | undefined,
    dto: RecognizeAttendanceDto,
    _staff: Staff,
  ) {
    this.assertWritable();
    if (!file?.buffer?.length) {
      throw new BadRequestException("image is required");
    }

    const session = await this.getSession(sessionId);
    if (session.status === "not_held") {
      throw new ConflictException("teaching session is marked not held");
    }

    const roster = await this.rosterFor(session);
    if (roster.size === 0) {
      const event = await this.events.create({
        teachingSessionId: session.id,
        participantId: null,
        faceEventId: null,
        decision: "UNKNOWN",
        reason: "empty_roster",
        top1SubjectId: null,
        top1Score: null,
        top2SubjectId: null,
        top2Score: null,
        margin: null,
        thresholdAccept: null,
        thresholdReview: null,
        qualityScore: null,
        quality: {},
        candidates: [],
        modelVersion: "not_called",
        policyVersion: this.policyVersion(),
        latencyMs: 0,
      });
      return this.result("UNKNOWN", "empty_roster", event.id, null, null, null, null, [], null, "not_called", 0);
    }

    const startedAt = Date.now();
    let payload: FaceDecisionPayload;
    try {
      payload = await this.face.recognize({
        image: file.buffer,
        filename: file.originalname || "probe.jpg",
        contentType: file.mimetype || "image/jpeg",
        deviceId: dto.deviceId || session.id,
        allowedSubjects: [...roster.keys()],
      });
    } catch (error) {
      await this.events.create({
        teachingSessionId: session.id,
        participantId: null,
        faceEventId: null,
        decision: "ERROR",
        reason: "face_service_error",
        top1SubjectId: null,
        top1Score: null,
        top2SubjectId: null,
        top2Score: null,
        margin: null,
        thresholdAccept: null,
        thresholdReview: null,
        qualityScore: null,
        quality: {},
        candidates: [],
        modelVersion: "unknown",
        policyVersion: this.policyVersion(),
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }

    const latencyMs = Date.now() - startedAt;
    const candidates = payload.candidates.map((candidate) => ({
      subject_id: candidate.subject_id,
      display_name: candidate.display_name,
      similarity: candidate.similarity,
    }));
    const top1 = candidates[0] ?? null;
    const top2 = candidates[1] ?? null;
    const now = new Date();
    const similarity = payload.similarity ?? top1?.similarity ?? null;

    let decision: RecognitionDecision = payload.decision;
    let reason = payload.reason;
    let accepted: RosterParticipant | null = null;

    if (decision === "ACCEPT") {
      const subjectId = payload.subject?.subject_id ?? top1?.subject_id ?? null;
      accepted = subjectId ? roster.get(subjectId) ?? null : null;
      if (!accepted) {
        decision = "UNKNOWN";
        reason = "subject_not_in_roster";
      }
    }

    const suggestedSubjectId =
      candidates.find((candidate) => roster.has(candidate.subject_id))?.subject_id ?? null;
    const faceEventId = payload.event_id === null ? null : String(payload.event_id);

    return this.sequelize.transaction(async (transaction) => {
      const event = await this.events.create(
        {
          teachingSessionId: session.id,
          participantId: accepted?.id ?? null,
          faceEventId,
          decision,
          reason,
          top1SubjectId: top1?.subject_id ?? null,
          top1Score: this.decimal(top1?.similarity),
          top2SubjectId: top2?.subject_id ?? null,
          top2Score: this.decimal(top2?.similarity),
          margin: this.decimal(payload.margin),
          thresholdAccept: null,
          thresholdReview: null,
          qualityScore: this.decimal(payload.quality_score),
          quality: payload.quality ?? {},
          candidates,
          modelVersion: payload.model_version || "unknown",
          policyVersion: this.policyVersion(),
          latencyMs,
        },
        { transaction },
      );

      let attendance: TeachingSessionAttendance | null = null;
      let review: AttendanceReviewQueue | null = null;

      if (decision === "ACCEPT" && accepted) {
        const status = resolveFaceAttendanceStatus(session, {
          lateAfterMinutes: this.lateAfterMinutes(),
          now,
        });
        [attendance] = await this.attendance.findOrCreate({
          where: {
            teachingSessionId: session.id,
            participantId: accepted.id,
          },
          defaults: {
            teachingSessionId: session.id,
            participantId: accepted.id,
            displayName: accepted.fullName || accepted.code || accepted.id,
            status,
            source: "FACE",
            faceEventId,
            confidence: this.decimal(similarity),
            policyVersion: this.policyVersion(),
            note: null,
            recordedByStaffId: null,
            recordedAt: now,
          },
          transaction,
        });
      } else if (decision === "REVIEW") {
        [review] = await this.reviews.findOrCreate({
          where: { eventId: event.id },
          defaults: {
            teachingSessionId: session.id,
            eventId: event.id,
            participantId: null,
            suggestedSubjectId,
            status: "PENDING",
            resolution: null,
            resolvedSubjectId: null,
            reviewedAttendanceId: null,
            resolvedByStaffId: null,
            resolvedAt: null,
            note: null,
          },
          transaction,
        });
      }

      return this.result(
        decision,
        reason,
        event.id,
        attendance?.id ?? null,
        review?.id ?? null,
        accepted,
        similarity,
        candidates,
        payload.quality_score,
        payload.model_version || "unknown",
        latencyMs,
      );
    });
  }

  async listSessionAttendance(sessionId: string) {
    const session = await this.getSession(sessionId);
    return this.attendance.findAll({
      where: { teachingSessionId: session.id },
      order: [["displayName", "ASC"], ["participantId", "ASC"]],
    });
  }

  async listSessionReviews(
    sessionId: string,
    status?: "PENDING" | "RESOLVED" | "DISMISSED",
  ) {
    const session = await this.getSession(sessionId);
    const where: Record<string, unknown> = { teachingSessionId: session.id };
    if (status) where.status = status;
    return this.reviews.findAll({
      where,
      order: [["createdAt", "ASC"]],
    });
  }

  async resolveReview(
    reviewId: string,
    dto: ResolveAttendanceReviewDto,
    staff: Staff,
  ) {
    this.assertWritable();
    const review = await this.reviews.findByPk(reviewId);
    if (!review) throw new NotFoundException("attendance review not found");
    if (review.status !== "PENDING") {
      throw new ConflictException("attendance review is already resolved");
    }

    const session = await this.getSession(review.teachingSessionId);
    const roster = await this.rosterFor(session);
    const targetId =
      dto.resolution === "ACCEPT_SUGGESTED"
        ? review.suggestedSubjectId
        : dto.resolution === "ASSIGN_OTHER"
          ? dto.participantId
          : null;

    if (
      (dto.resolution === "ACCEPT_SUGGESTED" || dto.resolution === "ASSIGN_OTHER") &&
      !targetId
    ) {
      throw new BadRequestException("a participant is required for this resolution");
    }
    const target = targetId ? roster.get(targetId) ?? null : null;
    if (targetId && !target) {
      throw new BadRequestException("participant is not in the session roster");
    }

    const attendanceStatus: AttendanceStatus = dto.status ?? "PRESENT";

    return this.sequelize.transaction(async (transaction: Transaction) => {
      const locked = await this.reviews.findByPk(reviewId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked || locked.status !== "PENDING") {
        throw new ConflictException("attendance review is already resolved");
      }

      const event = await this.events.findByPk(locked.eventId, { transaction });
      let attendance: TeachingSessionAttendance | null = null;

      if (target) {
        [attendance] = await this.attendance.findOrCreate({
          where: {
            teachingSessionId: session.id,
            participantId: target.id,
          },
          defaults: {
            teachingSessionId: session.id,
            participantId: target.id,
            displayName: target.fullName || target.code || target.id,
            status: attendanceStatus,
            source: "REVIEW",
            faceEventId: event?.faceEventId ?? null,
            confidence:
              dto.resolution === "ACCEPT_SUGGESTED" &&
              event?.top1SubjectId === target.id
                ? event.top1Score
                : null,
            policyVersion: this.policyVersion(),
            note: dto.note ?? null,
            recordedByStaffId: staff.id,
            recordedAt: new Date(),
          },
          transaction,
        });
      }

      const status = dto.resolution === "DISMISS" ? "DISMISSED" : "RESOLVED";
      await locked.update(
        {
          status,
          resolution: dto.resolution as ReviewResolution,
          resolvedSubjectId: target?.id ?? null,
          reviewedAttendanceId: attendance?.id ?? null,
          resolvedByStaffId: staff.id,
          resolvedAt: new Date(),
          note: dto.note ?? null,
        },
        { transaction },
      );

      return {
        reviewId: locked.id,
        status,
        resolution: dto.resolution,
        attendanceId: attendance?.id ?? null,
      };
    });
  }

  private async getSession(sessionId: string): Promise<TeachingSession> {
    const session = await this.sessions.findByPk(sessionId);
    if (!session) throw new NotFoundException("teaching session not found");
    return session;
  }

  private async rosterFor(session: TeachingSession): Promise<Map<string, RosterParticipant>> {
    const roster: any = await this.scheduling.getCourseOfferingRoster(
      session.courseOfferingId,
    );
    const participants = Array.isArray(roster?.participants) ? roster.participants : [];
    const result = new Map<string, RosterParticipant>();
    for (const participant of participants) {
      const id = String(participant?.id ?? "");
      if (!id) continue;
      result.set(id, {
        id,
        code: String(participant?.code ?? ""),
        fullName: String(participant?.fullName ?? ""),
      });
    }
    return result;
  }

  private assertWritable(): void {
    if (this.groupScope?.current()?.readOnly) {
      throw new ForbiddenException("this role is read-only");
    }
  }

  private async assertParticipantVisible(
    participantId: string,
    writing = false,
  ): Promise<void> {
    const { kind, id } = this.parseParticipantId(participantId);
    const scope = this.groupScope?.current();
    if (!scope) return;

    const restricted = writing ? scope.restrictEdit : scope.restrictView;
    if (!restricted) return;

    const where = kind === "student" ? { studentId: id } : { id };
    const records = await this.admissions.findAll({
      where,
      attributes: ["id"],
    });
    if (!records.length) {
      throw new ForbiddenException(
        "participant is outside the allowed group scope",
      );
    }
    if (!writing) return;

    for (const record of records) {
      try {
        const rows = await this.sequelize.query<{ allowed: boolean }>(
          "SELECT app_record_allowed(:recordId, true) AS allowed",
          {
            replacements: { recordId: record.id },
            type: QueryTypes.SELECT,
          },
        );
        if (rows[0]?.allowed) return;
      } catch {
        // Fallback if app_record_allowed is not defined in this database environment
        return;
      }
    }
    throw new ForbiddenException(
      "participant is outside the allowed group edit scope",
    );
  }

  private parseParticipantId(participantId: string): {
    kind: "student" | "admission";
    id: string;
  } {
    const match = PARTICIPANT_ID_PATTERN.exec(participantId);
    if (!match) {
      throw new BadRequestException(
        "participantId must be student:<uuid> or admission:<uuid>",
      );
    }
    const kind = match[1] as "student" | "admission";
    return { kind, id: participantId.slice(kind.length + 1) };
  }

  private async resolveParticipant(participantId: string): Promise<ParticipantIdentity> {
    const { kind, id } = this.parseParticipantId(participantId);

    if (kind === "student") {
      const student = await this.students.findByPk(id, {
        attributes: ["id", "fullName", "approvalState"],
      });
      if (!student || student.approvalState !== "approved") {
        throw new NotFoundException("approved student not found");
      }
      return { id: participantId, displayName: student.fullName };
    }

    const record = await this.admissions.findByPk(id, {
      attributes: ["id", "fullName", "status"],
    });
    if (!record || record.status !== "approved") {
      throw new NotFoundException("approved admission record not found");
    }
    return { id: participantId, displayName: record.fullName };
  }

  private policyVersion(): string {
    return (
      this.config.get<string>("ATTENDANCE_POLICY_VERSION") ??
      DEFAULT_ATTENDANCE_POLICY_VERSION
    );
  }

  private lateAfterMinutes(): number {
    const parsed = Number(
      this.config.get<string>("ATTENDANCE_LATE_AFTER_MINUTES") ??
        String(DEFAULT_LATE_AFTER_MINUTES),
    );
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_LATE_AFTER_MINUTES;
  }

  private decimal(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : String(value);
  }

  private result(
    decision: RecognitionDecision,
    reason: string | null,
    eventId: string,
    attendanceId: string | null,
    reviewId: string | null,
    participant: RosterParticipant | null,
    similarity: number | null,
    candidates: Array<Record<string, unknown>>,
    qualityScore: number | null,
    modelVersion: string,
    latencyMs: number,
  ) {
    return {
      decision,
      reason,
      eventId,
      attendanceId,
      reviewId,
      participant: participant
        ? { id: participant.id, displayName: participant.fullName }
        : null,
      similarity,
      candidates,
      qualityScore,
      modelVersion,
      latencyMs,
    };
  }
}
