// Attendance service for PGSMS.

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  Logger,
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
  attendanceWindow,
} from "./attendance-policy.js";
import {
  PARTICIPANT_ID_PATTERN,
  type RecognizeAttendanceDto,
  type ResolveAttendanceReviewDto,
  type AttendanceTelemetryDto,
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
  private readonly logger = new Logger(AttendanceService.name);
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

  async analyzeEnrollment(participantId: string, file: Express.Multer.File | undefined) {
    this.assertWritable();
    await this.assertParticipantVisible(participantId, true);
    return this.analyzeFrame(file, "enroll");
  }

  async analyzeSession(sessionId: string, file: Express.Multer.File | undefined) {
    this.assertWritable();
    this.assertOpen(await this.getSession(sessionId));
    return this.analyzeFrame(file, "recognize", sessionId);
  }

  private analyzeFrame(file: Express.Multer.File | undefined, purpose: "enroll" | "recognize", captureContext?: string) {
    if (!file?.buffer?.length) throw new BadRequestException("image is required");
    return this.face.analyze({ buffer: file.buffer, filename: file.originalname || "capture.jpg", contentType: file.mimetype || "image/jpeg" }, purpose, captureContext);
  }

  async recordTelemetry(sessionId: string, telemetry: AttendanceTelemetryDto) {
    this.assertWritable();
    await this.getSession(sessionId);
    this.logger.log(JSON.stringify({ event: "attendance.client_timing", timestamp: new Date().toISOString(), sessionId, ...telemetry }));
    return { recorded: true };
  }

  async attendanceWorkflow(sessionId: string) {
    const session = await this.getSession(sessionId);
    return { state: session.attendanceState, openedAt: session.attendanceOpenedAt, closedAt: session.attendanceClosedAt, withinWindow: attendanceWindow(session).valid };
  }

  async openAttendance(sessionId: string, staff: Staff) {
    this.assertWritable();
    return this.sequelize.transaction(async (transaction) => {
      const session = await this.lockSession(sessionId, transaction);
      if (session.status === "not_held") throw new ConflictException("Buổi học đã được đánh dấu không diễn ra.");
      if (session.attendanceState === "CLOSED") throw new ConflictException("Buổi điểm danh đã chốt, không thể mở lại.");
      if (!attendanceWindow(session).valid) throw new ConflictException("Chỉ mở điểm danh từ 30 phút trước giờ học đến hết buổi học.");
      const roster = await this.rosterFor(session);
      if (!roster.size) throw new ConflictException("Không thể mở điểm danh khi lớp chưa có học viên.");
      if (session.attendanceState !== "OPEN") await session.update({ attendanceState: "OPEN", attendanceOpenedAt: new Date(), attendanceOpenedByStaffId: staff.id }, { transaction });
      return { state: "OPEN" };
    });
  }

  async closeAttendance(sessionId: string, staff: Staff) {
    this.assertWritable();
    return this.sequelize.transaction(async (transaction) => {
      const session = await this.lockSession(sessionId, transaction);
      if (session.attendanceState !== "OPEN") throw new ConflictException("Chỉ có thể chốt buổi điểm danh đang mở.");
      if (session.status === "not_held") throw new ConflictException("Buổi học không diễn ra; không thể ghi vắng cho học viên.");
      const pending = await this.reviews.count({ where: { teachingSessionId: sessionId, status: "PENDING" }, transaction });
      if (pending) throw new ConflictException(`Còn ${pending} ca chờ duyệt. Hãy xử lý trước khi chốt điểm danh.`);
      const roster = await this.rosterFor(session);
      const records = await this.attendance.findAll({ where: { teachingSessionId: sessionId }, transaction });
      const recorded = new Set(records.map((record) => record.participantId));
      const absent = [...roster.values()].filter((person) => !recorded.has(person.id));
      const now = new Date();
      if (absent.length) await this.attendance.bulkCreate(absent.map((person) => ({
        teachingSessionId: sessionId, participantId: person.id, displayName: person.fullName || person.code,
        status: "ABSENT", source: "SYSTEM", recordedAt: now, recordedByStaffId: staff.id,
        policyVersion: this.policyVersion(), note: "Chưa điểm danh khi cán bộ chốt buổi.",
      })), { transaction });
      await session.update({ attendanceState: "CLOSED", attendanceClosedAt: now, attendanceClosedByStaffId: staff.id }, { transaction });
      return { state: "CLOSED", absentCount: absent.length };
    });
  }

  private assertOpen(session: TeachingSession) {
    if (session.status === "not_held" || session.attendanceState !== "OPEN") throw new ConflictException("Buổi điểm danh chưa mở hoặc đã chốt. Vui lòng liên hệ cán bộ phụ trách.");
    if (!attendanceWindow(session).valid) throw new ConflictException("Đã hết thời gian quét điểm danh của buổi học.");
  }

  private async lockSession(sessionId: string, transaction: Transaction) {
    const session = await this.sessions.findByPk(sessionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!session) throw new NotFoundException("teaching session not found");
    return session;
  }

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

    await this.assertFaceNotEnrolledForAnotherParticipant(participant.id, images);

    return this.face.enroll({
      subjectId: participant.id,
      displayName: participant.displayName,
      images,
      replace,
      actorId: staff.id,
    });
  }

  private async assertFaceNotEnrolledForAnotherParticipant(
    participantId: string,
    images: EnrollImage[],
  ): Promise<void> {
    const conflicts = await this.face.findEnrollmentConflicts({
      images,
      excludeSubjectId: participantId,
      threshold: this.enrollmentDuplicateThreshold(),
    });

    for (const conflict of conflicts) {
      if (await this.isSameLearner(participantId, conflict.subjectId)) continue;
      const percent = Math.round(conflict.similarity * 100);
      throw new ConflictException({
        code: "FACE_ALREADY_ENROLLED",
        message:
          `Khuôn mặt này đã được đăng ký cho ${conflict.displayName} ` +
          `(${conflict.subjectId}) với độ tương đồng ${percent}%. ` +
          "Mỗi khuôn mặt chỉ được đăng ký cho một học viên. " +
          "Nếu đăng ký nhầm, hãy thu hồi mẫu của người đã đăng ký trước rồi thực hiện lại.",
        details: {
          conflictingSubjectId: conflict.subjectId,
          conflictingDisplayName: conflict.displayName,
          similarity: conflict.similarity,
        },
      });
    }
  }

  /**
   * Admission record and student are two identities of the same learner after
   * conversion. Do not treat the legacy admission enrollment as a duplicate.
   */
  private async isSameLearner(left: string, right: string): Promise<boolean> {
    if (left === right) return true;
    // Subjects enrolled directly through the face-service API may use codes
    // that are not PGSMS participant IDs; they are never the same learner.
    if (!PARTICIPANT_ID_PATTERN.test(left) || !PARTICIPANT_ID_PATTERN.test(right)) {
      return false;
    }
    const leftId = this.parseParticipantId(left);
    const rightId = this.parseParticipantId(right);
    if (leftId.kind === rightId.kind) return false;

    const admissionId = leftId.kind === "admission" ? leftId.id : rightId.id;
    const studentId = leftId.kind === "student" ? leftId.id : rightId.id;
    const record = await this.admissions.findByPk(admissionId, {
      attributes: ["studentId"],
    });
    return record?.studentId === studentId;
  }

  async getEnrollment(participantId: string) {
    await this.assertParticipantVisible(participantId);
    return { subject: await this.face.getSubject(participantId) };
  }

  /**
   * Batch enrollment status for the roster table. One face-service call avoids
   * an N+1 request for every student in the class.
   */
  async listSessionEnrollments(sessionId: string) {
    const session = await this.getSession(sessionId);
    const roster = await this.rosterFor(session);
    const subjects = await this.face.listSubjects(false);
    const bySubject = new Map(subjects.map((subject) => [subject.subject_id, subject]));

    return {
      enrollments: [...roster.keys()].map((participantId) => {
        const subject = bySubject.get(participantId);
        const templateCount = Number(subject?.template_count ?? 0);
        return {
          participantId,
          exists: Boolean(subject),
          active: Boolean(subject?.active),
          enrolled: Boolean(subject?.active) && templateCount > 0,
          templateCount,
          createdAt: subject?.created_at ?? null,
        };
      }),
    };
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
    const startedAt = performance.now();
    const timings = { sessionMs: 0, rosterMs: 0, faceServiceMs: 0, persistenceMs: 0, totalMs: 0 };
    let result: Awaited<ReturnType<AttendanceService["recognizeTimed"]>> | undefined;
    try {
      result = await this.recognizeTimed(sessionId, file, dto, timings);
      timings.totalMs = performance.now() - startedAt;
      return { ...result, timings };
    } finally {
      timings.totalMs = performance.now() - startedAt;
      this.logger.log(JSON.stringify({ event: "attendance.server_timing", timestamp: new Date().toISOString(), sessionId,
        eventId: result?.eventId ?? null, outcome: result?.decision ?? "ERROR",
        captureReused: result && "captureReused" in result ? result.captureReused : false,
        newAttendance: result?.decision === "ACCEPT" && result.attendance?.alreadyRecorded === false,
        ...timings }));
    }
  }

  private async recognizeTimed(
    sessionId: string,
    file: Express.Multer.File | undefined,
    dto: RecognizeAttendanceDto,
    timings: { sessionMs: number; rosterMs: number; faceServiceMs: number; persistenceMs: number },
  ) {
    this.assertWritable();
    if (!file?.buffer?.length) {
      throw new BadRequestException("image is required");
    }

    const sessionStartedAt = performance.now();
    const session = await this.getSession(sessionId);
    timings.sessionMs = performance.now() - sessionStartedAt;
    this.assertOpen(session);
    if (session.status === "not_held") {
      throw new ConflictException("teaching session is marked not held");
    }

    const rosterStartedAt = performance.now();
    const roster = await this.rosterFor(session);
    timings.rosterMs = performance.now() - rosterStartedAt;
    if (roster.size === 0) {
      const persistenceStartedAt = performance.now();
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
      timings.persistenceMs = performance.now() - persistenceStartedAt;
      return this.result("UNKNOWN", "empty_roster", event.id, null, null, null, null, [], null, "not_called", 0);
    }

    const startedAt = Date.now();
    const faceStartedAt = performance.now();
    let payload: FaceDecisionPayload;
    try {
      payload = await this.face.recognize({
        image: file.buffer,
        filename: file.originalname || "probe.jpg",
        contentType: file.mimetype || "image/jpeg",
        deviceId: dto.deviceId || session.id,
        allowedSubjects: [...roster.keys()],
        captureToken: dto.captureToken,
        captureContext: sessionId,
      });
      timings.faceServiceMs = performance.now() - faceStartedAt;
    } catch (error) {
      timings.faceServiceMs = performance.now() - faceStartedAt;
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
      } else {
        // Legacy duplicate enrollments can make one face match two roster
        // members. Never silently pick the higher score in that case.
        const rosterCandidates = candidates
          .filter((candidate) => roster.has(candidate.subject_id))
          .sort((left, right) => Number(right.similarity) - Number(left.similarity));
        const runnerUp = rosterCandidates[1];
        const topScore = Number(rosterCandidates[0]?.similarity ?? similarity ?? 0);
        if (
          runnerUp &&
          topScore >= this.ambiguityScoreThreshold() &&
          topScore - Number(runnerUp.similarity) < this.ambiguityMargin()
        ) {
          decision = "REVIEW";
          reason = "ambiguous_identity";
          accepted = null;
        }
      }
    }

    const suggestedSubjectId =
      candidates.find((candidate) => roster.has(candidate.subject_id))?.subject_id ?? null;
    const faceEventId = payload.event_id === null ? null : String(payload.event_id);

    const persistenceStartedAt = performance.now();
    const result = await this.sequelize.transaction(async (transaction) => {
      this.assertOpen(await this.lockSession(sessionId, transaction));
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
          thresholdAccept: this.decimal(payload.threshold_accept),
          thresholdReview: this.decimal(payload.threshold_review),
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
      let alreadyRecorded = false;
      let review: AttendanceReviewQueue | null = null;

      if (decision === "ACCEPT" && accepted) {
        const status = resolveFaceAttendanceStatus(session, {
          lateAfterMinutes: this.lateAfterMinutes(),
          now,
        });
        const [record, created] = await this.attendance.findOrCreate({
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
        attendance = record;
        alreadyRecorded = !created;
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
        attendance,
        alreadyRecorded,
      );
    }).finally(() => {
      timings.persistenceMs = performance.now() - persistenceStartedAt;
    });
    return { ...result, captureReused: payload.capture_reused ?? false };
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
    if (target && session.status === "not_held") {
      throw new ConflictException("teaching session is marked not held");
    }

    const attendanceStatus: AttendanceStatus = dto.status ?? "PRESENT";

    return this.sequelize.transaction(async (transaction: Transaction) => {
      const currentSession = await this.lockSession(session.id, transaction);
      if (target && (currentSession.attendanceState === "CLOSED" || currentSession.status === "not_held")) throw new ConflictException("Buổi điểm danh đã chốt hoặc không diễn ra, không thể sửa kết quả.");
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

  private enrollmentDuplicateThreshold(): number {
    const parsed = Number(
      this.config.get<string>("FACE_ENROLLMENT_DUPLICATE_THRESHOLD") ?? "0.6",
    );
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.6;
  }

  private ambiguityScoreThreshold(): number {
    const parsed = Number(
      this.config.get<string>("ATTENDANCE_AMBIGUITY_SCORE") ?? "0.45",
    );
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.45;
  }

  private ambiguityMargin(): number {
    const parsed = Number(
      this.config.get<string>("ATTENDANCE_AMBIGUITY_MARGIN") ?? "0.15",
    );
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.15;
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
    attendance: TeachingSessionAttendance | null = null,
    alreadyRecorded = false,
  ) {
    return {
      decision,
      reason,
      eventId,
      attendanceId,
      reviewId,
      participant: participant
        ? { id: participant.id, code: participant.code, displayName: participant.fullName }
        : null,
      attendance: attendance ? {
        status: attendance.status,
        recordedAt: attendance.recordedAt,
        alreadyRecorded,
      } : null,
      similarity,
      candidates,
      qualityScore,
      modelVersion,
      latencyMs,
    };
  }
}
