import { getBusinessWallTime, isSessionStartedInBusinessTimezone, isSessionEndedInBusinessTimezone } from "../../src/scheduling/scheduling-time.js";

describe("Teaching-session start cutoff in Vietnam wall time", () => {
  it.each([
    ["2026-10-19", "13:00", true], ["2026-10-20", "13:00", true],
    ["2026-10-20", "13:00:01", false], ["2026-10-21", "07:00", false],
  ])("date=%s start=%s alreadyStarted=%s", (sessionDate, startTime, started) => {
    expect(isSessionStartedInBusinessTimezone({ sessionDate, startTime }, new Date("2026-10-20T06:00:00Z"))).toBe(started);
  });
  it("handles date rollover without relying on the host's timezone", () => {
    const now = new Date("2026-10-19T17:00:00Z");
    expect(getBusinessWallTime(now)).toBe("2026-10-20 00:00:00");
    expect(isSessionStartedInBusinessTimezone({ sessionDate: "2026-10-20", startTime: "00:00" }, now)).toBe(true);
    expect(isSessionStartedInBusinessTimezone({ sessionDate: "2026-10-20", startTime: "07:00" }, now)).toBe(false);
  });
  it("does not redefine existing end-time confirmation semantics", () => {
    const now = new Date("2026-10-20T06:00:00Z");
    expect(isSessionStartedInBusinessTimezone({ sessionDate: "2026-10-20", startTime: "13:00" }, now)).toBe(true);
    expect(isSessionEndedInBusinessTimezone({ sessionDate: "2026-10-20", endTime: "17:00" }, now)).toBe(false);
  });
});
