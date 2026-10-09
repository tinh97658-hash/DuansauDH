import {
  AUTO_ASSIGN_METHODS,
  buildGroupNames,
  calculateDistribution,
  getNextGroupIndex,
  getAvailableGroupIndexes,
} from "../../pages/masters/createClassGroups.logic";

describe("create class group distribution", () => {
  test("fills missing group 01 before advancing past groups 02 and 03", () => {
    const groups = [{ name: "QLCVATHH 2026.02" }, { name: "QLCVATHH 2026.03" }];
    expect(getNextGroupIndex(groups, "QLCVATHH 2026.{n}")).toBe(1);
    expect(getAvailableGroupIndexes(groups, "QLCVATHH 2026.{n}", 3)).toEqual([1, 4, 5]);
  });

  test("fills gaps while ignoring unrelated name templates", () => {
    expect(getAvailableGroupIndexes([
      { name: "CNTT2026.01" }, { name: "CNTT2026.03" }, { name: "QLTC2026.02" },
    ], "CNTT2026.{n}", 2)).toEqual([2, 4]);
  });

  test("keeps a major's first group name even when its code is already used", () => {
    const otherGroups = [{ code: "NH2601", name: "QLTC2026.01" }];
    const nameIndex = getNextGroupIndex([], "QLCVATHH2026.{n}");
    const codeIndex = getNextGroupIndex([], "", "NH26", otherGroups);
    expect(buildGroupNames("QLCVATHH2026.{n}", nameIndex, 1)).toEqual(["QLCVATHH2026.01"]);
    expect(codeIndex).toBe(2);
  });

  test("advances past codes used by other majors while keeping names scoped", () => {
    expect(getNextGroupIndex([], "QLCVATHH2026.{n}", "NH26", [
      { code: "NH2601", name: "QLTC2026.01" },
      { code: "OTHER99", name: "QLCVATHH2026.99" },
    ])).toBe(2);
  });

  test("advances past existing names and reserves the entire next batch", () => {
    const groups = [{ code: "LEGACY", name: "CNTT2026.05" }];
    const start = getNextGroupIndex(groups, "CNTT2026.{n}", "NH26", [{ code: "NH2603" }]);
    expect(start).toBe(6);
    expect(buildGroupNames("CNTT2026.{n}", start, 2)).toEqual(["CNTT2026.06", "CNTT2026.07"]);
  });

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
