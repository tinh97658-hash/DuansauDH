import {
  addDays, formatDateKey, getBusinessTodayKey, getBusinessWallTime, isPeriodTimeConsistent, normalizeTimeInput, getRoomFloor, isSessionPast, mondayOf, parseLocalDate, timesOverlap, validTimeRange, weekDaysFrom,
} from "../../utils/schedulingCalendar";

describe("scheduling calendar date and overlap rules", () => {
  it("starts a normal week on Monday", () => {
    expect(formatDateKey(mondayOf("2026-09-09"))).toBe("2026-09-07");
  });

  it("maps Sunday back to the preceding Monday", () => {
    expect(formatDateKey(mondayOf("2026-09-13"))).toBe("2026-09-07");
  });

  it("builds all seven days through Sunday", () => {
    expect(weekDaysFrom(parseLocalDate("2026-09-07")).map(formatDateKey)).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
  });

  it("moves between weeks without UTC date drift", () => {
    expect(formatDateKey(addDays(parseLocalDate("2026-09-07"), 7))).toBe("2026-09-14");
  });

  it("detects a strict time overlap", () => {
    expect(timesOverlap("08:00", "10:00", "09:30", "11:00")).toBe(true);
  });

  it("allows adjacent non-overlapping sessions", () => {
    expect(timesOverlap("08:00", "10:00", "10:00", "12:00")).toBe(false);
  });

  it("rejects an empty or reversed time range", () => {
    expect(validTimeRange("", "10:00")).toBe(false);
    expect(validTimeRange("11:00", "10:00")).toBe(false);
  });

  it("derives the official room floor from the first code digit", () => {
    expect(getRoomFloor("301")).toBe(3);
    expect(getRoomFloor("502")).toBe(5);
    expect(getRoomFloor("A301")).toBeNull();
  });

  it("derives pending confirmation from a past planned session without persisting pending", () => {
    expect(isSessionPast({ sessionDate: "2026-09-01", endTime: "10:00" }, new Date(2026, 8, 2, 8))).toBe(true);
    expect(isSessionPast({ sessionDate: "2026-09-03", endTime: "10:00" }, new Date(2026, 8, 2, 8))).toBe(false);
  });

  it("uses the exact end second rather than a Morning/Afternoon cutoff", () => {
    const now = new Date("2026-09-02T03:00:01Z");
    expect(isSessionPast({ sessionDate: "2026-09-02", endTime: "10:00:00", period: "AFTERNOON" }, now)).toBe(true);
    expect(isSessionPast({ sessionDate: "2026-09-02", endTime: "10:00:02", period: "MORNING" }, now)).toBe(false);
  });
});
describe("Vietnam wall time and friendly exact-time input", () => {
  it("uses Vietnam wall time for fixed UTC instants, including its next day", () => {
    const now = new Date("2026-09-05T03:30:00Z");
    expect(getBusinessWallTime(now)).toBe("2026-09-05 10:30:00");
    expect(isSessionPast({ sessionDate: "2026-09-05", endTime: "10:20" }, now)).toBe(true);
    expect(isSessionPast({ sessionDate: "2026-09-05", endTime: "10:45" }, now)).toBe(false);
    expect(getBusinessTodayKey(new Date("2026-09-05T18:00:00Z"))).toBe("2026-09-06");
  });
  it("does not read browser-local date/time getters", () => {
    const now = new Date("2026-09-05T03:30:00Z");
    ["getFullYear", "getMonth", "getDate", "getHours", "getMinutes"].forEach((key) => {
      now[key] = () => { throw new Error("Local timezone must not be read"); };
    });
    expect(getBusinessWallTime(now)).toBe("2026-09-05 10:30:00");
  });
  it.each([["930", "09:30"], ["0930", "09:30"], ["9:30", "09:30"], ["09:30", "09:30"], ["9:5", "09:05"]])("normalizes %s on demand", (raw, expected) => {
    expect(normalizeTimeInput(raw)).toBe(expected);
  });
  it.each(["2400", "24:00", "25:10", "12:60", "abc", "", " "])("rejects %s", (raw) => {
    expect(normalizeTimeInput(raw)).toBeNull();
  });
  it.each([["MORNING", "10:00", "12:00", true], ["MORNING", "13:00", "15:00", false],
    ["MORNING", "11:30", "13:00", false], ["AFTERNOON", "12:00", "14:00", true],
    ["AFTERNOON", "19:00", "22:00", true], ["AFTERNOON", "09:00", "11:00", false]])("validates %s %s–%s", (period, start, end, expected) => {
    expect(isPeriodTimeConsistent(period, start, end)).toBe(expected);
  });
});
