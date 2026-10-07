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
export const displayGradeDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.split("-").reverse().join("/") : date || "—";
export const gradebookColumns = (blank = false) => [
  { key: "index", label: "STT", width: 45, minWidth: 40, align: "center" },
  { key: "code", label: "Mã HV", width: 140 }, { key: "lastName", label: "Họ đệm", width: 150 },
  { key: "firstName", label: "Tên", width: 85 }, { key: "dob", label: "Ngày sinh", width: 110, align: "center" },
  { key: "gender", label: "Giới tính", width: 75, align: "center" },
  { key: "eligible", label: "Tư cách", width: 85, align: "center" }, { key: "exempt", label: "Miễn thi", width: 85, align: "center" },
  ...(!blank ? [
    ...SCORE_FIELDS.map(([key, label]) => ({ key, label, width: key === "assignmentScore" ? 130 : 115, minWidth: 90, align: "center" })),
    { key: "letter", label: "Thang điểm chữ", width: 120, align: "center" },
    { key: "attempts", label: "Điểm các lần thi hết môn", width: 185 },
  ] : []),
  { key: "result", label: "Kết quả điểm", width: 155 },
];
export const gradebookRowValues = (row, index, blank = false) => {
  const name = personNameParts(row);
  return [index + 1, row.code || "—", name.familyAndMiddle, name.givenName, displayGradeDate(row.dob), row.gender || "—",
    row.eligible == null ? "Chưa xét" : row.eligible ? "Đủ tư cách" : "Không đủ tư cách", row.examExempt ? "Có" : "Không",
    ...(!blank ? [...SCORE_FIELDS.map(([key]) => row[key]), row.letterGrade, row.attemptScores] : []),
    blank ? "" : RESULT_LABELS[row.result]];
};
export const gradebookCsv = (rows, blank = false) => {
  const headers = gradebookColumns(blank).map((column) => column.label);
  const values = rows.map((row, index) => gradebookRowValues(row, index, blank));
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [headers, ...values].map((row) => row.map(escape).join(",")).join("\r\n");
};
