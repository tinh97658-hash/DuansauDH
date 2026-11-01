import { BRAND } from "../config/branding";
import { formatDate, formatDateTime } from "./dateFormat";
import { downloadDocumentFile, sanitizeDocumentFilenamePart } from "./documentFiles";
import { DOCUMENT_INSTITUTION, DOCUMENT_NATIONAL_HEADING, documentDateLine, addExcelDocumentHeading } from "./documentHeading";
import { openReportPreview } from "./reportPreview";
import { isReportSerialColumn, reportColumnWidths, reportSerialWidth, reportCompactColumn, reportCompactWidth } from "./reportTableLayout";

export function reportText(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (Array.isArray(value)) return value.map(reportText).filter(value => value !== "").join("; ");
  if (typeof value === "object") {
    if (value.props) return reportText(value.props.label ?? value.props.children ?? value.props.value ?? "");
    return reportText(value.name ?? value.label ?? value.code ?? "");
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDate(text);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return formatDateTime(text);
  return text;
}

export function tableReport(title, columns, rows, valueOf = (row, column) => row[column.key], metadata = []) {
  const fields = columns.filter(column => !["actions", "select", "selectTuition"].includes(column.key));
  return { title, metadata, sections: [{ title, headers: fields.map(column => column.label),
    rows: rows.map((row, index) => fields.map(column => reportText(column.key === "index" ? index + 1 : valueOf(row, column, index)))) }] };
}

export function normalizeReport(input, now = new Date()) {
  if (!input?.title) throw new Error("Chưa có thông tin để xuất file.");
  const sections = (input.sections || []).filter(section => section.headers?.length && section.rows?.length).map(section => ({
    title: String(section.title || input.title), headers: section.headers.map(reportText),
    rows: section.rows.map(row => section.headers.map((_, index) => reportText(row[index]))),
  }));
  if (!sections.length) throw new Error("Không có dữ liệu phù hợp để xuất file.");
  return { ...input, title: String(input.title), generatedAt: formatDateTime(now), sections,
    metadata: (input.metadata || []).map(pair => pair.map(reportText)),
    filename: sanitizeDocumentFilenamePart(input.filename || input.title) || "Bao-cao" };
}

export async function collectReportPages(load, rowsOf = data => data.rows || data.data || [], totalOf = data => data.total ?? data.pagination?.total) {
  const rows = [];
  let expectedTotal;
  for (let page = 1; ; page++) {
    const data = await load(page);
    const batch = rowsOf(data);
    if (!Array.isArray(batch)) throw new Error("Không đọc được dữ liệu xuất file.");
    rows.push(...batch);
    const total = totalOf(data);
    if (page === 1) expectedTotal = total;
    else if (total !== expectedTotal) throw new Error("Dữ liệu danh sách đã thay đổi. Vui lòng tải lại trước khi xuất.");
    if (total == null || rows.length >= total) break;
    if (!batch.length) throw new Error("Dữ liệu danh sách đã thay đổi. Vui lòng tải lại trước khi xuất.");
  }
  return rows;
}

export async function createReportExcel(report) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  book.creator = BRAND.institute;
  for (const [index, section] of report.sections.entries()) {
    const name = (section.title.replace(/[\\/*?:[\]]/g, " ").slice(0, 25) || "Dữ liệu") + (index ? ` ${index + 1}` : "");
    const sheet = book.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: reportOrientation(report), fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const width = section.headers.length;
    sheet.columns = section.headers.map((header, column) => ({ width: Math.min(45, Math.max(12, String(header).length + 3,
      ...section.rows.slice(0, 100).map(row => Math.min(40, String(row[column] ?? "").length)))) }));
    addExcelDocumentHeading(sheet, width, documentDateLine(report));
    section.headers.forEach((label, index) => {
      if (!reportCompactColumn(label)) return;
      const serialColumn = sheet.getColumn(index + 1);
      const compactWidth = isReportSerialColumn(label) ? Math.max(6, String(section.rows.length).length + 3) : Math.max(6, reportCompactWidth(section, index) / 5);
      const spare = Math.max(0, serialColumn.width - compactWidth);
      const others = section.headers.map((header, column) => !reportCompactColumn(header) ? column + 1 : null).filter(Boolean);
      serialColumn.width = compactWidth;
      others.forEach(column => { sheet.getColumn(column).width += spare / others.length; });
    });
    for (const line of [report.title, ...report.metadata.map(([label, value]) => `${label}: ${value}`), `Ngày xuất: ${report.generatedAt}`, section.title]) {
      const row = sheet.addRow([line]);
      if (width > 1) sheet.mergeCells(row.number, 1, row.number, width);
      row.font = { name: "Times New Roman", size: 11, bold: row.number <= 3 };
      row.alignment = { wrapText: true, vertical: "middle" };
    }
    const header = sheet.addRow(section.headers);
    header.height = 32;
    header.eachCell(cell => {
      cell.font = { name: "Times New Roman", size: 11, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE7F1" } };
      cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    });
    for (const values of section.rows) {
      const row = sheet.addRow(values);
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = { name: "Times New Roman", size: 11 };
        cell.alignment = reportCompactColumn(section.headers[column - 1]) ? { horizontal: "center", vertical: "middle", wrapText: !isReportSerialColumn(section.headers[column - 1]) } : { vertical: "top", wrapText: true };
        cell.border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FFB4C0CB" } }]));
      });
    }
    sheet.views = [{ state: "frozen", ySplit: header.number }];
    sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: width } };
    sheet.pageSetup.printTitlesRow = `${header.number}:${header.number}`;
    sheet.headerFooter.oddFooter = "&L" + BRAND.institute + "&RTrang &P / &N";
  }
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function createReportWord(report) {
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, PageOrientation, TableLayoutType, VerticalAlign } = await import("docx");
  const paragraph = (text, bold = false, center = false) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 120 },
    children: [new TextRun({ text: String(text), bold })],
  });
  const sections = reportPrintSections(report);
  const landscape = reportOrientation(report) === "landscape";
  const width = landscape ? 15398 : 10466;
  const headingLine = (text, underline = false, italic = false) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 },
    children: [new TextRun({ text, bold: !italic, italics: italic, size: 20, underline: underline ? { type: "single" } : undefined })] });
  const masthead = new Table({ width: { size: width, type: WidthType.DXA },
    columnWidths: [Math.floor(width / 2), Math.ceil(width / 2)],
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.NIL }])),
    rows: [new TableRow({ cantSplit: true, children: [
      new TableCell({ children: DOCUMENT_INSTITUTION.map((line, index) => headingLine(line, index === 1)) }),
      new TableCell({ children: [...DOCUMENT_NATIONAL_HEADING.map((line, index) => headingLine(line, index === 1)), headingLine(documentDateLine(report), false, true)] }),
    ] })] });
  const content = [masthead, paragraph(report.title.toUpperCase(), true, true), ...report.metadata.map(([label, value]) => paragraph(`${label}: ${value}`)), paragraph(`Ngày xuất: ${report.generatedAt}`)];
  for (const section of sections) {
    content.push(paragraph(section.title, true));
    const columnWidths = reportColumnWidths(section, width, reportSerialWidth(section) * 20);
    const cell = (value, column, header = false) => new TableCell({
      width: { size: columnWidths[column], type: WidthType.DXA },
      verticalAlign: reportCompactColumn(section.headers[column]) ? VerticalAlign.CENTER : undefined,
      margins: reportCompactColumn(section.headers[column]) ? { left: 57, right: 57 } : undefined,
      shading: header ? { fill: "DCE7F1" } : undefined, children: [paragraph(value, header, reportCompactColumn(section.headers[column]))],
    });
    content.push(new Table({ width: { size: width, type: WidthType.DXA }, layout: TableLayoutType.FIXED,
      columnWidths,
      borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.SINGLE, size: 4, color: "B4C0CB" }])),
      rows: [new TableRow({ tableHeader: true, children: section.headers.map((value, column) => cell(value, column, true)) }),
        ...section.rows.map(row => new TableRow({ children: row.map((value, column) => cell(value, column)) }))],
    }));
  }
  const doc = new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: 21 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: content }] });
  return Packer.toBlob(doc);
}

let pdfRenderer;
async function reportPdfRenderer() {
  if (!pdfRenderer) pdfRenderer = (async () => {
    const { default: pdfMake } = await import("pdfmake/build/pdfmake.js");
    const faces = { normal: "Regular", bold: "Bold", italics: "Italic", bolditalics: "BoldItalic" };
    const entries = await Promise.all(Object.values(faces).map(async face => {
      const name = `LiberationSerif-${face}.ttf`;
      const response = await fetch(`${process.env.PUBLIC_URL || ""}/fonts/transcript/${name}`);
      if (!response.ok) throw new Error("Không tải được font tiếng Việt để xuất PDF. Vui lòng thử lại.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return [name, btoa(binary)];
    }));
    pdfMake.addVirtualFileSystem(Object.fromEntries(entries));
    pdfMake.addFonts({ ReportSerif: Object.fromEntries(Object.entries(faces).map(([key, face]) => [key, `LiberationSerif-${face}.ttf`])) });
    return pdfMake;
  })().catch(error => { pdfRenderer = null; throw error; });
  return pdfRenderer;
}

export function reportPdfDefinition(report) {
  const sections = reportPrintSections(report);
  return { pageSize: "A4", pageOrientation: reportOrientation(report),
    pageMargins: [28, 28, 28, 36], defaultStyle: { font: "ReportSerif", fontSize: 10 },
    content: [
      { columns: [
        { width: "*", stack: DOCUMENT_INSTITUTION.map((text, index) => ({ text, bold: true, alignment: "center", decoration: index === 1 ? "underline" : undefined })) },
        { width: "*", stack: [...DOCUMENT_NATIONAL_HEADING.map((text, index) => ({ text, bold: true, alignment: "center", decoration: index === 1 ? "underline" : undefined })),
          { text: documentDateLine(report), italics: true, alignment: "center", margin: [0, 4, 0, 0] }] },
      ], columnGap: 16, margin: [0, 0, 0, 12], unbreakable: true },
      { text: report.title.toUpperCase(), bold: true, fontSize: 15, alignment: "center", margin: [0, 0, 0, 12] },
      ...report.metadata.map(([label, value]) => ({ text: `${label}: ${value}`, margin: [0, 0, 0, 4] })),
      { text: `Ngày xuất: ${report.generatedAt}`, margin: [0, 0, 0, 8] },
      ...sections.flatMap(section => [{ text: section.title, bold: true, margin: [0, 8, 0, 6] },
        { table: { headerRows: 1, widths: section.headers.map((header, index) => reportCompactColumn(header) ? reportCompactWidth(section, index) : "*"), body: [section.headers.map(text => ({ text: String(text), bold: true, fillColor: "#DCE7F1", alignment: reportCompactColumn(text) ? "center" : "left" })),
          ...section.rows.map(row => row.map((text, column) => ({ text: String(text), alignment: reportCompactColumn(section.headers[column]) ? "center" : "left" }))) ] }, layout: { hLineColor: () => "#B4C0CB", vLineColor: () => "#B4C0CB", hLineWidth: () => .5, vLineWidth: () => .5,
            paddingLeft: index => reportCompactColumn(section.headers[index]) ? 2.83 : 4, paddingRight: index => reportCompactColumn(section.headers[index]) ? 2.83 : 4 } }]),
    ], footer: (page, count) => ({ text: `Trang ${page} / ${count}`, alignment: "right", margin: [28, 8, 28, 0], fontSize: 9 }) };
}

export function reportOrientation(report) {
  return report.pageOrientation === "landscape" || report.sections.some(section => section.headers.length > 6) ? "landscape" : "portrait";
}

export function reportPrintSections(report) {
  const admissionHeaders = new Set(["STT", "Mã HV", "Mã học viên", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Email", "Số CMND/CCCD", "Ngành", "Điện thoại"]);
  const sections = report.title === "Hồ sơ tuyển sinh" ? report.sections.map(section => {
    const indices = section.headers.map((header, index) => admissionHeaders.has(String(header).trim()) ? index : -1).filter(index => index >= 0);
    return { ...section, headers: indices.map(index => section.headers[index]), rows: section.rows.map(row => indices.map(index => row[index])) };
  }) : report.sections;
  return sections.flatMap(section => {
    if (section.headers.length <= 12) return [section];
    const identity = section.headers.map((label, index) => ({ label, index })).filter(({ label }) =>
      /^(STT|Mã HV|Mã học viên|Họ đệm|Tên|Họ tên|Ngày sinh|Giới tính)$/i.test(label)).slice(0, 6).map(({ index }) => index);
    const repeated = identity.length ? identity : [0, 1];
    const rest = section.headers.map((_, index) => index).filter(index => !repeated.includes(index));
    const chunk = 12 - repeated.length;
    return Array.from({ length: Math.ceil(rest.length / chunk) }, (_, part) => {
      const indices = [...repeated, ...rest.slice(part * chunk, (part + 1) * chunk)];
      return { title: `${section.title} (Phần ${part + 1}/${Math.ceil(rest.length / chunk)})`,
        headers: indices.map(index => section.headers[index]), rows: section.rows.map(row => indices.map(index => row[index])) };
    });
  });
}

export async function downloadReport(input, format, { reservedTab } = {}) {
  if (!["word", "excel", "pdf"].includes(format)) throw new Error("Định dạng xuất file không hợp lệ.");
  const report = normalizeReport(input);
  if (format === "pdf") return openReportPreview(report, reservedTab);
  const blob = format === "word" ? await createReportWord(report) : await createReportExcel(report);
  downloadDocumentFile(blob, `${report.filename}.${{ word: "docx", excel: "xlsx", pdf: "pdf" }[format]}`);
}

export async function createReportPdf(report) {
  return (await reportPdfRenderer()).createPdf(reportPdfDefinition(report)).getBlob();
}
