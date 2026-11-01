import { BRAND } from "../../config/branding";
import { gradebookColumns, gradebookRowValues, isExamCandidate } from "./gradebook";
import { gradebookDocumentColumns } from "./gradebookLayout";
import { scheduleDocumentMetadata } from "../scheduling/scheduleExport";

export const EXAM_LIST_HEADER_ROW = 4;

export function buildExamListDocument(group, offering, rows) {
  return {
    kind: "exam-list", signingDate: "",
    university: BRAND.university.toLocaleUpperCase("vi"), institute: BRAND.institute.toLocaleUpperCase("vi"),
    title: "LỊCH THI KẾT THÚC HỌC PHẦN", group: group?.name || group?.code || "", subject: offering?.subject?.name || "",
    headers: gradebookColumns(true).map(column => column.label),
    rows: rows.filter(isExamCandidate).map((row, index) => gradebookRowValues(row, index, true)),
  };
}

export function examListDocumentMetadata(document) {
  return {
    ...scheduleDocumentMetadata({ rows: document.rows }),
    institution: [document.university, document.institute],
    title: "LỊCH THI KẾT THÚC HỌC PHẦN",
    range: `Lớp: ${document.group}`,
    notice: `Học phần: ${document.subject}`,
    total: `Tổng số: ${document.rows.length} học viên`,
  };
}

export async function createExamListExcel(document) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const sheet = book.addWorksheet("Danh sách thi");
  const columns = gradebookDocumentColumns(document, true);
  const catalog = gradebookColumns(true);
  const metadata = examListDocumentMetadata(document);
  const font = (size = 11, bold = false) => ({ name: "Times New Roman", size, bold, color: { argb: "FF000000" } });
  sheet.columns = columns.map(column => ({ width: column.width, style: { font: font() } }));
  // Match the schedule's two balanced masthead blocks using actual column widths.
  const halfWidth = columns.reduce((sum, column) => sum + column.width, 0) / 2;
  let leftEnd = 1, usedWidth = 0, bestDistance = Infinity;
  columns.slice(0, -1).forEach((column, index) => {
    usedWidth += column.width;
    if (Math.abs(usedWidth - halfWidth) < bestDistance) { leftEnd = index + 1; bestDistance = Math.abs(usedWidth - halfWidth); }
  });
  const lineCount = (text, width) => String(text ?? "").split(/\r?\n/).reduce((sum, line) =>
    sum + Math.max(1, Math.ceil(line.length / Math.max(1, width - 2))), 0);
  const heading = (rowNumber, from, to, text, { size = 12, bold = false, horizontal = "center", italic = false, height = 22 } = {}) => {
    if (from !== to) sheet.mergeCells(rowNumber, from, rowNumber, to);
    const cell = sheet.getCell(rowNumber, from);
    cell.value = text;
    cell.font = { ...font(size, bold), italic };
    cell.alignment = { horizontal, vertical: "middle", wrapText: true };
    const width = columns.slice(from - 1, to).reduce((sum, column) => sum + column.width, 0);
    const row = sheet.getRow(rowNumber);
    row.height = Math.min(409, Math.max(row.height || 0, height, lineCount(text, width * 11 / size) * (size + 3) + 6));
  };
  heading(1, 1, leftEnd, document.university);
  heading(2, 1, leftEnd, document.institute, { bold: true, height: 32 });
  heading(1, leftEnd + 1, columns.length, metadata.title, { bold: true, size: 14 });
  heading(2, leftEnd + 1, columns.length, `Lớp: ${document.group}`, { size: 11, height: 32 });
  heading(3, 1, columns.length, `Học phần: ${document.subject}`, { horizontal: "left", italic: true, size: 11, height: 32 });

  const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
  [document.headers, ...document.rows].forEach((values, index) => {
    const row = sheet.getRow(EXAM_LIST_HEADER_ROW + index);
    row.height = Math.min(409, Math.max(index === 0 ? 28 : 22, ...values.map((value, column) =>
      index > 0 && columns[column].nowrap ? 22 : lineCount(value, columns[column].width) * 16 + 6)));
    for (let column = 1; column <= columns.length; column++) {
      const cell = row.getCell(column);
      cell.value = values[column - 1] ?? "";
      cell.font = font(11, index === 0);
      cell.alignment = {
        vertical: "middle", horizontal: index === 0 ? "center" : catalog[column - 1].align || "left",
        wrapText: index === 0 || !columns[column - 1].nowrap,
        ...(index > 0 && columns[column - 1].nowrap ? { shrinkToFit: true } : {}),
      };
      cell.border = border;
      if (index === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
    }
  });
  const lastRow = EXAM_LIST_HEADER_ROW + document.rows.length;
  heading(lastRow + 1, 1, columns.length, metadata.total, { horizontal: "right", italic: true, size: 11 });
  metadata.duty.forEach((text, index) => heading(lastRow + 2 + index, 1, columns.length, text, { horizontal: "left", size: 11 }));
  const signatureRow = lastRow + 4;
  metadata.signatures.forEach((text, index) => {
    const from = index === 0 ? 1 : leftEnd + 1;
    const to = index === 0 ? leftEnd : columns.length;
    heading(signatureRow, from, to, text, { bold: true, size: 11 });
    heading(signatureRow + 1, from, to, metadata.signaturePrompt, { italic: true, size: 11 });
  });
  sheet.getRow(signatureRow + 2).height = 30;
  sheet.getRow(signatureRow + 3).height = 30;
  sheet.views = [{ state: "frozen", ySplit: EXAM_LIST_HEADER_ROW, showGridLines: true }];
  sheet.autoFilter = { from: { row: EXAM_LIST_HEADER_ROW, column: 1 }, to: { row: lastRow, column: columns.length } };
  sheet.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `${EXAM_LIST_HEADER_ROW}:${EXAM_LIST_HEADER_ROW}`,
    printArea: `A1:${sheet.getColumn(columns.length).letter}${signatureRow + 3}`,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
  };
  sheet.headerFooter.oddFooter = `&L&"Times New Roman,Bold"&8${metadata.footer[0]}&R${metadata.footer[1]}`;
  sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
