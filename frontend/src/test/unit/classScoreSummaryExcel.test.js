import ExcelJS from "exceljs";
import { createClassScoreWorkbook } from "../../pages/reports/classScoreSummaryExcel";

it("produces a readable xlsx with numeric marks, missing marks, exemptions and all rows", async () => {
  const subjects = ["Triết học", "Tiếng Anh", "Luận văn"].map((name, index) => ({ id: `hp${index}`, code: `HP${index}`, name, credits: 3, isRequired: true }));
  const rows = Array.from({ length: 60 }, (_, index) => ({ code: `HV${index}`, fullName: "Nguyễn Văn An", dob: "1997-04-16", gender: "Nam", scores: { hp0: { score: index === 0 ? 0 : 8.2, result: index === 0 ? "failed" : "passed" }, hp1: { score: null, result: "exempt" } } }));
  const blob = await createClassScoreWorkbook({ group: { code: "CNTT2026.1.1", academicYear: "2026" }, curriculum: { name: "CTĐT Thạc sĩ" }, subjects, rows });
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Tổng hợp điểm");
  expect(sheet.rowCount).toBe(64);
  expect(sheet.getRow(4).values.slice(1)).toEqual(["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", ...subjects.map(subject => subject.name)]);
  expect(sheet.getCell("G5").value).toBe(0);
  expect(sheet.getCell("G6").value).toBe(8.2);
  expect(sheet.getCell("H5").value).toBe("MT");
  expect([null, ""]).toContain(sheet.getCell("I5").value);
  expect(sheet.getCell("B64").value).toBe("HV59");
  expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 4 });
});
