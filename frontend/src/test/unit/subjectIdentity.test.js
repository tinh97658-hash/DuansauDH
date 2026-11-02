import { findSubjectCodeConflict, subjectDuplicateMessage } from "../../utils/subjectIdentity";

const existing = { id: "self", program: "masters", majorId: "m1", codeNumber: 102, codeText: "EF" };
it("blocks the pair regardless of case, padding or other metadata", () => {
  const candidate = { ...existing, id: undefined, codeText: " ef ", name: "Another name", credits: 9 };
  const conflict = findSubjectCodeConflict([existing], candidate);
  expect(conflict).toEqual({ codeNumber: true, codeText: true });
  expect(subjectDuplicateMessage(candidate, conflict)).toContain("mã số 102 và mã chữ EF");
});
it.each([{ codeNumber: 103, codeText: "GH" }, { majorId: "m2" }, { program: "doctoral" }])(
  "allows changing one identity dimension: %j", change => {
    expect(findSubjectCodeConflict([existing], { ...existing, id: undefined, ...change })).toBeNull();
  },
);
it("allows keeping the edited record's own identity", () => {
  expect(findSubjectCodeConflict([existing], existing, existing.id)).toBeNull();
});
it.each([[103, " ef ", false, true], [102, "EG", true, false]])("blocks independent conflicts %s/%s", (codeNumber, codeText, number, text) => {
  const identity = { ...existing, codeNumber, codeText };
  const conflict = findSubjectCodeConflict([existing], identity);
  expect(conflict).toEqual({ codeNumber: number, codeText: text });
  const message = subjectDuplicateMessage(identity, conflict);
  expect(message.includes("mã số")).toBe(number);
  expect(message.includes("mã chữ")).toBe(text);
});
