// Fixed form/version metadata from the supplied KẾT QUẢ HỌC TẬP reference.
// This follows the per-template metadata pattern in scheduleDocumentMetadata;
// these constants are not learner data or an approval/score-lock policy.
export const TRANSCRIPT_FORM = Object.freeze({
  code: "BM.08-QT.SDH.05", publishedOn: "10/04/23", revision: "00",
  gpaLabel: "Điểm trung bình chung học phần",
  signatureRoles: Object.freeze([
    Object.freeze(["CHUYÊN VIÊN"]),
    Object.freeze(["TL. HIỆU TRƯỞNG", "VIỆN TRƯỞNG VIỆN ĐTSĐH"]),
  ]),
});

export const TRANSCRIPT_PAGE = Object.freeze({
  width: 11910, height: 16840, top: 400, bottom: 680, left: 850, right: 566, footer: 483,
});
export const TRANSCRIPT_COLUMN_WIDTHS = Object.freeze([540, 4693, 1509, 1144, 1115, 1345]);
export const TRANSCRIPT_TABLE_WIDTH = TRANSCRIPT_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);

// Points, unless the existing PAGE/COLUMN constants explicitly use DXA.
export const LEARNER_TRANSCRIPT_LAYOUT = Object.freeze({
  bodyFont: 12, titleFont: 14, footerFont: 9.5,
  bodyLine: 14.25, titleLine: 16.5, footerLine: 11.5,
  topBlank: 3.75, numberIndent: 4.05, numberTabs: Object.freeze([1123, 2907]),
  numberRow: 14.25, numberTitleGap: 17.17,
  titleRow: 16.5, titleMetadataGap: 25.04,
  metadataRows: Object.freeze([16.56, 16.56, 16.56, 16.56, 16.56, 16.56]),
  metadataIndent: 4.05, metadataLeft: 243.36, metadataTableGap: 3.73,
  tableIndent: 3.5, border: 0.75, headerMinimum: 16.5, bodyMinimum: 14.15,
  wrappedMinimum: Object.freeze([28.3, 28.5]), subjectInset: 1.44,
  cellHorizontal: 0, cellVertical: 0,
  gpaGap: 1.02, dateOffset: 10.44, signatureGap: 4.11,
  signatureLeft: 165, signatureRight: 253.5, signingSpace: 55.5,
  footerSpacer: 0.75, footerColor: "808080",
  // Noto Serif assets: (ascent - descent + lineGap) / unitsPerEm.
  pdfFontHeight: 1.362,
});

// PDF coordinates measured in the supplied hard spec; PDF and Word page sizes
// differ slightly. Text positions describe the reference text bounding boxes.
export const TRANSCRIPT_PDF_LAYOUT = Object.freeze({
  width: 595.32, height: 841.92,
  numberTop: 25.19, titleTop: 56.61, metadataTop: 98.15, tableTop: 201.24,
  columnEdges: Object.freeze([45, 72.84, 307.44, 382.92, 440.16, 495.96, 563.28]),
  headerHeight: 18, bodyHeight: 15.024, wrappedHeights: Object.freeze([29.16, 29.28]),
  gpaOffset: 2.27, dateOffset: 12.71, roleOffset: 31.07,
  rolePitch: 16.56, signerOffset: 116.39,
  footerY: 804.12, footerTop: 805.06, footerFont: 9.72,
});

// Advance differences (em) measured between the retained Noto Serif and the
// reference Times New Roman. Layout tracking preserves 12pt glyph size while
// matching reference wrapping; this contains metrics, never font outlines.
// Index: ASCII 32..126, then Đ and đ. Vietnamese accents use their base advance.
export const TRANSCRIPT_PDF_ADVANCE_DELTAS = Object.freeze({
  normal: Object.freeze([0.01, -0.001008, -0.000203, 0.059, 0.059, 0.062992, -0.035832, 0.039824, 0.012992, 0.012992, 0.0, -0.004965, 0.0, -0.023008, 0.0, 0.010168, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.008168, 0.008168, -0.004965, -0.004965, -0.004965, 0.030152, 0.000102, -0.017168, -0.012992, -0.052992, 0.004832, 0.01216, 0.033848, -0.008168, 0.070832, 0.033992, -0.03216, -0.022168, 0.01216, 0.04884, 0.040832, 0.019832, 0.047848, 0.019832, -0.010992, -0.012152, 0.00216, -0.005168, -0.047168, 0.103152, -0.062168, -0.097168, -0.01884, 0.026992, 0.010168, 0.026992, 0.089762, -0.041, -0.059008, 0.119152, 0.114, 0.048152, 0.114, 0.091152, 0.035992, 0.038, 0.135, 0.042168, 0.022168, 0.085, 0.032168, 0.167168, 0.145, 0.077, 0.114, 0.114, 0.137992, 0.06184, 0.074168, 0.135, 0.079, 0.139832, 0.078, 0.065, 0.067152, -0.05198, 0.358805, -0.05198, 0.017984, 0.004832, 0.114]),
  bold: Object.freeze([0.01, 0.048992, -0.047176, 0.059, 0.059, -0.094, -0.032008, 0.012168, 0.066992, 0.066992, 0.002, -0.010824, 0.044, -0.023008, 0.044, 0.010168, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, -0.029008, -0.029008, -0.010824, -0.010824, -0.010824, 0.05, -0.009176, 0.030832, 0.005008, -0.054168, 0.044832, -0.013992, 0.01016, -0.008832, 0.041168, 0.01184, -0.103, -0.043832, -0.012992, 0.008152, 0.065832, 0.009168, 0.02716, 0.009168, -0.015168, 0.029848, -0.013992, 0.024832, -0.024168, 0.067, 0.009832, -0.029168, -0.000992, 0.080992, 0.010168, 0.080992, -0.022055, -0.041, 0.000992, 0.099, 0.092848, 0.083152, 0.092848, 0.127152, 0.073992, 0.06, 0.110848, 0.074168, 0.011992, 0.079848, 0.074168, 0.152992, 0.110848, 0.113, 0.088848, 0.091848, 0.079152, 0.09884, 0.071992, 0.110848, 0.106, 0.133832, 0.146, 0.079, 0.085152, 0.047957, 0.338785, 0.047957, 0.03898, 0.044832, 0.092848]),
  italic: Object.freeze([0.01, -8e-06, -0.011922, 0.059, 0.059, 0.062992, -0.035832, 0.006133, 0.012992, 0.012992, 0.0, -0.115805, 0.0, -0.023008, 0.0, 0.010168, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, -0.047008, -0.047008, -0.115805, -0.115805, -0.115805, 0.0, 0.001078, 0.09416, 0.04316, -0.039992, 0.002832, 0.01216, -0.02084, -0.008168, 0.070832, 0.033992, -0.086848, 0.033008, 0.066848, 0.104992, 0.096008, 0.019832, 0.00916, 0.019832, 0.05316, 0.044, 0.056848, 0.007832, 0.06416, 0.211992, 0.04916, 0.068848, 0.048848, -0.02916, 0.010168, -0.02916, 0.137125, -0.041, -0.054008, 0.079, 0.062, 0.043152, 0.079, 0.049152, 0.040168, 0.056, 0.099, 0.026168, 0.013168, 0.125152, 0.026168, 0.173832, 0.099, 0.074, 0.077, 0.06, 0.07884, 0.07484, 0.090168, 0.099, 0.094152, 0.152008, 0.102152, 0.084152, 0.12184, 0.028098, 0.284098, 0.028098, 0.017984, 0.002832, 0.078])
});

// Reference glyph advances (em), in the same character order as the PDF deltas.
// Used only to choose minimum Word row heights; Word still wraps and expands.
const REFERENCE_ADVANCES = Object.freeze([0.25,0.333008,0.408203,0.5,0.5,0.833008,0.777832,0.180176,0.333008,0.333008,0.5,0.563965,0.25,0.333008,0.25,0.277832,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.277832,0.277832,0.563965,0.563965,0.563965,0.443848,0.920898,0.722168,0.666992,0.666992,0.722168,0.61084,0.556152,0.722168,0.722168,0.333008,0.38916,0.722168,0.61084,0.88916,0.722168,0.722168,0.556152,0.722168,0.666992,0.556152,0.61084,0.722168,0.722168,0.943848,0.722168,0.722168,0.61084,0.333008,0.277832,0.333008,0.469238,0.5,0.333008,0.443848,0.5,0.443848,0.5,0.443848,0.333008,0.5,0.5,0.277832,0.277832,0.5,0.277832,0.777832,0.5,0.5,0.5,0.5,0.333008,0.38916,0.277832,0.5,0.5,0.722168,0.5,0.5,0.443848,0.47998,0.200195,0.47998,0.541016,0.722168,0.5]);

export function transcriptReferenceLineCount(input, width, fontSize = 12) {
  const measure = value => Array.from(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).reduce((sum, char) => {
    const index = char === "Đ" ? 95 : char === "đ" ? 96 : char.codePointAt(0) - 32;
    return sum + (REFERENCE_ADVANCES[index] ?? 0.5) * fontSize;
  }, 0);
  return String(input).split(/\r?\n/).reduce((total, line) => {
    let count = 1, occupied = 0;
    for (const word of line.trim().split(/\s+/)) {
      const wordWidth = measure(word);
      const space = occupied ? fontSize * 0.25 : 0;
      if (occupied && occupied + space + wordWidth > width) { count++; occupied = wordWidth; }
      else occupied += space + wordWidth;
    }
    return total + count;
  }, 0);
}
