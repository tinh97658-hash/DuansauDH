import { describe, expect, it } from "@jest/globals";
import { resolveFaceAttendanceStatus } from "../../src/attendance/attendance-policy.js";

describe("resolveFaceAttendanceStatus", () => {
  it("marks PRESENT when check-in is before start time + lateAfterMinutes", () => {
    const session = {
      sessionDate: "2026-10-27",
      startTime: "08:00",
    };
    // 08:05 is within 15 minutes
    const now = new Date("2026-10-27T08:05:00+07:00");
    const status = resolveFaceAttendanceStatus(session, {
      lateAfterMinutes: 15,
      now,
    });
    expect(status).toBe("PRESENT");
  });

  it("marks LATE when check-in is after start time + lateAfterMinutes", () => {
    const session = {
      sessionDate: "2026-10-27",
      startTime: "08:00",
    };
    // 08:20 is 20 minutes after 08:00, exceeding 15 minutes grace
    const now = new Date("2026-10-27T08:20:00+07:00");
    const status = resolveFaceAttendanceStatus(session, {
      lateAfterMinutes: 15,
      now,
    });
    expect(status).toBe("LATE");
  });

  it("handles fallback to PRESENT if session clock is incomplete", () => {
    const status = resolveFaceAttendanceStatus({} as any, { lateAfterMinutes: 15 });
    expect(status).toBe("PRESENT");
  });
});
