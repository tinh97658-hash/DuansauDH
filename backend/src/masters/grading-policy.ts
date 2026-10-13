export const COMPONENT_KEYS = ["testScore", "assignmentScore", "examScore"] as const;
export type ComponentKey = typeof COMPONENT_KEYS[number];
export interface GradeBand { minimum: number; letter: string; grade4: number; }
export interface GradingPolicy {
  version: number;
  rulesVersion?: number;
  weights: Record<ComponentKey, number>;
  minimums: Record<ComponentKey, number>;
  courseMinimum: number;
  useDefaultBands: boolean;
  bands: GradeBand[];
}

// Version 0 is permanently the legacy policy. Never change it when introducing new defaults.
export const LEGACY_GRADING_POLICY: GradingPolicy = {
  version: 0,
  weights: { testScore: 25, assignmentScore: 25, examScore: 50 },
  minimums: { testScore: 4, assignmentScore: 4, examScore: 4 },
  courseMinimum: 5.5, useDefaultBands: true,
  bands: [
    { minimum: 9, letter: "A+", grade4: 4 }, { minimum: 8.5, letter: "A", grade4: 4 },
    { minimum: 8, letter: "B+", grade4: 3.5 }, { minimum: 7, letter: "B", grade4: 3 },
    { minimum: 6.5, letter: "C+", grade4: 2.5 }, { minimum: 5.5, letter: "C", grade4: 2 },
    { minimum: 5, letter: "D+", grade4: 1.5 }, { minimum: 4, letter: "D", grade4: 1 },
    { minimum: 0, letter: "F", grade4: 0 },
  ],
};

export function gradingPolicyError(policy: GradingPolicy): string {
  for (const key of COMPONENT_KEYS) {
    if (!Number.isFinite(policy.weights[key]) || policy.weights[key] < 0 || policy.weights[key] > 100) return "Tỷ trọng phải từ 0 đến 100%.";
    if (!Number.isFinite(policy.minimums[key]) || policy.minimums[key] < 0 || policy.minimums[key] > 10) return "Điểm tối thiểu phải từ 0 đến 10.";
  }
  if (Math.abs(COMPONENT_KEYS.reduce((sum, key) => sum + policy.weights[key], 0) - 100) > 0.000001) return "Tổng ba tỷ trọng phải bằng 100%.";
  if (!Number.isFinite(policy.courseMinimum) || policy.courseMinimum < 0 || policy.courseMinimum > 10) return "Điểm học phần tối thiểu phải từ 0 đến 10.";
  const bands = [...policy.bands].sort((a, b) => a.minimum - b.minimum);
  if (!bands.length || bands.length > 20 || bands[0].minimum !== 0) return "Bảng quy đổi phải có mức bắt đầu từ 0 và tối đa 20 mức.";
  for (let index = 0; index < bands.length; index++) {
    const band = bands[index];
    if (!Number.isFinite(band.minimum) || band.minimum < 0 || band.minimum > 10) return "Ngưỡng thang 10 phải từ 0 đến 10.";
    if (!Number.isFinite(band.grade4) || band.grade4 < 0 || band.grade4 > 4) return "Điểm quy đổi thang 4 phải từ 0 đến 4.";
    if (!band.letter?.trim() || band.letter.trim().length > 10) return "Mỗi mức quy đổi phải có điểm chữ, tối đa 10 ký tự.";
    if (index && bands[index - 1].minimum === band.minimum) return "Các ngưỡng thang 10 không được trùng nhau.";
    if (index && bands[index - 1].grade4 > band.grade4) return "Thang 4 không được giảm khi điểm thang 10 tăng.";
  }
  return "";
}
