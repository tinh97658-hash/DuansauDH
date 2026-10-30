import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AttendanceService } from "../../src/attendance/attendance.service.js";

describe("AttendanceService", () => {
  let service: AttendanceService;
  let sessionsMock: any;
  let attendanceMock: any;
  let eventsMock: any;
  let reviewsMock: any;
  let admissionsMock: any;
  let studentsMock: any;
  let sequelizeMock: any;
  let schedulingMock: any;
  let faceMock: any;
  let configMock: any;

  afterEach(() => jest.useRealTimers());
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T01:05:00Z"));
    sessionsMock = {
      findByPk: jest.fn(),
    };
    attendanceMock = {
      findOrCreate: jest.fn(),
      findAll: jest.fn(),
      bulkCreate: jest.fn(),
    };
    eventsMock = {
      create: jest.fn(),
      findByPk: jest.fn(),
    };
    reviewsMock = {
      count: jest.fn(),
      findOrCreate: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    };
    admissionsMock = {
      findByPk: jest.fn(),
      findAll: jest.fn(),
    };
    studentsMock = {
      findByPk: jest.fn(),
    };
    sequelizeMock = {
      transaction: jest.fn(async (callback: any) => callback({ LOCK: { UPDATE: "UPDATE" } })),
      query: jest.fn(),
    };
    schedulingMock = {
      getCourseOfferingRoster: jest.fn(),
    };
    faceMock = {
      enroll: jest.fn(),
      recognize: jest.fn(),
      getSubject: jest.fn(),
      withdraw: jest.fn(),
      listAudit: jest.fn(),
      listSubjects: jest.fn(),
      findEnrollmentConflicts: jest.fn().mockResolvedValue([]),
    };
    configMock = {
      get: jest.fn((key: string) => {
        if (key === "ATTENDANCE_LATE_AFTER_MINUTES") return "15";
        return undefined;
      }),
    };

    service = new AttendanceService(
      sessionsMock,
      attendanceMock,
      eventsMock,
      reviewsMock,
      admissionsMock,
      studentsMock,
      sequelizeMock,
      schedulingMock,
      faceMock,
      configMock as unknown as ConfigService,
    );
  });

  describe("enroll", () => {
    it("rejects enrollment if file count is less than 3", async () => {
      const files: Express.Multer.File[] = [
        { buffer: Buffer.from("1"), originalname: "1.jpg", mimetype: "image/jpeg" } as any,
        { buffer: Buffer.from("2"), originalname: "2.jpg", mimetype: "image/jpeg" } as any,
      ];
      await expect(
        service.enroll("student:12345678-1234-1234-1234-123456789012", files, true, { id: "staff-1" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects enrollment if file count is more than 5", async () => {
      const files: Express.Multer.File[] = Array.from({ length: 6 }, (_, i) => ({
        buffer: Buffer.from(`${i}`),
        originalname: `${i}.jpg`,
        mimetype: "image/jpeg",
      })) as any;
      await expect(
        service.enroll("student:12345678-1234-1234-1234-123456789012", files, true, { id: "staff-1" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a face that is already enrolled for another participant", async () => {
      const target = "admission:11111111-1111-1111-1111-111111111111";
      const other = "admission:22222222-2222-2222-2222-222222222222";
      admissionsMock.findByPk.mockImplementation((id: string) =>
        id === "11111111-1111-1111-1111-111111111111"
          ? { id, fullName: "Target Student", status: "approved" }
          : null,
      );
      faceMock.findEnrollmentConflicts.mockResolvedValue([
        { subjectId: other, displayName: "Other Student", similarity: 0.82 },
      ]);

      const files = Array.from({ length: 3 }, (_, i) => ({
        buffer: Buffer.from(`${i}`),
        originalname: `${i}.jpg`,
        mimetype: "image/jpeg",
      })) as any;

      const error = await service
        .enroll(target, files, true, { id: "staff-1" } as any)
        .catch((err) => err);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        code: "FACE_ALREADY_ENROLLED",
        details: expect.objectContaining({ conflictingSubjectId: other }),
      });
      expect(faceMock.enroll).not.toHaveBeenCalled();
    });

    it("allows re-enrollment when the matching identity belongs to the same learner", async () => {
      const admission = "admission:11111111-1111-1111-1111-111111111111";
      const student = "student:22222222-2222-2222-2222-222222222222";
      studentsMock.findByPk.mockResolvedValue({
        id: "22222222-2222-2222-2222-222222222222",
        fullName: "Target Student",
        approvalState: "approved",
      });
      admissionsMock.findByPk.mockImplementation((_id: string, options: any) =>
        options?.attributes?.includes("studentId")
          ? { studentId: "22222222-2222-2222-2222-222222222222" }
          : null,
      );
      faceMock.findEnrollmentConflicts.mockResolvedValue([
        { subjectId: admission, displayName: "Target Student", similarity: 0.8 },
      ]);
      faceMock.enroll.mockResolvedValue({
        subject: { subject_id: student, display_name: "Target Student" },
        templates_added: 3,
        template_count: 3,
        rejected_images: [],
      });

      const files = Array.from({ length: 3 }, (_, i) => ({
        buffer: Buffer.from(`${i}`),
        originalname: `${i}.jpg`,
        mimetype: "image/jpeg",
      })) as any;

      const result = await service.enroll(student, files, true, { id: "staff-1" } as any);
      expect(result.templates_added).toBe(3);
      expect(faceMock.enroll).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: student }),
      );
    });
  });

  describe("session enrollment status", () => {
    it("reports which roster participants already have face templates", async () => {
      const enrolled = "student:11111111-1111-1111-1111-111111111111";
      const withdrawn = "admission:22222222-2222-2222-2222-222222222222";
      const missing = "student:33333333-3333-3333-3333-333333333333";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({
        participants: [
          { id: enrolled, code: "SV01", fullName: "Enrolled Student" },
          { id: withdrawn, code: "SV02", fullName: "Withdrawn Student" },
          { id: missing, code: "SV03", fullName: "Missing Student" },
        ],
      });
      faceMock.listSubjects.mockResolvedValue([
        {
          subject_id: enrolled,
          display_name: "Enrolled Student",
          active: true,
          template_count: 3,
          created_at: "2026-10-27T10:00:00Z",
        },
        {
          subject_id: withdrawn,
          display_name: "Withdrawn Student",
          active: false,
          template_count: 0,
          created_at: "2026-10-27T11:00:00Z",
        },
      ]);

      const result = await service.listSessionEnrollments("session-1");

      expect(result).toEqual({
        enrollments: [
          {
            participantId: enrolled,
            exists: true,
            active: true,
            enrolled: true,
            templateCount: 3,
            createdAt: "2026-10-27T10:00:00Z",
          },
          {
            participantId: withdrawn,
            exists: true,
            active: false,
            enrolled: false,
            templateCount: 0,
            createdAt: "2026-10-27T11:00:00Z",
          },
          {
            participantId: missing,
            exists: false,
            active: false,
            enrolled: false,
            templateCount: 0,
            createdAt: null,
          },
        ],
      });
      expect(faceMock.listSubjects).toHaveBeenCalledWith(false);
    });
  });

  describe("recognize", () => {
    it("rejects scans for cancelled sessions without calling the face service", async () => {
      sessionsMock.findByPk.mockResolvedValue({ id: "session-1", status: "not_held" });
      await expect(service.recognize("session-1", { buffer: Buffer.from("image") } as any, {}, { id: "staff-1" } as any)).rejects.toThrow(ConflictException);
      expect(faceMock.recognize).not.toHaveBeenCalled();
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });
    it("returns UNKNOWN with empty_roster without calling face-service when roster is empty", async () => {
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
        attendanceState: "OPEN",
        endTime: "11:30",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({ participants: [] });
      eventsMock.create.mockResolvedValue({ id: "event-empty" });

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("UNKNOWN");
      expect(result.reason).toBe("empty_roster");
      expect(faceMock.recognize).not.toHaveBeenCalled();
    });

    it.each([true, false])("returns the saved record and whether it already existed (created: %s)", async (created) => {
      const studentId = "student:11111111-1111-1111-1111-111111111111";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
        attendanceState: "OPEN",
        endTime: "11:30",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({
        participants: [
          { id: studentId, code: "SV01", fullName: "Tran Van A" },
        ],
      });
      faceMock.recognize.mockResolvedValue({
        decision: "ACCEPT",
        reason: "accepted",
        subject: { subject_id: studentId, display_name: "Tran Van A" },
        candidates: [{ subject_id: studentId, display_name: "Tran Van A", similarity: 0.88 }],
        similarity: 0.88,
        margin: 0.5,
        quality: {},
        quality_score: 0.9,
        event_id: 202,
        model_version: "buffalo_l",
      });
      eventsMock.create.mockResolvedValue({ id: "event-accepted" });
      const recordedAt = new Date("2026-10-27T01:00:00Z");
      attendanceMock.findOrCreate.mockResolvedValue([{ id: "att-1", status: "PRESENT", recordedAt }, created]);

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("ACCEPT");
      expect(result.participant?.id).toBe(studentId);
      expect(result.participant?.code).toBe("SV01");
      expect(result.attendanceId).toBe("att-1");
      expect(result.attendance).toEqual({ status: "PRESENT", recordedAt, alreadyRecorded: !created });
      expect(attendanceMock.findOrCreate).toHaveBeenCalled();
    });

    it("marks UNKNOWN with subject_not_in_roster if accepted subject is outside the offering roster", async () => {
      const studentInside = "student:11111111-1111-1111-1111-111111111111";
      const studentOutside = "student:22222222-2222-2222-2222-222222222222";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
        attendanceState: "OPEN",
        endTime: "11:30",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({
        participants: [
          { id: studentInside, code: "SV01", fullName: "Tran Van A" },
        ],
      });
      faceMock.recognize.mockResolvedValue({
        decision: "ACCEPT",
        reason: "accepted",
        subject: { subject_id: studentOutside, display_name: "Outside Person" },
        candidates: [{ subject_id: studentOutside, display_name: "Outside Person", similarity: 0.9 }],
        similarity: 0.9,
        margin: 0.6,
        quality: {},
        quality_score: 0.9,
        event_id: 203,
        model_version: "buffalo_l",
      });
      eventsMock.create.mockResolvedValue({ id: "event-outside" });

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("UNKNOWN");
      expect(result.reason).toBe("subject_not_in_roster");
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });

    it("forces REVIEW when one face matches two roster members almost equally", async () => {
      const studentA = "student:11111111-1111-1111-1111-111111111111";
      const studentB = "student:22222222-2222-2222-2222-222222222222";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
        attendanceState: "OPEN",
        endTime: "11:30",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({
        participants: [
          { id: studentA, code: "SV01", fullName: "Tran Van A" },
          { id: studentB, code: "SV02", fullName: "Tran Van B" },
        ],
      });
      faceMock.recognize.mockResolvedValue({
        decision: "ACCEPT",
        reason: "accepted",
        subject: { subject_id: studentA, display_name: "Tran Van A" },
        candidates: [
          { subject_id: studentA, display_name: "Tran Van A", similarity: 0.88 },
          { subject_id: studentB, display_name: "Tran Van B", similarity: 0.76 },
        ],
        similarity: 0.88,
        margin: 0.12,
        quality: {},
        quality_score: 0.9,
        event_id: 205,
        model_version: "buffalo_l",
      });
      eventsMock.create.mockResolvedValue({ id: "event-ambiguous" });
      reviewsMock.findOrCreate.mockResolvedValue([{ id: "rev-ambiguous" }, true]);

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("REVIEW");
      expect(result.reason).toBe("ambiguous_identity");
      expect(result.reviewId).toBe("rev-ambiguous");
      expect(reviewsMock.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ suggestedSubjectId: studentA }),
        }),
      );
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });

    it("creates a review item when decision is REVIEW", async () => {
      const studentId = "student:11111111-1111-1111-1111-111111111111";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
        attendanceState: "OPEN",
        endTime: "11:30",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({
        participants: [
          { id: studentId, code: "SV01", fullName: "Tran Van A" },
        ],
      });
      faceMock.recognize.mockResolvedValue({
        decision: "REVIEW",
        reason: "margin_too_low",
        subject: null,
        candidates: [{ subject_id: studentId, display_name: "Tran Van A", similarity: 0.42 }],
        similarity: 0.42,
        margin: 0.05,
        quality: {},
        quality_score: 0.7,
        event_id: 204,
        model_version: "buffalo_l",
      });
      eventsMock.create.mockResolvedValue({ id: "event-review" });
      reviewsMock.findOrCreate.mockResolvedValue([{ id: "rev-1" }, true]);

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("REVIEW");
      expect(result.reviewId).toBe("rev-1");
      expect(reviewsMock.findOrCreate).toHaveBeenCalled();
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });
  });

  describe("review resolution", () => {
    const studentId = "student:11111111-1111-1111-1111-111111111111";
    beforeEach(() => {
      sessionsMock.findByPk.mockResolvedValue({ id: "session-1", courseOfferingId: "offering-1", status: "held" });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({ participants: [{ id: studentId, fullName: "Tran Van A", code: "HV01" }] });
      reviewsMock.findByPk.mockResolvedValue({ id: "review-1", teachingSessionId: "session-1", eventId: "event-1", suggestedSubjectId: studentId, status: "PENDING", update: jest.fn<any>().mockResolvedValue({}) });
      eventsMock.findByPk.mockResolvedValue({ faceEventId: "101", top1SubjectId: studentId, top1Score: "0.4" });
      attendanceMock.findOrCreate.mockResolvedValue([{ id: "attendance-1" }, true]);
    });

    it("records the suggested participant and resolves the review atomically", async () => {
      const result = await service.resolveReview("review-1", { resolution: "ACCEPT_SUGGESTED", status: "LATE" }, { id: "staff-1" } as any);
      expect(result).toEqual({ reviewId: "review-1", status: "RESOLVED", resolution: "ACCEPT_SUGGESTED", attendanceId: "attendance-1" });
      expect(attendanceMock.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({ defaults: expect.objectContaining({ participantId: studentId, status: "LATE", source: "REVIEW", recordedByStaffId: "staff-1" }) }));
    });

    it("rejects assigning a participant who is not in the roster", async () => {
      await expect(service.resolveReview("review-1", { resolution: "ASSIGN_OTHER", participantId: "student:22222222-2222-2222-2222-222222222222" }, { id: "staff-1" } as any)).rejects.toThrow(BadRequestException);
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });

    it("does not record attendance for a session marked not held", async () => {
      sessionsMock.findByPk.mockResolvedValue({ id: "session-1", courseOfferingId: "offering-1", status: "not_held" });
      await expect(service.resolveReview("review-1", { resolution: "ACCEPT_SUGGESTED" }, { id: "staff-1" } as any)).rejects.toThrow(ConflictException);
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });
  });

  describe("session workflow", () => {
    let session: any;
    beforeEach(() => {
      session = { id: "session-1", courseOfferingId: "offering-1", sessionDate: "2026-10-27", startTime: "08:00", endTime: "11:30", status: "held", attendanceState: "NOT_OPEN", update: jest.fn<any>().mockResolvedValue({}) };
      sessionsMock.findByPk.mockResolvedValue(session);
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({ participants: [
        { id: "student:11111111-1111-1111-1111-111111111111", fullName: "Present" },
        { id: "student:22222222-2222-2222-2222-222222222222", fullName: "Absent" },
      ] });
      reviewsMock.count.mockResolvedValue(0);
      attendanceMock.findAll.mockResolvedValue([{ participantId: "student:11111111-1111-1111-1111-111111111111", status: "PRESENT" }]);
    });
    it("opens a roster within the allowed window and records the actor", async () => {
      expect(await service.openAttendance("session-1", { id: "staff-1" } as any)).toEqual({ state: "OPEN" });
      expect(session.update).toHaveBeenCalledWith(expect.objectContaining({ attendanceState: "OPEN", attendanceOpenedByStaffId: "staff-1" }), expect.anything());
    });
    it("does not reopen a finalized session", async () => {
      session.attendanceState = "CLOSED";
      await expect(service.openAttendance("session-1", { id: "staff-1" } as any)).rejects.toThrow(ConflictException);
      expect(session.update).not.toHaveBeenCalled();
    });
    it("rejects scans before opening without calling recognition", async () => {
      await expect(service.recognize("session-1", { buffer: Buffer.from("frame") } as any, {}, {} as any)).rejects.toThrow(ConflictException);
      expect(faceMock.recognize).not.toHaveBeenCalled();
    });
    it("blocks closing while a case still requires review", async () => {
      session.attendanceState = "OPEN";
      reviewsMock.count.mockResolvedValue(1);
      await expect(service.closeAttendance("session-1", { id: "staff-1" } as any)).rejects.toThrow(ConflictException);
      expect(attendanceMock.bulkCreate).not.toHaveBeenCalled();
      expect(session.update).not.toHaveBeenCalled();
    });
    it("marks only missing roster members absent and preserves existing records", async () => {
      session.attendanceState = "OPEN";
      expect(await service.closeAttendance("session-1", { id: "staff-1" } as any)).toEqual({ state: "CLOSED", absentCount: 1 });
      expect(attendanceMock.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({ participantId: "student:22222222-2222-2222-2222-222222222222", status: "ABSENT", source: "SYSTEM" }),
      ], expect.anything());
      expect(session.update).toHaveBeenCalledWith(expect.objectContaining({ attendanceState: "CLOSED", attendanceClosedByStaffId: "staff-1" }), expect.anything());
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
    });
    it("rejects closing twice", async () => {
      session.attendanceState = "CLOSED";
      await expect(service.closeAttendance("session-1", {} as any)).rejects.toThrow(ConflictException);
      expect(attendanceMock.bulkCreate).not.toHaveBeenCalled();
    });
    it("does not add attendance when the session closes during face inference", async () => {
      session.attendanceState = "OPEN";
      sessionsMock.findByPk.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, attendanceState: "CLOSED" });
      const id = "student:11111111-1111-1111-1111-111111111111";
      faceMock.recognize.mockResolvedValue({ decision: "ACCEPT", subject: { subject_id: id }, candidates: [{ subject_id: id, similarity: 0.9 }], event_id: 1, quality: {}, model_version: "test" });
      await expect(service.recognize("session-1", { buffer: Buffer.from("image") } as any, {}, {} as any)).rejects.toThrow(ConflictException);
      expect(attendanceMock.findOrCreate).not.toHaveBeenCalled();
      expect(eventsMock.create).not.toHaveBeenCalled();
    });
    it("measures roster, inference, lock wait and transaction completion separately", async () => {
      session.attendanceState = "OPEN";
      sessionsMock.findByPk.mockImplementation(async () => { jest.advanceTimersByTime(10); return session; });
      schedulingMock.getCourseOfferingRoster.mockImplementation(async () => {
        jest.advanceTimersByTime(20);
        return { participants: [{ id: "student:11111111-1111-1111-1111-111111111111" }] };
      });
      faceMock.recognize.mockImplementation(async () => {
        jest.advanceTimersByTime(30);
        return { decision: "UNKNOWN", reason: "below_threshold", candidates: [], event_id: null,
          quality: {}, model_version: "test", capture_reused: true, threshold_accept: 0.45, threshold_review: 0.35 };
      });
      eventsMock.create.mockImplementation(async () => { jest.advanceTimersByTime(5); return { id: "event-1" }; });
      sequelizeMock.transaction.mockImplementation(async (callback: any) => {
        const result = await callback({ LOCK: { UPDATE: "UPDATE" } });
        jest.advanceTimersByTime(7);
        return result;
      });
      const result = await service.recognize("session-1", { buffer: Buffer.from("image") } as any,
        { captureToken: "opaque-token" }, {} as any);
      expect(result.timings).toEqual({ sessionMs: 10, rosterMs: 20, faceServiceMs: 30, persistenceMs: 22, totalMs: 82 });
      expect(result.captureReused).toBe(true);
      expect(faceMock.recognize).toHaveBeenCalledWith(expect.objectContaining({ captureToken: "opaque-token", captureContext: "session-1" }));
      expect(eventsMock.create).toHaveBeenCalledWith(expect.objectContaining({ thresholdAccept: "0.45", thresholdReview: "0.35" }), expect.anything());
    });
    it("never marks students absent for a cancelled class", async () => {
      session.attendanceState = "OPEN"; session.status = "not_held";
      await expect(service.closeAttendance("session-1", {} as any)).rejects.toThrow(ConflictException);
      expect(attendanceMock.bulkCreate).not.toHaveBeenCalled();
    });
  });
});
