// Coursework only: this does not make a graduation/degree decision or invent GPA.
export function academicProgress(scorecard: any) {
  const subjects: any[] = scorecard.subjects || [];
  const groups: any[] = scorecard.curriculum?.electiveGroups || [];
  const blocks: any[] = scorecard.curriculum?.blocks || [];
  const blockers: any[] = [];
  if (!scorecard.curriculum || !subjects.length) blockers.push({ code: "NO_CURRICULUM", message: "Chưa có CTĐT với danh sách học phần." });
  const earned = new Set<string>();
  for (const subject of subjects) {
    const grade = subject.grade;
    const final = grade?.details?.finalized === true || grade?.details?.source === "recognition";
    const passed = ["passed", "exempt"].includes(grade?.result);
    if (passed && final) earned.add(subject.id);
    const required = subject.isRequired || !subject.electiveGroupId;
    if (required && !earned.has(subject.id)) blockers.push({ code: passed ? "UNFINALIZED" : "REQUIRED_SUBJECT",
      subjectId: subject.id, message: `${subject.name}: ${passed ? "điểm chưa được duyệt/khóa" : "chưa đạt học phần bắt buộc trong CTĐT áp dụng"}.` });
  }
  const credits = (rows: any[]) => [...new Map(rows.filter(row => earned.has(row.id))
    .map(row => [row.canonicalSubjectId || row.id, Number(row.credits || 0)])).values()].reduce((sum: number, value: number) => sum + value, 0);
  const electiveGroups = groups.map(group => {
    const earnedCredits = credits(subjects.filter(subject => subject.electiveGroupId === group.id));
    const minimum = Number(group.minCredits || 0);
    if (Number(group.maxCredits) > 0 && Number(group.maxCredits) < minimum) blockers.push({ code: "INVALID_ELECTIVE_RULE", groupId: group.id, message: `${group.name}: tín chỉ tối đa nhỏ hơn tối thiểu.` });
    if (earnedCredits < minimum) blockers.push({ code: "ELECTIVE_MINIMUM", groupId: group.id, message: `${group.name}: đạt ${earnedCredits}/${minimum} tín chỉ tự chọn đã chốt.` });
    return { id: group.id, name: group.name, minimum, earnedCredits };
  });
  const knownGroups = new Set(groups.map(group => group.id));
  const identities = new Map<string, string>();
  for (const subject of subjects) {
    const key = subject.canonicalSubjectId || subject.id;
    const groupId = subject.electiveGroupId || "required";
    if (identities.has(key) && identities.get(key) !== groupId) blockers.push({ code: "DUPLICATE_COURSE_IDENTITY", subjectId: subject.id,
      message: `${subject.name}: cùng học phần gốc đang được tính vào nhiều nhóm yêu cầu.` });
    identities.set(key, groupId);
  }
  if (subjects.some(subject => subject.electiveGroupId && !knownGroups.has(subject.electiveGroupId))) {
    blockers.push({ code: "UNKNOWN_ELECTIVE_GROUP", message: "Thiếu cấu hình nhóm học phần tự chọn." });
  }
  for (const block of blocks) {
    const earnedCredits = credits(subjects.filter(subject => subject.blockId === block.id));
    if (earnedCredits < Number(block.minCredits || 0)) blockers.push({ code: "BLOCK_MINIMUM", blockId: block.id,
      message: `${block.name}: chưa đủ ${block.minCredits} tín chỉ của khối kiến thức.` });
  }
  return { scope: "coursework", completed: blockers.length === 0, earnedCredits: credits(subjects),
    totalSubjects: subjects.length, completedSubjects: earned.size, electiveGroups, blockers,
    graduationEligible: null, gpa: null };
}
