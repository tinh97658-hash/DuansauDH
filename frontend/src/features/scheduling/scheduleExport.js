import { groupsOf } from "./shared";
import { downloadDocumentFile, openDocumentPreview } from "../../utils/documentFiles";
import { majorDisciplineId } from "../../utils/disciplineScope";

const PERIOD_LABELS = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

const displayDate = (value) => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "";
};

export const SCHEDULE_EXPORT_HEADERS = [
  "STT", "Ngày học", "Buổi", "Ngành", "Chuyên ngành", "Học phần", "Lớp", "Giảng viên", "Phòng", "Ghi chú",
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
        displayDate(session.sessionDate),
        PERIOD_LABELS[session.period] || session.period || "",
        names(groupMajors.map((major) => major.discipline?.name)),
        names(groupMajors.map((major) => major.name)),
        offering.subject?.name || "",
        names(groups.map((group) => group.code || group.name)),
        session.lecturer?.name || "Chưa có giảng viên",
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
      && Array.isArray(data.rows) && data.rows.every((row) => Array.isArray(row) && [SCHEDULE_EXPORT_HEADERS.length, 15].includes(row.length)
        && row.every((cell) => typeof cell === "string" || typeof cell === "number"));
    // Upgrade snapshots from already-open preview tabs; new exports contain only ten document fields.
    return valid ? { ...data, rows: data.rows.map((row) => row.length === 15
      ? [0, 1, 2, 8, 9, 5, 7, 10, 11, 14].map((index) => row[index]) : row) } : null;
  } catch { return null; }
}

export function scheduleDocumentMetadata(schedule) {
  return {
    institution: ["BỘ XÂY DỰNG", "TRƯỜNG ĐẠI HỌC HÀNG HẢI VIỆT NAM", "VIỆN ĐÀO TẠO SAU ĐẠI HỌC"],
    nationalHeading: ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"],
    title: "LỊCH HỌC SAU ĐẠI HỌC",
    range: `Tuần từ ${displayDate(schedule.week)} đến ${displayDate(schedule.end)}`,
    scope: [{ label: "Ngành", value: schedule.discipline }, { label: "Chuyên ngành", value: schedule.major }, { label: "Khóa / Năm học", value: schedule.year }],
    total: `Tổng số: ${schedule.rows.length} buổi học`,
  };
}

// One column selection/order for Preview, Print, Word and Excel.
// Selected scope values are already printed in the document heading.
export function scheduleDocumentColumns(schedule) {
  const selectedMajor = schedule.majorId !== undefined ? !!schedule.majorId : !!schedule.major && !schedule.major.startsWith("Tất cả");
  const selectedDiscipline = schedule.disciplineId !== undefined ? !!schedule.disciplineId : !!schedule.discipline && !schedule.discipline.startsWith("Tất cả");
  return [
    { key: "number", label: "STT", weight: 7, excelWidth: 6, fields: [0], nowrap: true },
    { key: "date", label: "Ngày học", weight: 23, excelWidth: 14, fields: [1], nowrap: true },
    { key: "period", label: "Buổi", weight: 14, excelWidth: 10, fields: [2], nowrap: true },
    ...(!selectedMajor && !selectedDiscipline ? [{ key: "discipline", label: "Ngành", weight: 28, excelWidth: 28, fields: [3] }] : []),
    ...(!selectedMajor ? [{ key: "major", label: "Chuyên ngành", weight: 30, excelWidth: 28, fields: [4] }] : []),
    { key: "subject", label: "Học phần", weight: 40, excelWidth: 32, fields: [5] },
    { key: "groups", label: "Lớp", weight: 32, excelWidth: 28, fields: [6] },
    { key: "lecturer", label: "Giảng viên", weight: 30, excelWidth: 26, fields: [7] },
    { key: "room", label: "Phòng", weight: schedule.rows.reduce((width, row) => Math.max(width, String(row[8]).length * 2), 18), excelWidth: 16, fields: [8], nowrap: true },
    { key: "note", label: "Ghi chú", weight: 32, excelWidth: 36, fields: [9] },
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
  metadata.nationalHeading.forEach((text, index) => mergedHeading(index + 1, leftEnd + 1, columns.length, text, { bold: true }));
  mergedHeading(3, leftEnd + 1, columns.length, "");
  mergedHeading(4, 1, columns.length, metadata.title, { bold: true, size: 17 });
  sheet.getRow(4).height = 30;
  mergedHeading(5, 1, columns.length, metadata.range, { italic: true });
  metadata.scope.forEach(({ label, value }, index) => mergedHeading(6 + index, 1, columns.length, `${label}: ${value}`, { horizontal: "left" }));
  sheet.getRow(9).height = 8;
  const header = sheet.addRow(columns.map((column) => column.label));
  header.font = { name: "Times New Roman", size: 11, bold: true };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 30;
  const border = (color) => Object.fromEntries(["top", "bottom", "left", "right"].map((side) => [side, { style: "thin", color: { argb: color } }]));
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF1F6" } };
    cell.border = border("FF718096");
  });
  values.forEach((cells) => {
    const row = sheet.addRow(cells);
    row.font = { name: "Times New Roman", size: 11 };
    row.eachCell((cell, column) => {
      cell.alignment = { vertical: "middle", horizontal: columns[column - 1].nowrap ? "center" : "left", wrapText: !columns[column - 1].nowrap };
      cell.border = border("FFA6B2BE");
    });
    row.height = Math.min(409, Math.max(22, ...cells.map((value, index) => columns[index].nowrap ? 22
      : String(value).split(/\r?\n/).reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / (sheet.getColumn(index + 1).width - 2))), 0) * 16 + 6)));
  });
  // Keep every data row unmerged so Excel's filter and sort continue to work.
  const footerRow = header.number + schedule.rows.length + 1;
  mergedHeading(footerRow, 1, columns.length, metadata.total, { horizontal: "right", italic: true });
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + schedule.rows.length, column: columns.length } };
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${header.number}:${header.number}` };
  sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(columns.length).letter}${footerRow}`;
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function createScheduleWord(schedule) {
  const { AlignmentType, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TableLayoutType, TextRun, VerticalAlign, WidthType } = await import("docx");
  const paragraph = (text, options = {}) => new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
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
        ...metadata.institution.map((text, index) => paragraph(text, { center: true, bold: index === 1, size: index === 1 ? 27 : 25, keepNext: true })),
      ] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        ...metadata.nationalHeading.map((text, index) => paragraph(text, { center: true, bold: true, size: index === 0 ? 27 : 25, keepNext: true })),
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
      verticalAlign: heading ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: heading ? { fill: "DCECF6" } : undefined,
      children: (heading ? [{ text: column.label }] : scheduleDocumentCell(values, column)).map((part) =>
        paragraph(part.text, { bold: heading, center: heading || column.nowrap, size: 21, after: 0, keepNext: heading })),
    })),
  });
  const table = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
    rows: [tableRow(null, true), ...schedule.rows.map((row) => tableRow(row))],
  });
  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 454, bottom: 454, left: 454, right: 454 } } },
      children: [masthead, paragraph(metadata.title, { center: true, bold: true, size: 34, before: 240, after: 60, keepNext: true }),
        paragraph(metadata.range, { center: true, italic: true, size: 25, after: 120, keepNext: true }),
        ...metadata.scope.map(({ label: name, value }, index) => {
          const label = `${name}: ${value}`;
          const colon = label.indexOf(":") + 1;
          return paragraph("", { after: index === 2 ? 120 : 40, keepNext: true, children: [
            new TextRun({ text: label.slice(0, colon), bold: true, size: 24 }),
            new TextRun({ text: label.slice(colon), size: 24 }),
          ] });
        }), table,
        ...(!schedule.rows.length ? [paragraph("Không có lịch học trong phạm vi đã chọn.")] : []),
        paragraph(metadata.total, { center: false, italic: true })],
    }],
  });
  return Packer.toBlob(doc);
}

export const downloadScheduleFile = downloadDocumentFile;
