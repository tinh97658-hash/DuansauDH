const normalizedCode = value => String(value ?? "").trim().toUpperCase();

export function findSubjectCodeConflict(subjects, identity, excludeId) {
  const scoped = subjects.filter(subject => subject.id !== excludeId
    && (subject.program || identity.program) === identity.program
    && subject.majorId === identity.majorId);
  const codeNumber = scoped.some(subject => Number(subject.codeNumber) === Number(identity.codeNumber));
  const codeText = scoped.some(subject => normalizedCode(subject.codeText) === normalizedCode(identity.codeText));
  return codeNumber || codeText ? { codeNumber, codeText } : null;
}

export function subjectDuplicateMessage(identity, conflict) {
  const codes = [conflict.codeNumber && `mã số ${Number(identity.codeNumber)}`, conflict.codeText && `mã chữ ${normalizedCode(identity.codeText)}`].filter(Boolean).join(" và ");
  return `Học phần có ${codes} đã tồn tại trong chuyên ngành này. Vui lòng sử dụng mã khác.`;
}
