import { BRAND } from "../config/branding";
export const DOCUMENT_INSTITUTION = ["BỘ XÂY DỰNG", BRAND.university.toUpperCase(), BRAND.institute.toUpperCase()];
export const DOCUMENT_NATIONAL_HEADING = ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"];
export const documentDateLine = report => `Hải Phòng, ngày ${report.generatedAt.split(" ")[0]}`;

export function addExcelDocumentHeading(sheet, columnCount, dateLine) {
  const width = Math.max(2, columnCount), half = Math.max(1, Math.floor(width / 2));
  const totalWidth = Array.from({ length: width }, (_, index) => sheet.getColumn(index + 1).width || 9).reduce((sum, value) => sum + value, 0);
  if (totalWidth < 110) for (let index = 1; index <= width; index++) {
    const column = sheet.getColumn(index);
    column.width = (column.width || 9) * 110 / totalWidth;
  }
  const put = (row, from, to, text, extra = {}) => {
    if (to > from) sheet.mergeCells(row, from, row, to);
    const cell = sheet.getCell(row, from);
    cell.value = text;
    cell.font = { name: "Times New Roman", size: 11, bold: true, ...extra };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(row).height = 32;
  };
  DOCUMENT_INSTITUTION.forEach((line, index) => put(index + 1, 1, half, line, { underline: index === 1 }));
  DOCUMENT_NATIONAL_HEADING.forEach((line, index) => put(index + 1, half + 1, width, line, { underline: index === 1 }));
  put(3, half + 1, width, dateLine, { bold: false, italic: true });
  return 3;
}
