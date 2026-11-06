import { BRAND } from "../../config/branding";
import { formatDateTime } from "../../utils/dateFormat";
import { openDocumentPreview } from "../../utils/documentFiles";
import { mmToPoints, pointsToExcelWidth, excelRowHeight } from "../../utils/documentLayout";
import { examAttendanceLabel, draftOf, gradebookColumns, gradebookRowValues, visibleGradeRows } from "./gradebook";
import { gradebookDocumentColumns } from "./gradebookLayout";

export const GRADEBOOK_HEADER_ROW = 9;
const PREVIEW_PREFIX = "gradebook-preview:";

// The API caps pages at 15. Retain the CSV snapshot and draft-overlay semantics.
export async function fetchAllGradebookRows(fetchPage, params, getDirty = () => ({})) {
  const exported = [];
  let page = 1, total = 0, revision;
  let eligibilitySnapshot;
  do {
    const { data } = await fetchPage({ ...params, page, pageSize: 15 });
    if (params.mode === "exam") {
      if (data.unassessedRows !== 0) throw new Error("Chưa xét đủ tư cách của cả lớp. Nhập đủ điểm kiểm tra và BTL/TL/KT, rồi cập nhật bảng trước khi in danh sách thi.");
      const snapshot = JSON.stringify([data.totalRows, data.eligibilityPolicies || data.eligibilityPolicy]);
      if (eligibilitySnapshot !== undefined && snapshot !== eligibilitySnapshot) throw new Error("Tư cách thi hoặc danh sách lớp đã thay đổi. Vui lòng xuất lại.");
      eligibilitySnapshot = snapshot;
    }
    if (revision !== undefined && data.revision !== revision) throw new Error("Bảng điểm đã thay đổi trong lúc xuất. Vui lòng xuất lại.");
    revision = data.revision;
    total = data.total;
    if (data.page !== page) throw new Error("Danh sách đã thay đổi trong lúc xuất. Vui lòng xuất lại.");
    exported.push(...data.rows.map(row => row.finalized || (data.workflow && data.workflow.status !== "draft") || row.profileForeignLanguageExempt || row.studyLeaveFailure || examAttendanceLabel(row) ? draftOf(row) : getDirty()[row.participantId] || draftOf(row)));
    page++;
  } while ((page - 1) * 15 < total);
  return visibleGradeRows(exported, params.mode, params.search);
}

export function buildGradebookDocument(group, offering, rows, now = new Date()) {
  return {
    university: BRAND.university.toLocaleUpperCase("vi"), institute: BRAND.institute.toLocaleUpperCase("vi"),
    title: "BẢNG ĐIỂM MÔN HỌC", group: group?.name || group?.code || "",
    subject: offering?.subject?.name || "", headers: gradebookColumns().map(column => column.label),
    rows: rows.map((row, index) => gradebookRowValues(row, index)),
    signingDate: `Hải Phòng, ngày ${formatDateTime(now).split(" ")[0]}`,
  };
}

export function gradebookFilename(group, offering, prefix = "Bang-diem-mon-hoc") {
  const safe = value => Array.from(String(value || ""), character => character.charCodeAt(0) < 32 ? "-" : character)
    .join("").replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "").slice(0, 80) || "chua-co-ma";
  return `${prefix}-${safe(group?.code)}-${safe(offering?.subject?.code)}.xlsx`;
}

export async function createGradebookExcel(document) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const sheet = book.addWorksheet("Bảng điểm môn học");
  const lastColumn = document.headers.length;
  const columns = gradebookDocumentColumns(document);
  const font = (size = 11, bold = false) => ({ name: "Times New Roman", size, bold, color: { argb: "FF000000" } });
  const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);
  const physicalWidths = columns.map(column => mmToPoints(281) * column.width / totalWeight);
  sheet.columns = physicalWidths.map(width => ({ width: pointsToExcelWidth(width), style: { font: font(9) } }));
  const lineCount = (text, width, size) => String(text ?? "").split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(1, width * 0.85 * 11 / size))), 0);
  const heading = (row, text, size, bold, minHeight, horizontal = "center", endColumn = lastColumn) => {
    sheet.mergeCells(row, 1, row, endColumn);
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = font(size, bold);
    cell.alignment = { horizontal, vertical: "middle", wrapText: true };
    sheet.getRow(row).height = Math.min(409, Math.max(minHeight, lineCount(text, columns.slice(0, endColumn).reduce((sum, column) => sum + column.width, 0), size) * (size + 3) + 6));
  };
  heading(1, document.university, 12, true, 18, "center", 7);
  heading(2, document.institute, 12, true, 18, "center", 7);
  heading(4, document.title, 16, true, 30);
  heading(6, `Lớp: ${document.group}`, 11, false, 24, "left");
  heading(7, `Học phần: ${document.subject}`, 11, false, 30, "left");
  [5, 8].forEach(row => { sheet.getRow(row).height = 8; });
  const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
  [document.headers, ...document.rows].forEach((values, index) => {
    const row = sheet.getRow(GRADEBOOK_HEADER_ROW + index);
    row.height = excelRowHeight(values, physicalWidths, 9, 4.5, 16);
    for (let column = 1; column <= lastColumn; column++) {
      const cell = row.getCell(column);
      // Plain string values cannot become Excel formulas; drafts remain verbatim.
      cell.value = values[column - 1] ?? "";
      cell.font = font(9, index === 0);
      cell.alignment = { horizontal: index > 0 && [3, 4].includes(column) ? "left" : "center", vertical: "middle", wrapText: index === 0 || !columns[column - 1].nowrap,
        ...(index > 0 && columns[column - 1].nowrap ? { shrinkToFit: true } : {}) };
      cell.border = border;
      if (index === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    }
  });
  sheet.views = [{ state: "frozen", xSplit: 4, ySplit: GRADEBOOK_HEADER_ROW, topLeftCell: `E${GRADEBOOK_HEADER_ROW + 1}`, showGridLines: false }];
  sheet.autoFilter = { from: { row: GRADEBOOK_HEADER_ROW, column: 1 }, to: { row: GRADEBOOK_HEADER_ROW + document.rows.length, column: lastColumn } };
  const signatureRow = GRADEBOOK_HEADER_ROW + document.rows.length + 2;
  const signature = (row, from, to, value, bold = false) => {
    sheet.mergeCells(row, from, row, to);
    const cell = sheet.getCell(row, from);
    cell.value = value; cell.font = font(11, bold);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(row).height = 22;
  };
  const half = Math.floor(lastColumn / 2);
  signature(signatureRow, half + 1, lastColumn, document.signingDate);
  signature(signatureRow + 1, 1, half, "VIỆN TRƯỞNG", true);
  signature(signatureRow + 1, half + 1, lastColumn, "PHỤ TRÁCH LỚP", true);
  sheet.getRow(signatureRow + 2).height = 54;
  sheet.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `${GRADEBOOK_HEADER_ROW}:${GRADEBOOK_HEADER_ROW}`,
    printArea: `A1:${sheet.getColumn(lastColumn).letter}${signatureRow + 2}`,
    margins: { left: 8 / 25.4, right: 8 / 25.4, top: 8 / 25.4, bottom: 8 / 25.4, header: 0, footer: 0 },
  };
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function openGradebookPreview(document, reservedTab) {
  openDocumentPreview({ prefix: PREVIEW_PREFIX, path: "/masters/exam-lists/preview", snapshot: document, fallbackToCurrentTab: false, reservedTab });
}

export function readGradebookPreview(id) {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(`${PREVIEW_PREFIX}${id}`));
    return data?.version === 1 && ["university", "institute", "title", "group", "subject", "signingDate"].every(key => typeof data[key] === "string") &&
      Array.isArray(data.headers) && data.headers.length === gradebookColumns(data.kind === "exam-list").length && data.headers.every(value => typeof value === "string") &&
      Array.isArray(data.rows) && data.rows.every(row => Array.isArray(row) && row.length === data.headers.length && row.every(value => value == null || ["string", "number"].includes(typeof value))) ? data : null;
  } catch { return null; }
}
