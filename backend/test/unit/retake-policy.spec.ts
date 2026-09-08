import { commonWeekdays, isEarlierAcademicYear } from "../../src/scheduling/retake-policy.js";

describe("real scheduling composition", () => {
  it("intersects the selected groups and explicit retake days", () => {
    expect(commonWeekdays([{ allowedWeekdays: [1, 3, 5] }, { allowedWeekdays: [3, 6] }])).toEqual([3]);
    expect(commonWeekdays([{ allowedWeekdays: [1] }, { allowedWeekdays: [0, 6] }])).toEqual([]);
  });
  it("allows unrestricted legacy groups without generating learners or sessions", () => {
    expect(commonWeekdays([{}])).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
  it("only permits earlier known cohorts, never the same cohort or an unknown year", () => {
    expect(isEarlierAcademicYear("2025", "2026")).toBe(true);
    expect(isEarlierAcademicYear("K66", "K67")).toBe(true);
    expect(isEarlierAcademicYear("2026", "2026")).toBe(false);
    expect(isEarlierAcademicYear("2027", "2026")).toBe(false);
    expect(isEarlierAcademicYear("", "2026")).toBe(false);
  });
});
