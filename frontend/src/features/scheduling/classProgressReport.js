import { TRANSCRIPT_FORM, TRANSCRIPT_PAGE, LEARNER_TRANSCRIPT_LAYOUT } from "../learners/transcriptForm";
import { documentDateLine } from "../../utils/documentHeading";
import { createExcelForm, excelRowHeight } from "../../utils/documentLayout";

export const PROGRESS_FORM_WIDTHS = [540, 4100, 1100, 1000, 1850, 1756];
export const PROGRESS_FORM_HEADERS = ["STT", "Học Phần", "Mã số", "Số tín chỉ", "Tiến độ", "Ghi chú"];
const labels = { completed: "Hoàn thành", in_progress: "Đang học", scheduled: "Đã xếp lịch", not_started: "Chưa tổ chức" };
const show = value => value == null || value === "" ? "—" : String(value);

export function buildClassProgressReport({ classes, visibleSubjects, catalogGroups = [], major, discipline }) {
  const sections = classes.map(group => {
    const catalog = catalogGroups.find(item => item.id === group.id);
    const curriculum = catalog?.curriculum || group.curriculum;
    const subjects = visibleSubjects.map(row => ({ row, subject: row.byClass[group.id] }))
      .filter(({ subject }) => subject?.curriculumSubjectId);
    const rows = subjects.map(({ row, subject }, index) => [index + 1, row.name || "", row.code || "", row.credits ?? "",
      subject.status === "completed" && subject.completion
        ? `Hoàn thành ${subject.completion.passedCount}/${subject.completion.totalCount}` : labels[subject.status] || "Chưa tổ chức",
      [subject.needsGradeEntry ? "Cần nhập đủ điểm" : "",
        subject.activeRetakeCount > 0 ? `Đang học lại: ${subject.activeRetakeCount}` : "",
        subject.waitingRetakeCount > 0 ? `Chờ bố trí học lại: ${subject.waitingRetakeCount}` : ""].filter(Boolean).join("; "),
    ]);
    const completed = subjects.filter(({ subject }) => subject.status === "completed").length;
    return { title: show(group.code), academicYear: show(group.academicYear), headers: PROGRESS_FORM_HEADERS, rows,
      metadata: [["Lớp", show(group.code)], ["Khóa", show(group.academicYear)],
        ["Ngành", show(discipline?.name)], ["Chuyên ngành", show(major?.name)],
        ["Chương trình đào tạo", show(curriculum?.name || curriculum?.code)], ["Mã CTĐT", show(curriculum?.code)],
        ["Sĩ số", show(group.memberCount ?? catalog?.memberCount)], ["Trình độ đào tạo", "Thạc sĩ"],
        ["Học phần hiển thị", rows.length], ["Tín chỉ hiển thị", subjects.every(({ row }) => typeof row.credits === "number")
          ? subjects.reduce((sum, { row }) => sum + row.credits, 0) : "—"]],
      summary: `Số học phần hoàn thành: ${completed}/${rows.length}`,
    };
  }).filter(section => section.rows.length);
  return { title: "THEO DÕI TIẾN ĐỘ HỌC TẬP", template: "class-progress", pageOrientation: "portrait",
    filename: "Theo-doi-tien-do", metadata: [["Phạm vi", `${sections.length} lớp phù hợp bộ lọc`]], sections };
}

export const progressNumberLine = section => `Số:${"\u00a0".repeat(12)}/Khóa ${section.academicYear}/SĐH`;
export const progressMetadataRows = section => {
  const fields = section.metadata.filter(([label]) => label !== "Trạng thái lọc" && label !== "Tìm kiếm");
  return Array.from({ length: Math.ceil(fields.length / 2) }, (_, index) => fields.slice(index * 2, index * 2 + 2));
};
export const progressDateLine = report => documentDateLine(report);

export function classProgressPdfDefinition(report) {
  const P = TRANSCRIPT_PAGE, L = LEARNER_TRANSCRIPT_LAYOUT;
  const pageWidth = P.width / 20 - P.left / 20 - P.right / 20;
  const metadataWidth = L.metadataLeft;
  return {
    pageSize: { width: P.width / 20, height: P.height / 20 },
    pageMargins: [P.left / 20, P.top / 20, P.right / 20, P.bottom / 20],
    defaultStyle: { font: "ReportSerif", fontSize: L.bodyFont, italics: false },
    content: report.sections.flatMap((section, index) => [
      { text: progressNumberLine(section), pageBreak: index ? "before" : undefined, margin: [0, L.topBlank, 0, L.numberTitleGap] },
      { text: report.title, bold: true, fontSize: L.titleFont, alignment: "center", margin: [0, 0, 0, L.titleMetadataGap] },
      ...progressMetadataRows(section).map(pair => ({ columns: pair.map(([label, value], column) => ({
        width: column ? pageWidth - metadataWidth : metadataWidth,
        text: [{ text: `${label}: ` }, { text: String(value), bold: true }],
      })), margin: [0, 0, 0, 2] })),
      { margin: [0, L.metadataTableGap, 0, L.gpaGap], table: {
        headerRows: 1, dontBreakRows: true,
        // pdfmake widths exclude cell padding and borders.
        widths: PROGRESS_FORM_WIDTHS.map(width => width / 20 - 3.75),
        body: [section.headers, ...section.rows].map((row, rowIndex) => row.map((value, column) => ({
          text: String(value), bold: rowIndex === 0, alignment: rowIndex === 0 || column !== 1 ? "center" : "left",
        }))),
      }, layout: { hLineWidth: () => .75, vLineWidth: () => .75, hLineColor: () => "#000000", vLineColor: () => "#000000",
        paddingLeft: () => 1.5, paddingRight: () => 1.5, paddingTop: () => 0, paddingBottom: () => 0 } },
      { unbreakable: true, stack: [
        { text: section.summary },
        { columns: [{ text: "", width: "*" }, { text: progressDateLine(report), alignment: "center", width: "*" }], margin: [0, 0, 0, L.signatureGap] },
        { columns: TRANSCRIPT_FORM.signatureRoles.map(roles => ({ width: "*", text: roles.join("\n"), bold: true, alignment: "center" })), margin: [0, 0, 0, L.signingSpace] },
      ] },
    ]),
  };
}

// Keep the page geometry, font, black table and sign-off of the individual form.
// Only the fields and column widths change to represent a class's progress.
export async function createClassProgressWord(report) {
  const { AlignmentType, BorderStyle, Document, HeightRule, LineRuleType, Packer, Paragraph, Table, TableCell,
    TableLayoutType, TableRow, TextRun, WidthType, SectionType } = await import("docx");
  const L = LEARNER_TRANSCRIPT_LAYOUT, P = TRANSCRIPT_PAGE;
  const width = PROGRESS_FORM_WIDTHS.reduce((sum, value) => sum + value, 0);
  const dxa = pt => Math.round(pt * 20);
  const run = (value, options = {}) => new TextRun({ text: String(value), font: "Times New Roman", size: 24, ...options });
  const paragraph = (value, options = {}) => new Paragraph({ spacing: { before: 0, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.AT_LEAST }, ...options, children: options.children || [run(value)] });
  const blank = height => paragraph("", { spacing: { before: 0, after: 0, line: dxa(height), lineRule: LineRuleType.EXACT }, keepNext: true });
  const borders = type => Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(side => [side,
    { style: type ? BorderStyle.SINGLE : BorderStyle.NIL, size: 6, color: "000000" }]));
  const metadata = section => new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [dxa(L.metadataLeft), width - dxa(L.metadataLeft)],
    layout: TableLayoutType.FIXED, borders: borders(false), margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: progressMetadataRows(section).map(pair => new TableRow({ cantSplit: true, children: pair.map(([label, value]) => new TableCell({
      children: [new Paragraph({ spacing: { before: 0, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.AT_LEAST },
        children: [run(`${label}: `), run(value, { bold: true })] })],
    })) })),
  });
  const table = section => new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: PROGRESS_FORM_WIDTHS,
    layout: TableLayoutType.FIXED, borders: borders(true), margins: { top: 0, bottom: 0, left: 25, right: 25 },
    rows: [section.headers, ...section.rows].map((row, index) => new TableRow({ cantSplit: true, tableHeader: index === 0,
      height: { value: dxa(index ? L.bodyMinimum : L.headerMinimum), rule: HeightRule.ATLEAST },
      children: row.map((value, column) => new TableCell({ width: { size: PROGRESS_FORM_WIDTHS[column], type: WidthType.DXA },
        children: [new Paragraph({ alignment: !index || column !== 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 0, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.AT_LEAST }, children: [run(value, { bold: index === 0 })] })],
      })),
    })),
  });
  const signoff = section => [
    new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: [Math.floor(width / 2), Math.ceil(width / 2)],
      layout: TableLayoutType.FIXED, borders: borders(false), rows: [
        new TableRow({ cantSplit: true, children: [new TableCell({ children: [paragraph(section.summary, { keepNext: true })] }),
          new TableCell({ children: [paragraph(progressDateLine(report), { alignment: AlignmentType.CENTER, keepNext: true })] })] }),
        new TableRow({ cantSplit: true, children: [0, 1].map(index => new TableCell({ children: [
          ...TRANSCRIPT_FORM.signatureRoles[index].map(role => new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true,
            children: [run(role, { bold: true })], spacing: { before: 0, after: 0, line: dxa(L.bodyLine) } })), blank(L.signingSpace),
        ],
      })) })],
    }),
  ];
  return Packer.toBlob(new Document({ styles: { default: { document: { run: { font: "Times New Roman", size: 24, color: "000000" } } } },
    sections: report.sections.map(section => ({ properties: { type: SectionType.NEXT_PAGE, page: {
      size: { width: P.width, height: P.height }, margin: { top: P.top, bottom: P.bottom, left: P.left, right: P.right },
    } }, children: [blank(L.topBlank), paragraph(progressNumberLine(section), { keepNext: true }), blank(L.numberTitleGap),
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [run(report.title, { bold: true, size: L.titleFont * 2 })] }),
      blank(L.titleMetadataGap), metadata(section), blank(L.metadataTableGap), table(section), blank(L.gpaGap), ...signoff(section)],
    })),
  }));
}

export async function createClassProgressExcel(report) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const L = LEARNER_TRANSCRIPT_LAYOUT, P = TRANSCRIPT_PAGE;
  report.sections.forEach((section, index) => {
    const widths = PROGRESS_FORM_WIDTHS.map(value => value / 20), width = widths.reduce((sum, value) => sum + value, 0);
    const { sheet, edges, put, finish } = createExcelForm(book, `Tiến độ ${index + 1}`, { widths, stops: [L.metadataLeft, width / 2],
      margins: { left: P.left / 1440, right: P.right / 1440, top: P.top / 1440, bottom: P.bottom / 1440, header: 0, footer: 0 } });
    put(1, 0, width, progressNumberLine(section), { height: L.numberRow + L.topBlank });
    sheet.getRow(2).height = L.numberTitleGap;
    put(3, 0, width, report.title, { bold: true, size: L.titleFont, horizontal: "center", height: L.titleRow });
    sheet.getRow(4).height = L.titleMetadataGap;
    let nextRow = 5;
    progressMetadataRows(section).forEach(pair => {
      pair.forEach(([label, value], col) => {
        put(nextRow, col ? L.metadataLeft : 0, col ? width : L.metadataLeft,
          { richText: [{ text: `${label}: ` }, { text: String(value), font: { bold: true } }] }, { height: L.metadataRows[0] });
      });
      nextRow++;
    });
    sheet.getRow(nextRow++).height = L.metadataTableGap;
    const headerRow = nextRow;
    const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
    [section.headers, ...section.rows].forEach((values, index) => {
      const height = excelRowHeight(values, widths, L.bodyFont, 2.88, index ? L.bodyMinimum : L.headerMinimum);
      values.forEach((value, col) => put(nextRow, edges[col], edges[col + 1], value,
        { bold: index === 0, horizontal: index === 0 || col !== 1 ? "center" : "left", height, border }));
      nextRow++;
    });
    sheet.getRow(nextRow++).height = 8 + L.gpaGap;
    put(nextRow, 0, width / 2, section.summary);
    put(nextRow++, width / 2, width, progressDateLine(report), { horizontal: "center" });
    sheet.getRow(nextRow++).height = 8;
    TRANSCRIPT_FORM.signatureRoles.forEach((roles, index) => {
      roles.forEach((role, line) => {
        put(nextRow + line, index ? width / 2 : 0, index ? width : width / 2, role, { bold: true, horizontal: "center" });
      });
    });
    sheet.getRow(nextRow + 2).height = L.signingSpace;
    finish(nextRow + 2, headerRow);
  });
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
