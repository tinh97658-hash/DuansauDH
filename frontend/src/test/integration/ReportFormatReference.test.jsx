import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { TextEncoder } from "node:util";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { ReportPrintSheet } from "../../components/ReportPreview";
import { createReportExcel, createReportWord, normalizeReport } from "../../utils/reportExport";
import { readReportPrintLayout } from "../../utils/reportPrintLayout";
import { excelWidthToPoints, reportPageWidth } from "../../utils/documentLayout";

const browser = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
const testBrowser = browser ? it : it.skip;
const encoder = global.TextEncoder;
beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(() => { global.TextEncoder = encoder; });
const bytes = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});

testBrowser("copies column proportions and row heights from the unchanged PDF print template into Word and Excel", async () => {
  const report = normalizeReport({ title: "Ma trận lớp học phần", metadata: [["Phạm vi", "Công nghệ thông tin (CNTT)"]], sections: [{ title: "Danh sách lớp học phần",
    headers: ["STT", "Mã HP", "Học phần", "TC", "Lớp học phần", "Lớp/nhóm", "Khóa", "Số HV", "Tình trạng xếp lịch", "Số buổi đã học"],
    rows: [[1, "CNTT14", "Siêu dữ liệu nâng cao", 2, "Lớp Siêu dữ liệu nâng cao - CNTT 2026.1.1", "CNTT 2026.1.1", "2026", 18, "Đã xếp lịch", 1],
      [2, "HPTH", "Triết học", 3, "Lớp Triết học - CKTM 2026.1.1 + CNTT 2026.1.1", "CKTM 2026.1.1 · CNTT 2026.1.1", "2026", 18, "Đã xếp lịch", 0]] }] });
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "export-reference-")), htmlPath = path.join(folder, "reference.html");
  try {
    const css = fs.readFileSync("src/components/reportPreview.css", "utf8");
    const markup = renderToStaticMarkup(<ReportPrintSheet report={report} />);
    // This is the existing PDF template, including automatic matrix columns.
    expect(markup).toContain('style="width:1%"');
    expect(markup).not.toContain("table-layout:fixed");
    fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"><main class="report-preview report-landscape">${markup}</main></div><script>
      const layout = (${readReportPrintLayout.toString()})(document);
      document.body.insertAdjacentHTML('beforeend', '<pre id="geometry">' + JSON.stringify(layout) + '</pre>');
    </script></body></html>`, "utf8");
    const dom = execFileSync(browser, ["--headless", "--disable-gpu", "--no-sandbox", "--disable-background-networking", "--dump-dom", `file:///${htmlPath.replaceAll("\\", "/")}`],
      { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
    const printLayout = JSON.parse([...dom.matchAll(/<pre id="geometry">(.*?)<\/pre>/gs)].at(-1)[1]);
    const measured = printLayout[0], total = measured.widths.reduce((sum, width) => sum + width, 0);
    expect(measured.widths).toHaveLength(10);
    expect(measured.widths.every(width => width > 0)).toBe(true);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await bytes(await createReportExcel(report, { printLayout })));
    const sheet = book.worksheets[0], cells = [];
    sheet.lastRow.eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) cells.push(cell); });
    expect(cells.map(cell => cell.value)).toEqual(report.sections[0].rows[1]);
    const actualWidths = cells.map(cell => {
      let end = cell.col;
      while (end < sheet.columnCount && sheet.getCell(cell.row, end + 1).master.address === cell.address) end++;
      return Array.from({ length: end - cell.col + 1 }, (_, index) => excelWidthToPoints(sheet.getColumn(cell.col + index).width)).reduce((sum, width) => sum + width, 0);
    });
    actualWidths.forEach((width, index) => expect(width / reportPageWidth(true)).toBeCloseTo(measured.widths[index] / total, 3));
    expect(sheet.lastRow.height).toBeCloseTo(measured.rowHeights[1], 2);
    expect(cells[0].alignment.horizontal).toBe(measured.cells[0].align);
    const zip = await JSZip.loadAsync(await bytes(await createReportWord(report, { printLayout })));
    const xml = await zip.file("word/document.xml").async("string");
    const table = xml.match(/<w:tbl>.*?<\/w:tbl>/g)[1];
    const widths = [...table.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(match => Number(match[1]));
    const wordWidth = widths.reduce((sum, width) => sum + width, 0);
    widths.forEach((width, index) => expect(width / wordWidth).toBeCloseTo(measured.widths[index] / total, 3));
    expect(table).toContain(`w:val="${Math.round(measured.rowHeights[1] * 20)}"`);
  } finally {
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    fs.rmdirSync(folder);
  }
}, 60000);
