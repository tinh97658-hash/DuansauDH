import ExcelJS from "exceljs";
import { createClassScoreWorkbook } from "../../pages/reports/classScoreSummaryExcel";

const sampleReport = (subjectCount = 3, learnerCount = 60) => {
  const names = ["Triết học", "Tiếng Anh", "Luận văn", "Phát triển ứng dụng với cơ sở dữ liệu", "Phương pháp nghiên cứu khoa học"];
  const subjects = Array.from({ length: subjectCount }, (_, index) => ({ id: `hp${index}`, code: `HP${index}`, name: names[index % names.length], credits: 3, isRequired: true }));
  const rows = Array.from({ length: learnerCount }, (_, index) => ({ code: `HV${index}`, fullName: "Nguyễn Văn An", dob: "1997-04-16", gender: "Nam", scores: { hp0: { score: index === 0 ? 0 : 8.2, result: index === 0 ? "failed" : "passed" }, hp1: { score: null, result: "exempt" } } }));
  return { group: { code: "CNTT2026.1.1", academicYear: "2026" }, curriculum: { name: "CTĐT Thạc sĩ" }, subjects, rows };
};
const loadSheet = async (report) => {
  const blob = await createClassScoreWorkbook(report);
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  return book.getWorksheet("Tổng hợp điểm");
};
const textOf = (cell) => cell.value?.richText ? cell.value.richText.map(run => run.text).join("") : cell.value;

it("produces a readable xlsx with numeric marks, missing marks, exemptions and all rows", async () => {
  const subjects = ["Triết học", "Tiếng Anh", "Luận văn"].map((name, index) => ({ id: `hp${index}`, code: `HP${index}`, name, credits: 3, isRequired: true }));
  const rows = Array.from({ length: 60 }, (_, index) => ({ code: `HV${index}`, fullName: "Nguyễn Văn An", dob: "1997-04-16", gender: "Nam", scores: { hp0: { score: index === 0 ? 0 : 8.2, result: index === 0 ? "failed" : "passed" }, hp1: { score: null, result: "exempt" } } }));
  const sheet = await loadSheet({ group: { code: "CNTT2026.1.1", academicYear: "2026" }, curriculum: { name: "CTĐT Thạc sĩ" }, subjects, rows });
  expect(sheet.rowCount).toBe(75);
  expect(sheet.getRow(10).values.slice(1)).toEqual(["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", ...subjects.map(subject => subject.name)]);
  expect(sheet.getCell("G11").value).toBe(0);
  expect(sheet.getCell("G12").value).toBe(8.2);
  expect(sheet.getCell("H11").value).toBe("MT");
  expect([null, ""]).toContain(sheet.getCell("I11").value);
  expect(sheet.getCell("B70").value).toBe("HV59");
  expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 6, ySplit: 10 });
});

it("uses a formal masthead, merged title, separate metadata and notes after the table", async () => {
  const report = sampleReport();
  const before = JSON.stringify(report);
  const sheet = await loadSheet(report);
  expect(sheet.getCell("A1").value).toBe("TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM");
  expect(sheet.getCell("A2").value).toBe("VIỆN ĐÀO TẠO SAU ĐẠI HỌC");
  expect(sheet.getCell("A4").value).toBe("TỔNG HỢP ĐIỂM CỦA LỚP");
  expect(sheet.model.merges).toEqual(expect.arrayContaining(["A1:I1", "A2:I2", "A4:I4", "A6:I6", "A7:I7", "A8:I8"]));
  expect(sheet.getCell("A4").font).toMatchObject({ name: "Times New Roman", bold: true, size: 16, color: { argb: "FF000000" } });
  expect(sheet.getCell("A4").alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
  expect(textOf(sheet.getCell("A6"))).toBe("Lớp: CNTT2026.1.1");
  expect(textOf(sheet.getCell("A7"))).toBe("Năm vào trường: 2026");
  expect(textOf(sheet.getCell("A8"))).toBe("CTĐT: CTĐT Thạc sĩ");
  for (const address of ["A6", "A7", "A8"]) {
    expect(sheet.getCell(address).value.richText[0].font.bold).toBe(true);
    expect(sheet.getCell(address).value.richText[1].font.bold).not.toBe(true);
  }
  expect(sheet.getCell("A72").value).toBe("Ghi chú:");
  expect(sheet.getCell("A73").value).toContain("Ô trống: chưa có điểm");
  expect(sheet.getCell("A74").value).toContain("MT: miễn thi");
  expect(sheet.getCell("A75").value).toContain("Điểm học phần đã lưu gần nhất");
  expect(sheet.getCell("A75").font).toMatchObject({ name: "Times New Roman", italic: true, size: 10 });
  expect(sheet.getCell("A75").border).toEqual({});
  expect(JSON.stringify(report)).toBe(before);
});

it.each([15, 25])("round-trips a %i-subject report with full borders, sensible widths, frozen identity columns and readable multi-page printing", async (count) => {
  const report = sampleReport(count);
  const sheet = await loadSheet(report);
  expect(sheet.columnCount).toBe(count + 6);
  expect(sheet.getRow(10).height).toBe(60);
  expect(sheet.getRow(11).height).toBe(20);
  const widths = [6, 12, 18, 11, 12, 10];
  for (let column = 1; column <= count + 6; column += 1) {
    expect(sheet.getColumn(column).width).toBe(widths[column - 1] || 12);
    const header = sheet.getCell(10, column);
    expect(header.font).toMatchObject({ name: "Times New Roman", size: 10, bold: true, color: { argb: "FF000000" } });
    expect(header.alignment).toMatchObject({ wrapText: true, horizontal: "center", vertical: "middle" });
    expect(header.fill.fgColor.argb).toBe("FFF2F2F2");
    for (let row = 10; row <= 70; row += 1) {
      const cell = sheet.getCell(row, column);
      expect(cell.font.name).toBe("Times New Roman");
      expect(cell.alignment.vertical).toBe("middle");
      for (const side of ["top", "bottom", "left", "right"]) {
        expect(["thin", "medium"]).toContain(cell.border[side].style);
        expect(cell.border[side].color.argb).toBe("FF000000");
      }
    }
  }
  expect(sheet.getCell(10, 1).border).toMatchObject({ top: { style: "medium" }, left: { style: "medium" } });
  expect(sheet.getCell(70, count + 6).border).toMatchObject({ bottom: { style: "medium" }, right: { style: "medium" } });
  expect(sheet.getCell("I11").alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
  expect([null, ""]).toContain(sheet.getCell("I11").value);
  expect(sheet.getCell("C11").alignment.horizontal).toBe("left");
  expect(sheet.getCell("D11").alignment.horizontal).toBe("left");
  expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 6, ySplit: 10, showGridLines: false, topLeftCell: "G11" });
  expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "landscape", fitToPage: false, scale: 100,
    fitToWidth: 0, fitToHeight: 0, printTitlesColumn: "A:F", printTitlesRow: "10:10",
    printArea: `A1:${sheet.getColumn(count + 6).letter}75` });
  // ExcelJS omits false print options in XML and reads them back as undefined;
  // absent gridLines means off. Worksheet-view gridlines stay explicitly false.
  expect(sheet.pageSetup.showGridLines).not.toBe(true);
  expect(sheet.pageSetup.margins).toMatchObject({ left: 0.4, right: 0.4, top: 0.5, bottom: 0.5 });
});

it.each([3, 25])("does not extend the gray header fill past the last subject for %i subjects", async (count) => {
  const sheet = await loadSheet(sampleReport(count, 4));
  const lastColumn = 6 + count;
  expect(sheet.getRow(10).fill?.pattern || "none").toBe("none");
  expect(sheet.getCell(10, lastColumn).fill.fgColor.argb).toBe("FFF2F2F2");
  expect(sheet.getCell(10, lastColumn).border.right.style).toBe("medium");
  for (const column of [lastColumn + 1, lastColumn + 10, 16384]) {
    expect(sheet.getCell(10, column).value).toBeNull();
    expect(sheet.getCell(10, column).fill?.pattern || "none").toBe("none");
    expect(sheet.getCell(10, column).border || {}).toEqual({});
  }
  expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 6, ySplit: 10, topLeftCell: "G11" });
});

it("only formats birth dates for this Excel export and preserves blank marks and literal exemptions", async () => {
  const report = sampleReport(3, 4);
  report.rows[0].dob = "2000-01-01T00:00:00.000Z";
  report.rows[1].dob = "16/04/1997";
  report.rows[2].dob = "Chưa xác định";
  report.rows[3].dob = "2000-02-29";
  const sheet = await loadSheet(report);
  expect([11, 12, 13, 14].map(row => sheet.getCell(row, 5).value)).toEqual(["01/01/2000", "16/04/1997", "Chưa xác định", "29/02/2000"]);
  expect(sheet.getCell("G11").value).toBe(0);
  expect(sheet.getCell("H11").value).toBe("MT");
  expect(sheet.getCell("I11").value).not.toBe(0);
  expect(sheet.getCell("I11").value).not.toBe("-");
  expect(report.rows[0].dob).toBe("2000-01-01T00:00:00.000Z");
});

it("exports an empty roster without invented metadata and includes the backend's policy in the print area", async () => {
  const report = sampleReport(0, 0);
  report.group = { name: "Lớp hiện có" };
  report.curriculum = null;
  report.scorePolicy = "Điểm học phần đã lưu gần nhất; gồm kết quả cá nhân đã hoàn thành. Ô trống: chưa có điểm; MT: miễn thi.";
  const sheet = await loadSheet(report);
  expect(sheet.rowCount).toBe(15);
  expect(textOf(sheet.getCell("A6"))).toBe("Lớp: Lớp hiện có");
  expect(textOf(sheet.getCell("A7"))).toBe("Năm vào trường: ");
  expect(textOf(sheet.getCell("A8"))).toBe("CTĐT: ");
  expect(sheet.getCell("A13").value).toContain("Điểm học phần đã lưu gần nhất; gồm kết quả cá nhân đã hoàn thành");
  expect(sheet.pageSetup.printArea).toBe("A1:F15");
  expect(sheet.getCell("F10").border.bottom.style).toBe("medium");
});
