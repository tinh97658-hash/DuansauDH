export const isReportSerialColumn = header => /^(STT|Số thứ tự)$/iu.test(String(header).trim());

export const reportSerialWidth = section => Math.max(32, Math.min(46, String(section.rows.length).length * 6 + 12));
export const isReportYearColumn = header => /^(Năm(?: học| nhập học| tuyển sinh| vào trường| sinh)?|Niên khóa|Khóa(?: học| \/ năm học)?)$/iu.test(String(header).trim());
export const isReportShortColumn = header => /^(Mã HP|TC|Số HV|Lớp\/nhóm|Tình trạng xếp lịch|Số buổi đã học)$/iu.test(String(header).trim());
export const reportCompactColumn = header => isReportSerialColumn(header) || isReportYearColumn(header) || isReportShortColumn(header);
export const reportCompactWidth = (section, index) => isReportSerialColumn(section.headers[index]) ? reportSerialWidth(section)
  : section.rows.reduce((width, row) => Math.max(width, Math.min(isReportShortColumn(section.headers[index]) ? 160 : 90, String(row[index] ?? "").length * 5 + 6)),
    isReportShortColumn(section.headers[index]) ? Math.max(22, String(section.headers[index]).length * 5 + 6) : 30);

export function reportColumnWidths(section, totalWidth, serialWidth = reportSerialWidth(section)) {
  const scale = serialWidth / reportSerialWidth(section);
  let compactWidths = section.headers.map((header, index) => reportCompactColumn(header) ? Math.round(reportCompactWidth(section, index) * scale) : null);
  const otherCount = compactWidths.filter(value => value === null).length;
  let reserved = compactWidths.reduce((sum, width) => sum + (width || 0), 0);
  const compactBudget = totalWidth - Math.min(totalWidth * .5, otherCount * 50 * scale);
  if (otherCount && reserved > compactBudget) {
    compactWidths = compactWidths.map(width => width == null ? null : Math.max(1, Math.floor(width * compactBudget / reserved)));
    reserved = compactWidths.reduce((sum, width) => sum + (width || 0), 0);
  }
  const normalWidth = Math.floor(otherCount ? (totalWidth - reserved) / otherCount : totalWidth / section.headers.length);
  const widths = compactWidths.map(width => otherCount ? width ?? normalWidth : normalWidth);
  widths[widths.length - 1] += totalWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}

// Spreadsheet-only lists have room to grow horizontally. Size their columns
// from the complete dataset instead of dividing an A4 width into equal cells.
export function singleTableExcelLayout(section, fontSize = 10) {
  const context = typeof document !== "undefined" && document.documentElement.clientWidth
    ? document.createElement("canvas").getContext("2d") : null;
  const measure = (value, bold = false) => Math.max(0, ...String(value ?? "").split(/\r?\n/).map(line => {
    if (context) {
      context.font = `${bold ? "bold " : ""}${fontSize}pt "Times New Roman"`;
      return context.measureText(line).width * .75;
    }
    return Array.from(line.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).reduce((sum, char) =>
      sum + (/\s/.test(char) ? .25 : /[ilI.,:;!|]/.test(char) ? .28 : /[MW@]/.test(char) ? .85 : /[A-ZĐ]/.test(char) ? .67 : .5) * fontSize, 0) * (bold ? 1.08 : 1);
  }));
  const padding = 12;
  const minimum = header => ({ "STT": 30, "Mã HV": 105, "Mã nhóm": 95, "Họ đệm": 95, "Tên": 55,
    "Email": 210, "Ngày sinh": 65, "Giới tính": 52, "Số CMND/CCCD": 100, "Năm nhập học": 80,
    "Trình độ": 65, "Ngành": 145, "Điện thoại": 85, "Học phí": 65, "Trạng thái": 90 }[header] || 55);
  const contentWidths = section.headers.map((_, column) => section.rows.reduce((width, row) => Math.max(width, measure(row[column])), 0));
  const widths = section.headers.map((header, column) => Math.ceil(Math.max(minimum(header), measure(header, true) + padding, Math.min(280, contentWidths[column] + padding))));
  const cells = section.headers.map((header, column) => ({
    align: /^(STT|Ngày sinh|Giới tính|Năm nhập học|Trình độ|Học phí|Trạng thái)$/u.test(header) ? "center" : "left",
    vertical: "middle", wrap: contentWidths[column] + padding > widths[column],
  }));
  const rowHeight = values => Math.max(fontSize * 1.35 + 7.5, ...values.map((value, column) =>
    String(value ?? "").split(/\r?\n/).reduce((lines, line) => lines + (cells[column].wrap ? Math.max(1, Math.ceil(measure(line) / (widths[column] - padding))) : 1), 0) * fontSize * 1.35 + 7.5));
  return { widths, cells, headerHeight: fontSize * 1.35 + 7.5, rowHeights: section.rows.map(rowHeight) };
}
