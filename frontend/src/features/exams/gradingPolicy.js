export const POLICY_COMPONENTS = [
  ["testScore", "Điểm kiểm tra"], ["assignmentScore", "Điểm BTL/TL/KT"], ["examScore", "Điểm thi hết môn"],
];
export const DEFAULT_GRADING_POLICY = {
  version: 0, weights: { testScore: 25, assignmentScore: 25, examScore: 50 },
  minimums: { testScore: 4, assignmentScore: 4, examScore: 4 }, courseMinimum: 5.5, useDefaultBands: true,
  bands: [
    { minimum: 9, letter: "A+", grade4: 4 }, { minimum: 8.5, letter: "A", grade4: 4 },
    { minimum: 8, letter: "B+", grade4: 3.5 }, { minimum: 7, letter: "B", grade4: 3 },
    { minimum: 6.5, letter: "C+", grade4: 2.5 }, { minimum: 5.5, letter: "C", grade4: 2 },
    { minimum: 5, letter: "D+", grade4: 1.5 }, { minimum: 4, letter: "D", grade4: 1 },
    { minimum: 0, letter: "F", grade4: 0 },
  ],
};
export const clonePolicy = policy => JSON.parse(JSON.stringify(policy || DEFAULT_GRADING_POLICY));
const number = value => String(value ?? "").trim() === "" ? NaN : Number(String(value).replace(",", "."));
export const numericPolicy = policy => ({
  ...policy,
  weights: Object.fromEntries(POLICY_COMPONENTS.map(([key]) => [key, number(policy.weights[key])])),
  minimums: Object.fromEntries(POLICY_COMPONENTS.map(([key]) => [key, number(policy.minimums[key])])),
  courseMinimum: number(policy.courseMinimum),
  bands: (policy.useDefaultBands ? DEFAULT_GRADING_POLICY.bands : policy.bands)
    .map(band => ({ minimum: number(band.minimum), grade4: number(band.grade4), letter: String(band.letter).trim().toUpperCase() }))
    .sort((a, b) => b.minimum - a.minimum),
});
export function policyError(draft) {
  const policy = numericPolicy(draft);
  for (const [key] of POLICY_COMPONENTS) {
    if (!Number.isFinite(policy.weights[key]) || policy.weights[key] < 0 || policy.weights[key] > 100) return "Tỷ trọng phải từ 0 đến 100%.";
    if (!Number.isFinite(policy.minimums[key]) || policy.minimums[key] < 0 || policy.minimums[key] > 10) return "Điểm tối thiểu phải từ 0 đến 10.";
  }
  if (Math.abs(POLICY_COMPONENTS.reduce((sum, [key]) => sum + policy.weights[key], 0) - 100) > 0.000001) return "Tổng ba tỷ trọng phải bằng 100%.";
  if (!Number.isFinite(policy.courseMinimum) || policy.courseMinimum < 0 || policy.courseMinimum > 10) return "Điểm học phần tối thiểu phải từ 0 đến 10.";
  if (!policy.bands.length || policy.bands.length > 20 || policy.bands[policy.bands.length - 1].minimum !== 0) return "Bảng quy đổi phải có mức bắt đầu từ 0 và tối đa 20 mức.";
  for (let index = 0; index < policy.bands.length; index++) {
    const band = policy.bands[index];
    if (!Number.isFinite(band.minimum) || band.minimum < 0 || band.minimum > 10) return "Ngưỡng thang 10 phải từ 0 đến 10.";
    if (!Number.isFinite(band.grade4) || band.grade4 < 0 || band.grade4 > 4) return "Điểm quy đổi thang 4 phải từ 0 đến 4.";
    if (!band.letter || band.letter.length > 10) return "Mỗi mức quy đổi phải có điểm chữ, tối đa 10 ký tự.";
    if (index && policy.bands[index - 1].minimum === band.minimum) return "Các ngưỡng thang 10 không được trùng nhau.";
    if (index && policy.bands[index - 1].grade4 < band.grade4) return "Thang 4 không được giảm khi điểm thang 10 tăng.";
  }
  return "";
}
export function calculatePolicyGrade(row, policy = DEFAULT_GRADING_POLICY) {
  const active = POLICY_COMPONENTS.filter(([key]) => Number(policy.weights[key]) > 0);
  const scores = Object.fromEntries(active.map(([key]) => [key, number(row[key])]));
  const result = row.examExempt ? "exempt" : "pending";
  if (active.some(([key]) => !Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 10)) return { courseScore: null, grade4: null, letterGrade: "", result };
  const weighted = active.reduce((sum, [key]) => sum + scores[key] * Number(policy.weights[key]) / 100, 0);
  const courseScore = Math.round((weighted + Number.EPSILON * 10) * 10) / 10;
  const band = [...policy.bands].sort((a, b) => Number(b.minimum) - Number(a.minimum)).find(band => courseScore >= Number(band.minimum));
  const passed = active.every(([key]) => scores[key] >= Number(policy.minimums[key])) && courseScore >= Number(policy.courseMinimum);
  return { courseScore, grade4: Number(band.grade4), letterGrade: band.letter, result: row.examExempt ? "exempt" : passed ? "passed" : "failed" };
}

export function announcePolicyChange() {
  try { localStorage.setItem("grading-policy-revision", `${Date.now()}-${Math.random()}`); } catch { /* Same-tab listeners still refresh. */ }
  window.dispatchEvent(new Event("grading-policy-changed"));
}
