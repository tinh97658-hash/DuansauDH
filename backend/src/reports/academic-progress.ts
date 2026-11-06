// Coursework only: this does not make a graduation/degree decision or invent GPA.
export function academicProgress(scorecard: any) {
  const subjects: any[] = scorecard.subjects || [];
  const blockers: any[] = [];
  if (!scorecard.curriculum || !subjects.length) blockers.push({ code: "NO_CURRICULUM", message: "Chưa có CTĐT với danh sách học phần." });
  const earned = new Set<string>();
  for (const subject of subjects) {
    const grade = subject.grade;
    const final = grade?.details?.finalized === true || grade?.details?.source === "recognition";
    const passed = ["passed", "exempt"].includes(grade?.result);
    if (passed && final) earned.add(subject.id);
    if (!earned.has(subject.id)) blockers.push({ code: passed ? "UNFINALIZED" : "REQUIRED_SUBJECT",
      subjectId: subject.id, message: `${subject.name}: ${passed ? "điểm chưa được duyệt/khóa" : "chưa hoàn thành học phần trong CTĐT áp dụng"}.` });
  }
  const credits = (rows: any[]) => [...new Map(rows.filter(row => earned.has(row.id))
    .map(row => [row.canonicalSubjectId || row.id, Number(row.credits || 0)])).values()].reduce((sum: number, value: number) => sum + value, 0);
  return { scope: "coursework", completed: blockers.length === 0, earnedCredits: credits(subjects),
    totalSubjects: subjects.length, completedSubjects: earned.size, electiveGroups: [], blockers,
    graduationEligible: null, gpa: null };
}
