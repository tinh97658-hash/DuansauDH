import { catalogRows, seedId, mbaMajorId, robotMajorId, subjectId } from "../../src/database/seeds/realistic-test-catalog.js";
import { scenarioRows, fixtureAnchor, curriculumId, classId } from "../../src/database/seeds/realistic-test-fixture.js";
import { assertPreserved } from "../../src/database/seeds/realistic-test-audit.js";

describe("realistic reference and test fixture", () => {
  const catalog = catalogRows();
  const scenarios = scenarioRows();
  it("keeps official identities separate from test identities and removed fields", () => {
    expect(catalog.filter(row => row.model === "Discipline")).toHaveLength(10);
    expect(catalog.filter(row => row.model === "Major")).toHaveLength(13);
    expect(catalog.some(row => row.model === "Major" && "code" in row.values)).toBe(false);
    expect(catalog.filter(row => row.model === "Subject" && row.values.canonicalSubjectId).every(row => !row.values.allowCrossMajor)).toBe(true);
    expect([...catalog, ...scenarios].some(row => "semester" in row.values || "term" in row.values)).toBe(false);
    expect(new Set([...catalog, ...scenarios].map(row => row.values.id)).size).toBe(catalog.length + scenarios.length);
    expect(scenarios.filter(row => row.model === "AdmissionRecord").every(row => row.values.email.endsWith("@example.invalid") && row.values.extraData.seed === "SEED_TEST_2026")).toBe(true);
  });
  it("uses one Subject per Robot code while both 60-credit alternatives remain complete", () => {
    for (const code of ["CKHM515", "CKHN517"]) {
      expect(catalog.filter(row => row.model === "Subject" && row.values.id === subjectId(robotMajorId, code))).toHaveLength(1);
      expect(scenarios.filter(row => row.model === "CurriculumSubject" && row.values.subjectId === subjectId(robotMajorId, code))).toHaveLength(2);
    }
    for (const key of ["ROBOT26A", "ROBOT26B"]) {
      const entries = scenarios.filter(row => row.model === "CurriculumSubject" && row.values.curriculumId === curriculumId(key));
      expect(entries.reduce((sum, row) => sum + row.values.credits, 0)).toBe(60);
      expect(new Set(entries.map(row => row.values.subjectId)).size).toBe(entries.length);
      expect(entries.filter(row => !row.values.isRequired).reduce((sum, row) => sum + row.values.credits, 0)).toBe(10);
    }
    expect(scenarios.find(row => row.model === "Curriculum" && row.values.majorId === mbaMajorId)?.values.totalCredits).toBe(44);
  });
  it("sets up varied classes and actual admission threshold cases", () => {
    for (const [key, count] of [["EMPTY", 0], ["SMALL", 3], ["NEAR", 19], ["FULL", 20], ["LONG", 30]]) {
      expect(scenarios.filter(row => row.model === "ClassGroupMember" && row.values.classGroupId === classId(String(key)))).toHaveLength(Number(count));
    }
    const inputs = scenarios.filter(row => row.model === "AdmissionEvaluation").map(row => row.values.inputs.manualTotal);
    expect(inputs).toEqual(expect.arrayContaining([14, 15, 18]));
    expect(scenarios.filter(row => row.model === "AdmissionRecord").map(row => row.values.status)).toEqual(expect.arrayContaining(["pending", "approved", "rejected"]));
  });
  it("creates no room, lecturer or group overlap and no completed offering with unresolved sessions", () => {
    const sessions = scenarios.filter(row => row.model === "TeachingSession").map(row => row.values);
    const links = scenarios.filter(row => row.model === "CourseOfferingClassGroup").map(row => row.values);
    for (const [n, a] of sessions.entries()) for (const b of sessions.slice(n + 1)) {
      if (a.sessionDate !== b.sessionDate || a.period !== b.period) continue;
      expect(a.roomId).not.toBe(b.roomId); expect(a.lecturerId).not.toBe(b.lecturerId);
      expect(links.some(ga => ga.courseOfferingId === a.courseOfferingId && links.some(gb => gb.courseOfferingId === b.courseOfferingId && gb.classGroupId === ga.classGroupId))).toBe(false);
    }
    expect(sessions.some(row => row.status === "planned" && row.sessionDate < fixtureAnchor)).toBe(true);
    expect(sessions.some(row => row.status === "planned" && row.sessionDate > fixtureAnchor)).toBe(true);
    expect(sessions.map(row => row.status)).toEqual(expect.arrayContaining(["held", "not_held", "planned"]));
    for (const row of scenarios.filter(row => row.model === "CourseOffering" && row.values.status === "completed")) {
      const owned = sessions.filter(session => session.courseOfferingId === row.values.id);
      expect(owned.some(session => session.status === "held")).toBe(true);
      expect(owned.some(session => session.status === "planned")).toBe(false);
    }
  });
  it("fails preservation checks for an update or deletion while accepting insertions", () => {
    const before = { counts: { subjects: 1 }, fingerprints: { subjects: new Map([["original", "hash"]]) } };
    const after = { counts: { subjects: 2 }, fingerprints: { subjects: new Map([["original", "hash"], ["new", "other"]]) } };
    expect(assertPreserved(before, after)).toBe(1);
    after.fingerprints.subjects.set("original", "changed");
    expect(() => assertPreserved(before, after)).toThrow("changed or missing");
    after.fingerprints.subjects.delete("original");
    expect(() => assertPreserved(before, after)).toThrow("changed or missing");
    expect(seedId("retake")).toBe(seedId("retake"));
  });
});
