import { TRANSCRIPT_COLUMN_WIDTHS, TRANSCRIPT_HEADERS, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues } from "./learnerTranscript";
import { TRANSCRIPT_PAGE, TRANSCRIPT_TABLE_WIDTH, LEARNER_TRANSCRIPT_LAYOUT as L, transcriptReferenceLineCount } from "./transcriptForm";

// Word tab distances in points from each existing metadata cell's text origin.
// These preserve the two-column table and align values with the form's spacing.
// A null stop retains the diploma number's existing inline relationship.
const METADATA_VALUE_TABS = Object.freeze([
  Object.freeze([56.17, 56.17, 123.01, 84.85, 93.85, null]),
  Object.freeze([52.09, 84.73, 103.45, 94.45, 94.45, 94.45]),
]);

export async function createLearnerTranscriptWord(transcript) {
  const { AlignmentType, BorderStyle, Document, Footer, HeightRule, LeaderType, LineRuleType, Packer, Paragraph,
    Tab, TabStopType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } = await import("docx");
  const width = TRANSCRIPT_TABLE_WIDTH, dxa = pt => Math.round(pt * 20);
  const details = transcriptDocumentDetails(transcript);
  const noBorders = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"]
    .map(side => [side, { style: BorderStyle.NIL }]));
  const borders = Object.fromEntries(Object.keys(noBorders).map(side => [side, { style: BorderStyle.SINGLE, size: 6, color: "000000" }]));
  const zeroMargins = { top: 0, bottom: 0, left: 0, right: 0 };
  const run = (text, options = {}) => new TextRun({ text: String(text), font: "Times New Roman", size: 24, ...options });
  const paragraph = (text, { bold = false, center = false, right = false, italic = false, size = L.bodyFont,
    before = 0, after = 0, keepNext = false, line = L.bodyLine, natural = false, indent = 0, rightIndent = 0, color = "000000" } = {}) => new Paragraph({
    alignment: center ? AlignmentType.CENTER : right ? AlignmentType.RIGHT : AlignmentType.LEFT,
    indent: { left: dxa(indent), right: dxa(rightIndent) }, widowControl: false,
    spacing: { before: dxa(before), after: dxa(after), line: dxa(line), lineRule: natural ? LineRuleType.AT_LEAST : LineRuleType.EXACT }, keepNext,
    children: [run(text, { bold, italics: italic, size: size * 2, color })],
  });
  const blank = (height, keepNext = true) => new Paragraph({
    run: { font: "Times New Roman", size: 2 }, keepNext, widowControl: false,
    spacing: { before: 0, after: 0, line: dxa(height), lineRule: LineRuleType.EXACT },
  });
  const number = new Paragraph({
    run: { font: "Times New Roman", size: 24 }, keepNext: true,
    indent: { left: 81 }, spacing: { before: 75, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.EXACT },
    tabStops: [{ type: TabStopType.LEFT, position: 1123, leader: LeaderType.NONE },
      { type: TabStopType.LEFT, position: 2907, leader: LeaderType.DOT }],
    children: [run(`Số:${transcript.issuance.number ? ` ${transcript.issuance.number}` : ""}`),
      new TextRun({ children: [new Tab()] }), run("/Khóa"), new TextRun({ children: [new Tab()] }), run("/SĐH")],
  });
  const metadataParagraph = (field, row, column) => {
    const valueTab = METADATA_VALUE_TABS[column][row];
    const value = row === 5 && column === 0 && !transcript.training.masterDiplomaNumber ? "" : field.value;
    return new Paragraph({ widowControl: false,
      spacing: { before: 0, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.AT_LEAST },
      ...(valueTab == null ? {} : {
        tabStops: [{ type: TabStopType.LEFT, position: dxa(valueTab), leader: LeaderType.NONE }],
      }),
      children: [run(`${field.label}:${valueTab == null ? " " : ""}`, { bold: false }),
        ...(valueTab == null ? [] : [new TextRun({ children: [new Tab()] })]),
        run(value, { bold: true })],
    });
  };
  const metadata = new Table({
    alignment: AlignmentType.LEFT, indent: { size: dxa(L.metadataIndent), type: WidthType.DXA },
    width: { size: width, type: WidthType.DXA }, columnWidths: [dxa(L.metadataLeft), width - dxa(L.metadataLeft)], layout: TableLayoutType.FIXED,
    borders: noBorders, margins: zeroMargins,
    rows: transcriptMetadataRows(transcript).map((pair, index) => new TableRow({ cantSplit: true,
      height: { value: dxa(L.metadataRows[index]), rule: HeightRule.ATLEAST },
      children: pair.map((field, column) => new TableCell({
        width: { size: column ? width - dxa(L.metadataLeft) : dxa(L.metadataLeft), type: WidthType.DXA },
        margins: zeroMargins, verticalAlign: VerticalAlign.TOP,
        children: [metadataParagraph(field, index, column)],
      })),
    })),
  });
  let wrappedRows = 0;
  const subjectRow = (values, header = false) => {
    const lines = header ? 1 : Math.max(...values.map((value, column) => transcriptReferenceLineCount(
      value, TRANSCRIPT_COLUMN_WIDTHS[column] / 20 - L.border - (column === 1 ? 2 * L.subjectInset : 0))));
    const minimum = header ? L.headerMinimum : lines === 1 ? L.bodyMinimum
      : lines === 2 ? L.wrappedMinimum[Math.min(wrappedRows++, 1)] : lines * L.bodyMinimum;
    return new TableRow({ cantSplit: true, tableHeader: header,
    // A minimum only: wrapped 12pt paragraphs expand the row without clipping.
    height: { value: dxa(minimum), rule: HeightRule.ATLEAST },
    children: values.map((input, column) => new TableCell({
      width: { size: TRANSCRIPT_COLUMN_WIDTHS[column], type: WidthType.DXA },
      margins: zeroMargins, verticalAlign: VerticalAlign.TOP,
      children: [paragraph(input, { bold: header, center: header || column !== 1,
        natural: true, line: header ? 17.25 : L.bodyLine, indent: !header && column === 1 ? L.subjectInset : 0,
        rightIndent: !header && column === 1 ? L.subjectInset : 0 })],
    })),
    });
  };
  const subjects = new Table({ alignment: AlignmentType.LEFT,
    width: { size: width, type: WidthType.DXA }, columnWidths: TRANSCRIPT_COLUMN_WIDTHS,
    indent: { size: 70, type: WidthType.DXA }, layout: TableLayoutType.FIXED, borders, margins: zeroMargins,
    rows: [subjectRow(TRANSCRIPT_HEADERS, true), ...transcript.subjects.map(subject => subjectRow(transcriptSubjectValues(subject)))],
  });
  const band = new Table({ alignment: AlignmentType.LEFT,
    width: { size: width, type: WidthType.DXA }, columnWidths: [width - dxa(L.signatureRight), dxa(L.signatureRight)],
    layout: TableLayoutType.FIXED, borders: noBorders, margins: zeroMargins,
    rows: [new TableRow({ cantSplit: true, children: [
      new TableCell({ width: { size: width - dxa(L.signatureRight), type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({ keepNext: true, widowControl: false,
          spacing: { before: 0, after: 0, line: dxa(L.bodyLine), lineRule: LineRuleType.EXACT },
          children: [run(`${details.gpa.label}: `, { bold: false }), run(details.gpa.value, { bold: true })] })] }),
      new TableCell({ width: { size: dxa(L.signatureRight), type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
        children: [paragraph(details.issueDate, { right: true, italic: true, before: L.dateOffset, keepNext: true })] }),
    ] })],
  });
  const signatureWidths = [dxa(L.signatureLeft), width - dxa(L.signatureLeft + L.signatureRight), dxa(L.signatureRight)];
  const signatures = new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: signatureWidths,
    layout: TableLayoutType.FIXED, borders: noBorders, margins: zeroMargins,
    rows: [new TableRow({ cantSplit: true, children: signatureWidths.map((cellWidth, column) => {
      const signature = column === 0 ? details.signatures[0] : column === 2 ? details.signatures[1] : null;
      return new TableCell({ width: { size: cellWidth, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
        children: signature ? [
          paragraph(signature.roles[0] || "", { bold: true, center: true, keepNext: true, line: 16.56 }),
          paragraph(signature.roles[1] || "", { bold: true, center: true, keepNext: true, line: 13.26 }),
          blank(L.signingSpace), paragraph(signature.name || "", { bold: true, center: true }),
        ] : [blank(1)] });
    }) })],
  });
  // A real footer paragraph with a dedicated separator and right-aligned tab.
  // It stays anchored to the page, independently of body/table length.
  const footer = new Footer({ children: [new Paragraph({
    indent: { left: 50, right: 77 }, run: { font: "Times New Roman", size: 19 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 0 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 10416 }],
    spacing: { before: 0, after: 0, line: dxa(L.footerLine), lineRule: LineRuleType.EXACT },
    children: [run(details.footer[0], { size: 19, bold: true, color: L.footerColor }),
      new TextRun({ children: [new Tab()] }), run(details.footer[1], { size: 19, bold: true, color: L.footerColor })],
  })] });
  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24, color: "000000" },
      paragraph: { spacing: { before: 0, after: 0 }, widowControl: false } } } },
    sections: [{ properties: { page: { size: { width: TRANSCRIPT_PAGE.width, height: TRANSCRIPT_PAGE.height },
      margin: { top: TRANSCRIPT_PAGE.top, bottom: TRANSCRIPT_PAGE.bottom, left: TRANSCRIPT_PAGE.left,
        right: TRANSCRIPT_PAGE.right, header: 0, footer: TRANSCRIPT_PAGE.footer } } }, footers: { default: footer },
      children: [number, blank(L.numberTitleGap), paragraph(transcript.title, { bold: true, center: true, size: L.titleFont,
        line: L.titleLine, keepNext: true }), blank(L.titleMetadataGap), metadata, blank(L.metadataTableGap),
        subjects, blank(L.gpaGap), band, blank(L.signatureGap), signatures],
    }],
  });
  return Packer.toBlob(doc);
}
