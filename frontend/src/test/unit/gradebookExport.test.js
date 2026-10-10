import ExcelJS from "exceljs";
import { buildGradebookDocument, createGradebookExcel, fetchAllGradebookRows, gradebookFilename, GRADEBOOK_HEADER_ROW } from "../../features/exams/gradebookExport";
import { draftOf, gradebookColumns } from "../../features/exams/gradebook";
import { autoFitColumnByContent, gradebookDocumentColumns } from "../../features/exams/gradebookLayout";

const group = { code: "CNTT/2026", name: "Công nghệ thông tin 2026" };
const offering = { subject: { code: "HP:01", name: "Phương pháp nghiên cứu khoa học" } };
const roster = count => Array.from({ length: count }, (_, index) => ({
  participantId: `student:${index}`, code: `HV${index + 1}`, fullName: "Nguyễn Văn An", dob: "1990-01-02", gender: "Nam",
  eligible: index === 0 ? null : true, examExempt: index === 1, testScore: 0, assignmentScore: null, examScore: 8,
  courseScore: 8, grade4: 3, letterGrade: "B", attemptScores: [0, 8], result: index === 1 ? "exempt" : "passed",
}));
const load = async document => {
  const blob = await createGradebookExcel(document);
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
  });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer); return book;
};

it.each([4, 30, 40])("fetches every page for %i students with filters and drafts", async count => {
  const rows = roster(count);
  const fetch = jest.fn(async params => ({ data: { revision: 7, total: count, page: params.page, rows: rows.slice((params.page - 1) * 15, params.page * 15) } }));
  const dirty = { "student:0": { ...draftOf(rows[0]), courseScore: "8,5" } };
  const result = await fetchAllGradebookRows(fetch, { classGroupId: "g1", courseOfferingId: "o1", mode: "all", search: "Nguyễn" }, () => dirty);
  expect(result).toHaveLength(count); expect(result[0].courseScore).toBe("8,5"); expect(result[count - 1].participantId).toBe(`student:${count - 1}`);
  expect(fetch).toHaveBeenCalledTimes(Math.ceil(count / 15));
  fetch.mock.calls.forEach(([params], index) => expect(params).toEqual({ classGroupId: "g1", courseOfferingId: "o1", mode: "all", search: "Nguyễn", page: index + 1, pageSize: 15 }));
});

it("cancels on revision or page changes instead of returning a partial export", async () => {
  const fetch = jest.fn().mockResolvedValueOnce({ data: { revision: 1, total: 30, page: 1, rows: roster(15) } })
    .mockResolvedValueOnce({ data: { revision: 2, total: 30, page: 2, rows: roster(15) } });
  await expect(fetchAllGradebookRows(fetch, { mode: "all" })).rejects.toThrow("Vui lòng xuất lại");
  await expect(fetchAllGradebookRows(async () => ({ data: { revision: 1, total: 30, page: 2, rows: [] } }), { mode: "all" })).rejects.toThrow("Danh sách đã thay đổi");
});

it.each([4, 40])("writes an actual single-sheet workbook with %i students and bounded styles", async count => {
  const rows = roster(count).map(draftOf);
  rows[0].courseScore = "8,5";
  const before = JSON.stringify(rows);
  const document = buildGradebookDocument(group, offering, rows);
  const book = await load(document);
  expect(book.worksheets).toHaveLength(1);
  const sheet = book.getWorksheet("Bảng điểm môn học");
  expect(sheet.getCell("A4").value).toBe("BẢNG ĐIỂM MÔN HỌC");
  expect(sheet.getCell("A6").value).toBe(`Lớp: ${group.name}`);
  expect(sheet.getCell("A7").value).toBe(`Học phần: ${offering.subject.name}`);
  expect(sheet.model.merges).toEqual(["A1:P1", "A2:P2", "A4:P4", "A6:D6", "A7:D7"]);
  for (const cell of ["A1", "A2", "A4"]) expect(sheet.getCell(cell).alignment.horizontal).toBe("center");
  for (const column of [2, 5, 9, 10, 11, 12, 13, 14]) {
    expect(sheet.getCell(10, column).alignment.wrapText).not.toBe(true);
    expect(sheet.getCell(10, column).alignment.shrinkToFit).toBe(true);
  }
  expect(sheet.getRow(9).values.slice(1)).toEqual(gradebookColumns().map(column => column.label));
  expect(sheet.rowCount).toBe(GRADEBOOK_HEADER_ROW + count);
  expect(sheet.getCell(`B${9 + count}`).value).toBe(`HV${count}`);
  expect(sheet.getCell("E10").value).toBe("02/01/1990");
  expect(sheet.getCell("I10").value).toBe("0"); expect(sheet.getCell("L10").value).toBe("8,5");
  expect(sheet.getCell("O10").value).toBe("0; 8");
  for (let column = 1; column <= 16; column++) {
    const header = sheet.getCell(9, column);
    expect(header.font).toMatchObject({ name: "Times New Roman", bold: true, color: { argb: "FF000000" } });
    expect(header.alignment).toMatchObject({ wrapText: true, horizontal: "center", vertical: "middle" });
    expect(header.fill.fgColor.argb).toBe("FFF2F2F2");
    expect(header.border.bottom.style).toBe("thin");
    expect(sheet.getCell(10, column).font.name).toBe("Times New Roman");
    expect(sheet.getCell(10, column).border.right.style).toBe("thin");
  }
  for (const column of [17, 30, 16384]) {
    const cell = sheet.getCell(9, column);
    expect(cell.fill?.pattern || "none").toBe("none"); expect(Object.keys(cell.border || {})).toHaveLength(0);
  }
  expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 9, topLeftCell: "E10", showGridLines: false });
  expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "landscape", scale: 100, fitToPage: false, printArea: `A1:P${9 + count}`, printTitlesRow: "9:9" });
  const text = JSON.stringify(sheet.model);
  for (const forbidden of ["VIỆN TRƯỞNG", "PHỤ TRÁCH LỚP", "CỘNG HÒA", "Độc lập", "Hải Phòng, ngày", "Tra cứu điểm"]) expect(text).not.toContain(forbidden);
  expect(JSON.stringify(rows)).toBe(before);
});

it("sizes content within limits, wraps headers and keeps long codes on one line", async () => {
  const short = buildGradebookDocument(group, offering, roster(4).map(draftOf));
  const rows = roster(4).map(draftOf);
  rows[0].code = "CNTT-2026-HV-00123";
  rows[0].fullName = "Nguyễn Hoàng Văn Đình Minh";
  const long = buildGradebookDocument(group, offering, rows);
  const shortWidths = gradebookDocumentColumns(short), longWidths = gradebookDocumentColumns(long);
  expect(shortWidths[0].width).toBe(6); expect(shortWidths[1].width).toBe(12);
  expect(longWidths[1].width).toBe(16); expect(longWidths[2].width).toBeGreaterThan(shortWidths[2].width);
  longWidths.forEach(column => { expect(column.width).toBeGreaterThanOrEqual(column.min); expect(column.width).toBeLessThanOrEqual(column.max); });
  const sheet = (await load(long)).worksheets[0];
  expect(sheet.getCell("B10").alignment.wrapText).not.toBe(true);
  expect(sheet.getCell("B10").alignment.shrinkToFit).toBe(true);
  expect(sheet.getCell("B10").value).toBe(rows[0].code);
  expect(sheet.getCell("J9").alignment.wrapText).toBe(true);
  expect(autoFitColumnByContent(["2"], { minWidth: 10, maxWidth: 14, header: "ABCDEFGHIJKLMNOPQR", includeHeader: false })).toBe(10);
  expect(autoFitColumnByContent(["2"], { minWidth: 10, maxWidth: 14, header: "ABCDEFGHIJKLMNOPQR", includeHeader: true })).toBe(14);
});

it("uses the business timezone and sanitizes filename components", () => {
  expect(buildGradebookDocument(group, offering, [], new Date("2026-10-09T18:00:00Z")).signingDate).toBe("Hải Phòng, ngày 10 tháng 10 năm 2026");
  expect(gradebookFilename(group, offering)).toBe("Bang-diem-mon-hoc-CNTT-2026-HP-01.xlsx");
});
