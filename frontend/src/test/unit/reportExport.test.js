import fs from "node:fs";
import path from "node:path";
import { TextEncoder, TextDecoder } from "node:util";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { collectReportPages, createReportExcel, createReportPdf, createReportWord, normalizeReport, reportOrientation, reportPdfDefinition, reportPrintSections, tableReport } from "../../utils/reportExport";
import { readTranscriptPdf } from "../fixtures/readTranscriptPdf";
import { reportColumnWidths } from "../../utils/reportTableLayout";

const original = { fetch: global.fetch, TextEncoder: global.TextEncoder, TextDecoder: global.TextDecoder };
beforeAll(() => {
  global.TextEncoder = TextEncoder; global.TextDecoder = TextDecoder;
  global.fetch = async url => {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", url));
    return { ok: true, arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
  };
});
afterAll(() => Object.assign(global, original));
const bytesOf = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(Buffer.from(reader.result)); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const report = () => normalizeReport(tableReport("Danh sách học viên", [
  { key: "index", label: "STT" }, { key: "name", label: "Họ tên" }, { key: "dob", label: "Ngày sinh" },
  { key: "phone", label: "Điện thoại" }, { key: "score", label: "Điểm" }, { key: "actions", label: "Thao tác" },
], [{ name: "Nguyễn Thị Ánh", dob: "1995-02-03", phone: "0901234567", score: 0, actions: "Xóa" }]), new Date("2026-10-31T01:00:00Z"));

it('prints only the selected admission columns in one table while preserving the complete export dataset', () => {
  const headers = ['STT', 'Mã HV', 'Họ đệm', 'Tên', 'Ngày sinh', 'Giới tính', 'Email', 'Số CMND/CCCD', 'Năm nhập học', 'Trình độ', 'Ngành', 'Điện thoại', 'Trạng thái'];
  const source = { title: 'Hồ sơ tuyển sinh', sections: [{ title: 'Hồ sơ tuyển sinh', headers, rows: [headers.map((_, index) => `value-${index}`)] }] };
  const sections = reportPrintSections(source);
  expect(sections).toHaveLength(1);
  expect(sections[0].headers).toEqual(['STT', 'Mã HV', 'Họ đệm', 'Tên', 'Ngày sinh', 'Giới tính', 'Email', 'Số CMND/CCCD', 'Ngành', 'Điện thoại']);
  expect(sections[0].rows[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 10, 11].map(index => `value-${index}`));
  expect(source.sections[0].headers).toHaveLength(13);
});

it("creates a genuine XLSX with Vietnamese headings, short dates, numeric zero and leading-zero identifiers", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bytesOf(await createReportExcel(report())));
  const sheet = book.worksheets[0];
  expect(sheet.getCell("A1").value).toBe("BỘ XÂY DỰNG");
  expect(sheet.getCell("A2").value).toBe("TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM");
  expect(sheet.getCell("A3").value).toBe("VIỆN ĐÀO TẠO SAU ĐẠI HỌC");
  expect(sheet.getCell("C1").value).toBe("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
  expect(sheet.getCell("C2").value).toBe("Độc lập - Tự do - Hạnh phúc");
  expect(sheet.getCell("C3").value).toBe("Hải Phòng, ngày 31/10/26");
  const row = sheet.getRow(sheet.rowCount);
  expect(row.values.slice(1)).toEqual([1, "Nguyễn Thị Ánh", "03/02/95", "0901234567", 0]);
  expect(sheet.getRow(sheet.rowCount - 1).values).not.toContain("Thao tác");
  expect(sheet.views[0].state).toBe("frozen");
  expect(sheet.getColumn(1).width).toBe(6);
  expect(sheet.getColumn(1).width).toBeLessThan(sheet.getColumn(2).width);
  expect(row.getCell(1).alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
});

it("creates a genuine Word document with institution headings and the same dataset", async () => {
  const zip = await JSZip.loadAsync(await bytesOf(await createReportWord(report())));
  const xml = await zip.file("word/document.xml").async("string");
  for (const text of ["NGUYỄN", "03/02/95", "0901234567", "HÀNG HẢI", "BỘ XÂY DỰNG", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "Hải Phòng, ngày 31/10/26"]) expect(xml.toUpperCase()).toContain(text.toUpperCase());
  expect(xml).not.toContain("Xóa");
  expect(xml).toContain("w:tblHeader");
  const dataTable = xml.match(/<w:tbl>.*?<\/w:tbl>/g)[1];
  const widths = [...dataTable.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(match => Number(match[1]));
  expect(widths[0]).toBe(640);
  expect(widths[0]).toBeLessThan(widths[1]);
  for (const row of dataTable.matchAll(/<w:tr>.*?<\/w:tr>/g)) {
    const serialCell = row[0].match(/<w:tc>.*?<\/w:tc>/)[0];
    expect(serialCell).toContain('w:val="center"');
    expect(serialCell).toContain('<w:vAlign w:val="center"');
  }
});

it("uses a compact centered serial column in generated PDFs even when it is not first", () => {
  const definition = reportPdfDefinition(normalizeReport({ title: "Danh mục", sections: [{ title: "Danh mục", headers: ["Tên", "STT", "Ghi chú"], rows: [["Nguyễn An", 1, "Nội dung"]] }] }));
  const table = definition.content.find(node => node.table).table;
  expect(table.widths).toEqual(["*", 32, "*"]);
  expect(table.body[0][1].alignment).toBe("center");
  expect(table.body[1][1].alignment).toBe("center");
});

it("reserves only the needed width for academic years and gives the remaining space to text in all formats", async () => {
  const report = normalizeReport({ title: "Nhóm học viên", sections: [{ title: "Nhóm học viên", headers: ["STT", "Năm học", "Chương trình đào tạo"], rows: [[1, "2026", "Chương trình đào tạo chuyên ngành Công nghệ thông tin"]] }] });
  const widths = reportColumnWidths(report.sections[0], 540);
  expect(widths).toEqual([32, 30, 478]);
  const definition = reportPdfDefinition(report);
  expect(definition.content.find(node => node.table).table.widths).toEqual([32, 30, "*"]);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await bytesOf(await createReportExcel(report)));
  const sheet = book.worksheets[0];
  expect(sheet.getColumn(2).width).toBe(6);
  expect(sheet.getColumn(3).width).toBeGreaterThan(30);
  expect(sheet.lastRow.getCell(2).alignment).toMatchObject({ horizontal: "center", vertical: "middle" });
  const zip = await JSZip.loadAsync(await bytesOf(await createReportWord(report)));
  const xml = await zip.file("word/document.xml").async("string");
  const dataTable = xml.match(/<w:tbl>.*?<\/w:tbl>/g)[1];
  const wordWidths = [...dataTable.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(match => Number(match[1]));
  expect(wordWidths.slice(0, 2)).toEqual([640, 600]);
  expect(wordWidths[2]).toBeGreaterThan(8000);
});

it("creates a real PDF with Vietnamese text and multiple pages", async () => {
  const document = report();
  document.sections[0].rows = Array.from({ length: 90 }, (_, index) => [index + 1, "Nguyễn Thị Ánh", "03/02/95", "0901234567", 0]);
  const pdf = await bytesOf(await createReportPdf(document));
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const parsed = await readTranscriptPdf(pdf);
  expect(parsed.length).toBeGreaterThan(1);
  expect(JSON.stringify(parsed)).toContain("Nguyễn Thị Ánh");
  for (const text of ["BỘ XÂY DỰNG", "CỘNG HÒA XÃ HỘI", "Độc lập - Tự do - Hạnh phúc", "31/10/26"]) expect(JSON.stringify(parsed)).toContain(text);
}, 30000);

it("collects all filtered pages and rejects incomplete or changed lists", async () => {
  const requested = [];
  const rows = await collectReportPages(async page => { requested.push(page); return { rows: [{ id: page }], total: 3 }; });
  expect(requested).toEqual([1, 2, 3]);
  expect(rows).toHaveLength(3);
  await expect(collectReportPages(async page => ({ rows: page === 1 ? [{ id: 1 }] : [], total: 2 }))).rejects.toThrow("đã thay đổi");
  await expect(collectReportPages(async page => ({ rows: [{ id: page }], total: page === 1 ? 2 : 3 }))).rejects.toThrow("đã thay đổi");
});

it("splits wide print tables without dropping columns or losing learner identity", () => {
  const headers = ["STT", "Mã HV", "Họ tên", ...Array.from({ length: 20 }, (_, index) => `Môn ${index + 1}`)];
  const parts = reportPrintSections({ sections: [{ title: "Điểm", headers, rows: [headers.map((_, index) => index)] }] });
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every(part => part.headers.length <= 12 && part.rows[0][1] === 1)).toBe(true);
  expect([...new Set(parts.flatMap(part => part.headers))]).toHaveLength(headers.length);
});

it("keeps all admission-score columns within a fixed landscape Word table", async () => {
  const headers = ["Mã hồ sơ", "Họ tên", "Năm sinh", "Giới tính", "Chuyên ngành", "Liên hệ", "Tổng điểm", "Điểm ngưỡng ngành", "Điều kiện theo điểm", "Trạng thái"];
  const document = normalizeReport({ title: "Điểm xét tuyển", pageOrientation: "landscape", sections: [{ title: "Điểm xét tuyển", headers,
    rows: [["HS26-2410-QLKT-01", "Trần Khánh Duy", "1993", "Nam", "Quản lý kinh tế", "0900240111; mau-hs26-2410-111@example.com", 18, 10, "Đủ điều kiện", "Chờ xét tuyển"]] }] });
  expect(reportOrientation(document)).toBe("landscape");
  const zip = await JSZip.loadAsync(await bytesOf(await createReportWord(document)));
  const xml = await zip.file("word/document.xml").async("string");
  expect(xml).toContain('w:orient="landscape"');
  expect(xml).toContain('w:type="fixed"');
  const tables = xml.match(/<w:tbl>.*?<\/w:tbl>/g);
  const gridWidths = [...tables[1].matchAll(/<w:gridCol w:w="(\d+)"/g)].map(match => Number(match[1]));
  expect(gridWidths).toHaveLength(headers.length);
  expect(gridWidths.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(15398);
  for (const header of headers) expect(xml).toContain(header);
  expect(xml).toContain("mau-hs26-2410-111@example.com");
});
