import React from "react";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate } from "../../features/exams/gradebook";
import { BRAND } from "../../config/branding";

export const scoreSummaryColumns = (subjects) => [
  { key: "index", label: "STT", width: 48, minWidth: 40, align: "center" },
  { key: "code", label: "Mã HV", width: 130 },
  { key: "lastName", label: "Họ đệm", width: 155 },
  { key: "firstName", label: "Tên", width: 90 },
  { key: "dob", label: "Ngày sinh", width: 110, align: "center" },
  { key: "gender", label: "Giới tính", width: 78, align: "center" },
  ...subjects.map(subject => ({ key: subject.id, label: subject.name,
    width: Math.max(130, Math.min(270, subject.name.length * 6)), minWidth: 90, align: "center",
    header: <span title={`${subject.code} · ${subject.credits} tín chỉ · ${subject.isRequired ? "Bắt buộc" : "Tự chọn"} · ${subject.blockName || ""}`}>{subject.name}</span>,
  })),
];

export const scoreSummaryValue = (entry) => entry?.result === "exempt" ? "MT" : entry?.score == null ? "" : entry.score;

const TABLE_HEADER_ROW = 10;
const reportFont = (size = 11, extra = {}) => ({ name: "Times New Roman", size, color: { argb: "FF000000" }, ...extra });
const excelBirthDate = (value) => {
  const text = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : String(value || "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === `${year}-${month}-${day}`) return `${day}/${month}/${year}`;
  }
  return displayGradeDate(value);
};

export async function createClassScoreWorkbook(report) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const sheet = book.addWorksheet("Tổng hợp điểm", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", xSplit: 6, ySplit: TABLE_HEADER_ROW, topLeftCell: `G${TABLE_HEADER_ROW + 1}`, showGridLines: false }],
  });
  const columns = scoreSummaryColumns(report.subjects);
  const identityWidths = [6, 12, 18, 11, 12, 10];
  sheet.columns = columns.map((column, index) => ({ width: identityWidths[index] || 12,
    style: { font: reportFont(), alignment: { vertical: "middle" } } }));
  const mergedLine = (rowNumber, value, { size = 11, bold = false, italic = false, horizontal = "left", height = 20 } = {}) => {
    sheet.mergeCells(rowNumber, 1, rowNumber, columns.length);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = value;
    cell.font = reportFont(size, { bold, italic });
    cell.alignment = { horizontal, vertical: "middle", wrapText: true };
    sheet.getRow(rowNumber).height = height;
  };
  mergedLine(1, BRAND.university.toLocaleUpperCase("vi-VN"), { bold: true, size: 12, horizontal: "center", height: 22 });
  mergedLine(2, BRAND.institute.toLocaleUpperCase("vi-VN"), { bold: true, size: 12, horizontal: "center", height: 22 });
  mergedLine(4, "TỔNG HỢP ĐIỂM CỦA LỚP", { bold: true, size: 16, horizontal: "center", height: 28 });
  const metadata = (row, label, value) => mergedLine(row, { richText: [
    { text: label, font: reportFont(11, { bold: true }) },
    { text: ` ${value || ""}`, font: reportFont(11, { bold: false }) },
  ] });
  metadata(6, "Lớp:", report.group.code || report.group.name);
  metadata(7, "Năm vào trường:", report.group.academicYear);
  metadata(8, "CTĐT:", report.curriculum?.name);
  [3, 5, 9].forEach(row => { sheet.getRow(row).height = 8; });

  const header = sheet.getRow(TABLE_HEADER_ROW);
  header.values = columns.map(column => column.label);
  header.font = reportFont(10, { bold: true });
  for (let column = 1; column <= columns.length; column += 1) {
    header.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  }
  header.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
  header.height = 60;
  report.rows.forEach((person, index) => {
    const name = personNameParts(person);
    const row = sheet.addRow([index + 1, person.code || "", name.familyAndMiddle, name.givenName, excelBirthDate(person.dob), person.gender || "",
      ...report.subjects.map(subject => scoreSummaryValue(person.scores?.[subject.id]))]);
    row.height = 20;
    row.getCell(2).numFmt = "@";
    columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.font = reportFont();
      cell.alignment = { horizontal: [2, 3].includes(columnIndex) ? "left" : "center", vertical: "middle", wrapText: true };
      if (columnIndex >= 6) cell.numFmt = "0.##";
    });
  });
  const tableLastRow = TABLE_HEADER_ROW + report.rows.length;
  for (let row = TABLE_HEADER_ROW; row <= tableLastRow; row += 1) {
    for (let column = 1; column <= columns.length; column += 1) {
      const edge = style => ({ style, color: { argb: "FF000000" } });
      sheet.getCell(row, column).border = {
        top: edge(row === TABLE_HEADER_ROW ? "medium" : "thin"),
        bottom: edge(row === tableLastRow ? "medium" : "thin"),
        left: edge(column === 1 ? "medium" : "thin"),
        right: edge(column === columns.length ? "medium" : "thin"),
      };
    }
  }
  report.subjects.forEach((subject, index) => {
    sheet.getCell(TABLE_HEADER_ROW, index + 7).note = `${subject.code} · ${subject.credits} tín chỉ · ${subject.isRequired ? "Bắt buộc" : "Tự chọn"}`;
  });
  sheet.getRow(tableLastRow + 1).height = 8;
  const policy = report.scorePolicy || "Ô trống: chưa có điểm; MT: miễn thi. Điểm học phần đã lưu gần nhất, gồm kết quả cá nhân đã hoàn thành.";
  const notes = ["Ghi chú:", ...policy.split(/;\s*(?=MT)|\.\s+(?=Ô trống|MT|Điểm học phần)/)];
  notes.forEach((note, index) => {
    mergedLine(tableLastRow + 2 + index, note, { size: 10, italic: true, bold: index === 0, height: 18 });
  });
  sheet.autoFilter = { from: { row: TABLE_HEADER_ROW, column: 1 }, to: { row: TABLE_HEADER_ROW, column: columns.length } };
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: false, scale: 100, fitToWidth: 0, fitToHeight: 0,
    printTitlesColumn: "A:F", printTitlesRow: `${TABLE_HEADER_ROW}:${TABLE_HEADER_ROW}`,
    printArea: `A1:${sheet.getColumn(columns.length).letter}${tableLastRow + 1 + notes.length}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    showGridLines: false };
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
