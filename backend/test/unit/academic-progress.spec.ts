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
it("requires credits within each elective group rather than just a total", () => {
  const curriculum = { electiveGroups: [{ id: "a", name: "A", minCredits: 3 }, { id: "b", name: "B", minCredits: 3 }] };
  const result = academicProgress(card([subject(), subject({ id: "a1", isRequired: false, electiveGroupId: "a", credits: 6 })], curriculum));
  expect(result.completed).toBe(false);
  expect(result.blockers).toContainEqual(expect.objectContaining({ code: "ELECTIVE_MINIMUM", groupId: "b" }));
});
it("allows unselected electives once the configured group minimum is fulfilled", () => {
  const curriculum = { electiveGroups: [{ id: "a", minCredits: 3 }] };
  expect(academicProgress(card([subject({ isRequired: false, electiveGroupId: "a" }), subject({ id: "s2", isRequired: false, electiveGroupId: "a", grade: null })], curriculum)).completed).toBe(true);
});
it("keeps ungrouped electives mandatory for the complete curriculum selected by the class", () => {
  expect(academicProgress(card([subject({ isRequired: false, grade: null })])).completed).toBe(false);
});
it("treats the default zero elective maximum as uncapped, while rejecting a positive maximum below the minimum", () => {
  const subjects = [subject({ isRequired: false, electiveGroupId: "a" })];
  expect(academicProgress(card(subjects, { electiveGroups: [{ id: "a", minCredits: 3, maxCredits: 0 }] })).completed).toBe(true);
  expect(academicProgress(card(subjects, { electiveGroups: [{ id: "a", minCredits: 3, maxCredits: 2 }] })).completed).toBe(false);
});
it("checks block minima and does not count an aliased course twice", () => {
  const result = academicProgress(card([subject({ canonicalSubjectId: "root", blockId: "b" }), subject({ id: "alias", canonicalSubjectId: "root", blockId: "b" })], { blocks: [{ id: "b", name: "B", minCredits: 6 }] }));
  expect(result).toMatchObject({ earnedCredits: 3, completed: false });
});
