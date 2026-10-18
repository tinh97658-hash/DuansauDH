import { formatDate } from "../../utils/dateFormat";
import { groupsOf } from "./shared";
import { downloadDocumentFile, openDocumentPreview } from "../../utils/documentFiles";
import { majorDisciplineId } from "../../utils/disciplineScope";

const PERIOD_LABELS = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

const displayDate = (value) => formatDate(value, "");

export const SCHEDULE_EXPORT_HEADERS = [
  "STT", "Chuyên ngành", "Lớp", "Học phần", "Giảng viên", "Ngày học", "Buổi", "Phòng học", "Ghi chú",
];

export function scheduleExportRows(sessions, majorCatalog = []) {
  const catalog = new Map(majorCatalog.map((major) => [major.id, major]));
  return [...sessions]
    .sort((left, right) => `${left.sessionDate} ${left.period === "AFTERNOON" ? 1 : 0} ${left.startTime || ""}`
      .localeCompare(`${right.sessionDate} ${right.period === "AFTERNOON" ? 1 : 0} ${right.startTime || ""}`))
    .map((session, index) => {
      const offering = session.courseOffering || {};
      const groups = groupsOf(offering);
      const groupMajors = groups.map((group) => catalog.get(group.majorId || group.major?.id) || group.major).filter(Boolean);
      const names = (values) => [...new Set(values.filter(Boolean))].join(", ");
      return [
        index + 1,
        names(groupMajors.map((major) => major.name)),
        names(groups.map((group) => group.code || group.name)),
        offering.subject?.name || "",
        session.lecturer?.name || "Chưa có giảng viên",
        displayDate(session.sessionDate),
        PERIOD_LABELS[session.period] || session.period || "",
        session.room?.code || session.room?.name || "Chưa có phòng",
        session.note || "",
      ];
    });
}

export function buildScheduleDocument({ week, end, disciplineId = "", majorId = "", year = "", majors = [], sessions = [] }) {
  const selectedMajor = majors.find((major) => major.id === majorId);
  const documentDisciplineId = selectedMajor ? majorDisciplineId(selectedMajor) : disciplineId;
  const discipline = majors.find((major) => majorDisciplineId(major) === documentDisciplineId)?.discipline;
  return {
    week, end, disciplineId: documentDisciplineId, majorId,
    discipline: discipline?.name || "Tất cả ngành",
    major: selectedMajor?.name || "Tất cả chuyên ngành",
    year: year || "Tất cả",
    rows: scheduleExportRows(sessions, majors),
  };
}

export function displayScheduleExportDate(value) {
  return displayDate(value);
}

const PREVIEW_PREFIX = "schedule-preview:";
const RETURN_VIEW_KEY = "schedule-preview:return-view";

export function readScheduleReturnView() {
  try {
    const view = JSON.parse(window.sessionStorage.getItem(RETURN_VIEW_KEY));
    return view && ["week", "disciplineId", "majorId", "year", "status", "query", "selectedId", "focusedDate"]
      .every((key) => typeof view[key] === "string") && typeof view.sidebarCollapsed === "boolean" ? view : null;
  } catch { return null; }
}

export function clearScheduleReturnView() {
  try { window.sessionStorage.removeItem(RETURN_VIEW_KEY); } catch { /* Session storage may be unavailable. */ }
}

// Store only the displayed export data, so filters and statuses stay identical
// in the document, downloaded files and after reloading the preview tab.
export function exportSchedule(schedule, returnView) {
  if (returnView) {
    try { window.sessionStorage.setItem(RETURN_VIEW_KEY, JSON.stringify(returnView)); }
    catch { throw new Error("Không thể lưu trạng thái Xếp lịch trước khi mở PDF. Vui lòng cho phép lưu dữ liệu phiên và thử lại."); }
  }
  try { openDocumentPreview({ prefix: PREVIEW_PREFIX, path: "/masters/schedule/preview", snapshot: schedule }); }
  catch (error) { if (returnView) clearScheduleReturnView(); throw error; }
}

export function readSchedulePreview(id) {
  if (!id) return null;
  try {
    const data = JSON.parse(window.sessionStorage.getItem(`${PREVIEW_PREFIX}${id}`));
    const valid = data?.version === 1 && typeof data.week === "string" && typeof data.end === "string"
      && [data.discipline, data.major, data.year].every((value) => typeof value === "string")
      && [data.disciplineId, data.majorId].every((value) => value === undefined || typeof value === "string")
      && Array.isArray(data.rows) && data.rows.every((row) => Array.isArray(row) && [SCHEDULE_EXPORT_HEADERS.length, 10, 15].includes(row.length)
        && row.every((cell) => typeof cell === "string" || typeof cell === "number"));
    // Keep already-open previews readable after changing the document format.
    return valid ? { ...data, rows: data.rows.map((row) => row.length === 15
      ? [0, 9, 7, 5, 10, 1, 2, 11, 14].map((index) => row[index])
      : row.length === 10 ? [0, 4, 6, 5, 7, 1, 2, 8, 9].map((index) => row[index]) : row) } : null;
  } catch { return null; }
}

export function scheduleDocumentMetadata(schedule) {
  const weekDate = new Date(`${schedule.week}T00:00:00Z`);
  const validWeek = !Number.isNaN(weekDate.getTime());
  if (validWeek) weekDate.setUTCDate(weekDate.getUTCDate() + 4 - (weekDate.getUTCDay() || 7));
  const weekYear = weekDate.getUTCFullYear();
  const weekNumber = Math.ceil(((weekDate - new Date(Date.UTC(weekYear, 0, 1))) / 86400000 + 1) / 7);
  return {
    institution: ["TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM", "VIỆN ĐÀO TẠO SAU ĐẠI HỌC"],
    title: "KẾ HOẠCH GIẢNG DẠY VÀ HỌC TẬP",
    range: `Từ ngày: ${displayDate(schedule.week)} đến ngày ${displayDate(schedule.end)}${validWeek ? ` (Tuần ${weekNumber} năm ${weekYear})` : ""}`,
    notice: "Ghi chú chung:",
    duty: ["Lịch trực lãnh đạo:", "Lịch trực chuyên viên:"],
    signatures: ["Viện trưởng Viện ĐTSĐH", "Cán bộ phụ trách"],
    signaturePrompt: "(Ký, ghi rõ họ tên)",
    footer: ["NBH: ……………… - REV: …", "BM.04-QT.SĐH.03"],
    total: `Tổng số: ${schedule.rows.length} buổi học`,
  };
}

// Always print the same nine columns, including the selected major.
export function scheduleDocumentColumns() {
  return [
    { key: "number", label: "STT", weight: 8, excelWidth: 6, fields: [0], nowrap: true, center: true },
    { key: "major", label: "Chuyên ngành", weight: 30, excelWidth: 28, fields: [1] },
    { key: "groups", label: "Lớp", weight: 28, excelWidth: 26, fields: [2] },
    { key: "subject", label: "Học phần", weight: 42, excelWidth: 38, fields: [3] },
    { key: "lecturer", label: "Giảng viên", weight: 30, excelWidth: 28, fields: [4], center: true },
    { key: "date", label: "Ngày học", weight: 23, excelWidth: 14, fields: [5], nowrap: true, center: true },
    { key: "period", label: "Buổi", weight: 13, excelWidth: 10, fields: [6], nowrap: true, center: true },
    { key: "room", label: "Phòng học", weight: 22, excelWidth: 18, fields: [7], center: true },
    { key: "note", label: "Ghi chú", weight: 26, excelWidth: 28, fields: [8] },
  ];
}

export function scheduleDocumentCell(row, column) {
  const parts = column.fields.filter((index) => row[index] !== "").map((index) => ({
    text: String(row[index]),
    nowrap: !!column.nowrap,
  }));
  return parts.length ? parts : [{ text: "", nowrap: false }];
}

export async function createScheduleExcel(schedule) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const sheet = book.addWorksheet("Lịch học");
  const columns = scheduleDocumentColumns(schedule);
  const metadata = scheduleDocumentMetadata(schedule);
  const valuesFor = (row) => columns.map((column) => row[column.fields[0]]);
  const values = schedule.rows.map(valuesFor);
  sheet.columns = columns.map((column, index) => ({
    width: column.nowrap ? values.reduce((width, row) => Math.max(width, String(row[index]).length + 2), column.excelWidth) : column.excelWidth,
  }));
  // Split by physical column widths so the two masthead blocks stay balanced in all scopes.
  const halfWidth = sheet.columns.reduce((sum, column) => sum + column.width, 0) / 2;
  let leftEnd = 1, usedWidth = 0, bestDistance = Infinity;
  sheet.columns.slice(0, -1).forEach((column, index) => {
    usedWidth += column.width;
    if (Math.abs(usedWidth - halfWidth) < bestDistance) { leftEnd = index + 1; bestDistance = Math.abs(usedWidth - halfWidth); }
  });
  const mergedHeading = (rowNumber, from, to, text, { bold = false, size = 12, horizontal = "center", italic = false } = {}) => {
    if (from !== to) sheet.mergeCells(rowNumber, from, rowNumber, to);
    const cell = sheet.getCell(rowNumber, from);
    cell.value = text;
    cell.font = { name: "Times New Roman", size, bold, italic };
    cell.alignment = { horizontal, vertical: "middle", wrapText: true };
    sheet.getRow(rowNumber).height = 22;
    return cell;
  };
  metadata.institution.forEach((text, index) => mergedHeading(index + 1, 1, leftEnd, text, { bold: index === 1 }));
  mergedHeading(1, leftEnd + 1, columns.length, metadata.title, { bold: true, size: 14 });
  mergedHeading(2, leftEnd + 1, columns.length, metadata.range, { size: 11 });
  sheet.getRow(2).height = 32;
  mergedHeading(3, 1, columns.length, metadata.notice, { horizontal: "left", italic: true, size: 11 });
  sheet.getRow(3).height = 32;
  const header = sheet.addRow(columns.map((column) => column.label));
  header.font = { name: "Times New Roman", size: 11, bold: true };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 28;
  const border = (color) => Object.fromEntries(["top", "bottom", "left", "right"].map((side) => [side, { style: "thin", color: { argb: color } }]));
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
    cell.border = border("FF000000");
  });
  const firstDataRow = header.number + 1;
  values.forEach((cells) => {
    const row = sheet.addRow(cells);
    row.font = { name: "Times New Roman", size: 11 };
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.alignment = { vertical: "middle", horizontal: columns[column - 1].center ? "center" : "left", wrapText: !columns[column - 1].nowrap };
      cell.border = border("FF000000");
    });
    row.height = Math.min(409, Math.max(22, ...cells.map((value, index) => columns[index].nowrap ? 22
      : String(value).split(/\r?\n/).reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / (sheet.getColumn(index + 1).width - 2))), 0) * 16 + 6)));
  });
  if (!values.length) {
    const empty = mergedHeading(firstDataRow, 1, columns.length, "Không có lịch học trong phạm vi đã chọn.", { size: 11 });
    empty.border = border("FF000000");
  }
  const totalRow = firstDataRow + Math.max(1, values.length);
  mergedHeading(totalRow, 1, columns.length, metadata.total, { horizontal: "right", italic: true, size: 11 });
  metadata.duty.forEach((text, index) => mergedHeading(totalRow + 1 + index, 1, columns.length, text, { horizontal: "left", size: 11 }));
  const signatureRow = totalRow + 3;
  metadata.signatures.forEach((text, index) => {
    const from = index === 0 ? 1 : leftEnd + 1;
    const to = index === 0 ? leftEnd : columns.length;
    mergedHeading(signatureRow, from, to, text, { bold: true, size: 11 });
    mergedHeading(signatureRow + 1, from, to, metadata.signaturePrompt, { italic: true, size: 11 });
  });
  // Reserve space for handwritten signatures; no stored person's name is assumed.
  sheet.getRow(signatureRow + 2).height = 30;
  sheet.getRow(signatureRow + 3).height = 30;
  sheet.views = [{ state: "frozen", ySplit: firstDataRow - 1 }];
  // Keep the table header and all session rows unmerged for filtering and sorting.
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + values.length, column: columns.length } };
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${header.number}:${header.number}` };
  sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(columns.length).letter}${signatureRow + 3}`;
  sheet.headerFooter.oddFooter = `&L&"Times New Roman,Bold"&8${metadata.footer[0]}&R${metadata.footer[1]}`;
  sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function createScheduleWord(schedule) {
  const { AlignmentType, BorderStyle, Document, Footer, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TableLayoutType, TextRun, VerticalAlign, WidthType } = await import("docx");
  const paragraph = (text, options = {}) => new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: options.before || 0, after: options.after ?? 40, line: 276 },
    keepNext: !!options.keepNext,
    children: options.children || [new TextRun({ text: String(text), bold: !!options.bold, italics: !!options.italic, size: options.size || 24 })],
  });
  const contentWidth = 16838 - 2 * 454;
  const metadata = scheduleDocumentMetadata(schedule);
  const masthead = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth / 2, contentWidth / 2],
    layout: TableLayoutType.FIXED,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: "nil" }])),
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        ...metadata.institution.map((text, index) => paragraph(text, { center: true, bold: index === 1, size: 24, keepNext: true })),
      ] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        paragraph(metadata.title, { center: true, bold: true, size: 28, keepNext: true }),
        paragraph(metadata.range, { center: true, size: 22, keepNext: true }),
      ] }),
    ] })],
  });
  const columns = scheduleDocumentColumns(schedule);
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const columnWidths = columns.map((column) => Math.floor(contentWidth * column.weight / totalWeight));
  columnWidths[columnWidths.length - 1] += contentWidth - columnWidths.reduce((sum, width) => sum + width, 0);
  const tableRow = (values, heading = false) => new TableRow({
    tableHeader: heading,
    cantSplit: true,
    children: columns.map((column, index) => new TableCell({
      width: { size: columnWidths[index], type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      shading: heading ? { fill: "DCE6F1" } : undefined,
      children: (heading ? [{ text: column.label }] : scheduleDocumentCell(values, column)).map((part) =>
        paragraph(part.text, { bold: heading, center: heading || column.center, size: 21, after: 0, keepNext: heading })),
    })),
  });
  const table = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.SINGLE, size: 4, color: "000000" }])),
    rows: [tableRow(null, true), ...schedule.rows.map((row) => tableRow(row))],
  });
  const signatures = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth / 2, contentWidth / 2],
    layout: TableLayoutType.FIXED,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.NIL }])),
    rows: [new TableRow({ cantSplit: true, children: metadata.signatures.map((title) => new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [paragraph(title, { center: true, bold: true, size: 22, keepNext: true }),
        paragraph(metadata.signaturePrompt, { center: true, italic: true, size: 22, after: 900 })],
    })) })],
  });
  const formFooter = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth / 2, contentWidth / 2],
    layout: TableLayoutType.FIXED,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, {
      style: side === "top" ? BorderStyle.SINGLE : BorderStyle.NIL, size: 4, color: "000000",
    }])),
    rows: [new TableRow({ children: metadata.footer.map((text, index) => new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE }, children: [paragraph(text, { right: index === 1, bold: true, size: 18, after: 0 })],
    })) })],
  });
  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 454, bottom: 680, left: 454, right: 454, footer: 227 } } },
      footers: { default: new Footer({ children: [formFooter] }) },
      children: [masthead,
        paragraph(metadata.notice, { italic: true, size: 22, before: 100, after: 240, keepNext: true }), table,
        ...(!schedule.rows.length ? [paragraph("Không có lịch học trong phạm vi đã chọn.")] : []),
        paragraph(metadata.total, { right: true, italic: true, size: 22, before: 100 }),
        ...metadata.duty.map((text) => paragraph(text, { size: 22, keepNext: true })),
        signatures],
    }],
  });
  return Packer.toBlob(doc);
}

export const downloadScheduleFile = downloadDocumentFile;
