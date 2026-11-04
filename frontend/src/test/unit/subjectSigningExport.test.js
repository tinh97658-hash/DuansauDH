import JSZip from "jszip";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { buildSubjectSigningDocument, createSubjectSigningWord, createSubjectSigningExcel, SUBJECT_SIGNING_FORM } from "../../features/exams/subjectSigningExport";
import { excelWidthToPoints } from "../../utils/documentLayout";

const sample = () => buildSubjectSigningDocument([
  { code: "CKTM 2026.1.1", academicYear: "2026", major: { name: "Cơ khí thông minh và Robot" } },
  { code: "QLSX 2026.1.1", academicYear: "2026", major: { name: "Quản lý sản xuất" } },
], { subject: { name: "Hệ thống sản xuất linh hoạt và tích hợp", credits: 2 } },
Array.from({ length: 31 }, (_, i) => ({ fullName: `Nguyễn Văn An ${i + 1}`, testScore: i ? 8 : 0, assignmentScore: 9,
  result: i ? "passed" : "failed", finalized: true })));
const bytes = blob => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsArrayBuffer(blob); });

it("retains the merged offering roster, zero marks and blank attendance/practical fields", () => {
  const doc = sample();
  expect(doc.group).toBe("CKTM 2026.1.1 + QLSX 2026.1.1");
  expect(doc.major).toBe("Cơ khí thông minh và Robot + Quản lý sản xuất");
  expect(doc.rows[0]).toEqual([1, "Nguyễn Văn An 1", "", "", "", "", "", "", "", "", "", 0, "", 9, "", "", "Không đạt"]);
  expect(doc.rows).toHaveLength(31);
  expect(doc.rows.map(row => row[0])).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
});

it("leaves unapproved or unavailable processing outcomes blank", () => {
  const doc = buildSubjectSigningDocument([], {}, [{ fullName: "Học viên", testScore: null, assignmentScore: null, result: "failed" }]);
  expect(doc.rows[0].slice(11)).toEqual(["", "", "", "", "", ""]);
});

it("creates a landscape Word form with merged two-row headers and the original footer", async () => {
  const blob = await createSubjectSigningWord(sample());
  const buffer = await bytes(blob);
  fs.mkdirSync(path.resolve("../.tmp"), { recursive: true });
  fs.writeFileSync(path.resolve("../.tmp/subject-signing-sample.docx"), new Uint8Array(buffer));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml").async("string");
  expect(xml).toContain('w:w="16840"'); expect(xml).toContain('w:h="11907"');
  expect(xml).toContain('w:orient="landscape"');
  for (const value of ["Theo dõi số tiết học của học viên", "Điểm KT", "Điểm ThL/TH", "Điểm TL/BTL", "Nguyễn Văn An 31", "CÁN BỘ PHỤ TRÁCH", "GIẢNG VIÊN GIẢNG DẠY"]) expect(xml).toContain(value);
  expect(xml).toContain('w:gridSpan w:val="12"');
  expect(xml).toContain('w:vMerge w:val="restart"');
  expect(xml).toContain('w:w="15309"');
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const wordRuns = Array.from(parsed.getElementsByTagName("w:r"));
  const captionRun = wordRuns.find(run => run.textContent === "(Ký và ghi rõ họ tên)");
  expect(captionRun.getElementsByTagName("w:i").length).toBe(1);
  const roleRun = wordRuns.find(run => run.textContent === "GIẢNG VIÊN GIẢNG DẠY");
  expect(roleRun.getElementsByTagName("w:b")[0]?.getAttribute("w:val")).toBe("false");
  expect(xml.match(/<w:sectPr>/g)).toHaveLength(1);
  expect(xml.match(/GIẢNG VIÊN GIẢNG DẠY/g)).toHaveLength(1);
  expect(xml.match(/Có mặt\/Tổng số/g)).toHaveLength(1);
  expect(xml.match(/THEO DÕI TÌNH HÌNH HỌC TẬP CỦA HỌC VIÊN/g)).toHaveLength(1);
  const footer = await zip.file("word/footer1.xml").async("string");
  expect(footer).toContain('w:val="808080"');
  expect(footer).toContain("BM.02-QT.SDH.03"); expect(footer).toContain("05/5/25-REV:01");
});

it("round-trips all 31 learners in Excel with the source form's merged cells and signatures", async () => {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await bytes(await createSubjectSigningExcel(sample())));
  expect(book.worksheets).toHaveLength(1);
  const first = book.worksheets[0];
  const at = (row, logicalColumn) => {
    const x = SUBJECT_SIGNING_FORM.widths.slice(0, logicalColumn).reduce((a, b) => a + b, 0) / 20;
    let left = 0;
    for (let col = 1; col <= first.columnCount; col++) {
      if (Math.abs(left - x) < .03) return first.getCell(row, col).master;
      left += excelWidthToPoints(first.getColumn(col).width);
    }
    throw Error('Logical column missing');
  };
  expect(at(10, 11).value).toBe(0); expect(at(10, 12).value).toBe("");
  expect(at(10, 13).value).toBe(9); expect(at(10, 16).value).toBe("Không đạt");
  expect(at(8, 2).value).toBe("Theo dõi số tiết học của học viên");
  expect(first.getRow(46).values).toContain("CÁN BỘ PHỤ TRÁCH");
  expect(at(40, 1).value).toBe("Nguyễn Văn An 31");
  expect(first.getCell("A41").value).toBe("Có mặt/Tổng số");
  const firstValue = row => [...new Set(first.getRow(row).values.filter(Boolean))][0];
  expect(firstValue(4).richText).toContainEqual(expect.objectContaining({ text: "Tên học phần: ", font: expect.objectContaining({ bold: true, name: 'Times New Roman', size: 13 }) }));
  expect(firstValue(5).richText).toContainEqual(expect.objectContaining({ text: "Chuyên ngành: ", font: expect.objectContaining({ bold: true }) }));
  expect(Array.from({ length: 31 }, (_, i) => first.getCell(10 + i, 1).value)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  expect(first.pageSetup).toMatchObject({ orientation: "landscape", fitToWidth: 1, fitToHeight: 0, printTitlesRow: "8:9", printArea: `A1:${first.getColumn(first.columnCount).letter}48` });
});

it('gives metadata independent widths and equal signature thirds with long fixture content', async () => {
  const doc = { ...sample(), subject: 'Học phần có tên dài phục vụ kiểm tra bố cục '.repeat(3),
    group: 'Lớp học phần liên khóa chuyên ngành kỹ thuật '.repeat(3), year: '2026–2027',
    lecturer: 'Nguyễn Thị Giảng Viên Tên Dài', lecturerUnit: 'Đơn vị công tác có tên dài '.repeat(3) };
  const blob = await createSubjectSigningExcel(doc), buffer = await bytes(blob);
  fs.mkdirSync(path.resolve('../.tmp'), { recursive: true });
  fs.writeFileSync(path.resolve('../.tmp/subject-signing-ux-sample.xlsx'), new Uint8Array(buffer));
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer); const sheet = book.worksheets[0];
  const width = cell => {
    const range = sheet.model.merges.map(value => value.split(':').map(address => sheet.getCell(address)))
      .find(([start]) => start.address === cell.master.address);
    return range ? Array.from({ length: range[1].col - range[0].col + 1 }, (_, i) => excelWidthToPoints(sheet.getColumn(range[0].col + i).width)).reduce((a, b) => a + b, 0) : excelWidthToPoints(sheet.getColumn(cell.col).width);
  };
  const metadata = [...new Set(sheet.getRow(6).values.filter(Boolean))];
  expect(metadata.map(v => v.richText[0].text)).toEqual(['Khóa: ', 'Năm: ', 'Địa điểm: ']);
  const cells = [];
  sheet.getRow(6).eachCell(cell => { if (cell.address === cell.master.address && cell.value) cells.push(cell); });
  expect(width(cells[0])).toBeCloseTo(101, 0); expect(width(cells[1])).toBeCloseTo(101, 0);
  expect(width(cells[2])).toBeCloseTo(519.44, 0);
  expect(sheet.getRow(6).height).toBeLessThan(60);
  const signatures = [];
  sheet.getRow(46).eachCell(cell => { if (cell.address === cell.master.address && cell.value) signatures.push(width(cell)); });
  expect(signatures).toHaveLength(3);
  signatures.forEach(value => expect(value).toBeCloseTo(255.15, 1));
  expect(sheet.getRow(4).height).toBeGreaterThan(17);
  expect(sheet.getRow(7).height).toBeGreaterThan(17);
});
