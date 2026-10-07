import { personNameParts } from "../../utils/personName";

export const SCORE_FIELDS = [
  ["testScore", "Điểm kiểm tra", 10], ["assignmentScore", "Điểm BTL/TL/KT", 10],
  ["examScore", "Điểm thi hết môn", 10], ["courseScore", "Điểm học phần", 10], ["grade4", "Thang điểm 4", 4],
];
export const RESULT_LABELS = { pending: "Chưa có kết quả", passed: "Đạt", failed: "Không đạt", exempt: "Miễn thi" };
export const numericScore = (value) => String(value ?? "").trim() === "" ? null : Number(String(value).trim().replace(",", "."));
export const attemptScores = (value) => String(value ?? "").trim() === "" ? [] : String(value).split(";").map(numericScore);
export const draftOf = (row) => ({
  ...row, ...Object.fromEntries(SCORE_FIELDS.map(([key]) => [key, row[key] == null ? "" : String(row[key])])),
  letterGrade: row.letterGrade || "", attemptScores: (row.attemptScores || []).join("; "),
});
export const rowError = (row) => {
  for (const [key, label, max] of SCORE_FIELDS) {
    const value = numericScore(row[key]);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > max)) return `${label} phải từ 0 đến ${max}.`;
  }
  const attempts = attemptScores(row.attemptScores);
  if (attempts.length > 20 || attempts.some((value) => value === null || !Number.isFinite(value) || value < 0 || value > 10)) return "Điểm các lần thi phải từ 0 đến 10, cách nhau bằng dấu chấm phẩy.";
  if (["passed", "failed"].includes(row.result) && numericScore(row.courseScore) === null) return "Nhập điểm học phần trước khi chọn Đạt hoặc Không đạt.";
  return "";
};
export const gradePayload = (row) => ({
  participantId: row.participantId, eligible: row.eligible ?? null, examExempt: row.examExempt,
  ...Object.fromEntries(SCORE_FIELDS.map(([key]) => [key, numericScore(row[key])])),
  letterGrade: row.letterGrade.trim(), attemptScores: attemptScores(row.attemptScores), result: row.result,
});
export const visibleGradeRows = (rows, mode, query) => {
  const search = String(query || "").trim().toLocaleLowerCase("vi");
  return rows.filter((row) => {
    if (mode === "exam" && (row.eligible !== true || row.examExempt)) return false;
    return !search || `${row.code} ${row.fullName}`.toLocaleLowerCase("vi").includes(search);
  });
};
export const gradebookCsv = (rows, blank = false) => {
  const headers = ["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Tư cách", "Miễn thi", ...SCORE_FIELDS.map(([, label]) => label), "Thang điểm chữ", "Điểm các lần thi hết môn", "Kết quả điểm"];
  const values = rows.map((row, index) => {
    const name = personNameParts(row);
    return [index + 1, row.code, name.familyAndMiddle, name.givenName, row.dob, row.gender,
      row.eligible == null ? "Chưa xét" : row.eligible ? "Đủ điều kiện" : "Không đủ điều kiện", row.examExempt ? "Có" : "Không",
      ...SCORE_FIELDS.map(([key]) => blank ? "" : row[key]), blank ? "" : row.letterGrade,
      blank ? "" : row.attemptScores, blank ? "" : RESULT_LABELS[row.result]];
  });
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [headers, ...values].map((row) => row.map(escape).join(",")).join("\r\n");
};
