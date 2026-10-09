import React from "react";
import { personNameParts } from "../../utils/personName";
import { displayGradeDate } from "../../features/exams/gradebook";

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

export async function createClassScoreWorkbook(report) {
  const module = await import("exceljs");
  const book = new (module.default || module).Workbook();
  const sheet = book.addWorksheet("Tổng hợp điểm", { views: [{ state: "frozen", xSplit: 4, ySplit: 4 }] });
  const columns = scoreSummaryColumns(report.subjects);
  sheet.columns = columns.map(column => ({ width: Math.max(8, Math.round(column.width / 7)) }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell("A1").value = "TỔNG HỢP ĐIỂM CỦA LỚP";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF173E75" } };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell("A2").value = `Lớp: ${report.group.code || report.group.name} · Năm vào trường: ${report.group.academicYear || ""} · CTĐT: ${report.curriculum?.name || ""}`;
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell("A3").value = "Ô trống: chưa có điểm; MT: miễn thi. Điểm học phần đã lưu gần nhất, gồm kết quả cá nhân đã hoàn thành.";
  const header = sheet.addRow(columns.map(column => column.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173E75" } };
  header.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
  header.height = 48;
  report.rows.forEach((person, index) => {
    const name = personNameParts(person);
    const row = sheet.addRow([index + 1, person.code || "", name.familyAndMiddle, name.givenName, displayGradeDate(person.dob), person.gender || "",
      ...report.subjects.map(subject => scoreSummaryValue(person.scores?.[subject.id]))]);
    row.getCell(2).numFmt = "@";
    report.subjects.forEach((subject, index) => {
      const cell = row.getCell(index + 7);
      cell.numFmt = "0.##";
      cell.alignment = { horizontal: "center" };
      if (person.scores?.[subject.id]?.result === "failed") cell.font = { color: { argb: "FFC62828" } };
    });
  });
  report.subjects.forEach((subject, index) => {
    sheet.getCell(4, index + 7).note = `${subject.code} · ${subject.credits} tín chỉ · ${subject.isRequired ? "Bắt buộc" : "Tự chọn"}`;
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:4" };
  return new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
