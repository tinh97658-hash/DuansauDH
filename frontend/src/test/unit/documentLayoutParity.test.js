import ExcelJS from "exceljs";
import JSZip from "jszip";
import { TextEncoder } from "node:util";
import { createReportExcel, createReportWord, normalizeReport, reportPrintSections } from "../../utils/reportExport";
import { createLearnerTranscriptExcel } from "../../features/learners/learnerTranscriptExcel";
import { normalizeLearnerTranscript, transcriptDocumentDetails, transcriptMetadataRows } from "../../features/learners/learnerTranscript";
import { transcriptScorecardFixture } from "../fixtures/learnerTranscript.fixture";
import { buildAdmissionDocument } from "../../features/admission/admissionDocument";
import { createAdmissionExcel } from "../../features/admission/admissionDocumentExport";
import { buildExamListDocument, createExamListWord, examListDocumentMetadata } from "../../features/exams/examListExport";
import { excelWidthToPoints } from "../../utils/documentLayout";
import { TRANSCRIPT_TABLE_WIDTH, TRANSCRIPT_PAGE } from "../../features/learners/transcriptForm";

const encoder = global.TextEncoder;
beforeAll(() => { global.TextEncoder = TextEncoder; });
afterAll(() => { global.TextEncoder = encoder; });
const bytes = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});
const workbook = async blob => {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await bytes(blob)); return book;
};
const sheetText = sheet => {
  const values = [];
  sheet.eachRow(row => row.eachCell(cell => {
    if (!cell.isMerged || cell.master.address === cell.address) values.push(cell.text);
  }));
  return values.join("\n");
};

it("uses the individual transcript form in Excel, including paired fields, dates, signatures and the form footer", async () => {
  const transcript = normalizeLearnerTranscript(transcriptScorecardFixture);
  transcript.subjects[0].score = 0;
  const details = transcriptDocumentDetails(transcript);
  const sheet = (await workbook(await createLearnerTranscriptExcel(transcript))).worksheets[0];
  const text = sheetText(sheet);
  for (const pair of transcriptMetadataRows(transcript)) for (const field of pair) expect(text).toContain(`${field.label}:`);
  for (const value of [transcript.title, details.issueDate, details.gpa.label, ...details.signatures.flatMap(signature => signature.roles)]) expect(text).toContain(value);
  expect(text).not.toContain("BỘ XÂY DỰNG");
  expect(text).not.toContain("Kết quả các học phần");
  expect(sheet.headerFooter.oddFooter).toContain(transcript.form.code);
  expect(sheet.pageSetup).toMatchObject({ orientation: "portrait", fitToWidth: 1, printTitlesRow: "12:12" });
  expect(sheet.pageSetup.margins.left).toBeCloseTo(TRANSCRIPT_PAGE.left / 1440);
  const totalWidth = sheet.columns.reduce((sum, column) => sum + excelWidthToPoints(column.width), 0);
  expect(totalWidth).toBeCloseTo(TRANSCRIPT_TABLE_WIDTH / 20, 0);
  const cells = [];
  sheet.getRow(13).eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) cells.push(cell); });
  expect(cells[4].value).toBe(0);
  expect(cells[4].font).toMatchObject({ name: "Times New Roman", size: 12 });
});

it("exports the admission form as one worksheet with all sections, checklist and signature blocks", async () => {
  const data = buildAdmissionDocument({ fullName: "Nguyễn Văn An", code: "00123", documents: { docDegree: true }, majorName: "Công nghệ thông tin" });
  const book = await workbook(await createAdmissionExcel(data));
  expect(book.worksheets).toHaveLength(1);
  const sheet = book.worksheets[0], text = sheetText(sheet);
  for (const value of [...data.masthead, ...data.nationalHeading, data.displayCode, data.title, data.subtitle,
    ...data.sections.map(section => section.title), data.checklistTitle, ...data.signatures.map(signature => signature.title)]) expect(text).toContain(value);
  for (const section of data.sections) for (const field of [...section.fields, ...(section.extra ? [section.extra] : [])]) expect(text).toContain(field.label);
  for (const item of data.documents) expect(text).toContain(`${item.checked ? "☑" : "☐"} ${item.label}`);
  expect(text).toContain("Ảnh 3x4");
  expect(sheet.pageSetup).toMatchObject({ orientation: "portrait", fitToWidth: 1 });
});

it("preserves the exam-list print layout and sign-off in Word instead of the generic report masthead", async () => {
  const data = buildExamListDocument({ code: "CNTT26" }, { subject: { name: "Triết học" } }, [
    { code: "001", fullName: "Nguyễn An", eligible: true, examExempt: false, testScore: 4, assignmentScore: 4 },
  ]);
  const zip = await JSZip.loadAsync(await bytes(await createExamListWord(data)));
  const xml = await zip.file("word/document.xml").async("string");
  const footer = await zip.file("word/footer1.xml").async("string");
  const metadata = examListDocumentMetadata(data);
  for (const value of [data.title, metadata.range, metadata.notice, metadata.total, ...metadata.duty, ...metadata.signatures]) expect(xml).toContain(value);
  expect(xml).not.toContain("BỘ XÂY DỰNG");
  expect(xml).not.toContain("CỘNG HÒA XÃ HỘI");
  expect(xml).toContain('w:orient="landscape"');
  expect(footer).toContain(metadata.footer[1]);
});

it("uses the printed admission columns and table parts in both editable formats", async () => {
  const report = normalizeReport({ title: "Hồ sơ tuyển sinh", sections: [{ title: "Hồ sơ tuyển sinh",
    headers: ["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Trạng thái"], rows: [[1, "0001", "Nguyễn Văn", "An", "1995-01-02", "KHÔNG IN CỘT NÀY"]] }] });
  const book = await workbook(await createReportExcel(report));
  const zip = await JSZip.loadAsync(await bytes(await createReportWord(report)));
  const xml = await zip.file("word/document.xml").async("string");
  expect(sheetText(book.worksheets[0])).not.toContain("KHÔNG IN CỘT NÀY");
  expect(xml).not.toContain("KHÔNG IN CỘT NÀY");
  expect(sheetText(book.worksheets[0])).not.toContain("Ngày xuất:");
  expect(xml).not.toContain("Ngày xuất:");

  const wide = normalizeReport({ title: "Bảng rộng", sections: [{ title: "Kết quả", headers: ["STT", "Mã HV", "Họ tên", ...Array.from({ length: 20 }, (_, i) => `Môn ${i + 1}`)],
    rows: [[1, "0001", "Nguyễn An", ...Array.from({ length: 20 }, (_, i) => i)]] }] });
  const parts = reportPrintSections(wide);
  const sheets = (await workbook(await createReportExcel(wide))).worksheets;
  expect(sheets).toHaveLength(1);
  parts.forEach(part => {
    const text = sheetText(sheets[0]);
    expect(text).toContain(part.title);
    for (const label of part.headers) expect(text).toContain(label);
    expect(text).toContain("0001");
  });
});

it("keeps all 280 admitted learners in one wide Excel table without repeating their identity below", async () => {
  const headers = ["STT", "Mã HV", "Họ đệm", "Tên", "Ngày sinh", "Giới tính", "Mã nhóm", "Email", "Số CMND/CCCD", "Năm nhập học", "Trình độ", "Ngành", "Điện thoại", "Học phí", "Trạng thái"];
  const rows = Array.from({ length: 280 }, (_, index) => [index + 1, `HV${index + 1}`, "Nguyễn Văn", "An", "01/01/90", "Nam", "CNTT26", "an@example.com", "00123", "2026", "Thạc sĩ", "Công nghệ thông tin", "0901234567", "Đã nộp", "Đang học"]);
  rows[0][1] = "MAU-DN26-1017-001";
  rows[0][2] = "Nguyễn Trường";
  rows[0][6] = "CNTT 2026.1.1";
  rows[0][7] = "mau-dn26-1017-001@example.invalid";
  const report = normalizeReport({ title: "Danh sách học viên", excelLayout: "single-table", sections: [{ title: "Danh sách học viên", headers, rows }] });
  expect(reportPrintSections(report)).toHaveLength(2);
  const sheet = (await workbook(await createReportExcel(report))).worksheets[0];
  const data = [], headings = [];
  sheet.eachRow(row => {
    const values = [];
    row.eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) values.push(cell.value); });
    if (values[0] === "STT") headings.push(values);
    if (typeof values[0] === "number") data.push(values);
  });
  expect(headings).toEqual([headers]);
  expect(data).toEqual(rows);
  expect(sheetText(sheet)).not.toContain("Phần 1/2");
  expect(sheet.pageSetup).toMatchObject({ orientation: "landscape", fitToWidth: 1, fitToHeight: 0 });
  const cells = [];
  sheet.lastRow.eachCell(cell => { if (!cell.isMerged || cell.master.address === cell.address) cells.push(cell); });
  const widthOf = cell => {
    let end = cell.col;
    while (end < sheet.columnCount && sheet.getCell(cell.row, end + 1).master.address === cell.address) end++;
    return Array.from({ length: end - cell.col + 1 }, (_, index) => excelWidthToPoints(sheet.getColumn(cell.col + index).width)).reduce((sum, width) => sum + width, 0);
  };
  for (const [column, width] of [[2, 95], [6, 95], [7, 210], [9, 80]]) expect(widthOf(cells[column])).toBeGreaterThanOrEqual(width - .02);
  expect(cells[7].alignment.wrapText).not.toBe(true);
  expect(sheet.lastRow.height).toBeLessThan(30);
  const headerRow = sheet.getRow(Number(sheet.pageSetup.printTitlesRow.split(":")[0]));
  headerRow.eachCell(cell => expect(cell.alignment.wrapText).not.toBe(true));
});
