import { TRANSCRIPT_HEADERS, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues } from "./learnerTranscript";
import { TRANSCRIPT_COLUMN_WIDTHS, TRANSCRIPT_PAGE as P, LEARNER_TRANSCRIPT_LAYOUT as L } from "./transcriptForm";
import { createExcelForm, excelRowHeight } from "../../utils/documentLayout";

export async function createLearnerTranscriptExcel(transcript) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const widths = TRANSCRIPT_COLUMN_WIDTHS.map(value => value / 20);
  const width = widths.reduce((sum, value) => sum + value, 0);
  const right = width - L.signatureRight;
  const { sheet, edges, put, finish } = createExcelForm(book, "Kết quả học tập", { widths,
    stops: [L.metadataLeft, L.signatureLeft, right], fontSize: L.bodyFont,
    margins: { left: P.left / 1440, right: P.right / 1440, top: P.top / 1440, bottom: P.bottom / 1440, header: 0, footer: P.footer / 1440 } });
  const details = transcriptDocumentDetails(transcript);
  put(1, 0, width, details.numberLine, { height: L.numberRow });
  sheet.getRow(2).height = L.numberTitleGap;
  put(3, 0, width, transcript.title, { bold: true, size: L.titleFont, horizontal: "center", height: L.titleRow });
  sheet.getRow(4).height = L.titleMetadataGap;
  transcriptMetadataRows(transcript).forEach((pair, index) => pair.forEach((field, column) => {
    const value = index === 5 && column === 0 && !transcript.training.masterDiplomaNumber ? "" : field.value;
    put(5 + index, column ? L.metadataLeft : 0, column ? width : L.metadataLeft, { richText: [
      { text: `${field.label}: ` }, { text: value, font: { bold: true } },
    ] }, { height: L.metadataRows[index] });
  }));
  sheet.getRow(11).height = L.metadataTableGap;
  const headerRow = 12;
  const border = Object.fromEntries(["top", "bottom", "left", "right"].map(side => [side, { style: "thin", color: { argb: "FF000000" } }]));
  [TRANSCRIPT_HEADERS, ...transcript.subjects.map(transcriptSubjectValues)].forEach((values, index) => {
    const height = excelRowHeight(values, widths, L.bodyFont, 0, index ? L.bodyMinimum : L.headerMinimum);
    values.forEach((value, column) => put(headerRow + index, edges[column], edges[column + 1], value, {
      bold: index === 0, horizontal: index === 0 || column !== 1 ? "center" : "left", height, border,
    }));
  });
  let row = headerRow + transcript.subjects.length + 1;
  put(row, 0, width, { richText: [{ text: `${details.gpa.label}: ` }, { text: details.gpa.value, font: { bold: true } }] });
  put(++row, right, width, details.issueDate, { horizontal: "center", height: L.bodyLine + L.dateOffset });
  const signatureRow = ++row;
  details.signatures.forEach((signature, index) => {
    const from = index ? right : 0, to = index ? width : L.signatureLeft;
    signature.roles.forEach((role, line) => put(signatureRow + line, from, to, role, { bold: true, horizontal: "center", height: L.bodyLine }));
    put(signatureRow + 3, from, to, signature.name || "", { bold: true, horizontal: "center" });
  });
  sheet.getRow(signatureRow + 2).height = L.signingSpace;
  sheet.headerFooter.oddFooter = `&L&"Times New Roman,Bold"&${L.footerFont}&K${L.footerColor}${details.footer[0]}&R${details.footer[1]}`;
  sheet.headerFooter.evenFooter = sheet.headerFooter.oddFooter;
  finish(signatureRow + 3, headerRow);
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
