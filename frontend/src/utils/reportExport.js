import { BRAND } from "../config/branding";
import { formatDate, formatDateTime } from "./dateFormat";
import { downloadDocumentFile, sanitizeDocumentFilenamePart } from "./documentFiles";
import { DOCUMENT_INSTITUTION, DOCUMENT_NATIONAL_HEADING, documentDateLine } from "./documentHeading";
import { openReportPreview } from "./reportPreview";
import { reportColumnWidths, reportSerialWidth, reportCompactColumn, reportCompactWidth, singleTableExcelLayout } from "./reportTableLayout";
import { classProgressPdfDefinition } from "../features/scheduling/classProgressReport";
import { REPORT_LAYOUT as L, reportPageWidth, mmToPoints, pointsToTwips, excelRowHeight, sameDocumentTitle, createExcelForm } from "./documentLayout";
import { measureReportPrintLayout } from "./reportPrintLayout";

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
    ...section, title: String(section.title || input.title), headers: section.headers.map(reportText),
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

export async function createReportExcel(report, { printLayout } = {}) {
  if (report.template === "class-progress") return (await import("../features/scheduling/classProgressReport")).createClassProgressExcel(report);
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  book.creator = BRAND.institute;
  const singleTable = report.excelLayout === "single-table";
  const printSections = singleTable ? report.sections : reportPrintSections(report);
  // Keep successive tables in one document, including wide tables split by the
  // print template. Independent grids preserve each table's column proportions.
  {
    const landscape = reportOrientation(report) === "landscape";
    const measured = singleTable ? printSections.map(section => singleTableExcelLayout(section, L.table)) : printLayout || await measureReportPrintLayout(report, landscape);
    const width = singleTable ? Math.max(reportPageWidth(landscape), ...measured.map(section => section.widths.reduce((sum, value) => sum + value, 0))) : reportPageWidth(landscape);
    const layouts = printSections.map((section, index) => {
      const columns = measured?.[index]?.widths;
      const total = columns?.reduce((sum, value) => sum + value, 0);
      return total > 0 ? columns.map(value => value * width / total) : reportColumnWidths(section, width);
    });
    const stops = layouts.flatMap(widths => widths.reduce((edges, value) => [...edges, edges[edges.length - 1] + value], [0]));
    const { sheet, edges, put, finish } = createExcelForm(book, "Báo cáo", { widths: [width / 2, width / 2], stops, fontSize: L.body,
      landscape, margins: { left: L.margin / 25.4, right: L.margin / 25.4, top: L.margin / 25.4, bottom: L.margin / 25.4, header: 0, footer: 0 } });
    DOCUMENT_INSTITUTION.forEach((line, index) => put(index + 1, edges[0], width / 2, line, { bold: true, size: L.heading, horizontal: "center", underline: index === 1 }));
    DOCUMENT_NATIONAL_HEADING.forEach((line, index) => put(index + 1, width / 2, width, line, { bold: true, size: L.heading, horizontal: "center", underline: index === 1 }));
    put(3, width / 2, width, documentDateLine(report), { size: L.heading, horizontal: "center" });
    sheet.getRow(4).height = 13.5;
    put(5, 0, width, report.title.toUpperCase(), { bold: true, size: L.title, horizontal: "center", height: 35 });
    let row = 6;
    report.metadata.forEach(([label, value]) => put(row++, 0, width, { richText: [{ text: `${label}: `, font: { bold: true } }, { text: String(value) }] }));
    const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
    let firstHeader;
    printSections.forEach((section, index) => {
      if (!sameDocumentTitle(section.title, report.title)) put(row++, 0, width, section.title, { bold: true, height: 25 });
      firstHeader ??= row;
      const widths = layouts[index], columns = widths.reduce((values, value) => [...values, values[values.length - 1] + value], [0]);
      [section.headers, ...section.rows].forEach((values, rowIndex) => {
        const metric = measured?.[index];
        const height = (rowIndex === 0 ? metric?.headerHeight : metric?.rowHeights[rowIndex - 1]) || excelRowHeight(values, widths, L.table);
        values.forEach((value, column) => {
          const cell = put(row, columns[column], columns[column + 1], value, {
            size: L.table, bold: rowIndex === 0, horizontal: rowIndex === 0 ? "center" : metric?.cells[column]?.align || (reportCompactColumn(section.headers[column]) ? "center" : "left"), height, exactHeight: !!metric, border,
          });
          if (reportCompactColumn(section.headers[column]) || rowIndex === 0) cell.alignment.vertical = "middle";
          if (rowIndex > 0 && metric?.cells[column]) {
            cell.alignment.vertical = metric.cells[column].vertical === "middle" ? "middle" : "top";
            cell.alignment.wrapText = metric.cells[column].wrap;
          }
          if (rowIndex === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
          if (singleTable && rowIndex === 0) cell.alignment.wrapText = false;
        });
        row++;
      });
      if (index < printSections.length - 1) sheet.getRow(row++).height = 10.5;
    });
    finish(row - 1, printSections.length === 1 ? firstHeader : undefined);
    sheet.views = [{ state: "frozen", ySplit: firstHeader, showGridLines: false }];
    return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

export async function createReportWord(report, { printLayout } = {}) {
  if (report.template === "class-progress") return (await import("../features/scheduling/classProgressReport")).createClassProgressWord(report);
  const { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, PageOrientation, TableLayoutType, VerticalAlign, HeightRule } = await import("docx");
  const paragraph = (text, bold = false, center = false, size = L.body, after = 60) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after, line: Math.round(size * L.line * 20) },
    children: [new TextRun({ text: String(text), bold, size: size * 2 })],
  });
  const sections = reportPrintSections(report);
  const landscape = reportOrientation(report) === "landscape";
  const measured = printLayout || await measureReportPrintLayout(report, landscape);
  const width = pointsToTwips(reportPageWidth(landscape));
  const headingLine = (text, underline = false, italic = false) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 },
    children: [new TextRun({ text, bold: !italic, italics: false, size: 20, underline: underline ? { type: "single" } : undefined })] });
  const masthead = new Table({ width: { size: width, type: WidthType.DXA },
    columnWidths: [Math.floor(width / 2), Math.ceil(width / 2)],
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.NIL }])),
    rows: [new TableRow({ cantSplit: true, children: [
      new TableCell({ children: DOCUMENT_INSTITUTION.map((line, index) => headingLine(line, index === 1)) }),
      new TableCell({ children: [...DOCUMENT_NATIONAL_HEADING.map((line, index) => headingLine(line, index === 1)), headingLine(documentDateLine(report), false, true)] }),
    ] })] });
  const content = [masthead, paragraph(report.title.toUpperCase(), true, true, L.title, 180), ...report.metadata.map(([label, value]) => new Paragraph({
    spacing: { after: 60, line: 297 }, children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(String(value))],
  }))];
  for (const [sectionIndex, section] of sections.entries()) {
    if (!sameDocumentTitle(section.title, report.title)) content.push(paragraph(section.title, true));
    const metric = measured?.[sectionIndex];
    const measuredWidth = metric?.widths.reduce((sum, value) => sum + value, 0);
    const columnWidths = measuredWidth > 0 ? metric.widths.map(value => Math.round(value * width / measuredWidth)) : reportColumnWidths(section, width, reportSerialWidth(section) * 20);
    columnWidths[columnWidths.length - 1] += width - columnWidths.reduce((sum, value) => sum + value, 0);
    const cell = (value, column, header = false) => new TableCell({
      width: { size: columnWidths[column], type: WidthType.DXA },
      verticalAlign: metric?.cells[column]?.vertical === "middle" || !metric && reportCompactColumn(section.headers[column]) ? VerticalAlign.CENTER : undefined,
      margins: metric?.cells[column]?.padding ? Object.fromEntries(Object.entries(metric.cells[column].padding).map(([side, points]) => [side, pointsToTwips(points)])) : { left: 75, right: 75, top: 75, bottom: 75 },
      shading: header ? { fill: "FFFFFF" } : undefined, children: [paragraph(value, header, header || (metric ? metric.cells[column]?.align === "center" : reportCompactColumn(section.headers[column])), L.table, 0)],
    });
    content.push(new Table({ width: { size: width, type: WidthType.DXA }, layout: TableLayoutType.FIXED,
      columnWidths,
      borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side, { style: BorderStyle.SINGLE, size: 4, color: "000000" }])),
      rows: [new TableRow({ tableHeader: true, ...(metric?.headerHeight ? { height: { value: pointsToTwips(metric.headerHeight), rule: HeightRule.ATLEAST } } : {}), children: section.headers.map((value, column) => cell(value, column, true)) }),
        ...section.rows.map((row, index) => new TableRow({ cantSplit: true, ...(metric?.rowHeights[index] ? { height: { value: pointsToTwips(metric.rowHeights[index]), rule: HeightRule.ATLEAST } } : {}), children: row.map((value, column) => cell(value, column)) }))],
    }));
  }
  const margin = pointsToTwips(mmToPoints(L.margin));
  const doc = new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: L.body * 2 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children: content }] });
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
  if (report.template === "class-progress") return classProgressPdfDefinition(report);
  const sections = reportPrintSections(report);
  return { pageSize: "A4", pageOrientation: reportOrientation(report),
    pageMargins: [28, 28, 28, 36], defaultStyle: { font: "ReportSerif", fontSize: 10 },
    content: [
      { columns: [
        { width: "*", stack: DOCUMENT_INSTITUTION.map((text, index) => ({ text, bold: true, alignment: "center", decoration: index === 1 ? "underline" : undefined })) },
        { width: "*", stack: [...DOCUMENT_NATIONAL_HEADING.map((text, index) => ({ text, bold: true, alignment: "center", decoration: index === 1 ? "underline" : undefined })),
          { text: documentDateLine(report), italics: false, alignment: "center", margin: [0, 4, 0, 0] }] },
      ], columnGap: 16, margin: [0, 0, 0, 12], unbreakable: true },
      { text: report.title.toUpperCase(), bold: true, fontSize: 15, alignment: "center", margin: [0, 0, 0, 12] },
      ...report.metadata.map(([label, value]) => ({ text: `${label}: ${value}`, margin: [0, 0, 0, 4] })),
      { text: `Ngày xuất: ${report.generatedAt}`, margin: [0, 0, 0, 8] },
      ...sections.flatMap(section => [{ text: section.title, bold: true, margin: [0, 8, 0, 6] },
        { table: { headerRows: 1, widths: section.headers.map((header, index) => reportCompactColumn(header) ? reportCompactWidth(section, index) : "*"), body: [section.headers.map(text => ({ text: String(text), bold: true, fillColor: "#FFFFFF", alignment: reportCompactColumn(text) ? "center" : "left" })),
          ...section.rows.map(row => row.map((text, column) => ({ text: String(text), alignment: reportCompactColumn(section.headers[column]) ? "center" : "left" }))) ] }, layout: { hLineColor: () => "#000000", vLineColor: () => "#000000", hLineWidth: () => .5, vLineWidth: () => .5,
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
