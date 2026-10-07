const HEADERS = ["Mã hồ sơ", "Họ tên", "Năm sinh", "Giới tính", "Chuyên ngành", "Số điện thoại", "Email", "Tổng điểm (0–20)", "Trạng thái", "ID hồ sơ", "Phiên bản"];
const LEGACY_HEADERS = ["Mã hồ sơ", "Họ tên", "Chuyên ngành", "Tổng điểm (0–20)", "Trạng thái", "ID hồ sơ", "Phiên bản"];
const SHEET = "Điểm hồ sơ";
export const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
async function workbook() {
  const module = await import("exceljs");
  return new (module.default || module).Workbook();
}
export async function createScoreTemplate(round, rows) {
  if (!rows.length) throw new Error("Danh sách đang hiển thị chưa có hồ sơ để tải mẫu.");
  const book = await workbook();
  const sheet = book.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = HEADERS.map((header, index) => ({ header, width: [20, 32, 14, 14, 40, 20, 36, 22, 24, 40, 16][index], hidden: index >= 9 }));
  rows.forEach((row) => {
    const item = sheet.addRow([row.code || "", row.fullName || "", row.birthYear ?? null, row.gender || "", row.majorName || "", row.phone || "", row.email || "", row.total ?? null,
      row.decision === "admitted" ? "Đã trúng tuyển" : row.decision === "rejected" ? "Không trúng tuyển" : "Chưa duyệt", row.admissionRecordId, row.version]);
    item.getCell(1).numFmt = "@";
    item.getCell(6).numFmt = "@";
    item.getCell(8).numFmt = "0.##";
    item.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: row.decision === "pending" ? "FFFFF2CC" : "FFE2E8F0" } };
    item.getCell(8).dataValidation = { type: "decimal", operator: "between", allowBlank: true, formulae: [0, 20],
      showErrorMessage: true, errorTitle: "Điểm không hợp lệ", error: "Nhập điểm từ 0 đến 20.", showInputMessage: true, promptTitle: "Nhập tổng điểm", prompt: "Chỉ điền hoặc sửa điểm ở cột này." };
  });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173E75" } };
  sheet.autoFilter = { from: "A1", to: `K${rows.length + 1}` };
  const instructions = book.addWorksheet("Hướng dẫn");
  instructions.getColumn(1).width = 110;
  [round.name, "File mẫu lấy đúng danh sách hồ sơ đang hiển thị khi tải.",
    "Chỉ nhập hoặc sửa cột Tổng điểm (0–20) trên sheet Điểm hồ sơ, sau đó lưu file .xlsx và import lại.",
    "Giữ nguyên thông tin hồ sơ và các cột ẩn. Có thể bỏ các dòng không cần nhập.",
    "Điểm trống được bỏ qua; điểm 0 được nhập. Chấp nhận dấu phẩy thập phân, ví dụ 16,5.",
    "Hồ sơ đã duyệt giữ nguyên điểm sẽ được bỏ qua. Muốn sửa điểm đã duyệt, mở lại kết quả trước.",
    "Nếu điểm hoặc thông tin hồ sơ đã thay đổi sau khi tải mẫu, tải mẫu mới để nhập.",
    "Import chỉ lưu điểm; bấm Xét tuyển và Đồng ý duyệt để cập nhật trạng thái trúng tuyển."].forEach((text) => instructions.addRow([text]));
  const info = book.addWorksheet("_ThongTin", { state: "veryHidden" });
  info.addRow(["admission-score-template", 2, round.id]);
  return book.xlsx.writeBuffer();
}

function scoreValue(value, line) {
  if (typeof value !== "number" && typeof value !== "string") throw new Error(`Dòng ${line}: nhập điểm bằng số, không dùng công thức.`);
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) > 20) throw new Error(`Dòng ${line}: điểm phải từ 0 đến 20, tối đa hai chữ số thập phân.`);
  return Number(text);
}
export async function parseScoreExcel(buffer, roundId, records) {
  const book = await workbook();
  try { await book.xlsx.load(buffer); }
  catch { throw new Error("Không đọc được file Excel. Hãy dùng file mẫu và lưu theo định dạng .xlsx."); }
  const info = book.getWorksheet("_ThongTin");
  const sheet = book.getWorksheet(SHEET);
  const format = info?.getCell("B1").value;
  if (!sheet || info?.getCell("A1").value !== "admission-score-template" || ![1, 2].includes(format)) throw new Error("File không đúng mẫu. Tải file Excel mẫu trên màn hình này để điền điểm.");
  if (info.getCell("C1").value !== roundId) throw new Error("File mẫu thuộc đợt xét tuyển khác. Chọn đúng đợt hoặc tải mẫu mới.");
  const headers = format === 1 ? LEGACY_HEADERS : HEADERS;
  const column = (name) => headers.indexOf(name) + 1;
  if (headers.some((header, index) => sheet.getRow(1).getCell(index + 1).value !== header)) throw new Error("Các cột trong file mẫu đã thay đổi. Giữ nguyên cột và chỉ điền Tổng điểm.");
  const recordMap = new Map(records.map((row) => [row.admissionRecordId, row]));
  const seen = new Set();
  const rows = [];
  let skippedCount = 0;
  sheet.eachRow((line, index) => {
    if (index === 1) return;
    const value = line.getCell(column("Tổng điểm (0–20)")).value;
    if (value == null || (typeof value === "string" && !value.trim())) { skippedCount++; return; }
    const id = line.getCell(column("ID hồ sơ")).value;
    const record = recordMap.get(id);
    if (!record) throw new Error(`Dòng ${index}: hồ sơ không có trong đợt hiện tại. Tải lại mẫu mới.`);
    if (seen.has(id)) throw new Error(`Dòng ${index}: trùng hồ sơ ${record.code || record.fullName}.`);
    seen.add(id);
    const identity = { "Mã hồ sơ": record.code || "", "Họ tên": record.fullName || "", "Chuyên ngành": record.majorName || "" };
    if (format === 2) Object.assign(identity, { "Năm sinh": record.birthYear ?? "", "Giới tính": record.gender || "", "Số điện thoại": record.phone || "", "Email": record.email || "" });
    if (Object.entries(identity).some(([name, text]) => String(line.getCell(column(name)).value ?? "").trim() !== String(text).trim())) throw new Error(`Dòng ${index}: thông tin trong mẫu không khớp hồ sơ. Giữ nguyên thông tin hoặc tải lại mẫu mới.`);
    if (line.getCell(column("Phiên bản")).value !== record.version) throw new Error(`Dòng ${index}: điểm hồ sơ ${record.code || record.fullName} đã thay đổi. Tải mẫu mới trước khi import.`);
    const score = scoreValue(value, index);
    if (record.decision !== "pending") {
      if (record.total === score) { skippedCount++; return; }
      throw new Error(`Dòng ${index}: hồ sơ ${record.code || record.fullName} đã được duyệt. Mở lại kết quả trước khi sửa điểm.`);
    }
    rows.push({ admissionRecordId: record.admissionRecordId, version: record.version, score });
    if (rows.length > 2000) throw new Error("Mỗi lần import tối đa 2.000 hồ sơ. Chia file thành nhiều lần nhập.");
  });
  if (!rows.length) throw new Error("File chưa có điểm hồ sơ cần nhập. Điền cột Tổng điểm cho các hồ sơ chưa duyệt rồi import lại.");
  return { rows, skippedCount };
}

export function readExcelFile(file) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Chọn file Excel .xlsx đã điền điểm từ file mẫu.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File Excel vượt 10 MB. Chia nhỏ danh sách để import.");
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không thể mở file Excel đã chọn."));
    reader.readAsArrayBuffer(file);
  });
}
