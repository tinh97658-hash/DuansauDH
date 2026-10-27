import { describe, expect, it, jest, beforeEach } from "@jest/globals";
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

  beforeEach(() => {
    sessionsMock = {
      findByPk: jest.fn(),
    };
    attendanceMock = {
      findOrCreate: jest.fn(),
      findAll: jest.fn(),
    };
    eventsMock = {
      create: jest.fn(),
      findByPk: jest.fn(),
    };
    reviewsMock = {
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
      transaction: jest.fn(async (callback: any) => callback({})),
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
  });

  describe("recognize", () => {
    it("returns UNKNOWN with empty_roster without calling face-service when roster is empty", async () => {
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        status: "planned",
      });
      schedulingMock.getCourseOfferingRoster.mockResolvedValue({ participants: [] });
      eventsMock.create.mockResolvedValue({ id: "event-empty" });

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("UNKNOWN");
      expect(result.reason).toBe("empty_roster");
      expect(faceMock.recognize).not.toHaveBeenCalled();
    });

    it("creates an attendance record when face-service returns ACCEPT for a roster student", async () => {
      const studentId = "student:11111111-1111-1111-1111-111111111111";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
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
      attendanceMock.findOrCreate.mockResolvedValue([{ id: "att-1" }, true]);

      const file = { buffer: Buffer.from("image"), originalname: "test.jpg", mimetype: "image/jpeg" } as any;
      const result = await service.recognize("session-1", file, {}, { id: "staff-1" } as any);

      expect(result.decision).toBe("ACCEPT");
      expect(result.participant?.id).toBe(studentId);
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

    it("creates a review item when decision is REVIEW", async () => {
      const studentId = "student:11111111-1111-1111-1111-111111111111";
      sessionsMock.findByPk.mockResolvedValue({
        id: "session-1",
        courseOfferingId: "offering-1",
        sessionDate: "2026-10-27",
        startTime: "08:00",
        status: "planned",
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
});
