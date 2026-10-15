import { examSubjectForGroup } from "../../src/masters/exam-subject-scope.js";

const english = { id: "english-robot", code: "HPTA", name: "Tiếng anh", credits: 3, majorId: "robot" };
const local = { id: "english-it", code: "ITTA", name: "Tiếng anh", credits: 3, majorId: "it" };
const group = (subjects: any[]) => ({ majorId: "it", curriculum: { subjectEntries: subjects.map(subject => ({ subject })) } });

it("resolves the local curriculum code for a shared subject with a different code", () => {
  expect(examSubjectForGroup(group([english, local]), english)).toEqual(local);
});

it("supports every equal-name subject, independent of common-subject flags", () => {
  const source = { ...english, name: "  Trí tuệ   nhân tạo ", code: "CKAI" };
  const target = { ...local, name: "TRÍ TUỆ NHÂN TẠO", code: "ITAI" };
  expect(examSubjectForGroup(group([target]), source)).toEqual(target);
});

it("resolves canonical aliases and avoids an unrelated subject with different credits", () => {
  const alias = { ...local, canonicalSubjectId: english.id, name: "Anh văn" };
  expect(examSubjectForGroup(group([alias]), english)).toEqual(alias);
  expect(examSubjectForGroup(group([{ ...local, credits: 4 }]), english)).toEqual(english);
});
