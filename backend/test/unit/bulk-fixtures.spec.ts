import { buildBulkFixtures, parseBulkOptions } from "../../src/database/bulk-fixtures.js";

describe("bulk database fixtures", () => {
  it("rejects invalid sizes, dates and prefixes before database access", () => {
    for (const args of [["--classes", "0"], ["--students", "2.5"], ["--weeks", "53"],
      ["--start", "2026-02-30"], ["--prefix", "REAL"], ["--grant-scheduling-to", "invalid"], ["--unknown"]]) {
      expect(() => parseBulkOptions(args)).toThrow();
    }
  });

  it("defaults to the business date near a UTC day boundary", () => {
    expect(parseBulkOptions([], new Date("2026-09-06T20:00:00Z")).options.start).toBe("2026-09-07");
  });

  it("creates linked records with unique identities and conflict-free schedules", () => {
    const { options } = parseBulkOptions(["--prefix", "BTTEST", "--classes", "4", "--students", "3", "--subjects", "10", "--weeks", "2", "--start", "2026-12-28"]);
    const batches = buildBulkFixtures(options);
    const rows = (model: string) => batches.find((b) => b.model === model)!.rows;
    expect(rows("AdmissionRecord")).toHaveLength(12);
    expect(rows("TrainingModeGroup")).toHaveLength(1);
    expect(rows("TrainingMode")).toHaveLength(1);
    expect(rows("TrainingLevel")).toHaveLength(1);
    expect(rows("TrainingProgram")).toHaveLength(3);
    expect(rows("TrainingPlan")).toHaveLength(3);
    expect(rows("AdmissionTarget")).toHaveLength(3);
    expect(rows("AnnualFee")).toHaveLength(6);
    expect(rows("CourseOffering")).toHaveLength(20);
    expect(rows("TeachingSession")).toHaveLength(40);
    const ids = new Set(batches.flatMap((b) => b.rows.map((r) => r.id)));
    expect(ids.size).toBe(batches.reduce((sum, b) => sum + b.rows.length, 0));
    for (const batch of batches) for (const row of batch.rows) {
      for (const [key, value] of Object.entries(row)) {
        if (key.endsWith("Id") && value !== null) expect(ids.has(value)).toBe(true);
      }
    }
    for (const field of ["codeNumber", "codeText"]) {
      const keys = rows("Subject").map((r) => `${r.majorId}:${r[field]}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    for (const resource of ["roomId", "lecturerId", "classGroupId"]) {
      const keys = rows("TeachingSession").map((r) => {
        const group = rows("CourseOfferingClassGroup").find((g) => g.courseOfferingId === r.courseOfferingId)!;
        return `${resource === "classGroupId" ? group.classGroupId : r[resource]}:${r.sessionDate}:${r.period}`;
      });
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(rows("TeachingSession").some((r) => r.sessionDate.startsWith("2027-"))).toBe(true);
    for (const session of rows("TeachingSession")) {
      expect(session.startTime < session.endTime).toBe(true);
      expect(session.period === "MORNING" ? session.endTime <= "12:00:00" : session.startTime >= "12:00:00").toBe(true);
    }
  });
});
