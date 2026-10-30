import { describe, expect, it } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AttendanceTelemetryDto, RecognizeAttendanceDto } from "../../src/attendance/attendance.dto.js";

const metrics = { outcome: "ACCEPT", captureMs: 700, recognitionHttpMs: 120, uiCommitMs: 3, totalMs: 823, frameCount: 3 };

describe("attendance diagnostic inputs", () => {
  it("accepts bounded numeric measurements and strips extra fields", async () => {
    const dto = plainToInstance(AttendanceTelemetryDto, { ...metrics, image: "must-not-log", eventId: "11111111-1111-4111-8111-111111111111" });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto).not.toHaveProperty("image");
  });
  it.each([{ totalMs: -1 }, { captureMs: Infinity }, { totalMs: 600001 }, { frameCount: 7 }, { outcome: "PRESENT" }, { eventId: "not-uuid" }])("rejects invalid diagnostic values %j", async (invalid) => {
    expect((await validate(plainToInstance(AttendanceTelemetryDto, { ...metrics, ...invalid }))).length).toBeGreaterThan(0);
  });
  it("keeps tokens optional for older clients and bounds supplied tokens", async () => {
    expect(await validate(plainToInstance(RecognizeAttendanceDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(RecognizeAttendanceDto, { captureToken: "a".repeat(43) }))).toHaveLength(0);
    expect((await validate(plainToInstance(RecognizeAttendanceDto, { captureToken: "a".repeat(129) }))).length).toBeGreaterThan(0);
  });
});
