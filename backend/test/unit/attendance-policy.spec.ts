import { describe, expect, it } from "@jest/globals";
import { attendanceWindow, resolveFaceAttendanceStatus } from "../../src/attendance/attendance-policy.js";

describe("attendance window in Vietnam time", () => {
  const session = { sessionDate: "2026-10-28", startTime: "07:30", endTime: "11:30" };
  it.each([
    ["2026-10-27T23:59:59Z", false], ["2026-10-28T00:00:00Z", true],
    ["2026-10-28T04:30:00Z", true], ["2026-10-28T04:30:01Z", false],
    ["2026-10-29T01:00:00Z", false],
  ])("checks boundary %s", (time, valid) => {
    expect(attendanceWindow(session, new Date(time)).valid).toBe(valid);
  });
});

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
