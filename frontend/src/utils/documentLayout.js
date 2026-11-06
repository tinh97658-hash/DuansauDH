// Physical units shared by print, DOCX (twips) and XLSX (points/inches).
export const mmToPoints = mm => mm * 72 / 25.4;
export const pointsToTwips = points => Math.round(points * 20);
// ExcelJS writes OOXML column widths directly. These already include padding;
// subtracting the UI's 5px padding here narrows every column, especially forms
// split into many small columns to support independently merged fields.
// The workbook's Normal font is Calibri 11 (maximum digit width: 7px at 96dpi).
export const pointsToExcelWidth = points => points * 4 / 3 / 7;
export const excelWidthToPoints = width => width * 7 * 3 / 4;
export const REPORT_LAYOUT = Object.freeze({ margin: 12, heading: 10, title: 15, body: 11, table: 10, line: 1.35, padding: 3.75 });
export const reportPageWidth = landscape => mmToPoints((landscape ? 297 : 210) - 2 * REPORT_LAYOUT.margin);
export const sameDocumentTitle = (left, right) => String(left || "").trim().toLocaleLowerCase("vi-VN") === String(right || "").trim().toLocaleLowerCase("vi-VN");

export function excelRowHeight(values, widths, fontSize = 10, padding = 7.5, minimum = 0) {
  return Math.min(409, Math.max(minimum, ...values.map((value, index) => {
    const text = value?.richText ? value.richText.map(run => run.text).join("") : String(value ?? "");
    const capacity = Math.max(1, (widths[index] - padding) / (fontSize * .5));
    const lines = text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / capacity)), 0);
    return lines * fontSize * 1.35 + padding;
  })));
}

// Additional boundaries let metadata, signatures and tables use independent
// column grids without changing their physical position on the printed sheet.
export function createExcelForm(book, name, { widths, stops = [], fontSize = 12, margins, landscape = false }) {
  const width = widths.reduce((sum, value) => sum + value, 0);
  const edges = widths.reduce((values, value) => [...values, values[values.length - 1] + value], [0]);
  const boundaries = [...new Set([...edges, ...stops, 0, width].map(value => Math.round(value * 100) / 100))].sort((a, b) => a - b);
  const sheet = book.addWorksheet(name);
  sheet.columns = boundaries.slice(1).map((edge, index) => ({ width: pointsToExcelWidth(edge - boundaries[index]), style: { font: { name: "Times New Roman", size: fontSize } } }));
  const columnAt = point => boundaries.findIndex(value => Math.abs(value - point) < .02) + 1;
  const put = (row, from, to, value, { size = fontSize, bold = false, horizontal = "left", height, exactHeight = false, border, ...font } = {}) => {
    const start = columnAt(from), end = columnAt(to) - 1;
    if (start < 1 || end < start) throw new Error("Ranh giới cột biểu mẫu không hợp lệ.");
    if (end > start) sheet.mergeCells(row, start, row, end);
    const cell = sheet.getCell(row, start);
    cell.value = value;
    cell.font = { name: "Times New Roman", size, bold, ...font };
    cell.alignment = { horizontal, vertical: "top", wrapText: true };
    if (border) for (let col = start; col <= end; col++) sheet.getCell(row, col).border = border;
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height || 0, height || 0, exactHeight ? 0 : excelRowHeight([value], [to - from], size, 0));
    return cell;
  };
  const finish = (lastRow, headerRow, lastHeaderRow = headerRow) => {
    sheet.views = [{ showGridLines: false }];
    sheet.pageSetup = { paperSize: 9, orientation: landscape ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printArea: `A1:${sheet.getColumn(boundaries.length - 1).letter}${lastRow}`, margins,
      ...(headerRow ? { printTitlesRow: `${headerRow}:${lastHeaderRow}` } : {}) };
  };
  return { sheet, width, edges, put, finish, columnAt };
}
