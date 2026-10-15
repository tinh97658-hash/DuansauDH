import { failedRetakeMembers, type RetakeResult } from "../../src/scheduling/retake-groups.js";

const result = (overrides: Partial<RetakeResult> = {}): RetakeResult => ({
  classGroupId: "original", subjectId: "english", participantId: "admission:failed", admissionRecordId: "failed",
  code: "HV01", fullName: "Learner", result: "failed", sourceStatus: "completed",
  recordedAt: "2026-10-01T00:00:00Z", bookId: "book1", sourceCourseOfferingId: "source", ...overrides,
});

it("uses only confirmed failures from completed offerings, including zero scores represented as failed", () => {
  const rows = [result(), result({ participantId: "passed", result: "passed" }), result({ participantId: "pending", result: "pending" }),
    result({ participantId: "exempt", result: "exempt" }), result({ participantId: "open", sourceStatus: "active" }),
    result({ participantId: "other-class", classGroupId: "other" }), result({ participantId: "other-subject", subjectId: "math" })];
  expect(failedRetakeMembers(rows, "original", new Set(["english"]))).toEqual([rows[0]]);
});

it.each(["passed", "exempt", "pending"])("does not resurrect an old failure after a later %s attempt under an equivalent code", outcome => {
  const rows = [result(), result({ subjectId: "english-alias", result: outcome, recordedAt: "2026-10-15T00:00:00Z" })];
  expect(failedRetakeMembers(rows, "original", new Set(["english", "english-alias"]))).toEqual([]);
});

it("keeps the latest failed attempt once per learner when the learner fails again", () => {
  const retry = result({ bookId: "book2", sourceCourseOfferingId: "retry", recordedAt: "2026-10-15T00:00:00Z" });
  expect(failedRetakeMembers([retry, result()], "original", new Set(["english"]))).toEqual([retry]);
});

it("keeps a later passing attempt authoritative when an older failed grade is edited afterward", () => {
  const older = result({ attemptedAt: "2026-09-01T00:00:00Z", recordedAt: "2026-10-20T00:00:00Z" });
  const newer = result({ attemptedAt: "2026-10-01T00:00:00Z", recordedAt: "2026-10-15T00:00:00Z", result: "passed" });
  expect(failedRetakeMembers([newer, older], "original", new Set(["english"]))).toEqual([]);
});
