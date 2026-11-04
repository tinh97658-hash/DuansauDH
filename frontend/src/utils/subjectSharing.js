// Names must match with their accents and case; ignore surrounding whitespace
// and equivalent Unicode encodings only. Subject codes may differ by major.
export const sharedSubjectName = value => String(value || "").normalize("NFC").trim();

export function matchingSharingMajorIds(subject, subjects = []) {
  const name = sharedSubjectName(subject.name);
  const credits = Number(subject.credits);
  if (!name || !Number.isFinite(credits)) return new Set();
  return new Set(subjects.filter(other => other.id !== subject.id && other.majorId !== subject.majorId
    && other.active !== false && other.program === subject.program
    && sharedSubjectName(other.name) === name && Number(other.credits) === credits).map(other => other.majorId));
}
