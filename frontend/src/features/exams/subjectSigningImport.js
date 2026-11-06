import { numericScore } from "./gradebook";

const normalizedName = value => String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const scalar = (cell, label) => {
  const value = cell.value;
  if (value != null && !["string", "number"].includes(typeof value)) throw new Error(`${label}: chỉ nhận giá trị nhập trực tiếp, không nhận công thức.`);
  return value;
};
const readScore = (cell, label) => {
  const value = scalar(cell, label);
  if (value == null || String(value).trim() === "") return undefined;
  if (typeof value === "string" && !/^\d{1,2}([.,]\d+)?$/.test(value.trim())) throw new Error(`${label}: điểm phải là số từ 0 đến 10.`);
  const score = numericScore(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) throw new Error(`${label}: điểm phải là số từ 0 đến 10.`);
  return score;
};

export async function readSubjectSigningImport(buffer, offeringId) {
  if (!buffer || buffer.byteLength > 5 * 1024 * 1024) throw new Error("Chỉ nhận file Excel tối đa 5 MB.");
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  try { await book.xlsx.load(buffer); } catch { throw new Error("Không đọc được file .xlsx. Hãy dùng file Excel xuất từ hệ thống."); }
  const sheet = book.getWorksheet("Theo dõi môn học"), metadata = book.getWorksheet("_SDH_IMPORT");
  if (!sheet || !metadata || metadata.getCell("A1").value !== "SDH_COMPONENT_IMPORT" || metadata.getCell("B1").value !== 1)
    throw new Error("File thiếu thông tin nhận diện. Hãy xuất lại mẫu Excel từ hệ thống; file cũ không hỗ trợ import.");
  if (metadata.getCell("A2").value !== offeringId) throw new Error("File không thuộc lớp học phần đang chọn.");
  const [testColumn, assignmentColumn, idColumn, nameColumn, firstRow, count] = Array.from({ length: 6 }, (_, i) => metadata.getCell(3, i + 1).value);
  if (![testColumn, assignmentColumn, idColumn, nameColumn].every(value => Number.isInteger(value) && value >= 1 && value <= 256)
    || firstRow !== 10 || !Number.isInteger(count) || count < 1 || count > 1000 || metadata.rowCount !== count + 4
    || new Set([testColumn, assignmentColumn, idColumn, nameColumn]).size !== 4
    || sheet.getCell(9, testColumn).value !== "Điểm KT" || sheet.getCell(9, assignmentColumn).value !== "Điểm TL/BTL"
    || sheet.getCell(9, idColumn).value !== "SDH_PARTICIPANT_ID") throw new Error("Cấu trúc mẫu Excel đã thay đổi. Hãy giữ nguyên hàng tiêu đề và các cột của mẫu.");
  const identities = new Map();
  for (let i = 0; i < count; i++) {
    const id = scalar(metadata.getCell(5 + i, 1), "Mã học viên");
    const name = scalar(metadata.getCell(5 + i, 2), "Họ tên");
    if (typeof id !== "string" || !id || id.length > 80 || identities.has(id) || typeof name !== "string") throw new Error("Danh sách định danh học viên không hợp lệ.");
    identities.set(id, name);
  }
  const seen = new Set(), rows = [];
  for (let i = 0; i < count; i++) {
    const row = firstRow + i;
    const id = scalar(sheet.getCell(row, idColumn), `Dòng ${row}`);
    const name = scalar(sheet.getCell(row, nameColumn), `Dòng ${row}`);
    if (!identities.has(id) || seen.has(id) || normalizedName(name) !== normalizedName(identities.get(id)))
      throw new Error(`Dòng ${row}: mã định danh và họ tên không khớp hoặc học viên bị trùng. Không thêm, xóa hay sắp xếp riêng một phần cột của mẫu.`);
    seen.add(id);
    const testScore = readScore(sheet.getCell(row, testColumn), `Dòng ${row} — Điểm KT`);
    const assignmentScore = readScore(sheet.getCell(row, assignmentColumn), `Dòng ${row} — Điểm TL/BTL`);
    if (testScore !== undefined || assignmentScore !== undefined) rows.push({ participantId: id, fullName: String(name),
      ...(testScore !== undefined ? { testScore } : {}), ...(assignmentScore !== undefined ? { assignmentScore } : {}) });
  }
  if (!rows.length) throw new Error("File chưa có điểm KT hoặc TL/BTL để nhập.");
  return rows;
}

export function previewSubjectSigningImport(imported, roster) {
  const byId = new Map(roster.map(row => [row.participantId, row]));
  return imported.flatMap(value => {
    const current = byId.get(value.participantId);
    if (!current || normalizedName(value.fullName) !== normalizedName(current.fullName)) throw new Error(`${value.fullName}: không khớp danh sách học viên hiện tại. Hãy xuất lại file.`);
    const changed = ["testScore", "assignmentScore"].some(key => value[key] !== undefined && value[key] !== numericScore(current[key]));
    if (!changed) return [];
    if (current.canEditGrade === false || current.profileForeignLanguageExempt || current.studyLeaveFailure)
      throw new Error(`${current.fullName}: không được sửa điểm do quyền truy cập hoặc trạng thái hồ sơ.`);
    return [{ participantId: value.participantId, fullName: current.fullName, code: current.code,
      oldTestScore: numericScore(current.testScore), oldAssignmentScore: numericScore(current.assignmentScore),
      ...(value.testScore !== undefined ? { testScore: value.testScore } : {}),
      ...(value.assignmentScore !== undefined ? { assignmentScore: value.assignmentScore } : {}) }];
  });
}
