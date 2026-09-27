import {
  AUTO_ASSIGN_METHODS,
  buildGroupNames,
  calculateDistribution,
} from "../../pages/masters/createClassGroups.logic";

describe("create class group distribution", () => {
  test("builds the requested group-name preview", () => {
    expect(buildGroupNames("CNTT2026.{n}", 3, 3)).toEqual([
      "CNTT2026.03",
      "CNTT2026.04",
      "CNTT2026.05",
    ]);
  });

  test("balances 50 students into contiguous block sizes 17/17/16", () => {
    expect(calculateDistribution({
      method: AUTO_ASSIGN_METHODS.BALANCED,
      totalStudents: 50,
      groupCount: 3,
      maxStudents: 40,
    }).counts).toEqual([17, 17, 16]);
  });

  test("fills the first groups before later groups", () => {
    expect(calculateDistribution({
      method: AUTO_ASSIGN_METHODS.FILL_FIRST,
      totalStudents: 50,
      groupCount: 3,
      maxStudents: 40,
    }).counts).toEqual([40, 10, 0]);
  });

  test.each([
    [["20", "15", ""], [20, 15, 15]],
    [["25", "15", ""], [25, 15, 10]],
  ])("calculates the final custom group reactively", (customValues, expected) => {
    expect(calculateDistribution({
      method: AUTO_ASSIGN_METHODS.CUSTOM,
      totalStudents: 50,
      groupCount: 3,
      maxStudents: 40,
      customValues,
      groupNames: ["G1", "G2", "G3"],
    }).counts).toEqual(expected);
  });

  test("reports custom totals that exceed the student count", () => {
    const result = calculateDistribution({
      method: AUTO_ASSIGN_METHODS.CUSTOM,
      totalStudents: 50,
      groupCount: 3,
      maxStudents: 40,
      customValues: ["30", "25", ""],
    });
    expect(result.error).toBe("Đã vượt quá 5 học viên.");
    expect(result.complete).toBe(false);
  });

  test("reports an auto-calculated group over maximum capacity", () => {
    const result = calculateDistribution({
      method: AUTO_ASSIGN_METHODS.CUSTOM,
      totalStudents: 50,
      groupCount: 3,
      maxStudents: 40,
      customValues: ["5", "0", ""],
      groupNames: ["G1", "G2", "G3"],
    });
    expect(result.error).toBe("G3 vượt sĩ số tối đa 40.");
    expect(result.complete).toBe(false);
  });

  test("blocks auto assignment when total capacity is insufficient", () => {
    expect(calculateDistribution({
      method: AUTO_ASSIGN_METHODS.BALANCED,
      totalStudents: 50,
      groupCount: 2,
      maxStudents: 20,
    }).error).toBe("Tổng sức chứa còn thiếu 10 chỗ.");
  });
});
