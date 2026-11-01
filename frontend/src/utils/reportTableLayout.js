export const isReportSerialColumn = header => /^(STT|Số thứ tự)$/iu.test(String(header).trim());

export const reportSerialWidth = section => Math.max(32, Math.min(46, String(section.rows.length).length * 6 + 12));
export const isReportYearColumn = header => /^(Năm(?: học| nhập học| tuyển sinh| vào trường| sinh)?|Niên khóa|Khóa(?: học| \/ năm học)?)$/iu.test(String(header).trim());
export const reportCompactColumn = header => isReportSerialColumn(header) || isReportYearColumn(header);
export const reportCompactWidth = (section, index) => isReportSerialColumn(section.headers[index]) ? reportSerialWidth(section)
  : section.rows.reduce((width, row) => Math.max(width, Math.min(90, String(row[index] ?? "").length * 5 + 6)), 30);

export function reportColumnWidths(section, totalWidth, serialWidth = reportSerialWidth(section)) {
  const scale = serialWidth / reportSerialWidth(section);
  const compactWidths = section.headers.map((header, index) => reportCompactColumn(header) ? Math.round(reportCompactWidth(section, index) * scale) : null);
  const otherCount = compactWidths.filter(value => value === null).length;
  const reserved = compactWidths.reduce((sum, width) => sum + (width || 0), 0);
  const normalWidth = Math.floor(otherCount ? (totalWidth - reserved) / otherCount : totalWidth / section.headers.length);
  const widths = compactWidths.map(width => otherCount ? width ?? normalWidth : normalWidth);
  widths[widths.length - 1] += totalWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}
