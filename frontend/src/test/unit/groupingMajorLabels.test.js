import { groupingMajorLabels } from "../../pages/masters/groupingMajorLabels";

const major = (id, name, code) => ({ id, name, code });
test("unique names stay plain and labels remain keyed by ID", () => {
  const result = groupingMajorLabels([major("a", "Kế toán", "KT"), major("b", "Quản trị", "QT")]);
  expect([...result.labels]).toEqual([["a", "Kế toán"], ["b", "Quản trị"]]);
  expect(result.unresolved).toBe(false);
});
test("normalizes Vietnamese case, whitespace and Unicode only for duplicate detection", () => {
  const rows = [major("a", "  Khai  thác hàng hải ", "KTHH"), major("b", "KHAI THÁC HÀNG HẢI".normalize("NFD"), "KTHH2")];
  const original = JSON.stringify(rows);
  const result = groupingMajorLabels(rows);
  expect(result.labels.get("a")).toBe("KTHH — Khai thác hàng hải");
  expect(result.labels.get("b")).toMatch(/^KTHH2 — /);
  expect(JSON.stringify(rows)).toBe(original);
});
test("uses exactly the visible set, retaining inactive records if the selector includes them", () => {
  const a = major("a", "Same", "A");
  const b = { ...major("b", "Same", "B"), active: false };
  expect(groupingMajorLabels([a, b]).labels.get("a")).toBe("A — Same");
  expect(groupingMajorLabels([a]).labels.get("a")).toBe("Same");
});
test("missing codes have a safe label and unresolved catalogs are explicit", () => {
  const result = groupingMajorLabels([major("private-id-a", "Same", null), major("private-id-b", "Same", " ")]);
  expect([...result.labels.values()]).toEqual(["Same (chưa có mã chuyên ngành)", "Same (chưa có mã chuyên ngành)"]);
  expect(result.unresolved).toBe(true);
  expect([...result.labels.values()].join()).not.toMatch(/undefined|null|private-id/);
  expect(groupingMajorLabels([major("a", "Unique")]).labels.get("a")).toBe("Unique");
});
test("one missing code stays distinguishable and duplicate codes are reported", () => {
  expect(groupingMajorLabels([major("a", "Same", "A"), major("b", "Same")]).unresolved).toBe(false);
  expect(groupingMajorLabels([major("a", "Same", "A"), major("b", "Same", "A")]).unresolved).toBe(true);
});
