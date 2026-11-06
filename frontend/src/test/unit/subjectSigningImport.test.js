import ExcelJS from "exceljs";
import { buildSubjectSigningDocument, createSubjectSigningExcel } from "../../features/exams/subjectSigningExport";
import { previewSubjectSigningImport, readSubjectSigningImport } from "../../features/exams/subjectSigningImport";

const bytes = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsArrayBuffer(blob); });
const roster = [
  { participantId: "student:one", code: "HV1", fullName: "Nguyễn Văn An", testScore: null, assignmentScore: null },
  { participantId: "student:two", code: "HV2", fullName: "Nguyễn Văn An", testScore: 7, assignmentScore: 8 },
];
async function fixture() {
  const document = buildSubjectSigningDocument([{ id: "g1", code: "CNTT" }], { id: "o1", subject: { name: "Học phần" } }, roster);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await bytes(await createSubjectSigningExcel(document)));
  const sheet = book.worksheets[0], metadata = book.getWorksheet("_SDH_IMPORT");
  const kt = metadata.getCell("A3").value, btl = metadata.getCell("B3").value, id = metadata.getCell("C3").value;
  return { book, sheet, metadata, kt, btl, id, read: () => book.xlsx.writeBuffer().then(buffer => readSubjectSigningImport(buffer, "o1")) };
}

it("exports hidden identifiers outside the unchanged print area and imports only KT/TL-BTL, including zero and decimal commas", async () => {
  const f = await fixture();
  expect(f.metadata.state).toBe("veryHidden"); expect(f.sheet.getColumn(f.id).hidden).toBe(true);
  const lastPrintColumn = f.sheet.pageSetup.printArea.match(/:([A-Z]+)\d+$/)[1];
  expect(f.sheet.getColumn(lastPrintColumn).number).toBe(f.id - 1);
  f.sheet.getCell(10, f.kt).value = 0; f.sheet.getCell(10, f.btl).value = "8,25";
  f.sheet.getCell(10, f.kt + 1).value = 10; // practical score is not imported
  const rows = await f.read();
  expect(rows[0]).toEqual({ participantId: "student:one", fullName: roster[0].fullName, testScore: 0, assignmentScore: 8.25 });
  expect(previewSubjectSigningImport(rows, roster)).toHaveLength(1);
});

it("preserves existing marks for blank cells and does not mistake matching scores for changes", async () => {
  const f = await fixture(); f.sheet.getCell(11, f.kt).value = ""; f.sheet.getCell(11, f.btl).value = 9;
  const preview = previewSubjectSigningImport(await f.read(), roster);
  expect(preview).toHaveLength(1); expect(preview[0]).toMatchObject({ participantId: "student:two", oldTestScore: 7, assignmentScore: 9 });
  expect(preview[0]).not.toHaveProperty("testScore");
});

it.each([-1, 11, "abc", "1e1", { formula: "1+1", result: 2 }])("rejects invalid or formula scores: %j", async value => {
  const f = await fixture(); f.sheet.getCell(10, f.kt).value = value;
  await expect(f.read()).rejects.toThrow(/Dòng 10/);
});

it("rejects the wrong offering and exports without import metadata", async () => {
  const f = await fixture();
  await expect(readSubjectSigningImport(await f.book.xlsx.writeBuffer(), "other")).rejects.toThrow("không thuộc");
  f.book.removeWorksheet(f.metadata.id);
  await expect(f.read()).rejects.toThrow("xuất lại mẫu");
});

it("rejects duplicated identifiers and mismatched names, including identical-name learners", async () => {
  const f = await fixture(); f.sheet.getCell(10, f.id).value = roster[1].participantId;
  await expect(f.read()).rejects.toThrow("bị trùng");
  f.sheet.getCell(10, f.id).value = roster[0].participantId; f.sheet.getCell(10, f.metadata.getCell("D3").value).value = "Người khác";
  await expect(f.read()).rejects.toThrow("không khớp");
});

it("rejects modified headers, empty files, missing current learners and protected records", async () => {
  const f = await fixture(); f.sheet.getCell(9, f.kt).value = "Đổi cột";
  await expect(f.read()).rejects.toThrow("Cấu trúc");
  f.sheet.getCell(9, f.kt).value = "Điểm KT";
  f.sheet.getCell(11, f.kt).value = ""; f.sheet.getCell(11, f.btl).value = "";
  await expect(f.read()).rejects.toThrow("chưa có điểm");
  const imported = [{ ...roster[0], testScore: 6 }];
  expect(() => previewSubjectSigningImport(imported, [])).toThrow("danh sách");
  expect(() => previewSubjectSigningImport(imported, [{ ...roster[0], profileForeignLanguageExempt: true }])).toThrow("không được sửa");
});
