const vietnameseNames = new Intl.Collator("vi", { usage: "sort", sensitivity: "base" });
const compareKey = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

// Canonical read/display order. Stored sort_order and block relations are untouched.
type SubjectOrderKey = {
  name?: string | null; code?: string | null; subjectId?: string | null; id?: string | null;
};
export function sortCurriculumSubjectsByVietnameseName<T extends SubjectOrderKey>(
  items: readonly T[], subjectKey: (item: T) => SubjectOrderKey = item => item,
): T[] {
  return [...items].sort((leftItem, rightItem) => {
    const left = subjectKey(leftItem), right = subjectKey(rightItem);
    return vietnameseNames.compare(left.name ?? "", right.name ?? "")
      || compareKey(left.code ?? "", right.code ?? "")
      || compareKey(left.subjectId ?? left.id ?? "", right.subjectId ?? right.id ?? "");
  });
}
