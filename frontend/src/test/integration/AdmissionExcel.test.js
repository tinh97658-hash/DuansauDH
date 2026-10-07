/** @jest-environment node */
import ExcelJS from "exceljs";
import { createScoreTemplate, parseScoreExcel, readExcelFile } from "../../features/admission/admissionExcel";
const round = { id: "round-1", name: "Đợt 2/2026" };
const row = { admissionRecordId: "record-1", code: "00123", fullName: "Nguyễn Văn An", majorName: "Công nghệ thông tin", decision: "pending", version: 0, total: null, birthYear: 1996, gender: "Nam", phone: "0900000001", email: "demo@example.com" };
const second = { ...row, admissionRecordId: "record-2", code: "HS002", fullName: "Trần Văn Bình", majorName: "Quản trị kinh doanh" };
async function filled(edit, records = [row, second]) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createScoreTemplate(round, records));
  edit(book.getWorksheet("Điểm hồ sơ"), book);
  return book.xlsx.writeBuffer();
}
it("mẫu .xlsx giữ mã có số 0 đầu, họ tên, ngành và điểm hiện tại", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createScoreTemplate(round, [{ ...row, total: 8 }]));
  const sheet = book.getWorksheet("Điểm hồ sơ");
  expect(sheet.getCell("A2").value).toBe("00123");
  expect(sheet.getCell("B2").value).toBe(row.fullName);
  expect(sheet.getCell("E2").value).toBe(row.majorName);
  expect(sheet.getCell("H2").value).toBe(8);
  expect(sheet.getCell("C2").value).toBe(1996);
  expect(sheet.getCell("D2").value).toBe(row.gender);
  expect(sheet.getCell("F2").value).toBe(row.phone);
  expect(sheet.getCell("G2").value).toBe(row.email);
  expect(sheet.rowCount).toBe(2);
  expect(sheet.getColumn(10).hidden).toBe(true);
});
it("điền rồi import ngược, hỗ trợ nhiều ngành, dấu phẩy thập phân và điểm 0", async () => {
  const buffer = await filled((sheet) => { sheet.getCell("H2").value = "16,5"; sheet.getCell("H3").value = 0; });
  expect(await parseScoreExcel(buffer, round.id, [row, second])).toEqual({ rows: [
    { admissionRecordId: row.admissionRecordId, version: 0, score: 16.5 }, { admissionRecordId: second.admissionRecordId, version: 0, score: 0 },
  ], skippedCount: 0 });
});
it("điểm trống được bỏ qua và việc sắp xếp lại dòng không đổi hồ sơ nhận điểm", async () => {
  const buffer = await filled((sheet) => {
    sheet.getCell("H3").value = 17;
    const values = sheet.getRow(2).values; sheet.getRow(2).values = sheet.getRow(3).values; sheet.getRow(3).values = values;
  });
  expect(await parseScoreExcel(buffer, round.id, [row, second])).toEqual({ rows: [{ admissionRecordId: second.admissionRecordId, version: 0, score: 17 }], skippedCount: 1 });
});
it.each([21, -1, "NaN", "16.555", { formula: "10+6", result: 16 }])("chặn điểm sai %s", async (value) => {
  await expect(parseScoreExcel(await filled((sheet) => { sheet.getCell("H2").value = value; }), round.id, [row, second])).rejects.toThrow(/Dòng 2/);
});
it("chặn file sai đợt và dữ liệu cũ", async () => {
  const buffer = await filled((sheet) => { sheet.getCell("H2").value = 16; });
  await expect(parseScoreExcel(buffer, "other-round", [row, second])).rejects.toThrow(/đợt xét tuyển khác/);
  await expect(parseScoreExcel(buffer, round.id, [{ ...row, version: 1 }, second])).rejects.toThrow(/đã thay đổi/);
  await expect(parseScoreExcel(buffer, round.id, [second])).rejects.toThrow(/không có trong đợt/);
});
it("chặn mã, tên, ngành bị thay đổi và dòng trùng", async () => {
  const wrong = await filled((sheet) => { sheet.getCell("H2").value = 16; sheet.getCell("B2").value = "Tên khác"; });
  await expect(parseScoreExcel(wrong, round.id, [row, second])).rejects.toThrow(/không khớp/);
  const duplicate = await filled((sheet) => { sheet.getCell("H2").value = 16; sheet.addRow(sheet.getRow(2).values); });
  await expect(parseScoreExcel(duplicate, round.id, [row, second])).rejects.toThrow(/trùng hồ sơ/);
});
it("điểm đã duyệt giữ nguyên được bỏ qua nhưng thay đổi bị chặn", async () => {
  const approved = { ...row, decision: "admitted", total: 16 };
  const buffer = await filled((sheet) => { sheet.getCell("H3").value = 17; }, [approved, second]);
  expect((await parseScoreExcel(buffer, round.id, [approved, second])).skippedCount).toBe(1);
  const changed = await filled((sheet) => { sheet.getCell("H2").value = 18; }, [approved, second]);
  await expect(parseScoreExcel(changed, round.id, [approved, second])).rejects.toThrow(/đã được duyệt/);
});
it("hồ sơ chưa có mã vẫn được ghép đúng khi import mẫu", async () => {
  const noCode = { ...row, code: null };
  const buffer = await filled((sheet) => { sheet.getCell("H2").value = 16; }, [noCode]);
  expect((await parseScoreExcel(buffer, round.id, [noCode])).rows[0].admissionRecordId).toBe(row.admissionRecordId);
});
it("chặn file sai định dạng và giới hạn dung lượng", async () => {
  expect(() => readExcelFile({ name: "diem.xls", size: 10 })).toThrow(/.xlsx/);
  expect(() => readExcelFile({ name: "diem.xlsx", size: 11 * 1024 * 1024 })).toThrow(/10 MB/);
  await expect(parseScoreExcel(new Uint8Array([1, 2, 3]), round.id, [row])).rejects.toThrow(/Không đọc được/);
});
it("giữ tương thích file mẫu cũ và kiểm tra thông tin bổ sung trong mẫu mới", async () => {
  const oldBook = new ExcelJS.Workbook();
  const sheet = oldBook.addWorksheet("Điểm hồ sơ");
  sheet.addRow(["Mã hồ sơ", "Họ tên", "Chuyên ngành", "Tổng điểm (0–20)", "Trạng thái", "ID hồ sơ", "Phiên bản"]);
  sheet.addRow([row.code, row.fullName, row.majorName, 16, "Chưa duyệt", row.admissionRecordId, 0]);
  oldBook.addWorksheet("_ThongTin").addRow(["admission-score-template", 1, round.id]);
  expect((await parseScoreExcel(await oldBook.xlsx.writeBuffer(), round.id, [row])).rows[0].score).toBe(16);
  const changed = await filled((newSheet) => { newSheet.getCell("H2").value = 16; newSheet.getCell("C2").value = 2000; });
  await expect(parseScoreExcel(changed, round.id, [row, second])).rejects.toThrow(/không khớp/);
});
