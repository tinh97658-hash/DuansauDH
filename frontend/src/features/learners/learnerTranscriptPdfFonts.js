// Unmodified Liberation Serif 2.1.5 faces, licensed under SIL OFL 1.1.
// Source/provenance and license: public/fonts/transcript/README.md.
export const TRANSCRIPT_PDF_FONTS = Object.freeze({ TranscriptSerif: Object.freeze({
  normal: "LiberationSerif-Regular.ttf", bold: "LiberationSerif-Bold.ttf",
  italics: "LiberationSerif-Italic.ttf", bolditalics: "LiberationSerif-BoldItalic.ttf",
}) });

// Font metrics, not document geometry. PDFKit's lineHeight excludes lineGap:
// hhea ascent=1825, descent=-443, unitsPerEm=2048 for all four source faces.
// Normalize the font's line box to the existing point heights and preserve
// the existing reference baseline. Page/table/paragraph dimensions stay fixed.
export const TRANSCRIPT_PDF_FONT_METRICS = Object.freeze({
  height: 2268 / 2048,
  baselineShift: 1825 / 2048 - 0.891,
});
