import {formatLecturerName} from '../../utils/lecturerName';
import { BRAND } from "../../config/branding";
import { createExcelForm, excelRowHeight } from "../../utils/documentLayout";
import { openDocumentPreview, sanitizeDocumentFilenamePart } from "../../utils/documentFiles";
import { formatScore, numericScore } from "./gradebook";

export const SUBJECT_SIGNING_FORM = {
  title: "THEO DÕI TÌNH HÌNH HỌC TẬP CỦA HỌC VIÊN", code: "BM.02-QT.SDH.03", publishedOn: "05/5/25", revision: "01",
  // Keep the form's nine attendance slots; the roster flows continuously.
  slots: 9,
  widths: [709, 3960, 449, 450, 450, 450, 450, 450, 450, 449, 450, 812, 1103, 1107, 877, 992, 1701],
  signatures: ["VIỆN TRƯỞNG VIỆN ĐTSĐH", "CÁN BỘ PHỤ TRÁCH", "GIẢNG VIÊN GIẢNG DẠY"],
  notes: ["Ghi chú: Phần theo dõi số tiết của học viên Giảng viên đánh dấu “x” là có đi học, đánh dấu “0” là vắng;",
    "Trên cột Kết quả xử lý Giảng viên ghi “Đạt” và “Không đạt” khi kết thúc môn học."],
};
const PREFIX = "subject-signing-preview:";
const unique = values => [...new Set(values.filter(Boolean))].join(" + ");
const score = value => numericScore(value) === null ? "" : Number(formatScore(value));

export function buildSubjectSigningDocument(groups, offering, rows) {
  return {
    kind: "subject-signing", university: BRAND.university.toLocaleUpperCase("vi"), institute: BRAND.institute.toLocaleUpperCase("vi"),
    title: SUBJECT_SIGNING_FORM.title, subject: offering?.subject?.name || "", credits: offering?.subject?.credits ?? "",
    group: unique(groups.map(group => group?.code || group?.name)), cohort: unique(groups.map(group => group?.academicYear)),
    major: unique(groups.map(group => group?.major?.name)), year: offering?.academicYear || "",
    lecturer: formatLecturerName(offering?.lecturer) || "", lecturerUnit: offering?.lecturer?.unit?.name || "",
    location: `${BRAND.institute}, ${BRAND.university}`,
    // Attendance, absences and separate practical marks are not present in the gradebook.
    // Leave them blank for the instructor instead of inferring them from other scores.
    rows: rows.map((row, index) => [index + 1, row.fullName || [row.lastName, row.firstName].filter(Boolean).join(" "),
      ...Array(SUBJECT_SIGNING_FORM.slots).fill(""), score(row.testScore), "", score(row.assignmentScore), "", "",
      row.finalized && row.result === "passed" ? "Đạt" : row.finalized && row.result === "failed" ? "Không đạt" : ""]),
  };
}

export const subjectSigningFilename = (document, format) => `Theo-doi-mon-hoc-${sanitizeDocumentFilenamePart(document.group)}-${sanitizeDocumentFilenamePart(document.subject)}.${format === "word" ? "docx" : "xlsx"}`;
export const SUBJECT_SIGNING_LAYOUT = { width: 15309, left: 860, right: 671, top: 600, bottom: 1080, inset: 560,
  metadataWidths: [[85, 15], [70, 30], [14, 14, 72], [42, 58]] };
const placeholder = (value, fallback = '....................') => value === '' || value == null ? fallback : String(value);
export const signingMetadataFields = document => [
  [["Tên học phần", placeholder(document.subject)], ["Số TC", placeholder(document.credits, '..........')]],
  [["Chuyên ngành", placeholder(document.major)], ["Lớp", placeholder(document.group)]],
  [["Khóa", placeholder(document.cohort, '..........')], ["Năm", placeholder(document.year, '..........')], ["Địa điểm", `${document.location}.`]],
  [["Giảng viên giảng dạy", placeholder(document.lecturer)], ["Cơ quan công tác", placeholder(document.lecturerUnit)]],
];
export const signingMetadataLines = document => signingMetadataFields(document).map(row => row.map(([label, value]) => `${label}: ${value}`).join('     '));
export const subjectSigningDate = "Hải Phòng, ngày ……. tháng ……. năm 20 …";
export function openSubjectSigningPreview(document, reservedTab) {
  openDocumentPreview({ prefix: PREFIX, path: "/masters/exam-lists/preview", snapshot: document, reservedTab, fallbackToCurrentTab: false });
}
export function readSubjectSigningPreview(id) {
  try {
    const value = JSON.parse(sessionStorage.getItem(`${PREFIX}${id}`));
    return value?.version === 1 && value.kind === "subject-signing"
      && ["university", "institute", "title", "subject", "group", "cohort", "major", "year", "lecturer", "lecturerUnit", "location"].every(key => typeof value[key] === "string")
      && ["string", "number"].includes(typeof value.credits) && Array.isArray(value.rows)
      && value.rows.every(row => Array.isArray(row) && row.length === 17 && row.every(cell => typeof cell === "string" || typeof cell === "number" && Number.isFinite(cell))) ? value : null;
  } catch { return null; }
}

export async function createSubjectSigningExcel(document) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const widths = SUBJECT_SIGNING_FORM.widths.map(width => width / 20);
  const width = widths.reduce((sum, value) => sum + value, 0);
  const inset = SUBJECT_SIGNING_LAYOUT.inset / 20, metadataWidth = width - inset - 16;
  const metadataFields = signingMetadataFields(document);
  const metadataEdges = SUBJECT_SIGNING_LAYOUT.metadataWidths.map(percentages => {
    let total = 0;
    return [inset, ...percentages.map(percent => inset + metadataWidth * (total += percent) / 100)];
  });
  const form = createExcelForm(book, "Theo dõi môn học", {
    widths, stops: [...metadataEdges.flat(), inset, inset + 266, 35, width - 16, width / 3, width * 2 / 3],
    fontSize: 13, landscape: true,
    margins: { left: 43 / 72, right: 33.55 / 72, top: 30 / 72, bottom: 54 / 72, header: .1, footer: .4 },
  });
  const { sheet, edges, put, columnAt } = form;
  put(1, inset, inset + 266, document.university, { size: 14, horizontal: "center" });
  put(2, inset, inset + 266, document.institute, { size: 14, bold: true, horizontal: "center" });
  put(3, 0, width, document.title, { size: 14, bold: true, horizontal: "center", height: 30 });
  metadataFields.forEach((fields, row) => fields.forEach(([label, value], col) => {
    const font = { name: "Times New Roman", size: 13 };
    put(4 + row, metadataEdges[row][col], metadataEdges[row][col + 1], { richText: [
      { text: label + ": ", font: { ...font, bold: true } },
      { text: value, font: { ...font, bold: label === "Địa điểm" } },
    ] });
  }));
  const headerRow = 8, subheaderRow = 9, dataRow = 10;
  const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
  const tableCell = (row, from, to, value, bold = false, horizontal = "center") => {
    const cell = put(row, edges[from], edges[to], value, { size: 12, bold, horizontal, border, height: 14.25 });
    cell.alignment.vertical = "middle";
    return cell;
  };
  [[0, "STT"], [1, "Họ và tên học viên"], [16, "Kết quả xử lý"]].forEach(([col, label]) => {
    const first = columnAt(edges[col]), last = columnAt(edges[col + 1]) - 1;
    sheet.mergeCells(headerRow, first, subheaderRow, last);
    const cell = sheet.getCell(headerRow, first);
    cell.value = label; cell.font = { name: "Times New Roman", size: 12, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border;
  });
  tableCell(headerRow, 2, 14, "Theo dõi số tiết học của học viên", true);
  tableCell(headerRow, 14, 16, "Số tiết vắng", true);
  Array.from({ length: 9 }, (_, i) => tableCell(subheaderRow, i + 2, i + 3, "", true));
  ["Điểm KT", "Điểm ThL/TH", "Điểm TL/BTL", "Có lý do", "Không lý do"].forEach((value, i) => tableCell(subheaderRow, 11 + i, 12 + i, value, true));
  sheet.getRow(headerRow).height = Math.max(14, sheet.getRow(headerRow).height || 0);
  sheet.getRow(subheaderRow).height = Math.max(28, sheet.getRow(subheaderRow).height || 0);
  document.rows.forEach((values, row) => {
    values.forEach((value, col) => tableCell(dataRow + row, col, col + 1, value, false, col === 1 ? "left" : "center"));
    sheet.getRow(dataRow + row).height = excelRowHeight(values, widths, 12, 0, 14.25);
  });
  const summaryRow = dataRow + document.rows.length;
  ["Có mặt/Tổng số", "Cán bộ phụ trách"].forEach((value, i) => {
    tableCell(summaryRow + i, 0, 2, value, false, "left");
    for (let col = 2; col < 17; col++) tableCell(summaryRow + i, col, col + 1, "");
    sheet.getRow(summaryRow + i).height = Math.max(26, sheet.getRow(summaryRow + i).height || 0);
  });
  const notesRow = summaryRow + 2, dateRow = notesRow + SUBJECT_SIGNING_FORM.notes.length, signatureRow = dateRow + 1;
  SUBJECT_SIGNING_FORM.notes.forEach((line, i) => put(notesRow + i, 35, width - 16, line, { italic: true }));
  sheet.getCell(notesRow, columnAt(35)).value = { richText: [
    { text: "Ghi chú: ", font: { name: "Times New Roman", size: 13, bold: true, italic: false } },
    { text: "Phần theo dõi số tiết của học viên", font: { name: "Times New Roman", size: 13, bold: true, italic: true } },
    { text: SUBJECT_SIGNING_FORM.notes[0].slice("Ghi chú: Phần theo dõi số tiết của học viên".length), font: { name: "Times New Roman", size: 13, italic: true } },
  ] };
  put(dateRow, width * 2 / 3, width, subjectSigningDate, { italic: true, horizontal: "center" });
  SUBJECT_SIGNING_FORM.signatures.forEach((role, i) => {
    put(signatureRow, width * i / 3, width * (i + 1) / 3, role, { horizontal: "center" });
    put(signatureRow + 1, width * i / 3, width * (i + 1) / 3, "(Ký và ghi rõ họ tên)", { italic: true, horizontal: "center" });
  });
  const finalRow = signatureRow + 2;
  sheet.getRow(finalRow).height = 45;
  form.finish(finalRow, headerRow, subheaderRow);
  sheet.headerFooter.oddFooter = '&L&"Times New Roman,Bold"&9&K808080NBH: ' + SUBJECT_SIGNING_FORM.publishedOn + '-REV:' + SUBJECT_SIGNING_FORM.revision + '&R&"Times New Roman,Bold"&9&K808080' + SUBJECT_SIGNING_FORM.code;
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function createSubjectSigningWord(document) {
  const { AlignmentType, BorderStyle, Document, Footer, HeightRule, LineRuleType, PageOrientation, Packer, Paragraph,
    Tab, TabStopType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } = await import("docx");
  const L = SUBJECT_SIGNING_LAYOUT;
  const widths = SUBJECT_SIGNING_FORM.widths;
  const p = (value, { bold = false, italic = false, center = false, right = false, size = 26, keepNext = false, indent, before = 0, after = 0, runs } = {}) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : right ? AlignmentType.RIGHT : AlignmentType.LEFT, keepNext,
    indent: indent ? { left: indent } : undefined,
    spacing: { before, after, line: 260, lineRule: LineRuleType.AT_LEAST },
    children: (runs || [{ text: String(value), bold, italics: italic }]).map(run => new TextRun({ font: "Times New Roman", size, ...run })),
  });
  const border = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.SINGLE, size: 4, color: "000000" }]));
  const cell = (value, index, options = {}) => new TableCell({ width: { size: widths.slice(index, index + (options.columnSpan || 1)).reduce((a, b) => a + b, 0), type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER, ...options, children: [p(value, { center: index !== 1, size: 24, ...options })] });
  const header = () => [new TableRow({ tableHeader: true, children: [
    cell("STT", 0, { rowSpan: 2, bold: true }), cell("Họ và tên học viên", 1, { rowSpan: 2, bold: true, center: true }),
    cell("Theo dõi số tiết học của học viên", 2, { columnSpan: 12, bold: true }), cell("Số tiết vắng", 14, { columnSpan: 2, bold: true }),
    cell("Kết quả xử lý", 16, { rowSpan: 2, bold: true }),
  ] }), new TableRow({ tableHeader: true, children: [...Array.from({ length: 9 }, (_, i) => cell("", i + 2)),
    ...["Điểm KT", "Điểm ThL/TH", "Điểm TL/BTL", "Có lý do", "Không lý do"].map((value, i) => cell(value, 11 + i, { bold: true })),
  ] })];
  const table = rows => new Table({ width: { size: L.width, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    borders: border, margins: { top: 0, bottom: 0, left: 30, right: 30 }, rows: [...header(),
      ...rows.map(row => new TableRow({ cantSplit: true, height: { value: 285, rule: HeightRule.ATLEAST }, children: row.map((value, i) => cell(value, i)) })),
      ...["Có mặt/Tổng số", "Cán bộ phụ trách"].map(label => new TableRow({ cantSplit: true, height: { value: 520, rule: HeightRule.ATLEAST },
        children: [cell(label, 0, { columnSpan: 2, center: false }), ...Array.from({ length: 15 }, (_, i) => cell("", i + 2))] })),
    ],
  });
  const footer = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: L.width - 840 }],
    indent: { left: 520, right: 320 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "808080", space: 2 } },
    children: [new TextRun({ text: `NBH: ${SUBJECT_SIGNING_FORM.publishedOn}-REV:${SUBJECT_SIGNING_FORM.revision}`, font: "Times New Roman", size: 18, color: "808080", bold: true }),
      new TextRun({ children: [new Tab()] }), new TextRun({ text: SUBJECT_SIGNING_FORM.code, font: "Times New Roman", size: 18, color: "808080", bold: true })],
  })] });
  const signatures = () => new Table({ width: { size: L.width, type: WidthType.DXA }, columnWidths: [5103, 5103, 5103],
    borders: Object.fromEntries(Object.keys(border).map(side => [side, { style: BorderStyle.NIL }])),
    rows: [new TableRow({ cantSplit: true, children: SUBJECT_SIGNING_FORM.signatures.map(role => new TableCell({
      children: [p(role, { center: true, size: 26, keepNext: true }), p("(Ký và ghi rõ họ tên)", { center: true, italic: true, size: 26 }), p(" ")],
    })) })],
  });
  const signingDate = () => new Table({ width: { size: L.width, type: WidthType.DXA }, columnWidths: [5103, 5103, 5103],
    borders: Object.fromEntries(Object.keys(border).map(side => [side, { style: BorderStyle.NIL }])),
    rows: [new TableRow({ cantSplit: true, children: ["", "", subjectSigningDate].map(value => new TableCell({ children: [p(value, { center: true, size: 26, italic: true, keepNext: true, before: 120, after: 100 })] })) })],
  });
  const noBorder = Object.fromEntries(Object.keys(border).map(side => [side, { style: BorderStyle.NIL }]));
  const metadataWidth = L.width - L.inset - 320;
  const metadata = signingMetadataFields(document).map((fields, row) => {
    const columnWidths = L.metadataWidths[row].map(percent => Math.round(percent * metadataWidth / 100));
    return new Table({ width: { size: metadataWidth, type: WidthType.DXA }, columnWidths, layout: TableLayoutType.FIXED,
      indent: { size: L.inset, type: WidthType.DXA }, margins: { top: 0, bottom: 0, left: 0, right: 45 }, borders: noBorder,
      rows: [new TableRow({ cantSplit: true, children: fields.map(([label, value], column) => new TableCell({
        width: { size: columnWidths[column], type: WidthType.DXA }, children: [p("", { keepNext: true, runs: [
          { text: `${label}: `, bold: true }, { text: value, bold: label === "Địa điểm" },
        ] })],
      })) })],
    });
  });
  const notes = [p("", { indent: 700, before: 120, keepNext: true, runs: [
    { text: "Ghi chú: ", bold: true }, { text: "Phần theo dõi số tiết của học viên", bold: true, italics: true },
    { text: SUBJECT_SIGNING_FORM.notes[0].slice("Ghi chú: Phần theo dõi số tiết của học viên".length), italics: true },
  ] }), p(SUBJECT_SIGNING_FORM.notes[1], { indent: 700, italic: true, keepNext: true })];
  return Packer.toBlob(new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: 26 } } } },
    sections: [{ properties: {
      page: { size: { width: 11907, height: 16840, orientation: PageOrientation.LANDSCAPE }, margin: { top: L.top, bottom: L.bottom, left: L.left, right: L.right, footer: 820 } },
    }, footers: { default: footer }, children: [p(document.university, { indent: 560, size: 28, keepNext: true }), p(document.institute, { bold: true, indent: 1060, size: 28, keepNext: true }),
      p(document.title, { bold: true, center: true, keepNext: true, before: 200, after: 180, size: 28 }), ...metadata,
      table(document.rows), ...notes, signingDate(), signatures()],
    }],
  }));
}
