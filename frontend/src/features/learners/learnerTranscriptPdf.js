import { TRANSCRIPT_HEADERS, transcriptDocumentDetails, transcriptMetadataRows, transcriptSubjectValues } from "./learnerTranscript";
import { TRANSCRIPT_PAGE, LEARNER_TRANSCRIPT_LAYOUT as L, TRANSCRIPT_PDF_LAYOUT as P } from "./transcriptForm";
import { TRANSCRIPT_PDF_FONTS, TRANSCRIPT_PDF_FONT_METRICS as F } from "./learnerTranscriptPdfFonts";
import { TRANSCRIPT_PDF_METADATA_VALUE_X } from "./transcriptPdfMetadataLayout";
export { TRANSCRIPT_PDF_FONTS } from "./learnerTranscriptPdfFonts";

let rendererPromise;
async function renderer() {
  if (!rendererPromise) rendererPromise = (async () => {
    const { default: pdfMake } = await import("pdfmake/build/pdfmake.js");
    const entries = await Promise.all(Object.values(TRANSCRIPT_PDF_FONTS.TranscriptSerif).map(async filename => {
      const response = await fetch(`${process.env.PUBLIC_URL || ""}/fonts/transcript/${filename}`);
      if (!response.ok) throw new Error("Không tải được font bảng điểm. Vui lòng thử lại.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return [filename, btoa(binary)];
    }));
    pdfMake.addVirtualFileSystem(Object.fromEntries(entries));
    // pdfmake resolves paths by mutating its font descriptors.
    pdfMake.addFonts({ TranscriptSerif: { ...TRANSCRIPT_PDF_FONTS.TranscriptSerif } });
    return pdfMake;
  })().catch(error => { rendererPromise = null; throw error; });
  return rendererPromise;
}

// A rendering adapter only. All learner values, labels and ordering come from
// the same presentation mapping used by the Phase 2A HTML and Word renderers.
export function transcriptPdfDefinition(transcript) {
  const details = transcriptDocumentDetails(transcript);
  const left = TRANSCRIPT_PAGE.left / 20;
  const width = P.columnEdges[6] - P.columnEdges[0];
  const lineHeight = (points, size = L.bodyFont) => points / (size * F.height);
  const blank = height => ({ text: " ", fontSize: 1, lineHeight: lineHeight(height, 1) });
  // Liberation has the reference's native advances. The Noto-specific tracking
  // compensation is no longer needed; font sizes and point geometry stay fixed.
  const text = (input, style = "normal", size = L.bodyFont) => {
    const runs = (String(input).match(/\S+\s*|\s+/g) || [""]).map(value => {
      return { text: value, fontSize: size,
        bold: style === "bold", italics: style === "italic" };
    });
    return { text: runs, fontSize: size, margin: [0, -F.baselineShift * size, 0, F.baselineShift * size] };
  };
  const noLines = { hLineWidth: () => 0, vLineWidth: () => 0,
    paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };
  const metadata = transcriptMetadataRows(transcript).map((pair, rowIndex) => pair.map((field, columnIndex) => {
    const valueX = TRANSCRIPT_PDF_METADATA_VALUE_X[columnIndex ? "right" : "left"][rowIndex];
    const label = text(field.label + ": ");
    if (valueX == null) {
      // Blank diploma numbers stay blank; populated numbers retain inline spacing.
      const value = transcript.training.masterDiplomaNumber ? field.value : "";
      return { ...label, text: [...label.text, ...text(value, "bold").text] };
    }
    const labelX = left + L.metadataIndent + (columnIndex ? L.metadataLeft : 0);
    return { columns: [
      { ...label, width: valueX - labelX, noWrap: true },
      { ...text(field.value, "bold"), width: "*" },
    ], columnGap: 0 };
  }));
  // pdfmake adds one rule to each column, plus the outer rule. Subtract those
  // allowances so the painted rules land on the measured PDF column edges.
  const widths = P.columnEdges.slice(1).map((edge, index) =>
    edge - P.columnEdges[index] - L.border - (index === 0 ? L.border : 0));
  const row = (values, header = false) => values.map((value, column) => ({
    ...text(value, header ? "bold" : "normal"),
    noWrap: header, alignment: header || column !== 1 ? "center" : "left",
    margin: [!header && column === 1 ? L.subjectInset : 0, -F.baselineShift * L.bodyFont,
      !header && column === 1 ? L.subjectInset : 0, F.baselineShift * L.bodyFont],
    lineHeight: lineHeight(header ? P.headerHeight - L.border : P.bodyHeight - L.border),
  }));
  const body = [row(TRANSCRIPT_HEADERS, true), ...transcript.subjects.map(subject => row(transcriptSubjectValues(subject)))];
  const numberTop = P.numberTop;
  const titleTop = P.titleTop;
  const metadataTop = P.metadataTop;
  return {
    pageSize: { width: P.width, height: P.height },
    pageMargins: [left, TRANSCRIPT_PAGE.top / 20, TRANSCRIPT_PAGE.right / 20, TRANSCRIPT_PAGE.bottom / 20],
    defaultStyle: { font: "TranscriptSerif", fontSize: L.bodyFont, color: "#000000", lineHeight: lineHeight(L.bodyLine) },
    info: { title: transcript.title, subject: "Bảng điểm cá nhân" },
    content: [
      blank(numberTop - TRANSCRIPT_PAGE.top / 20),
      { stack: [{ columns: [
        { width: L.numberTabs[0] / 20 - L.numberIndent, ...text("Số:" + (transcript.issuance.number ? " " + transcript.issuance.number : "")) },
        { width: L.numberTabs[1] / 20 - L.numberTabs[0] / 20, ...text("/Khóa") },
        { width: "auto", ...text("/SĐH") },
      ], columnGap: 0, margin: [L.numberIndent, 0, 0, 0] },
      { absolutePosition: { x: left + L.numberTabs[0] / 20 + 30, y: numberTop + 10.2 },
        canvas: [{ type: "line", x1: 0, y1: 0, x2: L.numberTabs[1] / 20 - L.numberTabs[0] / 20 - 30, y2: 0,
          lineWidth: 0.6, dash: { length: 0.6, space: 2.4 } }] } ] },
      blank(titleTop - numberTop - L.bodyLine),
      { ...text(transcript.title, "bold", L.titleFont), alignment: "center", lineHeight: lineHeight(L.titleLine, L.titleFont) },
      blank(metadataTop - titleTop - L.titleLine),
      { table: { widths: [L.metadataLeft, width - L.metadataLeft], heights: L.metadataRows, body: metadata, dontBreakRows: true },
        margin: [L.metadataIndent, 0, 0, 0], layout: noLines },
      blank(P.tableTop - metadataTop - L.metadataRows.reduce((sum, height) => sum + height, 0)),
      { table: { headerRows: 1, dontBreakRows: true, keepWithHeaderRows: 1, widths, body,
        heights: index => index === 0 ? P.headerHeight - L.border : P.bodyHeight - L.border,
      }, margin: [P.columnEdges[0] - left, 0, 0, 0],
        layout: { hLineWidth: () => L.border, vLineWidth: () => L.border,
          hLineColor: () => "#000000", vLineColor: () => "#000000",
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } },
      { unbreakable: true, stack: [
        { columns: [
          { width: width - L.signatureRight, text: [...text(details.gpa.label + ": ").text, ...text(details.gpa.value, "bold").text],
            margin: [0, -F.baselineShift * L.bodyFont, 0, F.baselineShift * L.bodyFont] },
          { width: L.signatureRight, ...text(details.issueDate, "italic"), alignment: "right",
            margin: [0, P.dateOffset - P.gpaOffset - F.baselineShift * L.bodyFont, 0, F.baselineShift * L.bodyFont] },
        ], margin: [L.metadataIndent, P.gpaOffset, 0, 0] },
        blank(P.roleOffset - P.dateOffset - L.bodyLine),
        { columns: [
          { width: L.signatureLeft, alignment: "center", stack: [
            { ...text(details.signatures[0].roles[0], "bold"), lineHeight: lineHeight(P.rolePitch) },
            { ...text(details.signatures[0].roles[1] || " ", "bold"), lineHeight: lineHeight(13.26) },
            blank(L.signingSpace), text(details.signatures[0].name || " ", "bold"),
          ] },
          { width: width - L.signatureLeft - L.signatureRight, text: " " },
          { width: L.signatureRight, alignment: "center", stack: [
            { ...text(details.signatures[1].roles[0], "bold"), lineHeight: lineHeight(P.rolePitch) },
            { ...text(details.signatures[1].roles[1], "bold"), lineHeight: lineHeight(13.26) },
            blank(L.signingSpace), text(details.signatures[1].name || " ", "bold"),
          ] },
        ] },
      ] },
    ],
    footer: () => ({ margin: [P.columnEdges[0], P.footerY - (P.height - TRANSCRIPT_PAGE.bottom / 20), P.width - P.columnEdges[6], 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: width, y2: 0, lineWidth: L.border }] },
        blank(P.footerTop - P.footerY),
        { columns: details.footer.map((label, index) => ({ ...text(label, "bold", P.footerFont), width: width / 2,
          lineHeight: lineHeight(L.footerLine, P.footerFont), color: "#" + L.footerColor, alignment: index ? "right" : "left" })) },
      ] }),
  };
}

export async function createLearnerTranscriptPdf(transcript) {
  const pdfMake = await renderer();
  return pdfMake.createPdf(transcriptPdfDefinition(transcript)).getBlob();
}
