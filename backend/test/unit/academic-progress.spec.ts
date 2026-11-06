import { academicProgress } from "../../src/reports/academic-progress.js";

const subject = (overrides: any = {}) => ({ id: "s1", name: "Required", credits: 3, isRequired: true,
  grade: { result: "passed", score: 8, details: { finalized: true } }, ...overrides });
const card = (subjects: any[], curriculum: any = {}) => ({ subjects, curriculum: { id: "c1", ...curriculum } });

it("does not treat a missing or empty curriculum as complete", () => {
  expect(academicProgress({}).completed).toBe(false);
  expect(academicProgress(card([])).completed).toBe(false);
});
it("requires every mandatory subject even if total credits look sufficient", () => {
  const result = academicProgress(card([subject({ grade: null }), subject({ id: "extra", credits: 30 })]));
  expect(result.completed).toBe(false);
  expect(result.blockers).toContainEqual(expect.objectContaining({ code: "REQUIRED_SUBJECT", subjectId: "s1" }));
});
it("does not count passing draft marks as confirmed credits", () => {
  const result = academicProgress(card([subject({ grade: { result: "passed", score: 8, details: {} } })]));
  expect(result).toMatchObject({ completed: false, earnedCredits: 0 });
  expect(result.blockers[0].code).toBe("UNFINALIZED");
});
it("accepts approved recognition, without inventing GPA or graduation eligibility", () => {
  expect(academicProgress(card([subject({ grade: { result: "passed", score: 8, details: { source: "recognition" } } })])))
    .toMatchObject({ completed: true, earnedCredits: 3, graduationEligible: null, gpa: null });
});
it("ignores legacy group quotas when every course in the assigned curriculum is complete", () => {
  const result = academicProgress(card([subject({ isRequired: false, electiveGroupId: "old" })], {
    electiveGroups: [{ id: "old", minCredits: 99, maxCredits: 1 }], blocks: [{ id: "old", minCredits: 99 }],
  }));
  expect(result).toMatchObject({ completed: true, earnedCredits: 3, electiveGroups: [] });
});
it.each([true, false])("tracks every listed course independently of its required/elective label: %s", isRequired => {
  const result = academicProgress(card([subject({ isRequired, classOverride: true, grade: null })]));
  expect(result.completed).toBe(false);
  expect(result.blockers).toContainEqual(expect.objectContaining({ subjectId: "s1" }));
});
it("does not count an aliased course twice", () => {
  const result = academicProgress(card([subject({ canonicalSubjectId: "root" }), subject({ id: "alias", canonicalSubjectId: "root" })]));
  expect(result).toMatchObject({ earnedCredits: 3, completed: true });
});
